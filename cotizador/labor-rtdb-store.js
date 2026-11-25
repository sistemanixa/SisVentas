'use strict';
const {parts}=require('./labor-guard');
const FinancialProtocol=require('./sale-financial-dependencies-protocol');
const AccountsProtocol=require('./client-account-writer-protocol');
const StockLinkPolicy=require('./office-stock-link-policy');
const PurchaseSourceProtocol=require('./purchase-source-cost-protocol');
const StockOrderPolicy=require('./office-stock-order-policy');
const PurchaseNumberingProtocol=require('./purchase-numbering-protocol');
const EmployeeResourcesPolicy=require('./employee-resources-policy');
const OTNative=require('./ot-native-write-protocol');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
function createLaborRtdbStore({databaseURL,accessToken,fetchImpl=fetch,now=Date.now,requestMs=20000,verifyOTDeliveryFence,otPhysicalWrites=false}){
 if(typeof otPhysicalWrites!=='boolean')throw Error('La protección física de OT requiere configuración explícita.');
 const base=new URL(databaseURL);if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)))throw Error('Destino de datos inválido');
 const local=['127.0.0.1','localhost'].includes(base.hostname),namespace=local?base.searchParams.get('ns'):null;
 if(base.search&&(!local||[...base.searchParams.keys()].some(key=>key!=='ns')))throw Error('Configuración de datos inválida');
 const root=new URL(base);root.search='';root.pathname=root.pathname.replace(/\/?$/,'/');
 function target(path){const result=new URL(path,root);if(namespace)result.searchParams.set('ns',namespace);return result;}
 function url(path,override,query){const result=target(parts(path).map(encodeURIComponent).join('/')+'.json');if(override!==undefined)result.searchParams.set('auth_variable_override',JSON.stringify(override));if(query)for(const [key,value]of Object.entries(query))result.searchParams.set(key,JSON.stringify(value));return result;}
 async function request(method,path,body,{override,headers={},query}={}){
  const token=await accessToken();const response=await fetchImpl(url(path,override,query),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(requestMs)});
  if(!response.ok){await response.body?.cancel();throw fail(response.status===401||response.status===403?403:response.status===412?409:503,'No se pudo confirmar el acceso o el guardado',response.status===412?'SV_CAS_CONFLICT':undefined);}
  return response;
 }
 const sanitizedClaims=claims=>{const clean=Object.fromEntries(Object.entries(PurchaseNumberingProtocol.sanitize(StockOrderPolicy.sanitizeClaims(PurchaseSourceProtocol.sanitize(StockLinkPolicy.sanitizeClaims(claims))))).filter(([name])=>!name.startsWith('svOfficeStock')&&!/^svOT(?:Metadata|Inventory|Count|Physical|Lifecycle)/.test(name)));delete clean.svLaborWriterSchema;return clean;};
 const service=(mode,lease,actor)=>({uid:actor?.mode==='user'?actor.uid:'sv-labor-service',token:{...(actor?.mode==='user'?sanitizedClaims(actor.claims):{}),svLaborService:true,...(actor?.saleFinancialWriterVersion===1||actor?.clientAccountsWriterVersion===1||actor?.clientHistoryWriterVersion===1?{svLaborWriterSchema:2}:{}),...FinancialProtocol.reservedClaims(actor?.saleFinancialWriterVersion),...AccountsProtocol.reservedClaims(actor?.clientAccountsWriterVersion),svClientHistoryWriterVersion:actor?.clientHistoryWriterVersion===1?1:0,svPaymentIndexVersion:1,...OTNative.reserved(),svFinancialAction:actor?.mode==='user'?actor.financialAction||'':'',svFinancialActorRole:actor?.mode==='user'&&actor.financialAction?actor.role||'':'',svFinancialPermissionRevision:actor?.mode==='user'&&actor.financialAction?actor.permissionRevision??null:null,mode,fence:lease.fence,opId:lease.opId,digest:lease.digest,actorUid:lease.actorUid,...(actor?.mode==='command'?{actorAccessVersion:actor.claims?.svAccessVersion||'',actorPasswordChangeRequired:actor.claims?.svPasswordChangeRequired===true,actorRole:actor.role||'',actorPermissionRevision:actor.permissionRevision??null}:{})}});
 async function read(path){const r=await request('GET',path);return r.json();}
 async function readQuery(path,query){
  if(!query||!['$key','uid'].includes(query.orderBy)||!Number.isInteger(query.limitToFirst)||query.limitToFirst<1||query.limitToFirst>50||Object.keys(query).some(k=>!['orderBy','limitToFirst','equalTo','startAt'].includes(k)))throw fail(400,'Consulta de lectura inválida');
  if(query.orderBy==='uid'&&(query.limitToFirst>2||typeof query.equalTo!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(query.equalTo)||Object.hasOwn(query,'startAt'))||query.orderBy==='$key'&&(Object.hasOwn(query,'equalTo')||Object.hasOwn(query,'startAt')&&(typeof query.startAt!=='string'||query.startAt.length>769)))throw fail(400,'Límite de lectura inválido');
  const r=await request('GET',path,undefined,{query});return r.json();
 }
 async function queryPage(path,query){
  const fields={
   'sisventas/productos':['$key','codigo','cod','id'],
   'sisventas/inventario_operativo':['$key','codigo','cod','id','productoKey','productKey'],
   'sisventas/stock_vinculos/porProducto':['productKey','inventoryKey'],
   'sisventas/stock_vinculos/porInventario':['productKey','inventoryKey']
  };
  const own=(name)=>Object.hasOwn(query,name),scalar=value=>typeof value==='string'&&value.length<=512||typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean';
  if(!Object.hasOwn(fields,path)||!query||typeof query!=='object'||Array.isArray(query)||!fields[path].includes(query.orderBy)||!Number.isInteger(query.limitToFirst)||query.limitToFirst<2||query.limitToFirst>129||Object.keys(query).some(name=>!['orderBy','limitToFirst','equalTo','startAt','endAt'].includes(name))||own('equalTo')&&(own('startAt')||own('endAt'))||!own('equalTo')&&!own('startAt')&&query.orderBy!=='$key'||['equalTo','startAt','endAt'].some(name=>own(name)&&(!scalar(query[name])||query.orderBy==='$key'&&typeof query[name]!=='string'))||path.includes('/stock_vinculos/')&&(!own('equalTo')||typeof query.equalTo!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(query.equalTo)))throw fail(400,'Consulta dirigida de stock inválida','SV_STOCK_QUERY_INPUT');
  const r=await request('GET',path,undefined,{query});return r.json();
 }
 async function acquire(lease,writer={}){
  // La exclusión la aplican las reglas en un PUT pequeño; no hay lectura raíz.
  let response;try{response=await request('PUT','sv_labor_guard',lease,{override:service('acquire',lease,{clientAccountsWriterVersion:writer.clientAccountsWriterVersion===1?1:0,clientHistoryWriterVersion:writer.clientHistoryWriterVersion===1?1:0,saleFinancialWriterVersion:writer.saleFinancialWriterVersion===1?1:0})});}catch(error){if(error.statusCode===403){const current=await read('sv_labor_guard');if(current?.expiresAt>now())throw fail(423,'Hay otro guardado en curso. Reintentá en unos segundos.','SV_LABOR_BUSY');}throw error;}await response.body?.cancel();
 }
 async function commit(patch,lease,actor){
  // Share only this final commit phase; no planning or session cache.
  const readCommit=require('./office-stock-reference-io').memoRead(read).read;
  if(actor?.commercialContext===true){
   const checked=await Promise.allSettled([readCommit('sv_chat_roles/'+actor.uid),readCommit('sv_permisos/'+actor.role)]),failed=checked.find(result=>result.status==='rejected');if(failed)throw failed.reason;
   require('./commercial-ownership').validateCommercialActor(actor,checked[0].value,checked[1].value);
  }
  if(actor?.otLifecycle?.kind==='delivery'){const proof=await verifyOTDeliveryFence?.({read});if(proof?.schema!==1||proof.verified!==true||proof.canonicalOT!==true||proof.inventory!==true||!/^[a-f0-9]{64}$/.test(proof.rulesDigest||''))throw fail(503,'Fence de entrega no verificado.','SV_OT_DELIVERY_NOT_READY');}
  StockOrderPolicy.validate(actor,lease,patch,now());
  const sourcePatch=actor?.officeStockOrder?StockOrderPolicy.sourcePatch(actor,lease,patch,now()):patch;
  require('./office-stock-policy').validate(actor,lease,sourcePatch);
  await StockLinkPolicy.validate(actor,lease,patch,readCommit,now());
  const otClaims=await OTNative.claims({actor,lease,patch:sourcePatch,readFresh:readCommit,operationalSummaries:actor.operationalSummariesWriterVersion===1,physicalEnabled:otPhysicalWrites,now:now()});
  const override=service('commit',lease,actor);Object.assign(override.token,EmployeeResourcesPolicy.reserved(actor?.claims));if(actor?.employeeResources||actor.operation?.startsWith('employee-resources-'))Object.assign(override.token,EmployeeResourcesPolicy.validate(actor,lease,patch));Object.assign(override.token,require('./commission-write-proof').claims(actor,lease));if(actor?.officeStock||actor.operation==='office-stock-adjustment'||Object.keys(actor?.claims||{}).some(k=>k.startsWith('svOfficeStock'))){const stockToken=require('./office-stock-policy').token(actor,lease);Object.assign(override.token,stockToken,stockToken.svOfficeStockVersion===1?{svLaborWriterSchema:2}:{});}if(actor?.otLifecycle||Object.keys(actor?.claims||{}).some(k=>k.startsWith('svOTLifecycle')))Object.assign(override.token,require('./ot-lifecycle-policy').token(actor,lease));
  Object.assign(override.token,require('./ot-delete-operational-contract').reservedClaims(actor?.claims));
  if(actor?.otDeleteOperationalProof){if(!api.otDeleteOperationalReadiness?.configured)throw fail(503,'La eliminación OT no está preparada.');Object.assign(override.token,await api.otDeleteOperationalReadiness.commitClaims({patch,lease,actor,readFresh:readCommit}),{svLaborWriterSchema:2});}
  Object.assign(override.token,await require('./ot-delivery-commit-protocol').claims({patch:sourcePatch,lease,actor,read:readCommit,operationalSummaries:actor.operationalSummariesWriterVersion===1,now:now(),query:async(path,field,value)=>{const response=await request('GET',path,undefined,{query:{orderBy:field,equalTo:value}});return response.json();}}));
  Object.assign(override.token,otClaims);
  const linkClaims=StockLinkPolicy.token(actor,lease);
  Object.assign(override.token,linkClaims,StockOrderPolicy.token(actor,lease,now()),PurchaseSourceProtocol.claims(actor,lease,sourcePatch));
  Object.assign(override.token,PurchaseNumberingProtocol.claims(actor,lease,sourcePatch));
  if(override.token.svPurchaseNumberingVersion===1)override.token.svLaborWriterSchema=2;
  if(override.token.svStockOrderWriterVersion===1)override.token.svLaborWriterSchema=2;
  if(linkClaims.svStockLinkVersion===1||override.token.svPurchaseSourceCostVersion>0)override.token.svLaborWriterSchema=2;
  if(Buffer.byteLength(JSON.stringify(override))>16384)throw fail(413,'La operación excede el límite de autorización. Dividí los cambios.','SV_LABOR_AUTH_SIZE');
  const token=await accessToken(),destination=target('.json');destination.searchParams.set('auth_variable_override',JSON.stringify(override));destination.searchParams.set('print','silent');
  const response=await fetchImpl(destination,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(patch),signal:AbortSignal.timeout(requestMs)});
  if(response.ok){await response.body?.cancel();return;}
  await response.body?.cancel();throw fail(response.status===401||response.status===403?409:503,'No se pudo confirmar la operación. Revisá su estado antes de reintentar.','SV_LABOR_COMMIT_UNCONFIRMED');
 }
 async function abort(lease){const r=await request('DELETE','sv_labor_guard',undefined,{override:service('abort',lease)});await r.body?.cancel();}
 const api={employeeResourcesCommitVersion:1,read,readQuery,queryPage,acquire,commit,abort,verifyOTDeliveryFence:async()=>verifyOTDeliveryFence?.({read})??null,exists:async(path)=>{parts(path);const response=await request('GET',path,undefined,{query:{shallow:true}});return await response.json()!==null;},query:async(path,field,value)=>{const r=await request('GET',path,undefined,{query:{orderBy:field,equalTo:value}});return r.json();},queryFrom:async(path,field,value)=>{parts(field);if(typeof value!=='string')throw fail(400,'Límite de consulta inválido');const r=await request('GET',path,undefined,{query:{orderBy:field,startAt:value}});return r.json();},readAsUser:async(path,actor)=>{const r=await request('GET',path,undefined,{override:{uid:actor.uid,token:sanitizedClaims(actor.claims)}});return r.json();}};
 return api;
}
module.exports={createLaborRtdbStore};
