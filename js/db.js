// Almacenamiento. IndexedDB con almacenamiento persistente solicitado, y
// localStorage solo como red de seguridad si IndexedDB no está disponible.
//
// El motivo de no usar localStorage como almacén principal: Safari lo borra
// tras siete días sin abrir la web. IndexedDB con storage.persist() concedido
// sobrevive a esa limpieza.

const DB_NAME = 'cuaderno-entreno';
const DB_VERSION = 1;
const STORE = 'kv';

let _db = null;

function abrir() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => { _db = req.result; res(_db); };
    req.onerror = () => rej(req.error);
  });
}

function tx(modo, fn) {
  return abrir().then(db => new Promise((res, rej) => {
    const t = db.transaction(STORE, modo);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

// -------------------------------------------------------------- red de apoyo
const respaldo = {
  get(k) { try { const v = localStorage.getItem('ce_' + k); return v ? JSON.parse(v) : undefined; } catch { return undefined; } },
  set(k, v) { try { localStorage.setItem('ce_' + k, JSON.stringify(v)); } catch { /* lleno o bloqueado */ } },
  del(k) { try { localStorage.removeItem('ce_' + k); } catch { /* ignorar */ } },
};

let hayIndexedDB = typeof indexedDB !== 'undefined';

export const db = {
  async get(clave, porDefecto = undefined) {
    if (hayIndexedDB) {
      try {
        const v = await tx('readonly', s => s.get(clave));
        if (v !== undefined) return v;
      } catch { hayIndexedDB = false; }
    }
    const v = respaldo.get(clave);
    return v === undefined ? porDefecto : v;
  },

  async set(clave, valor) {
    if (hayIndexedDB) {
      try { await tx('readwrite', s => s.put(valor, clave)); return true; }
      catch { hayIndexedDB = false; }
    }
    respaldo.set(clave, valor);
    return false;
  },

  // Listar claves hace falta para limpiar las imágenes guardadas de una vez.
  async claves() {
    if (hayIndexedDB) {
      try { return await tx('readonly', s => s.getAllKeys()) ?? []; }
      catch { hayIndexedDB = false; }
    }
    return [];
  },

  async del(clave) {
    if (hayIndexedDB) { try { await tx('readwrite', s => s.delete(clave)); } catch { /* ignorar */ } }
    respaldo.del(clave);
  },
};

// --------------------------------------------------------------- persistencia
// Pide al navegador que no desaloje estos datos. Chrome y Firefox lo conceden
// si la app está instalada o hay interacción suficiente. Safari lo ignora en
// muchos casos, por eso además existe el recordatorio de copia de seguridad.
export async function pedirPersistencia() {
  if (!navigator.storage?.persist) return { soportado: false, concedido: false };
  try {
    const yaEs = await navigator.storage.persisted();
    const concedido = yaEs || await navigator.storage.persist();
    return { soportado: true, concedido };
  } catch {
    return { soportado: false, concedido: false };
  }
}

export async function espacioUsado() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usado: usage ?? 0, cuota: quota ?? 0 };
  } catch { return null; }
}
