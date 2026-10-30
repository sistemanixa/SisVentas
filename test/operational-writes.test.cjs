'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Model=require('../js/core/operational-read-model'),{create}=require('../js/core/operational-writes');
function fixture(){
 let id=0,writes=[],reads=[],data={'sisventas/inventario_operativo/P1':{general:37,reservado:2,asignaciones:{sale:{reservado:2}},operaciones:{old:1}}};
 const root={currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},fbDB:{},SVOperationalReadModel:Model,crypto:{randomUUID:()=> 'operation-'+(++id)}};
 const ref=(_,path='')=>({key:path.split('/').at(-1),toString:()=>path});
 const sdk={ref,get:async r=>{const path=Model.path(r);reads.push(path);return {val:()=>Model.clone(data[path]??null)};},update:async(_,patch)=>{writes.push(Model.clone(patch));for(const [p,v]of Object.entries(patch))data[p]=Model.clone(v);},set:async()=>{throw Error('Unexpected unguarded set');},push:()=>ref(null,'generated'),remove:async()=>{},runTransaction:()=>{throw Error('Unexpected SDK root transaction');}};
 const api=create(root);api.install({sdk});return {api,root,sdk,writes,reads,data,ref};
}
test('stock transaction reads one SKU and preserves allocations, receipts and precision',async()=>{
 const f=fixture(),path='sisventas/inventario_operativo/P1',result=await f.root.fbRunTransaction(f.ref(null,path),current=>({...current,general:current.general-1}));
 assert.equal(result.committed,true);assert.equal(result.snapshot.val().general,36);assert.equal(result.snapshot.val()._svReadRevision,1);assert.equal(f.writes.length,1);assert.deepEqual(f.reads,[path]);assert.equal(f.data[path].asignaciones.sale.reservado,2);assert.equal(f.data[path].operaciones.old,1);assert.equal(f.data[Model.index+'/inventario_operativo/P1'].asignaciones,undefined);
});
test('an acknowledgement lost after commit is recovered without consuming twice',async()=>{
 const f=fixture(),write=f.sdk.update;f.sdk.update=async(...args)=>{await write(...args);throw Object.assign(Error('connection lost'),{code:'NETWORK_ERROR'});};
 const result=await f.api.transaction(f.ref(null,'sisventas/inventario_operativo/P1'),current=>({...current,general:current.general-1}));
 assert.equal(result.committed,true);assert.equal(f.data['sisventas/inventario_operativo/P1'].general,36);assert.equal(f.writes.length,1);
});
test('an ambiguous network failure never retries a stock increment blindly',async()=>{
 const f=fixture();let attempts=0;f.sdk.update=async()=>{attempts++;f.data['sisventas/inventario_operativo/P1']._svReadRevision=1;f.data['sisventas/inventario_operativo/P1']._svReadOperation='somebody-else';throw Object.assign(Error('network'),{code:'NETWORK_ERROR'});};
 await assert.rejects(f.api.transaction(f.ref(null,'sisventas/inventario_operativo/P1'),current=>({...current,general:current.general-1})),/network/);assert.equal(attempts,1);assert.equal(f.data['sisventas/inventario_operativo/P1'].general,37);
});
test('server-rejected revision conflict rereads just selected records and retries safely',async()=>{
 const f=fixture(),save=f.sdk.update;let attempts=0;f.sdk.update=async(...args)=>{if(!attempts++){const source='sisventas/inventario_operativo/P1';f.data[source]={...f.data[source],general:36,_svReadRevision:1,_svReadOperation:'other'};throw Object.assign(Error('conflict'),{code:'PERMISSION_DENIED'});}return save(...args);};
 await f.api.transaction(f.ref(null,'sisventas/inventario_operativo/P1'),current=>({...current,general:current.general-1}));assert.equal(f.data['sisventas/inventario_operativo/P1'].general,35);assert.equal(f.data['sisventas/inventario_operativo/P1']._svReadRevision,2);assert.ok(f.reads.every(p=>p==='sisventas/inventario_operativo/P1'));
});
test('multi-record operation never reads the complete list history',async()=>{
 const f=fixture();f.data['sisventas/listas_materiales/a']={estado:'preparacion'};f.data['sisventas/listas_materiales/b']={estado:'preparacion'};
 const result=await f.api.multi('listas_materiales',['a','b','joint'],map=>{map.a.compraConjuntaId='joint';map.b.compraConjuntaId='joint';map.joint={estado:'preparacion',sources:[{listId:'a'},{listId:'b'}]};return map;});
 assert.equal(result.committed,true);assert.equal(f.writes.length,1);assert.equal(f.writes[0]['sisventas/listas_materiales/a'].compraConjuntaId,'joint');assert.deepEqual(f.reads,['sisventas/listas_materiales/a','sisventas/listas_materiales/b','sisventas/listas_materiales/joint']);
});
test('authorization failure is not retried or sent to Cotizador as a fallback',async()=>{
 const f=fixture();let attempts=0;f.sdk.update=async()=>{attempts++;throw Object.assign(Error('Permission denied'),{code:'PERMISSION_DENIED'});};await assert.rejects(f.api.transaction(f.ref(null,'sisventas/inventario_operativo/P1'),current=>({...current,general:36})),/Permission/);assert.equal(attempts,1);assert.equal(f.data['sisventas/inventario_operativo/P1'].general,37);
});
test('an omitted selected record is not interpreted as an authorized deletion',async()=>{
 const f=fixture();f.data['sisventas/listas_materiales/a']={estado:'preparacion'};f.data['sisventas/listas_materiales/b']={estado:'preparacion'};
 await assert.rejects(f.api.multi('listas_materiales',['a','b'],map=>({a:map.a})),/Falta un registro/);
 assert.equal(f.writes.length,0);assert.equal(f.data['sisventas/listas_materiales/b'].estado,'preparacion');
});
test('patching a deleted record never recreates a partial order',async()=>{
 const f=fixture();await assert.rejects(f.root.fbUpdate(f.ref(null,'sisventas/ordenes/deleted'),{estado:'recibida'}),/ya no existe/);assert.equal(f.writes.length,0);
});
