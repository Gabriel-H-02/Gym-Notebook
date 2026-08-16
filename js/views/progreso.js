// Progreso por ejercicio: cuánto peso mueves y cómo evoluciona.
//
// La regla que gobierna esta pantalla: cada variante es una serie aparte y las
// líneas NO se unen entre sí. Cambiar de máquina no es perder fuerza, y unir
// esos puntos dibujaría una caída que nunca ocurrió. Tu prensa pasa de 220 kg
// bilateral a 75 kg unilateral el 26 de junio: son dos historias distintas.

import { el, vaciar, aviso } from '../ui.js';
import { estado } from '../store.js';
import { porId, variante, mostrarPeso, textoIntensidad, fechaCorta } from '../model.js';
import { linea, tabla, SERIES } from '../grafico.js';
import { imagen, activo as mediaActiva, PROVEEDOR } from '../media.js';
import { pintarCuerpo } from './cuerpo.js';

let abierto = null;      // id del ejercicio abierto, o null para el listado
let verTabla = false;
let mitad = 'ejercicios';   // ejercicios | cuerpo

export function pintarProgreso(cont) {
  vaciar(cont);

  const seg = el('div', { clase: 'seg' });
  for (const [id, nombre] of [['ejercicios', 'Ejercicios'], ['cuerpo', 'Cuerpo']]) {
    seg.append(el('button', { clase: mitad === id ? 'on' : '', texto: nombre,
      onclick: () => { mitad = id; abierto = null; pintarProgreso(cont); } }));
  }
  cont.append(el('div', { clase: 'card' }, seg));

  const dentro = el('div');
  cont.append(dentro);

  if (mitad === 'cuerpo') { pintarCuerpo(dentro); return; }
  const ej = abierto ? porId(estado.ejercicios, abierto) : null;
  if (ej) pintarDetalle(dentro, ej);
  else { abierto = null; pintarListado(dentro); }
}

// ------------------------------------------------------------------ listado
function pintarListado(cont) {
  // Ordenados por lo último que tocaste, que es lo que quieres mirar.
  const ultimo = new Map();
  for (const s of estado.sesiones) {
    for (const en of s.entradas) {
      if (!ultimo.has(en.exId) || ultimo.get(en.exId) < s.fecha) ultimo.set(en.exId, s.fecha);
    }
  }
  const lista = estado.ejercicios
    .filter(x => ultimo.has(x.id))
    .sort((a, b) => (ultimo.get(a.id) < ultimo.get(b.id) ? 1 : -1));

  if (!lista.length) {
    cont.append(el('div', { clase: 'card' },
      el('p', { clase: 'muted', texto: 'Cuando guardes algún entreno, aquí verás la evolución de cada ejercicio.' })));
    return;
  }

  const caja = el('div', { clase: 'card' }, el('span', { clase: 'label', texto: 'Elige un ejercicio' }));
  for (const ej of lista) {
    const ser = seriesDe(ej);
    const n = ser.reduce((a, s) => a + s.puntos.length, 0);
    const ult = ser.flatMap(s => s.puntos).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
    caja.append(el('div', { clase: 'hrow tap', onclick: () => { abierto = ej.id; pintarProgreso(cont); } },
      el('div', { clase: 'hrow-txt' },
        el('div', { clase: 'hd', texto: ej.nombre }),
        el('div', { clase: 'hs', texto: `${n} sesion${n === 1 ? '' : 'es'} · última ${fechaCorta(ultimo.get(ej.id))}` })),
      ult ? el('div', { clase: 'hw', texto: mostrarPeso(ult.valor, estado.ajustes.unidad) + estado.ajustes.unidad }) : null,
      el('span', { clase: 'chevron', texto: '›' })));
  }
  cont.append(caja);
}

