// Capa de imágenes. TODO lo que tiene que ver con la media de los ejercicios
// pasa por aquí, y por ningún otro sitio.
//
// ─────────────────────────────────────────────────────────────────────────────
//  PARA QUITAR LAS IMÁGENES: pon PROVEEDOR.activo en false y ya está.
//  La app entera sigue funcionando; simplemente no se pinta ninguna imagen ni
//  la línea de atribución. No hay que tocar ninguna vista.
// ─────────────────────────────────────────────────────────────────────────────
//
// Por qué está montado así: las fotos y los GIFs son de Gym visual, cedidos al
// repositorio hasaneyldrm/exercises-dataset con un permiso propio de su autor.
// Los DATOS de ese repositorio son MIT y se pueden usar sin problema, pero la
// media no: su aviso dice literalmente que clonar el repositorio no da licencia
// sobre las imágenes. Para uso personal da igual. Antes de publicar la app de
// forma abierta hay que pedir licencia a Gym visual o cambiar de proveedor.
// Cambiar de proveedor es tocar el objeto de abajo y nada más.

import { db } from './db.js';
import { estado } from './store.js';

export const PROVEEDOR = {
  activo: true,
  nombre: 'Gym visual',
  atribucion: '© Gym visual — gymvisual.com',
  // 180×180 es el límite que impone la licencia del proveedor.
  base: 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main',
  miniatura: (id, media) => `/images/${id}-${media}.jpg`,
  animacion: (id, media) => `/videos/${id}-${media}.gif`,
};

// Enlace entre tus ejercicios y el catálogo. Es un punto de partida: desde la
// ficha de cada ejercicio se puede cambiar la imagen si no es la correcta.
export const CATALOGO = {
  "Press plano": { catalogId: '0289', media: 'SpYC0Kp', grupo: 'Pecho', en: "dumbbell bench press" },
  "Jalón prono": { catalogId: '0198', media: 'RVwzP10', grupo: 'Espalda', en: "cable pulldown" },
  "Press militar": { catalogId: '0603', media: '67n3r98', grupo: 'Hombro', en: "lever shoulder press" },
  "Curl bíceps": { catalogId: '0294', media: 'NbVPDMW', grupo: 'Bíceps', en: "dumbbell biceps curl" },
  "Ext. tríceps": { catalogId: '0201', media: '3ZflifB', grupo: 'Tríceps', en: "cable pushdown" },
  "Press inclinado máquina": { catalogId: '1299', media: 'jHAnWmT', grupo: 'Pecho', en: "lever incline chest press" },
  "Remo unilateral": { catalogId: '0589', media: 'Fhdtwf3', grupo: 'Espalda', en: "lever one arm bent over row" },
  "Deltoides posterior": { catalogId: '0602', media: 'myfUsKf', grupo: 'Hombro', en: "lever seated reverse fly" },
  "Ext. tríceps overhead": { catalogId: '0092', media: '5uFK1xr', grupo: 'Tríceps', en: "barbell seated overhead triceps extension" },
  "Curl martillo": { catalogId: '0313', media: 'slDvUAU', grupo: 'Bíceps', en: "dumbbell hammer curl" },
  "Prensa": { catalogId: '1425', media: 'WWD6FzI', grupo: 'Glúteo', en: "sled 45 degrees one leg press" },
  "Curl femoral": { catalogId: '0586', media: '17lJ1kr', grupo: 'Femoral', en: "lever lying leg curl" },
  "Hip thrust": { catalogId: '3236', media: 'Pjbc0Kt', grupo: 'Glúteo', en: "resistance band hip thrusts on knees (female)" },
  "Abductores": { catalogId: '0597', media: 'CHpahtl', grupo: 'Glúteo', en: "lever seated hip abduction" },
  "Piernas rígidas / SLDL": { catalogId: '0432', media: '5eLRITT', grupo: 'Glúteo', en: "dumbbell stiff leg deadlift" },
  "Leg extension": { catalogId: '0585', media: 'my33uHU', grupo: 'Cuádriceps', en: "lever leg extension" },
  "Sissy squat": { catalogId: '1489', media: 'xdYPUtE', grupo: 'Cuádriceps', en: "sissy squat" },
  "Abs": { catalogId: '0175', media: 'WW95auq', grupo: 'Abdomen', en: "cable kneeling crunch" },
  "Elevación lateral": { catalogId: '0178', media: 'goJ6ezq', grupo: 'Hombro', en: "cable lateral raise" },
  "Curl bíceps 90°": { catalogId: '0195', media: 'P2lNrGL', grupo: 'Bíceps', en: "cable preacher curl" },
  "Sentadilla": { catalogId: '0043', media: 'qXTaZnJ', grupo: 'Glúteo', en: "barbell full squat" },
  "Press around": { catalogId: '1262', media: 'w4dLzSx', grupo: 'Pecho', en: "cable one arm decline chest fly" },
  "Zancada": { catalogId: '0054', media: 't8iSghb', grupo: 'Glúteo', en: "barbell lunge" },
};

