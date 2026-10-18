'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {M,seed,run,statement,actor,now,command,memoryDB}=require('./helpers/private-finance-fixtures.cjs');
const movement={id:'charge-example',date:'2026-10-01',concept:'MAPFRE 000123',amount:100001,currency:'ARS',kind:'Consumo',origin:'PDF',page:1};
const initial=()=>run(seed(),'statement-save',{...statement,movements:[movement]});
test('sugiere aseguradoras abreviadas sin modificar importes ni confirmar pólizas',()=>{
 for(const concept of ['MAPFRE 000123','ZURICH 123','LA CAJA','FEDERACION PAT 001','Galicia Seguro','SEGUROS SUDAM','BBVA SEGUROS']){const m={...movement,concept},before=structuredClone(m);assert.equal(M.suggestCategory(m),'Seguro');assert.deepEqual(m,before);}
 for(const concept of ['BBVA','BANCO GALICIA','Caja de herramientas','SUPERMERCADO','PAGO ZURICH'])assert.equal(M.suggestCategory({...movement,concept,kind:concept==='PAGO ZURICH'?'Pago del período anterior':'Consumo'}),'');
 for(const change of [{amount:-1},{kind:'Interés'},{kind:'Impuesto'},{category:'Servicios'},{postClose:true}])assert.equal(M.suggestCategory({...movement,...change}),'');
});
test('clasificar guarda sólo categoría, conserva contabilidad, original y auditoría',()=>{
 const before=initial(),after=run(before,'movement-classify',{id:movement.id,category:'Servicios',amount:999,currency:'USD',date:'2000-01-01',kind:'Ajuste'});
 const expected={...before.movements[0],category:'Servicios',updatedAt:now,revision:before.movements[0].revision+1};assert.deepEqual(after.movements[0],expected);
 for(const group of ['statements','payments','documents','installments','insurances'])assert.deepEqual(after[group],before[group]);assert.equal(M.totalDebt(after),M.totalDebt(before));assert.equal(after.history[0].action,'movement-classify');assert.equal(after.history[0].changes[0].before[0].category,'');assert.equal(after.history[0].changes[0].after[0].category,'Servicios');
 assert.equal(before.movements[0].category,'');
});
test('seguro crea un único candidato, no póliza confirmada, ni pagos ni nuevos cargos',()=>{
 let s=initial();s=run(s,'movement-classify',{id:movement.id,category:'Seguro'});const insurance=structuredClone(s.insurances);
 assert.equal(s.insurances.length,1);assert.equal(s.insurances[0].classification,'Por confirmar');assert.equal(s.insurances[0].coverage,'');assert.equal(s.payments.length,0);assert.equal(s.movements.length,1);
 s=run(s,'movement-classify',{id:movement.id,category:'Seguro'});assert.deepEqual(s.insurances,insurance);
 s=run(s,'movement-classify',{id:movement.id,category:'Otros'});assert.deepEqual(s.insurances,insurance); // Las decisiones del registro se gestionan por separado.
});
test('revisión del resumen conserva categoría por ID y sus vínculos',()=>{
 let s=run(initial(),'movement-classify',{id:movement.id,category:'Seguro'});const before=structuredClone(s.insurances);
 s=run(s,'statement-save',{...statement,movements:[movement]});assert.equal(s.movements[0].category,'Seguro');assert.equal(s.insurances.length,1);assert.deepEqual(s.insurances[0].charges,before[0].charges);
 assert.throws(()=>run(s,'movement-classify',{id:movement.id,category:'inventada'}),e=>e.statusCode===400);
 assert.throws(()=>run(s,'movement-classify',{id:'no-existe',category:'Seguro'}),e=>e.statusCode===404);
});
test('no permite categorizar pagos, intereses, impuestos o conversiones como seguro',()=>{
 for(const kind of ['Interés','Impuesto','Conversión','Ajuste','Pago del período anterior']){const s=run(seed(),'statement-save',{...statement,movements:[{...movement,kind}]});assert.throws(()=>run(s,'movement-classify',{id:movement.id,category:'Seguro'}),e=>e.statusCode===400);assert.throws(()=>run(seed(),'statement-save',{...statement,movements:[{...movement,kind,category:'Seguro'}]}),e=>e.statusCode===400);}
});
test('clasificación de una lectura pendiente queda local hasta Guardar resumen',async()=>{
 const fs=require('fs'),vm=require('vm'),source=fs.readFileSync('js/modules/private-finance-ui.js','utf8'),calls=[];
 const context={M,stage:{movements:[structuredClone(movement)]},dialogContext:{fromStage:true,movement:movement.id},FormData:class {constructor(){return [['category','Alimentación']][Symbol.iterator]();}},closeModal(){calls.push('cerrar');},render(){},toast(){},mutate(){throw Error('No debe escribir en el servidor');}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function submit(f){'),source.indexOf('function showError(')),context);
 await context.submit({dataset:{kind:'movementcategory'}});assert.equal(context.stage.movements[0].category,'Alimentación');assert.equal(context.stage.movements[0].amount,movement.amount);assert.deepEqual(calls,['cerrar']);
});
test('servicio mantiene titular exclusivo, conflicto concurrente e idempotencia',async()=>{
 const {createPrivateFinance}=require('../cotizador/private-finance'),s=initial(),db=memoryDB({sv_chat_roles:{[actor.uid]:{activo:true,rol:'admin'},other:{activo:true,rol:'admin'}},sv_personal_finance:{[actor.uid]:s}});
 const service=createPrivateFinance({db,auth:{verifyIdToken:async uid=>({uid})},ownerUid:actor.uid,enabled:true,now:()=>now}),auth=await service.authorize({headers:{authorization:'Bearer '+actor.uid}});
 await assert.rejects(service.authorize({headers:{authorization:'Bearer other'}}),e=>e.statusCode===403);
 const op=command(s,'movement-classify',{id:movement.id,category:'Seguro'});await service.save(auth,op);const replay=await service.save(auth,op);assert.equal(replay.state.insurances.length,1);
 await assert.rejects(service.save(auth,command(s,'movement-classify',{id:movement.id,category:'Servicios'})),e=>e.statusCode===409);
});
