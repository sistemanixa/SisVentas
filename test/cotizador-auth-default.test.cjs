'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('cotizador/index.js', 'utf8');
const declaration = source.match(/^const REQUIRE_FIREBASE_AUTH = .+;$/m)?.[0];
const start = source.indexOf('function extraerTokenBearer(');
const end = source.indexOf('\nfunction readBody(', start);
assert.ok(declaration && start >= 0 && end > start, 'Usar declaración y autenticador reales');

function fixture(value, verify = async token => ({uid: 'ficticio', token})) {
  const calls = [], errors = [], env = {};
  if (value !== undefined) env.REQUIRE_FIREBASE_AUTH = value;
  const blocked = new Proxy({}, {get() {assert.fail('No consultar base ni credenciales en estas pruebas');}});
  const context = {process: {env}, db: blocked, admin: blocked, fetch: () => assert.fail('No abrir red'),
    businessAuth: {async verifyIdToken(token, revoked) {calls.push({token, revoked}); return verify(token, revoked);}},
    console: {error(...parts) {errors.push(parts);}}};
  vm.runInNewContext(declaration + '\n' + source.slice(start, end), context);
  return {calls, errors, authenticate: authorization => context.autenticarSolicitud({headers: {authorization}}), bearer: context.extraerTokenBearer};
}

test('omiso, vacío e inválido exigen sesión sin tocar Auth, base ni red si falta Bearer', async () => {
  for (const value of [undefined, '', 'invalid', '0', 'TRUE', 'False', 'FALSE', 'false ', ' false', false, null]) {
    const f = fixture(value);
    await assert.rejects(f.authenticate(), error => error.statusCode === 401 && error.message === 'Sesión Firebase requerida', String(value));
    assert.equal(f.calls.length, 0); assert.equal(f.errors.length, 0);
  }
});

test('true rechaza Bearer ausente o malformado antes de consultar Auth', async () => {
  const f = fixture('true');
  for (const header of [undefined, '', 'Basic ficticio', 'Bearer', 'Bearer ', 'Bearer ficticio extra']) {
    await assert.rejects(f.authenticate(header), error => error.statusCode === 401);
  }
  assert.equal(f.calls.length, 0);
});

test('false exacto conserva compatibilidad aislada sin verificar tokens ni abrir red', async () => {
  const f = fixture('false');
  assert.equal(await f.authenticate(), null);
  assert.equal(await f.authenticate('Bearer ficticio'), null);
  assert.equal(f.calls.length, 0);
});

test('token válido se verifica con revocación en cada operación sin caché de autorización', async () => {
  let operation = 0;
  const f = fixture('true', async () => ({uid: 'ficticio', operation: ++operation}));
  assert.equal((await f.authenticate('Bearer token-demo')).operation, 1);
  assert.equal((await f.authenticate('Bearer token-demo')).operation, 2);
  assert.deepEqual(f.calls, [{token: 'token-demo', revoked: true}, {token: 'token-demo', revoked: true}]);
});

test('omiso e inválido verifican también el token válido con revocación', async () => {
  for (const value of [undefined, '', 'invalid']) {
    const f = fixture(value);
    const user = await f.authenticate('Bearer token-demo');
    assert.equal(user.uid, 'ficticio'); assert.deepEqual(f.calls, [{token: 'token-demo', revoked: true}]);
  }
});

test('token revocado o expirado produce401 sin filtrar el token ni el error privado', async () => {
  for (const code of ['auth/id-token-revoked', 'auth/id-token-expired']) {
    const f = fixture('true', async () => {throw Object.assign(Error('Detalle privado'), {code});});
    await assert.rejects(f.authenticate('Bearer token-demo'), error => error.statusCode === 401 && error.message === 'Sesión Firebase inválida o vencida');
    assert.equal(f.calls[0].revoked, true);
    assert.equal(JSON.stringify(f.errors).includes('token-demo'), false);
    assert.equal(JSON.stringify(f.errors).includes('Detalle privado'), false);
  }
});

test('revocación entre operaciones no reutiliza una autenticación anterior', async () => {
  let revoked = false;
  const f = fixture('true', async () => {
    if (revoked) throw Object.assign(Error('Revocado'), {code: 'auth/id-token-revoked'});
    return {uid: 'ficticio'};
  });
  assert.equal((await f.authenticate('Bearer token-demo')).uid, 'ficticio'); revoked = true;
  await assert.rejects(f.authenticate('Bearer token-demo'), error => error.statusCode === 401);
  assert.equal(f.calls.length, 2); assert.ok(f.calls.every(call => call.revoked === true));
});
