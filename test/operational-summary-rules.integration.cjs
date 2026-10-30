'use strict';
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9042','Sólo emulador dedicado');
const dep=require('node:module').createRequire(path.join(process.env.SV_SECURITY_TOOLS,'package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=dep('@firebase/rules-unit-testing'),{ref,get,set,update}=dep('firebase/database');
const Model=require('../js/core/operational-read-model'),Rules=require('../scripts/lib/operational-summary-rules.cjs');
const base=JSON.parse(fs.readFileSync(process.env.SV_OPERATIONAL_RULES_BASE,'utf8')),rules=require('../scripts/lib/sale-return-query-indexes.cjs').prepare(Rules.prepare(require('../scripts/lib/chat-header-rules.cjs').prepare(base)));let env;
const client=uid=>env.authenticatedContext(uid).database(),source='sisventas/ordenes/a';
const order=()=>({numero:'OC-ficticia',ts:1,total:123.45,estado:'borrador',items:[{codigo:'P1',descripcion:'Magnético',cantidadOrdenada:5,costoUnitario:24.69,imagenUrl:'private-image',audit:{fixture:'private'}},{codigo:'P2',cantidadOrdenada:2,costoUnitario:0}],recepciones:[{fixture:'private'}]});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-operational-summary-audit',database:{host:'127.0.0.1',port:9042,rules:JSON.stringify(rules)}});});
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(ctx=>set(ref(ctx.database()),{sv_chat_roles:{admin:{rol:'admin',activo:true},inactive:{rol:'admin',activo:false}},sv_permisos:{admin:{indiceVersion:2,indiceModulos:{ordenes:true,productos:true,ordentrabajo:true},acciones:{}}},sisventas:{ventas:{untouched:{total:100}},pagos:{untouched:{monto:10}}}}));});
after(async()=>env?.cleanup());
test('create, edit and delete pair a complete compact summary without exposing journals',async()=>{
 const db=client('admin'),patch=Model.plan(source,null,order());await assertSucceeds(update(ref(db),patch));
 const summary=(await get(ref(db,'sisventas/compras_resumen/ordenes/a'))).val();assert.equal(summary.total,123.45);assert.equal(summary.items[0].imagenUrl,undefined);assert.equal(summary.recepciones,undefined);
 const before=patch[source],edited=Model.plan(source,before,{...before,estado:'enviada'});await assertSucceeds(update(ref(db),edited));
 await assertFails(set(ref(db,source),null));await assertFails(set(ref(db,'sisventas/compras_resumen/ordenes/a'),null));
 await assertSucceeds(update(ref(db),Model.plan(source,edited[source],null)));
});
test('summary-only changes, stale revision, false totals and omitted old search items are rejected',async()=>{
 const db=client('admin'),initial=Model.plan(source,null,order());await update(ref(db),initial);
 await assertFails(set(ref(db,'sisventas/compras_resumen/ordenes/a/total'),0));
 const stale=Model.plan(source,null,{...order(),total:0});await assertFails(update(ref(db),stale));
 const falseTotal=Model.plan(source,initial[source],{...initial[source],estado:'enviada'});falseTotal['sisventas/compras_resumen/ordenes/a'].total=0;await assertFails(update(ref(db),falseTotal));
 const omitted=Model.plan(source,initial[source],{...initial[source],estado:'enviada'});omitted['sisventas/compras_resumen/ordenes/a'].items.pop();await assertFails(update(ref(db),omitted));
});
test('concurrent inventory writers cannot overwrite allocations or consume twice',async()=>{
 const db=client('admin'),path='sisventas/inventario_operativo/P1',initial=Model.plan(path,null,{codigo:'P1',general:37,reservado:2,enCompra:0,asignaciones:{sale:{reservado:2}},operaciones:{receipt:1}});await update(ref(db),initial);
 const first=Model.plan(path,initial[path],{...initial[path],general:36}),second=Model.plan(path,initial[path],{...initial[path],general:35});
 await assertSucceeds(update(ref(db),first));await assertFails(update(ref(db),second));
 const actual=(await get(ref(db,path))).val();assert.equal(actual.general,36);assert.equal(actual.asignaciones.sale.reservado,2);assert.equal(actual.operaciones.receipt,1);
});
test('material preparation keeps calculator rows but omits inline attachments and previous source snapshots',async()=>{
 const db=client('admin'),path='sisventas/listas_materiales/L',list={numero:'L',estado:'preparacion',items:[{codigo:'P1',cantidadComprar:1,origenVentaItem:{origenCompra:'Paraguay',costoUnitarioCompra:50,foto:'private'}}],simuladorParaguay:{version:6,rows:[{code:'P1',qty:1,agreed:50}],snapshot:{private:'snapshot'}},compraConfirmacion:{estado:'pendiente',ordenes:[order()]},comprobantesCompra:{private:'pdf'}};
 await assertSucceeds(update(ref(db),Model.plan(path,null,list)));
 const actual=(await get(ref(db,'sisventas/compras_resumen/listas_materiales/L'))).val();assert.equal(actual.items[0].origenVentaItem.costoUnitarioCompra,50);assert.equal(actual.items[0].origenVentaItem.foto,undefined);assert.equal(actual.simuladorParaguay.snapshot,undefined);assert.equal(actual.compraConfirmacion.estado,'pendiente');assert.equal(actual.compraConfirmacion.ordenes,undefined);assert.equal(actual.comprobantesCompra,undefined);
});
test('unauthorized readers and writers stay denied and financial records remain unchanged',async()=>{
 for(const db of [client('inactive'),env.unauthenticatedContext().database()]){await assertFails(get(ref(db,'sisventas/compras_resumen/ordenes')));await assertFails(update(ref(db),Model.plan(source,null,order())));}
 await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.database();assert.deepEqual((await get(ref(db,'sisventas/ventas'))).val(),{untouched:{total:100}});assert.deepEqual((await get(ref(db,'sisventas/pagos'))).val(),{untouched:{monto:10}});});
});
test('the old complete-history subscriptions are denied; authorized per-record details still work',async()=>{
 const db=client('admin');await update(ref(db),Model.plan(source,null,order()));
 for(const domain of Model.domains)await assertFails(get(ref(db,'sisventas/'+domain)));
 await assertSucceeds(get(ref(db,source)));await assertSucceeds(get(ref(db,'sisventas/compras_resumen/ordenes')));
});

