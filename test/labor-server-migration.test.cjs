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
 let cancelaciones=0;
 const transaction=createRootTransaction({databaseURL:'https://demo.test',accessToken:async()=>'token',fetchImpl:async(url,opts)=>{if(!opts.method){reads++;return {ok:true,headers:{get:()=>String(reads)},json:async()=>({ventas:{concurrente:reads}})};}assert.equal(url,"https://demo.test/sisventas.json");writes++;bodies.push(JSON.parse(opts.body));assert.equal(opts.headers['if-match'],String(reads));return {status:writes===1?412:204,ok:writes>1,body:{cancel:async()=>{cancelaciones++;}}};}});
 const r=await transaction(root=>({...root,gastos:{nuevo:1}}));assert.equal(r.committed,true);assert.equal(bodies[1].ventas.concurrente,2);assert.equal(writes,2);
 assert.equal(cancelaciones,2);
});

test('La autorización real rechaza inactivos y permisos bloqueados, sin confiar en el rol del cliente',async()=>{
 for(const [identity,cfg] of [[{activo:false,rol:'admin'},{}],[{activo:true,rol:'distribuidora'},{}],[{activo:true,rol:'admin'},{bloqueados:['ctaemp']}],[{activo:true,rol:'admin'},{acciones:{empleados:{autorizarHoras:false}}}]]){
  const svc=createLaborOperations({auth:{verifyIdToken:async(_,revoked)=>{assert.equal(revoked,true);return {uid:'u'};}},db:{ref:path=>({get:async()=>({val:()=>path.startsWith('sv_chat_roles')?identity:cfg})})}});await assert.rejects(svc.authorize({headers:{authorization:'Bearer valido'}}),{statusCode:403});
 }
});
test('un conflicto reutiliza datos vigentes y su ETag, preservando la actualización ajena',async()=>{
 const {createRootTransaction}=require('../cotizador/labor-transaction');let reads=0,writes=0;
 const transaction=createRootTransaction({databaseURL:'https://demo.test',accessToken:async()=>'token',fetchImpl:async(url,opts)=>{
  if(!opts.method){reads++;return {ok:true,headers:{get:()=> 'v1'},json:async()=>({ventas:{ajena:1}})};}
  writes++;if(writes===1)return {status:412,ok:false,headers:{get:()=> 'v2'},json:async()=>({ventas:{ajena:2}})};
  assert.equal(opts.headers['if-match'],'v2');assert.equal(JSON.parse(opts.body).ventas.ajena,2);return {status:200,ok:true};
 }});assert.equal((await transaction(r=>({...r,gastos:{nuevo:1}}))).committed,true);assert.equal(reads,1);assert.equal(writes,2);
});

test('El módulo que se carga al final usa el guardado atómico y bloquea doble clic',async()=>{
 const vm=require('vm'),{createBackend}=require('./helpers/labor-ui-flow.cjs');
 const employee={nombre:'Persona ficticia',cargoId:'c'},haberes={e:{'2026_07':{sueldo:1000}}};
 const backend=createBackend({empleados:{e:employee},haberes}),page=backend.page(),c=page.context;
 c.empData={e:{...employee,fbKey:'e'}};
 page.node('agu-sem-sel').value='2026-2';page.node('agu-fecha').value='2026-12-01';
 page.load(['_mesesDelSemestre','_mesesTrabajadosEnSemestre','_calcularFilasAguinaldo']);
 vm.runInContext(fs.readFileSync('js/core/payroll-source-snapshot.js','utf8'),c);
 vm.runInContext(fs.readFileSync('js/modules/payroll.js','utf8'),c);
 // Modal lifecycle is covered separately; this adapter invokes the real final
 // handler, source builder and gateway instead of mocking the saved amount.
 c.SVPayrollSemester={captureConfirmation:()=>({employees:[c.empData.e],haberes,period:{year:2026,half:2},maximum:''}),
  assertConfirmation(){},saving(){},confirmed:()=>true,close(){}};
 await Promise.all([c.confirmarRegistroAguinaldo(),c.confirmarRegistroAguinaldo()]);
 assert.equal(backend.commands.length,1);assert.equal(backend.commits.length,1);
 assert.equal(backend.get('sisventas/gastos/aguinaldo_e_2026_S2').monto,500);
 assert.ok(Object.hasOwn(backend.commands[0].expectedHashes,'sisventas/haberes/e'));
 assert.deepEqual(backend.direct,[]);assert.equal(c._aguinaldoGuardando,false);
});
