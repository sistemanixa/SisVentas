const fs = require('fs');
const assert = require('assert');

const core = fs.readFileSync('js/modules/offline-core.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const worker = fs.readFileSync('sw.js', 'utf8');

assert(core.includes("params.get('offline_preview') === '1'"), 'Offline debe permanecer encapsulado detrás de su bandera');
['sisventas/clientes', 'sisventas/presupuestos', 'sisventas/ordenes_trabajo', 'sisventas/reclamos', 'sisventas/agenda']
  .forEach(path => assert(core.includes("'" + path + "'"), 'Falta habilitar ' + path));
['sisventas/ventas', 'sisventas/pagos', 'sisventas/caja', 'sisventas/comprobantesVenta']
  .forEach(path => assert(core.includes("'" + path + "'"), 'Falta bloquear la operación crítica ' + path));
assert(core.includes("indexedDB.open(DB_NAME"), 'La cola debe persistir en IndexedDB');
assert(core.includes("window.addEventListener('online', sync)"), 'Debe sincronizar al recuperar conexión');
assert(core.includes("crypto.randomUUID"), 'Las operaciones deben tener identidad idempotente local');
assert(core.includes("window.fbRunTransaction = function") && core.includes('SISVENTAS_OFFLINE_BLOCKED'), 'Las transacciones deben bloquearse sin conexión');
assert(core.includes("saveCache(path, snapshot.val())"), 'Las lecturas habilitadas deben guardarse localmente');
assert(!core.includes("badge.id = 'sv-offline-status'"), 'El preview offline no debe mostrar un indicador flotante hasta estar finalizado');
const appScriptIndex = html.search(/js\/app(?:\.v[0-9.]+)?\.js/);
assert(appScriptIndex >= 0 && html.indexOf('offline-core.js') < appScriptIndex, 'El núcleo offline debe envolver Firebase antes de iniciar la aplicación');
assert(worker.includes("url.origin === 'https://www.gstatic.com'"), 'El arranque offline debe cachear dependencias Firebase ESM');
assert(worker.includes("'./js/modules/offline-core.js'"), 'El núcleo offline debe formar parte del shell PWA');

console.log('OK: núcleo offline encapsulado, durable y con operaciones críticas protegidas.');
