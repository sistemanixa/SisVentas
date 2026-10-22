'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { create, previousMonth } = require('../js/modules/payroll-pending-review.js');

function fixture(options = {}) {
  let permission = true, tokenCalls = 0;
  const requests = [], notices = [], events = {}, attributes = {};
  const button = { innerHTML: 'Revisar haberes', disabled: false,
    getAttribute: name => Object.hasOwn(attributes, name) ? attributes[name] : null,
    setAttribute: (name, value) => { attributes[name] = value; }, removeAttribute: name => { delete attributes[name]; } };
  const status = { textContent: '', hidden: true };
  const now = options.now || new Date(2026, 9, 3, 12);
  class FixtureDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
  const root = {
    Date: FixtureDate, AbortController, AbortSignal,
    currentUserUid: 'uid-fixture', currentRole: 'admin', _svOperacionesSesionEpoch: 1,
    PERMISOS_ROLES: { admin: { indiceRevision: 3 } },
    fbDB: {}, _empleadosDatosListos: true, _empleadosCargaError: '',
    empData: options.employees || {
      a: { fbKey: 'a', nombre: 'Empleado A', cargoId: 'cargo' },
      b: { fbKey: 'b', nombre: 'Empleado B', cargoId: 'cargo' }
    },
    location: { hash: '#/empleados' },
    document: { hidden: false, getElementById: id => id === 'btn-revisar-haberes' ? button : id === 'emp-haberes-review-status' ? status : null,
      addEventListener: (name, callback) => { (events[name] ||= []).push(callback); } },
    addEventListener: (name, callback) => { (events[name] ||= []).push(callback); },
    tienePermiso: name => permission && name === 'empleados.avisarHaberes',
    fbRef: (_, source) => ({ toString: () => 'https://example.invalid/' + source }),
    fbGet: () => assert.fail('No debe usar la caché SDK como fallback'),
    fbSet: () => assert.fail('No debe guardar haberes'), fbUpdate: () => assert.fail('No debe guardar gastos'),
    fbRunTransaction: () => assert.fail('No debe crear una transacción'),
    notify: (message, duration) => { notices.push({ message, duration }); },
    fetch: async (url, init) => {
      const parsed = new URL(url), source = decodeURIComponent(parsed.pathname).slice(1, -5);
      requests.push({ source, init, url: parsed });
      if (options.read) return options.read(source, init, root);
      const value = options.values && Object.hasOwn(options.values, source) ? options.values[source] : null;
      return { ok: true, json: async () => value };
    }
  };
  root.fbAuth = { currentUser: { uid: root.currentUserUid,
    getIdToken: () => { tokenCalls += 1; return options.token ? options.token() : Promise.resolve('fictional-token'); } } };
  const api = create(root);
  return { root, api, requests, notices, button, status, attributes,
    tokenCalls: () => tokenCalls, revoke() { permission = false; },
    emit(name) { for (const listener of events[name] || []) listener(); } };
}
const pause = () => new Promise(resolve => setImmediate(resolve));
const response = value => ({ ok: true, json: async () => value });

test('cargar el módulo y emitir eventos de sesión/visibilidad no inicia lecturas', async () => {
  const env = fixture();
  for (const event of ['sisventas:session-ready', 'visibilitychange', 'hashchange', 'sisventas:session-ended']) env.emit(event);
  await pause();
  assert.equal(env.tokenCalls(), 0); assert.equal(env.requests.length, 0); assert.equal(env.notices.length, 0);
});

test('el mes anterior se calcula por calendario local incluso al cruzar de año', () => {
  assert.equal(previousMonth(new Date(2027, 0, 1, 0, 1)).key, '2026_12');
  assert.equal(previousMonth(new Date(2026, 8, 5, 23, 59)).key, '2026_08');
  assert.throws(() => previousMonth(new Date('invalid')));
});

