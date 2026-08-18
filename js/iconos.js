// Iconos. Van incrustados aquí, no enlazados a un CDN, porque la app tiene que
// funcionar sin cobertura. Son 27 trazados, 3 KB en total.
//
// Vienen de Lucide (lucide.dev), licencia ISC. Todos comparten la misma rejilla
// de 24 px y el mismo grosor de trazo, que es lo que hace que se lean como un
// conjunto y no como iconos sueltos pegados.
//
// El color lo hereda del texto (`currentColor`), así que un icono dentro de un
// botón deshabilitado o resaltado se tiñe solo.

const TRAZOS = {
  'ajustes': `<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/> <circle cx="12" cy="12" r="3"/>`,
  'aviso': `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/> <path d="M12 9v4"/> <path d="M12 17h.01"/>`,
  'bajada': `<path d="m15 10 5 5-5 5"/> <path d="M4 4v7a4 4 0 0 0 4 4h12"/>`,
  'bajar': `<path d="m6 9 6 6 6-6"/>`,
  'buscar': `<path d="m21 21-4.34-4.34"/> <circle cx="11" cy="11" r="8"/>`,
  'cerrar': `<path d="M18 6 6 18"/> <path d="m6 6 12 12"/>`,
  'copiar': `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
  'crono': `<line x1="10" x2="14" y1="2" y2="2"/> <line x1="12" x2="15" y1="14" y2="11"/> <circle cx="12" cy="14" r="8"/>`,
  'derecha': `<path d="m9 18 6-6-6-6"/>`,
  'descargar': `<path d="M12 15V3"/> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/> <path d="m7 10 5 5 5-5"/>`,
  'editar': `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/> <path d="m15 5 4 4"/>`,
  'foto': `<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/> <circle cx="12" cy="13" r="3"/>`,
  'fotos': `<path d="m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16"/> <path d="M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2"/> <circle cx="13" cy="7" r="1" fill="currentColor"/> <rect x="8" y="2" width="14" height="14" rx="2"/>`,
  'hecho': `<path d="M18 6 7 17l-5-5"/> <path d="m22 10-7.5 7.5L13 16"/>`,
  'historial': `<path d="M8 2v3"/> <path d="M16 2v3"/> <rect x="3" y="3" width="18" height="18" rx="2"/> <path d="M3 9h18"/> <path d="M8 13h.01"/> <path d="M12 13h.01"/> <path d="M16 13h.01"/> <path d="M8 17h.01"/> <path d="M12 17h.01"/> <path d="M16 17h.01"/>`,
  'hoy': `<path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/> <path d="m2.5 21.5 1.4-1.4"/> <path d="m20.1 3.9 1.4-1.4"/> <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/> <path d="m9.6 14.4 4.8-4.8"/>`,
  'iniciar': `<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>`,
  'izquierda': `<path d="m15 18-6-6 6-6"/>`,
  'mas': `<path d="M5 12h14"/> <path d="M12 5v14"/>`,
  'mas-opciones': `<circle cx="12" cy="12" r="1"/> <circle cx="19" cy="12" r="1"/> <circle cx="5" cy="12" r="1"/>`,
  'medida': `<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/> <path d="m14.5 12.5 2-2"/> <path d="m11.5 9.5 2-2"/> <path d="m8.5 6.5 2-2"/> <path d="m17.5 15.5 2-2"/>`,
  'ok': `<path d="M20 6 9 17l-5-5"/>`,
  'progreso': `<path d="M16 7h6v6"/> <path d="m22 7-8.5 8.5-5-5L2 17"/>`,
  'restaurar': `<path d="M12 3v12"/> <path d="m17 8-5-5-5 5"/> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>`,
  'rutinas': `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/> <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/> <path d="M12 11h4"/> <path d="M12 16h4"/> <path d="M8 11h.01"/> <path d="M8 16h.01"/>`,
  'subir': `<path d="m18 15-6-6-6 6"/>`,
  'unir': `<path d="M9 17H7A5 5 0 0 1 7 7h2"/> <path d="M15 7h2a5 5 0 1 1 0 10h-2"/> <line x1="8" x2="16" y1="12" y2="12"/>`
};

const NS = 'http://www.w3.org/2000/svg';

// Devuelve un <svg> listo para meter en cualquier sitio.
//   icono('crono')                     tamaño por defecto (18)
//   icono('cerrar', { tam: 22 })
//   icono('hoy', { clase: 'ic-tab' })
export function icono(nombre, { tam = 18, clase = '', grosor = 2 } = {}) {
  const d = TRAZOS[nombre];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', tam);
  svg.setAttribute('height', tam);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', grosor);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ic ' + clase);
  if (d) svg.innerHTML = d;      // trazados nuestros, no texto de nadie
  return svg;
}

export const hayIcono = n => n in TRAZOS;
