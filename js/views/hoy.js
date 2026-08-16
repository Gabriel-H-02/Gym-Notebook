// Pantalla de registro. Es la que se usa con el móvil en la mano entre series,
// así que manda la velocidad: pocos toques, nada que se borre solo, y la
// referencia de la última vez siempre a la vista.

import { el, vaciar, aviso, confirmar, hoja as hojaUI } from '../ui.js';
import { estado, actualizar, guardarBorrador, leerBorrador, borrarBorrador } from '../store.js';
import {
  nuevoId, porId, variante, varianteActiva, nombreCompleto, hoyISO, fechaCorta,
  mostrarPeso, leerPeso, leerNumero, ESCALAS, textoIntensidad, ultimaVez, cargaAnomala,
  bloques, textoSerie, unidos, unir, separar,
} from '../model.js';
import { elegirEjercicio, elegirVariante, editarEjercicio } from './selector.js';
import { iniciar as iniciarDescanso, descansoDe, mmss, despertarAudio } from '../timer.js';

// Lo que se está tecleando ahora. Vive aquí y se vuelca al borrador en cada
// cambio, para que cerrar la pestaña no cueste el entreno.
let hoja = null;

export function iniciarHoja() {
  const b = leerBorrador();
  if (b?.fecha) { hoja = b; return { recuperado: true, fecha: b.fecha }; }
  hoja = hojaVacia(hoyISO());
  return { recuperado: false };
}

function hojaVacia(fecha) {
  return {
    fecha, rutinaId: null, rutinaNombre: '',
    diario: { pesoKg: null, suenoH: null, pasos: null, kcal: null, protG: null,
      carbG: null, grasaG: null, hambre: null, energia: null, notas: '' },
    entradas: [],
  };
}

const tocado = () => guardarBorrador(hoja);

// --------------------------------------------------------------------- vista
export function pintarHoy(cont) {
  vaciar(cont);
  if (!hoja) iniciarHoja();

  cont.append(bloqueCabecera(cont));
  cont.append(bloqueDiario(cont));
  cont.append(bloqueEscalas(cont));
  cont.append(bloqueEjercicios(cont));
  cont.append(bloqueNotas());
  cont.append(el('button', { clase: 'save', texto: 'Guardar día', onclick: () => guardarDia(cont) }));

  const b = leerBorrador();
  if (b?.guardadoEn) {
    const h = new Date(b.guardadoEn);
    cont.append(el('p', { clase: 'autoguardado',
      texto: `Se guarda solo · última copia ${String(h.getHours()).padStart(2, '0')}:${String(h.getMinutes()).padStart(2, '0')}` }));
  }
}

// ----------------------------------------------------------------- cabecera
function bloqueCabecera(cont) {
  const fecha = el('input', { type: 'date', value: hoja.fecha });
  fecha.addEventListener('change', () => {
    hoja.fecha = fecha.value || hoyISO();
    tocado(); pintarHoy(cont);
  });

  const sel = el('select');
  sel.append(el('option', { value: '', texto: hoja.entradas.length ? '— libre —' : 'Elegir rutina…' }));
  for (const r of estado.rutinas.filter(x => !x.archivada)) {
    sel.append(el('option', { value: r.id, texto: r.nombre, selected: hoja.rutinaId === r.id }));
  }
  sel.value = hoja.rutinaId ?? '';
  sel.addEventListener('change', () => cargarRutina(cont, sel.value, sel));

  return el('div', { clase: 'card' },
    el('div', { clase: 'row' },
      el('label', { clase: 'campo' }, el('span', { clase: 'label', texto: 'Fecha' }), fecha),
      el('label', { clase: 'campo' }, el('span', { clase: 'label', texto: 'Rutina' }), sel)));
}

