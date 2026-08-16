// Pantalla de rutinas. Aquí se arma el entreno: qué ejercicios, en qué orden,
// cuántas series y cuánto descanso.
//
// Es una pantalla aparte a propósito. En la versión anterior la plantilla se
// reescribía sola al guardar un día, así que editar un martes de hace un mes
// cambiaba todos los martes futuros. Ahora registrar un entreno no toca nunca
// la rutina.

import { el, vaciar, aviso, confirmar, pedirTexto } from '../ui.js';
import { estado, actualizar } from '../store.js';
import { nuevoId, porId, variante, varianteActiva, bloques, unidos, unir, separar } from '../model.js';
import { elegirEjercicio, elegirVariante, elegirGrupo, editarEjercicio } from './selector.js';

let editando = null;   // id de la rutina abierta, o null para el listado

export function pintarRutinas(cont) {
  vaciar(cont);
  if (editando && porId(estado.rutinas, editando)) pintarEditor(cont, porId(estado.rutinas, editando));
  else { editando = null; pintarListado(cont); }
}

// ------------------------------------------------------------------ listado
function pintarListado(cont) {
  const activas = estado.rutinas.filter(r => !r.archivada);
  const archivadas = estado.rutinas.filter(r => r.archivada);

  cont.append(el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Tus rutinas' }),
    activas.length ? el('div', {}, activas.map(r => filaRutina(cont, r)))
      : el('p', { clase: 'muted', texto: 'Todavía no tienes ninguna. Crea la primera abajo.' }),
    el('button', { clase: 'addbtn', texto: '+ Nueva rutina', onclick: async () => {
      const n = await pedirTexto('Nombre de la rutina', '', 'ej. Torso A');
      if (!n) return;
      const r = { id: nuevoId('rt'), nombre: n, items: [], archivada: false };
      actualizar(e => e.rutinas.push(r));
      editando = r.id;
      pintarRutinas(cont);
    } })));

  if (archivadas.length) {
    cont.append(el('div', { clase: 'card' },
      el('span', { clase: 'label', texto: 'Archivadas' }),
      el('div', {}, archivadas.map(r => filaRutina(cont, r)))));
  }
}

function filaRutina(cont, r) {
  const n = r.items.length;
  return el('div', { clase: 'hrow tap', onclick: () => { editando = r.id; pintarRutinas(cont); } },
    el('div', {},
      el('div', { clase: 'hd', texto: r.nombre }),
      el('div', { clase: 'hs', texto: n ? `${n} ejercicio${n === 1 ? '' : 's'}` : 'vacía' })),
    el('span', { clase: 'chevron', texto: '›' }));
}

// ------------------------------------------------------------------- editor
function pintarEditor(cont, r) {
  const volver = () => { editando = null; pintarRutinas(cont); };

  cont.append(el('div', { clase: 'barra-vuelta' },
    el('button', { clase: 'btn-volver', onclick: volver }, '‹ Rutinas'),
    el('button', { clase: 'btn-txt', texto: 'Renombrar', onclick: async () => {
      const n = await pedirTexto('Nombre de la rutina', r.nombre);
      if (!n) return;
      actualizar(() => { r.nombre = n; });
      pintarRutinas(cont);
    } })));

  cont.append(el('h2', { clase: 'titulo-sec', texto: r.nombre }));

  const lista = el('div', { clase: 'rt-items' });
  const bl = bloques(r.items.map(i => ({ ...i, id: i.id })));
  r.items.sort((a, b) => a.orden - b.orden).forEach((it, i) => lista.append(itemRutina(cont, r, it, i, bl)));

  cont.append(el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Ejercicios' }),
    r.items.length ? lista : el('p', { clase: 'muted', texto: 'Rutina vacía. Añade el primer ejercicio.' }),
    el('button', { clase: 'addbtn', texto: '+ Añadir ejercicio', onclick: async () => {
      const sel = await elegirEjercicio({ titulo: 'Añadir a ' + r.nombre });
      if (!sel) return;
      actualizar(() => r.items.push({ id: nuevoId('it'), exId: sel.exId, vaId: sel.vaId,
        orden: r.items.length, seriesObjetivo: 3, descansoSeg: null, grupo: null }));
      pintarRutinas(cont);
    } })));

  cont.append(el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Acciones' }),
    el('div', { clase: 'row' },
      el('button', { clase: 'addbtn', estilo: { marginTop: 0 }, texto: '⧉ Duplicar', onclick: () => {
        const copia = { ...r, id: nuevoId('rt'), nombre: r.nombre + ' (copia)',
          items: r.items.map(i => ({ ...i, id: nuevoId('it') })) };
        actualizar(e => e.rutinas.push(copia));
        editando = copia.id;
        pintarRutinas(cont);
        aviso('Rutina duplicada');
      } }),
      el('button', { clase: 'addbtn', estilo: { marginTop: 0 },
        texto: r.archivada ? '⤒ Desarchivar' : '⤓ Archivar', onclick: () => {
          actualizar(() => { r.archivada = !r.archivada; });
          volver();
        } })),
    el('button', { clase: 'addbtn peligro', texto: 'Borrar rutina', onclick: async () => {
      const usada = estado.sesiones.some(s => s.rutinaId === r.id);
      const ok = await confirmar('¿Borrar la rutina?',
        usada ? 'Los entrenos que ya hiciste con ella se conservan. Solo desaparece la plantilla.'
              : 'No se puede deshacer.', { ok: 'Borrar', peligro: true });
      if (!ok) return;
      actualizar(e => { e.rutinas = e.rutinas.filter(x => x.id !== r.id); });
      volver();
    } })));
}

