'use strict';
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const sourceRoot=path.resolve(process.env.SV_DELETE_RUNTIME_SOURCE||path.join(__dirname,'../..'));
const fromSource=name=>require(path.join(sourceRoot,name));
const files=['cotizador/commercial-delete-runtime.js','cotizador/commercial-delete-attestation.js','cotizador/commercial-delete-commit-protocol.js','cotizador/labor-guard.js','cotizador/labor-runtime.js','cotizador/labor-rtdb-store.js','cotizador/sale-delete-command.js','cotizador/sale-delete-http-adapter.js','cotizador/purchase-order-delete.js','cotizador/ot-delete-command.js','cotizador/ot-delete-http-adapter.js'];
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(sourceRoot,name))).digest('hex');
const initialHashes=Object.fromEntries(files.map(name=>[name,hash(name)]));
const {apply}=require('./labor-ui-flow.cjs');
async function create(operation){
 const f=await require('./commercial-delete-attestation-fixture.cjs').fixture();
 if(operation==='otDelete'){
  apply(f.state,{'sisventas/ordenes_trabajo/o':{id:'OT-FICTITIOUS',clienteFbKey:'c',responsableUid:'u',materiales:[]}});
  const H=fromSource('cotizador/client-history-model.js'),records=Object.fromEntries(H.domains.map(domain=>[domain,f.get('sisventas/'+domain)||{}]));
  apply(f.state,(await H.prepare({records,customers:{clients:f.get('sisventas/clientes'),structures:{},index:{}},owner:record=>record.responsableUid||'u',generation:f.pins.projections.clientHistory.generation})).patch);
  apply(f.state,{sv_record_list_config:{ready:true,schema:1},'sisventas/listados_resumen/ordenes_trabajo/o':fromSource('cotizador/record-list-model.js').summary('ordenes_trabajo',f.get('sisventas/ordenes_trabajo/o'))});
 }
 if(operation==='orderDelete')apply(f.state,{'sisventas/ordenes/o':{id:'OC-FICTITIOUS',estado:'pendiente',items:[]},'sisventas/inventario_operativo/preserved':{general:9,enCompra:0}});
 apply(f.state,{'sv_permisos/admin':{indiceVersion:2,indiceRevision:1,indiceModulos:{venta:true,ordenes:true,ordentrabajo:true},acciones:{ventas:{eliminar:true},ordenes:{eliminar:true},ot:{eliminar:true}}}});
 f.store.saleDeleteFenceReady=true;f.store.saleDeleteActivityFenceReady=true;f.store.operationalFenceReady=true;f.store.otDeleteFenceReady=true;f.store.saleDeleteFinancialEvidence=fromSource('cotizador/sale-financial-dependencies-provider.js').create();
 const guard=fromSource('cotizador/labor-guard.js').createLaborGuard({store:f.store,saleFinancialDependencies:true,commercialPages:true,clientAccounts:true,clientHistory:true,operationalSummaries:true,delay:async()=>{}});
 const readiness=fromSource('cotizador/commercial-delete-runtime.js').create({env:{COMMERCIAL_DELETE_ENABLED:'true',COMMERCIAL_DELETE_ATTESTATION_PUBLIC_KEY:f.publicKey,COMMERCIAL_DELETE_PINS_JSON:JSON.stringify(f.pins)},read:f.input.read,runtime:()=>f.runtime,now:()=>1000});
 const calls=[],patches=[],tokens=[];let captureHook=null,currentHook=null,commitHook=null,currentCount=0,identity={uid:'u',claims:{uid:'u'}},authRevoked=false,captured=null;
 const observed={async capture(op){calls.push('capture:'+op);captured=await readiness.capture(op);return captureHook?await captureHook(captured):captured;},async assertCurrent(proof,read){calls.push('current');if(currentHook)await currentHook(++currentCount);return readiness.assertCurrent(proof,read);},async commitClaims(input){calls.push('commit');if(commitHook)await commitHook(input);return readiness.commitClaims(input);}};
 f.store.commercialDeleteReadiness=observed;
 const transport=fromSource('cotizador/labor-rtdb-store.js').createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=>'FICTIONAL',commercialDeleteReadiness:observed,fetchImpl:async(input,init)=>{
  const url=new URL(input),key=decodeURIComponent(url.pathname.slice(1).replace(/\.json$/,''));
  if(init.method==='PATCH'){patches.push(JSON.parse(init.body));tokens.push(JSON.parse(url.searchParams.get('auth_variable_override')).token);return {ok:true,status:200,body:{cancel:async()=>{}}};}
  if(init.method!=='GET')throw Error('Unexpected transport request '+init.method);
  return {ok:true,status:200,json:async()=>f.get(key),body:{cancel:async()=>{}}};
 }});
 const commit=f.store.commit;f.store.commit=async(patch,lease,actor)=>{if(actor.commercialDeleteProof!==captured)throw Error('Opaque proof reference lost before transport');await transport.commit(patch,lease,actor);return commit(patch,lease,actor);};
 const authorize=async()=>{calls.push('auth');if(authRevoked)throw Object.assign(Error('Fictional auth revoked'),{statusCode:403});return identity;};
 const key=operation==='saleDelete'?'s':'o',domain={saleDelete:'ventas',orderDelete:'ordenes',otDelete:'ordenes_trabajo'}[operation],field={saleDelete:'ventaKey',orderDelete:'orderKey',otDelete:'otKey'}[operation],route={saleDelete:'/comerciales/ventas/eliminar',orderDelete:'/compras/ordenes/eliminar',otDelete:'/operaciones/ot/eliminar'}[operation];
 const body={id:'mounted-fixture-'+operation,[field]:key,expectedHash:fromSource('cotizador/labor-guard.js').digest(f.get('sisventas/'+domain+'/'+key))};
 const adapter=operation==='saleDelete'?fromSource('cotizador/sale-delete-http-adapter.js').createSaleDeleteHttpAdapter({authorize,store:f.store,guard,enabled:true}):operation==='orderDelete'?fromSource('cotizador/purchase-order-delete.js').createPurchaseOrderDelete({authorize,store:f.store,guard,enabled:true}):fromSource('cotizador/ot-delete-http-adapter.js').createOTDeleteHttpAdapter({authorize,store:f.store,guard,enabled:true});
 return {...f,readiness,observed,calls,patches,tokens,body,path:'sisventas/'+domain+'/'+key,run:()=>adapter.handle({method:'POST',url:route},body),setCaptureHook:hook=>captureHook=hook,setCurrentHook:hook=>currentHook=hook,setCommitHook:hook=>commitHook=hook,changeIdentity:()=>identity={uid:'other',claims:{uid:'other'}},revokeAuth:()=>authRevoked=true,setClaims:claims=>identity={uid:'u',claims:{uid:'u',...claims}}};
}
module.exports={create,fromSource,sourceRoot,initialHashes,currentHashes:()=>Object.fromEntries(files.map(name=>[name,hash(name)])),apply};
