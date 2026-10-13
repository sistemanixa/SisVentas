const fs=require('fs');
const test=require('node:test'),assert=require('node:assert/strict'),{createLaborOperations}=require('../cotizador/labor-operations');
function setup(){let root={empleados:{e:{nombre:'Empleado',cargoId:'c'}},config:{cargos:{c:{valorHoraExtra:100}}},hsextra_solicitudes:{a:{estado:'pendiente',empFbKey:'e',empNombre:'Empleado',mes:'2026-10',fecha:'2026-10-12',horas:2},b:{estado:'pendiente',empFbKey:'e',empNombre:'Empleado',mes:'2026-10',fecha:'2026-10-12',horas:3}},gastos:{},ventas:{sentinel:true}};const db={ref:path=>({get:async()=>({val:()=>path.startsWith('sv_chat_roles')?{activo:true,rol:'admin'}:{}}),transaction:async fn=>{const next=fn(structuredClone(root));if(next)root=next;return {committed:!!next};}})};return {svc:createLaborOperations({db,auth:{verifyIdToken:async()=>({uid:'admin'})},now:()=>1791817200000}),root:()=>root};}
test('Horas agrupadas guardan solicitud y gasto juntos, conservan otros nodos y permiten reintento sin duplicar',async()=>{const {svc,root}=setup();const body={claves:['a','b'],monto:500};await svc.approve({nombre:'Admin'},body);await svc.approve({nombre:'Admin'},body);assert.equal(Object.keys(root().gastos).length,1);assert.equal(root().hsextra_solicitudes.a.monto,200);assert.equal(root().hsextra_solicitudes.b.monto,300);assert.equal(root().ventas.sentinel,true);});
test('Valor hora cambiado o solicitud rechazada no produce ningún gasto',async()=>{const {svc,root}=setup();await assert.rejects(svc.approve({nombre:'Admin'},{claves:['a'],monto:1}),{statusCode:409});assert.equal(Object.keys(root().gastos).length,0);root().hsextra_solicitudes.a.estado='rechazado';await assert.rejects(svc.approve({nombre:'Admin'},{claves:['a'],monto:200}),{statusCode:409});});
test('Dos aprobaciones superpuestas no generan gastos duplicados',async()=>{const {svc,root}=setup();const r=await Promise.allSettled([svc.approve({nombre:'Admin'},{claves:['a','b'],monto:500}),svc.approve({nombre:'Admin'},{claves:['a'],monto:200})]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(Object.keys(root().gastos).length,1);});
test('Aprobación individual conserva claves legacy y monto',async()=>{const {svc,root}=setup();await svc.approve({nombre:'Admin'},{claves:['a'],monto:200,individual:true});assert.equal(root().gastos.hextra_a.legacyKey,'hsextra_solicitudes/a');assert.equal(root().gastos.hextra_a.monto,200);});
test('El endpoint exige sesión antes de acceder a datos',async()=>{const {svc}=setup();await assert.rejects(svc.authorize({headers:{}}),{statusCode:401});});

test('Aguinaldos usan únicamente Gastos y dos registros del semestre no se duplican',async()=>{
 const vm=require('vm'),src=fs.readFileSync('js/app.v3.10.28.js','utf8'),calc=require('../cotizador/labor-calculations');let expenses={};
 const c={window:{fbDB:{},fbRef:(_,path)=>{assert.equal(path,'sisventas/gastos');return path;},fbRunTransaction:async(_,fn)=>{expenses=fn(structuredClone(expenses));return {committed:true};}},_claveOperacionConcurrente:calc._claveOperacionConcurrente,_pagableGastoBase:calc._pagableGastoBase,Date,parseFloat};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('function _guardarAguinaldosAtomico('),src.indexOf('async function confirmarRegistroAguinaldo(')),c);
 const rows=[{aguinaldo:500,e:{fbKey:'e',nombre:'Empleado'},mejorSueldo:1000}];await Promise.all([c._guardarAguinaldosAtomico(rows,'2026_S2','2026-12-01','2do semestre'),c._guardarAguinaldosAtomico(rows,'2026_S2','2026-12-01','2do semestre')]);assert.equal(Object.keys(expenses).length,1);assert.equal(expenses.aguinaldo_e_2026_S2.monto,500);
});
test('La transacción REST reintenta un conflicto con datos nuevos y no pisa cambios concurrentes',async()=>{
 const {createRootTransaction}=require('../cotizador/labor-transaction');let reads=0,writes=0,bodies=[];
 const transaction=createRootTransaction({databaseURL:'https://demo.test',accessToken:async()=>'token',fetchImpl:async(url,opts)=>{if(!opts.method){reads++;return {ok:true,headers:{get:()=>String(reads)},json:async()=>({ventas:{concurrente:reads}})};}writes++;bodies.push(JSON.parse(opts.body));assert.equal(opts.headers['if-match'],String(reads));return {status:writes===1?412:200,ok:writes>1};}});
 const r=await transaction(root=>({...root,gastos:{nuevo:1}}));assert.equal(r.committed,true);assert.equal(bodies[1].ventas.concurrente,2);assert.equal(writes,2);
});

test('La autorización real rechaza inactivos y permisos bloqueados, sin confiar en el rol del cliente',async()=>{
 for(const [identity,cfg] of [[{activo:false,rol:'admin'},{}],[{activo:true,rol:'distribuidora'},{}],[{activo:true,rol:'admin'},{bloqueados:['empleados']}],[{activo:true,rol:'admin'},{acciones:{empleados:{autorizarHoras:false}}}]]){
  const svc=createLaborOperations({auth:{verifyIdToken:async(_,revoked)=>{assert.equal(revoked,true);return {uid:'u'};}},db:{ref:path=>({get:async()=>({val:()=>path.startsWith('sv_chat_roles')?identity:cfg})})}});await assert.rejects(svc.authorize({headers:{authorization:'Bearer valido'}}),{statusCode:403});
 }
});

test('El módulo que se carga al final usa el guardado atómico y bloquea doble clic',async()=>{
 const vm=require('vm');let saves=0,pushes=0;
 const nodes={'agu-sem-sel':{value:'2026-2'},'agu-fecha':{value:'2026-12-01'},'modal-aguinaldo':{dataset:{},remove(){}}};
 const window={fbDB:{},empData:{e:{fbKey:'e',nombre:'Empleado'}},gastosData:[],tienePermiso:()=>true,fbGet:async()=>({val:()=>({})}),fbRef:(_,p)=>p,fbPush:()=>{pushes++;}};
 const c={window,document:{addEventListener(){},querySelector:()=>({checked:true}),getElementById:id=>nodes[id]},notify(){},_sv348EmpleadoSeleccionado:()=>true,_calcularFilasAguinaldo:()=>[{e:{fbKey:'e',nombre:'Empleado'},aguinaldo:500}],_guardarAguinaldosAtomico:async()=>{saves++;return {committed:true};},Date,Set,Object,Array,Number,Math,parseInt};vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/payroll.js','utf8'),c);await Promise.all([window.confirmarRegistroAguinaldo(),window.confirmarRegistroAguinaldo()]);assert.equal(saves,1);assert.equal(pushes,0);assert.equal(window._aguinaldoGuardando,false);
});