// Cargar una rutina nunca borra en silencio lo que ya has apuntado.
async function cargarRutina(cont, id, sel) {
  const tieneDatos = hoja.entradas.some(e => e.sets.some(s => s.pesoKg !== null || s.reps !== null));
  if (tieneDatos) {
    const ok = await confirmar('Ya tienes series apuntadas',
      'Cargar otra rutina va a sustituir la lista de ejercicios. Lo apuntado se perderá.',
      { ok: 'Sustituir', peligro: true });
    if (!ok) { sel.value = hoja.rutinaId ?? ''; return; }
  }

  if (!id) { hoja.rutinaId = null; hoja.rutinaNombre = ''; hoja.entradas = []; tocado(); pintarHoy(cont); return; }

  const r = porId(estado.rutinas, id);
  hoja.rutinaId = r.id;
  hoja.rutinaNombre = r.nombre;
  // Los grupos se copian con identificadores nuevos, para que tocar la rutina
  // más tarde no altere el entreno que ya has empezado.
  const gids = new Map();
  hoja.entradas = r.items.slice().sort((a, b) => a.orden - b.orden).map((it, i) => {
    let grupo = null;
    if (it.grupo?.id) {
      if (!gids.has(it.grupo.id)) gids.set(it.grupo.id, nuevoId('gr'));
      grupo = { id: gids.get(it.grupo.id), tipo: it.grupo.tipo ?? 'superserie' };
    }
    return { id: nuevoId('en'), exId: it.exId, vaId: it.vaId, orden: i, nota: '', grupo,
      sets: Array.from({ length: it.seriesObjetivo || 2 }, () => setVacio()) };
  });
  tocado();
  pintarHoy(cont);
}

const setVacio = () => ({ id: nuevoId('st'), pesoKg: null, reps: null, intensidad: null,
  tipo: 'efectiva', drops: [] });

// -------------------------------------------------------------------- diario
function bloqueDiario(cont) {
  const d = hoja.diario;
  const u = estado.ajustes.unidad;
  const campo = (etiqueta, clave, marcador, esPeso = false) => {
    const inp = el('input', { inputmode: 'decimal', placeholder: marcador,
      value: esPeso ? mostrarPeso(d[clave], u) : (d[clave] ?? '') });
    inp.addEventListener('input', () => {
      d[clave] = esPeso ? leerPeso(inp.value, u) : leerNumero(inp.value);
      tocado();
    });
    return el('label', { clase: 'campo' }, el('span', { clase: 'label', texto: etiqueta }), inp);
  };

  return el('div', { clase: 'card' },
    el('div', { clase: 'row', estilo: { marginBottom: '12px' } },
      campo(`Peso (${u})`, 'pesoKg', u === 'kg' ? '67.4' : '148.6', true),
      campo('Sueño (h)', 'suenoH', '7.5'),
      campo('Pasos', 'pasos', '8000')),
    el('div', { clase: 'row' },
      campo('Kcal', 'kcal', '1900'),
      campo('Prote', 'protG', '170'),
      campo('Carbs', 'carbG', '155'),
      campo('Grasa', 'grasaG', '65')));
}

// ------------------------------------------------------------------- escalas
function bloqueEscalas() {
  const escala = (etiqueta, clave) => {
    const c = el('div', { clase: 'scale' });
    for (let i = 1; i <= 10; i++) {
      const b = el('button', { texto: String(i), clase: hoja.diario[clave] === i ? 'on' : '' });
      b.addEventListener('click', () => {
        hoja.diario[clave] = hoja.diario[clave] === i ? null : i;   // se puede deseleccionar
        [...c.children].forEach(x => x.classList.remove('on'));
        if (hoja.diario[clave] === i) b.classList.add('on');
        tocado();
      });
      c.append(b);
    }
    return [el('span', { clase: 'label', texto: etiqueta }), c];
  };
  return el('div', { clase: 'card' },
    escala('Hambre (1-10)', 'hambre'),
    el('div', { estilo: { height: '14px' } }),
    escala('Energía (1-10)', 'energia'));
}

