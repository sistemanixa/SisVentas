'use strict';
// Opt-in local composition. Same genuine authorities as full-app QA; no network
// or Rules certification. The caller supplies the reviewed private Rules bytes.
const test=require('node:test'),a=require('node:assert/strict'),path=require('node:path');
test('standalone delivery validates its source after Order derivatives, while a forged fence still aborts the entire commit',async()=>{
 const sourceRoot=path.resolve(__dirname,'..'),baselineRulesPath=process.env.SV_NATIVE_RULES_BASELINE,baselineDigest=process.env.SV_NATIVE_RULES_DIGEST;a.ok(baselineRulesPath&&baselineDigest,'Explicit reviewed Rules baseline required');
 const nativeFactoryFile=path.join(sourceRoot,'test/helpers/inventory-native-application-fixture.cjs'),options={sourceRoot,uiRoot:sourceRoot,baselineRulesPath,baselineDigest};
 const seed=await require('./helpers/purchase-full-app-critical-seed.cjs').prepare({nativeFactoryFile,...options}),f=await require(nativeFactoryFile).create({...options,rolePermissions:seed.rolePermissions,sourceSeed:seed.sourceSeed});
 try{
  const H=require('./helpers/purchase-full-app-real-host-fixture.cjs');let mount;
  const composed=await H.createFixture({sourceRoot,nativeFixture:f,authorize:req=>mount.gateway.authorize(req),createOrderDelete:({store,guard,authorize})=>require('../cotizador/purchase-order-delete').createPurchaseOrderDelete({store,guard,authorize,enabled:true,review:require('../cotizador/purchase-order-delete-review').create({env:{}})})});
  mount=await H.createApiMount({sourceRoot,composed,nativeFixture:f});
  const historical=f.get('sisventas/ordenes_trabajo/ot'),ledgerPath='sisventas/inventario_operativo/'+f.keys.inventory,before=f.get(ledgerPath);
  const created=await mount.structure.execute(f.identity,{id:'order-delivery-creation',kind:'create',changes:{clienteFbKey:'qaClient',tecnicoFbKey:'qaTech',materiales:[{productoKey:f.keys.product,qty:2,instalada:0}]}}),otPath='sisventas/ordenes_trabajo/'+created.otKey;
  const body={id:'order-delivery-first',kind:'delivery',otKey:created.otKey,expectedOTHash:composed.digest(f.get(otPath)),changes:{entregas:[{index:0,cantidad:1}]}};
  await mount.inventory.execute(f.identity,body);const after=f.get(ledgerPath);a.equal(after.general,before.general-1);a.equal(after.reservado,before.reservado+1);for(const [key,value]of Object.entries(before.asignaciones||{}))a.deepEqual(after.asignaciones[key],value,'Unrelated historical reservation stays exact');a.deepEqual(f.get('sisventas/ordenes_trabajo/ot'),historical);
  const last=composed.calls.filter(x=>x.options.method==='PATCH').at(-1),token=JSON.parse(last.target.searchParams.get('auth_variable_override')).token;a.equal(token.svStockOrderWriterVersion,1);a.equal(token.svOTInventoryVersion,1);a.equal(token.svOTPhysicalCommitVersion,1);
  const count=composed.counts().commits;await mount.inventory.execute(f.identity,body);a.equal(composed.counts().commits,count);
  const snapshot=f.get('sisventas'),commit=composed.store.commit.bind(composed.store);let tampered=0;
  composed.store.commit=(patch,lease,actor)=>{tampered++;const Order=require('../cotizador/office-stock-order');a.ok(patch[Order.FENCE]);patch[Order.FENCE].revision++;return commit(patch,lease,actor);};
  await a.rejects(mount.inventory.execute(f.identity,{...body,id:'order-delivery-tampered',expectedOTHash:composed.digest(f.get(otPath)),changes:{entregas:[{index:0,cantidad:1}]}}),e=>e.code==='SV_STOCK_ORDER_CAPABILITY');
  a.equal(tampered,1);a.equal(composed.counts().commits,count);a.deepEqual(f.get('sisventas'),snapshot);
 }finally{f.cleanup();}
},{timeout:120000});