export const activo = () => PROVEEDOR.activo && estado.ajustes.imagenes !== false;

// Busca el enlace de un ejercicio: primero el que tenga guardado, si no por
// nombre, si no por alguno de sus nombres antiguos.
export function fichaDe(ej) {
  if (!ej) return null;
  if (ej.catalogId && ej.mediaId) return { catalogId: ej.catalogId, media: ej.mediaId };
  const c = CATALOGO[ej.nombre] ?? ej.alias?.map(a => CATALOGO[a]).find(Boolean);
  return c ?? null;
}

const url = (tipo, f) => PROVEEDOR.base + PROVEEDOR[tipo](f.catalogId, f.media);

// Descarga una vez y guarda el archivo, así la segunda vez funciona sin
// cobertura. Devuelve una URL de objeto lista para un <img>, o null.
const enMemoria = new Map();

export async function imagen(ej, tipo = 'miniatura') {
  const f = fichaDe(ej);
  return f ? porFicha(f, tipo) : null;
}

// Igual, pero a partir de una entrada del catálogo que todavía no es tuya.
export function miniaturaDe(c) {
  if (!c?.catalogId) return Promise.resolve(null);
  return porFicha({ catalogId: c.catalogId, media: c.mediaId }, 'miniatura');
}

export function animacionDe(c) {
  if (!c?.catalogId) return Promise.resolve(null);
  return porFicha({ catalogId: c.catalogId, media: c.mediaId }, 'animacion');
}

async function porFicha(f, tipo) {
  if (!activo()) return null;

  const clave = `media:${tipo}:${f.catalogId}`;
  if (enMemoria.has(clave)) return enMemoria.get(clave);

  const guardado = await db.get(clave);
  if (guardado instanceof Blob) {
    const u = URL.createObjectURL(guardado);
    enMemoria.set(clave, u);
    return u;
  }

  try {
    const r = await fetch(url(tipo, f), { mode: 'cors' });
    if (!r.ok) throw new Error(String(r.status));
    const blob = await r.blob();
    await db.set(clave, blob);
    const u = URL.createObjectURL(blob);
    enMemoria.set(clave, u);
    return u;
  } catch {
    return null;   // sin conexión y sin copia: la vista simplemente no pinta nada
  }
}

// Borra todas las imágenes guardadas. Se usa al desactivarlas desde ajustes.
export async function olvidarTodo() {
  for (const u of enMemoria.values()) URL.revokeObjectURL(u);
  enMemoria.clear();
  const claves = await db.claves();
  await Promise.all(claves.filter(k => String(k).startsWith('media:')).map(k => db.del(k)));
}

export async function espacioMedia() {
  const claves = await db.claves();
  return claves.filter(k => String(k).startsWith('media:')).length;
}
