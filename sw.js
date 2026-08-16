// Service worker. El objetivo es uno solo: que la app abra y funcione en el
// sótano de un gimnasio, sin cobertura.
//
// Estrategia: la envoltura (HTML, CSS, JS, fuentes) se sirve desde caché y se
// refresca por detrás. Los datos no pasan por aquí, viven en IndexedDB.

const VERSION = 'v5';
const CACHE = 'cuaderno-entreno-' + VERSION;

const ESENCIALES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/main.js',
  './js/db.js',
  './js/model.js',
  './js/store.js',
  './js/ui.js',
  './js/timer.js',
  './js/media.js',
  './js/catalogo.js',
  './js/fotos.js',
  './datos/catalogo.json',
  './js/grafico.js',
  './js/views/hoy.js',
  './js/views/rutinas.js',
  './js/views/historial.js',
  './js/views/progreso.js',
  './js/views/cuerpo.js',
  './js/views/ajustes.js',
  './js/views/selector.js',
  './fonts/anton.woff2',
  './fonts/sora.woff2',
  './fonts/spacemono.woff2',
  './fonts/spacemono-bold.woff2',
  './icons/icon.svg',
];

// Interruptor de seguridad. Si alguien tiene este service worker registrado en
// local (de una sesión anterior, por ejemplo), se desactiva y borra su caché.
// Sin esto serviría archivos viejos y la página nunca llegaría a ejecutar el
// código que lo desregistra: el propio worker se lo impediría.
// El worker no ve la URL de la página, solo la suya, así que la marca de
// "quiero el offline aunque esté en local" viaja en su propia dirección:
// la página lo registra como ./sw.js?sw=1
const LOCAL = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(self.location.hostname);
const FORZADO = new URLSearchParams(self.location.search).has('sw');
const EN_LOCAL = LOCAL && !FORZADO;

if (EN_LOCAL) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', e => e.waitUntil((async () => {
    await caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' });
    for (const c of cs) c.navigate(c.url);
  })()));
  self.addEventListener('fetch', () => { /* no interceptar nada en local */ });
}

self.addEventListener('install', e => {
  if (EN_LOCAL) return;
  e.waitUntil(
    caches.open(CACHE)
      // addAll falla entero si un archivo falla; así un icono que falte no
      // deja la app sin offline.
      .then(c => Promise.allSettled(ESENCIALES.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  if (EN_LOCAL) return;
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (EN_LOCAL) return;
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Navegación: caché primero para que abra al instante y sin red.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(c => c || fetch(req).catch(() => caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cacheado => {
      const red = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => cacheado);
      return cacheado || red;
    })
  );
});