for (const day of [1, 5]) test('acción explícita habilitada el día ' + day + ': sólo hoja empleado/mes y respuesta fresca', async () => {
  const env = fixture({ now: new Date(2026, 9, day, 12), values: { 'sisventas/haberes/b/2026_09': { sueldo: 1000 } } });
  const result = await env.api.review();
  assert.deepEqual(result, { status: 'complete', month: '2026_09', checked: 2, pending: ['a'] });
  assert.equal(env.tokenCalls(), 1);
  assert.deepEqual(env.requests.map(row => row.source), ['sisventas/haberes/a/2026_09', 'sisventas/haberes/b/2026_09']);
  for (const row of env.requests) {
    assert.equal(row.init.method, 'GET'); assert.equal(row.init.cache, 'no-store'); assert.equal(row.init.credentials, 'omit');
    assert.equal(row.init.redirect, 'error'); assert.equal(row.url.searchParams.get('auth'), 'fictional-token');
    assert.ok(row.init.signal instanceof AbortSignal);
  }
  assert.match(env.status.textContent, /1 empleado \(Empleado A\)/); assert.equal(env.status.hidden, false);
  assert.equal(env.notices[0].duration, 8000); assert.equal(env.button.innerHTML, 'Revisar haberes');
  assert.equal(env.button.disabled, false); assert.equal(env.button.getAttribute('aria-busy'), null);
});

for (const day of [6, 20, 31]) test('fuera de días 1–5 no consulta y explica la ventana: día ' + day, async () => {
  const env = fixture({ now: new Date(2026, 9, day, 12) });
  assert.equal((await env.api.review()).status, 'outside-window');
  assert.equal(env.tokenCalls(), 0); assert.equal(env.requests.length, 0);
  assert.match(env.status.textContent, /del 1 al 5/);
});

test('sin permiso no consulta ni obtiene un token', async () => {
  const env = fixture(); env.revoke();
  assert.equal((await env.api.review()).status, 'denied');
  assert.equal(env.tokenCalls(), 0); assert.equal(env.requests.length, 0);
  assert.match(env.status.textContent, /No tenés permiso/);
});

for (const issue of ['loading', 'error', 'invalid-directory']) test('directorio ' + issue + ' no se presenta como cero pendientes', async () => {
  const env = fixture();
  if (issue === 'loading') env.root._empleadosDatosListos = false;
  if (issue === 'error') env.root._empleadosCargaError = 'Error ficticio';
  if (issue === 'invalid-directory') env.root.empData = null;
  const result = await env.api.review();
  assert.equal(result.status, 'directory-unavailable'); assert.equal(Object.hasOwn(result, 'pending'), false);
  assert.equal(env.tokenCalls(), 0); assert.equal(env.requests.length, 0);
});

test('mantiene el criterio activo con cargo y no consulta empleados ajenos al criterio', async () => {
  const env = fixture({ employees: {
    a: { fbKey: 'a', nombre: 'Activo', cargoId: 'cargo' },
    inactive: { fbKey: 'inactive', nombre: 'Inactivo', activo: false, cargoId: 'cargo' },
    noCargo: { fbKey: 'noCargo', nombre: 'Sin cargo' }
  } });
  assert.deepEqual((await env.api.review()).pending, ['a']);
  assert.deepEqual(env.requests.map(row => row.source), ['sisventas/haberes/a/2026_09']);
});

test('directorio vacío confirmado se informa sin consultar Haberes', async () => {
  const env = fixture({ employees: {} });
  assert.equal((await env.api.review()).status, 'no-employees');
  assert.equal(env.requests.length, 0); assert.match(env.status.textContent, /No hay empleados activos con cargo/);
});

for (const key of ['', '../otra-ruta', 'a/b', 'a.b', ' a ', 'a#', 'a\n']) test('referencia inválida no se interpola en la ruta: ' + JSON.stringify(key), async () => {
  const env = fixture({ employees: { a: { fbKey: key, nombre: 'Ficticio', cargoId: 'cargo' } } });
  assert.equal((await env.api.review()).status, 'directory-unavailable'); assert.equal(env.requests.length, 0);
});

test('claves duplicadas no se omiten ni cuentan dos veces', async () => {
  const env = fixture({ employees: { a: { fbKey: 'a', cargoId: 'cargo' }, b: { fbKey: 'a', cargoId: 'cargo' } } });
  assert.equal((await env.api.review()).status, 'directory-unavailable'); assert.equal(env.requests.length, 0);
});

test('la verificación completa distingue registrado de ausente sin tocar importes', async () => {
  const salaries = { 'sisventas/haberes/a/2026_09': { sueldo: 1234, pagos: { p: { monto: 50 } } }, 'sisventas/haberes/b/2026_09': {} };
  const before = JSON.stringify(salaries), env = fixture({ values: salaries });
  assert.deepEqual((await env.api.review()).pending, []);
  assert.match(env.status.textContent, /están registrados para los 2 empleados revisados/);
  assert.equal(JSON.stringify(salaries), before);
});

