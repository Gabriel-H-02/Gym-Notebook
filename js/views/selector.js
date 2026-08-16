// Selector de ejercicio. Busca en tu catálogo por nombre, por alias antiguos y
// por grupo muscular, y deja crear el que falte sin salir de la pantalla.

import { el, hoja, pedirTexto, aviso } from '../ui.js';
import { estado, actualizar } from '../store.js';
import { nuevoId, varianteActiva, nombreCompleto } from '../model.js';
import { imagen, miniaturaDe, animacionDe, activo as mediaActiva, PROVEEDOR } from '../media.js';
import { cargarCatalogo, buscarCatalogo, gruposCatalogo, FAMILIAS } from '../catalogo.js';

const sinAcentos = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const GRUPOS = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Cuádriceps',
  'Femoral', 'Glúteo', 'Gemelo', 'Abdomen', 'Antebrazo', 'Otro'];

function coincide(ej, q) {
  if (!q) return true;
  const t = sinAcentos(q);
  if (sinAcentos(ej.nombre).includes(t)) return true;
  if (ej.grupo && sinAcentos(ej.grupo).includes(t)) return true;
  if (ej.alias?.some(a => sinAcentos(a).includes(t))) return true;
  return ej.variantes.some(v => sinAcentos(v.nombre).includes(t));
}

export function crearEjercicio(nombre, grupo = null) {
  const ej = { id: nuevoId('ex'), nombre: nombre.trim(), alias: [], catalogId: null,
    grupo, descansoSeg: null, variantes: [], creado: new Date().toISOString().slice(0, 10) };
  actualizar(e => e.ejercicios.push(ej));
  return ej;
}

