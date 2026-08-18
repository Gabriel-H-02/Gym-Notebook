// Estado de la app y guardado. Dos cosas distintas:
//
//   estado    lo confirmado, lo que sobrevive. Se escribe al pulsar guardar.
//   borrador  lo que estás tecleando ahora mismo. Se escribe solo, cada pocos
//             segundos, para que un cierre de pestaña a mitad de entreno no se
//             lleve noventa minutos de trabajo.

import { db } from './db.js';
import { fotosParaCopia, restaurarFotos } from './fotos.js';
import { estadoInicial, migrarV1, migrarMedidasV1, leerV1DelNavegador, SCHEMA } from './model.js';

const CLAVE = 'estado';
const CLAVE_BORRADOR = 'borrador';

export let estado = estadoInicial();
let borrador = null;
const oyentes = new Set();

export const alCambiar = fn => { oyentes.add(fn); return () => oyentes.delete(fn); };
const avisar = () => oyentes.forEach(f => f());

// ------------------------------------------------------------------ arranque
export async function cargar() {
  const guardado = await db.get(CLAVE);
  let migrado = false;

  if (guardado?.schema === SCHEMA) {
    estado = guardado;
    // Ajustes añadidos después de la primera versión: se rellenan sin tocar
    // el resto, para que una copia vieja no arranque con campos vacíos.
    estado.ajustes = { ...estadoInicial().ajustes, ...estado.ajustes };
    // Las medidas eran un objeto plano por fecha hasta la versión con diario.
    if (!estado.medidas?.sitios) {
      estado.medidas = migrarMedidasV1(estado.medidas, null);
    }
    await rellenarDescansos();
  } else if (guardado) {
    estado = { ...estadoInicial(), ...guardado, schema: SCHEMA };
  } else {
    const v1 = leerV1DelNavegador();
    if (v1?.mc_entries && Object.keys(v1.mc_entries).length) {
      estado = migrarV1(v1);
      await db.set(CLAVE, estado);
      await db.set('v1-original', v1);        // el origen se conserva intacto
      migrado = true;
    } else {
      estado = estadoInicial();
    }
  }

  borrador = await db.get(CLAVE_BORRADOR, null);
  avisar();
  return { migrado, dias: Object.keys(estado.diario).length };
}

// El día de descanso llegó después de la primera migración, así que quien ya
// se había pasado tenía esos días sin marcar. Como al migrar se guardó el
// cuaderno original, se pueden recuperar sin tener que volver a importar nada.
async function rellenarDescansos() {
  const dias = Object.values(estado.diario);
  if (!dias.some(d => d.descanso === undefined)) return;

  const v1 = await db.get('v1-original');
  const origen = v1?.mc_entries ?? {};
  let n = 0;
  for (const [fecha, d] of Object.entries(estado.diario)) {
    if (d.descanso !== undefined) continue;
    d.descanso = origen[fecha]?.session === 'Descanso';
    if (d.descanso) n++;
  }
  await db.set(CLAVE, estado);
  if (n) console.info(`Recuperados ${n} días de descanso del cuaderno anterior.`);
}

// ------------------------------------------------------------------ guardado
let pendiente = null;
export function guardar() {
  clearTimeout(pendiente);
  pendiente = setTimeout(() => db.set(CLAVE, estado), 120);
  avisar();
}

export async function guardarYa() {
  clearTimeout(pendiente);
  await db.set(CLAVE, estado);
  avisar();
}

export function actualizar(fn) {
  fn(estado);
  guardar();
}

// ------------------------------------------------------------------ borrador
let tempBorrador = null;

export function guardarBorrador(datos) {
  borrador = { ...datos, guardadoEn: new Date().toISOString() };
  clearTimeout(tempBorrador);
  tempBorrador = setTimeout(() => db.set(CLAVE_BORRADOR, borrador), 800);
}

export const leerBorrador = () => borrador;

export async function borrarBorrador() {
  borrador = null;
  clearTimeout(tempBorrador);
  await db.del(CLAVE_BORRADOR);
}

// Escribe todo de inmediato cuando la app se va a segundo plano, que es justo
// cuando iOS puede matar la pestaña sin avisar. Sin esto, un cambio hecho en
// los últimos milisegundos se quedaría esperando en el retardo de escritura.
export function vigilarSalida() {
  const volcar = () => {
    clearTimeout(pendiente);
    db.set(CLAVE, estado);
    if (!borrador) return;
    clearTimeout(tempBorrador);
    db.set(CLAVE_BORRADOR, borrador);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) volcar(); });
  window.addEventListener('pagehide', volcar);
}

// ----------------------------------------------------------- copia y restaura
export async function exportar() {
  // Las fotos viven como archivos, no dentro del estado, así que hay que
  // convertirlas a texto para que quepan en la copia. Es lo que la engorda.
  const fotos = await fotosParaCopia();
  return JSON.stringify({ _app: 'cuaderno-entreno', _v: SCHEMA,
    _exported: new Date().toISOString(), estado, fotos }, null, 2);
}

export async function importar(texto) {
  const d = JSON.parse(texto);
  if (d.estado?.schema) { estado = d.estado; }
  else if (d.mc_entries) { estado = migrarV1(d); }          // copia del formato viejo
  else throw new Error('El archivo no parece una copia de esta app.');
  estado.schema = SCHEMA;
  estado.ajustes = { ...estadoInicial().ajustes, ...estado.ajustes };
  if (!estado.medidas?.sitios) estado.medidas = migrarMedidasV1(estado.medidas, null);
  if (d.fotos) await restaurarFotos(d.fotos);
  await guardarYa();
  return Object.keys(estado.diario).length;
}
