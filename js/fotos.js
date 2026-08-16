// Fotos de progreso. Van en el mismo almacén que el resto, como archivos, y
// nunca salen del dispositivo.
//
// Se reducen antes de guardar: una foto de móvil son 4 MB y a 1000 px de lado
// se ve exactamente igual para comparar un mes con otro, ocupando 200 KB. Con
// treinta fotos la diferencia es entre 120 MB y 6 MB.

import { db } from './db.js';
import { nuevoId } from './model.js';

const LADO_MAX = 1000;
const CALIDAD = 0.82;
const enMemoria = new Map();

export async function guardarFoto(archivo) {
  const blob = await reducir(archivo);
  const id = nuevoId('fo');
  await db.set('foto:' + id, blob);
  return { id, bytes: blob.size };
}

export async function urlFoto(id) {
  if (enMemoria.has(id)) return enMemoria.get(id);
  const blob = await db.get('foto:' + id);
  if (!(blob instanceof Blob)) return null;
  const u = URL.createObjectURL(blob);
  enMemoria.set(id, u);
  return u;
}

export async function borrarFoto(id) {
  const u = enMemoria.get(id);
  if (u) { URL.revokeObjectURL(u); enMemoria.delete(id); }
  await db.del('foto:' + id);
}

export async function pesoFotos() {
  const claves = await db.claves();
  const fotos = claves.filter(k => String(k).startsWith('foto:'));
  let bytes = 0;
  for (const k of fotos) {
    const b = await db.get(k);
    if (b instanceof Blob) bytes += b.size;
  }
  return { cuantas: fotos.length, bytes };
}

// Las fotos se guardan como archivo, no como texto, así que para meterlas en
// la copia de seguridad hay que convertirlas. Es lo que hace que una copia con
// fotos pese megas en vez de kilobytes.
export async function fotosParaCopia() {
  const claves = await db.claves();
  const salida = {};
  for (const k of claves.filter(x => String(x).startsWith('foto:'))) {
    const b = await db.get(k);
    if (b instanceof Blob) salida[String(k).slice(5)] = await aTexto(b);
  }
  return salida;
}

export async function restaurarFotos(mapa) {
  for (const [id, txt] of Object.entries(mapa ?? {})) {
    const blob = await deTexto(txt);
    if (blob) await db.set('foto:' + id, blob);
  }
}

// ------------------------------------------------------------------ interno
function reducir(archivo) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => (b ? res(b) : rej(new Error('no se pudo procesar'))), 'image/jpeg', CALIDAD);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('no es una imagen')); };
    img.src = url;
  });
}

const aTexto = blob => new Promise(r => {
  const f = new FileReader();
  f.onload = () => r(f.result);
  f.readAsDataURL(blob);
});

const deTexto = async txt => {
  try { return await (await fetch(txt)).blob(); } catch { return null; }
};
