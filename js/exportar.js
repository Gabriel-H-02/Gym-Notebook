// Exportar el historial en formatos que sirvan fuera de la app.
//
// Cuatro salidas para tres usos distintos:
//   · resumen  · lo que pegas en un chat para que alguien lo lea
//   · texto    · el detalle completo, para guardar o imprimir
//   · CSV entrenos · una fila por SERIE, que es lo que quiere una tabla dinámica
//   · CSV diario   · una fila por DÍA, con peso, macros y descanso
//
// Los dos CSV van aparte a propósito. Mezclarlos obligaría a repetir el peso
// corporal en cada serie del día, y entonces cualquier suma en Excel saldría
// mal sin que se note.

import { estado } from './store.js';
import { porId, variante, mostrarPeso, textoIntensidad, textoSerie, bloques, hoyISO } from './model.js';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dia = iso => { const d = new Date(iso + 'T00:00:00'); return `${d.getDate()} ${MES[d.getMonth()]}`; };

// ------------------------------------------------------------------- rangos
export const RANGOS = [
  { id: 'hoy', nombre: 'Solo hoy' },
  { id: '7', nombre: 'Última semana' },
  { id: '28', nombre: 'Últimas 4 semanas' },
  { id: 'todo', nombre: 'Todo el historial' },
  { id: 'rango', nombre: 'Entre dos fechas' },
];

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Devuelve TODOS los días del tramo, tenga cada uno datos o no.
//
// Antes solo devolvía los días con algo apuntado, y eso dejaba huecos: un
// sábado sin registrar sencillamente no aparecía, así que el CSV saltaba del
// viernes al domingo. En una hoja de cálculo eso se ve como una semana de seis
// días, y cualquier gráfico sale con la línea rota sin avisar.
export function fechasDe(rango, desde = null, hasta = null) {
  const conDatos = [...new Set([...Object.keys(estado.diario), ...estado.sesiones.map(s => s.fecha)])].sort();
  if (!conDatos.length) return [];

  const hoy = hoyISO();
  const primero = conDatos[0];
  let min, max;

  if (rango === 'hoy') { min = max = hoy; }
  else if (rango === 'todo') { min = primero; max = hoy; }
  else if (rango === 'rango') { min = desde || primero; max = hasta || hoy; }
  else {
    const t = new Date(hoy + 'T00:00:00');
    t.setDate(t.getDate() - (Number(rango) - 1));
    min = iso(t); max = hoy;
  }

  // Ni antes de que empezaras a apuntar, ni días que aún no han llegado.
  if (min < primero) min = primero;
  if (max > hoy) max = hoy;
  if (min > max) return [];

  const salida = [];
  for (let d = new Date(min + 'T00:00:00'); iso(d) <= max; d.setDate(d.getDate() + 1)) {
    salida.push(iso(d));
  }
  return salida;
}

