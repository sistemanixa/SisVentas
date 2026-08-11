const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.v2.0.329.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function extraer(nombre, siguiente) {
  const inicio = app.indexOf('function ' + nombre + '(');
  const fin = app.indexOf('function ' + siguiente + '(', inicio + 1);
  assert.ok(inicio >= 0 && fin > inicio, nombre);
  return app.slice(inicio, fin);
}

test('la firma del cliente no se inicializa oculta ni queda atrapada en 0x0', () => {
  let visible = false;
  const eventos = [];
  const canvas = {
    dataset:{}, width:0, height:0,
    getBoundingClientRect:() => visible ? ({width:600,height:210}) : ({width:0,height:0}),
    getContext:() => ({scale(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}}),
    addEventListener:(tipo) => eventos.push(tipo)
  };
  const contexto = {
    window:{devicePixelRatio:2},
    document:{getElementById:(id) => id === 'firma-canvas' ? canvas : ({style:{}})},
    _firmaCtx:null, _firmaDibujo:false, _firmaTiene:false,
    firmaProgramarAutoguardado(){}
  };
  vm.createContext(contexto);
  vm.runInContext(extraer('firmaInicializar', 'firmaLimpiar'), contexto);
  assert.equal(contexto.firmaInicializar(), false);
  assert.equal(canvas.dataset.firmaInicializada, undefined);
  visible = true;
  assert.equal(contexto.firmaInicializar(), true);
  assert.equal(canvas.width, 1200);
  assert.equal(canvas.height, 420);
  assert.equal(canvas.dataset.firmaInicializada, '1');
  assert.ok(eventos.includes('touchend'));
});

test('cambiar pestañas reinicializa la firma que acaba de quedar visible', () => {
  const flujo = extraer('firmaCambiarPestana', 'firmaAplicarBloqueo');
  assert.match(flujo, /if \(tipo === 'tecnico'\) firmaTecnicoInicializar\(\);/);
  assert.match(flujo, /else firmaInicializar\(\);/);
  assert.match(flujo, /otFirmaTecnicoUrl\(ot\)/);
  assert.match(flujo, /otFirmaUrl\(ot\)/);
});

test('abrir otra OT restablece primero la pestaña del cliente', () => {
  const inicio = app.indexOf('function verOT(');
  const fin = app.indexOf('function volverListaOT(', inicio);
  const flujo = app.slice(inicio, fin);
  assert.match(flujo, /firmaCambiarPestana\('cliente'\);[\s\S]*firmaLimpiar\(true\);[\s\S]*firmaInicializar\(\);/);
});

test('cada botón Borrar elimina la firma de su propia pestaña', () => {
  assert.match(html, /id="firma-borrar-cliente"[^>]+onclick="firmaLimpiar\(false,'cliente'\)"/);
  assert.match(html, /id="firma-borrar-tecnico"[^>]+onclick="firmaTecnicoLimpiar\(false\)"/);
});
