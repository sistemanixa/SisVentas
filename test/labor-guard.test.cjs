'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLaborGuard,child,put,parts,digest,affected}=require('../cotizador/labor-guard'),Index=require('../cotizador/labor-index');
function fixture(){let clock=1000,sequence=0;const data={sv_labor_config:{schema:1,ready:true},sisventas:{gastos:{g:{empleadoId:' e ',fecha:'2026-10-01',descripcion:'Ficticio',monto:100}},productos:{huge:'x'.repeat(10000)}}};const calls={reads:[],commits:[],aborts:[],acquires:[]};
 const read=p=>structuredClone(child(data,parts(p)));const set=(p,v)=>{const next=put(data,parts(p),v);for(const key of Object.keys(data))delete data[key];Object.assign(data,next);};
 const store={async read(p){calls.reads.push(p);return read(p);},async acquire(lease){calls.acquires.push({...lease});if(data.sv_labor_guard?.expiresAt>clock)throw Object.assign(Error('Ocupado'),{statusCode:423});data.sv_labor_guard={...lease};},async commit(patch,lease){assert.equal(data.sv_labor_guard.fence,lease.fence);assert.ok(data.sv_labor_guard.expiresAt>clock);assert.ok(patch['sv_labor_receipts/'+lease.opId]);assert.equal(patch.sv_labor_guard,null);calls.commits.push(structuredClone(patch));for(const [p,v]of Object.entries(patch))set(p,v);},async abort(lease){calls.aborts.push(lease.fence);if(data.sv_labor_guard?.fence===lease.fence)delete data.sv_labor_guard;},async query(path,field,value){calls.reads.push(path+'?'+field);return Object.fromEntries(Object.entries(read(path)||{}).filter(([,row])=>digest(child(row,parts(field)))===digest(value)));}};
 const guard=createLaborGuard({store,now:()=>clock,uuid:()=> 'operation-'+(++sequence),delay:async()=>{clock+=100;}});
 return{data,calls,guard,store,set,advance(ms){clock+=ms;},actor:(extra={})=>({uid:'user',mode:'command',role:'admin',permissionDigest:digest({}),operation:'fixture',...extra})};}
test('lecturas puntuales, overlay y PATCH único conservan datos ajenos e índices en el mismo commit',async()=>{
 const f=fixture(),before=structuredClone(f.data.sisventas.productos);const result=await f.guard.run(f.actor(),async s=>{const g=await s.get('sisventas/gastos/g');await s.update({'sisventas/gastos/g/monto':150});assert.equal((await s.get('sisventas/gastos/g')).monto,150);assert.equal(f.data.sisventas.gastos.g.monto,100);return{committed:true};});
 assert.deepEqual(result,{committed:true});assert.equal(f.calls.commits.length,1);assert.equal(f.data.sisventas.gastos.g.monto,150);assert.deepEqual(f.data.sisventas.productos,before);assert.ok(f.calls.reads.every(p=>p!=='sisventas'&&p!=='sisventas/productos'));const patch=f.calls.commits[0];assert.ok(Object.keys(patch).some(p=>p.startsWith(Index.INDEX_ROOT+'/')));assert.equal(f.data.sv_labor_guard,undefined);
});
test('los errores descartan todo el staging y sólo retiran su propio fence',async()=>{
 const f=fixture();await assert.rejects(f.guard.run(f.actor(),async s=>{await s.update({'sisventas/gastos/g/monto':200});f.data.sv_labor_guard={fence:'sucesor',expiresAt:90000};throw Error('Fallo ficticio');}),/Fallo ficticio/);assert.equal(f.calls.commits.length,0);assert.equal(f.data.sisventas.gastos.g.monto,100);assert.equal(f.data.sv_labor_guard.fence,'sucesor');
});
test('plazo vencido descarta el plan; siguiente intento vuelve a leer sin reutilizar el snapshot',async()=>{
 const f=fixture();await assert.rejects(f.guard.run(f.actor(),async s=>{await s.get('sisventas/gastos/g');await s.update({'sisventas/gastos/g/monto':999});f.advance(30001);return{committed:true};}),{code:'SV_LABOR_LEASE_EXPIRED'});assert.equal(f.calls.commits.length,0);f.data.sisventas.gastos.g.monto=200;await f.guard.run(f.actor(),async s=>{assert.equal((await s.get('sisventas/gastos/g')).monto,200);return{committed:true};});assert.equal(f.calls.reads.filter(p=>p==='sisventas/gastos/g').length,2);
});
test('UNCHANGED también valida fence y deja recibo sin escritura de negocio',async()=>{
 const f=fixture();await f.guard.run(f.actor(),async()=>({committed:true,unchanged:true}));assert.deepEqual(Object.keys(f.calls.commits[0]).filter(p=>p.startsWith('sisventas/')),[]);assert.equal(Object.keys(f.data.sv_labor_receipts).length,1);
});

