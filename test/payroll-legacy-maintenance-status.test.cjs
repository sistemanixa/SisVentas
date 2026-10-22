'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
function extract(source,name){const begin=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(begin>=0);const ends=/^\}/gm;ends.lastIndex=begin;for(let end;(end=ends.exec(source));){const text=source.slice(begin,end.index+1);try{new vm.Script(text);return text;}catch(_){}}throw Error('Function incomplete');}
function fixture({fail='',unconfirmed=false,allowed=true}={}){
 const reads=[],batches=[],writes=[],messages=[],states=[],logs=[];
 const c={Date,Math,Promise,Object,Array,String,Number,parseFloat,parseInt,console,
  _migracionPagablesLegacyEjecutada:false,_migracionPagablesLegacyEnCurso:false,
  currentRole:'admin',currentUser:'Admin ficticio',empData:{e:{fbKey:'e',nombre:'Persona ficticia'}},gastosData:[],CARGOS_DATA:{},
  fbDB:{},tienePermiso:()=>allowed,fbRef:(_,path='')=>({path}),
  fbGet:async ref=>{reads.push(ref.path);if(fail===ref.path)throw Error('Lectura ficticia rechazada');const source={
   'sisventas/aguinaldos':{e:{'2026_S1':{monto:100},'2026_S2':{monto:200}}},
   'sisventas/ctaemp':{e:{old:{tipo:'aguinaldo',monto:80,estado:'pagado'}}},'sisventas/hsextra_solicitudes':{}
  };return{val:()=>structuredClone(source[ref.path]||{})};},
  fbUpdate:async(ref,value)=>writes.push(structuredClone(value)),fbPush:()=>{throw Error('No crear SAC por SDK');},
  SVPayrollLegacySAC:{migrateMany:async paths=>{batches.push([...paths]);if(fail==='batch')throw Error('Guardado ficticio rechazado');return{committed:!unconfirmed,createdCount:3};}},
  registrarActividad(){},notify:msg=>messages.push(msg),MNT_STATE:{analizado:true},
  mntRequireAdmin:()=>allowed,mntSetEstado:(...args)=>states.push(args),mntLog:msg=>logs.push(msg),
  mntAnalizarBase:async()=>{},mntVersion:()=> 'v3.14.7',
  mntGet:async()=>{throw Error('No continuar otras migraciones tras fallo SAC');}
 };
 c.window=c;load(c,['_pagableNormMonto','_migrarPagablesLegacyAGastos']);
 vm.runInContext(extract(fs.readFileSync('js/modules/maintenance.js','utf8'),'mntMigrarLegacy'),c);
 return{c,reads,batches,writes,messages,states,logs};
}
test('migración manual agrupa todos los SAC en un solo contrato y no usa push para crearlos',async()=>{
 const f=fixture();await f.c._migrarPagablesLegacyAGastos();
 assert.deepEqual(f.reads,['sisventas/aguinaldos','sisventas/ctaemp','sisventas/hsextra_solicitudes']);
 assert.deepEqual(f.batches,[['sisventas/aguinaldos/e/2026_S1','sisventas/aguinaldos/e/2026_S2','sisventas/ctaemp/e/old']]);
 assert.equal(f.c._ultimaMigracionPagablesLegacy.ejecutada,true);assert.equal(f.c._ultimaMigracionPagablesLegacy.creados,3);
 assert.deepEqual(f.writes,[]);assert.equal(f.c._migracionPagablesLegacyEnCurso,false);
});
for(const fail of ['sisventas/aguinaldos','sisventas/ctaemp','sisventas/hsextra_solicitudes','batch'])test('fallo '+fail+' no se oculta como una migración completada',async()=>{
 const f=fixture({fail});await assert.rejects(f.c._migrarPagablesLegacyAGastos(),/fictici/);
 assert.equal(f.c._ultimaMigracionPagablesLegacy.ejecutada,false);assert.equal(f.c._migracionPagablesLegacyEjecutada,false);
 assert.equal(f.c._migracionPagablesLegacyEnCurso,false);assert.equal(f.batches.length,fail==='batch'?1:0);assert.deepEqual(f.writes,[]);
 assert.ok(!f.messages.some(msg=>/completada/.test(msg)));
});
test('un resultado no confirmado no se considera éxito ni habilita una marca ejecutada',async()=>{
 const f=fixture({unconfirmed:true});await assert.rejects(f.c._migrarPagablesLegacyAGastos(),/confirmar/);
 assert.equal(f.c._ultimaMigracionPagablesLegacy.ejecutada,false);assert.equal(f.c._migracionPagablesLegacyEjecutada,false);
});
test('Mantenimiento no continúa ni escribe estados OK si SAC no se confirmó',async()=>{
 const f=fixture({fail:'batch'});assert.equal(await f.c.mntMigrarLegacy(),false);
 assert.deepEqual(f.writes,[]);assert.deepEqual(f.states.at(-1),['Migración incompleta','b-amber']);
 assert.ok(f.messages.some(msg=>/No se completó/.test(msg)));assert.ok(!f.messages.some(msg=>/✓/.test(msg)));
});
test('sin permiso no consulta fuentes ni guarda estados de migración',async()=>{
 const f=fixture({allowed:false});await assert.rejects(f.c._migrarPagablesLegacyAGastos(),/Sin permiso/);
 await f.c.mntMigrarLegacy();assert.deepEqual(f.reads,[]);assert.deepEqual(f.writes,[]);assert.deepEqual(f.batches,[]);
});

