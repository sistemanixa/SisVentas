'use strict';
const F=require('./sale-financial-dependencies-model');
const Matcher=require('./payment-membership-matcher');
const P=require('./payment-membership-index');
const ROOT='sv_sale_delete_relations/v1',CONFIG='sv_sale_delete_relations/config',FINANCIAL_ROOT=ROOT+'/financial/v1';
const domains=Object.freeze(['ventas','pagos','ordenes_trabajo','presupuestos','reclamos','agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo','gastos','ctaemp','comisiones_generacion']);
const roots=Object.freeze(domains.map(d=>'sisventas/'+d).concat('sv_commission_generation'));
const financialRoots=new Set(['sisventas/ventas','sisventas/gastos','sisventas/ctaemp','sisventas/comisiones_generacion','sv_commission_generation']);
const families=new Set(['technical','businessExact','businessDigits','budgetIdentity','budgetSale','claimIdentity','claimSale','otReference']);
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_SALE_DELETE_TARGET_INDEX'});
const txt=Matcher.txtKey,upper=v=>txt(v).replace(/^#/,'').toUpperCase();
function key(v){try{P.recordKey(v);if(['__proto__','constructor','prototype'].includes(v))throw Error();return v;}catch(_){throw fail('Clave de relación inválida.');}}
function classify(path){
 if(typeof path!=='string')throw fail('Ruta de relación inválida.');const parts=path.split('/');
 if(parts[0]==='sv_commission_generation'&&parts.length===2){key(parts[1]);return {root:parts[0],domain:parts[0],key:parts[1]};}
 if(parts[0]!=='sisventas'||!domains.includes(parts[1])||parts.length!==(parts[1]==='ctaemp'?4:3))throw fail('Se requiere un original individual del circuito.');
 parts.slice(2).forEach(key);return {root:parts.slice(0,2).join('/'),domain:parts[1],key:parts.at(-1)};
}
function originalPath(path){
 if(typeof path!=='string')throw fail('Ruta inválida.');const parts=path.split('/');
 if(parts[0]==='sv_commission_generation'){if(parts.length<2)throw fail('No se sustituye una colección del circuito.');const p=parts.slice(0,2).join('/');classify(p);return p;}
 if(parts[0]!=='sisventas')return null;if(parts.length===1)throw fail('No se sustituye la base comercial.');if(!domains.includes(parts[1]))return null;
 const n=parts[1]==='ctaemp'?4:3;if(parts.length<n)throw fail('No se sustituye una colección del circuito.');const p=parts.slice(0,n).join('/');classify(p);return p;
}
function add(set,family,value){if(value)set.add(family+'/'+F.digest(value));}
function refs(set,record){const r=Matcher.paymentReferences(record);for(const family of ['technical','businessExact','businessDigits'])for(const value of r[family])add(set,family,value);}
function saleTokens(sale){const out=new Set(),r=Matcher.saleReferences(sale);for(const family of ['technical','businessExact','businessDigits'])for(const value of r[family])add(out,family,value);for(const value of [sale.fbKey,sale.id,sale.numero].map(upper))add(out,'budgetSale',value);for(const value of [sale.fbKey,sale.ventaKey,sale.ventaFbKey,sale.id,sale.idOriginal,sale.numero,sale.ventaId].map(txt))add(out,'claimSale',value);return [...out].sort();}
function recordPath(path){classify(path);return ROOT+'/records/'+F.digest(path);}
function image(path,row){
 const kind=classify(path);if(row===null)return null;if(!plain(row))throw fail('Original de relación inválido.');
 const normalized=P.normalizeRecord(row);if(!normalized)throw fail('Original vacío de relación inválido.');const tokens=new Set();
 if(['pagos','ordenes_trabajo','agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo'].includes(kind.domain))refs(tokens,normalized);
 if(kind.domain==='presupuestos'){
  for(const value of [kind.key,normalized.id,normalized.numero,normalized.nro].map(upper))add(tokens,'budgetIdentity',value);
  for(const value of [normalized.ventaFbKey,normalized.ventaGeneradaFbKey,normalized.ventaId,normalized.ventaGeneradaId].map(upper))add(tokens,'budgetSale',value);
 }
 if(kind.domain==='reclamos'){
  for(const value of [kind.key,normalized.id,normalized.numero].map(txt))add(tokens,'claimIdentity',value);
  for(const value of [normalized.ventaKey,normalized.ventaFbKey,normalized.ventaId].map(txt))add(tokens,'claimSale',value);
 }
 if(['reclamos','agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo'].includes(kind.domain))for(const value of [normalized.otKey,normalized.otId,normalized.otNumero,normalized.ordenTrabajoId,normalized.ordenTrabajoFbKey].map(txt))add(tokens,'otReference',value);
 const aliases=kind.domain==='ventas'?saleTokens({...normalized,fbKey:kind.key}):[];
 return {schema:2,path,domain:kind.domain,key:kind.key,sourceHash:F.sourceDigest(normalized),...(tokens.size?{tokens:[...tokens].sort()}:{}),...(aliases.length?{aliases}:{})};
}
function validateImage(v){
 if(!plain(v)||v.schema!==2||typeof v.path!=='string'||!hex(v.sourceHash))throw fail('Metadatos de relación inválidos.');const k=classify(v.path);
 if(v.domain!==k.domain||v.key!==k.key||Object.keys(v).sort().join(',')!==['schema','path','domain','key','sourceHash',...(Object.hasOwn(v,'tokens')?['tokens']:[]),...(Object.hasOwn(v,'aliases')?['aliases']:[])].sort().join(',')||k.domain!=='ventas'&&Object.hasOwn(v,'aliases'))throw fail('Coordenadas de relación inválidas.');
 for(const list of [v.tokens,v.aliases].filter(value=>value!==undefined))if(!Array.isArray(list)||list.length===0||list.some(t=>typeof t!=='string'||t.split('/').length!==2||!families.has(t.split('/')[0])||!hex(t.split('/')[1]))||F.digest([...new Set(list)].sort())!==F.digest(list))throw fail('Referencias de relación inválidas.');
 return v;
}
function validateRecord(path,row,stored){const expected=image(path,row);if(expected===null){if(stored!==null)throw fail('El índice conserva un original inexistente.');return null;}validateImage(stored);if(F.digest(expected)!==F.digest(stored))throw fail('El original y sus referencias cambiaron.');return expected;}
function bucketPathsForSale(sale){
 if(!plain(sale)||typeof sale.fbKey!=='string')throw fail('Venta original sin clave.');key(sale.fbKey);const tokens=new Set(saleTokens(sale));
 for(const value of [sale.presupuestoFbKey,sale.pptoFbKey,sale.presupuestoId,sale.pptoOrigen,sale.presupuestoOrigen,sale.pptoId].map(upper))add(tokens,'budgetIdentity',value);
 for(const value of [sale.reclamoKey,sale.reclamoFbKey,sale.reclamoFBKey,sale.reclamoId].map(txt))add(tokens,'claimIdentity',value);
 return [...tokens].sort().map(token=>ROOT+'/refs/'+token);
}
function bucketPathsForOTs(records){if(!plain(records))throw fail('OT candidatas inválidas.');const tokens=new Set();for(const [id,ot]of Object.entries(records)){key(id);if(!plain(ot))throw fail('OT candidata inválida.');for(const value of [id,ot.id,ot.otId,ot.numero].map(txt))add(tokens,'otReference',value);}return [...tokens].sort().map(t=>ROOT+'/refs/'+t);}
function saleOwnerBucketPaths(record){validateImage(record);return (record.tokens||[]).filter(t=>['technical','businessExact','businessDigits','budgetSale','claimSale'].includes(t.split('/')[0])).map(t=>ROOT+'/saleAliases/'+t);}
function validateCoverage(v){if(!plain(v)||Object.keys(v).sort().join(',')!=='generation,ready,records,revision,schema,sourceAccumulator'||v.schema!==2||v.ready!==true||typeof v.generation!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(v.generation)||!Number.isSafeInteger(v.revision)||v.revision<1||!Number.isSafeInteger(v.records)||v.records<0||!hex(v.sourceAccumulator))throw fail('El circuito de vínculos no está preparado.');return structuredClone(v);}
function validateConfig(config,coverage){validateCoverage(coverage);if(!plain(config)||Object.keys(config).sort().join(',')!=='generation,ready,schema,writerSchema'||config.schema!==2||config.writerSchema!==1||config.ready!==true||config.generation!==coverage.generation)throw fail('La generación de vínculos no está habilitada.');return structuredClone(config);}
function financialPath(path){if(path!==F.ROOT&&!path.startsWith(F.ROOT+'/'))throw fail('Ruta financiera ajena.');return FINANCIAL_ROOT+path.slice(F.ROOT.length);}
async function prepare(sources,{generation}={}){
 if(!plain(sources)||Object.keys(sources).length!==roots.length||roots.some(root=>!Object.hasOwn(sources,root)))throw fail('Se requieren todas las fuentes completas del circuito.');
 const changes=[];for(const root of roots){const rows=sources[root];if(rows!==null&&!plain(rows))throw fail('Fuente completa inválida.');for(const [id,row]of Object.entries(rows||{})){key(id);if(root==='sisventas/ctaemp'){if(!plain(row))throw fail('Cuenta de empleado inválida.');for(const [mov,original]of Object.entries(row)){key(mov);changes.push({path:root+'/'+id+'/'+mov,before:null,after:original});}}else changes.push({path:root+'/'+id,before:null,after:row});}}
 const coverage={schema:2,ready:true,generation,revision:1,records:0,sourceAccumulator:'0'.repeat(64)};validateCoverage(coverage);
 const financial=await F.prepare(Object.fromEntries([...financialRoots].map(root=>[root.split('/').at(-1),null])),{generation});
 const initial={};for(const[path,value]of Object.entries(financial.patch))initial[financialPath(path)]=value;
 const read=async path=>path===ROOT+'/coverage'?coverage:Object.hasOwn(initial,path)?structuredClone(initial[path]):null;
 const patch={...initial,...await require('./sale-delete-target-index-delta').delta({changes,read})};
 patch[CONFIG]={schema:2,writerSchema:1,generation,ready:true};return {patch,coverage:patch[ROOT+'/coverage']};
}
async function prepareWithImages(sources,{generation,images}={}){
 const streamed=['sisventas/ordenes_trabajo','sisventas/reclamos'],retained=roots.filter(root=>!streamed.includes(root));
 if(!plain(sources)||Object.keys(sources).length!==retained.length||retained.some(root=>!Object.hasOwn(sources,root))||!Array.isArray(images))throw fail('Se requieren las fuentes retenidas y las imágenes verificadas.');
 // These roots are explicitly supplied as complete images, never inferred empty.
 const prepared=await prepare({...sources,...Object.fromEntries(streamed.map(root=>[root,null]))},{generation}),seen=new Set(),coverage=validateCoverage(prepared.coverage),modulus=1n<<256n;
 for(const entry of images){
  validateImage(entry);if(!streamed.includes(classify(entry.path).root)||seen.has(entry.path))throw fail('Imagen de preparación repetida o ajena.');seen.add(entry.path);
  prepared.patch[recordPath(entry.path)]=structuredClone(entry);
  for(const token of entry.tokens||[])prepared.patch[ROOT+'/refs/'+token+'/'+F.digest(entry.path)]=true;
  coverage.records++;coverage.sourceAccumulator=((BigInt('0x'+coverage.sourceAccumulator)+BigInt('0x'+F.digest(entry)))%modulus).toString(16).padStart(64,'0');
 }
 validateCoverage(coverage);prepared.patch[ROOT+'/coverage']=coverage;return {patch:prepared.patch,coverage};
}
module.exports={ROOT,CONFIG,FINANCIAL_ROOT,domains,roots,financialRoots,fail,plain,classify,originalPath,recordPath,image,validateImage,validateRecord,bucketPathsForSale,bucketPathsForOTs,saleOwnerBucketPaths,validateCoverage,validateConfig,financialPath,prepare,prepareWithImages};
