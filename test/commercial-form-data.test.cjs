'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Contract=require('../js/core/commercial-form-data.v1.js'),{functionSource}=require('./helpers/app-functions.cjs');

function application(){const calls=[],source=functionSource('svCargarDatosDePaginaActual'),c={window:null,document:{querySelector:()=>null},permisoModulo:()=>true,SVCommercialFormData:Contract};c.window=c;
 for(const match of source.matchAll(/\b(?:fbCargar\w+|cargarKits|cargarCargos|svCargarInicioDashboardDemandado|spCargar)\b/g))c[match[0]]=()=>calls.push(match[0]);
 vm.createContext(c);vm.runInContext(source,c);return {c,calls};}

test('venta y presupuesto usan la misma declaración para solicitar datos y esperar directorio',()=>{
 for(const [page,records]of [['venta','ventas'],['presupuesto','presupuestos']]){
  const {c,calls}=application();c.svCargarDatosDePaginaActual(page);
  assert.deepEqual(calls,['fbCargarClientes','fbCargarProductos',records==='ventas'?'fbCargarVentas':'fbCargarPresupuestos','fbCargarEmpleados','fbCargarClientesUnificados']);
  const context={URL,window:{SVCommercialFormData:Contract,addEventListener(){}},document:{addEventListener(){}},requestAnimationFrame(){}};
  vm.runInNewContext(fs.readFileSync('js/core/data-readiness.js','utf8'),context);const load=context.window.SVDataReadiness;
  assert.deepEqual(Array.from(load.requirementsFor(page)),Contract.requirements(page));
  for(const key of ['clientes','productos',records])load.beginSource(key).ready();
  assert.equal(load.statusFor(page).ready,false);assert.deepEqual(Array.from(load.statusFor(page).missing),['empleados']);
  const directory=load.beginSource('empleados','directorio-reducido-ficticio');directory.error('Directorio no disponible');assert.equal(load.statusFor(page).ready,false);
  directory.ready();assert.equal(load.statusFor(page).ready,true);
  load.reset();directory.ready();assert.equal(load.statusFor(page).ready,false,'respuesta de sesión anterior no habilita el formulario');
 }
});

test('el contrato no se puede alterar desde un consumidor ni omitir un cargador necesario',()=>{
 const keys=Contract.requirements('venta');keys.pop();assert.equal(Contract.requirements('venta').length,4);
 assert.throws(()=>Contract.loaders('venta',{clientes(){}}),/preparar/);assert.equal(Contract.requirements('otro'),null);
});
