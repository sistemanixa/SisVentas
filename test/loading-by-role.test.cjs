'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const policy=require('../js/core/domain-read-policy.js');
const readiness=fs.readFileSync('js/core/data-readiness.js','utf8');
const active=require('./helpers/active-app').readActiveApp().source;
function setup(role='admin'){
 const window={addEventListener(){},tienePermiso:key=>role==='admin'&&key==='dashboard.metricasGlobales',svPuedeLeerDominio:key=>policy.allows(key,role,module=>(policy.restrictedDefaults[module]||policy.internalRoles).includes(role))};
 const context={URL,window,document:{addEventListener(){}},requestAnimationFrame(){}};
 vm.createContext(context);vm.runInContext(readiness,context);
 return {api:window.SVDataReadiness,context};
}
test('Dashboard de técnico no espera ventas ni cobros que su rol no suscribe',()=>{
 const {api}=setup('tecnico');
 api.begin('https://test/sisventas/clientes').ready();api.begin('https://test/sisventas/productos').ready();
 assert.equal(api.status(['ventas','pagos']).ready,false);
 assert.equal(api.statusFor('dashboard').ready,true);
});
test('Dashboard de admin conserva la espera de ventas y cobros autorizados',()=>{
 const {api}=setup();
 for(const key of ['clientes','productos','ventas'])api.begin('https://test/sisventas/'+key).ready();
 assert.equal(api.statusFor('dashboard').ready,false);
 assert.deepEqual(Array.from(api.statusFor('dashboard').missing),['pagos']);
 api.begin('https://test/sisventas/pagos').ready();assert.equal(api.statusFor('dashboard').ready,true);
});
test('consultas propias combinadas no muestran una colección parcial como completa',()=>{
 const {api}=setup(),first=api.begin('https://test/sisventas/gastos'),second=api.begin('https://test/sisventas/gastos');
 first.ready();assert.equal(api.status(['gastos']).ready,false);
 second.ready();assert.equal(api.status(['gastos']).ready,true);
});
test('el éxito de una fuente no borra el error de otra, ni el error al cancelar una consulta denegada',()=>{
 const {api}=setup(),first=api.beginSource('gastos'),second=api.beginSource('gastos');
 first.error();second.ready();assert.deepEqual(Array.from(api.status(['gastos']).errors),['gastos']);
 first.cancel();assert.deepEqual(Array.from(api.status(['gastos']).errors),['gastos']);
 const retry=api.beginSource('gastos');retry.ready();assert.equal(api.status(['gastos']).ready,true);assert.equal(api.status(['gastos']).errors.length,0);
});
function directory(name,role='administrativo'){
 const {api,context}=setup(role);const calls=[];
 Object.assign(context,{currentUserUid:'fixture',SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},svPuedeLeerDominio:()=>false,permisoModulo:()=>true,
  setInterval:()=>1,clearInterval(){},console:{error(){}},fetch:async()=>({ok:true,json:async()=>({ok:true,empleados:{},proveedores:{}})})});
 Object.assign(context.window,{_svModuleListeners:{},SVServiceAuth:{headers:async()=>({})}});
 const start=active.indexOf('function '+name+'('),end=active.indexOf('\n}',start)+2;
 vm.runInContext(active.slice(start,end),context);
 return{api,context,calls,subscribe:callback=>context[name](callback)};
}
for(const [name,key]of [['svEscucharDirectorioEmpleados','empleados'],['svEscucharProveedores','proveedores']]){
 test(name+' reconoce el directorio reducido solo después de procesarlo',async()=>{
  const x=directory(name);let processed=false;
  x.subscribe(snap=>{assert.equal(x.api.status([key]).ready,false);assert.deepEqual(snap.val(),{});processed=true;});
  for(let i=0;i<10;i++)await Promise.resolve();
  assert.equal(processed,true);assert.equal(x.api.status([key]).ready,true);
 });
 test(name+' muestra fallo sin inventar una colección vacía',async()=>{
  const x=directory(name);x.context.fetch=async()=>{throw Error('offline');};
  x.subscribe(()=>assert.fail('No entregar datos ante un error'));
  for(let i=0;i<10;i++)await Promise.resolve();
  assert.equal(x.api.status([key]).ready,false);assert.deepEqual(Array.from(x.api.status([key]).errors),[key]);
 });
 test(name+' ignora la respuesta de una sesión cerrada',async()=>{
  const x=directory(name);let release;x.context.fetch=()=>new Promise(resolve=>release=resolve);
  x.subscribe(()=>assert.fail('No reutilizar directorio de otra sesión'));
  for(let i=0;i<4;i++)await Promise.resolve();
  x.context.currentUserUid='otra';x.api.reset();release({ok:true,json:async()=>({ok:true,empleados:{},proveedores:{}})});
  for(let i=0;i<10;i++)await Promise.resolve();
  assert.equal(x.api.status([key]).ready,false);
 });
}
