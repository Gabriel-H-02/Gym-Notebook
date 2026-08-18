import { cargar, vigilarSalida, alCambiar, estado } from './store.js';
import { el, aviso, confirmar } from './ui.js';
import { pintarHoy, iniciarHoja } from './views/hoy.js';
import { pintarRutinas } from './views/rutinas.js';
import { pintarHistorial } from './views/historial.js';
import { pintarProgreso } from './views/progreso.js';
import { pintarAjustes } from './views/ajustes.js';
import { fechaCorta } from './model.js';
import { icono } from './iconos.js';

const vistas = {
  hoy:       { ic: 'hoy',       titulo: 'Hoy',       pintar: c => pintarHoy(c) },
  rutinas:   { ic: 'rutinas',   titulo: 'Rutinas',   pintar: c => pintarRutinas(c) },
  progreso:  { ic: 'progreso',  titulo: 'Progreso',  pintar: c => pintarProgreso(c) },
  historial: { ic: 'historial', titulo: 'Historial', pintar: c => pintarHistorial(c, irA) },
  ajustes:   { ic: 'ajustes',   titulo: 'Ajustes',   pintar: c => pintarAjustes(c, () => irA(actual)) },
};

let actual = 'hoy';
const raiz = () => document.getElementById('vista');

export function irA(nombre) {
  actual = nombre;
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.v === nombre));
  vistas[nombre].pintar(raiz());
  window.scrollTo(0, 0);
}

function montarBarra() {
  const barra = document.querySelector('.tabbar');
  for (const [k, v] of Object.entries(vistas)) {
    barra.append(el('button', { datos: { v: k }, clase: k === actual ? 'on' : '', onclick: () => irA(k) },
      icono(v.ic, { tam: 21 }), v.titulo));
  }
}

async function arrancar() {
  const { migrado, dias } = await cargar();
  vigilarSalida();
  montarBarra();

  const rec = iniciarHoja();
  irA('hoy');

  if (migrado) {
    await confirmar('Historial recuperado',
      `Se han traído ${dias} días del cuaderno anterior. Los ejercicios repetidos se han unificado y las cargas por cambio de máquina quedan separadas en variantes. Tu copia original se conserva intacta.`,
      { ok: 'Vale' });
  } else if (rec.recuperado) {
    aviso(`Recuperado lo que estabas apuntando el ${fechaCorta(rec.fecha)}`, 'ok');
  }

  registrarServiceWorker();

  alCambiar(() => {
    const n = Object.keys(estado.diario).length;
    document.title = n ? `Cuaderno Entreno · ${n}d` : 'Cuaderno Entreno';
  });
}

// El service worker sirve para funcionar sin cobertura, pero en local es un
// estorbo: cachea los archivos y dejas de ver los cambios al recargar. Así que
// en localhost no se registra, da igual con qué servidor estés (dev.mjs, Live
// Preview, el que sea). Para probar el offline de verdad, se fuerza con ?sw=1.
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const local = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(location.hostname);
  const forzado = new URLSearchParams(location.search).has('sw');

  if (local && !forzado) {
    navigator.serviceWorker.getRegistrations()
      .then(rs => rs.forEach(r => r.unregister()))
      .catch(() => { /* nada que limpiar */ });
    return;
  }
  // La marca viaja en la URL del worker: es lo único suyo que él puede leer.
  navigator.serviceWorker.register(forzado ? './sw.js?sw=1' : './sw.js')
    .catch(() => { /* sin offline, la app sigue */ });
}

arrancar().catch(e => {
  document.body.append(el('div', { clase: 'error-arranque' },
    el('h2', { texto: 'No ha arrancado' }),
    el('p', { texto: String(e?.message ?? e) }),
    el('p', { clase: 'muted', texto: 'Tus datos siguen guardados. Recarga la página.' })));
});
