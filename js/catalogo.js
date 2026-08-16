// Catálogo de 1.324 ejercicios. Se carga solo la primera vez que abres el
// buscador, no al arrancar la app: son 157 KB que la mayoría de las sesiones
// no necesita.
//
// Los nombres del dataset vienen solo en inglés. El índice trae además un
// nombre en español generado por piezas (ver construir-catalogo.mjs), y la
// búsqueda mira los dos, sin acentos. Así "jalon" encuentra "cable pulldown"
// tanto por su nombre traducido como por el original.

let indice = null;
let cargando = null;

export function cargarCatalogo() {
  if (indice) return Promise.resolve(indice);
  cargando ??= fetch(new URL('../datos/catalogo.json', import.meta.url))
    .then(r => (r.ok ? r.json() : []))
    .then(d => {
      indice = d.map(x => ({
        catalogId: x.i, mediaId: x.m,
        nombre: x.e ?? x.n,            // el español si lo hay, si no el original
        nombreEn: x.n,
        grupo: x.g,
        equipo: x.q,
        familia: x.f,                  // libre | maquina | corporal | accesorio
        buscar: sinAcentos(`${x.e ?? ''} ${x.n} ${x.g} ${x.q}`),
      }));
      return indice;
    })
    .catch(() => { indice = []; return indice; });
  return cargando;
}

export const catalogoListo = () => indice !== null;

export const sinAcentos = s => (s ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Sinónimos de gimnasio que el índice no puede adivinar solo, porque no salen
// del nombre en inglés ni de la traducción por piezas.
const SINONIMOS = {
  'dominadas': 'dominada', 'jalon': 'jalon pulldown', 'jalones': 'jalon pulldown',
  'polea': 'polea cable', 'poleas': 'polea cable',
  'mancuerna': 'mancuernas dumbbell', 'mancuernas': 'mancuernas dumbbell',
  'barra': 'barra barbell', 'multipower': 'multipower smith',
  'maquina': 'maquina lever machine', 'goma': 'goma band', 'gomas': 'goma band',
  'femoral': 'femoral curl', 'isquios': 'femoral curl',
  'gemelo': 'gemelo calf', 'gemelos': 'gemelo calf',
  'cuadriceps': 'cuadriceps quad', 'gluteo': 'gluteo glute', 'gluteos': 'gluteo glute',
  'dorsal': 'dorsal lat', 'dorsales': 'dorsal lat',
  'trapecio': 'trapecio trap shrug', 'lumbar': 'lumbar back extension',
  'abdominal': 'abdominal abs crunch', 'abdominales': 'abdominal abs crunch',
  'sentadillas': 'sentadilla squat', 'zancadas': 'zancada lunge',
  'fondos': 'fondos dip', 'flexiones': 'flexiones push',
  'aperturas': 'aperturas fly', 'pajaro': 'deltoides posterior reverse fly',
  'remos': 'remo row', 'peso muerto': 'peso muerto deadlift',
  'banca': 'banca bench', 'press banca': 'press banca bench press',
  'biceps': 'biceps curl', 'triceps': 'triceps',
  'hombro': 'hombro shoulder delt', 'hombros': 'hombro shoulder delt',
  'pecho': 'pecho chest', 'espalda': 'espalda back lat',
  'pantorrilla': 'gemelo calf', 'cadera': 'cadera hip',
  'prensa': 'prensa leg press', 'elevaciones': 'elevacion raise',
  'encogimientos': 'encogimiento shrug', 'plancha': 'plancha plank',
  'estiramiento': 'estiramiento stretch', 'estiramientos': 'estiramiento stretch',
};

function expandir(consulta) {
  const q = sinAcentos(consulta);
  const partes = new Set([q]);
  for (const t of q.split(/\s+/)) if (SINONIMOS[t]) partes.add(SINONIMOS[t]);
  if (SINONIMOS[q]) partes.add(SINONIMOS[q]);
  return [...partes].join(' ').split(/\s+/).filter(Boolean);
}

export const FAMILIAS = [
  ['libre', 'Peso libre'],
  ['maquina', 'Máquina y polea'],
  ['corporal', 'Peso corporal'],
  ['accesorio', 'Gomas y accesorios'],
];

export function gruposCatalogo() {
  if (!indice) return [];
  const c = new Map();
  for (const x of indice) c.set(x.grupo, (c.get(x.grupo) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

// Devuelve los resultados ordenados. Sin texto y sin filtros devuelve el
// catálogo entero: se puede navegar sin escribir nada, que es como lo mira
// quien no sabe todavía qué busca.
export function buscarCatalogo(consulta, { limite = 60, grupo = null, familia = null } = {}) {
  if (!indice) return [];
  const q = sinAcentos(consulta);

  const tokens = expandir(consulta);
  const salida = [];

  for (const x of indice) {
    if (grupo && x.grupo !== grupo) continue;
    if (familia && x.familia !== familia) continue;
    if (!q) { salida.push({ x, punto: 0 }); continue; }

    // Cuenta cuántos de los términos aparecen; los que no encajan se descartan.
    let punto = 0, encajan = 0;
    for (const t of tokens) {
      if (t.length < 2) continue;
      if (x.buscar.includes(t)) {
        encajan++;
        punto += x.buscar.startsWith(t) ? 3 : 1;
      }
    }
    if (!encajan) continue;
    if (sinAcentos(x.nombre).startsWith(q)) punto += 6;
    punto -= x.nombre.length / 100;          // a igualdad, el nombre más corto
    salida.push({ x, punto });
  }

  if (q) salida.sort((a, b) => b.punto - a.punto);
  else salida.sort((a, b) => a.x.nombre.localeCompare(b.x.nombre, 'es'));

  return { total: salida.length, items: salida.slice(0, limite).map(r => r.x) };
}
