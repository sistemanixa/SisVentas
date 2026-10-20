'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLaborGuard,child,parts,put,digest}=require('../cotizador/labor-guard');
const {createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
function fixture(){
 let data={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{user:{activo:true,rol:'admin'}},sisventas:{gastos:{g:{monto:100,empleadoId:'e',descripcion:'Ficticio'}},ctaemp:{e:{m:{monto:100,estado:'pendiente'}}},productos:{preserved:'x'.repeat(10000)}}},i=0;
 const calls={reads:[],commits:[],userReads:[]},read=path=>child(data,parts(path));
 const set=(path,value)=>{data=put(data,parts(path),value);};
 const store={read:async path=>{calls.reads.push(path);return read(path);},acquire:async lease=>{if(data.sv_labor_guard?.expiresAt>Date.now())throw Object.assign(Error('Ocupado'),{statusCode:423});set('sv_labor_guard',lease);},abort:async lease=>{if(data.sv_labor_guard?.fence===lease.fence)set('sv_labor_guard',null);},commit:async(patch,lease)=>{assert.equal(data.sv_labor_guard.fence,lease.fence);calls.commits.push(structuredClone(patch));for(const [path,value]of Object.entries(patch))set(path,value);},readAsUser:async(path,actor)=>{assert.equal(actor.uid,'user');calls.userReads.push(path);return read(path);}};
 const guard=createLaborGuard({store,uuid:()=> 'fixture-'+(++i),delay:async()=>{}}),db={ref:path=>({get:async()=>({val:()=>read(path)})})};
 const gateway=createLaborWriteGateway({auth:{verifyIdToken:async()=>({uid:'user'})},db,guard,store,enabled:true}),actor={uid:'user',claims:{uid:'user'}};
 return {gateway,actor,calls,store,set,read,get data(){return data;},command:(extra={})=>({id:'command-'+(++i),kind:'set',path:'sisventas/gastos/g/monto',value:110,...extra})};
}
test('gateway conserva UID, permisos de lectura compare y recibo pequeño sin duplicar datos',async()=>{
 const f=fixture(),command=f.command({kind:'compare',path:'sisventas/gastos/g',value:{monto:120,empleadoId:'e'},expectedHash:digest(f.read('sisventas/gastos/g'))});
 const actor=await f.gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer signed'}});assert.deepEqual(actor,f.actor);
 const result=await f.gateway.write(actor,command);assert.deepEqual(result,{ok:true,committed:true,value:command.value});assert.deepEqual(f.calls.userReads,['sisventas/gastos/g']);
 assert.deepEqual(f.read('sv_labor_receipts/'+command.id).result,{ok:true,committed:true});assert.equal(f.read('sisventas/productos/preserved').length,10000);
 assert.equal(f.calls.reads.includes('sisventas'),false);
});
test('CAS concurrente falla sin business PATCH ni recibo de éxito y no cae a Admin directo',async()=>{
 const f=fixture(),command=f.command({kind:'compare',expectedHash:digest(100)});f.set('sisventas/gastos/g/monto',125);
 await assert.rejects(f.gateway.write(f.actor,command),e=>e.code==='SV_CAS_CONFLICT');assert.equal(f.calls.commits.length,0);assert.equal(f.read('sisventas/gastos/g/monto'),125);
});
test('multipatch conserva acompañantes y recalcula índice en el mismo único commit',async()=>{
 const f=fixture(),command=f.command({kind:'patch',path:'',value:{'sisventas/gastos/g/monto':150,'sisventas/ctaemp/e/m/monto':150,'sisventas/productos/nota':'Compañero'}});
 await f.gateway.write(f.actor,command);assert.equal(f.calls.commits.length,1);const patch=f.calls.commits[0];assert.ok(Object.keys(patch).some(k=>k.startsWith('sv_labor_indexes/')));assert.equal(f.read('sisventas/ctaemp/e/m/monto'),150);assert.equal(f.read('sisventas/productos/nota'),'Compañero');
});
test('atomic revalida todas las bases y no acepta destino vigilado sin precondición',async()=>{
 const f=fixture(),command=f.command({kind:'atomic',path:'',value:{'sisventas/gastos/g/monto':50,'sisventas/ctaemp/e/m/estado':'pagado'},expectedHashes:{'sisventas/gastos/g':digest(f.read('sisventas/gastos/g')),'sisventas/ctaemp/e':digest(f.read('sisventas/ctaemp/e'))}});
 f.set('sisventas/ctaemp/e/otro',{monto:1});await assert.rejects(f.gateway.write(f.actor,command),e=>e.code==='SV_CAS_CONFLICT');assert.equal(f.read('sisventas/gastos/g/monto'),100);
 command.expectedHashes['sisventas/ctaemp/e']=digest(f.read('sisventas/ctaemp/e'));await f.gateway.write(f.actor,command);assert.equal(f.read('sisventas/gastos/g/monto'),50);
 await assert.rejects(f.gateway.write(f.actor,{...command,id:'new-operation',expectedHashes:{'sisventas/gastos/g':digest(f.read('sisventas/gastos/g'))}}),{statusCode:400});
});
test('respuesta perdida se comprueba por recibo sin aplicar de nuevo ni devolver datos del registro',async()=>{
 const f=fixture(),command=f.command();await f.gateway.write(f.actor,command);assert.deepEqual(await f.gateway.resolve(f.actor,{id:command.id,digest:digest(command)}),{ok:true,status:'confirmed'});
 await f.gateway.write(f.actor,command);assert.equal(f.calls.commits.length,1);
 await assert.rejects(f.gateway.resolve({...f.actor,uid:'other',claims:{uid:'other'}},{id:command.id,digest:digest(command)}),{statusCode:409});
});
test('comprobación sin guardado cierra el intento: un POST original tardío no puede cobrar',async()=>{
 const f=fixture(),command=f.command();assert.deepEqual(await f.gateway.resolve(f.actor,{id:command.id,digest:digest(command)}),{ok:true,status:'rejected'});
 const result=await f.gateway.write(f.actor,command);assert.equal(result.committed,false);assert.equal(result.code,'SV_LABOR_CANCELLED');assert.equal(f.read('sisventas/gastos/g/monto'),100);assert.equal(f.calls.commits.length,1);
});
test('intento todavía en proceso queda pendiente y no se declara fallido ni se borra su reserva',async()=>{
 const f=fixture(),command=f.command();f.set('sv_labor_guard',{fence:'other',expiresAt:Date.now()+60000});
 assert.deepEqual(await f.gateway.resolve(f.actor,{id:command.id,digest:digest(command)}),{ok:true,status:'pending'});assert.equal(f.read('sv_labor_guard/fence'),'other');assert.equal(f.calls.commits.length,0);
});
test('payloads arbitrarios, raíces, controles, sentinels y sesión no válida fallan antes del circuito',async()=>{
 const f=fixture();for(const extra of [{path:'sisventas'},{path:'sv_labor_indexes/x'},{kind:'patch',path:'',value:{'sv_labor_guard':null,'sisventas/gastos/g':null}},{value:{'.sv':'timestamp'}},{expectedHashes:{}},{uid:'other'},{kind:'atomic',path:'',value:{'sisventas/gastos/g':null},expectedHashes:{}}])await assert.rejects(f.gateway.write(f.actor,f.command(extra)),{statusCode:400});
 assert.equal(f.calls.commits.length,0);await assert.rejects(f.gateway.authorize({method:'POST',url:'/laboral/escritura?verComo=other',headers:{authorization:'Bearer signed'}}),{statusCode:403});
});