// -------------------------------------------------------- resumen para pegar
// El formato del cuaderno anterior, que se perdió al reescribir la app. Es el
// que pegas en un chat: compacto, sin adornos y legible de un vistazo.
export function resumen(fechas) {
  const u = estado.ajustes.unidad;
  const L = [];
  const pesos = fechas.map(f => estado.diario[f]?.pesoKg).filter(Boolean);

  L.push('CHECK-IN' + (fechas.length ? ` · ${dia(fechas[0])} a ${dia(fechas.at(-1))}` : ''), '');

  L.push('PESO');
  for (const f of fechas) {
    const p = estado.diario[f]?.pesoKg;
    L.push(`- ${f}: ${p ? mostrarPeso(p, u) + ' ' + u : '—'}`);
  }
  if (pesos.length) {
    const m = pesos.reduce((a, b) => a + b, 0) / pesos.length;
    L.push(`- Media: ${mostrarPeso(m, u)} ${u}`);
    if (pesos.length > 1) L.push(`- Variación: ${mostrarPeso(pesos.at(-1) - pesos[0], u)} ${u}`);
  }

  L.push('', 'MACROS Y ADHERENCIA');
  for (const f of fechas) {
    const d = estado.diario[f];
    if (!d) { L.push(`- ${f}: sin registrar`); continue; }
    L.push(`- ${f}: ${d.kcal ?? '?'} kcal · P ${d.protG ?? '?'} C ${d.carbG ?? '?'} G ${d.grasaG ?? '?'}`
      + ` · sueño ${d.suenoH ?? '?'}h · pasos ${d.pasos ?? '?'}`
      + ` · hambre ${d.hambre ?? '?'} energía ${d.energia ?? '?'}`);
  }

  L.push('', 'ENTRENOS');
  for (const f of fechas) {
    const s = estado.sesiones.find(x => x.fecha === f);
    if (!s) { if (estado.diario[f]?.descanso) L.push(`- ${f}: descanso`); continue; }
    const bl = bloques(s.entradas);
    const partes = s.entradas.map(en => {
      const ej = porId(estado.ejercicios, en.exId);
      const va = variante(ej, en.vaId);
      const g = bl.get(en.id);
      const series = en.sets.map(x => textoSerie(x, u, mostrarPeso)
        + (x.tipo === 'calentamiento' ? '(c)' : '')
        + (textoIntensidad(x.intensidad) ? '/' + textoIntensidad(x.intensidad) : '')).join(', ');
      return `${g ? g.letra + g.indice + ' ' : ''}${ej?.nombre ?? '?'}${va ? ' (' + va.nombre + ')' : ''} ${series}`;
    });
    L.push(`- ${f} (${s.rutinaNombre || 'libre'}): ${partes.join(' | ')}`);
  }

  const notas = fechas.filter(f => estado.diario[f]?.notas);
  if (notas.length) {
    L.push('', 'NOTAS');
    for (const f of notas) L.push(`- ${f}: ${estado.diario[f].notas}`);
  }

  const med = (estado.medidas?.registros ?? []).filter(r => fechas.includes(r.fecha));
  if (med.length) {
    L.push('', 'MEDIDAS');
    for (const r of med) {
      const partes = estado.medidas.sitios
        .filter(si => r.valores[si.id])
        .map(si => {
          const v = r.valores[si.id];
          return v.izq != null || v.der != null
            ? `${si.nombre} ${v.izq ?? '?'}/${v.der ?? '?'}`
            : `${si.nombre} ${v.v}`;
        });
      L.push(`- ${r.fecha}: ${partes.join(' · ')} cm`);
    }
  }

  return L.join('\n');
}

// ------------------------------------------------------------- texto completo
export function textoCompleto(fechas) {
  const u = estado.ajustes.unidad;
  const L = ['CUADERNO ENTRENO', `Exportado el ${hoyISO()}`,
    fechas.length ? `${fechas.length} días · de ${fechas[0]} a ${fechas.at(-1)}` : 'Sin datos', ''];

  for (const f of fechas) {
    const d = estado.diario[f];
    const s = estado.sesiones.find(x => x.fecha === f);
    if (!d && !s) { L.push('─'.repeat(46), `${f}  Sin registrar`, ''); continue; }
    L.push('─'.repeat(46), `${f}  ${s ? (s.rutinaNombre || 'Entreno') : d?.descanso ? 'Descanso' : 'Sin entreno'}`);

    if (d) {
      const linea = [
        d.pesoKg ? `Peso ${mostrarPeso(d.pesoKg, u)} ${u}` : null,
        d.kcal ? `${d.kcal} kcal` : null,
        d.protG ? `P${d.protG}` : null, d.carbG ? `C${d.carbG}` : null, d.grasaG ? `G${d.grasaG}` : null,
        d.suenoH ? `Sueño ${d.suenoH}h` : null, d.pasos ? `${d.pasos} pasos` : null,
      ].filter(Boolean).join(' · ');
      if (linea) L.push('  ' + linea);
    }

    if (s) {
      const bl = bloques(s.entradas);
      for (const en of s.entradas) {
        const ej = porId(estado.ejercicios, en.exId);
        const va = variante(ej, en.vaId);
        const g = bl.get(en.id);
        L.push(`  ${g ? g.letra + g.indice : '·'} ${ej?.nombre ?? '?'}${va ? ' · ' + va.nombre : ''}`);
        en.sets.forEach((x, i) => {
          L.push(`      S${i + 1}  ${textoSerie(x, u, mostrarPeso)}`
            + (textoIntensidad(x.intensidad) ? '  ' + textoIntensidad(x.intensidad) : '')
            + (x.tipo === 'calentamiento' ? '  (calentamiento)' : ''));
        });
      }
    }
    if (d?.notas) L.push('  Notas: ' + d.notas.replace(/\n/g, '\n         '));
    L.push('');
  }
  return L.join('\n');
}

