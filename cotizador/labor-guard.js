'use strict';
const crypto=require('node:crypto'),{AsyncLocalStorage}=require('node:async_hooks');
const Index=require('./labor-index');
const failure=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const copy=v=>v==null?null:structuredClone(v);
function canonical(v){if(v==null)return 'null';if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(typeof v==='object')return '{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
const digest=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
function parts(path){if(typeof path!=='string'||!path||path.length>2048)throw failure(400,'Ruta inválida');const out=path.split('/');if(out.some(p=>!p||Buffer.byteLength(p)>768||/[.#$\[\]\x00-\x1f\x7f]/.test(p)))throw failure(400,'Ruta inválida');return out;}
function child(value,path){let node=value;for(const p of path){if(!node||typeof node!=='object'||!Object.hasOwn(node,p))return null;node=node[p];}return copy(node);}
function put(value,path,next){if(!path.length)return copy(next);let root=value&&typeof value==='object'?copy(value):{},node=root;const assign=(target,key,value)=>Object.defineProperty(target,key,{value,writable:true,enumerable:true,configurable:true});for(const p of path.slice(0,-1)){if(!Object.hasOwn(node,p)||!node[p]||typeof node[p]!=='object')assign(node,p,{});node=node[p];}if(next==null)delete node[path.at(-1)];else assign(node,path.at(-1),copy(next));return root;}
const domains=new Set(['empleados','gastos','gastos_adjuntos','ctaemp','hsextra_solicitudes','haberes','aguinaldos','comisiones_generacion','pagos_realizados','auditoria_pagos','gastos_periodicos_emp','ventas','pagos']);
const config=new Set(['cargos','maxComisionPct','comisiones','comisionesEmpleados']);
function jsonValue(value,depth){
 if(depth>32||value===undefined||typeof value==='number'&&!Number.isFinite(value)||!['object','string','number','boolean'].includes(typeof value))throw failure(400,'Valor de guardado inválido');
 if(value&&typeof value==='object'){
  if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw failure(400,'Valor de guardado inválido');
  for(const [key,next]of Object.entries(value)){parts(key);jsonValue(next,depth+1);}
 }
}
function affected(path){const p=parts(path);return ['sv_commission_generation','sv_commission_events'].includes(p[0])||p[0]==='sisventas'&&(p.length===1||domains.has(p[1])||p[1]==='config'&&(p.length===2||config.has(p[2])));}
function createLaborGuard({store,now=Date.now,uuid=crypto.randomUUID,leaseMs=30000,readOnly=false,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 if(!store||!Number.isFinite(leaseMs)||leaseMs<1000||leaseMs>60000)throw Error('Configuración de coordinación inválida');
 const context=new AsyncLocalStorage();let tail=Promise.resolve();
 async function execute(actor,work){
  if(!actor||typeof actor.uid!=='string'||!actor.uid||!['command','user','server','bootstrap'].includes(actor.mode))throw failure(403,'Operación no autorizada');
  if(readOnly&&!(actor.mode==='user'&&actor.operation==='resolve'))throw failure(503,'Los guardados están temporalmente en revisión. No se modificaron datos.','SV_LABOR_READ_ONLY');
  const opId=actor.opId||uuid();if(!/^[A-Za-z0-9_-]{8,160}$/.test(opId))throw failure(400,'Identificador de operación inválido');
  const requestDigest=actor.mode==='user'&&actor.transportDigest!==undefined?actor.transportDigest:digest({uid:actor.uid,mode:actor.mode,operation:actor.operation||'',input:actor.input??null});
  if(!/^[a-f0-9]{64}$/.test(requestDigest))throw failure(400,'Identificador de comprobación inválido');
  // Sólo el transporte de una escritura idéntica puede recuperar su recibo.
  // Los comandos financieros vuelven a ejecutar sus validaciones actuales.
  if(actor.mode==='user'&&actor.opId){const receipt=await store.read('sv_labor_receipts/'+opId);if(receipt){if(receipt.actorUid!==actor.uid||receipt.digest!==requestDigest)throw failure(409,'El identificador corresponde a otra operación');return copy(receipt.result);}}
  const lease={fence:uuid(),opId,digest:requestDigest,expiresAt:now()+leaseMs,actorUid:actor.uid,mode:actor.mode};
  for(let attempt=0;;attempt++){lease.expiresAt=now()+leaseMs;try{await store.acquire(lease);break;}catch(error){if(error.statusCode!==423||attempt>=4)throw error;await delay(100*2**attempt);}}
  const staged=new Map(),reads=new Map();let completed=false,phase='working';
  function live(){if(phase==='closed')throw failure(409,'Este guardado ya terminó.','SV_LABOR_SCOPE_CLOSED');if(now()>=lease.expiresAt)throw failure(409,'El plazo del guardado terminó. Revisá el estado antes de reintentar.','SV_LABOR_LEASE_EXPIRED');}
  function working(){live();if(phase!=='working')throw failure(409,'El guardado ya se está confirmando.','SV_LABOR_SCOPE_CLOSED');}
  async function raw(path){parts(path);live();if(!reads.has(path))reads.set(path,Promise.resolve().then(()=>store.read(path)));const value=await reads.get(path);live();return copy(value);}
  async function get(path){let value=await raw(path);for(const [p,v]of staged){if(p===path)value=copy(v);else if(path.startsWith(p+'/'))value=child(v,parts(path.slice(p.length+1)));else if(p.startsWith(path+'/'))value=put(value,parts(p.slice(path.length+1)),v);}return value;}
  async function update(patch){
   working();if(!patch||typeof patch!=='object'||Array.isArray(patch))throw failure(400,'Cambios inválidos');
   const entries=Object.entries(patch);if(entries.length>20000)throw failure(400,'Demasiados cambios en una operación');
   for(const [path,value]of entries){jsonValue(value,parts(path).length);const branch=path.split('/')[0];if(['sv_labor_guard','sv_labor_receipts','sv_labor_indexes','sv_labor_config'].includes(branch)&&!(actor.mode==='bootstrap'&&['sv_labor_indexes','sv_labor_config'].includes(branch)))throw failure(400,'La coordinación no se modifica desde los datos');}
   for(const [path,value]of entries){let merged=false;for(const [parent,old]of staged){if(path===parent||parent.startsWith(path+'/'))staged.delete(parent);else if(path.startsWith(parent+'/')){staged.set(parent,put(old,parts(path.slice(parent.length+1)),value));merged=true;break;}}if(!merged)staged.set(path,copy(value));}
  }
  const scope={assertActive:working,get:async path=>{working();const value=await get(path);working();return value;},update,lease:Object.freeze({...lease}),actor:Object.freeze({...actor}),query:async(path,field,value)=>{
   parts(path);parts(field);working();const rows=await store.query(path,field,value),candidate=Object.assign(Object.create(null),copy(rows)||{});
   for(const [p,v]of staged){if(p===path){for(const k of Object.keys(candidate))delete candidate[k];Object.assign(candidate,copy(v)||{});}else if(p.startsWith(path+'/')){const relative=parts(p.slice(path.length+1)),id=relative.shift();const before=Object.hasOwn(candidate,id)?candidate[id]:await raw(path+'/'+id);const next=put(before,relative,v);if(next==null)delete candidate[id];else candidate[id]=next;}}
   working();return Object.fromEntries(Object.entries(candidate).filter(([,r])=>canonical(child(r,parts(field)))===canonical(value)));
  }};
  try{
   return await context.run(scope,async()=>{
    if(actor.mode==='command'){
     if(!actor.role||!/^[a-f0-9]{64}$/.test(actor.permissionDigest||''))throw failure(403,'Falta verificar el permiso de esta operación');
     const permissions=await raw('sv_permisos/'+actor.role);
     if(digest(permissions||{})!==actor.permissionDigest)throw failure(409,'Los permisos cambiaron. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
    }
    const result=await work(scope);live();phase='committing';
    const ready=await get('sv_labor_config');if(actor.mode!=='bootstrap'&&(ready?.ready!==true||ready.schema!==Index.VERSION))throw failure(503,'El circuito de guardado todavía no está habilitado');
    const records=new Set();
    for(const path of staged.keys())for(const domain of ['gastos','hsextra_solicitudes']){
     const root='sisventas/'+domain;if(path===root||root.startsWith(path+'/')){const [before,after]=await Promise.all([raw(root),get(root)]);for(const key of new Set([...Object.keys(before||{}),...Object.keys(after||{})]))records.add(domain+'/'+key);}
     else if(path.startsWith(root+'/'))records.add(domain+'/'+parts(path.slice(root.length+1))[0]);
    }
    const changes=[];for(const record of records){const slash=record.indexOf('/'),domain=record.slice(0,slash),key=record.slice(slash+1),path='sisventas/'+record;changes.push({domain,key,before:await raw(path),after:await get(path)});}
    const patch=Object.fromEntries(staged);await require('./labor-commission-limit').validateCommissionLimit({raw,get,changes,patch});Object.assign(patch,Index.planIndexDelta(changes));
    // Incluso UNCHANGED confirma el fence, el recibo y la liberación en un PATCH.
    // Los comandos vuelven a validar su estado al repetirlos y no recuperan
    // payloads desde el recibo. No duplicar una venta/factura comercial completa.
    const receiptResult=['user','bootstrap'].includes(actor.mode)?copy(result):{ok:true,committed:true};
    patch['sv_labor_receipts/'+opId]={fence:lease.fence,digest:requestDigest,actorUid:actor.uid,result:receiptResult,confirmedAt:now()};patch.sv_labor_guard=null;
    live();await store.commit(patch,lease,actor);completed=true;return result;
   });
  }finally{phase='closed';if(!completed)await store.abort(lease).catch(()=>{});}
 }
 async function run(actor,work){
  const active=context.getStore();if(active){active.assertActive();if(actor.uid!==active.actor.uid&&actor.mode==='user')throw failure(403,'La sesión cambió');return work(active);}
  const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;
  try{return await execute(actor,work);}finally{release();}
 }
 return {run,current:()=>{const active=context.getStore();active?.assertActive();return active;}};
}
module.exports={createLaborGuard,canonical,digest,affected,parts,child,put,domains,config};
