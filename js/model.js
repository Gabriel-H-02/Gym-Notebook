// Modelo de datos v2 y migración desde el formato v1 (el del index.html viejo).
//
// Reglas que no se rompen nunca:
//   · El peso se guarda SIEMPRE en kilos, como número. La unidad es cosa de
//     la vista. Así cambiar a libras reconvierte todo el histórico gratis.
//   · Una variante puede ser "por lado" (una mancuerna, un brazo). El número
//     guardado es el de un lado, nunca la suma.
//   · Cada registro conserva el nombre original con el que se escribió.

import { ENLACE_INICIAL } from './catalogo-inicial.js';

export const SCHEMA = 2;

export const nuevoId = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function estadoInicial() {
  return {
    schema: SCHEMA,
    ajustes: {
      unidad: 'kg',              // 'kg' | 'lb'
      escalaIntensidad: 'rir',   // 'rir' | 'rpe'
      valoresRapidos: [0, 1, 2],
      descansoPorDefecto: 120,
      descansoAuto: true,        // arranca solo al cerrar una serie
      sonido: true,
      vibracion: true,
      pantallaEncendida: true,   // Wake Lock mientras corre el descanso
      imagenes: true,            // ilustraciones de los ejercicios
      ultimaCopia: null,
    },
    ejercicios: [],
    rutinas: [],
    sesiones: [],
    diario: {},
    medidas: { sitios: sitiosPorDefecto(), registros: [] },
  };
}

// ------------------------------------------------------------- medidas
// Bilateral significa que se apunta izquierda y derecha por separado. En brazo
// y muslo importa: una diferencia que crece es información, y promediarlas la
// escondería.
export function sitiosPorDefecto() {
  return [
    { id: 'st_cuello', nombre: 'Cuello',  bilateral: false, orden: 0 },
    { id: 'st_pecho',  nombre: 'Pecho',   bilateral: false, orden: 1 },
    { id: 'st_brazo',  nombre: 'Brazo',   bilateral: true,  orden: 2 },
    { id: 'st_cintura', nombre: 'Cintura', bilateral: false, orden: 3 },
    { id: 'st_cadera', nombre: 'Cadera',  bilateral: false, orden: 4 },
    { id: 'st_muslo',  nombre: 'Muslo',   bilateral: true,  orden: 5 },
    { id: 'st_gemelo', nombre: 'Gemelo',  bilateral: true,  orden: 6 },
  ];
}

// Las medidas se guardan siempre en centímetros, igual que el peso en kilos.
const CM_POR_PULGADA = 2.54;
export const cmAPulg = cm => cm / CM_POR_PULGADA;
export const pulgACm = p => p * CM_POR_PULGADA;

export function mostrarMedida(cm, unidad) {
  if (cm === null || cm === undefined) return '';
  const v = unidad === 'lb' ? cmAPulg(cm) : cm;
  return String(Math.round(v * 10) / 10);
}

export function leerMedida(texto, unidad) {
  const n = leerNumero(texto);
  if (n === null) return null;
  return unidad === 'lb' ? pulgACm(n) : n;
}

export const unidadMedida = ajustes => (ajustes.unidad === 'lb' ? 'in' : 'cm');

// Valor de un sitio en un registro: {v} si es simple, {izq, der} si es bilateral.
export function valorSitio(reg, sitioId) {
  const v = reg?.valores?.[sitioId];
  if (!v) return null;
  if (v.izq != null || v.der != null) {
    const lados = [v.izq, v.der].filter(x => x != null);
    return lados.length ? lados.reduce((a, b) => a + b, 0) / lados.length : null;
  }
  return v.v ?? null;
}

// ------------------------------------------------------------------ unidades
const KG_POR_LB = 0.45359237;
export const kgALb = kg => kg / KG_POR_LB;
export const lbAKg = lb => lb * KG_POR_LB;

export function mostrarPeso(kg, unidad) {
  if (kg === null || kg === undefined) return '';
  const v = unidad === 'lb' ? kgALb(kg) : kg;
  return String(Math.round(v * 100) / 100);
}