test('pendientes conservan el orden del directorio y resumen tres nombres', async () => {
  const employees = Object.fromEntries(Array.from({ length: 5 }, (_, i) => ['e' + i, { fbKey: 'e' + i, nombre: 'Empleado ' + i, cargoId: 'cargo' }]));
  const callbacks = [];
  const env = fixture({ employees, read: () => new Promise(resolve => callbacks.push(() => resolve(response(null)))) });
  const pending = env.api.review(); await pause(); callbacks.reverse().forEach(callback => callback());
  assert.deepEqual((await pending).pending, ['e0', 'e1', 'e2', 'e3', 'e4']);
  assert.match(env.status.textContent, /Empleado 0, Empleado 1, Empleado 2 y 2 más/);
  assert.doesNotMatch(env.status.textContent, /Empleado 3/);
});

test('un doble clic comparte una revisión y restaura botón/aria-busy', async () => {
  let releaseToken;
  const env = fixture({ token: () => new Promise(resolve => { releaseToken = resolve; }) });
  const first = env.api.review(), second = env.api.review();
  assert.equal(env.button.disabled, true); assert.equal(env.button.getAttribute('aria-busy'), 'true');
  assert.match(env.button.innerHTML, /Revisando haberes/); assert.equal(env.tokenCalls(), 1);
  assert.match(env.button.innerHTML, /border-right-color:transparent/); assert.match(env.button.innerHTML, /animation:spin \.8s linear infinite/);
  releaseToken('fictional-token');
  assert.deepEqual(await first, await second); assert.equal(env.requests.length, 2);
  assert.equal(env.button.disabled, false); assert.equal(env.button.getAttribute('aria-busy'), null);
});

test('el indicador de ocupación respeta movimiento reducido sin perder texto de estado', async () => {
  let release;
  const env = fixture({ token: () => new Promise(resolve => { release = resolve; }) });
  env.root.matchMedia = query => ({ matches: query === '(prefers-reduced-motion: reduce)' });
  const pending = env.api.review();
  assert.match(env.button.innerHTML, /animation:none/); assert.match(env.button.innerHTML, /Revisando haberes/);
  env.api.cancel(); release('fictional-token'); await pending;
});

test('el límite de concurrencia es seis y no hay lecturas de raíz ni de Gastos', async () => {
  const employees = Object.fromEntries(Array.from({ length: 14 }, (_, i) => ['e' + i, { fbKey: 'e' + i, cargoId: 'cargo' }]));
  let active = 0, maximum = 0;
  const callbacks = [];
  const env = fixture({ employees, read: () => { active++; maximum = Math.max(maximum, active);
    return new Promise(resolve => callbacks.push(() => { active--; resolve(response(null)); })); } });
  const pending = env.api.review(); await pause(); assert.equal(env.requests.length, 6);
  while (callbacks.length) { callbacks.shift()(); await pause(); }
  assert.equal((await pending).checked, 14); assert.equal(maximum, 6);
  assert.ok(env.requests.every(row => /^sisventas\/haberes\/e\d+\/2026_09$/.test(row.source)));
});

for (const issue of ['403', 'network', 'bad-json', 'invalid-shape']) test('fallo ' + issue + ' no convierte resultado desconocido en cero y permite reintentar', async () => {
  let failing = true;
  const env = fixture({ read: async source => {
    if (!failing || source.includes('/a/')) return response(null);
    if (issue === '403') return { ok: false, status: 403 };
    if (issue === 'network') throw new Error('Sensitive fake URL should not surface');
    if (issue === 'bad-json') return { ok: true, json: () => { throw new Error('Fake body should not surface'); } };
    return response(false);
  } });
  const result = await env.api.review();
  assert.equal(result.status, 'error'); assert.equal(Object.hasOwn(result, 'pending'), false);
  assert.match(env.status.textContent, /No se confirmó cuántos haberes faltan/);
  assert.doesNotMatch(env.status.textContent, /Sensitive|Fake body|fictional-token|0 empleados/);
  assert.equal(env.button.disabled, false);
  failing = false;
  assert.deepEqual((await env.api.review()).pending, ['a', 'b']); assert.equal(env.tokenCalls(), 2);
});

