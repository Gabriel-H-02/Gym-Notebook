// Ajustes, copia de seguridad y estado del almacenamiento.

import { el, vaciar, aviso, confirmar, descargar, copiar } from '../ui.js';
import { estado, actualizar, exportar, importar, guardarYa } from '../store.js';
import { pedirPersistencia, espacioUsado } from '../db.js';
import { pedirPermisoAviso } from '../timer.js';
import { PROVEEDOR, olvidarTodo, espacioMedia } from '../media.js';
import { pesoFotos } from '../fotos.js';
import { icono } from '../iconos.js';
import { ESCALAS, hoyISO, diasDesde, mostrarPeso } from '../model.js';

export function pintarAjustes(cont, refrescar) {
  vaciar(cont);
  const a = estado.ajustes;

  // ------------------------------------------------------------- unidades
  cont.append(el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Unidad de peso' }),
    el('p', { clase: 'muted', texto: 'Se guarda siempre en kilos por dentro, así que cambiar de unidad reconvierte todo el histórico al instante y sin perder precisión.' }),
    grupoBotones(['kg', 'lb'], a.unidad, v => {
      actualizar(() => { a.unidad = v; });
      aviso(`Ahora en ${v === 'kg' ? 'kilos' : 'libras'}`);
      refrescar();
    })));

  // ------------------------------------------------------------ intensidad
  const esc = ESCALAS[a.escalaIntensidad] ?? ESCALAS.rir;
  cont.append(el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Escala de intensidad' }),
    grupoBotones([['rir', 'RIR'], ['rpe', 'RPE']], a.escalaIntensidad, v => {
      actualizar(() => {
        a.escalaIntensidad = v;
        a.valoresRapidos = v === 'rir' ? [0, 1, 2] : [8, 9, 10];
      });
      refrescar();
    }),
    el('span', { clase: 'label', estilo: { marginTop: '16px' }, texto: 'Valores de acceso rápido' }),
    el('p', { clase: 'muted', texto: 'Los que salen como botón en cada serie. El resto del rango queda detrás del botón ⋯, para no llenar la fila.' }),
    selectorRapidos(esc, a, refrescar)));

  // ------------------------------------------------------------- descanso
  const descanso = el('input', { inputmode: 'numeric', value: a.descansoPorDefecto ?? '' });
  descanso.addEventListener('change', () => {
    const n = parseInt(descanso.value, 10);
    actualizar(() => { a.descansoPorDefecto = Number.isFinite(n) && n > 0 ? n : 120; });
  });

  cont.append(el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Descanso' }),
    el('p', { clase: 'muted', texto: 'Este es el general. Cada ejercicio puede tener el suyo: manténlo pulsado en el botón ⏱ de la pantalla de hoy y se recuerda para siempre.' }),
    el('span', { clase: 'label', estilo: { marginTop: '14px' }, texto: 'Segundos por defecto' }),
    descanso,
    interruptor('Arrancar solo al terminar una serie', a.descansoAuto,
      v => actualizar(() => { a.descansoAuto = v; })),
    interruptor('Pitido al terminar', a.sonido, v => actualizar(() => { a.sonido = v; })),
    interruptor('Vibración', a.vibracion, v => actualizar(() => { a.vibracion = v; })),
    interruptor('Mantener la pantalla encendida durante el descanso', a.pantallaEncendida,
      v => actualizar(() => { a.pantallaEncendida = v; })),
    botonAvisos()));

  // ------------------------------------------------------------ imágenes
  if (PROVEEDOR.activo) {
    const cajaImg = el('div', { clase: 'card' },
      el('span', { clase: 'label', texto: 'Ilustraciones de los ejercicios' }),
      el('p', { clase: 'muted', texto: `Se descargan una vez y se guardan, así funcionan luego sin cobertura. ${PROVEEDOR.atribucion}.` }),
      interruptor('Mostrar la ejecución del ejercicio', a.imagenes !== false, async v => {
        actualizar(() => { a.imagenes = v; });
        if (!v) await olvidarTodo();
        refrescar();
      }));
    cont.append(cajaImg);
    espacioMedia().then(n => {
      if (n) cajaImg.append(el('p', { clase: 'muted', estilo: { marginTop: '10px' },
        texto: `${n} imagen${n === 1 ? '' : 'es'} guardada${n === 1 ? '' : 's'} en el dispositivo.` }));
    });
  }

  // ---------------------------------------------------------------- copia
  const dias = a.ultimaCopia ? diasDesde(a.ultimaCopia) : null;
  const aviso7 = dias === null || dias >= 7;
  cont.append(el('div', { clase: 'card' + (aviso7 ? ' alerta' : '') },
    el('span', { clase: 'label', texto: 'Copia de seguridad' }),
    el('p', { clase: 'muted', texto: dias === null
      ? 'Nunca has hecho una copia. Descárgala y guárdala fuera del móvil.'
      : dias === 0 ? 'Última copia hoy.'
      : `Última copia hace ${dias} día${dias === 1 ? '' : 's'}.` }),
    el('button', { clase: 'save con-ic', estilo: { marginTop: '10px' }, onclick: async () => {
      aviso('Preparando la copia…');
      const txt = await exportar();
      descargar(`cuaderno-entreno-${hoyISO()}.json`, txt);
      actualizar(() => { a.ultimaCopia = hoyISO(); });
      aviso('Copia descargada');
      refrescar();
    } }, icono('descargar', { tam: 17 }), 'Descargar copia'),
    el('div', { clase: 'row', estilo: { marginTop: '10px' } },
      el('button', { clase: 'addbtn con-ic', estilo: { marginTop: 0 }, onclick: async () => {
        aviso(await copiar(await exportar()) ? 'Copiado' : 'No se ha podido copiar');
      } }, icono('copiar', { tam: 14 }), 'Copiar'),
      botonImportar(refrescar))));

  // ------------------------------------------------------ almacenamiento
  const caja = el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Almacenamiento' }),
    el('p', { clase: 'muted', texto: 'Comprobando…' }));
  cont.append(caja);
  informarAlmacenamiento(caja);

  // ---------------------------------------------------------------- datos
  cont.append(el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Tus datos' }),
    el('p', { clase: 'muted', texto:
      `${Object.keys(estado.diario).length} días · ${estado.sesiones.length} entrenos · ` +
      `${estado.ejercicios.length} ejercicios · ${estado.rutinas.length} rutinas · ` +
      `${estado.medidas?.registros?.length ?? 0} mediciones` }),
    cajaFotos(),
    el('button', { clase: 'addbtn peligro', texto: 'Borrar todo', onclick: async () => {
      if (!await confirmar('¿Borrar todos los datos?',
        'Desaparece el historial entero de este dispositivo. Descarga una copia antes.',
        { ok: 'Borrar todo', peligro: true })) return;
      if (!await confirmar('Confirma otra vez', 'Esto no se puede deshacer.', { ok: 'Sí, borrar', peligro: true })) return;
      actualizar(e => { e.diario = {}; e.sesiones = []; e.medidas = {}; });
      await guardarYa();
      aviso('Datos borrados');
      refrescar();
    } })));
}

