const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const firebase = fs.readFileSync(path.join(root, 'js', 'core', 'firebase.js'), 'utf8');

test('Firebase anuncia disponibilidad sin bloquear la restauracion local', () => {
  assert.match(firebase, /const fbAuth = getAuth\(fbApp\)/);
  assert.match(firebase, /window\.firebaseReady = true/);
  assert.doesNotMatch(firebase, /\bsetPersistence\s*\(|\bbrowserLocalPersistence\s*[,}]/);
});

test('solo el observador de Firebase decide si corresponde mostrar el login', () => {
  assert.match(app, /function _iniciarObservadorAuth\(\)/);
  assert.match(app, /window\.fbOnAuth\(window\.fbAuth/);
  assert.doesNotMatch(app, /despu[eé]s de 6 segundos Firebase nunca respondi[oó]/i);
  assert.doesNotMatch(app, /Timeout ABSOLUTO/);
});

test('cobros no bloquea el acceso y posterga la conciliacion pesada', () => {
  assert.match(app, /pagos:\s*\{[^}]*bloqueante:false/);
  assert.match(app, /window\._svPagosDatosListos = true;\s*svMarcarDatoInicialListo\('pagos'\);/);
  assert.match(app, /La conciliacion completa no forma parte del acceso[\s\S]{0,260}\}, 600\);/);
});