// ------------------------------------------------------------------ detalle
function pintarDetalle(cont, ej) {
  const u = estado.ajustes.unidad;
  const ser = seriesDe(ej);

  cont.append(el('div', { clase: 'barra-vuelta' },
    el('button', { clase: 'btn-volver', onclick: () => { abierto = null; pintarProgreso(cont); } }, '‹ Progreso'),
    el('button', { clase: 'btn-txt', texto: verTabla ? 'Ver gráfico' : 'Ver tabla',
      onclick: () => { verTabla = !verTabla; pintarProgreso(cont); } })));

  cont.append(el('h2', { clase: 'titulo-sec', texto: ej.nombre }));

  // ilustración del movimiento, si hay
  const cajaImg = el('div');
  cont.append(cajaImg);
  ponerIlustracion(cajaImg, ej);

  const puntos = ser.flatMap(s => s.puntos);
  if (!puntos.length) {
    cont.append(el('div', { clase: 'card' }, el('p', { clase: 'muted', texto: 'Sin series registradas.' })));
    return;
  }

  // --- números de cabecera
  const orden = puntos.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const actual = orden.at(-1);
  const serieActual = ser.find(s => s.puntos.includes(actual));
  const mismos = serieActual.puntos.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const primero = mismos[0];
  const dif = actual.valor - primero.valor;

  cont.append(el('div', { clase: 'card' },
    el('div', { clase: 'row' },
      el('div', { clase: 'stat' },
        el('div', { clase: 'v', texto: mostrarPeso(actual.valor, u) }),
        el('div', { clase: 'k', texto: `Último (${u})` })),
      el('div', { clase: 'stat' },
        el('div', { clase: 'v' + (dif > 0 ? '' : ' plano'),
          texto: (dif > 0 ? '+' : '') + mostrarPeso(dif, u) }),
        el('div', { clase: 'k', texto: ser.length > 1 ? 'En esta variante' : 'Desde el principio' })),
      el('div', { clase: 'stat' },
        el('div', { clase: 'v', texto: String(mismos.length) }),
        el('div', { clase: 'k', texto: 'Sesiones' })))));

  // --- gráfico o tabla
  const caja = el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: `Peso máximo por sesión (${u})` }));

  if (verTabla) {
    caja.append(el('div', { clase: 'tabla-scroll' }, tabla(ser, u)));
  } else {
    caja.append(linea(ser, { alto: 200, unidad: u }));
    if (ser.length > 1) {
      const leyenda = el('div', { clase: 'g-leyenda' });
      ser.forEach((x, i) => leyenda.append(el('span', { clase: 'g-lg' },
        el('i', { estilo: { background: x.color ?? SERIES[i % SERIES.length] } }),
        x.nombre)));
      caja.append(leyenda);
      caja.append(el('p', { clase: 'muted g-nota',
        texto: 'Las líneas no se unen entre variantes a propósito: cambiar de máquina no es perder fuerza.' }));
    }
    caja.append(el('p', { clase: 'muted g-nota', texto: 'Toca un punto para ver el detalle de ese día.' }));
  }
  cont.append(caja);
}

// Una serie por variante, con la carga máxima de cada sesión. Los
// calentamientos no cuentan.
function seriesDe(ej) {
  const porVar = new Map();
  for (const s of estado.sesiones.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1))) {
    for (const en of s.entradas) {
      if (en.exId !== ej.id) continue;
      const efectivas = en.sets.filter(x => x.tipo !== 'calentamiento' && x.pesoKg != null);
      if (!efectivas.length) continue;
      const top = efectivas.reduce((a, b) => (b.pesoKg > a.pesoKg ? b : a));
      const clave = en.vaId ?? '-';
      if (!porVar.has(clave)) porVar.set(clave, []);
      porVar.get(clave).push({
        fecha: s.fecha,
        valor: Math.round((estado.ajustes.unidad === 'lb' ? top.pesoKg / 0.45359237 : top.pesoKg) * 100) / 100,
        extra: `${top.reps ?? '?'} reps${textoIntensidad(top.intensidad) ? ' · ' + textoIntensidad(top.intensidad) : ''}`
          + (efectivas.length > 1 ? ` · ${efectivas.length} series` : ''),
      });
    }
  }
  return [...porVar.entries()].map(([vaId, puntos], i) => ({
    nombre: variante(ej, vaId)?.nombre ?? 'Sin variante',
    color: SERIES[i % SERIES.length],
    puntos,
  }));
}

async function ponerIlustracion(caja, ej) {
  if (!mediaActiva()) return;
  const src = await imagen(ej, 'animacion');
  if (!src) return;
  vaciar(caja);
  caja.append(el('div', { clase: 'card ilustra' },
    el('img', { src, alt: `Ejecución de ${ej.nombre}`, loading: 'lazy' }),
    el('p', { clase: 'atrib', texto: PROVEEDOR.atribucion })));
}

export const abrirEjercicio = id => { abierto = id; };
