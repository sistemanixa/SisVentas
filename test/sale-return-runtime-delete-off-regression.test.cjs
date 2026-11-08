'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
// Optional source override permits a read-only check of the coordinator's
// uncommitted runtime. No production transport or source mutation is used.
const root=process.env.SV_SALE_RETURN_RUNTIME_ROOT||path.resolve(__dirname,'..');
const load=createRequire(path.join(root,'cotizador','labor-runtime.js'));
const {createLaborRuntime}=load('./labor-runtime'),{createLaborWriteGateway}=load('./labor-write-gateway');
const {child,parts,put,digest}=load('./labor-guard'),Payments=load('./payment-membership-index'),Transition=load('./commercial-models/sale-budget-transition.v1.js');
function fixture({permission=true,activity=false}={}){
 const sale={id:'SALE-FICTION',responsableUid:'u',items:[{cod:'P',qty:1,punit:100,costoUnitarioCompra:20}],subtotal:100,descuento:0,iva:0,total:100,conIva:false,...(activity?{facturada:true}:{})};
 let state={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{u:{activo:true,rol:'admin'}},sv_permisos:{admin:{indiceVersion:2,indiceRevision:1,indiceModulos:{venta:true,presupuesto:true},acciones:{ventas:{moverPresupuesto:permission}}}},sisventas:{ventas:{s:sale},sentinel:{stock:37,comision:50}}};
 const read=p=>structuredClone(child(state,parts(p))),write=(p,v)=>{state=put(state,parts(p),v);};
 for(const [p,v]of Object.entries(Payments.buildIndex({},{generation:'fixture-only',ready:true}).patch))write(p,v);
 const calls=[];
 const fetchImpl=async(input,options)=>{
  const url=new URL(input);assert.equal(url.origin,'https://runtime-fixture.invalid');const p=decodeURIComponent(url.pathname.slice(1).replace(/\.json$/,''));calls.push({method:options.method,path:p});
  if(options.method==='GET'){
   let value=read(p);
   if(url.searchParams.has('orderBy')){const field=JSON.parse(url.searchParams.get('orderBy')),match=JSON.parse(url.searchParams.get('equalTo'));value=Object.fromEntries(Object.entries(value||{}).filter(([,row])=>row?.[field]===match));}
   if(url.searchParams.get('shallow')==='true'&&value&&typeof value==='object')value=Object.fromEntries(Object.keys(value).map(k=>[k,true]));
   return new Response(JSON.stringify(value??null));
  }
  if(options.method==='PUT')write(p,JSON.parse(options.body));
  else if(options.method==='DELETE')write(p,null);
  else if(options.method==='PATCH'){for(const [key,value]of Object.entries(JSON.parse(options.body)))write(key,value);}
  else assert.fail('Unexpected fixture method');
  return new Response('null');
 };
 const db={ref:p=>({get:async()=>({val:()=>read(p)})})};
 const runtime=createLaborRuntime({db,databaseURL:'https://runtime-fixture.invalid/',accessToken:async()=> 'fixture-only',enabled:true,fetchImpl,deleteEnvironment:{},deliveryEnvironment:{},commercialPages:false,clientAccounts:false,clientHistory:false,operationalSummaries:false,dashboardBudgets:false,dashboardActivity:false,dashboardPolicyRenewal:false});
 const gateway=createLaborWriteGateway({auth:{verifyIdToken:async()=>({uid:'u'})},db,guard:runtime.guard,store:runtime.store,enabled:true});
 const budget={...Transition.toBudget(sale,{sourceFormat:'sale'}),id:'BUDGET-FICTION',ventaOrigenFbKey:'s',ts:1},destination='sisventas/presupuestos/desde_venta_s';
 const command={id:'runtime-return-fiction',kind:'atomic',purpose:'sale-return-to-budget',path:'',value:{'sisventas/ventas/s':null,[destination]:budget},expectedHashes:{'sisventas/ventas/s':digest(sale),[destination]:digest(null)}};
 return{runtime,gateway,command,read,calls,destination};
}
test('legitimate return to budget still commits through real runtime/store while destructive deletions remain OFF',async()=>{
 const f=fixture();assert.equal(f.runtime.deleteReadiness.configured,false);
 const result=await f.gateway.write({uid:'u',claims:{uid:'u'}},f.command);
 assert.equal(result.committed,true);assert.equal(f.read('sisventas/ventas/s'),null);assert.equal(f.read(f.destination).total,100);assert.deepEqual(f.read('sisventas/sentinel'),{stock:37,comision:50});assert.equal(f.calls.filter(c=>c.method==='PATCH').length,1);assert.equal(f.read('sv_labor_guard'),null);
});
for(const options of [{permission:false},{activity:true}])test('return retains its own permission/activity veto '+JSON.stringify(options),async()=>{
 const f=fixture(options);await assert.rejects(f.gateway.write({uid:'u',claims:{uid:'u'}},f.command),options.permission===false?{statusCode:403}:{code:'SV_SALE_RETURN_BLOCKED'});assert.equal(f.calls.filter(c=>c.method==='PATCH').length,0);assert.equal(f.read('sisventas/ventas/s').total,100);assert.equal(f.read(f.destination),null);
});
