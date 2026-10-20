'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLaborGuard,child,parts,put,digest}=require('../cotizador/labor-guard');
const {createLaborDb}=require('../cotizador/labor-db');
function fixture(){
 let data={sv_labor_config:{ready:true,schema:1},sisventas:{gastos:{g:{monto:100,estado:'pendiente'}},ctaemp:{e:{}},productos:{p:{nombre:'Ajeno'}}}},n=0;
 const calls={rawReads:[],rawWrites:[],commits:[],reads:[]},read=p=>child(data,parts(p)),set=(p,v)=>{data=put(data,parts(p),v);};
 function ref(path=''){const node={key:path.split('/').at(-1)||null,toString:()=> 'https://fixture.invalid/'+path,child:key=>ref([path,key].filter(Boolean).join('/')),get:async()=>{calls.rawReads.push(path);return {val:()=>read(path)};},set:async v=>{calls.rawWrites.push(path);set(path,v);},update:async patch=>{calls.rawWrites.push(path);for(const [key,value]of Object.entries(patch))set([path,key].filter(Boolean).join('/'),value);},transaction:async fn=>{calls.rawWrites.push(path);const next=fn(read(path));set(path,next);return {committed:true,snapshot:{val:()=>next}};},push:()=>ref([path,'new'+(++n)].filter(Boolean).join('/')),on:(_event,fn)=>{calls.rawReads.push(path);queueMicrotask(()=>fn({val:()=>read(path)}));},off:()=>{},orderByChild:field=>({...node,equalTo:value=>({...node,get:async()=>({val:()=>Object.fromEntries(Object.entries(read(path)||{}).filter(([,r])=>r[field]===value))})})})};Object.defineProperty(node,'root',{get:()=>ref()});Object.defineProperty(node,'parent',{get:()=>path.includes('/')?ref(path.slice(0,path.lastIndexOf('/'))):ref()});return node;}
 const store={read:async p=>{calls.reads.push(p);return read(p);},acquire:async lease=>set('sv_labor_guard',lease),abort:async()=>set('sv_labor_guard',null),commit:async patch=>{calls.commits.push(structuredClone(patch));for(const [p,v]of Object.entries(patch))set(p,v);},query:async(path,field,value)=>Object.fromEntries(Object.entries(read(path)||{}).filter(([,row])=>digest(child(row,parts(field)))===digest(value)))};
 const guard=createLaborGuard({store,uuid:()=> 'fixture-'+(++n)}),db=createLaborDb({db:{ref},guard});
 return {db,guard,calls,read,actor:{uid:'sv-labor-service',mode:'server'},get data(){return data;}};
}
test('bajo guard todo destino financiero se prepara y se confirma junto; no escapa ningún SDK write',async()=>{
 const f=fixture();await f.guard.run(f.actor,async()=>{await f.db.ref('sisventas/gastos/g').transaction(g=>({...g,monto:120}));await f.db.ref('sisventas/ctaemp/e/m').set({monto:120});assert.equal(f.read('sisventas/gastos/g/monto'),100);assert.equal((await f.db.ref('sisventas/gastos/g').get()).val().monto,120);await f.db.ref().update({'sisventas/gastos/g/estado':'pagado','sisventas/productos/nota':'acompañante'});return {ok:true};});
 assert.equal(f.calls.commits.length,1);assert.equal(f.calls.rawWrites.length,0);assert.equal(f.calls.rawReads.length,0);assert.equal(f.read('sisventas/gastos/g/monto'),120);assert.equal(f.read('sisventas/gastos/g/estado'),'pagado');assert.equal(f.read('sisventas/ctaemp/e/m/monto'),120);
});
test('interrupción descarta todo el plan y los jobs internos; un reintento empieza desde los datos intactos',async()=>{
 const f=fixture();await assert.rejects(f.guard.run(f.actor,async()=>{await f.db.ref('sv_commission_generation/s').set({estado:'procesando'});await f.db.ref('sisventas/gastos/g').update({monto:150});throw Error('Interrupción ficticia');}),/Interrupción/);assert.equal(f.read('sisventas/gastos/g/monto'),100);assert.equal(f.read('sv_commission_generation/s'),null);assert.equal(f.calls.commits.length,0);
});
test('transacción individual fuera de scope también cruza guard sin guardar funciones ni snapshots en recibos',async()=>{
 const f=fixture(),result=await f.db.ref('sisventas/gastos/g').transaction(g=>({...g,monto:g.monto+1}));assert.equal(result.committed,true);assert.equal(result.snapshot.val().monto,101);assert.equal(f.calls.rawWrites.length,0);assert.equal(f.calls.commits.length,1);
 assert.deepEqual(Object.values(f.data.sv_labor_receipts)[0].result,{ok:true,committed:true});
});
test('priming on/value de transacciones de comisiones usa lectura puntual y libera su callback',async()=>{
 const f=fixture();await f.guard.run(f.actor,async()=>{const ref=f.db.ref('sisventas/gastos/g');let listener;await new Promise((resolve,reject)=>{listener=()=>resolve();ref.on('value',listener,reject);});await ref.transaction(g=>({...g,monto:150}));ref.off('value',listener);return {ok:true};});assert.equal(f.calls.rawReads.length,0);assert.equal(f.calls.rawWrites.length,0);
});
test('queries ven altas y cambios todavía pendientes, preservando exclusión de comisiones',async()=>{
 const f=fixture();await f.guard.run(f.actor,async()=>{await f.db.ref('sisventas/gastos/g').update({ventaFbKey:'s'});await f.db.ref('sisventas/gastos/n').set({ventaFbKey:'s',monto:3});const rows=(await f.db.ref('sisventas/gastos').orderByChild('ventaFbKey').equalTo('s').get()).val();assert.deepEqual(Object.keys(rows).sort(),['g','n']);return {ok:true};});
});
test('rutas ajenas conservan SDK; raíz, consultas sin filtro y async callbacks no cruzan el circuito',async()=>{
 const f=fixture();await f.db.ref('sisventas/productos/p').update({nombre:'Modificado'});assert.equal(f.calls.rawWrites.length,1);
 await assert.rejects(f.guard.run(f.actor,async()=>f.db.ref('sisventas').get()),{statusCode:400});assert.throws(()=>f.db.ref('sisventas').set({}),{statusCode:400});
 await assert.rejects(f.guard.run(f.actor,async()=>f.db.ref('sisventas/gastos').orderByChild('monto').get()),{statusCode:400});
 await assert.rejects(f.db.ref('sisventas/gastos/g').transaction(async g=>g),{statusCode:400});assert.equal(f.calls.commits.length,0);
});
