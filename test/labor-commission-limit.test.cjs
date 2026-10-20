'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{isDeepStrictEqual}=require('node:util');
const {validateCommissionLimit}=require('../cotizador/labor-commission-limit');
const Index=require('../cotizador/labor-index');
const {createLaborGuard,child,put,parts,digest}=require('../cotizador/labor-guard');
const {normalizarEstadoGasto}=require('../cotizador/commission-calculations');
const copy=value=>structuredClone(value);
const commission=(pct,extra={})=>({tipoPagable:'comision',ventaFbKey:'sale',pct,monto:100,estado:'aprobado',...extra});
const limit=error=>error.code==='SV_LABOR_COMMISSION_LIMIT'&&error.statusCode===409;
const invalidIndex=error=>error.code==='SV_LABOR_INDEX_INVALID'&&error.statusCode===503;
function fixture({gastos={},ctaemp={},max=10,patch={}}={}){
 let data={sisventas:{gastos:copy(gastos),ctaemp:copy(ctaemp),config:{maxComisionPct:max}},sv_labor_config:{ready:true,schema:Index.VERSION}};
 for(const [path,value]of Object.entries(Index.buildIndex(data.sisventas)))data=put(data,parts(path),value);
 const calls=[];
 const raw=async path=>{calls.push(['raw',path]);return child(data,parts(path));};
 const get=async path=>{calls.push(['get',path]);let result=data;for(const [p,v]of Object.entries(patch))result=put(result,parts(p),v);return child(result,parts(path));};
 function changes(){let next=data;for(const [p,v]of Object.entries(patch))next=put(next,parts(p),v);return [...new Set([...Object.keys(data.sisventas.gastos||{}),...Object.keys(next.sisventas.gastos||{})])].filter(key=>!isDeepStrictEqual(data.sisventas.gastos?.[key],next.sisventas.gastos?.[key])).map(key=>({domain:'gastos',key,before:copy(data.sisventas.gastos?.[key]??null),after:copy(next.sisventas.gastos?.[key]??null)}));}
 return {get data(){return data;},patch,calls,raw,get,changes,run:()=>validateCommissionLimit({raw,get,changes:changes(),patch}),set(path,value){data=put(data,parts(path),value);}};
}
function assertScoped(f){assert.ok(f.calls.every(([,path])=>!['sisventas','sisventas/gastos','sisventas/ctaemp','sisventas/config'].includes(path)),JSON.stringify(f.calls));}