export function leerPeso(texto, unidad) {
  const s = String(texto ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return unidad === 'lb' ? lbAKg(n) : n;
}

export const leerNumero = t => {
  const s = String(t ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

// --------------------------------------------------------------- intensidad
export const ESCALAS = {
  rir: { etiqueta: 'RIR', valores: [0, 1, 2, 3, 4, 5], texto: v => (v === 0 ? 'F' : 'R' + v) },
  rpe: { etiqueta: 'RPE', valores: [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10], texto: v => String(v) },
};

export function textoIntensidad(int) {
  if (!int || int.valor === null || int.valor === undefined) return '';
  return (ESCALAS[int.escala] ?? ESCALAS.rir).texto(int.valor);
}

// ---------------------------------------------------------------- selectores
export const porId = (lista, id) => lista.find(x => x.id === id) ?? null;

export function variante(ej, vaId) {
  if (!ej || !vaId) return null;
  return ej.variantes.find(v => v.id === vaId) ?? null;
}

export function nombreCompleto(ej, vaId) {
  const v = variante(ej, vaId);
  return v ? `${ej.nombre} · ${v.nombre}` : (ej?.nombre ?? '');
}

export function varianteActiva(ej) {
  if (!ej?.variantes.length) return null;
  return ej.variantes.find(v => v.estado === 'actual')
    ?? ej.variantes.filter(v => v.estado !== 'descartada').at(-1)
    ?? ej.variantes.at(-1);
}

export const esPorLado = (ej, vaId) => variante(ej, vaId)?.porLado === true;

// Última vez que se hizo ESTE ejercicio y variante, mirando todo el historial
// y no solo la misma sesión de la semana pasada. Corrige el bug del v1.
export function ultimaVez(estado, exId, vaId, fechaTope) {
  const previas = estado.sesiones
    .filter(s => s.fecha < fechaTope)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  for (const s of previas) {
    for (const en of s.entradas) {
      if (en.exId !== exId) continue;
      if (vaId && en.vaId && en.vaId !== vaId) continue;
      const sets = en.sets.filter(x => x.pesoKg !== null || x.reps !== null);
      if (sets.length) return { fecha: s.fecha, rutina: s.rutinaNombre, vaId: en.vaId, sets };
    }
  }
  return null;
}

// Detecta una carga fuera de la escala habitual de esa variante. Es lo que
// evita que un cambio de máquina se dibuje como una pérdida de fuerza.
export function cargaAnomala(estado, exId, vaId, pesoKg) {
  if (pesoKg === null || pesoKg <= 0) return null;
  const pesos = [];
  for (const s of estado.sesiones) {
    for (const en of s.entradas) {
      if (en.exId !== exId) continue;
      if (vaId && en.vaId !== vaId) continue;
      for (const x of en.sets) if (x.pesoKg > 0) pesos.push(x.pesoKg);
    }
  }
  if (pesos.length < 4) return null;
  const max = Math.max(...pesos), min = Math.min(...pesos);
  if (pesoKg > max * 1.6) return { tipo: 'alta', habitual: [min, max] };
  if (pesoKg < min * 0.6) return { tipo: 'baja', habitual: [min, max] };
  return null;
}

// ------------------------------------------------- superseries y dropsets
//
// Son dos cosas distintas y por eso viven en sitios distintos del modelo:
//
//   Superserie · agrupa EJERCICIOS. Cada entrada lleva `grupo = {id, tipo}` y
//                las entradas consecutivas con el mismo id forman el bloque.
//   Dropset    · son subseries dentro de UNA serie. Viven en `set.drops`.
//
// Ambos campos pueden faltar en datos viejos, así que todo lo que los lee
// tolera undefined.

export const LETRAS = 'ABCDEFGH';

// Devuelve, para cada entrada, su bloque: { letra, indice, total } o null.
export function bloques(entradas) {
  const mapa = new Map();
  let letra = -1, idActual = null;

  const orden = entradas.slice().sort((a, b) => a.orden - b.orden);
  for (const en of orden) {
    const gid = en.grupo?.id ?? null;
    if (!gid) { idActual = null; continue; }
    if (gid !== idActual) { idActual = gid; letra++; }
    const lista = mapa.get(gid) ?? [];
    lista.push(en);
    mapa.set(gid, lista);
    en._letra = LETRAS[letra % LETRAS.length];
  }

  const res = new Map();
  for (const [gid, lista] of mapa) {
    // Un bloque de uno no es una superserie; se deshace solo al leerlo.
    if (lista.length < 2) continue;
    lista.forEach((en, i) => res.set(en.id, {
      gid, letra: en._letra, indice: i + 1, total: lista.length,
      primera: i === 0, ultima: i === lista.length - 1,
    }));
  }
  for (const en of orden) delete en._letra;
  return res;
}

export const enSuperserie = (entradas, en) => bloques(entradas).get(en.id) ?? null;

// El botón de superserie no actúa sobre un ejercicio, actúa sobre el ENLACE
// entre uno y el siguiente. Así encadenar un tercero es pulsar el enlace de
// abajo, y romper por el medio parte el bloque en dos en vez de deshacerlo.
export const unidos = (a, b) => !!(a?.grupo?.id && a.grupo.id === b?.grupo?.id);

export function unir(lista, i) {
  const o = lista.slice().sort((x, y) => x.orden - y.orden);
  const a = o[i], b = o[i + 1];
  if (!a || !b || unidos(a, b)) return;
  const gid = a.grupo?.id ?? b.grupo?.id ?? nuevoId('gr');
  const viejoB = b.grupo?.id;
  a.grupo = { id: gid, tipo: 'superserie' };
  b.grupo = { id: gid, tipo: 'superserie' };
  // Si el siguiente ya arrastraba su propio bloque, se absorbe entero.
  if (viejoB && viejoB !== gid) {
    for (const x of o) if (x.grupo?.id === viejoB) x.grupo = { id: gid, tipo: 'superserie' };
  }
  limpiarSueltos(o);
}

export function separar(lista, i) {
  const o = lista.slice().sort((x, y) => x.orden - y.orden);
  const a = o[i], b = o[i + 1];
  if (!unidos(a, b)) return;
  const gid = a.grupo.id;
  const nuevo = nuevoId('gr');
  for (let k = i + 1; k < o.length; k++) {
    if (o[k].grupo?.id !== gid) break;
    o[k].grupo = { id: nuevo, tipo: 'superserie' };
  }
  limpiarSueltos(o);
}

// Un bloque de un solo ejercicio no es una superserie: se deshace.
function limpiarSueltos(o) {
  const cuenta = new Map();
  for (const x of o) if (x.grupo?.id) cuenta.set(x.grupo.id, (cuenta.get(x.grupo.id) ?? 0) + 1);
  for (const x of o) if (x.grupo?.id && cuenta.get(x.grupo.id) < 2) x.grupo = null;
}

export function textoSerie(s, unidad, mostrar) {
  const base = `${mostrar(s.pesoKg, unidad) || '?'}×${s.reps ?? '?'}`;
  if (!s.drops?.length) return base;
  return base + s.drops.map(d => ` ▾ ${mostrar(d.pesoKg, unidad) || '?'}×${d.reps ?? '?'}`).join('');
}

// ------------------------------------------------------------------ fechas
export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fechaCorta(iso) {
  const [a, m, d] = iso.split('-');
  return `${Number(d)} ${MES[Number(m) - 1]}`;
}

export function diasDesde(iso) {
  const a = new Date(iso + 'T00:00:00'), b = new Date(hoyISO() + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// --------------------------------------------------------------- migración
// Convierte el formato v1 (mc_entries / mc_templates) al v2. Es la misma
// lógica que migracion.mjs, aquí para que la app actualice sola los datos
// que ya tienes en el móvil.

const norm = s => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const FUSIONES = {
  'press plano máquina':     { ex: 'Press plano', va: 'Máquina' },
  'press plano mancuernas':  { ex: 'Press plano', va: 'Mancuernas' },
  'press plano polea':       { ex: 'Press plano', va: 'Polea unilateral' },
  'abductores': { ex: 'Abductores' }, 'abductor': { ex: 'Abductores' }, 'abductore': { ex: 'Abductores' },
  'curl biceps 90°': { ex: 'Curl bíceps 90°' }, 'curl 90°': { ex: 'Curl bíceps 90°' },
  'piernas rígidas': { ex: 'Piernas rígidas / SLDL' }, 'sldl': { ex: 'Piernas rígidas / SLDL' },
  'tríceps unilateral':      { ex: 'Ext. tríceps', va: 'Unilateral' },
  'ext. tríceps unilateral': { ex: 'Ext. tríceps', va: 'Unilateral' },
  'tríceps':                 { ex: 'Ext. tríceps', va: 'Unilateral' },
  'ext. tríceps polea':      { ex: 'Ext. tríceps', va: 'Polea bilateral' },
  'extensión de triceps':    { ex: 'Ext. tríceps', va: 'Polea bilateral' },
  'zancada': { ex: 'Zancada' }, 'zancada corta': { ex: 'Zancada' },
  'sissy squat': { ex: 'Sissy squat' },
  // Corregido el 16 ago: siempre fue prono, no neutro.
  'jalón neutro': { ex: 'Jalón prono' },
};

const CORTES = [
  { ex: 'Prensa', desde: '2026-06-26', antes: 'Bilateral', despues: 'Unilateral' },
  { ex: 'Elevación lateral', desde: '2026-07-09', antes: 'Máquina antigua', despues: 'Máquina nueva' },
  { ex: 'Deltoides posterior', desde: '2026-07-02', antes: 'Original', despues: 'Ejercicio nuevo' },
  { ex: 'Ext. tríceps', desde: '2026-08-10', antes: null, despues: 'Unilateral' },
  { ex: 'Sissy squat', desde: '2026-06-19', antes: 'Con disco', despues: 'Goma elástica' },
  { ex: 'Piernas rígidas / SLDL', desde: '2026-07-25', antes: 'Mancuernas', despues: 'Barra' },
];

const OVERRIDES = {
  '2026-08-05|Tríceps': 'Polea bilateral',
  '2026-08-10|Press plano mancuernas': 'Polea unilateral',
};

const ERRATAS = {
  '2026-07-02|Remo unilateral|1': 96.25,
  '2026-06-29|Ext. tríceps polea|1': 36.25,
  '2026-06-09|Piernas rígidas|0': 38,
  '2026-06-09|Piernas rígidas|1': 38,
};

const POR_LADO = new Set([
  'Press plano|Mancuernas', 'Press plano|Polea unilateral',
  'Piernas rígidas / SLDL|Mancuernas', 'Ext. tríceps|Unilateral', 'Prensa|Unilateral',
]);

const ESTADOS = {
  'Press plano|Polea unilateral': 'actual', 'Press plano|Mancuernas': 'descartada',
  'Press plano|Máquina': 'descartada', 'Piernas rígidas / SLDL|Barra': 'actual',
  'Piernas rígidas / SLDL|Mancuernas': 'descartada', 'Ext. tríceps|Unilateral': 'actual',
  'Prensa|Unilateral': 'actual', 'Sissy squat|Goma elástica': 'actual',
  'Elevación lateral|Máquina nueva': 'actual', 'Deltoides posterior|Ejercicio nuevo': 'actual',
};

export function migrarV1(v1) {
  const estado = estadoInicial();
  const entries = v1.mc_entries ?? {};
  const cat = new Map();

  const resolver = (crudo, fecha) => {
    const m = FUSIONES[norm(crudo)] ?? { ex: crudo.trim() };
    const exNombre = m.ex;
    let vaNombre = m.va ?? null;
    for (const c of CORTES) {
      if (c.ex !== exNombre) continue;
      if (fecha >= c.desde) { if (c.despues) vaNombre = c.despues; }
      else if (c.antes) vaNombre = c.antes;
    }
    const ov = OVERRIDES[`${fecha}|${crudo.trim()}`];
    if (ov) vaNombre = ov;

    if (!cat.has(exNombre)) {
      cat.set(exNombre, { id: nuevoId('ex'), nombre: exNombre, alias: [], catalogId: null,
        grupo: null, descansoSeg: null, variantes: [], creado: fecha });
    }
    const ej = cat.get(exNombre);
    if (!ej.alias.includes(crudo.trim())) ej.alias.push(crudo.trim());

    let vaId = null;
    if (vaNombre) {
      let v = ej.variantes.find(x => x.nombre === vaNombre);
      if (!v) {
        const k = `${exNombre}|${vaNombre}`;
        v = { id: nuevoId('va'), nombre: vaNombre, porLado: POR_LADO.has(k) ? true : null,
              estado: ESTADOS[k] ?? null };
        ej.variantes.push(v);
      }
      vaId = v.id;
    }
    return { exId: ej.id, vaId };
  };

  for (const fecha of Object.keys(entries).sort()) {
    const e = entries[fecha];

    estado.diario[fecha] = {
      fecha,
      pesoKg: leerNumero(e.weight), suenoH: leerNumero(e.sleep), pasos: leerNumero(e.steps),
      kcal: leerNumero(e.kcal), protG: leerNumero(e.prot), carbG: leerNumero(e.carb),
      grasaG: leerNumero(e.fat), hambre: e.hunger ?? null, energia: e.energy ?? null,
      notas: e.notes || '',
      // El cuaderno viejo ya marcaba los días de descanso. Esa información se
      // estaba perdiendo: un día de descanso y un día que no apuntaste
      // quedaban igual.
      descanso: e.session === 'Descanso',
    };

    const exs = e.exercises ?? [];
    if (e.session === 'Descanso' && !exs.length) continue;

    const entradas = [];
    exs.forEach((x, orden) => {
      const { exId, vaId } = resolver(x.name, fecha);
      const sets = [];
      (x.sets ?? []).forEach((s, i) => {
        const w = String(s.w ?? '').trim(), r = String(s.r ?? '').trim();
        if (!w && !r) return;                       // serie vacía: se descarta
        const err = ERRATAS[`${fecha}|${x.name.trim()}|${i}`];
        const rir = { F: 0, R1: 1, R2: 2 }[s.rir];
        sets.push({
          id: nuevoId('st'),
          pesoKg: err ?? leerNumero(w),
          reps: leerNumero(r),
          intensidad: rir === undefined ? null : { escala: 'rir', valor: rir },
          tipo: 'efectiva',
        });
      });
      if (sets.length) entradas.push({ id: nuevoId('en'), exId, vaId, orden, grupo: null, nota: '', sets, _orig: x.name });
    });

    if (entradas.length) {
      estado.sesiones.push({ id: nuevoId('se'), fecha, rutinaId: null, rutinaNombre: e.session, entradas });
    }
  }

  for (const [nombre, lista] of Object.entries(v1.mc_templates ?? {})) {
    if (nombre === 'Descanso' || !lista?.length) continue;
    const ultima = Object.keys(entries).sort().at(-1) ?? hoyISO();
    estado.rutinas.push({
      id: nuevoId('rt'), nombre, archivada: false,
      items: lista.map((n, i) => {
        const { exId, vaId } = resolver(n, ultima);
        // Una rutina describe lo que haces hoy, así que apunta a la variante
        // en uso y no a la que aparecía en la plantilla vieja. Sin esto, la
        // rutina te seguiría pidiendo el press de mancuernas que abandonaste.
        const ej = [...cat.values()].find(x => x.id === exId);
        const activa = varianteActiva(ej);
        return { id: nuevoId('it'), exId, vaId: activa?.id ?? vaId, orden: i,
          seriesObjetivo: 2, descansoSeg: null, grupo: null };
      }),
    });
  }

  estado.ejercicios = [...cat.values()];
  enlazarConCatalogo(estado.ejercicios);
  estado.medidas = migrarMedidasV1(v1.mc_meas, v1.mc_meas_sites);
  return estado;
}

// Rellena grupo muscular e imagen desde la tabla de enlace. Se estaba quedando
// sin hacer: la columna "Grupo muscular" del CSV salía vacía en 16 de 17
// ejercicios, y el filtro por grupo del buscador tampoco los encontraba.
export function enlazarConCatalogo(ejercicios) {
  let n = 0;
  for (const ej of ejercicios) {
    const c = ENLACE_INICIAL[ej.nombre] ?? ej.alias?.map(a => ENLACE_INICIAL[a]).find(Boolean);
    if (!c) continue;
    if (!ej.grupo) { ej.grupo = c.grupo; n++; }
    ej.catalogId ??= c.catalogId;
    ej.mediaId ??= c.media;
  }
  return n;
}

// El formato viejo era { fecha: [{name, val}] } con los nombres sueltos. Aquí
// se convierte en sitios con identidad y registros con fecha.
export function migrarMedidasV1(mc_meas, mc_meas_sites) {
  const sitios = sitiosPorDefecto();
  const porNombre = new Map(sitios.map(s => [norm(s.nombre), s]));
  const registros = [];

  for (const [fecha, filas] of Object.entries(mc_meas ?? {})) {
    if (!Array.isArray(filas) || !filas.length) continue;
    const valores = {};
    for (const f of filas) {
      const n = norm(f.name ?? '');
      if (!n) continue;
      let sitio = porNombre.get(n);
      if (!sitio) {
        sitio = { id: nuevoId('st'), nombre: (f.name ?? '').trim(), bilateral: false, orden: sitios.length };
        sitios.push(sitio);
        porNombre.set(n, sitio);
      }
      const v = leerNumero(f.val);
      if (v !== null) valores[sitio.id] = { v };
    }
    if (Object.keys(valores).length) {
      registros.push({ id: nuevoId('me'), fecha, valores, notas: '', fotos: [] });
    }
  }

  for (const n of mc_meas_sites ?? []) {
    if (!porNombre.has(norm(n))) {
      const s = { id: nuevoId('st'), nombre: String(n).trim(), bilateral: false, orden: sitios.length };
      sitios.push(s); porNombre.set(norm(n), s);
    }
  }

  registros.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return { sitios, registros };
}

// Lee el formato viejo directamente del localStorage del navegador, que es
// donde vive el historial de quien venga del index.html anterior.
export function leerV1DelNavegador() {
  try {
    const crudo = localStorage.getItem('mc_entries');
    if (!crudo) return null;
    const j = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    return { mc_entries: JSON.parse(crudo), mc_templates: j('mc_templates'),
      mc_meas: j('mc_meas'), mc_meas_sites: j('mc_meas_sites') };
  } catch { return null; }
}
