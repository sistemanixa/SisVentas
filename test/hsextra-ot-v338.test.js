const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v2.0.338.js'), 'utf8');

test('horas extra resuelve el empleado por la cuenta vinculada, no solo por el nombre visible', () => {
  const start = app.indexOf('function _hsexEmpleadoActual');
  const end = app.indexOf('function abrirFormCargaHsExtra', start);
  const context = {
    empData: { emp1: { fbKey:'emp1', nombre:'Marcos Tello', email:'marcos@nixa.test' } },
    currentUser: 'marcos.login', currentUserEmail: 'marcos@nixa.test',
    window: { usuariosData: [{ login:'marcos.login', empleadoFbKey:'emp1' }] },
    Object, String
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end), context);
  assert.equal(context._hsexEmpleadoActual().fbKey, 'emp1');
});

test('aprobacion de horas usa valorHoraExtra del cargo y conserva el valor aplicado', () => {
  assert.match(app, /valorHora = cargoInfo \? \(parseFloat\(cargoInfo\.valorHoraExtra\)\|\|0\) : 0/);
  assert.match(app, /valorHoraExtraAplicado:grupo\.valorHora/);
  assert.match(app, /cargoIdAplicado:grupo\.cargoId/);
});

test('detalle de aprobacion de horas tiene un contenedor flexible desplazable', () => {
  assert.match(app, /overflow:auto;min-height:0;flex:1;padding:14px 20px/);
});

test('la cuenta administrativa siempre mantiene retorno a Empleados', () => {
  assert.match(app, /volverEmpleados\.style\.display = esAdmin \? '' : 'none'/);
});

test('transferir tecnico de una OT pide confirmacion, bloquea doble envio y deja auditoria', () => {
  assert.match(app, /async function cambiarTecnicoOT/);
  assert.match(app, /await svConfirm\(mensaje\)/);
  assert.match(app, /window\._otTransferenciaEnCurso/);
  assert.match(app, /Titularidad de OT transferida:/);
  assert.match(app, /tecnicoAnterior:anterior, tecnicoNuevo:nuevo/);
});

test('edicion de cargos en mobile mantiene el valor local hasta presionar Guardar', () => {
  assert.match(app, /inputmode="decimal"/);
  assert.match(app, /function cargosGuardarFila\(id\)/);
  assert.match(app, /oninput="cargosMarcarPendiente/);
  assert.match(app, /id="cargo-guardar-/);
});