test('la función activa de migración llega al modelo, transporte, gateway y guard en un único lote SAC',async()=>{
 const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
 const backend=createBackend({empleados:{a:{nombre:'Ana ficticia'},b:{nombre:'Bea ficticia'}},
  aguinaldos:{a:{'2026_S2':{monto:100,fecha:'2026-07-01',estado:'pagado',montoPagado:100,pagos:{p:{monto:100,fecha:'2026-08-01'}}}}},
  ctaemp:{b:{old:{tipo:'aguinaldo',semestre:'2026_S1',monto:200,fecha:'2026-06-01',montoPagado:50,pagos:{p:{monto:50,fecha:'2026-07-01'}}}}},
  gastos:{},hsextra_solicitudes:{}}),page=backend.page(),c=page.context;
 c._migracionPagablesLegacyEjecutada=false;c._migracionPagablesLegacyEnCurso=false;
 c.empData={a:{fbKey:'a',nombre:'Ana ficticia'},b:{fbKey:'b',nombre:'Bea ficticia'}};
 c.svCapturarContextoOperacion=()=>()=>true;
 load(c,['_migrarPagablesLegacyAGastos']);
 for(const file of ['js/core/payroll-legacy-sac-model.js','js/modules/payroll-legacy-sac.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
 const original=copy(backend.state.sisventas);
 await c._migrarPagablesLegacyAGastos();
 assert.equal(backend.commands.length,1);assert.equal(backend.commands[0].purpose,'employee-sac-migration');
 assert.equal(backend.commits.length,1);assert.deepEqual(backend.direct,[]);
 const expenses=Object.values(backend.get('sisventas/gastos'));
 assert.equal(expenses.length,2);assert.deepEqual(expenses.map(g=>[g.empleadoId,g.monto,g.montoPagado,g.estado]).sort(),
  [['a',100,100,'pagado'],['b',200,50,'pagado_parcial']]);
 assert.deepEqual(backend.get('sisventas/aguinaldos/a/2026_S2/pagos'),original.aguinaldos.a['2026_S2'].pagos);
 assert.deepEqual(backend.get('sisventas/ctaemp/b/old/pagos'),original.ctaemp.b.old.pagos);
 assert.equal(backend.reads.filter(([kind,path])=>kind==='client'&&path==='sisventas/gastos').length,1,
  'Todas las fuentes SAC comparten una sola lectura de Gastos en la preparación CAS');
 const before=copy(backend.state.sisventas);c._migracionPagablesLegacyEjecutada=false;
 await c._migrarPagablesLegacyAGastos();
 assert.equal(backend.commits.length,1);assert.deepEqual(backend.state.sisventas,before);
 assert.equal(c._ultimaMigracionPagablesLegacy.ejecutada,true);assert.equal(c._ultimaMigracionPagablesLegacy.creados,0);
});