test('el resultado comercial se entrega sin duplicar la venta ni documentos dentro del recibo',async()=>{
 for(const mode of ['command','server']){
  const f=fixture(),result={record:{id:'ficticio',documento:'x'.repeat(200000)}};
  assert.deepEqual(await f.guard.run(f.actor({mode}),async()=>result),result);
  const receipt=Object.values(f.data.sv_labor_receipts)[0];
  assert.deepEqual(receipt.result,{ok:true,committed:true});
  assert.ok(Buffer.byteLength(JSON.stringify(receipt))<500);
 }
});
test('dos acciones concurrentes se ordenan sin perder el cambio anterior',async()=>{
 const f=fixture();await Promise.all([1,2].map(()=>f.guard.run(f.actor(),async s=>{const g=await s.get('sisventas/gastos/g');await new Promise(setImmediate);await s.update({'sisventas/gastos/g/monto':g.monto+1});return{committed:true};})));assert.equal(f.data.sisventas.gastos.g.monto,102);assert.equal(f.calls.commits.length,2);
});
test('recibo de transporte idéntico se recupera y reutilización por otro usuario o payload se rechaza',async()=>{
 const f=fixture(),actor=f.actor({mode:'user',opId:'client-operation',input:{path:'sisventas/gastos/g/monto',value:150}});let work=0;const callback=async s=>{work++;await s.update({'sisventas/gastos/g/monto':150});return{committed:true};};await f.guard.run(actor,callback);await f.guard.run(actor,callback);assert.equal(work,1);await assert.rejects(f.guard.run({...actor,uid:'other'},callback),{statusCode:409});await assert.rejects(f.guard.run({...actor,input:{value:151}},callback),{statusCode:409});assert.equal(f.calls.commits.length,1);
});
test('snapshot de compare se calcula antes de mutar y un índice no puede venir del payload',async()=>{
 const f=fixture();await assert.rejects(f.guard.run(f.actor(),s=>s.update({'sv_labor_indexes/gastos':{forged:true}})),{statusCode:400});assert.equal(f.calls.commits.length,0);assert.equal(affected('sisventas/config/cargos/c'),true);assert.equal(affected('sisventas/config/empresa'),false);assert.equal(affected('sisventas/productos/p'),false);
});
test('query bajo guard incorpora altas, cambios y bajas pendientes sin devolver miembros que ya no coinciden',async()=>{
 const f=fixture();await f.guard.run(f.actor(),async s=>{await s.update({'sisventas/gastos/g/empleadoId':'other','sisventas/gastos/new':{empleadoId:' e ',monto:30}});const rows=await s.query('sisventas/gastos','empleadoId',' e ');assert.deepEqual(Object.keys(rows),['new']);return{committed:true};});
});
test('sin cobertura lista no confirma comandos ni deja cambios; bootstrap sólo crea metadata propuesta',async()=>{
 const f=fixture();f.data.sv_labor_config.ready=false;await assert.rejects(f.guard.run(f.actor(),s=>s.update({'sisventas/gastos/g/monto':300})),{statusCode:503});assert.equal(f.calls.commits.length,0);await f.guard.run(f.actor({mode:'bootstrap'}),async s=>{await s.update({'sv_labor_config':{schema:1,ready:true}});return{prepared:true};});assert.equal(f.data.sv_labor_config.ready,true);
});
test('permisos cambiados antes del lease, incluso con la misma revisión, rechazan el plan antes de usarlo',async()=>{
 const f=fixture(),before={indiceRevision:1,acciones:{empleados:{autorizarHoras:true}}};f.data.sv_permisos={admin:{indiceRevision:1,acciones:{empleados:{autorizarHoras:false}}}};let called=false;
 await assert.rejects(f.guard.run(f.actor({permissionDigest:digest(before)}),async()=>{called=true;return {ok:true};}),e=>e.code==='SV_LABOR_AUTH_CHANGED');assert.equal(called,false);assert.equal(f.calls.commits.length,0);
});

test('recibo confirmado no espera la cola ni toma otro lease mientras hay un guardado independiente',async()=>{
 const f=fixture(),actor=f.actor({mode:'user',opId:'already-confirmed',input:{demo:1}});
 await f.guard.run(actor,async()=>({ok:true,committed:true}));
 let release,started;const waiting=new Promise(r=>release=r),entered=new Promise(r=>started=r);
 const blocker=f.guard.run(f.actor(),async()=>{started();await waiting;return{ok:true,committed:true};});await entered;
 const before=f.calls.acquires.length;let timeout;
 try{const result=await Promise.race([f.guard.run(actor,()=>{throw Error('No debe volver a ejecutar');}),new Promise((_,reject)=>timeout=setTimeout(()=>reject(Error('Esperó un bloqueo ajeno')),250))]);assert.equal(result.committed,true);assert.equal(f.calls.acquires.length,before);}
 finally{clearTimeout(timeout);release();await blocker;}
});

test('rechazo de adquirir por recibo confirmado en otra instancia devuelve confirmación sin repetir plan',async()=>{
 const f=fixture(),actor=f.actor({mode:'user',opId:'cross-instance',input:{demo:1}});
 f.store.acquire=async()=>{f.data.sv_labor_receipts={...(f.data.sv_labor_receipts||{}),[actor.opId]:{actorUid:actor.uid,digest:digest({uid:actor.uid,mode:actor.mode,operation:actor.operation,input:actor.input}),result:{ok:true,committed:true}}};throw Object.assign(Error('Receipt exists'),{statusCode:403});};
 let executions=0;const result=await f.guard.run(actor,async()=>{executions++;return {ok:true,committed:true};});
 assert.equal(result.committed,true);assert.equal(executions,0);assert.equal(f.calls.commits.length,0);assert.equal(f.calls.aborts.length,0);assert.equal(f.data.sv_labor_guard,undefined);
});
