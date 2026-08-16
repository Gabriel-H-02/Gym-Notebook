// Temporizador de descanso.
//
// El problema real no es contar hacia atrás, es que suene cuando tienes el
// móvil bloqueado en el banco. En cuanto la pestaña pasa a segundo plano,
// setTimeout se estrangula (en iOS puede no dispararse en varios minutos) y el
// AudioContext se suspende. Tres medidas contra eso:
//
//   1. La cuenta se calcula desde una marca de tiempo absoluta, nunca restando
//      de un contador. Si el navegador congela la pestaña 40 segundos, al
//      volver el número es el correcto.
//   2. El pitido se programa en el AudioContext en el instante exacto en que
//      toca, no cuando salte un temporizador. El audio ya programado suena
//      aunque el hilo de JavaScript esté parado.
//   3. Mientras corre, se reproduce un silencio en bucle. Así el sistema
//      considera que la app está sonando y no la duerme del todo.
//
// Aun con todo, en iOS no es infalible. Con la app empaquetada en Capacitor y
// notificaciones nativas sí lo sería.

import { el, aviso } from './ui.js';
import { estado } from './store.js';

let fin = 0;              // marca absoluta en ms
let etiqueta = '';
let pintarId = null;
let ctx = null;
let programado = null;    // nodos de audio ya agendados
let silencio = null;      // <audio> con silencio en bucle
let wakeLock = null;
let barra = null;
const oyentes = new Set();

export const alTemporizador = fn => { oyentes.add(fn); return () => oyentes.delete(fn); };
const avisarOyentes = () => oyentes.forEach(f => f(corriendo(), restante()));

export const corriendo = () => fin > Date.now();
export const restante = () => Math.max(0, Math.ceil((fin - Date.now()) / 1000));

export const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// --------------------------------------------------------------------- audio
function contexto() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Se llama en el primer toque del usuario. Sin esto los navegadores no dejan
// sonar nada más tarde.
export function despertarAudio() {
  const c = contexto();
  if (!c) return;
  const g = c.createGain();
  g.gain.value = 0;
  const o = c.createOscillator();
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + 0.01);
}

function wavSilencioso(segundos = 1) {
  const tasa = 8000, n = tasa * segundos, bytes = 44 + n * 2;
  const b = new ArrayBuffer(bytes), v = new DataView(b);
  const txt = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, bytes - 8, true); txt(8, 'WAVE');
  txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, tasa, true); v.setUint32(28, tasa * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  txt(36, 'data'); v.setUint32(40, n * 2, true);
  let s = '';
  const u8 = new Uint8Array(b);
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return 'data:audio/wav;base64,' + btoa(s);
}

function arrancarSilencio() {
  if (!estado.ajustes.sonido) return;
  if (!silencio) {
    silencio = new Audio(wavSilencioso(1));
    silencio.loop = true;
    silencio.volume = 0.01;
  }
  silencio.play().catch(() => { /* sin gesto previo; el pitido puede fallar */ });
}

const pararSilencio = () => { silencio?.pause(); };

// Deja el pitido agendado en el reloj del audio, que sigue corriendo aunque
// la pestaña esté congelada.
function programarPitido(segundos) {
  cancelarPitido();
  if (!estado.ajustes.sonido) return;
  const c = contexto();
  if (!c) return;
  const t0 = c.currentTime + segundos;
  programado = [];
  [0, 0.18, 0.36].forEach((d, i) => {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = i === 2 ? 1320 : 880;
    o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.14);
    o.start(t0 + d); o.stop(t0 + d + 0.16);
    programado.push(o);
  });
}

function cancelarPitido() {
  programado?.forEach(o => { try { o.stop(); } catch { /* ya parado */ } });
  programado = null;
}

// ------------------------------------------------------------------ pantalla
async function pedirWakeLock() {
  if (!estado.ajustes.pantallaEncendida || !navigator.wakeLock) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* no concedido */ }
}
const soltarWakeLock = () => { wakeLock?.release?.().catch(() => {}); wakeLock = null; };

// Si el sistema soltó el bloqueo al irse a segundo plano, se recupera al volver.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && corriendo()) { pedirWakeLock(); contexto(); }
});

// -------------------------------------------------------------------- control
export function iniciar(segundos, texto = '') {
  if (!segundos || segundos <= 0) return;
  fin = Date.now() + segundos * 1000;
  etiqueta = texto;
  arrancarSilencio();
  programarPitido(segundos);
  pedirWakeLock();
  montarBarra();
  bucle();
  avisarOyentes();
}

export function sumar(segundos) {
  if (!corriendo()) return;
  fin = Math.max(Date.now() + 1000, fin + segundos * 1000);
  programarPitido(restante());
  refrescarBarra();
  avisarOyentes();
}

export function parar({ silencioso = true } = {}) {
  fin = 0;
  if (silencioso) cancelarPitido();
  pararSilencio();
  soltarWakeLock();
  clearTimeout(pintarId);
  barra?.classList.remove('on');
  document.body.classList.remove('con-timer');
  avisarOyentes();
}

function bucle() {
  clearTimeout(pintarId);
  refrescarBarra();
  if (!corriendo()) { terminar(); return; }
  pintarId = setTimeout(bucle, 250);
}

function terminar() {
  pararSilencio();
  soltarWakeLock();
  if (estado.ajustes.vibracion && navigator.vibrate) navigator.vibrate([180, 90, 180]);
  notificar();
  barra?.classList.add('fin');
  setTimeout(() => {
    barra?.classList.remove('on', 'fin');
    document.body.classList.remove('con-timer');
  }, 4000);
  avisarOyentes();
}

function notificar() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  try { new Notification('Descanso terminado', { body: etiqueta || 'A por la siguiente serie', tag: 'descanso' }); }
  catch { /* algunos navegadores solo permiten desde el service worker */ }
}

export async function pedirPermisoAviso() {
  if (!('Notification' in window)) return 'no';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

// ---------------------------------------------------------------------- barra
function montarBarra() {
  if (!barra) {
    const tiempo = el('span', { clase: 'tm-t', texto: '0:00' });
    const nombre = el('span', { clase: 'tm-n' });
    barra = el('div', { clase: 'timer-barra', role: 'timer', 'aria-live': 'off' },
      el('button', { clase: 'tm-b', texto: '−30', 'aria-label': 'Quitar 30 segundos', onclick: () => sumar(-30) }),
      el('div', { clase: 'tm-c' }, tiempo, nombre),
      el('button', { clase: 'tm-b', texto: '+30', 'aria-label': 'Añadir 30 segundos', onclick: () => sumar(30) }),
      el('button', { clase: 'tm-x', texto: 'Saltar', onclick: () => parar() }));
    barra._t = tiempo; barra._n = nombre;
    document.body.append(barra);
  }
  barra.classList.add('on');
  barra.classList.remove('fin');
  document.body.classList.add('con-timer');   // deja hueco para que no tape nada
  refrescarBarra();
}

function refrescarBarra() {
  if (!barra) return;
  const s = restante();
  barra._t.textContent = mmss(s);
  barra._n.textContent = etiqueta;
  barra.classList.toggle('poco', s > 0 && s <= 10);
}

// Descanso que toca para un ejercicio: el suyo propio, si no el de la rutina,
// si no el general de ajustes.
export function descansoDe(ej, item) {
  return ej?.descansoSeg ?? item?.descansoSeg ?? estado.ajustes.descansoPorDefecto ?? 120;
}