function itemRutina(cont, r, it, i, bl) {
  const ej = porId(estado.ejercicios, it.exId);
  if (!ej) return el('div');
  const va = variante(ej, it.vaId);

  const mover = d => {
    const orden = r.items.slice().sort((a, b) => a.orden - b.orden);
    const j = orden.indexOf(it) + d;
    if (j < 0 || j >= orden.length) return;
    orden.splice(orden.indexOf(it), 1);
    orden.splice(j, 0, it);
    actualizar(() => orden.forEach((x, k) => { x.orden = k; }));
    pintarRutinas(cont);
  };

  const g = bl?.get(it.id) ?? null;

  return el('div', { clase: 'rt-item' + (g ? ' en-bloque' + (g.primera ? ' bl-ini' : '') + (g.ultima ? ' bl-fin' : '') : '') },
    g?.primera ? el('div', { clase: 'bl-cab' },
      el('span', { clase: 'bl-tag', texto: `Superserie ${g.letra}` }),
      el('span', { clase: 'bl-n', texto: `${g.total} seguidos` })) : null,
    el('div', { clase: 'rt-top' },
      el('span', { clase: 'pos', texto: g ? `${g.letra}${g.indice}` : String(i + 1) }),
      el('div', { clase: 'rt-nombre' },
        el('button', { clase: 'rt-n1', texto: ej.nombre,
          onclick: async () => { if (await editarEjercicio(ej)) pintarRutinas(cont); } }),
        va ? el('button', { clase: 'rt-var', texto: va.nombre + (va.porLado ? ' · por lado' : ''),
          onclick: async () => { const v = await elegirVariante(ej); if (v) { actualizar(() => { it.vaId = v.vaId; }); pintarRutinas(cont); } } })
          : el('button', { clase: 'rt-var vacia', texto: '+ variante',
            onclick: async () => { const v = await elegirVariante(ej); if (v) { actualizar(() => { it.vaId = v.vaId; }); pintarRutinas(cont); } } })),
      el('div', { clase: 'mv' },
        el('button', { texto: '▲', 'aria-label': 'Subir', onclick: () => mover(-1) }),
        el('button', { texto: '▼', 'aria-label': 'Bajar', onclick: () => mover(1) })),
      el('button', { clase: 'del', texto: '×', 'aria-label': 'Quitar', onclick: async () => {
        const ok = await confirmar('¿Quitar de la rutina?', ej.nombre, { ok: 'Quitar', peligro: true });
        if (!ok) return;
        actualizar(() => { r.items = r.items.filter(x => x.id !== it.id); r.items.forEach((x, k) => { x.orden = k; }); });
        pintarRutinas(cont);
      } })),
    el('div', { clase: 'rt-cfg' },
      campoNum('Series', it.seriesObjetivo, v => actualizar(() => { it.seriesObjetivo = v ?? 3; })),
      campoNum('Descanso (s)', it.descansoSeg, v => actualizar(() => { it.descansoSeg = v; }),
        estado.ajustes.descansoPorDefecto),
      ej.grupo
        ? el('button', { clase: 'rt-grupo', texto: ej.grupo, onclick: async () => {
            const x = await elegirGrupo(); actualizar(() => { ej.grupo = x; }); pintarRutinas(cont); } })
        : el('button', { clase: 'rt-grupo vacio', texto: '+ grupo', onclick: async () => {
            const x = await elegirGrupo(); actualizar(() => { ej.grupo = x; }); pintarRutinas(cont); } }),
      botonUnir(cont, r, it, i)));
}

// Igual que en la pantalla de hoy: el botón es el enlace con el siguiente.
function botonUnir(cont, r, it, i) {
  const orden = r.items.slice().sort((a, b) => a.orden - b.orden);
  const siguiente = orden[i + 1];
  if (!siguiente) return null;

  const juntos = unidos(it, siguiente);
  return el('button', { clase: 'rt-unir' + (juntos ? ' on' : ''),
    texto: juntos ? 'Separar' : 'Unir',
    'aria-label': juntos ? 'Separar del siguiente' : 'Unir en superserie con el siguiente',
    onclick: () => {
      actualizar(() => { if (juntos) separar(r.items, i); else unir(r.items, i); });
      pintarRutinas(cont);
    } });
}

function campoNum(etiqueta, valor, alCambiar, marcador = '') {
  const inp = el('input', { clase: 'mini', inputmode: 'numeric', value: valor ?? '',
    placeholder: String(marcador ?? '') });
  inp.addEventListener('change', () => {
    const n = parseInt(inp.value, 10);
    alCambiar(Number.isFinite(n) && n > 0 ? n : null);
  });
  return el('label', { clase: 'campo-mini' }, el('span', { texto: etiqueta }), inp);
}

export const abrirRutina = id => { editando = id; };
