const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { readActiveApp } = require('./helpers/active-app');

const app = readActiveApp().source;
function block(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Falta ${start}`);
  return app.slice(from, to);
}
const functions = [
  block('function _empleadoUltimaBaja(', 'function renderTablaEmpleados('),
  block('async function confirmarEstadoEmpleado(', 'async function adjuntarDocumentoBajaEmpleado('),
  block('function _cobroPagoPorKey(', 'function _cobroTieneComprobante('),
  block('function _cobroMetaComprobante(', '// Núcleo único de cobros.'),
  block('function _guardarDocumentoCobro(', 'async function verOAdjuntarDocumentoCobro(')
].join('\n');

function context(overrides = {}) {
  const calls = [];
  const boton = { disabled:false, textContent:'' };
  const modal = { classList:{ remove(name) { calls.push(['close', name]); } } };
  const input = { files:[], value:'' };
  const base = {
    Date, Object, Promise, String, Number, parseInt, parseFloat,
    currentRole:'admin', currentUser:'Administración',
    empData:{ e1:{fbKey:'e1',nombre:'Empleada',activo:true,historial:[]} },
    document:{getElementById(id) { return id === 'emp-estado-confirmar' ? boton : id === 'emp-estado-documento' ? input : id === 'modal-nuevo' ? modal : null; }},
    notify(message) { calls.push(['notify', message]); },
    window:{fbDB:{}, _historialPagosCompleto:[], fbRef(_db,path) { return path; }, fbSet(path,data) { calls.push(['set',path,data]); return Promise.resolve(); },
      fbUpdate(path,data) { calls.push(['update',path,data]); return Promise.resolve(); }, fbRemove(path) { calls.push(['remove',path]); return Promise.resolve(); }},
    ventasPagosPersistirActualizarPago(key, data) { calls.push(['payment-update',key,data]); return Promise.resolve(); }
  };
  const ctx = vm.createContext(Object.assign(base, overrides));
  vm.runInContext(functions,ctx);
  return {ctx,calls,input};
}

test('la lista recupera el motivo de la última baja sin confundir un alta previa', () => {
  const {ctx} = context();
  const baja = ctx._empleadoUltimaBaja({historial:[
    {tipo:'baja',motivo:'Renuncia',fecha:'2025-01-01'},
    {tipo:'alta',motivo:'Reingreso',fecha:'2025-06-01'},
    {tipo:'baja',motivo:'Despido',fecha:'2026-09-20'}
  ]});
  assert.equal(baja.motivo,'Despido');
});

test('rechaza un documento demasiado grande antes de cambiar el estado', async () => {
  const {ctx,calls,input} = context();
  input.files = [{name:'telegrama.pdf',type:'application/pdf',size:3*1024*1024}];
  await ctx.confirmarEstadoEmpleado('e1',false,'Despido','2026-09-20','');
  assert.equal(calls.some(c => c[0] === 'update' || c[0] === 'set'),false);
});

test('la baja sin archivo guarda motivo y fecha y cierra el formulario al confirmarse', async () => {
  const {ctx,calls} = context();
  await ctx.confirmarEstadoEmpleado('e1',false,'Renuncia','2026-09-20','Avisó por escrito');
  const update = calls.find(c => c[0] === 'update');
  assert.equal(update[1],'sisventas/empleados/e1');
  assert.equal(update[2].activo,false);
  assert.equal(update[2].historial[0].motivo,'Renuncia');
  assert.equal(calls.some(c => c[0] === 'close'),true);
});

test('el comprobante de cobro se guarda separado del registro liviano de pagos', async () => {
  const {ctx,calls} = context();
  const documento = {nombre:'transferencia.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,AA==',ts:1};
  await ctx._guardarDocumentoCobro('pago-1',documento);
  assert.equal(calls[0][0],'update');
  assert.equal(calls[0][1],'sisventas');
  assert.deepEqual(calls[0][2]['cobros_adjuntos/pago-1'],documento);
  assert.equal(calls[0][2]['pagos/pago-1/comprobanteAdjunto'].data,undefined);
  assert.equal(calls[0][2]['pagos/pago-1/comprobanteAdjunto'].refKey,'pago-1');
  assert.equal(calls[0][2]['pagos/pago-1/comprobanteRef'],'pago-1');
});

test('los documentos de RR. HH. tienen una regla de acceso exclusiva de administración', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname,'../security/database.control-access.rules.json'),'utf8'));
  const adjuntos = rules.rules.sv_rrhh_adjuntos;
  assert.match(adjuntos['.read'], /rol'\)\.val\(\) === 'admin'/);
  assert.match(adjuntos['.write'], /rol'\)\.val\(\) === 'admin'/);
});