// ---------------------------------------------------------------- ejercicios
function bloqueEjercicios(cont) {
  const lista = el('div', { clase: 'ex-lista' });
  const bl = bloques(hoja.entradas);
  hoja.entradas.sort((a, b) => a.orden - b.orden)
    .forEach((en, i) => lista.append(filaEjercicio(cont, en, i, bl)));

  return el('div', { clase: 'card' },
    el('div', { clase: 'card-top' },
      el('span', { clase: 'label', texto: 'Entrenamiento' }),
      hoja.entradas.length
        ? el('button', { clase: 'btn-txt', texto: '⧉ Copiar última vez', onclick: () => copiarUltima(cont) })
        : null),
    hoja.entradas.length ? lista
      : el('p', { clase: 'muted', texto: 'Elige una rutina arriba, o añade ejercicios sueltos.' }),
    el('button', { clase: 'addbtn', texto: '+ Añadir ejercicio', onclick: async () => {
      const sel = await elegirEjercicio();
      if (!sel) return;
      hoja.entradas.push({ id: nuevoId('en'), exId: sel.exId, vaId: sel.vaId,
        orden: hoja.entradas.length, nota: '', sets: [setVacio(), setVacio()] });
      tocado(); pintarHoy(cont);
    } }));
}

function filaEjercicio(cont, en, i, bl) {
  const ej = porId(estado.ejercicios, en.exId);
  if (!ej) return el('div');
  const va = variante(ej, en.vaId);
  const porLado = va?.porLado === true;
  const u = estado.ajustes.unidad;

  const mover = d => {
    const j = i + d;
    if (j < 0 || j >= hoja.entradas.length) return;
    const arr = hoja.entradas.sort((a, b) => a.orden - b.orden);
    arr.splice(j, 0, arr.splice(i, 1)[0]);
    arr.forEach((x, k) => { x.orden = k; });
    tocado(); pintarHoy(cont);
  };

  const g = bl?.get(en.id) ?? null;
  const caja = el('div', { clase: 'ex' + (g ? ' en-bloque' + (g.primera ? ' bl-ini' : '') + (g.ultima ? ' bl-fin' : '') : '') });

  if (g?.primera) {
    caja.append(el('div', { clase: 'bl-cab' },
      el('span', { clase: 'bl-tag', texto: `Superserie ${g.letra}` }),
      el('span', { clase: 'bl-n', texto: `${g.total} ejercicios seguidos, sin descanso entre ellos` })));
  }

  caja.append(el('div', { clase: 'ex-top' },
    el('span', { clase: 'pos', texto: g ? `${g.letra}${g.indice}` : String(i + 1) }),
    el('div', { clase: 'ex-id' },
      el('button', { clase: 'ex-nombre', texto: ej.nombre,
        onclick: async () => { if (await editarEjercicio(ej)) pintarHoy(cont); } }),
      el('button', { clase: 'ex-var' + (va ? '' : ' vacia'),
        texto: va ? va.nombre + (porLado ? ' · por lado' : '') : '+ variante',
        onclick: async () => { const v = await elegirVariante(ej); if (v) { en.vaId = v.vaId; tocado(); pintarHoy(cont); } } })),
    el('div', { clase: 'mv' },
      el('button', { texto: '▲', 'aria-label': 'Subir', onclick: () => mover(-1) }),
      el('button', { texto: '▼', 'aria-label': 'Bajar', onclick: () => mover(1) })),
    el('button', { clase: 'del', texto: '×', 'aria-label': 'Quitar ejercicio', onclick: async () => {
      const conDatos = en.sets.some(s => s.pesoKg !== null || s.reps !== null);
      if (conDatos && !await confirmar('¿Quitar el ejercicio?', 'Tiene series apuntadas.', { ok: 'Quitar', peligro: true })) return;
      hoja.entradas = hoja.entradas.filter(x => x.id !== en.id);
      hoja.entradas.forEach((x, k) => { x.orden = k; });
      tocado(); pintarHoy(cont);
    } })));

  // referencia: la última vez que hiciste ESTE ejercicio, sea el día que sea
  const uv = ultimaVez(estado, en.exId, en.vaId, hoja.fecha);
  if (uv) {
    const detalle = uv.sets.filter(s => s.tipo !== 'calentamiento').map(s =>
      textoSerie(s, u, mostrarPeso) + (textoIntensidad(s.intensidad) ? ' ' + textoIntensidad(s.intensidad) : '')
    ).join(' · ');
    caja.append(el('div', { clase: 'prev' },
      el('span', { clase: 'prev-k', texto: `Última vez · ${fechaCorta(uv.fecha)}${uv.rutina ? ' (' + uv.rutina + ')' : ''}` }),
      el('span', { clase: 'prev-v', texto: detalle })));
  }

  const cajaSets = el('div', { clase: 'sets' });
  en.sets.forEach((s, k) => cajaSets.append(filaSerie(cont, en, s, k, porLado, ej, g)));
  caja.append(cajaSets);

  caja.append(el('div', { clase: 'ex-pie' },
    el('button', { clase: 'addbtn sm', estilo: { marginTop: 0 }, texto: '+ serie', onclick: () => {
      const ult = en.sets.at(-1);
      en.sets.push(ult ? { ...setVacio(), pesoKg: ult.pesoKg } : setVacio());
      tocado(); pintarHoy(cont);
    } }),
    botonBloque(cont, en, i),
    // En superserie el descanso va al final del bloque, no entre ejercicios.
    (!g || g.ultima) ? botonDescanso(cont, ej) : null));

  return caja;
}