test('la fecha límite aborta la revisión sin afirmar cero pendientes y permite reintentar', async () => {
  const deadline = new AbortController(), env = fixture({ read: () => new Promise(() => {}) });
  env.root.AbortSignal = { timeout: () => deadline.signal };
  const pending = env.api.review(); await pause(); deadline.abort();
  const result = await pending;
  assert.equal(result.status, 'error'); assert.equal(Object.hasOwn(result, 'pending'), false);
  assert.match(env.status.textContent, /No se confirmó/); assert.equal(env.button.disabled, false);
});

for (const change of ['uid', 'auth-user', 'role', 'permission', 'revision', 'epoch', 'route', 'directory', 'loading', 'hidden', 'session-ended']) {
  test('cambio de ' + change + ' cancela respuestas tardías sin aviso ni resultado viejo', async () => {
    let release;
    const env = fixture({ read: () => new Promise(resolve => { release = resolve; }) });
    const pending = env.api.review(); await pause();
    if (change === 'uid') env.root.currentUserUid = 'otro-uid';
    if (change === 'auth-user') env.root.fbAuth.currentUser = { uid: 'uid-fixture' };
    if (change === 'role') env.root.currentRole = 'tecnico';
    if (change === 'permission') env.revoke();
    if (change === 'revision') env.root.PERMISOS_ROLES.admin.indiceRevision++;
    if (change === 'epoch') env.root._svOperacionesSesionEpoch++;
    if (change === 'route') { env.root.location.hash = '#/dashboard'; env.emit('hashchange'); }
    if (change === 'directory') env.root.empData.a.activo = false;
    if (change === 'loading') env.root._empleadosDatosListos = false;
    if (change === 'hidden') { env.root.document.hidden = true; env.emit('visibilitychange'); }
    if (change === 'session-ended') env.emit('sisventas:session-ended');
    release(response(null));
    assert.equal((await pending).status, 'cancelled'); assert.equal(env.notices.length, 0);
    assert.equal(env.status.textContent, ''); assert.equal(env.status.hidden, true); assert.equal(env.button.disabled, false);
    assert.ok(env.requests.every(row => row.init.signal.aborted));
  });
}

test('cancelar durante el token no deja iniciar ninguna lectura tardía', async () => {
  let release;
  const env = fixture({ token: () => new Promise(resolve => { release = resolve; }) });
  const pending = env.api.review(); env.api.cancel(); release('fictional-token');
  assert.equal((await pending).status, 'cancelled'); assert.equal(env.requests.length, 0); assert.equal(env.notices.length, 0);
});

for (const event of ['sisventas:role-changed', 'sisventas:page-changed', 'sisventas:foreground-paused']) {
  test(event + ' aborta inmediatamente la lectura solicitada y no presenta su respuesta tardía', async () => {
    const env = fixture({ read: () => new Promise(() => {}) });
    const pending = env.api.review(); await pause(); env.emit(event);
    assert.ok(env.requests.every(row => row.init.signal.aborted));
    assert.equal((await pending).status, 'cancelled'); assert.equal(env.notices.length, 0); assert.equal(env.status.hidden, true);
  });
}

test('pestaña ya oculta y vista de otro usuario no inician lecturas', async () => {
  const hidden = fixture(); hidden.root.document.hidden = true;
  assert.equal((await hidden.api.review()).status, 'cancelled'); assert.equal(hidden.tokenCalls(), 0);
  const impersonated = fixture(); impersonated.root._impersonacionOriginal = { user: 'Ficticio' };
  assert.equal((await impersonated.api.review()).status, 'unavailable'); assert.equal(impersonated.tokenCalls(), 0);
});

test('una referencia que cambia la hoja o usa HTTP se rechaza sin fetch', async () => {
  for (const url of ['http://example.invalid/sisventas/haberes/a/2026_09', 'https://example.invalid/sisventas/haberes']) {
    const env = fixture(); env.root.fbRef = () => ({ toString: () => url });
    assert.equal((await env.api.review()).status, 'error'); assert.equal(env.requests.length, 0);
  }
});

test('superficie del módulo no contiene escrituras, consultas de raíz ni arranque al entrar', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/modules/payroll-pending-review.js'), 'utf8');
  assert.doesNotMatch(source, /fbGet\(|fbSet\(|fbUpdate\(|fbRemove\(|fbRunTransaction\(|setInterval\(|setTimeout\(/);
  assert.doesNotMatch(source, /sisventas\/gastos|sisventas:session-ready/);
});