test('financial fence, receipt and inventory summary commit atomically under the composed rules',async()=>{
 const opId='fixture-financial-operation',fence='fixture-financial-fence',digest='a'.repeat(64),record='sisventas/inventario_operativo/P',lease={opId,fence,digest,actorUid:'financialActor',mode:'user',expiresAt:Date.now()+45000};
 await env.withSecurityRulesDisabled(ctx=>update(ref(ctx.database()),{'sv_chat_roles/financialActor':{rol:'admin',activo:true},sv_labor_guard:lease,sv_labor_config:{schema:1,ready:true}}));
 const claims={svLaborService:true,mode:'commit',opId,fence,digest,actorUid:'financialActor'},db=env.authenticatedContext('financialActor',claims).database(),patch=Model.plan(record,null,{codigo:'P',general:36,reservado:1},opId);
 patch['sv_labor_receipts/'+opId]={fence,digest,actorUid:'financialActor',confirmedAt:Date.now(),result:{ok:true}};patch.sv_labor_guard=null;
 const incomplete=structuredClone(patch);delete incomplete[Model.index+'/inventario_operativo/P'];await assertFails(update(ref(db),incomplete));
 await assertSucceeds(update(ref(db),patch));await assertFails(update(ref(db),patch));
 await env.withSecurityRulesDisabled(async ctx=>{const adminDB=ctx.database(),current=(await get(ref(adminDB,record))).val();assert.equal(current.general,36);assert.equal((await get(ref(adminDB,'sv_labor_guard'))).val(),null);assert.equal((await get(ref(adminDB,'sisventas/pagos/untouched/monto'))).val(),10);});
});