function cajaFotos() {
  const p = el('p', { clase: 'muted' });
  pesoFotos().then(({ cuantas, bytes }) => {
    if (!cuantas) return;
    p.textContent = `${cuantas} foto${cuantas === 1 ? '' : 's'} de progreso, ` +
      `${(bytes / 1024 / 1024).toFixed(1)} MB. Van dentro de la copia de seguridad.`;
  });
  return p;
}

// --------------------------------------------------------------- auxiliares
function interruptor(texto, valor, alCambiar) {
  const b = el('button', { clase: 'sw' + (valor ? ' on' : ''), role: 'switch',
    'aria-checked': valor ? 'true' : 'false' },
    el('span', { clase: 'sw-t', texto }),
    el('span', { clase: 'sw-p' }, el('span', { clase: 'sw-b' })));
  b.addEventListener('click', () => {
    const v = !b.classList.contains('on');
    b.classList.toggle('on', v);
    b.setAttribute('aria-checked', v ? 'true' : 'false');
    alCambiar(v);
  });
  return b;
}

function botonAvisos() {
  const estadoPerm = ('Notification' in window) ? Notification.permission : 'no';
  if (estadoPerm === 'granted') {
    return el('p', { clase: 'ok-txt', estilo: { marginTop: '10px' },
      texto: 'Avisos activados. Si tienes la app en segundo plano, te llega una notificación al acabar el descanso.' });
  }
  if (estadoPerm === 'no' || estadoPerm === 'denied') {
    return el('p', { clase: 'muted', estilo: { marginTop: '10px' },
      texto: 'Los avisos del sistema están bloqueados o no existen en este navegador. El pitido y la vibración siguen funcionando con la app abierta.' });
  }
  return el('button', { clase: 'addbtn', texto: 'Activar avisos del sistema', onclick: async e => {
    const r = await pedirPermisoAviso();
    aviso(r === 'granted' ? 'Avisos activados' : 'Avisos no concedidos');
    e.target.replaceWith(botonAvisos());
  } });
}

