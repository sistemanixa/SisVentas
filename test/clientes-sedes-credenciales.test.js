const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.2.6.js', 'utf8');

test('el historial entrega todos los domicilios al visor de credenciales', () => {
  assert.match(app, /credSetGrupo\(clientesGrupoActual\)/);
  assert.match(app, /function credSetGrupo\(grupo\)/);
  assert.match(app, /Promise\.all\(owners\.map\(credGetGrupo\)\)/);
});

test('cada credencial conserva el domicilio propietario al abrirla', () => {
  assert.match(app, /credAbrirEditor\([^\n]*owner\.fbKey[^\n]*owner\.legacyId/);
  assert.match(app, /credGetItem\(fbKey, _credEditOwnerId, _credEditOwnerLegacyId\)/);
  assert.match(app, /_credEditFuente === 'legacy'/);
});

test('una credencial nueva exige elegir domicilio y se guarda allí', () => {
  assert.match(html, /<select id="cred-domicilio"><\/select>/);
  assert.match(app, /credPoblarDomicilios\(_credClienteId, false\)/);
  assert.match(app, /credRutaNueva\('', selectedOwner\.fbKey\)/);
});

test('cargar el historial no escribe ni migra credenciales', () => {
  const cargar = app.slice(app.indexOf('function credCargar()'), app.indexOf('function credMostrarPass'));
  assert.doesNotMatch(cargar, /fbSet|fbUpdate|fbPush|fbRemove/);
});