// devuelve { exId, vaId } o null si se cancela
export function elegirEjercicio({ titulo = 'Elegir ejercicio' } = {}) {
  return new Promise(res => {
    let resuelto = false;
    const terminar = (v, cerrar) => { resuelto = true; cerrar(); res(v); };

    hoja(titulo, (cuerpo, cerrar) => {
      const lista = el('div', { clase: 'sel-lista' });
      const busca = el('input', { clase: 'sel-busca', placeholder: 'Buscar, o mira la lista de abajo',
        autocomplete: 'off', autocapitalize: 'sentences' });
      const filtros = el('div', { clase: 'sel-filtros' });

      let grupoFiltro = null;
      let familiaFiltro = null;
      let tope = 60;

      const pintarFiltros = () => {
        vaciarNodo(filtros);
        const grupos = gruposCatalogo();

        const fila1 = el('div', { clase: 'chips' });
        fila1.append(chip('Todo el cuerpo', grupoFiltro === null,
          () => { grupoFiltro = null; tope = 60; pintarFiltros(); pintar(); }));
        for (const g of grupos) {
          fila1.append(chip(g, grupoFiltro === g,
            () => { grupoFiltro = grupoFiltro === g ? null : g; tope = 60; pintarFiltros(); pintar(); }));
        }

        const fila2 = el('div', { clase: 'chips' });
        fila2.append(chip('Cualquier equipo', familiaFiltro === null,
          () => { familiaFiltro = null; tope = 60; pintarFiltros(); pintar(); }, true));
        for (const [id, nombre] of FAMILIAS) {
          fila2.append(chip(nombre, familiaFiltro === id,
            () => { familiaFiltro = familiaFiltro === id ? null : id; tope = 60; pintarFiltros(); pintar(); }, true));
        }
        filtros.append(fila1, fila2);
      };

      const pintar = () => {
        const q = busca.value.trim();
        vaciarNodo(lista);

        // --- primero los tuyos: son los que vas a elegir el 95 % de las veces
        let items = estado.ejercicios.filter(x => coincide(x, q));
        if (grupoFiltro) items = items.filter(x => x.grupo === grupoFiltro);
        items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        if (items.length) lista.append(el('div', { clase: 'sel-cab' },
          el('span', { texto: 'Los tuyos' }),
          el('span', { clase: 'sel-cab-n', texto: String(items.length) })));
        for (const ej of items) {
          const vivas = ej.variantes.filter(v => v.estado !== 'descartada');
          if (!ej.variantes.length) {
            lista.append(fila(ej.nombre, ej.grupo, () => terminar({ exId: ej.id, vaId: null }, cerrar), false, ej));
          } else {
            for (const v of (vivas.length ? vivas : ej.variantes)) {
              lista.append(fila(`${ej.nombre} · ${v.nombre}`, ej.grupo,
                () => terminar({ exId: ej.id, vaId: v.id }, cerrar), v.estado === 'actual', ej));
            }
          }
        }

        // --- y luego el catálogo entero, filtrado
        const yaTengo = new Set(estado.ejercicios.map(x => x.catalogId).filter(Boolean));
        const r = buscarCatalogo(q, { grupo: grupoFiltro, familia: familiaFiltro, limite: tope });
        const delCat = (r.items ?? []).filter(c => !yaTengo.has(c.catalogId));

        if (delCat.length) {
          lista.append(el('div', { clase: 'sel-cab' },
            el('span', { texto: q ? 'Del catálogo' : 'Catálogo' }),
            el('span', { clase: 'sel-cab-n', texto: String(r.total) })));
          for (const c of delCat) lista.append(filaCatalogo(c, cerrar, terminar));

          if (r.total > tope) {
            lista.append(el('button', { clase: 'sel-mas-btn',
              texto: `Ver más (quedan ${r.total - tope})`,
              onclick: () => { tope += 60; pintar(); } }));
          }
        }

        if (q && !items.some(x => sinAcentos(x.nombre) === sinAcentos(q))) {
          lista.append(el('button', { clase: 'sel-crear', onclick: async () => {
            const g = await elegirGrupo();
            const ej = crearEjercicio(q, g);
            aviso(`"${ej.nombre}" añadido a tu catálogo`);
            terminar({ exId: ej.id, vaId: null }, cerrar);
          } }, el('span', { clase: 'sel-crear-mas', texto: '+' }),
             el('span', { texto: `Crear "${q}" a mano` })));
        }

        if (!lista.children.length) {
          lista.append(el('p', { clase: 'muted', texto: 'Nada con esos filtros. Prueba a quitar alguno.' }));
        }
      };

      busca.addEventListener('input', () => { tope = 60; pintar(); });
      cuerpo.append(busca, filtros, lista);
      pintarFiltros();
      pintar();
      // El catálogo se carga al abrir el buscador, no al arrancar la app.
      cargarCatalogo().then(() => { pintarFiltros(); pintar(); });

      const obs = new MutationObserver(() => {
        if (!document.body.contains(cuerpo) && !resuelto) { obs.disconnect(); res(null); }
      });
      obs.observe(document.body, { childList: true });
    });
  });
}

function chip(texto, activo, onclick, secundario = false) {
  return el('button', { clase: 'chip' + (activo ? ' on' : '') + (secundario ? ' sec' : ''),
    texto, onclick });
}

function fila(texto, grupo, onclick, activa = false, ej = null) {
  return el('button', { clase: 'sel-fila' + (activa ? ' activa' : ''), onclick },
    miniatura(ej),
    el('span', { clase: 'sel-nombre', texto }),
    grupo ? el('span', { clase: 'sel-grupo', texto: grupo }) : null,
    activa ? el('span', { clase: 'sel-tag', texto: 'en uso' }) : null);
}

