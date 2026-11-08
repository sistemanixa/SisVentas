'use strict';
// In-process evaluation of the real offline builder's write expression. This
// closes the 6b fixture boundary locally; it is not an emulator/deployment proof.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/commercial-delete-attestation-fixture.cjs');
const {apply}=require('./helpers/labor-ui-flow.cjs'),{digest}=require('../cotizador/labor-guard');
const Builder=require('../scripts/lib/operational-write-fence.cjs'),{create}=require('../js/core/labor-writes.js');
function snapshot(value){return {val:()=>value??null,exists:()=>value!==null&&value!==undefined,isNumber:()=>typeof value==='number',child:path=>snapshot(String(path).split('/').filter(Boolean).reduce((v,key)=>v?.[key],value))};}
function writer(f,domain){
 const baseline={rules:{'.write':false,sisventas:{'.write':false,...Object.fromEntries(Builder.domains.map(name=>[name,{'.write':false,$record:{'.write':"auth != null && auth.uid === 'u'"}}])),compras_resumen:Object.fromEntries(Builder.summaryDomains.map(name=>[name,{'.write':false,$record:{'.write':"auth != null && auth.uid === 'u'"}}]))}}};
 const rule=Builder.prepare(baseline).rules.sisventas[domain].$record['.write'];
 const evaluate=new Function('root','auth','now','newData','data','return ('+rule+');');
 let attempts=0;
 const unused=()=>{throw Error('Unexpected SDK operation');},ref=(_,path)=>({toString:()=> 'https://fixture.invalid/'+path});
 const sdk={ref,set:unused,update:unused,remove:unused,push:unused,get:unused,async runTransaction(reference,transform){
  attempts++;const path=new URL(reference.toString()).pathname.slice(1),before=f.get(path),next=transform(before);
  if(!evaluate(snapshot(f.state),{uid:'u',token:{}},Date.now(),snapshot(next),snapshot(before)))throw Object.assign(Error('Fictional RTDB write denied by generated rule'),{code:'PERMISSION_DENIED'});
  apply(f.state,{[path]:next});return {committed:true,snapshot:{val:()=>f.get(path)}};
 }};
 const root={fbDB:{},currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}}};create(root).install({sdk});
 return {attempts:()=>attempts,write:()=>root.fbRunTransaction(ref(root.fbDB,'sisventas/'+domain+'/late'),value=>value||{ventaFbKey:'s',ventaId:'V-FICTIONAL'},{applyLocally:false})};
}
for(const domain of ['agenda','remitos','equipos','tickets']){
 test('generated '+domain+' rule preserves authorized idle writer',async()=>{const f=await fixture(),sdk=writer(f,domain);assert.equal((await sdk.write()).committed,true);assert.equal(f.get('sisventas/'+domain+'/late/ventaFbKey'),'s');assert.equal(f.commits.length,0);});
 test('real saleDelete + generated '+domain+' rule exclude the 6b post-validation writer',async()=>{
  const f=await fixture();apply(f.state,{'sv_permisos/admin':{indiceVersion:2,indiceRevision:1,indiceModulos:{venta:true},acciones:{ventas:{eliminar:true}}}});
  // Existing legacy command fixture prerequisites; actual financial provider
  // and projections are used. No runtime fence is enabled by this module.
  f.store.saleDeleteFenceReady=true;f.store.saleDeleteActivityFenceReady=true;f.store.saleDeleteFinancialEvidence=require('../cotizador/sale-financial-dependencies-provider').create();
  const command=require('../cotizador/sale-delete-command').createSaleDeleteCommand({guard:f.guard,store:f.store,enabled:true,verifyActor:async()=>{}});
  const protectedBefore=structuredClone({gastos:f.get('sisventas/gastos'),ctaemp:f.get('sisventas/ctaemp'),stock:f.get('sisventas/stock'),generation:f.get('sv_commission_generation')});
  const proof=await f.verifier.verify(f.input);assert(proof);const sdk=writer(f,domain),commit=f.store.commit;
  f.store.commit=async(...args)=>{assert(f.get('sv_labor_guard'));await f.verifier.assertCurrent({proof,readFresh:f.input.read,runtime:f.runtime});await assert.rejects(sdk.write(),{code:'PERMISSION_DENIED'});return commit(...args);};
  const body={id:'exclusion-fixture-'+domain,ventaKey:'s',expectedHash:digest(f.get('sisventas/ventas/s'))};
  assert.equal((await command.execute({uid:'u',claims:{uid:'u'}},body)).committed,true);
  assert.equal(sdk.attempts(),1);assert.equal(f.get('sisventas/'+domain+'/late'),null);assert.equal(f.get('sisventas/ventas/s'),null);assert.equal(f.commits.length,1);
  assert.deepEqual({gastos:f.get('sisventas/gastos'),ctaemp:f.get('sisventas/ctaemp'),stock:f.get('sisventas/stock'),generation:f.get('sv_commission_generation')},protectedBefore);
  await command.execute({uid:'u',claims:{uid:'u'}},body);assert.equal(f.commits.length,1);assert.equal(sdk.attempts(),1);
 });
}
