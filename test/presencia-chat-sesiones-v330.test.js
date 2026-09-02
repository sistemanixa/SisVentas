const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const appPath = html.match(/src="\.\/(js\/app\.v[0-9.]+\.js)"/)[1];
const app = fs.readFileSync(appPath, 'utf8');
const inicio = app.indexOf('var PRESENCIA_DATA =');
const fin = app.indexOf('function notificarUsuarioConectado', inicio);
assert.notEqual(inicio, -1);
assert.notEqual(fin, -1);
const ahora = Date.now();
const context = {
  Date,
  Object,
  Number,
  String,
  currentUserEmail:'admin@sistemanixa.com',
  currentUserUid:'uid_admin'
};
vm.createContext(context);
vm.runInContext(app.slice(inicio, fin), context);

test('una presencia vieja no continúa figurando conectada', () => {
  assert.equal(context.presenciaEstaActiva({ online:true, sesionId:'vieja', ultimaConexion:ahora - 180000 }, ahora), false);
  assert.equal(context.presenciaEstaActiva({ online:true, sesionId:'actual', ultimaConexion:ahora - 20000 }, ahora), true);
});

test('varias pestañas del mismo usuario cuentan como una persona', () => {
  context.PRESENCIA_DATA = {
    uno:{ online:true, email:'ignacio@sistemanixa.com', nombre:'Ignacio', sesionId:'a', ultimaConexion:ahora - 10000 },
    dos:{ online:true, email:'ignacio@sistemanixa.com', nombre:'Ignacio', sesionId:'b', ultimaConexion:ahora - 5000 },
    propio:{ online:true, email:'admin@sistemanixa.com', nombre:'Admin', uid:'uid_admin', sesionId:'c', ultimaConexion:ahora - 2000 }
  };
  assert.equal(context.usuariosPresentesUnicos(false).length, 1);
  assert.equal(context.usuariosPresentesUnicos(true).length, 2);
});

test('la búsqueda de presencia tolera mayúsculas y acentos del nombre', () => {
  assert.equal(context.buscarPresenciaPorNombre('IGNÁCIO').nombre, 'Ignacio');
});

test('cada pestaña registra una clave de sesión propia y la cabecera no confunde conectividad con personas', () => {
  assert.match(app, /sisventas\/presencia\/'\s*\+\s*clavePresenciaSesionActual\(\)/);
  assert.match(app, /var label = fbOnline \? 'Sincronizado'/);
  assert.match(app, /Nadie más conectado/);
});