function grupoBotones(opciones, valor, alElegir) {
  const c = el('div', { clase: 'seg' });
  for (const o of opciones) {
    const [v, txt] = Array.isArray(o) ? o : [o, o];
    c.append(el('button', { clase: valor === v ? 'on' : '', texto: txt, onclick: () => alElegir(v) }));
  }
  return c;
}

function selectorRapidos(esc, a, refrescar) {
  const c = el('div', { clase: 'seg wrap' });
  for (const v of esc.valores) {
    const activo = a.valoresRapidos.includes(v);
    c.append(el('button', { clase: activo ? 'on' : '', texto: esc.texto(v), onclick: () => {
      const s = new Set(a.valoresRapidos);
      if (s.has(v)) { if (s.size <= 1) return aviso('Deja al menos uno'); s.delete(v); }
      else { if (s.size >= 5) return aviso('Máximo cinco, si no la fila no cabe'); s.add(v); }
      actualizar(() => { a.valoresRapidos = [...s].sort((x, y) => x - y); });
      refrescar();
    } }));
  }
  return c;
}

function botonImportar(refrescar) {
  const inp = el('input', { type: 'file', accept: '.json,application/json', estilo: { display: 'none' } });
  inp.addEventListener('change', async () => {
    const f = inp.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      if (!await confirmar('¿Restaurar esta copia?',
        'Sustituye el historial actual por el del archivo.', { ok: 'Restaurar', peligro: true })) return;
      const n = await importar(txt);
      aviso(`Restaurado · ${n} días`);
      refrescar();
    } catch (e) {
      aviso('El archivo no es válido');
    } finally { inp.value = ''; }
  });
  return el('label', { clase: 'addbtn con-ic', estilo: { marginTop: 0, cursor: 'pointer' } },
    icono('restaurar', { tam: 14 }), 'Restaurar', inp);
}

async function informarAlmacenamiento(caja) {
  const p = await pedirPersistencia();
  const e = await espacioUsado();
  const kb = e ? Math.round(e.usado / 1024) : null;

  vaciar(caja);
  caja.append(el('span', { clase: 'label', texto: 'Almacenamiento' }));

  if (p.concedido) {
    caja.append(el('p', { clase: 'ok-txt', texto: 'Almacenamiento persistente concedido. El navegador no va a borrar tus datos para hacer sitio.' }));
  } else if (p.soportado) {
    caja.append(el('p', { clase: 'muted', texto: 'El navegador no ha concedido almacenamiento persistente. Instala la app en la pantalla de inicio para que sea más probable, y descarga copias con regularidad.' }));
  } else {
    caja.append(el('p', { clase: 'muted', texto: 'Este navegador no permite marcar los datos como persistentes. Descarga copias con regularidad.' }));
  }
  if (kb !== null) caja.append(el('p', { clase: 'muted', texto: `Ocupas ${kb} KB.` }));
}
