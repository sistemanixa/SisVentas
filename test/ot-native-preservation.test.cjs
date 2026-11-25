'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Life=require('../cotizador/ot-lifecycle-model'),Held=require('../cotizador/ot-custody-held-authority'),Index=require('../cotizador/record-list-model'),{digest}=require('../cotizador/labor-guard'),Fixture=require('./helpers/ot-performance-fixture.cjs');
const checks={preparacion:Array(5).fill(true),instalacion:Array(3).fill(true),verificacion:Array(6).fill(true)};
test('native close preserves RTDB object audit keys and source values for OT and Sale',()=>{
 const before={id:'OT-1',ventaFbKey:'sale',ventaId:'V-1',estado:'en_curso',materiales:[],checks,audit:{original:{accion:'Original OT',data:{keep:1}}}},sale={id:'V-1',otId:'ot',estadoInst:'en_instalacion',audit:{old:{accion:'Original Sale'}}},original=structuredClone({before,sale});
 const plan=Life.plan({before,sale,kind:'close',changes:{conformidadCliente:'conforme',nombreConformidad:'Ficticio',observacionesCierre:''},actor:{uid:'u',name:'Ficticio',otKey:'ot'},at:'2026-11-25T12:00:00.000Z'});
 assert.equal(plan.ot.estado,'completada');assert.equal(Array.isArray(plan.ot.audit),false);assert.deepEqual(plan.ot.audit.original,before.audit.original);assert.deepEqual(plan.saleChanges.audit.old,sale.audit.old);assert.equal(Object.keys(plan.ot.audit).length,2);assert.equal(Object.keys(plan.saleChanges.audit).length,2);plan.ot.audit.original.data.keep=99;assert.deepEqual({before,sale},original);
 assert.throws(()=>Life.plan({before:{...before,audit:{bad:'invalid'}},sale,kind:'close',changes:{conformidadCliente:'conforme'},actor:{uid:'u',name:'Ficticio',otKey:'ot'},at:'2026-11-25T12:00:00.000Z'}));
});
test('native Count closes pending extra with object audits, preserving history and denied missing config',async()=>{
 const Count=require('../cotizador/ot-office-count'),f=await Fixture.create({rowCount:1,otherCount:0,prepare:data=>{
  data.sv_labor_config.otOfficeCountVersion=1;data.sv_permisos.admin.acciones.ot.ajustarStockOficina=true;
  const ot=data.sisventas.ordenes_trabajo.ot;Object.assign(ot,{estado:'con_observaciones',cierreConObservaciones:true,custodiaIniciada:true,custodiaRendida:true,conformidadCliente:'conforme',checks,progreso:100,fechaCierre:'2026-11-01',audit:{old:{accion:'Historia OT'}}});Object.assign(ot.materiales[0],{productoKey:'product0',adicionalOT:true,entregada:2,instalada:2,stockBaseInstalada:0,stockPendiente:true});data.sisventas.ventas.sale.audit={old:{accion:'Historia Sale'}};data.sisventas.inventario_operativo.product0={general:0,reservado:0,consumido:0,asignaciones:{}};data.sisventas.listados_resumen.ordenes_trabajo.ot=Index.summary('ordenes_trabajo',ot);
 }}),api=Count.createOTOfficeCount({...f.runtime,enabled:true}),result=await api.execute(f.identity,{id:'native-count-history',otKey:'ot',productKey:'product0',count:5,reason:'Conteo ficticio',expectedOTHash:digest(f.get('sisventas/ordenes_trabajo/ot')),expectedInventoryHash:digest(f.get('sisventas/inventario_operativo/product0'))});
 assert.equal(result.ot.estado,'completada');assert.deepEqual(result.ot.audit.old,{accion:'Historia OT'});assert.equal(Array.isArray(result.ot.audit),false);assert.deepEqual(f.get('sisventas/ventas/sale/audit/old'),{accion:'Historia Sale'});assert.equal(f.commits.length,1);assert.throws(()=>Count.access({rol:'admin',activo:true},null),{statusCode:403});
});
function heldFixture({fail=false}={}){
 const row=sale=>({productoKey:'product',cod:'PF',vendida:1,entregada:1,instalada:0,devuelta:0,custodiaActiva:true,destinoVenta:'nueva',ventaDestinoFbKey:sale}),ot={ventaFbKey:'main',materiales:Array.from({length:8},(_,i)=>row('sale'+i))},records={ot},values={},index={_svCoverage:{schema:1,ready:true,baselineCount:9,sourceHash:'a'.repeat(64)},ot:Index.summary('ordenes_trabajo',ot)};
 for(let i=0;i<8;i++){const id='other'+i,record={ventaFbKey:'sale'+i,materiales:[row('sale'+i)],fotos:{b:'fiction-b',a:'fiction-a'},firmaBase64:'fiction-signature'};records[id]=record;values['sisventas/ordenes_trabajo/'+id]=record;index[id]=Index.summary('ordenes_trabajo',record);assert(index[id]._svListAttachments.length>=2);index[id]._svListAttachments.reverse();}
 values[Index.index+'/ordenes_trabajo']=index;values['sisventas/productos/product']={codigo:'PF'};let active=0,max=0,reads=0,queries=0;
 const wait=async work=>{active++;max=Math.max(max,active);try{await new Promise(resolve=>setImmediate(resolve));return work();}finally{active--;}};
 const makeRead=()=>async path=>wait(()=>{reads++;if(fail&&path==='sisventas/ordenes_trabajo/other0')throw Error('Fictitious read failure');return structuredClone(values[path]??null);});
 return{ot,records,values,index,group:ot.materiales.map((row,i)=>({rowKey:String(i),transition:{row,target:{...row,instalada:1}}})),read:makeRead(),makeRead,query:async(path,field,value)=>wait(()=>{queries++;return Object.fromEntries(Object.entries(records).filter(([,record])=>record[field]===value));}),stats:()=>({active,max,reads,queries})};
}
test('Held accepts reordered attachment manifest, preserves result and uses bounded native parallelism',async()=>{
 const f=heldFixture(),result=await Held.compute({...f,otKey:'ot',productKey:'product'});for(let i=0;i<8;i++)assert.equal(result.get(String(i)),1);assert.equal(f.stats().max,6);assert.equal(f.stats().active,0);
 f.index.other0._svListAttachments[0]=['different'];await assert.rejects(Held.compute({...f,read:f.makeRead(),otKey:'ot',productKey:'product'}),{code:'SV_OT_MATERIAL_REVIEW'});assert.equal(f.stats().active,0);
});
test('Held failed batch drains all reads and a fresh read phase never reuses cached originals',async()=>{
 const f=heldFixture({fail:true});await assert.rejects(Held.compute({...f,otKey:'ot',productKey:'product'}),/Fictitious read failure/);assert.equal(f.stats().active,0);assert.equal(f.stats().max,6);
 const g=heldFixture();await Held.compute({...g,otKey:'ot',productKey:'product'});g.records.other0.materiales[0].entregada=0;await assert.rejects(Held.compute({...g,read:g.makeRead(),otKey:'ot',productKey:'product'}),{code:'SV_OT_MATERIAL_REVIEW'});assert.equal(g.stats().active,0);
});
async function deliveryFixture({fail=false}={}){
 const A=require('../cotizador/ot-delivery-attestation'),keys=crypto.generateKeyPairSync('ed25519'),payload={schema:2,capability:'ot-delivery-v2',activationId:'native-fixture',rulesSha256:'a'.repeat(64),configGeneration:'native-gen',artifactSha256:'b'.repeat(64),issuedAt:Date.now()-1,canonicalOT:true,inventory:true},marker={...payload,signature:crypto.sign(null,Buffer.from(A.canonical(payload)),keys.privateKey).toString('base64url')},env={OT_DELIVERY_ENABLED:'true',OT_DELIVERY_ATTESTATION_PUBLIC_KEY:keys.publicKey.export({format:'pem',type:'spki'}),OT_DELIVERY_EXPECTED_RULES_SHA256:payload.rulesSha256,OT_DELIVERY_EXPECTED_GENERATION:payload.configGeneration,OT_DELIVERY_EXPECTED_ARTIFACT_SHA256:payload.artifactSha256,OT_DELIVERY_ACTIVATION_ID:payload.activationId};
 const f=await Fixture.create({rowCount:4,otherCount:0,latency:1,tracePhases:true,runtimeModule:{createLaborRuntime:options=>require('../cotizador/labor-runtime').createLaborRuntime({...options,deleteEnvironment:env})},prepare:data=>{
  data.sv_deployment_attestations={ot_delivery:marker};data.sv_operational_read_config.generation='native-gen';data.sv_permisos.admin.acciones.ot.entregarMateriales=true;data.sv_labor_config.otWarehouseVersion=2;
  const ot=data.sisventas.ordenes_trabajo.ot;ot.tecnico='Ficticio';for(let i=0;i<4;i++){Object.assign(ot.materiales[i],{entregada:0,custodiaActiva:false});data.sisventas.inventario_operativo['product'+i]={general:10,reservado:0,consumido:0,asignaciones:{}};}
  for(let i=0;i<8;i++){const other=structuredClone(ot);other.id='OT-OTHER-'+i;data.sisventas.ordenes_trabajo['other'+i]=other;data.sisventas.listados_resumen.ordenes_trabajo['other'+i]=Index.summary('ordenes_trabajo',other);}data.sisventas.listados_resumen.ordenes_trabajo._svCoverage.baselineCount=9;data.sisventas.listados_resumen.ordenes_trabajo.ot=Index.summary('ordenes_trabajo',ot);
 }});
 let pending=0,max=0;f.onRequest(async entry=>{if(entry.phase==='planning'&&entry.method==='GET'&&(entry.path.startsWith('sisventas/productos')||entry.path.startsWith('sisventas/ordenes_trabajo/'))){pending++;max=Math.max(max,pending);try{await new Promise(resolve=>setImmediate(resolve));if(fail&&entry.path==='sisventas/ordenes_trabajo/other0')return {deny:true};}finally{pending--;}}});
 return{...f,pending:()=>pending,max:()=>max,body:{id:'native-parallel-delivery',otKey:'ot',kind:'delivery',expectedOTHash:digest(f.get('sisventas/ordenes_trabajo/ot')),changes:{entregas:[0,1,2,3].map(index=>({index,cantidad:1}))},action:'Ficticio'}};
}
test('Delivery native batches keep canonical Warehouse result and one Source-validated commit',async()=>{
 const f=await deliveryFixture(),result=await f.api.execute(f.identity,f.body);assert.equal(result.committed,true);assert.equal(f.commits.length,1);assert(f.max()>1&&f.max()<=6);assert.equal(f.pending(),0);for(let i=0;i<4;i++){assert.equal(f.get('sisventas/inventario_operativo/product'+i+'/general'),9);assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/'+i+'/entregada'),1);}await f.api.execute(f.identity,f.body);assert.equal(f.commits.length,1);
});
test('Delivery failed parallel originals abort without commit or in-flight reads',async()=>{
 const f=await deliveryFixture({fail:true});await assert.rejects(f.api.execute(f.identity,f.body));assert.equal(f.commits.length,0);assert.equal(f.pending(),0);assert.equal(f.stats().active,0);
});