// Fila del catálogo. Dos zonas con dos intenciones: tocar el nombre abre la
// vista previa con el movimiento en marcha, y el + lo añade directo para quien
// ya sabe cuál quiere.
function filaCatalogo(c, cerrar, terminar) {
  const anadir = () => {
    const ej = crearEjercicio(c.nombre, c.grupo);
    actualizar(() => {
      ej.catalogId = c.catalogId;
      ej.mediaId = c.mediaId;
      if (c.nombreEn !== c.nombre) ej.alias.push(c.nombreEn);
    });
    aviso(`"${c.nombre}" añadido`);
    terminar({ exId: ej.id, vaId: null }, cerrar);
  };

  const f = el('div', { clase: 'sel-fila nuevo' },
    el('button', { clase: 'sel-cuerpo', onclick: () => previsualizar(c, anadir) },
      miniatura(null, c),
      el('span', { clase: 'sel-nombre' },
        el('span', { texto: c.nombre }),
        sinAcentos(c.nombre).includes(sinAcentos(c.equipo))
          ? null : el('span', { clase: 'sel-eq', texto: c.equipo })),
      el('span', { clase: 'sel-grupo', texto: c.grupo })),
    el('button', { clase: 'sel-mas', texto: '+', 'aria-label': `Añadir ${c.nombre}`, onclick: anadir }));
  return f;
}

// Vista previa: aquí sí se carga el GIF completo, porque es una sola imagen y
// es justo lo que quieres ver antes de decidir. En la lista van miniaturas
// estáticas: veintiséis animaciones serían tres megas por búsqueda.
function previsualizar(c, anadir) {
  hoja(c.nombre, (cuerpo, cerrarPrev) => {
    const caja = el('div', { clase: 'prev-ej' });
    const cargando = el('div', { clase: 'prev-cargando', texto: 'Cargando…' });
    caja.append(cargando);

    if (mediaActiva()) {
      animacionDe(c).then(src => {
        cargando.remove();
        if (src) caja.prepend(el('img', { src, alt: `Ejecución de ${c.nombre}` }),
          el('p', { clase: 'atrib', texto: PROVEEDOR.atribucion }));
        else caja.prepend(el('p', { clase: 'muted', texto: 'No hay ilustración para este ejercicio.' }));
      });
    } else {
      cargando.remove();
    }

    cuerpo.append(caja,
      el('div', { clase: 'prev-datos' },
        el('span', { clase: 'sel-grupo', texto: c.grupo }),
        el('span', { clase: 'sel-eq', texto: c.equipo }),
        c.nombreEn !== c.nombre ? el('span', { clase: 'sel-eq', texto: c.nombreEn }) : null),
      el('button', { clase: 'save', texto: 'Añadir a mis ejercicios',
        onclick: () => { cerrarPrev(); anadir(); } }));
  });
}

// Miniatura de 180×180 del proveedor. Se carga sola y si no hay, no ocupa.
// En la lista van las estáticas a propósito: veintiséis animaciones serían
// tres megas por búsqueda. El GIF completo vive en la vista previa.
function miniatura(ej, ficha = null) {
  if (!mediaActiva()) return null;
  const caja = el('span', { clase: 'sel-mini' });
  (ficha ? miniaturaDe(ficha) : imagen(ej, 'miniatura')).then(src => {
    if (src) caja.append(el('img', { src, alt: '', loading: 'lazy' }));
    else caja.classList.add('vacia');
  });
  return caja;
}

function marcar(cont, btn) {
  [...cont.children].forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
}

const vaciarNodo = n => { while (n.firstChild) n.removeChild(n.firstChild); };

export function elegirGrupo() {
  return new Promise(res => {
    hoja('¿Qué grupo muscular?', (cuerpo, cerrar) => {
      const g = el('div', { clase: 'sel-lista' });
      for (const nombre of GRUPOS) {
        g.append(el('button', { clase: 'sel-fila', onclick: () => { cerrar(); res(nombre); } },
          el('span', { clase: 'sel-nombre', texto: nombre })));
      }
      g.append(el('button', { clase: 'sel-fila', onclick: () => { cerrar(); res(null); } },
        el('span', { clase: 'sel-nombre muted', texto: 'Sin asignar' })));
      cuerpo.append(g);
    });
  });
}

