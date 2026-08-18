// Diario del cuerpo: peso, medidas y fotos.
//
// El registro de medidas de la versión anterior estaba vacío desde julio, así
// que aquí manda que apuntar cueste poco: se abre con la última medición ya
// puesta como referencia, y basta con corregir lo que haya cambiado.

import { el, vaciar, aviso, confirmar, pedirTexto } from '../ui.js';
import { estado, actualizar } from '../store.js';
import {
  nuevoId, hoyISO, fechaCorta, mostrarPeso, mostrarMedida, leerMedida,
  unidadMedida, valorSitio,
} from '../model.js';
import { linea, tabla, SERIES } from '../grafico.js';
import { guardarFoto, urlFoto, borrarFoto } from '../fotos.js';
import { icono } from '../iconos.js';

let seccion = 'peso';      // peso | medidas | fotos
let sitioAbierto = null;
let verTabla = false;

export function pintarCuerpo(cont) {
  vaciar(cont);
  const secciones = [['peso', 'Peso'], ['medidas', 'Medidas'], ['fotos', 'Fotos']];
  const seg = el('div', { clase: 'seg' });
  for (const [id, nombre] of secciones) {
    seg.append(el('button', { clase: seccion === id ? 'on' : '', texto: nombre,
      onclick: () => { seccion = id; sitioAbierto = null; pintarCuerpo(cont); } }));
  }
  cont.append(el('div', { clase: 'card' }, seg));

  if (seccion === 'peso') pintarPeso(cont);
  else if (seccion === 'medidas') pintarMedidas(cont);
  else pintarFotos(cont);
}

// -------------------------------------------------------------------- peso
function pintarPeso(cont) {
  const u = estado.ajustes.unidad;
  const dias = Object.keys(estado.diario).sort();
  const puntos = dias.filter(f => estado.diario[f].pesoKg)
    .map(f => ({ fecha: f, valor: Number(mostrarPeso(estado.diario[f].pesoKg, u)) }));

  if (!puntos.length) {
    cont.append(el('div', { clase: 'card' },
      el('p', { clase: 'muted', texto: 'Apunta tu peso en la pestaña Hoy y aquí verás la evolución.' })));
    return;
  }

  // Media móvil de 7 días: el peso diario sube y baja con el agua y la comida,
  // y la línea suavizada es la que enseña la tendencia de verdad.
  const media = puntos.map((p, i) => {
    const ventana = puntos.slice(Math.max(0, i - 6), i + 1);
    return { fecha: p.fecha, valor: Math.round(ventana.reduce((a, b) => a + b.valor, 0) / ventana.length * 100) / 100 };
  });

  const primero = puntos[0], ultimo = puntos.at(-1);
  const dif = ultimo.valor - primero.valor;

  cont.append(el('div', { clase: 'card' },
    el('div', { clase: 'row' },
      el('div', { clase: 'stat' },
        el('div', { clase: 'v', texto: String(ultimo.valor) }),
        el('div', { clase: 'k', texto: `Último (${u})` })),
      el('div', { clase: 'stat' },
        el('div', { clase: 'v' + (dif < 0 ? '' : ' plano'), texto: (dif > 0 ? '+' : '') + Math.round(dif * 10) / 10 }),
        el('div', { clase: 'k', texto: 'Desde el inicio' })),
      el('div', { clase: 'stat' },
        el('div', { clase: 'v', texto: String(puntos.length) }),
        el('div', { clase: 'k', texto: 'Pesajes' })))));

  const series = [
    { nombre: 'Media 7 días', color: SERIES[0], puntos: media },
    { nombre: 'Diario', color: SERIES[1], puntos },
  ];
  cont.append(el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: `Peso corporal (${u})` }),
    linea(series, { alto: 200, unidad: u }),
    el('div', { clase: 'g-leyenda' },
      el('span', { clase: 'g-lg' }, el('i', { estilo: { background: SERIES[0] } }), 'Media 7 días'),
      el('span', { clase: 'g-lg' }, el('i', { estilo: { background: SERIES[1] } }), 'Diario')),
    el('p', { clase: 'muted g-nota',
      texto: 'La línea suave es la que cuenta. El peso diario se mueve con el agua y la comida.' })));
}

