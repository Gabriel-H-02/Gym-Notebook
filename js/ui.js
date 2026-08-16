// Utilidades de interfaz. Nada de innerHTML con datos del usuario: todo el
// texto entra por textContent, así un nombre de ejercicio con un < no rompe
// nada ni ejecuta nada.

export function el(tag, props = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'clase') n.className = v;
    else if (k === 'texto') n.textContent = v;
    else if (k === 'estilo') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'datos') for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = dv;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) {
    if (h === null || h === undefined || h === false) continue;
    n.append(h instanceof Node ? h : document.createTextNode(String(h)));
  }
  return n;
}

export const vaciar = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

// ------------------------------------------------------------------- avisos
let tempAviso;
export function aviso(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + tipo;
  clearTimeout(tempAviso);
  tempAviso = setTimeout(() => { t.className = 'toast ' + tipo; }, 2200);
}

// ------------------------------------------------------------------ diálogos
// Sustituyen a confirm() y prompt(), que en una PWA quedan feos y en iOS
// bloquean la interfaz de forma rara.
export function confirmar(titulo, texto, { ok = 'Sí', peligro = false } = {}) {
  return new Promise(res => {
    const cerrar = v => { fondo.remove(); res(v); };
    const fondo = el('div', { clase: 'modal-fondo', onclick: e => { if (e.target === fondo) cerrar(false); } },
      el('div', { clase: 'modal' },
        el('h3', { texto: titulo }),
        texto ? el('p', { clase: 'muted', texto }) : null,
        el('div', { clase: 'modal-btns' },
          el('button', { clase: 'btn-sec', texto: 'Cancelar', onclick: () => cerrar(false) }),
          el('button', { clase: peligro ? 'btn-peligro' : 'btn-pri', texto: ok, onclick: () => cerrar(true) }))));
    document.body.append(fondo);
  });
}

export function pedirTexto(titulo, valor = '', marcador = '') {
  return new Promise(res => {
    const inp = el('input', { value: valor, placeholder: marcador, autocomplete: 'off' });
    const cerrar = v => { fondo.remove(); res(v); };
    const aceptar = () => cerrar(inp.value.trim() || null);
    const fondo = el('div', { clase: 'modal-fondo', onclick: e => { if (e.target === fondo) cerrar(null); } },
      el('div', { clase: 'modal' },
        el('h3', { texto: titulo }), inp,
        el('div', { clase: 'modal-btns' },
          el('button', { clase: 'btn-sec', texto: 'Cancelar', onclick: () => cerrar(null) }),
          el('button', { clase: 'btn-pri', texto: 'Guardar', onclick: aceptar }))));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') aceptar(); });
    document.body.append(fondo);
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
  });
}

// Hoja inferior, para listas largas como el buscador de ejercicios.
export function hoja(titulo, contenido) {
  const cerrar = () => fondo.remove();
  const cuerpo = el('div', { clase: 'hoja-cuerpo' });
  const fondo = el('div', { clase: 'modal-fondo hoja-fondo', onclick: e => { if (e.target === fondo) cerrar(); } },
    el('div', { clase: 'hoja' },
      el('div', { clase: 'hoja-top' },
        el('h3', { texto: titulo }),
        el('button', { clase: 'del', texto: '×', 'aria-label': 'Cerrar', onclick: cerrar })),
      cuerpo));
  document.body.append(fondo);
  contenido(cuerpo, cerrar);
  return cerrar;
}

// Descarga un archivo de verdad, en vez del textarea para copiar a mano.
export function descargar(nombre, texto, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = el('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; }
  catch { return false; }
}
