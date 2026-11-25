'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/ot-material-state-fixture.cjs'),{createOTLifecycle}=require('../cotizador/ot-lifecycle'),State=require('../cotizador/ot-material-state'),{apply}=require('./helpers/labor-ui-flow.cjs');
const otPath='sisventas/ordenes_trabajo/ot',mappingPath='fictional/reference';
async function mappedFixture({delivered=true,receiptIdentityKey='p'}={}){
 const f=await fixture();if(delivered)await f.api.execute(f.identity,f.body());
 // Construct a purely fictional pre-existing historical ledger. Association
 // itself is represented only by metadata below, never by moving stock.
 const inventory=f.get('sisventas/inventario_operativo/p'),product=f.get('sisventas/productos/p');apply(f.state,{'sisventas/inventario_operativo/p':null,'sisventas/inventario_operativo/physical-old':inventory,'sisventas/productos/p':null,'sisventas/productos/canonical':product,[mappingPath]:{revision:1,productKey:'canonical',inventoryKey:'physical-old',receiptIdentityKey}});
 const calls=[];const resolveReference=async(input,ports)=>{
  calls.push(input);assert.equal(input.purpose,'ot');assert.ok(input.path.startsWith('sisventas/ordenes_trabajo/'));assert.equal(input.selector,0);assert.deepEqual(input.record,f.get(input.path));assert.equal(input.expectedOriginalHash,require('../cotizador/labor-guard').digest(input.record));
  const mapping=await ports.read(mappingPath);ports.track(mappingPath,mapping);return {...mapping,mappingRevision:mapping.revision,mapped:true,readSet:[{path:mappingPath,value:mapping}]};
 };
 const db={ref:path=>({get:async()=>({val:()=>f.get(path)})})};const api=createOTLifecycle({db,store:f.store,guard:f.guard,enabled:true,commercialPages:true,now:()=>1792530000000,resolveReference});
 return {...f,api,calls,resolveReference};
}
test('installation of a historical delivery uses three distinct identities and one original receipt',async()=>{
 const f=await mappedFixture(),before=structuredClone(f.state.sisventas),ot=f.get(otPath),materials=structuredClone(ot.materiales),receipt=materials[0].stockRegistro;materials[0].instalada=1;materials[0].stockRevision++;
 const body=f.body('custody',{materiales:materials,custodiaIniciada:true});await f.api.execute(f.identity,body);
 const saved=f.get(otPath),inventory=f.get('sisventas/inventario_operativo/physical-old');assert.equal(saved.materiales[0].productoKey,ot.materiales[0].productoKey);assert.equal(saved.materiales[0].stockRegistro,receipt);assert.equal(inventory.rendicionesOT[receipt].instalada,1);assert.equal(inventory.consumido,1);assert.deepEqual(saved.remitosEntrega,ot.remitosEntrega);assert.equal(f.get('sisventas/inventario_operativo/canonical'),null);assert.equal(f.get('sisventas/inventario_operativo/p'),null);assert.deepEqual(inventory.asignaciones.foreign,before.inventario_operativo['physical-old'].asignaciones.foreign);
 const installed=structuredClone(inventory);await f.api.execute(f.identity,body);assert.equal(f.commits.length,2);assert.deepEqual(f.get('sisventas/inventario_operativo/physical-old'),installed);for(const domain of ['ventas','pagos','comisiones'])assert.deepEqual(f.get('sisventas/'+domain),before[domain]);assert.ok(f.calls.length>=2,'store independently resolves again');
});
test('mapping change at fresh CAS rejects without a physical write',async()=>{
 const f=await mappedFixture(),ot=f.get(otPath),materials=structuredClone(ot.materiales);materials[0].instalada=1;materials[0].stockRevision++;const before=f.get('sisventas/inventario_operativo'),commits=f.commits.length;
 f.onRead((path,count)=>{if(path===mappingPath&&count===2)apply(f.state,{[mappingPath+'/revision']:2});});await assert.rejects(f.api.execute(f.identity,f.body('custody',{materiales:materials})));assert.equal(f.commits.length,commits);assert.deepEqual(f.get('sisventas/inventario_operativo'),before);
});
test('internal reference context requires issued OT authority, same actor and bound lease; JSON cannot carry it',()=>{
 const Policy=require('../cotizador/ot-lifecycle-policy'),actor={uid:'u',claims:{uid:'u'},mode:'user',operation:'ot-lifecycle',role:'admin',opId:'test-operation'};actor.otLifecycle=Policy.issue({uid:'u',otKey:'ot',saleKey:'sale',operationId:actor.opId,kind:'custody',role:'admin'});
 const scoped=State.withReferencePort(actor,()=>{}),lease={actorUid:'u',opId:actor.opId,fence:'test-fence'};assert.throws(()=>State.getReferencePort(scoped,lease));State.bindReferenceLease(scoped,lease);assert.equal(typeof State.getReferencePort(scoped,lease),'function');assert.equal(State.getReferencePort(JSON.parse(JSON.stringify(scoped)),lease),undefined);
 assert.throws(()=>State.getReferencePort({...scoped,uid:'other'},lease));assert.throws(()=>State.getReferencePort({...scoped,role:'tecnico'},lease));assert.throws(()=>State.getReferencePort(scoped,{...lease,fence:'other'}));const symbol=Object.getOwnPropertySymbols(scoped)[0];assert.throws(()=>State.getReferencePort({...scoped,[symbol]:{}},lease));assert.throws(()=>State.withReferencePort({uid:'u'},()=>{}));
});
test('link before delivery uses physical inventory and freezes a different historical receipt identity',async()=>{
 const f=await mappedFixture({delivered:false}),before=structuredClone(f.state.sisventas),body=f.body();await f.api.execute(f.identity,body);
 const ot=f.get(otPath),inv=f.get('sisventas/inventario_operativo/physical-old');assert.equal(ot.materiales[0].productoKey,'canonical');assert.equal(ot.materiales[0].entregada,2);assert.equal(inv.rendicionesOT[ot.materiales[0].stockRegistro].instalada,0);assert.equal(inv.confirmacionesOT[body.id].r0.producto,'p');assert.equal(inv.general,before.inventario_operativo['physical-old'].general);assert.equal(inv.reservado,before.inventario_operativo['physical-old'].reservado);assert.equal(f.get('sisventas/inventario_operativo/canonical'),null);
 const ledger=structuredClone(inv);await f.api.execute(f.identity,body);assert.equal(f.commits.length,1);assert.deepEqual(f.get('sisventas/inventario_operativo/physical-old'),ledger);assert.equal(Object.keys(f.get(otPath).remitosEntrega).length,1);
});
test('return of a pre-link delivery reaches only its physical ledger and replays once',async()=>{
 const f=await mappedFixture(),materials=structuredClone(f.get(otPath).materiales);Object.assign(materials[0],{devueltaPendiente:1,enTecnico:1,custodiaClasificada:true});await f.api.execute(f.identity,f.body('custody',{materiales:materials}));
 const before=f.get('sisventas/inventario_operativo/physical-old'),receipt=materials[0].stockRegistro,request=f.body('return',{});await f.api.execute(f.identity,request);const returned=f.get('sisventas/inventario_operativo/physical-old');assert.equal(returned.general,before.general+1);assert.equal(returned.reservado,before.reservado-1);assert.equal(returned.rendicionesOT[receipt].recibidas,1);assert.deepEqual(returned.asignaciones.foreign,before.asignaciones.foreign);await f.api.execute(f.identity,request);assert.equal(f.commits.length,3);assert.deepEqual(f.get('sisventas/inventario_operativo/physical-old'),returned);assert.equal(f.get('sisventas/inventario_operativo/canonical'),null);
});
test('injected OFF port retains exact legacy HTTP read sequence and physical quantities',async()=>{
 const a=await fixture(),b=await fixture({resolveReference:async(_input,ports)=>ports.legacy()});await a.api.execute(a.identity,a.body());await b.api.execute(b.identity,b.body());assert.deepEqual(b.requests,a.requests);assert.deepEqual(b.get('sisventas/inventario_operativo'),a.get('sisventas/inventario_operativo'));assert.deepEqual(b.get(otPath),a.get(otPath));
});
test('L then FIRST delivery uses mapping receipt origin J, not a new row product P',async()=>{
 const f=await mappedFixture({delivered:false,receiptIdentityKey:'physical-old'}),original=f.get(otPath);original.materiales[0].productoKey='canonical';f.setOT(original);
 const before=f.get('sisventas/inventario_operativo/physical-old');assert.equal(Object.keys(before.rendicionesOT||{}).length,0);assert.equal(Object.keys(original.remitosEntrega||{}).length,0);assert.equal(original.materiales[0].stockRegistro,undefined);
 const body=f.body();await f.api.execute(f.identity,body);const saved=f.get(otPath),inventory=f.get('sisventas/inventario_operativo/physical-old');assert.equal(saved.materiales[0].productoKey,'canonical');assert.equal(inventory.confirmacionesOT[body.id].r0.producto,'physical-old');assert.equal(saved.materiales[0].stockRegistro,require('node:crypto').createHash('sha256').update(JSON.stringify(['ot','0','physical-old','s'])).digest('hex'));assert.equal(f.commits.length,1);await f.api.execute(f.identity,body);assert.equal(f.commits.length,1);
});
