const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');

test('cerrar sesión libera la bandera del listener de versión', () => {
  assert.match(app, /fbStopAllValueListeners\(\);[\s\S]{0,350}?_listenerVersionActivo\s*=\s*false/);
});

test('un login posterior vuelve a suscribir aunque el chequeo general ya se inició', () => {
  assert.match(app, /function iniciarChequeoPeriodicoVersion\(\)[\s\S]{0,250}?iniciarWatchdogVersion\(\);[\s\S]{0,250}?if \(_chequeoVersionIniciado\) \{\s*if \(window\.fbDB\) iniciarListenerVersion\(\)/);
});

test('volver a la pestaña fuerza una comprobación inmediata', () => {
  assert.match(app, /visibilitychange[\s\S]*?document\.visibilityState === 'visible'[\s\S]*?_chequearGitHub\(\)/);
  assert.match(app, /window\.addEventListener\('focus'[\s\S]*?_chequearGitHub\(\)/);
});

test('un watchdog visible y la reconexión de red cubren la pérdida del listener', () => {
  assert.match(app, /function iniciarWatchdogVersion\(\)[\s\S]{0,180}?if \(_watchdogVersionTimer\) return/);
  assert.match(app, /setInterval\(function\(\) \{\s*if \(document\.visibilityState !== 'hidden'\) _chequearGitHub\(\);\s*\}, 60 \* 1000\)/);
  assert.match(app, /window\.addEventListener\('online'[\s\S]*?_chequearGitHub\(\)/);
});

test('el respaldo periódico no depende del listener Firebase ni del rol', () => {
  const listener = app.slice(app.indexOf('function iniciarListenerVersion'), app.indexOf('var _watchdogVersionTimer'));
  const watchdog = app.slice(app.indexOf('function iniciarWatchdogVersion'), app.indexOf('var _chequeoVersionIniciado'));
  assert.doesNotMatch(listener, /setInterval/);
  assert.match(watchdog, /_chequearGitHub\(\)/);
  assert.doesNotMatch(watchdog, /currentRole|currentUserRole|fbOnValue/);
  assert.match(listener, /catch \(e\) \{[\s\S]*?_listenerVersionActivo = false/);
});
