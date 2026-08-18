// Historial por semanas. Cada día se puede abrir para corregirlo o borrarlo,
// que en la versión anterior no se podía.

import { el, vaciar, aviso, confirmar } from '../ui.js';
import { estado, actualizar } from '../store.js';
import { porId, variante, mostrarPeso, textoIntensidad, fechaCorta, hoyISO,
  bloques, textoSerie } from '../model.js';
import { editarDia } from './hoy.js';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function lunesDe(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function etiquetaSemana(lunes) {
  const a = new Date(lunes + 'T00:00:00');
  const b = new Date(a); b.setDate(a.getDate() + 6);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MES[b.getMonth()]}`
    : `${a.getDate()} ${MES[a.getMonth()]} – ${b.getDate()} ${MES[b.getMonth()]}`;
}

// Media de los últimos 7 días de CALENDARIO, no de los 7 últimos registrados.
// Con huecos, la diferencia entre las dos cosas es grande.
function media7(hasta) {
  const fin = new Date(hasta + 'T00:00:00');
  const pesos = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(fin); d.setDate(fin.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const p = estado.diario[k]?.pesoKg;
    if (p) pesos.push(p);
  }
  return pesos.length ? pesos.reduce((a, b) => a + b, 0) / pesos.length : null;
}

export function pintarHistorial(cont, irA) {
  vaciar(cont);
  const u = estado.ajustes.unidad;
  const fechas = Object.keys(estado.diario).sort().reverse();
  const conPeso = fechas.filter(f => estado.diario[f].pesoKg);
  const media = conPeso.length ? media7(conPeso[0]) : null;

  cont.append(el('div', { clase: 'card' },
    el('div', { clase: 'row' },
      el('div', { clase: 'stat' },
        el('div', { clase: 'v', texto: media ? mostrarPeso(media, u) : '—' }),
        el('div', { clase: 'k', texto: `Media 7 días (${u})` })),
      el('div', { clase: 'stat' },
        el('div', { clase: 'v', texto: String(fechas.length) }),
        el('div', { clase: 'k', texto: 'Días registrados' })),
      el('div', { clase: 'stat' },
        el('div', { clase: 'v', texto: String(estado.sesiones.length) }),
        el('div', { clase: 'k', texto: 'Entrenos' })))));

  if (!fechas.length) {
    cont.append(el('div', { clase: 'card' },
      el('p', { clase: 'muted', texto: 'Aún no has guardado ningún día.' })));
    return;
  }

  // La semana se pinta entera, con los siete días. Los que no tienen nada
  // salen igualmente, en gris: un hueco de tres días se ve de un vistazo, y
  // antes sencillamente desaparecía.
  const semanas = new Set(fechas.map(lunesDe));
  const primero = fechas.at(-1);          // fechas viene de más nueva a más vieja
  const hoy = hoyISO();

  const caja = el('div', { clase: 'card' });
  for (const lunes of [...semanas].sort().reverse()) {
    // Ni antes de que empezaras a apuntar, ni días que aún no han llegado.
    const dias = diasDeLaSemana(lunes).filter(f => f >= primero && f <= hoy);
    const conDatos = dias.filter(f => estado.diario[f]);
    const pesos = conDatos.map(f => estado.diario[f].pesoKg).filter(Boolean);
    const m = pesos.length ? pesos.reduce((a, b) => a + b, 0) / pesos.length : null;

    caja.append(el('div', { clase: 'whead' },
      el('span', { texto: 'Semana ' + etiquetaSemana(lunes) }),
      el('span', { clase: 'wavg',
        texto: `${m ? 'media ' + mostrarPeso(m, u) + ' ' + u : '—'} · ${conDatos.length}/${dias.length}d` })));

    for (const f of dias) {
      caja.append(estado.diario[f] ? filaDia(cont, f, irA) : filaVacia(cont, f, irA));
    }
  }
  cont.append(caja);
}

const DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function diasDeLaSemana(lunes) {
  const d = new Date(lunes + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + i);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  });
}

// Día sin nada apuntado. Se puede tocar para rellenarlo: olvidarse de anotar un
// martes y poder volver a él es medio motivo de que exista esta fila.
function filaVacia(cont, fecha, irA) {
  const nombre = DIA[(new Date(fecha + 'T00:00:00').getDay() + 6) % 7];
  const fila = el('div', { clase: 'hrow tap vacio' },
    el('div', { clase: 'hrow-txt' },
      el('div', { clase: 'hd', texto: fecha }),
      el('div', { clase: 'hs', texto: nombre + ' · sin registrar' })),
    el('span', { clase: 'hw-add', texto: '+' }));
  fila.addEventListener('click', () => { editarDia(fecha, cont); irA('hoy'); });
  return fila;
}

function filaDia(cont, fecha, irA) {
  const d = estado.diario[fecha];
  const s = estado.sesiones.find(x => x.fecha === fecha);
  const u = estado.ajustes.unidad;
  const resumen = [
    s ? (s.rutinaNombre || 'Entreno') : 'Descanso',
    d.protG ? `P${d.protG}g` : null,
    d.kcal ? `${d.kcal}kcal` : null,
  ].filter(Boolean).join(' · ');

  const fila = el('div', { clase: 'hrow tap' },
    el('div', { clase: 'hrow-txt' },
      el('div', { clase: 'hd', texto: fecha }),
      el('div', { clase: 'hs', texto: resumen })),
    el('div', { clase: 'hw', texto: d.pesoKg ? mostrarPeso(d.pesoKg, u) + u : '—' }));

  fila.addEventListener('click', () => desplegar(fila, fecha, cont, irA));
  return fila;
}

function desplegar(fila, fecha, cont, irA) {
  const abierto = fila.nextElementSibling?.classList.contains('hdet');
  if (abierto) { fila.nextElementSibling.remove(); return; }

  const s = estado.sesiones.find(x => x.fecha === fecha);
  const d = estado.diario[fecha];
  const u = estado.ajustes.unidad;
  const det = el('div', { clase: 'hdet' });

  if (s) {
    const bl = bloques(s.entradas);
    for (const en of s.entradas) {
      const ej = porId(estado.ejercicios, en.exId);
      const va = variante(ej, en.vaId);
      const g = bl.get(en.id);
      det.append(el('div', { clase: 'hex' + (g ? ' hex-bl' : '') },
        el('span', { clase: 'hexn' },
          g ? el('span', { clase: 'hex-let', texto: `${g.letra}${g.indice}` }) : null,
          (ej?.nombre ?? '?') + (va ? ' · ' + va.nombre : '')),
        el('span', { clase: 'hexs', texto: en.sets.map(x =>
          textoSerie(x, u, mostrarPeso)
          + (x.tipo === 'calentamiento' ? ' (c)' : '')
          + (textoIntensidad(x.intensidad) ? '/' + textoIntensidad(x.intensidad) : '')).join(', ') })));
    }
  } else {
    det.append(el('p', { clase: 'muted', texto: 'Día sin entreno.' }));
  }

  if (d.notas) det.append(el('p', { clase: 'hnota', texto: d.notas }));

  det.append(el('div', { clase: 'row', estilo: { marginTop: '10px' } },
    el('button', { clase: 'addbtn', estilo: { marginTop: 0 }, texto: '✎ Editar', onclick: () => {
      editarDia(fecha, cont); irA('hoy');
    } }),
    el('button', { clase: 'addbtn peligro', estilo: { marginTop: 0 }, texto: 'Borrar día', onclick: async () => {
      if (!await confirmar('¿Borrar el día?', fechaCorta(fecha) + '. No se puede deshacer.', { ok: 'Borrar', peligro: true })) return;
      actualizar(e => { delete e.diario[fecha]; e.sesiones = e.sesiones.filter(x => x.fecha !== fecha); });
      aviso('Día borrado');
      pintarHistorial(cont, irA);
    } })));

  fila.after(det);
}
