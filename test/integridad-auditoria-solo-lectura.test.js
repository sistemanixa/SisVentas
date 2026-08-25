const fs=require('fs');
const assert=require('assert');
const vm=require('vm');
const source=fs.readFileSync('js/modules/v2-audit.js','utf8');
assert.match(source,/comprobantesVenta/);
assert.match(source,/gastosEmpleadoInexistente/);
assert.match(source,/cuentaGastoInexistente/);
assert.match(source,/ventaEstadoContradictorio/);
assert.match(source,/coleccionesNoEvaluadas/);
assert.doesNotMatch(source,/fb(?:Set|Update|Push|Remove|RunTransaction)\s*\(/,'la auditoría no debe escribir en Firebase');

const window={
  clientesData:[{fbKey:'cli_ok',id:'C-1'}],
  ventasList:[{fbKey:'v_ok',id:'V-1',clienteFbKey:'cli_roto'},{fbKey:'v_nc',id:'V-2',clienteFbKey:'cli_ok',anulada:true,estadoPago:'pendiente',notaCredito:{cae:'1'}}],
  pagosData:[{fbKey:'p_1',ventaFbKey:'v_rota'}],
  otData:[], productosData:[], pptoData:[], reclamosData:[],
  empleadosData:[{fbKey:'emp_ok',nombre:'Empleado'}],
  gastosData:[{fbKey:'g_1',empleadoFbKey:'emp_roto'}],
  comprobantesVentaData:[{fbKey:'f_1',cae:'123',ventaFbKey:'v_rota'}],
  ctaEmpData:{emp_ok:{m_1:{fbKey:'m_1',gastoFbKey:'g_roto'}}}
};
const document={querySelectorAll:()=>[],addEventListener:()=>{},getElementById:()=>null};
const context={window,document,navigator:{},console,setTimeout};
vm.runInNewContext(source,context);
const report=window.svAuditoriaV2();
assert.equal(report.relacionesDebiles.ventasClienteInexistente,1);
assert.equal(report.relacionesDebiles.pagosVentaInexistente,1);
assert.equal(report.relacionesDebiles.gastosEmpleadoInexistente,1);
assert.equal(report.relacionesDebiles.cuentaGastoInexistente,1);
assert.equal(report.integridadFiscal.comprobanteVentaInexistente,1);
assert.equal(report.integridadFiscal.ventaEstadoContradictorio,1);
assert.equal(report.completa,true);
console.log('integridad-auditoria-solo-lectura.test.js OK');
