'use strict';
const crypto=require('node:crypto');
const Matcher=require('./payment-membership-matcher');
const {MATCHER_HASH,TECHNICAL_FIELDS,BUSINESS_FIELDS,paymentReferences,saleReferences}=Matcher;
const VERSION=1,INDEX_ROOT='sv_labor_indexes/paymentRefs_v1',COVERAGE_PATH=INDEX_ROOT+'/coverage';
const KINDS=Object.freeze(['technical','businessExact','businessDigits']);
const HEX=/^[a-f0-9]{64}$/,MODULUS=1n<<256n;
const invalid=message=>Object.assign(Error(message),{statusCode:400,code:'SV_PAYMENT_INDEX_INPUT'});
const corrupt=message=>Object.assign(Error(message),{statusCode:503,code:'SV_PAYMENT_INDEX_INVALID'});
function plain(v){return v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));}
function assign(obj,key,value){Object.defineProperty(obj,key,{value,writable:true,enumerable:true,configurable:true});}
function recordKey(key){if(typeof key!=='string'||!key||Buffer.byteLength(key)>768||/[.#$\[\]\/\x00-\x1f\x7f]/.test(key))throw invalid('Clave de pago inválida');return key;}
function canonical(value){if(value===null)return'null';if(Array.isArray(value))return'['+value.map(canonical).join(',')+']';if(plain(value))return'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value);}
const digest=value=>crypto.createHash('sha256').update(canonical(value)).digest('hex');
// Prospective images use RTDB semantics: null and empty containers disappear;
// dense numeric maps are returned as arrays, as DataSnapshot.val() returns them.
function normalizeRtdb(value,depth=0,ancestors=new Set()){
 if(depth>32)throw invalid('Pago demasiado anidado');
 if(value===null)return null;
 if(typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))throw invalid('Número de pago inválido');return Object.is(value,-0)?0:value;}
 if(!plain(value)&&!Array.isArray(value))throw invalid('Valor de pago inválido');
 if(ancestors.has(value))throw invalid('Pago circular');ancestors.add(value);
 try{
  const out={};let count=0,max=-1,numeric=true;
  for(const key of Object.keys(value)){
   recordKey(key);const next=normalizeRtdb(value[key],depth+1,ancestors);if(next===null)continue;
   assign(out,key,next);count++;
   if(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>2147483647)numeric=false;else max=Math.max(max,Number(key));
  }
  if(!count)return null;
  if(numeric&&max<2*count){const array=Array(max+1).fill(null);for(const key of Object.keys(out))array[Number(key)]=out[key];return array;}
  return out;
 }finally{ancestors.delete(value);}
}
function normalizeRecord(record){
 if(record==null)return null;
 if(!plain(record))throw invalid('Registro de pago inválido');
 const normalized=normalizeRtdb(record);if(normalized!==null&&!plain(normalized))throw invalid('Registro de pago inválido');return normalized;
}
function bucketPath(kind,token){if(!KINDS.includes(kind)||typeof token!=='string'||!token||token.trim()!==token)throw invalid('Referencia de pago inválida');return INDEX_ROOT+'/'+kind+'/'+crypto.createHash('sha256').update(token).digest('hex');}
function queryPaths(sale){const refs=saleReferences(sale),paths=[];for(const kind of KINDS)for(const token of refs[kind])paths.push(bucketPath(kind,token));return Array.from(new Set(paths)).sort();}
function reversePath(key){return INDEX_ROOT+'/byPayment/'+recordKey(key);}
function relationImage(record){const image=Object.create(null);for(const key of [...TECHNICAL_FIELDS,...BUSINESS_FIELDS])if(Object.hasOwn(record,key))assign(image,key,record[key]);return image;}
function reverseMetadata(key,record){
 recordKey(key);record=normalizeRecord(record);if(record===null)return null;
 const refs=paymentReferences(record),tokenPaths=[];
 for(const kind of KINDS)for(const token of refs[kind])tokenPaths.push(bucketPath(kind,token).slice(INDEX_ROOT.length+1));
 return{schema:VERSION,matcherHash:MATCHER_HASH,relationDigest:digest({schema:VERSION,matcherHash:MATCHER_HASH,relations:relationImage(record)}),tokenPaths:tokenPaths.sort(),hasTechnicalRefs:refs.hasTechnicalRefs};
}
function indexEntries(key,record){
 const meta=reverseMetadata(key,record),entries=Object.create(null);if(!meta)return entries;
 for(const relative of meta.tokenPaths)assign(entries,INDEX_ROOT+'/'+relative+'/'+key,true);
 assign(entries,reversePath(key),meta);return entries;
}
function validateReverse(key,record,metadata){
 const expected=reverseMetadata(key,record);if(canonical(normalizeRtdb(metadata??null))!==canonical(normalizeRtdb(expected)))throw corrupt('La pertenencia del pago no coincide con sus referencias');return expected;
}
function contribution(key,metadata){return digest({key:recordKey(key),relationDigest:metadata.relationDigest,tokenPaths:metadata.tokenPaths,hasTechnicalRefs:metadata.hasTechnicalRefs});}
function addHash(accumulator,value,sign=1){let next=(BigInt('0x'+accumulator)+BigInt(sign)*BigInt('0x'+value))%MODULUS;if(next<0n)next+=MODULUS;return next.toString(16).padStart(64,'0');}
function coverageDigest(meta){return digest({schema:meta.schema,matcherHash:meta.matcherHash,paymentCount:meta.paymentCount,membershipCount:meta.membershipCount,relationAccumulator:meta.relationAccumulator});}
function validateCoverage(metadata,{requireReady=true}={}){
 const keys=['schema','matcherHash','generation','ready','paymentCount','membershipCount','relationAccumulator','buildDigest','sequence'];
 if(!plain(metadata)||Object.keys(metadata).length!==keys.length||keys.some(key=>!Object.hasOwn(metadata,key))||metadata.schema!==VERSION||metadata.matcherHash!==MATCHER_HASH||typeof metadata.generation!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(metadata.generation)||typeof metadata.ready!=='boolean'||requireReady&&!metadata.ready||![metadata.paymentCount,metadata.membershipCount,metadata.sequence].every(n=>Number.isSafeInteger(n)&&n>=0)||!HEX.test(metadata.relationAccumulator)||!HEX.test(metadata.buildDigest)||metadata.buildDigest!==coverageDigest(metadata))throw corrupt('La cobertura del índice de pagos no está preparada o no es válida');
 if(metadata.membershipCount>metadata.paymentCount*12)throw corrupt('Los contadores del índice de pagos no coinciden');
 return JSON.parse(JSON.stringify(metadata));
}
function buildIndex(payments,{generation,ready=false,sequence=0}={}){
 if(payments!=null&&!plain(payments)&&!Array.isArray(payments))throw invalid('Colección de pagos inválida');
 const patch=Object.create(null),coverage={schema:VERSION,matcherHash:MATCHER_HASH,generation,ready,paymentCount:0,membershipCount:0,relationAccumulator:'0'.repeat(64),buildDigest:'',sequence};
 for(const [key,record]of Object.entries(payments||{})){
  const metadata=reverseMetadata(key,record);if(!metadata)continue;
  Object.assign(patch,indexEntries(key,record));coverage.paymentCount++;coverage.membershipCount+=metadata.tokenPaths.length;coverage.relationAccumulator=addHash(coverage.relationAccumulator,contribution(key,metadata));
 }
 coverage.buildDigest=coverageDigest(coverage);validateCoverage(coverage,{requireReady:false});assign(patch,COVERAGE_PATH,coverage);return{patch,coverage};
}
// A writer supplies every touched record's actual inverse metadata, including
// explicit null for a new payment. Missing metadata is never an empty bucket.
function planIndexDelta(changes,{coverage}={}){
 if(!Array.isArray(changes))throw invalid('Cambios de pagos inválidos');
 const next=validateCoverage(coverage),patch=Object.create(null),seen=new Set();
 if(!changes.length)return{patch,coverage:next,changedPayments:0};
 if(next.sequence===Number.MAX_SAFE_INTEGER)throw corrupt('La secuencia del índice de pagos se agotó');
 for(const change of changes){
  if(!plain(change)||!Object.hasOwn(change,'before')||!Object.hasOwn(change,'after')||!Object.hasOwn(change,'reverseBefore'))throw invalid('Faltan las imágenes o pertenencia del pago');
  const key=recordKey(change.key);if(seen.has(key))throw invalid('Pago repetido en el delta');seen.add(key);
  const before=validateReverse(key,change.before,change.reverseBefore),after=reverseMetadata(key,change.after);
  const previous=indexEntries(key,change.before),following=indexEntries(key,change.after);
  for(const path of Object.keys(previous))if(!Object.hasOwn(following,path))assign(patch,path,null);
  for(const [path,value]of Object.entries(following))if(!Object.hasOwn(previous,path)||canonical(previous[path])!==canonical(value))assign(patch,path,value);
  if(before){next.paymentCount--;next.membershipCount-=before.tokenPaths.length;next.relationAccumulator=addHash(next.relationAccumulator,contribution(key,before),-1);}
  if(after){next.paymentCount++;next.membershipCount+=after.tokenPaths.length;next.relationAccumulator=addHash(next.relationAccumulator,contribution(key,after));}
 }
 next.sequence++;next.buildDigest=coverageDigest(next);validateCoverage(next);assign(patch,COVERAGE_PATH,next);return{patch,coverage:next,changedPayments:seen.size};
}
function paymentKeysForPatch(patch){
 if(!plain(patch))throw invalid('Cambios de pagos inválidos');const keys=new Set();
 for(const path of Object.keys(patch)){
  if(!path||path.length>2048||path.split('/').some(part=>{try{recordKey(part);return false;}catch{return true;}}))throw invalid('Ruta de guardado inválida');
  if(path==='sisventas'||path==='sisventas/pagos')throw invalid('Los pagos requieren registros individuales');
  if(path==='sv_labor_indexes'||path===INDEX_ROOT||path.startsWith(INDEX_ROOT+'/'))throw invalid('La pertenencia de pagos sólo la mantiene el coordinador');
  if(path.startsWith('sisventas/pagos/'))keys.add(recordKey(path.split('/')[2]));
 }
 return Array.from(keys).sort();
}
module.exports={...Matcher,VERSION,INDEX_ROOT,COVERAGE_PATH,KINDS,recordKey,normalizeRtdb,normalizeRecord,bucketPath,queryPaths,saleQueryPaths:queryPaths,reversePath,reverseMetadata,indexEntries,validateReverse,validateCoverage,buildIndex,planIndexDelta,paymentKeysForPatch,canonical,digest};