// ------------------------------------------------------------------ medidas
function pintarMedidas(cont) {
  const m = estado.medidas;
  const um = unidadMedida(estado.ajustes);
  const sitios = m.sitios.slice().sort((a, b) => a.orden - b.orden);

  if (sitioAbierto) { pintarSitio(cont, sitios.find(s => s.id === sitioAbierto)); return; }

  cont.append(el('button', { clase: 'save', texto: '+ Apuntar medidas de hoy',
    onclick: () => nuevaMedicion(cont) }));

  if (!m.registros.length) {
    cont.append(el('div', { clase: 'card' },
      el('p', { clase: 'muted', texto: 'Sin mediciones todavía. Con dos ya se ve una línea. Abajo puedes ajustar qué zonas quieres medir antes de empezar.' })));
  }

  // resumen por sitio, con lo que ha cambiado desde la primera vez
  const caja = el('div', { clase: 'card' }, el('span', { clase: 'label', texto: 'Por zona' }));
  const orden = m.registros.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  for (const s of sitios) {
    const conDato = orden.filter(r => valorSitio(r, s.id) !== null);
    if (!conDato.length) continue;
    const ini = valorSitio(conDato[0], s.id), fin = valorSitio(conDato.at(-1), s.id);
    const d = fin - ini;
    caja.append(el('div', { clase: 'hrow tap', onclick: () => { sitioAbierto = s.id; pintarCuerpo(cont); } },
      el('div', { clase: 'hrow-txt' },
        el('div', { clase: 'hd', texto: s.nombre }),
        el('div', { clase: 'hs', texto: `${conDato.length} mediciones · desde ${fechaCorta(conDato[0].fecha)}` })),
      el('div', { clase: 'hw', texto: mostrarMedida(fin, estado.ajustes.unidad) + um }),
      el('span', { clase: 'delta' + (d === 0 ? '' : d > 0 ? ' sube' : ' baja'),
        texto: conDato.length > 1 ? (d > 0 ? '+' : '') + mostrarMedida(d, estado.ajustes.unidad) : '' }),
      icono('derecha', { clase: 'chevron', tam: 18 })));
  }
  // La tarjeta de resumen solo aparece cuando hay algo que resumir.
  if (caja.children.length > 1) cont.append(caja);

  // historial de mediciones
  const hist = el('div', { clase: 'card' }, el('span', { clase: 'label', texto: 'Mediciones' }));
  for (const r of m.registros.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1))) {
    const n = Object.keys(r.valores).length;
    hist.append(el('div', { clase: 'hrow tap', onclick: () => editarMedicion(cont, r) },
      el('div', { clase: 'hrow-txt' },
        el('div', { clase: 'hd', texto: r.fecha }),
        el('div', { clase: 'hs', texto: `${n} zona${n === 1 ? '' : 's'}${r.notas ? ' · ' + r.notas.slice(0, 40) : ''}` })),
      icono('editar', { clase: 'chevron', tam: 15 })));
  }
  if (m.registros.length) cont.append(hist);

  // Las zonas se pueden ajustar siempre, también antes de la primera medición:
  // decidir qué mides es lo primero que quieres hacer, no lo último.
  cont.append(el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Zonas' }),
    el('p', { clase: 'muted', texto: 'Las marcadas como "por lado" se apuntan izquierda y derecha por separado.' }),
    ...sitios.map(s => filaSitio(cont, s)),
    el('button', { clase: 'addbtn', texto: '+ Añadir zona', onclick: async () => {
      const n = await pedirTexto('Nueva zona', '', 'ej. Antebrazo');
      if (!n) return;
      actualizar(e => e.medidas.sitios.push({ id: nuevoId('st'), nombre: n, bilateral: false,
        orden: e.medidas.sitios.length }));
      pintarCuerpo(cont);
    } })));
}

