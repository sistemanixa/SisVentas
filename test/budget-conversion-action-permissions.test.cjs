'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const {source}=require('./helpers/active-app').readActiveApp();
function fixture(role,permissions){
 const nodes={'ppto-acciones-lista':{innerHTML:''},'ppto-acciones-card':{style:{}}};
 const c=load({currentRole:role,document:{getElementById:id=>nodes[id]},pptoEstaVencidoParaActualizar:p=>p.expired===true,tienePermiso:key=>permissions.includes(key)},['pptoAccionPermitidaParaRol','renderAcciones']);
 vm.runInContext(source.slice(source.indexOf('var ACCIONES_CONFIG ='),source.indexOf('var pptoActualId =')),c);
 return {c,nodes};
}
const allowed=['presupuestos.editar','ventas.crear'];
for(const role of ['admin','administrativo','vendedor','tecnico_vendedor'])test('conversión usa permisos vigentes para '+role,()=>{
 const {c,nodes}=fixture(role,allowed);
 for(const estado of ['aprobado_int','enviado','visto','aceptado']){const p={estado};assert.equal(c.pptoAccionPermitidaParaRol(p,'convertir_venta'),true);c.renderAcciones(p);assert.match(nodes['ppto-acciones-lista'].innerHTML,/data-ppto-accion="convertir_venta"/);}
});
test('quitar cualquiera de los dos permisos oculta y deniega incluso para admin',()=>{
 for(const permissions of [[],['presupuestos.editar'],['ventas.crear']]){const {c,nodes}=fixture('admin',permissions);const p={estado:'enviado'};assert.equal(c.pptoAccionPermitidaParaRol(p,'convertir_venta'),false);c.renderAcciones(p);assert.doesNotMatch(nodes['ppto-acciones-lista'].innerHTML,/data-ppto-accion="convertir_venta"/);}
});
test('no ofrece otra conversión de un documento vinculado, vencido o sin aprobación',()=>{
 const {c,nodes}=fixture('administrativo',allowed);
 for(const change of [{estado:'convertido'},{estado:'anulado'},{estado:'revision'},{estado:'borrador'},{estado:'rechazado'},{expired:true},{requiereAprobacion:true},{ventaId:'V-EXISTENTE'},{ventaFbKey:'venta-existente'},{ventaGeneradaFbKey:'venta-existente'}]){const p={estado:'enviado',...change},before=JSON.stringify(p);assert.equal(c.pptoAccionPermitidaParaRol(p,'convertir_venta'),false);c.renderAcciones(p);assert.doesNotMatch(nodes['ppto-acciones-lista'].innerHTML,/data-ppto-accion="convertir_venta"/);assert.equal(JSON.stringify(p),before);}
});
