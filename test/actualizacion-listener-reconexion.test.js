const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.v3.0.10.js', 'utf8');

test('cerrar sesión libera la bandera del listener de versión', () => {
  assert.match(app, /fbStopAllValueListeners\(\);[\s\S]{0,350}?_listenerVersionActivo\s*=\s*false/);
});

test('un login posterior vuelve a suscribir aunque el chequeo general ya se inició', () => {
  assert.match(app, /function iniciarChequeoPeriodicoVersion\(\)\s*\{\s*if \(_chequeoVersionIniciado\) \{\s*if \(window\.fbDB\) iniciarListenerVersion\(\)/);
});

test('volver a la pestaña fuerza una comprobación inmediata', () => {
  assert.match(app, /visibilitychange[\s\S]*?document\.visibilityState === 'visible'[\s\S]*?_chequearGitHub\(\)/);
  assert.match(app, /window\.addEventListener\('focus'[\s\S]*?_chequearGitHub\(\)/);
});

test('un watchdog visible y la reconexión de red cubren la pérdida del listener', () => {
  assert.match(app, /setInterval\(function\(\) \{\s*if \(document\.visibilityState !== 'hidden'\) _chequearGitHub\(\);\s*\}, 60 \* 1000\)/);
  assert.match(app, /window\.addEventListener\('online'[\s\S]*?_chequearGitHub\(\)/);
});
