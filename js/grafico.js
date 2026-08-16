// Gráfico de línea en SVG, sin librerías.
//
// Los colores no son los de la interfaz. La lima #c8ff3d de la app es
// demasiado clara para usarla como serie: puesta junto a otras dos o tres, las
// marcas dejan de leerse como un conjunto. Estos cuatro son los mismos matices
// bajados a la banda de luminosidad que exige un gráfico (OKLCH L 0.48–0.67), y
// están comprobados para daltonismo deutan y tritan sobre el fondo #16181a.
//
// Detalle de montaje: el SVG lleva SOLO las líneas y la rejilla, y se estira
// libremente. Todo lo que es texto o marca redonda va en capas HTML colocadas
// por porcentaje. Si el texto viviera dentro del SVG estirado saldría
// deformado, y las etiquetas largas quedarían recortadas por el viewBox.

export const SERIES = ['#7ca214', '#6194d9', '#bf8700', '#e26275'];

const NS = 'http://www.w3.org/2000/svg';
const s = (t, a = {}) => {
  const n = document.createElementNS(NS, t);
  for (const [k, v] of Object.entries(a)) if (v !== null && v !== undefined) n.setAttribute(k, v);
  return n;
};
const h = (tag, clase, texto) => {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto !== undefined) n.textContent = texto;
  return n;
};

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dia = iso => new Date(iso + 'T00:00:00').getTime() / 86400000;
const redondo = v => Math.round(v * 10) / 10;

// Marcas del eje en números redondos. Un eje que pone 241.8 y 194.6 obliga a
// leer cifra a cifra; con 250, 200 y 150 el valor se estima de un vistazo.
function marcasBonitas(min, max, objetivo = 4) {
  const bruto = (max - min) / objetivo;
  const exp = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
  const paso = [1, 2, 2.5, 5, 10].map(m => m * exp).find(m => m >= bruto) ?? 10 * exp;
  const desde = Math.floor(min / paso) * paso;
  const marcas = [];
  for (let v = desde; v <= max + paso * 0.001; v += paso) {
    if (v >= min - paso * 0.001) marcas.push(Math.round(v * 1000) / 1000);
  }
  return marcas.length >= 2 ? marcas : [min, max];
}

