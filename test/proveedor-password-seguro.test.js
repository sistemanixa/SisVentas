const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.v3.3.7.js', 'utf8');

assert(app.includes("f.id === 'npv-user' || f.id === 'npv-pass'"),
  'Usuario y contraseña deben tener tratamiento específico.');
assert(app.includes("inp.setAttribute('autocapitalize', 'none')"),
  'Las credenciales no deben autocapitalizarse.');
assert(app.includes("inp.style.textTransform = 'none'"),
  'Las credenciales no deben mostrarse en mayúsculas por estilo.');
assert(app.includes("f.id === 'npv-user') {\n        inp.setAttribute('autocomplete', 'username')"),
  'El usuario del portal debe identificarse como username sin autocapitalización.');
assert(app.includes("usuario:   obj.user || ''"),
  'El usuario del portal debe guardarse literalmente, sin convertirlo a mayúsculas.');
assert(app.includes("passwordToggle.setAttribute('aria-label', 'Mostrar contraseña')"),
  'La contraseña debe incluir un control accesible para verla.');
assert(app.includes("inp.type = visible ? 'password' : 'text'"),
  'El ojo debe alternar entre contraseña visible y oculta.');

console.log('OK: credenciales de proveedores sin mayúsculas forzadas y contraseña visible bajo demanda.');
