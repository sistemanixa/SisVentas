'use strict';
// Read-only enumeration and raw-page evidence. This module issues no authority.
const {digest}=require('./labor-guard'),{compareKey}=require('./office-stock-order');
const ROOTS=[['orders','sisventas/ordenes'],['legacyOrders','sisventas/ordenes_compra']],LIMIT=129,BATCH=128;
const fail=message=>Object.assign(Error(message),{code:'SV_PURCHASE_CURRENT_PENDING_SCAN_REVIEW',statusCode:409,svLaborAttempted:false});
const need=(ok,message)=>{if(!ok)throw fail(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
function json(value,parents=new Set()){
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){need(Number.isFinite(value),'Una fuente contiene números no válidos.');return;}
 need(Array.isArray(value)||object(value),'Una fuente de Compras no es JSON verificable.');
 need(!parents.has(value),'Una fuente de Compras contiene referencias circulares.');parents.add(value);
 need(Reflect.ownKeys(value).every(k=>typeof k==='string'),'Una fuente de Compras contiene propiedades no persistidas.');
 if(Array.isArray(value))for(let i=0;i<value.length;i++)need(Object.hasOwn(value,i),'Una fuente de Compras contiene posiciones ausentes.');
 for(const name of Object.keys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,name);need(Object.hasOwn(descriptor,'value'),'Una fuente de Compras contiene propiedades calculadas.');json(descriptor.value,parents);}
 parents.delete(value);
}
async function scan(queryPage,options={}){
 need(typeof queryPage==='function','Falta el lector paginado de Compras.');
 need(object(options)&&Object.keys(options).every(name=>name==='maxPages'),'Opciones de recorrido no autorizadas.');
 const maxPages=options.maxPages===undefined?256:options.maxPages;
 need(Number.isSafeInteger(maxPages)&&maxPages>0,'El límite de páginas debe ser un entero positivo.');
 const sources={orders:{},legacyOrders:{}},pages=[];
 for(const [name,path]of ROOTS){
  const target=sources[name],observed=new Map();let cursor,nextExpected;
  while(true){
   need(pages.length<maxPages,'El recorrido de Compras excede su límite; no se acepta cobertura parcial.');
   const query=Object.freeze({orderBy:'$key',limitToFirst:LIMIT,...(cursor===undefined?{}:{startAt:cursor})});
   const raw=await queryPage(path,query);
   need(raw===null||object(raw),'El lector debe devolver un mapa de Compras o null, nunca una fuente ausente.');json(raw);
   const saved=structuredClone(raw),keys=saved===null?[]:Object.keys(saved).sort(compareKey);
   need(keys.length<=LIMIT,'El lector excedió el tamaño de la página autorizada.');
   for(const id of keys){
    need(key(id),'Una fuente de Compras tiene una clave no canónica.');need(object(saved[id]),'Una orden debe conservar su documento original completo.');
    const hash=digest(saved[id]);need(!observed.has(id)||observed.get(id)===hash,'Una fuente de Compras cambió entre sus páginas.');observed.set(id,hash);
   }
   const rawCount=keys.length;
   if(cursor!==undefined){need(keys[0]===cursor,'La continuación no conserva el cursor inclusivo o retrocedió.');keys.shift();}
   if(nextExpected!==undefined)need(keys[0]===nextExpected,'La continuación omitió un elemento ya observado.');
   for(const id of keys)need((cursor===undefined||compareKey(id,cursor)>0)&&!Object.hasOwn(target,id),'La página repite fuentes o no avanza en el orden RTDB.');
   pages.push({path,options:{...query},hash:digest(saved)});
   const selected=keys.slice(0,BATCH);for(const id of selected)target[id]=structuredClone(saved[id]);
   if(rawCount<LIMIT)break;
   need(selected.length>0,'La página completa no permite avanzar.');
   const next=selected.at(-1);need(cursor===undefined||compareKey(next,cursor)>0,'El recorrido de Compras entró en un ciclo.');
   cursor=next;nextExpected=keys[BATCH];
  }
 }
 return {sources,pages,eof:true};
}
module.exports={scan};