// --------------------------------------------------------------------- CSV
// Excel en español espera punto y coma como separador y coma decimal. Con
// comas y puntos, al abrirlo mete todo en una columna. La línea `sep=;` se la
// entiende Excel, y el BOM del principio evita que se rompan los acentos.
const BOM = '﻿';
const esc = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const num = v => (v === null || v === undefined ? '' : String(v).replace('.', ','));
const fila = xs => xs.map(esc).join(';');

export function csvEntrenos(fechas) {
  const u = estado.ajustes.unidad;
  const L = ['sep=;', fila(['Fecha', 'Rutina', 'Bloque', 'Ejercicio', 'Variante', 'Serie',
    'Tipo', `Peso (${u})`, 'Reps', 'Intensidad', 'Bajadas', 'Grupo muscular'])];

  for (const f of fechas) {
    const s = estado.sesiones.find(x => x.fecha === f);
    if (!s) continue;
    const bl = bloques(s.entradas);
    for (const en of s.entradas) {
      const ej = porId(estado.ejercicios, en.exId);
      const va = variante(ej, en.vaId);
      const g = bl.get(en.id);
      en.sets.forEach((x, i) => {
        L.push(fila([
          f, s.rutinaNombre || '', g ? `${g.letra}${g.indice}` : '',
          ej?.nombre ?? '', va?.nombre ?? '', i + 1,
          x.tipo === 'calentamiento' ? 'Calentamiento' : 'Efectiva',
          num(mostrarPeso(x.pesoKg, u)), num(x.reps),
          textoIntensidad(x.intensidad),
          (x.drops ?? []).map(d => `${mostrarPeso(d.pesoKg, u)}x${d.reps ?? ''}`).join(' '),
          ej?.grupo ?? '',
        ]));
      });
    }
  }
  return BOM + L.join('\r\n');
}

export function csvDiario(fechas) {
  const u = estado.ajustes.unidad;
  const L = ['sep=;', fila(['Fecha', 'Día', `Peso (${u})`, 'Kcal', 'Proteína (g)', 'Carbos (g)',
    'Grasa (g)', 'Sueño (h)', 'Pasos', 'Hambre', 'Energía', 'Entreno', 'Notas'])];
  const DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  for (const f of fechas) {
    const d = estado.diario[f];
    const s = estado.sesiones.find(x => x.fecha === f);
    L.push(fila([
      f, DIA[new Date(f + 'T00:00:00').getDay()],
      num(mostrarPeso(d?.pesoKg, u)), num(d?.kcal), num(d?.protG), num(d?.carbG), num(d?.grasaG),
      num(d?.suenoH), num(d?.pasos), num(d?.hambre), num(d?.energia),
      s ? (s.rutinaNombre || 'Entreno') : d?.descanso ? 'Descanso' : d ? 'Sin entreno' : 'Sin registrar',
      (d?.notas ?? '').replace(/\n/g, ' '),
    ]));
  }
  return BOM + L.join('\r\n');
}

export const FORMATOS = [
  { id: 'resumen', nombre: 'Resumen para pegar', ext: 'txt', tipo: 'text/plain',
    q: 'Compacto, para mandárselo a alguien por chat.', gen: resumen, texto: true },
  { id: 'texto', nombre: 'Texto completo', ext: 'txt', tipo: 'text/plain',
    q: 'Todo el detalle, serie a serie.', gen: textoCompleto, texto: true },
  { id: 'csv-entrenos', nombre: 'Entrenos en CSV', ext: 'csv', tipo: 'text/csv',
    q: 'Una fila por serie. Para tablas dinámicas en Excel.', gen: csvEntrenos },
  { id: 'csv-diario', nombre: 'Diario en CSV', ext: 'csv', tipo: 'text/csv',
    q: 'Una fila por día, con peso, macros y sueño.', gen: csvDiario },
];