function filaSitio(cont, s) {
  return el('div', { clase: 'sitio' },
    el('span', { clase: 'sitio-n', texto: s.nombre }),
    el('button', { clase: 'sitio-b' + (s.bilateral ? ' on' : ''), texto: 'por lado',
      onclick: () => { actualizar(() => { s.bilateral = !s.bilateral; }); pintarCuerpo(cont); } }),
    el('button', { clase: 'del sm', 'aria-label': `Quitar ${s.nombre}`, onclick: async () => {
      const usada = estado.medidas.registros.some(r => r.valores[s.id]);
      if (!await confirmar(`¿Quitar ${s.nombre}?`,
        usada ? 'Las mediciones que ya tiene se borran con ella.' : '', { ok: 'Quitar', peligro: true })) return;
      actualizar(e => {
        e.medidas.sitios = e.medidas.sitios.filter(x => x.id !== s.id);
        for (const r of e.medidas.registros) delete r.valores[s.id];
      });
      pintarCuerpo(cont);
    } }, icono('cerrar', { tam: 15 })));
}

// Formulario de medición. Se abre con los últimos valores como marcador, para
// que apuntar sea corregir lo que cambió y no teclearlo todo otra vez.
function nuevaMedicion(cont) {
  const hoy = hoyISO();
  const existe = estado.medidas.registros.find(r => r.fecha === hoy);
  if (existe) return editarMedicion(cont, existe);
  const r = { id: nuevoId('me'), fecha: hoy, valores: {}, notas: '', fotos: [] };
  editarMedicion(cont, r, true);
}

function editarMedicion(cont, reg, esNueva = false) {
  const um = unidadMedida(estado.ajustes);
  const u = estado.ajustes.unidad;
  const sitios = estado.medidas.sitios.slice().sort((a, b) => a.orden - b.orden);
  const previo = estado.medidas.registros
    .filter(r => r.id !== reg.id && r.fecha <= reg.fecha)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];

  const copia = JSON.parse(JSON.stringify(reg));

  vaciar(cont);
  cont.append(el('div', { clase: 'barra-vuelta' },
    el('button', { clase: 'btn-volver', onclick: () => pintarCuerpo(cont) },
      icono('izquierda', { tam: 15 }), 'Medidas')));
  cont.append(el('h2', { clase: 'titulo-sec', texto: esNueva ? 'Nueva medición' : 'Medición' }));

  const fecha = el('input', { type: 'date', value: copia.fecha });
  fecha.addEventListener('change', () => { copia.fecha = fecha.value || hoyISO(); });
  cont.append(el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: 'Fecha' }), fecha));

  const caja = el('div', { clase: 'card' }, el('span', { clase: 'label', texto: `Medidas (${um})` }));
  for (const s of sitios) {
    const ref = previo ? valorSitio(previo, s.id) : null;
    const marcador = ref !== null ? mostrarMedida(ref, u) : um;

    const campo = (lado) => {
      const actual = copia.valores[s.id] ?? {};
      const v = lado ? actual[lado] : actual.v;
      const inp = el('input', { inputmode: 'decimal', value: mostrarMedida(v, u), placeholder: marcador,
        'aria-label': `${s.nombre}${lado ? ' ' + lado : ''}` });
      inp.addEventListener('input', () => {
        const n = leerMedida(inp.value, u);
        copia.valores[s.id] ??= {};
        if (lado) copia.valores[s.id][lado] = n; else copia.valores[s.id].v = n;
        const vv = copia.valores[s.id];
        if (vv.v == null && vv.izq == null && vv.der == null) delete copia.valores[s.id];
      });
      return inp;
    };

    caja.append(el('div', { clase: 'med-fila' },
      el('span', { clase: 'med-n' }, s.nombre,
        ref !== null ? el('span', { clase: 'med-ref', texto: `antes ${mostrarMedida(ref, u)}` }) : null),
      s.bilateral
        ? el('div', { clase: 'med-lados' },
            el('label', {}, el('span', { texto: 'izq' }), campo('izq')),
            el('label', {}, el('span', { texto: 'der' }), campo('der')))
        : campo(null)));
  }
  cont.append(caja);

  const notas = el('textarea', { placeholder: 'ej. medido en ayunas, sin bombear' });
  notas.value = copia.notas ?? '';
  notas.addEventListener('input', () => { copia.notas = notas.value; });
  cont.append(el('div', { clase: 'card' }, el('span', { clase: 'label', texto: 'Notas' }), notas));

  cont.append(el('button', { clase: 'save', texto: 'Guardar medición', onclick: () => {
    if (!Object.keys(copia.valores).length) return aviso('No has apuntado ninguna medida');
    actualizar(e => {
      e.medidas.registros = e.medidas.registros.filter(x => x.id !== copia.id && x.fecha !== copia.fecha);
      e.medidas.registros.push(copia);
      e.medidas.registros.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    });
    aviso('Medición guardada', 'ok');
    pintarCuerpo(cont);
  } }));

  if (!esNueva) {
    cont.append(el('button', { clase: 'addbtn peligro', texto: 'Borrar esta medición', onclick: async () => {
      if (!await confirmar('¿Borrar la medición?', fechaCorta(reg.fecha), { ok: 'Borrar', peligro: true })) return;
      actualizar(e => { e.medidas.registros = e.medidas.registros.filter(x => x.id !== reg.id); });
      pintarCuerpo(cont);
    } }));
  }
}