// series: [{ nombre, color, puntos: [{ fecha, valor, extra }] }]
export function linea(series, { alto = 200, unidad = 'kg', alTocar = null } = {}) {
  const caja = h('div', 'grafico');
  const todos = series.flatMap(x => x.puntos);
  if (!todos.length) {
    caja.append(h('p', 'muted', 'Todavía no hay datos suficientes.'));
    return caja;
  }

  const xs = todos.map(p => dia(p.fecha));
  const ys = todos.map(p => p.valor);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const margen = (y1 - y0) * 0.15 || Math.max(y1 * 0.08, 1);
  y0 = Math.max(0, y0 - margen); y1 += margen;

  // Todo en 0..1. La colocación real la hace el CSS con porcentajes.
  const fx = v => (dia(v) - x0) / ((x1 - x0) || 1);
  const fy = v => 1 - (v - y0) / ((y1 - y0) || 1);

  caja.style.setProperty('--g-alto', alto + 'px');
  const zona = h('div', 'g-zona');

  // --- rejilla y eje vertical
  const svg = s('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none',
    class: 'g-svg', 'aria-hidden': 'true' });
  const ejeY = h('div', 'g-ejey');
  for (const v of marcasBonitas(y0, y1)) {
    const y = fy(v) * 100;
    svg.append(s('line', { x1: 0, x2: 100, y1: y, y2: y, stroke: '#2a2e33',
      'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
    const t = h('span', 'g-ytxt', String(redondo(v)));
    t.style.top = y + '%';
    ejeY.append(t);
  }

  // --- líneas: una por serie, sin unir entre ellas
  series.forEach((serie, i) => {
    const color = serie.color ?? SERIES[i % SERIES.length];
    const pts = serie.puntos.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    if (pts.length < 2) return;
    svg.append(s('path', {
      d: pts.map((p, k) => `${k ? 'L' : 'M'}${fx(p.fecha) * 100},${fy(p.valor) * 100}`).join(' '),
      fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round',
      'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke',
    }));
  });

  // --- marcadores y globo
  // Con muchos puntos los círculos tapan la línea y el gráfico deja de leerse.
  // A partir de 25 se encogen; la zona de toque sigue siendo la misma.
  const denso = todos.length > 25;
  const capa = h('div', 'g-puntos' + (denso ? ' denso' : ''));
  const globo = h('div', 'g-globo');

  const cerrar = () => {
    globo.classList.remove('on');
    capa.querySelectorAll('.g-pt').forEach(x => x.classList.remove('on'));
  };

  series.forEach((serie, i) => {
    const color = serie.color ?? SERIES[i % SERIES.length];
    for (const p of serie.puntos) {
      const b = h('button', 'g-pt');
      b.style.left = fx(p.fecha) * 100 + '%';
      b.style.top = fy(p.valor) * 100 + '%';
      b.style.setProperty('--c', color);
      b.setAttribute('aria-label', `${p.fecha}: ${p.valor} ${unidad}`);
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        cerrar();
        b.classList.add('on');
        globo.textContent = '';
        const f = new Date(p.fecha + 'T00:00:00');
        globo.append(h('b', null, `${p.valor} ${unidad}`),
          h('span', null, ` · ${f.getDate()} ${MES[f.getMonth()]}`));
        if (p.extra) globo.append(h('span', 'g-extra', p.extra));
        if (series.length > 1) globo.append(h('span', 'g-serie', serie.nombre));

        // El globo se ancla al borde más cercano si no cabe centrado.
        const x = fx(p.fecha);
        globo.classList.remove('izq', 'der');
        if (x < 0.3) globo.classList.add('izq');
        else if (x > 0.7) globo.classList.add('der');
        globo.style.left = x * 100 + '%';
        globo.style.top = fy(p.valor) * 100 + '%';
        globo.classList.add('on');
        alTocar?.(p);
      });
      capa.append(b);
    }
  });

  zona.append(svg, capa, globo);
  zona.addEventListener('click', cerrar);

  // --- eje de fechas: un rótulo por mes presente
  const ejeX = h('div', 'g-ejex');
  const meses = new Map();
  for (const p of todos.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1))) {
    const d = new Date(p.fecha + 'T00:00:00');
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    if (!meses.has(k)) meses.set(k, p.fecha);
  }
  for (const f of meses.values()) {
    const t = h('span', 'g-xtxt', MES[new Date(f + 'T00:00:00').getMonth()]);
    t.style.left = fx(f) * 100 + '%';
    ejeX.append(t);
  }

  caja.append(zona, ejeY, ejeX);
  caja.setAttribute('role', 'img');
  caja.setAttribute('aria-label',
    `Evolución del peso en ${unidad}, de ${redondo(Math.min(...ys))} a ${redondo(Math.max(...ys))}`);
  return caja;
}

// Tabla equivalente al gráfico. No es un extra: es la forma de leer los mismos
// datos sin depender de distinguir colores.
export function tabla(series, unidad) {
  const t = h('table', 'g-tabla');
  const cab = t.createTHead().insertRow();
  for (const c of ['Fecha', unidad, 'Detalle', series.length > 1 ? 'Variante' : null]) {
    if (c === null) continue;
    cab.append(h('th', null, c));
  }
  const cuerpo = t.createTBody();
  const filas = series.flatMap(x => x.puntos.map(p => ({ ...p, serie: x.nombre })))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  for (const f of filas) {
    const r = cuerpo.insertRow();
    r.insertCell().textContent = f.fecha;
    r.insertCell().textContent = f.valor;
    r.insertCell().textContent = f.extra ?? '';
    if (series.length > 1) r.insertCell().textContent = f.serie;
  }
  return t;
}