// El descanso vive en la ficha del ejercicio, así que se configura una vez y
// vale para siempre, en cualquier rutina donde aparezca.
function botonDescanso(cont, ej) {
  const item = rutinaItem(ej.id);
  const seg = descansoDe(ej, item);
  const propio = ej.descansoSeg != null;

  const b = el('button', { clase: 'ex-descanso' + (propio ? ' propio' : ''),
    'aria-label': 'Iniciar descanso de ' + mmss(seg) },
    el('span', { clase: 'ed-ic', texto: '⏱' }),
    el('span', { texto: mmss(seg) }));

  b.addEventListener('click', () => { despertarAudio(); iniciarDescanso(seg, ej.nombre); });

  // Mantener pulsado para cambiarlo. Un toque en el gimnasio, dos en casa.
  let temp;
  const abrir = e => { e.preventDefault(); clearTimeout(temp); ajustarDescanso(cont, ej); };
  b.addEventListener('contextmenu', abrir);
  b.addEventListener('touchstart', () => { temp = setTimeout(() => ajustarDescanso(cont, ej), 550); }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(ev => b.addEventListener(ev, () => clearTimeout(temp), { passive: true }));

  return b;
}

function rutinaItem(exId) {
  const r = porId(estado.rutinas, hoja.rutinaId);
  return r?.items.find(i => i.exId === exId) ?? null;
}

function ajustarDescanso(cont, ej) {
  const opciones = [45, 60, 90, 120, 150, 180, 240, 300];
  hojaOpciones(`Descanso · ${ej.nombre}`, opciones.map(s => ({
    texto: mmss(s), marca: ej.descansoSeg === s,
    accion: () => { actualizar(() => { ej.descansoSeg = s; }); pintarHoy(cont); aviso(`Descanso ${mmss(s)} para ${ej.nombre}`); },
  })).concat([{ texto: 'Usar el general', marca: ej.descansoSeg == null,
    accion: () => { actualizar(() => { ej.descansoSeg = null; }); pintarHoy(cont); } }]));
}

function hojaOpciones(titulo, opciones) {
  hojaUI(titulo, (cuerpo, cerrar) => {
    const l = el('div', { clase: 'sel-lista' });
    for (const o of opciones) {
      l.append(el('button', { clase: 'sel-fila', onclick: () => { cerrar(); o.accion(); } },
        el('span', { clase: 'sel-nombre', texto: o.texto }),
        o.marca ? el('span', { clase: 'sel-tag', texto: 'actual' }) : null));
    }
    cuerpo.append(l);
  });
}

// El botón controla el ENLACE con el ejercicio siguiente, no el ejercicio en
// sí. Encadenar un tercero es pulsar el enlace de abajo, y romper por el medio
// parte el bloque en dos en vez de deshacerlo entero.
function botonBloque(cont, en, i) {
  const orden = hoja.entradas.slice().sort((a, b) => a.orden - b.orden);
  const siguiente = orden[i + 1];
  if (!siguiente) return null;

  const juntos = unidos(en, siguiente);
  return el('button', { clase: 'ex-bloque' + (juntos ? ' quitar' : ''),
    'aria-label': juntos ? 'Separar del siguiente' : 'Unir en superserie con el siguiente',
    onclick: () => {
      if (juntos) separar(hoja.entradas, i);
      else {
        unir(hoja.entradas, i);
        aviso('Superserie con ' + (porId(estado.ejercicios, siguiente.exId)?.nombre ?? 'el siguiente'));
      }
      tocado(); pintarHoy(cont);
    } },
    // Sin icono a propósito: el emoji de cadena no está en las fuentes que
    // empaquetamos y salía como caja vacía. La barra lateral ya marca el bloque.
    el('span', { clase: 'ex-bloque-t', texto: juntos ? 'Separar' : 'Unir' }));
}

// Menú de la serie. Va detrás del número (S1) para no meter más botones en una
// fila que ya va justa de sitio.
function menuSerie(cont, en, s, k) {
  const esCal = s.tipo === 'calentamiento';
  hojaUI(`Serie ${k + 1}`, (cuerpo, cerrar) => {
    const l = el('div', { clase: 'sel-lista' });

    l.append(el('button', { clase: 'sel-fila', onclick: () => {
      cerrar();
      s.drops = s.drops ?? [];
      const ref = s.drops.at(-1) ?? s;
      s.drops.push({ id: nuevoId('dr'),
        pesoKg: ref.pesoKg != null ? Math.round(ref.pesoKg * 0.8 * 100) / 100 : null, reps: null });
      tocado(); pintarHoy(cont);
    } },
      el('span', { clase: 'sel-nombre', texto: 'Añadir bajada (dropset)' }),
      el('span', { clase: 'sel-grupo', texto: s.drops?.length ? `${s.drops.length} ya` : '−20 %' })));

    l.append(el('button', { clase: 'sel-fila', onclick: () => {
      cerrar();
      s.tipo = esCal ? 'efectiva' : 'calentamiento';
      tocado(); pintarHoy(cont);
    } },
      el('span', { clase: 'sel-nombre', texto: esCal ? 'Marcar como serie efectiva' : 'Marcar como calentamiento' }),
      esCal ? el('span', { clase: 'sel-tag', texto: 'calent.' }) : null));

    cuerpo.append(l);
  });
}

// Fila de una bajada dentro de una serie.
function filaDrop(cont, en, s, d, j) {
  const u = estado.ajustes.unidad;
  const peso = el('input', { inputmode: 'decimal', value: mostrarPeso(d.pesoKg, u),
    placeholder: u, 'aria-label': `Peso de la bajada ${j + 1}` });
  const reps = el('input', { inputmode: 'decimal', value: d.reps ?? '',
    placeholder: 'reps', 'aria-label': `Repeticiones de la bajada ${j + 1}` });
  peso.addEventListener('input', () => { d.pesoKg = leerPeso(peso.value, u); tocado(); });
  reps.addEventListener('input', () => { d.reps = leerNumero(reps.value); tocado(); });

  return el('div', { clase: 'set drop' },
    el('span', { clase: 'si', texto: '↳' }),
    el('div', { clase: 'set-peso' }, peso),
    el('span', { clase: 'x', texto: '×' }),
    reps,
    el('button', { clase: 'del sm', texto: '×', 'aria-label': 'Borrar bajada', onclick: () => {
      s.drops = s.drops.filter(x => x.id !== d.id);
      tocado(); pintarHoy(cont);
    } }));
}

function filaSerie(cont, en, s, k, porLado, ej, g) {
  const u = estado.ajustes.unidad;

  // El recordatorio de "por lado" va en la etiqueta azul del ejercicio, que
  // siempre se ve. En el campo no cabe y se cortaba.
  const peso = el('input', { inputmode: 'decimal', value: mostrarPeso(s.pesoKg, u),
    placeholder: u, 'aria-label': porLado ? `Peso por lado en ${u}` : `Peso en ${u}` });
  const reps = el('input', { inputmode: 'decimal', value: s.reps ?? '', placeholder: 'reps', 'aria-label': 'Repeticiones' });

  const alerta = el('span', { clase: 'alerta-carga' });
  const revisar = () => {
    const an = cargaAnomala(estado, en.exId, en.vaId, s.pesoKg);
    alerta.textContent = an ? '!' : '';
    alerta.title = an
      ? `Fuera de lo habitual (${mostrarPeso(an.habitual[0], u)}-${mostrarPeso(an.habitual[1], u)} ${u}). ¿Cambiaste de máquina?`
      : '';
    alerta.className = 'alerta-carga' + (an ? ' on' : '');
  };

  peso.addEventListener('input', () => { s.pesoKg = leerPeso(peso.value, u); tocado(); despertarAudio(); });
  peso.addEventListener('change', revisar);
  reps.addEventListener('input', () => { s.reps = leerNumero(reps.value); tocado(); });

  // Apuntar las repeticiones es la señal de que acabas de terminar la serie,
  // así que ahí arranca el descanso solo. Si vuelves a tocar el campo para
  // corregirte, no se reinicia. En una superserie solo cuenta el último
  // ejercicio del bloque: entre A1 y A2 no se descansa.
  let yaLanzado = s.reps !== null;
  reps.addEventListener('blur', () => {
    if (!estado.ajustes.descansoAuto || yaLanzado) return;
    if (s.reps === null || s.pesoKg === null) return;
    if (s.tipo === 'calentamiento') return;
    yaLanzado = true;
    if (g && !g.ultima) return;
    const nombre = g ? `Superserie ${g.letra}` : ej.nombre;
    iniciarDescanso(descansoDe(ej, rutinaItem(en.exId)), nombre);
  });
  revisar();

  const idx = el('button', { clase: 'si si-btn' + (s.tipo === 'calentamiento' ? ' cal' : ''),
    texto: s.tipo === 'calentamiento' ? 'C' : 'S' + (k + 1),
    'aria-label': `Opciones de la serie ${k + 1}` });
  idx.addEventListener('click', () => menuSerie(cont, en, s, k));

  const fila = el('div', { clase: 'set' + (s.tipo === 'calentamiento' ? ' es-cal' : '') },
    idx,
    // El aviso va superpuesto en la esquina del campo, no en la fila: si
    // ocupara sitio estrecharía el hueco del peso y "300" se vería "30".
    el('div', { clase: 'set-peso' }, peso, alerta),
    el('span', { clase: 'x', texto: '×' }),
    reps,
    selectorIntensidad(s),
    el('button', { clase: 'del sm', texto: '×', 'aria-label': 'Borrar serie', onclick: () => {
      en.sets = en.sets.filter(x => x.id !== s.id);
      if (!en.sets.length) en.sets.push(setVacio());
      tocado(); pintarHoy(cont);
    } }));

  if (!s.drops?.length) return fila;
  return el('div', { clase: 'set-grupo' }, fila,
    ...s.drops.map((d, j) => filaDrop(cont, en, s, d, j)));
}

// Escala configurable, pero solo con los valores rápidos a la vista. El resto
// del rango está detrás de un toque, para no llenar la fila de botones.
function selectorIntensidad(s) {
  const esc = ESCALAS[estado.ajustes.escalaIntensidad] ?? ESCALAS.rir;
  const caja = el('div', { clase: 'rirsel' });

  const pintar = () => {
    vaciar(caja);
    const rapidos = estado.ajustes.valoresRapidos.filter(v => esc.valores.includes(v));
    const actual = s.intensidad?.valor;
    const mostrar = (actual !== undefined && actual !== null && !rapidos.includes(actual))
      ? [...rapidos, actual] : rapidos;

    for (const v of mostrar) {
      const b = el('button', { texto: esc.texto(v), clase: (actual === v ? 'on' : '') + (v === 0 || v >= 9.5 ? ' f' : '') });
      b.addEventListener('click', () => {
        s.intensidad = actual === v ? null : { escala: esc === ESCALAS.rpe ? 'rpe' : 'rir', valor: v };
        tocado(); pintar();
      });
      caja.append(b);
    }
    caja.append(el('button', { clase: 'mas', texto: '⋯', 'aria-label': 'Todos los valores', onclick: () => {
      const i = esc.valores.indexOf(actual ?? -1);
      const sig = esc.valores[(i + 1) % esc.valores.length];
      s.intensidad = { escala: esc === ESCALAS.rpe ? 'rpe' : 'rir', valor: sig };
      tocado(); pintar();
    } }));
  };
  pintar();
  return caja;
}

// ---------------------------------------------------------- copiar la anterior
function copiarUltima(cont) {
  let n = 0;
  for (const en of hoja.entradas) {
    const uv = ultimaVez(estado, en.exId, en.vaId, hoja.fecha);
    if (!uv) continue;
    const vacio = en.sets.every(s => s.pesoKg === null && s.reps === null);
    if (!vacio) continue;
    en.sets = uv.sets.map(s => ({ id: nuevoId('st'), pesoKg: s.pesoKg, reps: s.reps,
      intensidad: s.intensidad ? { ...s.intensidad } : null, tipo: s.tipo ?? 'efectiva',
      drops: (s.drops ?? []).map(d => ({ id: nuevoId('dr'), pesoKg: d.pesoKg, reps: d.reps })) }));
    n++;
  }
  tocado(); pintarHoy(cont);
  aviso(n ? `Copiados ${n} ejercicio${n === 1 ? '' : 's'} de la última vez` : 'No hay nada vacío que rellenar');
}

// -------------------------------------------------------------------- notas
function bloqueNotas() {
  const t = el('textarea', { placeholder: 'ej. lumbar bien hoy, la máquina de abductores sigue rota' });
  t.value = hoja.diario.notas ?? '';
  t.addEventListener('input', () => { hoja.diario.notas = t.value; tocado(); });
  return el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Notas (molestias, antojos, eventos)' }), t);
}

// ------------------------------------------------------------------- guardar
async function guardarDia(cont) {
  const fecha = hoja.fecha || hoyISO();

  const entradas = hoja.entradas
    .map(en => ({ ...en,
      sets: en.sets
        .map(s => ({ ...s, drops: (s.drops ?? []).filter(d => d.pesoKg !== null || d.reps !== null) }))
        .filter(s => s.pesoKg !== null || s.reps !== null || s.drops.length) }))
    .filter(en => en.sets.length);

  actualizar(e => {
    e.diario[fecha] = { fecha, ...hoja.diario };
    e.sesiones = e.sesiones.filter(s => s.fecha !== fecha);
    if (entradas.length) {
      e.sesiones.push({ id: nuevoId('se'), fecha, rutinaId: hoja.rutinaId,
        rutinaNombre: hoja.rutinaNombre || '', entradas });
    }
    e.sesiones.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  });

  await borrarBorrador();
  const rutinaId = hoja.rutinaId, rutinaNombre = hoja.rutinaNombre;
  hoja = hojaVacia(hoyISO());
  hoja.rutinaId = rutinaId; hoja.rutinaNombre = rutinaNombre;
  pintarHoy(cont);
  aviso(`Guardado · ${entradas.length} ejercicio${entradas.length === 1 ? '' : 's'}`, 'ok');
}

// Cargar un día ya guardado para corregirlo.
export function editarDia(fecha, cont) {
  const s = estado.sesiones.find(x => x.fecha === fecha);
  const d = estado.diario[fecha];
  hoja = hojaVacia(fecha);
  if (d) hoja.diario = { ...hoja.diario, ...d };
  if (s) {
    hoja.rutinaId = s.rutinaId;
    hoja.rutinaNombre = s.rutinaNombre;
    hoja.entradas = s.entradas.map((en, i) => ({ ...en, orden: i,
      sets: en.sets.map(x => ({ ...x, id: x.id ?? nuevoId('st') })) }));
  }
  tocado();
  pintarHoy(cont);
  aviso('Editando ' + fechaCorta(fecha) + ' · guarda para actualizar');
}

export const hojaActual = () => hoja;
