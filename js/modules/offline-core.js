/* SisVentas offline-first preview.
   Encapsulado: sólo se activa con ?offline_preview=1 o sisventas.offline.preview=1. */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var enabled = params.get('offline_preview') === '1';
  try { enabled = enabled || localStorage.getItem('sisventas.offline.preview') === '1'; } catch (_) {}
  if (!enabled) return;

  var DB_NAME = 'sisventas-offline-v1';
  var DB_VERSION = 1;
  var ALLOWED = [
    'sisventas/clientes',
    'sisventas/presupuestos',
    'sisventas/ordenes_trabajo',
    'sisventas/reclamos',
    'sisventas/agenda'
  ];
  var BLOCKED = [
    'sisventas/ventas', 'sisventas/pagos', 'sisventas/caja',
    'sisventas/comprobantesVenta', 'sisventas/comprobantesCompra',
    'sisventas/gastos', 'sisventas/ctaemp', 'sisventas/hsextra_solicitudes'
  ];
  var dbPromise;
  var originals = {};
  var syncing = false;
  var sessionEpoch = 0;
  document.addEventListener('sisventas:session-ended', function () { sessionEpoch += 1; });

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('queue')) {
          var queue = db.createObjectStore('queue', { keyPath: 'id' });
          queue.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
    return dbPromise;
  }

  function store(mode, name, callback) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(name, mode);
        var result;
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Operación offline cancelada')); };
        result = callback(tx.objectStore(name));
      });
    });
  }

  function requestValue(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function userKey() {
    var authUid = window.fbAuth && window.fbAuth.currentUser && window.fbAuth.currentUser.uid;
    return String(authUid || window.currentUserUid || 'preauth');
  }

  function captureSession() {
    var uid = userKey(), user = window.fbAuth && window.fbAuth.currentUser, epoch = sessionEpoch;
    var role = window.currentRole, revision = window.PERMISOS_ROLES && window.PERMISOS_ROLES[role] && window.PERMISOS_ROLES[role].indiceRevision;
    return {uid:uid, valid:function () {
      return !!user && uid !== 'preauth' && uid === userKey() && user === (window.fbAuth && window.fbAuth.currentUser) && epoch === sessionEpoch && role === window.currentRole && revision === (window.PERMISOS_ROLES && window.PERMISOS_ROLES[role] && window.PERMISOS_ROLES[role].indiceRevision);
    }};
  }

  function pathOf(ref) {
    if (!ref) return '';
    try {
      if (ref._path && Array.isArray(ref._path.pieces_)) return ref._path.pieces_.join('/');
      if (ref._path && typeof ref._path.toString === 'function') return String(ref._path.toString()).replace(/^\//, '');
      var url = String(ref.toString ? ref.toString() : '');
      var marker = '.firebaseio.com/';
      if (url.indexOf(marker) >= 0) return decodeURIComponent(url.split(marker)[1].split('?')[0]).replace(/^\//, '');
    } catch (_) {}
    return '';
  }

  function matches(path, roots) {
    return roots.some(function (root) { return path === root || path.indexOf(root + '/') === 0; });
  }

  function isOffline() { return navigator.onLine === false; }

  function makeId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  function enqueue(type, path, value) {
    var session = captureSession();
    if (!session.valid()) return Promise.reject(offlineError(path));
    var item = {
      id: makeId(), type: type, path: path, value: value === undefined ? null : value,
      uid: session.uid, createdAt: Date.now(), attempts: 0, state: 'pending'
    };
    return store('readwrite', 'queue', function (s) { if (!session.valid()) throw offlineError(path); s.put(item); }).then(function () {
      if (!session.valid()) throw offlineError(path);
      document.dispatchEvent(new CustomEvent('sisventas:offline-queued', { detail: item }));
      return item;
    });
  }

  function getQueue(session) {
    session = session || captureSession();
    if (!session.valid()) return Promise.resolve([]);
    return openDb().then(function (db) {
      return requestValue(db.transaction('queue', 'readonly').objectStore('queue').getAll());
    }).then(function (items) {
      return (session.valid() ? items || [] : []).filter(function (item) { return item.uid === session.uid; })
        .sort(function (a, b) { return a.createdAt - b.createdAt; });
    });
  }

  function removeQueue(id) {
    return store('readwrite', 'queue', function (s) { s.delete(id); });
  }

  function saveCache(path, value, session) {
    session = session || captureSession();
    if (!session.valid()) return Promise.resolve();
    if (!matches(path, ALLOWED)) return Promise.resolve();
    return store('readwrite', 'cache', function (s) {
      if (!session.valid()) return;
      s.put({ key: session.uid + '|' + path, uid: session.uid, path: path, value: value, updatedAt: Date.now() });
    });
  }

  function readCache(path, session) {
    session = session || captureSession();
    if (!session.valid()) return Promise.resolve();
    return openDb().then(function (db) {
      if (!session.valid()) return;
      return requestValue(db.transaction('cache', 'readonly').objectStore('cache').get(session.uid + '|' + path));
    });
  }

  function fakeSnapshot(path, value) {
    return {
      key: path.split('/').pop() || null,
      ref: null,
      val: function () { return value; },
      exists: function () { return value !== null && value !== undefined; },
      forEach: function (callback) {
        if (!value || typeof value !== 'object') return false;
        return Object.keys(value).some(function (key) { return callback(fakeSnapshot(path + '/' + key, value[key])) === true; });
      }
    };
  }

  function offlineError(path) {
    var error = new Error('Esta operación requiere conexión por seguridad: ' + path);
    error.code = 'SISVENTAS_OFFLINE_BLOCKED';
    return error;
  }

  function queuedWrite(type, ref, value) {
    var path = pathOf(ref);
    if (!matches(path, ALLOWED)) return Promise.reject(offlineError(path || 'ruta desconocida'));
    return enqueue(type, path, value).then(function () { return undefined; });
  }

  function installWrappers() {
    if (window.__sisventasOfflineWrapped || !window.fbRef) return;
    window.__sisventasOfflineWrapped = true;
    ['fbSet', 'fbUpdate', 'fbRemove', 'fbPush', 'fbOnValue', 'fbRunTransaction'].forEach(function (name) {
      originals[name] = window[name];
    });

    window.fbSet = function (ref, value) {
      if (!isOffline()) return originals.fbSet(ref, value);
      return queuedWrite('set', ref, value);
    };
    window.fbUpdate = function (ref, value) {
      if (!isOffline()) return originals.fbUpdate(ref, value);
      return queuedWrite('update', ref, value);
    };
    window.fbRemove = function (ref) {
      if (!isOffline()) return originals.fbRemove(ref);
      return queuedWrite('remove', ref, null);
    };
    window.fbPush = function (ref, value) {
      var child = originals.fbPush(ref);
      if (arguments.length < 2) return child;
      if (!isOffline()) return originals.fbSet(child, value).then(function () { return child; });
      return queuedWrite('set', child, value).then(function () { return child; });
    };
    window.fbRunTransaction = function (ref, updater, options) {
      if (isOffline()) return Promise.reject(offlineError(pathOf(ref)));
      return originals.fbRunTransaction(ref, updater, options);
    };
    window.fbOnValue = function (ref, callback, cancelCallback, options) {
      var path = pathOf(ref), session = captureSession(), active = true, receivedLive = false;
      var errorCallback = typeof cancelCallback === 'function' ? cancelCallback : null;
      var listenOptions = errorCallback ? options : cancelCallback || options;
      function valid() { return active && session.valid(); }
      if (matches(path, ALLOWED)) {
        readCache(path, session).then(function (cached) {
          if (valid() && cached && (isOffline() || !receivedLive)) callback(fakeSnapshot(path, cached.value));
        }).catch(function () {});
      }
      var stop = originals.fbOnValue(ref, function (snapshot) {
        if (!valid()) return;
        receivedLive = true;
        if (matches(path, ALLOWED)) saveCache(path, snapshot.val(), session).catch(function () {});
        callback(snapshot);
      }, function (error) { if (!valid()) return; active = false; if (errorCallback) errorCallback(error); }, listenOptions);
      return function () { active = false; if (typeof stop === 'function') stop(); };
    };
  }

  async function sync() {
    if (syncing || isOffline() || !originals.fbSet) return;
    var session = captureSession();
    if (!session.valid()) return;
    syncing = true;
    try {
      var items = await getQueue(session);
      for (var i = 0; i < items.length; i += 1) {
        if (!session.valid() || isOffline()) break;
        var item = items[i];
        if (!matches(item.path, ALLOWED) || matches(item.path, BLOCKED)) continue;
        var ref = window.fbRef(window.fbDB, item.path);
        if (item.type === 'set') await originals.fbSet(ref, item.value);
        else if (item.type === 'update') await originals.fbUpdate(ref, item.value);
        else if (item.type === 'remove') await originals.fbRemove(ref);
        if (!session.valid()) break;
        await removeQueue(item.id);
      }
      if (session.valid()) document.dispatchEvent(new CustomEvent('sisventas:offline-synced'));
    } catch (error) {
      console.warn('[Offline] La sincronización continuará automáticamente.', error);
    } finally {
      syncing = false;
    }
  }


  function boot() {
    installWrappers();
    if (!isOffline()) sync();
  }

  window.SisVentasOffline = Object.freeze({
    enabled: true,
    allowedRoots: ALLOWED.slice(),
    queue: getQueue,
    sync: sync,
    status: function () { return getQueue().then(function (q) { return { online: !isOffline(), syncing: syncing, pending: q.length }; }); }
  });
  window.addEventListener('online', sync);
  document.addEventListener('firebase-ready', boot);
  if (window.firebaseReady) boot();
})();