// Evolución de una zona
function pintarSitio(cont, s) {
  if (!s) { sitioAbierto = null; return pintarCuerpo(cont); }
  const u = estado.ajustes.unidad;
  const um = unidadMedida(estado.ajustes);

  cont.append(el('div', { clase: 'barra-vuelta' },
    el('button', { clase: 'btn-volver', onclick: () => { sitioAbierto = null; pintarCuerpo(cont); } },
      icono('izquierda', { tam: 15 }), 'Medidas'),
    el('button', { clase: 'btn-txt', texto: verTabla ? 'Ver gráfico' : 'Ver tabla',
      onclick: () => { verTabla = !verTabla; pintarCuerpo(cont); } })));
  cont.append(el('h2', { clase: 'titulo-sec', texto: s.nombre }));

  const regs = estado.medidas.registros.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const series = s.bilateral
    ? [
        { nombre: 'Izquierda', color: SERIES[0], puntos: puntosLado(regs, s.id, 'izq', u) },
        { nombre: 'Derecha', color: SERIES[1], puntos: puntosLado(regs, s.id, 'der', u) },
      ].filter(x => x.puntos.length)
    : [{ nombre: s.nombre, color: SERIES[0], puntos: regs
        .filter(r => valorSitio(r, s.id) !== null)
        .map(r => ({ fecha: r.fecha, valor: Number(mostrarMedida(valorSitio(r, s.id), u)),
          extra: r.notas || undefined })) }];

  const caja = el('div', { clase: 'card' },
    el('span', { clase: 'label', texto: `${s.nombre} (${um})` }));
  if (verTabla) caja.append(el('div', { clase: 'tabla-scroll' }, tabla(series, um)));
  else {
    caja.append(linea(series, { alto: 180, unidad: um }));
    if (series.length > 1) {
      const leyenda = el('div', { clase: 'g-leyenda' });
      for (const x of series) leyenda.append(el('span', { clase: 'g-lg' },
        el('i', { estilo: { background: x.color } }), x.nombre));
      caja.append(leyenda);
    }
  }
  cont.append(caja);
}

const puntosLado = (regs, sitioId, lado, u) => regs
  .filter(r => r.valores?.[sitioId]?.[lado] != null)
  .map(r => ({ fecha: r.fecha, valor: Number(mostrarMedida(r.valores[sitioId][lado], u)) }));