// Elegir variante de un ejercicio, o crear una nueva.
export function elegirVariante(ej) {
  return new Promise(res => {
    hoja(`Variante de ${ej.nombre}`, (cuerpo, cerrar) => {
      const l = el('div', { clase: 'sel-lista' });
      l.append(el('button', { clase: 'sel-fila', onclick: () => { cerrar(); res({ vaId: null }); } },
        el('span', { clase: 'sel-nombre', texto: 'Sin variante' })));
      for (const v of ej.variantes) {
        l.append(el('button', { clase: 'sel-fila', onclick: () => { cerrar(); res({ vaId: v.id }); } },
          el('span', { clase: 'sel-nombre', texto: v.nombre }),
          v.porLado ? el('span', { clase: 'sel-grupo', texto: 'por lado' }) : null,
          v.estado === 'actual' ? el('span', { clase: 'sel-tag', texto: 'en uso' }) : null,
          v.estado === 'descartada' ? el('span', { clase: 'sel-grupo', texto: 'abandonada' }) : null));
      }
      l.append(el('button', { clase: 'sel-crear', onclick: async () => {
        const n = await pedirTexto('Nueva variante', '', 'ej. Polea unilateral');
        if (!n) return;
        const v = { id: nuevoId('va'), nombre: n, porLado: null, estado: 'actual' };
        actualizar(() => {
          ej.variantes.forEach(x => { if (x.estado === 'actual') x.estado = null; });
          ej.variantes.push(v);
        });
        cerrar(); res({ vaId: v.id });
      } }, el('span', { clase: 'sel-crear-mas', texto: '+' }), el('span', { texto: 'Nueva variante' })));
      cuerpo.append(l);
    });
  });
}

export { nombreCompleto, varianteActiva };

// Editar el ejercicio en sí: su nombre y su grupo muscular. Se llega tocando
// el nombre en cualquier pantalla. Al renombrar, el nombre viejo se queda como
// alias, así el buscador lo sigue encontrando y el historial no se rompe.
export function editarEjercicio(ej) {
  return new Promise(res => {
    hoja(ej.nombre, (cuerpo, cerrar) => {
      const l = el('div', { clase: 'sel-lista' });

      l.append(el('button', { clase: 'sel-fila', onclick: async () => {
        cerrar();
        const n = await pedirTexto('Nombre del ejercicio', ej.nombre);
        if (!n || n === ej.nombre) return res(false);
        actualizar(() => {
          if (!ej.alias.includes(ej.nombre)) ej.alias.push(ej.nombre);
          ej.nombre = n;
        });
        aviso(`Ahora se llama "${n}"`);
        res(true);
      } },
        el('span', { clase: 'sel-nombre', texto: 'Renombrar' }),
        el('span', { clase: 'sel-grupo', texto: ej.nombre })));

      l.append(el('button', { clase: 'sel-fila', onclick: async () => {
        cerrar();
        const g = await elegirGrupo();
        actualizar(() => { ej.grupo = g; });
        res(true);
      } },
        el('span', { clase: 'sel-nombre', texto: 'Grupo muscular' }),
        el('span', { clase: 'sel-grupo', texto: ej.grupo ?? 'sin asignar' })));

      if (mediaActiva()) {
        const cajaImg = el('div', { clase: 'ficha-img' });
        cuerpo.append(cajaImg);
        imagen(ej, 'animacion').then(src => {
          if (!src) return;
          cajaImg.append(el('img', { src, alt: `Ejecución de ${ej.nombre}`, loading: 'lazy' }),
            el('p', { clase: 'atrib', texto: PROVEEDOR.atribucion }));
        });
      }

      if (ej.alias.length) {
        l.append(el('div', { clase: 'sel-info' },
          el('span', { clase: 'label', texto: 'También lo has llamado' }),
          el('span', { clase: 'muted', texto: ej.alias.join(' · ') })));
      }
      cuerpo.append(l);
    });
  });
}
