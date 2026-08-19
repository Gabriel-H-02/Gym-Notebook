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
import { ENLACE_INICIAL } from './catalogo-inicial.js';

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
// Reexportar a secas no crea la referencia local, y `fichaDe` la usa aquí
// dentro. Se enlaza con un nombre propio.
const CATALOGO = ENLACE_INICIAL;
export { CATALOGO };

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
