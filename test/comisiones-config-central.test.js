const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const appPath = (html.match(/src="\.\/(js\/app\.v[0-9.]+\.js)"/) || [])[1];
assert.ok(appPath, 'La vista debe referenciar una aplicación inmutable');
const app = fs.readFileSync(appPath, 'utf8').replace(/\r\n/g,'\n');
const finance = fs.readFileSync('js/modules/finance-details.js', 'utf8');

assert.match(html, /id="cfg-comisiones-empleados-tbody"/,
  'Configuración debe permitir administrar excepciones por empleado');
assert.equal(app, require('./helpers/active-app').readActiveApp().source,
  'Las comprobaciones deben analizar el controlador activo');
assert.doesNotMatch(app, /% Comisión propio \(solo vendedor a comisión\)/,
  'La ficha de empleado no debe editar la comisión');
assert.match(app, /sisventas\/config\/comisionesEmpleados/,
  'Las excepciones deben persistirse en la configuración central');
assert.doesNotMatch(app, /migrarComisionesEmpleadosDesdeFichas/,
  'Consultar configuración no debe restaurar porcentajes antiguos ni escribir migraciones');
assert.match(app, /function obtenerDetalleComisionEmpleado/,
  'Debe existir una única resolución de cargo y excepción individual');
assert.match(app, /var detalle = obtenerDetalleComisionEmpleado\(emp\);[\s\S]{0,100}return parseFloat\(detalle\.pctSolicitado\)/,
  'La generación debe dejar de priorizar la ficha personal');
const commissionModel = require('../cotizador/commission-generation-model');
const split = commissionModel.preview({sale:{fbKey:'s',id:'V-DEMO',comisionHabilitada:true,empleadoFbKey:'e',comisionado2FbKey:'e2',items:[{qty:1,punit:100,sub:100,costoUnitarioPresupuestado:0}],subtotal:100,conIva:false,iva:0,total:100},payments:[{fbKey:'p',ventaFbKey:'s',monto:100}],employees:{e:{nombre:'Uno'},e2:{nombre:'Dos'}},config:{maxComisionPct:5,comisionesEmpleados:{e:{pct:8},e2:{pct:4}}}});
assert.deepEqual(split.participantes.map(p=>p.pct),[2.5,2.5],
  'Si la suma excede el máximo, el servidor divide el tope en partes iguales');
assert.match(finance, /obtenerDetalleComisionEmpleado\(emp\)\.pct/,
  'La cuenta personal debe leer la configuración central');

console.log('comisiones-config-central.test.js OK');
const test = require('node:test');
const vm = require('node:vm');
test('comisión central respeta excepción cero, cargo y tope sin usar porcentaje antiguo', () => {
  const ctx = {CONFIG_COMISIONES_EMPLEADOS: {uno:{pct:0}, dos:{pct:8}}, APROBACION_CONFIG:{maxComisionPct:5}, obtenerConfigComisionCargo:()=>({pct:3})};
  vm.createContext(ctx);
  vm.runInContext(app.slice(app.indexOf('function _configComisionEmpleadoKey('), app.indexOf('function _normComisionKey(')),ctx);
  assert.equal(ctx.obtenerDetalleComisionEmpleado({id:'uno',pctComisionPropio:15}).pct,0);
  assert.equal(ctx.obtenerDetalleComisionEmpleado({id:'dos'}).pct,5);
  assert.equal(ctx.obtenerDetalleComisionEmpleado({id:'dos'}).pctSolicitado,8);
  assert.equal(ctx.obtenerDetalleComisionEmpleado({id:'tres',pctComisionPropio:15}).pct,3);
});