test('el grupo completo, incluidos otros empleados, admite exactamente el tope sin modificar históricos',async()=>{
 const f=fixture({gastos:{existing:commission(6,{empleadoId:'another'})},patch:{'sisventas/gastos/new':commission(4,{empleadoId:'me'})}}),before=copy(f.data);
 assert.deepEqual(await f.run(),{checked:1});assert.deepEqual(f.data,before);assertScoped(f);
 assert.ok(f.calls.some(([,p])=>p==='sisventas/gastos/existing'));
});
test('una comisión nueva no supera el total global aunque el cliente sólo envíe su participante',async()=>{
 const f=fixture({gastos:{existing:commission(6)},patch:{'sisventas/gastos/new':commission(5)}});
 await assert.rejects(f.run(),limit);assertScoped(f);
});
test('tope fresco conserva Number(config)||10 y la tolerancia de redistribución',async()=>{
 for(const max of [undefined,0,'0','no-numérico']){
  const f=fixture({max,patch:{'sisventas/gastos/new':commission(10.002)}});await assert.rejects(f.run(),limit);
 }
 const f=fixture({max:'12',patch:{'sisventas/gastos/new':commission(12.001)}});await f.run();
});
test('bajar el tope solo o pagar/editar sin impacto no bloquea un grupo histórico ya excedido',async()=>{
 const gastos={a:commission(8),b:commission(8)};
 for(const patch of [
  {'sisventas/config/maxComisionPct':4},
  {'sisventas/gastos/a/pagos/p':{monto:100,ts:1}},
  {'sisventas/gastos/a/descripcion':'Detalle conservado'},
  {'sisventas/gastos/a/pct':7},
  {'sisventas/gastos/a/estado':'rechazado'}
 ]){const f=fixture({gastos,patch});await f.run();assertScoped(f);}
 const f=fixture({gastos,patch:{'sisventas/gastos/a/pct':8.01}});await assert.rejects(f.run(),limit);
});
test('la pagada/parcial conserva porcentaje de CTA y saldo legacy aun con el nuevo pago anulado',async()=>{
 const before=commission(9,{legacyKey:'ctaemp/e/m',montoPagado:80}),after={...before,saldoPagadoLegacy:80,pagos:{p:{monto:5,anulado:true}}};
 assert.equal(normalizarEstadoGasto(before),'pagado_parcial');assert.equal(normalizarEstadoGasto(after),'pagado_parcial');
 const f=fixture({gastos:{paid:before},ctaemp:{e:{m:{pct:2}}},patch:{'sisventas/gastos/paid':after,'sisventas/gastos/new':commission(8)}});
 await f.run();assert.equal(f.data.sisventas.gastos.paid.pagos,undefined);assertScoped(f);
 f.patch['sisventas/gastos/new']=commission(8.1);await assert.rejects(f.run(),limit);
});
test('CTA modificada sola descubre todos los gastos vinculados y comprueba su grupo global',async()=>{
 const f=fixture({gastos:{a:commission(1,{legacyKey:'ctaemp/e/m'}),b:commission(6)},ctaemp:{e:{m:{pct:2}}},patch:{'sisventas/ctaemp/e/m/pct':5}});
 assert.deepEqual(f.changes(),[]);await assert.rejects(f.run(),limit);assertScoped(f);
 assert.ok(f.calls.some(([,p])=>p===Index.bucketPath('gastos','legacyKey','ctaemp/e/m')));
});
test('una descripción porcentual de CTA y los vínculos duplicados se cuentan como el cálculo real',async()=>{
 const f=fixture({gastos:{a:commission(0,{legacyKey:'ctaemp/e/m'}),b:commission(0,{legacyKey:'ctaemp/e/m'})},ctaemp:{e:{m:{descripcion:'Comisión 4%'}}},patch:{'sisventas/ctaemp/e/m/descripcion':'Comisión 6%'}});
 await assert.rejects(f.run(),limit);assertScoped(f);
});
test('reemplazar una cuenta exacta compara sus movimientos sin leer todas las cuentas',async()=>{
 const f=fixture({gastos:{a:commission(2,{legacyKey:'ctaemp/e/m'}),b:commission(6)},ctaemp:{e:{m:{pct:2},unrelated:{monto:50}},other:{huge:'ficticio'}},patch:{'sisventas/ctaemp/e':{m:{pct:5},unrelated:{monto:50}}}});
 await assert.rejects(f.run(),limit);assertScoped(f);assert.ok(f.calls.some(([,p])=>p==='sisventas/ctaemp/e'));assert.ok(!f.calls.some(([,p])=>p==='sisventas/ctaemp/other'));
});
test('cambio de grupo y rehabilitación de rechazado se validan; rechazar o conservar rechazo no suma',async()=>{
 const f=fixture({gastos:{a:commission(4,{ventaFbKey:'old'}),b:commission(8)},patch:{'sisventas/gastos/a/ventaFbKey':'sale'}});await assert.rejects(f.run(),limit);
 const rejected=fixture({gastos:{a:commission(4,{estado:'rechazado'}),b:commission(8)},patch:{'sisventas/gastos/a/estado':'aprobado'}});await assert.rejects(rejected.run(),limit);
 const stillRejected=fixture({gastos:{a:commission(4,{estado:'rechazado'}),b:commission(8)},patch:{'sisventas/gastos/a/pct':99}});await stillRejected.run();
});
test('sólo rechazado queda excluido: anulado continúa aportando como en redistribución',async()=>{
 const f=fixture({gastos:{a:commission(7,{estado:'anulado'})},patch:{'sisventas/gastos/new':commission(4)}});await assert.rejects(f.run(),limit);
});
test('el grupo sin venta usa la clave real e ignora fbKey histórico embebido',async()=>{
 const f=fixture({gastos:{actual:commission(12,{ventaFbKey:null,fbKey:'incorrecto'})},patch:{'sisventas/gastos/actual/pagos/p':{monto:10}}});await f.run();
 f.patch['sisventas/gastos/actual/pct']=13;await assert.rejects(f.run(),limit);assertScoped(f);
});
test('grupos numéricos/booleanos legacy y claves de objeto especiales conservan la membresía real',async()=>{
 for(const value of [7,true]){
  const f=fixture({gastos:{a:commission(6,{ventaFbKey:value}),unrelated:commission(99,{ventaFbKey:'other'})},patch:{'sisventas/gastos/new':commission(5,{ventaFbKey:String(value)})}});await assert.rejects(f.run(),limit);assertScoped(f);
  assert.ok(!f.calls.some(([,p])=>p==='sisventas/gastos/unrelated'));
 }
 const gastos=Object.fromEntries([['__proto__',commission(6)],['constructor',commission(2)]]);
 const f=fixture({gastos,patch:{'sisventas/gastos/new':commission(3)}});await assert.rejects(f.run(),limit);assertScoped(f);assert.equal(Object.getPrototypeOf({}),Object.prototype);
});
test('los deltas combinados pueden compensar porcentajes dentro del mismo commit',async()=>{
 const f=fixture({gastos:{a:commission(8),b:commission(2)},patch:{'sisventas/gastos/a/pct':7,'sisventas/gastos/b/pct':3}});await f.run();
 f.patch['sisventas/gastos/b/pct']=3.01;await assert.rejects(f.run(),limit);
});
test('cambiar el vínculo CTA del gasto usa el movimiento posterior y no inventa domicilio ni historia',async()=>{
 const f=fixture({gastos:{a:commission(1,{legacyKey:'ctaemp/e/old'}),b:commission(6)},ctaemp:{e:{old:{pct:2},next:{pct:5}}},patch:{'sisventas/gastos/a/legacyKey':'ctaemp/e/next'}});await assert.rejects(f.run(),limit);assertScoped(f);
});
test('índice de grupo corrupto, referencia ausente o grupo ajeno fallan cerrados',async()=>{
 const group=Index.bucketPath('gastos','commissionGroup','sale');
 for(const value of [false,[],{a:false},{missing:true},{a:true,missing:true}]){
  const f=fixture({gastos:{a:commission(6)},patch:{'sisventas/gastos/new':commission(1)}});f.set(group,value);await assert.rejects(f.run(),invalidIndex);
 }
 const wrong=fixture({gastos:{a:commission(6,{ventaFbKey:'other'})},patch:{'sisventas/gastos/new':commission(1)}});wrong.set(group,{a:true});await assert.rejects(wrong.run(),invalidIndex);
 const missing=fixture({gastos:{a:commission(6)},patch:{'sisventas/gastos/a/pct':7}});missing.set(group,null);await assert.rejects(missing.run(),invalidIndex);
});
test('índice legacyKey corrupto o que apunta a otro vínculo no permite el cambio CTA',async()=>{
 const path=Index.bucketPath('gastos','legacyKey','ctaemp/e/m');
 for(const value of [{a:false},{missing:true},{a:true}]){
  const f=fixture({gastos:{a:commission(1,{legacyKey:'ctaemp/e/other'})},patch:{'sisventas/ctaemp/e/m/pct':5}});f.set(path,value);await assert.rejects(f.run(),invalidIndex);
 }
});
test('no inspecciona comisiones ni configuración por una escritura ajena y no admite reemplazar CTA raíz',async()=>{
 const f=fixture({patch:{'sisventas/pagos/p':{monto:10}}});assert.deepEqual(await f.run(),{checked:0});assert.deepEqual(f.calls,[]);
 for(const path of ['sisventas','sisventas/ctaemp']){
  const broad=fixture({patch:{[path]:{}}});await assert.rejects(broad.run(),{code:'SV_LABOR_CTA_SCOPE_REQUIRED'});assert.deepEqual(broad.calls,[]);
 }
});
test('fallo de lectura no confirma y espera todas las lecturas ya iniciadas sin abrir nuevas',async()=>{
 const gastos=Object.fromEntries(Array.from({length:20},(_,i)=>['g'+i,commission(0.1)]));const f=fixture({gastos,patch:{'sisventas/gastos/new':commission(1)}});
 let active=0,peak=0,started=0,finished=0;const original=f.raw;
 const raw=async path=>{if(!path.startsWith('sisventas/gastos/'))return original(path);active++;started++;peak=Math.max(peak,active);try{await new Promise(setImmediate);if(path.endsWith('/g0'))throw Error('Lectura ficticia fallida');return await original(path);}finally{active--;finished++;}};
 await assert.rejects(validateCommissionLimit({raw,get:f.get,changes:f.changes(),patch:f.patch}),/Lectura ficticia fallida/);
 assert.ok(peak<=6);assert.equal(active,0);assert.equal(finished,started);assert.ok(started<20);
});
test('un error raw drena también el get pendiente del mismo gasto o movimiento antes de devolver',async()=>{
 for(const target of ['sisventas/gastos/a','sisventas/ctaemp/e/m']){
  const f=fixture({gastos:{a:commission(2,{legacyKey:'ctaemp/e/m'})},ctaemp:{e:{m:{pct:2}}},patch:{'sisventas/gastos/new':commission(1)}});
  let release,startedResolve,settled=false,finished=false;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{startedResolve=resolve;});
  const raw=async path=>{if(path===target)throw Error('Fallo del par');return f.raw(path);};
  const get=async path=>{if(path===target){startedResolve();await gate;finished=true;}return f.get(path);};
  const pending=validateCommissionLimit({raw,get,changes:f.changes(),patch:f.patch}).finally(()=>{settled=true;});
  await started;await new Promise(setImmediate);assert.equal(settled,false);release();await assert.rejects(pending,/Fallo del par/);assert.equal(finished,true);
 }
});
test('dos altas concurrentes bajo el guard serial releen el índice y sólo una puede llegar al tope',async()=>{
 const f=fixture({gastos:{existing:commission(6)}});let data=copy(f.data),sequence=0;const commits=[];
 const set=(path,value)=>{data=put(data,parts(path),value);};
 const store={async read(path){return child(data,parts(path));},async acquire(lease){assert.equal(data.sv_labor_guard,undefined);data.sv_labor_guard=copy(lease);},async commit(patch,lease){assert.equal(data.sv_labor_guard.fence,lease.fence);commits.push(copy(patch));for(const [p,v]of Object.entries(patch))set(p,v);},async abort(lease){if(data.sv_labor_guard?.fence===lease.fence)delete data.sv_labor_guard;}};
 const guard=createLaborGuard({store,uuid:()=> 'fixture-operation-'+(++sequence)});
 const outcomes=await Promise.allSettled(['one','two'].map(key=>guard.run({uid:'me',mode:'command',role:'admin',permissionDigest:digest({})},async scope=>{
  await scope.update({['sisventas/gastos/'+key]:commission(4)});await new Promise(setImmediate);return {ok:true};
 })));
 assert.equal(outcomes.filter(result=>result.status==='fulfilled').length,1);assert.equal(outcomes.filter(result=>result.status==='rejected'&&limit(result.reason)).length,1);assert.equal(commits.length,1);
 assert.deepEqual(Object.keys(data.sisventas.gastos).sort(),['existing','one']);assert.equal(data.sv_labor_guard,undefined);
});