// -------------------------------------------------------------------- fotos
function pintarFotos(cont) {
  const conFotos = estado.medidas.registros
    .filter(r => r.fotos?.length)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const entrada = el('input', { type: 'file', accept: 'image/*', multiple: true,
    estilo: { display: 'none' } });
  entrada.addEventListener('change', async () => {
    const archivos = [...(entrada.files ?? [])];
    entrada.value = '';
    if (!archivos.length) return;
    const hoy = hoyISO();
    aviso('Guardando…');
    const ids = [];
    for (const a of archivos) {
      try { ids.push((await guardarFoto(a)).id); } catch { /* archivo no válido */ }
    }
    if (!ids.length) return aviso('No se pudo guardar ninguna');
    actualizar(e => {
      let r = e.medidas.registros.find(x => x.fecha === hoy);
      if (!r) {
        r = { id: nuevoId('me'), fecha: hoy, valores: {}, notas: '', fotos: [] };
        e.medidas.registros.unshift(r);
      }
      r.fotos = [...(r.fotos ?? []), ...ids];
    });
    aviso(`${ids.length} foto${ids.length === 1 ? '' : 's'} guardada${ids.length === 1 ? '' : 's'}`, 'ok');
    pintarCuerpo(cont);
  });

  cont.append(el('label', { clase: 'save', estilo: { display: 'block', textAlign: 'center', cursor: 'pointer' } },
    '+ Añadir fotos de hoy', entrada));

  cont.append(el('div', { clase: 'card' },
    el('p', { clase: 'muted', texto: 'Se quedan en este dispositivo y se reducen a 1000 px antes de guardarlas. Van dentro de la copia de seguridad, que por eso pesará más.' })));

  if (!conFotos.length) {
    cont.append(el('div', { clase: 'card' },
      el('p', { clase: 'muted', texto: 'Sin fotos todavía. La gracia está en comparar dos separadas por semanas.' })));
    return;
  }

  for (const r of conFotos) {
    const rejilla = el('div', { clase: 'fotos-rej' });
    for (const id of r.fotos) rejilla.append(celdaFoto(cont, r, id));
    cont.append(el('div', { clase: 'card' },
      el('div', { clase: 'card-top' },
        el('span', { clase: 'label', texto: r.fecha }),
        el('span', { clase: 'hs', texto: `${r.fotos.length} foto${r.fotos.length === 1 ? '' : 's'}` })),
      rejilla));
  }
}

function celdaFoto(cont, reg, id) {
  const c = el('div', { clase: 'foto' });
  urlFoto(id).then(src => {
    if (!src) { c.append(el('span', { clase: 'muted', texto: 'no está' })); return; }
    c.append(el('img', { src, alt: `Foto de ${reg.fecha}`, loading: 'lazy',
      onclick: () => ampliar(src, reg.fecha) }));
    c.append(el('button', { clase: 'foto-x', 'aria-label': 'Borrar foto', onclick: async () => {
      if (!await confirmar('¿Borrar la foto?', '', { ok: 'Borrar', peligro: true })) return;
      await borrarFoto(id);
      actualizar(e => {
        const r = e.medidas.registros.find(x => x.id === reg.id);
        if (r) r.fotos = r.fotos.filter(f => f !== id);
        e.medidas.registros = e.medidas.registros
          .filter(x => x.fotos?.length || Object.keys(x.valores).length);
      });
      pintarCuerpo(cont);
    } }, icono('cerrar', { tam: 15 })));
  });
  return c;
}

function ampliar(src, fecha) {
  const fondo = el('div', { clase: 'modal-fondo foto-full', onclick: () => fondo.remove() },
    el('img', { src, alt: `Foto de ${fecha}` }),
    el('span', { clase: 'foto-fecha', texto: fecha }));
  document.body.append(fondo);
}
