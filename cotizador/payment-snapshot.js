'use strict';
const Index=require('./payment-membership-index');
const {digest}=require('./labor-guard');
const fail=(statusCode,message,code='SV_PAYMENT_INDEX_INVALID')=>Object.assign(Error(message),{statusCode,code});
const own=(o,k)=>Object.hasOwn(o||{},k);
async function pool(items,work){
 const values=new Array(items.length);let cursor=0,error;
 await Promise.all(Array.from({length:Math.min(6,items.length)},async()=>{while(!error){const i=cursor++;if(i>=items.length)return;try{values[i]=await work(items[i]);}catch(e){error=e;}}}));
 if(error)throw error;return values;
}
// One request/fence only. Never interprets an absent bucket as proof of coverage.
// Source records, including annulled payments, remain the accounting authority.
function createPaymentSnapshot({store,maxCandidates=10000,financialSales=false}={}){
 if(!store?.readAsUser)throw TypeError('Falta la lectura autorizada de cobros');
 return async function load(scope,actor,saleKeys){
  if(!scope?.get||!actor?.uid||actor.claims?.uid!==actor.uid||!Array.isArray(saleKeys)||!saleKeys.length||saleKeys.length>100||new Set(saleKeys).size!==saleKeys.length)throw fail(400,'Ventas del cobro inválidas');
  const coverage=Index.validateCoverage(await scope.get(Index.COVERAGE_PATH));
  const cache=new Map(),authorized=new Map(),read=path=>{
   if(!cache.has(path))cache.set(path,scope.get(path));return cache.get(path);
  };
  const readUser=path=>{
   if(!authorized.has(path))authorized.set(path,(async()=>{
    if(scope.getAsUser)return scope.getAsUser(path);
    const visible=await store.readAsUser(path,actor),current=await read(path);
    if(digest(visible)!==digest(current))throw fail(409,'El registro cambió. Volvé a revisar el cobro.','SV_CAS_CONFLICT');return current;
   })());return authorized.get(path);
  };
  const sales=Object.create(null),payments=Object.create(null),bySale=Object.create(null);
  await pool(saleKeys,async key=>{
   Index.recordKey(key);const path='sisventas/ventas/'+key;
   if(financialSales){const context=scope.actor;if(context?.uid!==actor.uid||context.mode!=='user'||!['cobranzas.registrar','cobranzas.anular'].includes(context.financialAction)||!context.role||!context.permissionDigest)throw fail(403,'Falta verificar el permiso de cobro','SV_PAYMENT_ACTION_REQUIRED');}
   // La operación financiera autorizada lee sólo la venta indicada internamente.
   // Esto no concede lectura comercial ni devuelve su contenido al navegador.
   const value=financialSales?await read(path):await readUser(path);
   if(!value||typeof value!=='object'||Array.isArray(value))throw fail(409,'La venta ya no está disponible para cobrar','SV_PAYMENT_SALE_MISSING');
   sales[key]={...value,fbKey:key};
  });
  const paths=[...new Set(saleKeys.flatMap(key=>Index.queryPaths(sales[key])))],observedBuckets=new Map();
  await pool(paths,async path=>{
   const bucket=await read(path);if(bucket===null)return;
   if(!bucket||typeof bucket!=='object')throw fail(503,'El índice de cobros requiere revisión');
   for(const [key,value]of Object.entries(bucket)){
    if(Array.isArray(bucket)&&value===null)continue;
    Index.recordKey(key);if(value!==true)throw fail(503,'El índice de cobros requiere revisión');
    if(!observedBuckets.has(key))observedBuckets.set(key,new Set());observedBuckets.get(key).add(path);
    if(observedBuckets.size>maxCandidates)throw fail(413,'Esta venta requiere una revisión específica de su historial','SV_PAYMENT_SCOPE_SIZE');
   }
  });
  await pool([...observedBuckets.keys()],async key=>{
   // Authorized source read also seeds this request's guard image for deltas;
   // do not download the same payment once as service and again as the user.
   const payment=await readUser('sisventas/pagos/'+key);
   if(payment===null)throw fail(503,'El índice de cobros tiene una referencia ausente');
   // The authorized source defines the exact queried memberships. Check every
   // observed bucket, including missing expected links when another link found
   // this candidate. Reverse metadata is required by the central delta only for
   // records actually mutated; it is not a second source of accounting values.
   const expected=Index.indexEntries(key,payment),queried=paths.filter(path=>own(expected,path+'/'+key)),observed=observedBuckets.get(key);
   if(!queried.length||queried.length!==observed.size||queried.some(path=>!observed.has(path)))throw fail(503,'La relación del cobro requiere revisión');
   // Do not broaden the user's read access to any matching historical payment.
   payments[key]={...payment,fbKey:key};
  });
  for(const key of saleKeys)bySale[key]=Object.keys(payments).filter(id=>Index.belongsToSale(payments[id],sales[key])).map(id=>payments[id]);
  return {sales,payments,bySale,coverage};
 };
}
module.exports={createPaymentSnapshot,pool};
