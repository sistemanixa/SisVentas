const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.v2.0.328.js', 'utf8');

function extraerFuncion(nombre, siguiente) {
  const inicio = app.indexOf('function ' + nombre + '(');
  const fin = app.indexOf('function ' + siguiente + '(', inicio + 1);
  assert.ok(inicio >= 0 && fin > inicio, nombre);
  return app.slice(inicio, fin);
}

test('el canvas técnico no queda inicializado mientras su pestaña está oculta', () => {
  let visible = false;
  const eventos = [];
  const contextoCanvas = {
    dataset: {}, width: 0, height: 0,
    getBoundingClientRect: () => visible ? ({ width: 640, height: 220 }) : ({ width: 0, height: 0 }),
    getContext: () => ({ scale(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, strokeStyle:'', lineWidth:0, lineCap:'', lineJoin:'' }),
    addEventListener: tipo => eventos.push(tipo)
  };
  const contexto = {
    window: { devicePixelRatio: 2 },
    document: { getElementById: id => id === 'firma-tecnico-canvas' ? contextoCanvas : ({ style:{} }) },
    _firmaTecnicoCtx:null, _firmaTecnicoDibujo:false, _firmaTecnicoTiene:false,
    firmaTecnicoProgramarAutoguardado(){}
  };
  vm.createContext(contexto);
  vm.runInContext(extraerFuncion('firmaTecnicoInicializar', 'firmaTecnicoLimpiar'), contexto);
  assert.equal(contexto.firmaTecnicoInicializar(), false);
  assert.equal(contextoCanvas.dataset.firmaInicializada, undefined);
  visible = true;
  assert.equal(contexto.firmaTecnicoInicializar(), true);
  assert.equal(contextoCanvas.dataset.firmaInicializada, '1');
  assert.equal(contextoCanvas.width, 1280);
  assert.equal(contextoCanvas.height, 440);
  assert.ok(eventos.includes('touchend'));
});

test('abrir la pestaña técnica inicializa el canvas luego de volverlo visible', () => {
  const flujo = extraerFuncion('firmaCambiarPestana', 'firmaAplicarBloqueo');
  assert.match(flujo, /if \(tipo === 'tecnico'\)[\s\S]*setTimeout\(function\(\) \{[\s\S]*firmaTecnicoInicializar\(\)/);
});

test('la firma técnica se confirma en la OT y actualiza la huella local', () => {
  const flujo = extraerFuncion('firmaTecnicoGuardarEnOT', 'firmaTecnicoAutoguardar');
  assert.match(flujo, /otPersistirActualizar\(ot\.fbKey, \{ firmaTecnicoUrl:firmaUrl/);
  assert.match(flujo, /firmadaTecnico:true, fechaFirmaTecnico:fecha/);
  assert.match(flujo, /window\._otDetalleHuella = JSON\.stringify\(ot\)/);
  assert.match(flujo, /firmaAplicarBloqueo\('tecnico', true\)/);
});

test('recargar la OT vuelve a pintar y bloquear la firma técnica guardada', () => {
  const flujo = extraerFuncion('firmaTecnicoCargar', 'otPuedeEditarCredenciales');
  assert.match(flujo, /otFirmaTecnicoUrl\(ot\)/);
  assert.match(flujo, /canvas\.style\.backgroundImage/);
  assert.match(flujo, /firmaAplicarBloqueo\('tecnico', true\)/);
});
