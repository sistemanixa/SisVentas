'use strict';
const crypto=require('node:crypto'),{AsyncLocalStorage}=require('node:async_hooks');
const Index=require('./labor-index');
const PaymentIndex=require('./payment-membership-index');
const {validateExpenseRemovals}=require('./expense-removal-guard');
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
function validateFinancialContext(actor,profile,permissions){
 if(profile?.activo!==true)throw failure(403,'Usuario sin acceso');
 if(profile.rol!==actor.role)throw failure(409,'La sesión cambió. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
 const actions={'cobranzas.registrar':['cobranzas','cobranzas','registrar',['admin','administrativo']],'cobranzas.anular':['cobranzas','cobranzas','anular',['admin']],'gastos.administrar':['gastos','gastos','administrar',['admin','administrativo']],'gastos.eliminar':['gastos','gastos','eliminar',['admin']],'mantenimiento.normalizar':['configuracion','mantenimiento','normalizar',['admin']]},action=actions[actor.financialAction];
 if(!action||actor.financialAction==='gastos.eliminar'&&profile.rol!=='admin')throw failure(403,'Acción financiera no autorizada');
 const [module,group,name,defaults]=action,cfg=permissions||{},override=cfg.acciones?.[group]?.[name];
 if(Object.values(cfg.bloqueados||{}).includes(module)||permissions&&(cfg.indiceVersion!==2||cfg.indiceModulos?.[module]!==true)||(typeof override==='boolean'?!override:!defaults.includes(profile.rol)))throw failure(403,'El permiso de la operación ya no está habilitado');
 if((cfg.indiceRevision??null)!==(actor.permissionRevision??null)||digest(cfg)!==actor.permissionDigest)throw failure(409,'Los permisos cambiaron. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
}
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
  const staged=new Map(),reads=new Map(),authReads=new Map(),readTree={children:new Map(),path:null};let completed=false,phase='working';
  const authenticatedActor=actor.mode==='user'&&actor.claims?.uid===actor.uid?{uid:actor.uid,claims:copy(actor.claims)}:null;
  function live(){if(phase==='closed')throw failure(409,'Este guardado ya terminó.','SV_LABOR_SCOPE_CLOSED');if(now()>=lease.expiresAt)throw failure(409,'El plazo del guardado terminó. Revisá el estado antes de reintentar.','SV_LABOR_LEASE_EXPIRED');}
  function working(){live();if(phase!=='working')throw failure(409,'El guardado ya se está confirmando.','SV_LABOR_SCOPE_CLOSED');}
  function rememberRead(path,promise){reads.set(path,promise);let node=readTree;for(const part of parts(path)){if(!node.children.has(part))node.children.set(part,{children:new Map(),path:null});node=node.children.get(part);}node.path=path;}
  function overlappingReadPaths(path){
   const matches=[];let node=readTree;
   for(const part of parts(path)){node=node.children.get(part);if(!node)return matches;if(node.path)matches.push(node.path);}
   const pending=[...node.children.values()];while(pending.length){const next=pending.pop();if(next.path)matches.push(next.path);for(const child of next.children.values())pending.push(child);}
   return matches;
  }
  async function raw(path){parts(path);live();if(!reads.has(path))rememberRead(path,Promise.resolve().then(()=>store.read(path)));const value=await reads.get(path);live();return copy(value);}
  function overlay(path,value){for(const [p,v]of staged){if(p===path)value=copy(v);else if(path.startsWith(p+'/'))value=child(v,parts(path.slice(p.length+1)));else if(p.startsWith(path+'/'))value=put(value,parts(p.slice(path.length+1)),v);}return copy(value);}
  async function get(path){return overlay(path,await raw(path));}
  async function getAsUser(path){
   parts(path);working();
   if(!authenticatedActor||typeof store.readAsUser!=='function')throw failure(403,'Esta lectura requiere la sesión verificada del usuario');
   if(!authReads.has(path))authReads.set(path,Promise.resolve().then(async()=>{
    const value=copy(await store.readAsUser(path,authenticatedActor));working();
    // A service snapshot is not authorization. Compare any overlapping earlier
    // snapshot only AFTER the real user read has succeeded, then reuse its data.
    for(const cached of overlappingReadPaths(path)){
     const promise=reads.get(cached);
     if(cached===path||path.startsWith(cached+'/')){const before=await promise;working();if(canonical(cached===path?before:child(before,parts(path.slice(cached.length+1))))!==canonical(value))throw failure(409,'El registro cambió durante la verificación de acceso','SV_CAS_CONFLICT');}
     else if(cached.startsWith(path+'/')){const before=await promise;working();if(canonical(before)!==canonical(child(value,parts(cached.slice(path.length+1)))))throw failure(409,'El registro cambió durante la verificación de acceso','SV_CAS_CONFLICT');}
    }
    if(!reads.has(path))rememberRead(path,Promise.resolve(copy(value)));return value;
   }));
   const value=await authReads.get(path);working();return overlay(path,copy(value));
  }
  async function update(patch){
   working();if(!patch||typeof patch!=='object'||Array.isArray(patch))throw failure(400,'Cambios inválidos');
   const entries=Object.entries(patch);if(entries.length>20000)throw failure(400,'Demasiados cambios en una operación');
   PaymentIndex.paymentKeysForPatch(Object.fromEntries(entries.filter(([path])=>path==='sisventas'||path==='sisventas/pagos'||path.startsWith('sisventas/pagos/'))));
   for(const [path,value]of entries){jsonValue(value,parts(path).length);const branch=path.split('/')[0];if(['sv_labor_guard','sv_labor_receipts','sv_labor_indexes','sv_labor_config'].includes(branch)&&!(actor.mode==='bootstrap'&&['sv_labor_indexes','sv_labor_config'].includes(branch)))throw failure(400,'La coordinación no se modifica desde los datos');}
   for(const [path,value]of entries){let merged=false;for(const [parent,old]of staged){if(path===parent||parent.startsWith(path+'/'))staged.delete(parent);else if(path.startsWith(parent+'/')){staged.set(parent,put(old,parts(path.slice(parent.length+1)),value));merged=true;break;}}if(!merged)staged.set(path,copy(value));}
  }
  const scope={assertActive:working,get:async path=>{working();const value=await get(path);working();return value;},getAsUser,update,lease:Object.freeze({...lease}),actor:Object.freeze({...actor}),query:async(path,field,value)=>{
   parts(path);parts(field);working();const rows=await store.query(path,field,value),candidate=Object.assign(Object.create(null),copy(rows)||{});
   for(const [p,v]of staged){if(p===path){for(const k of Object.keys(candidate))delete candidate[k];Object.assign(candidate,copy(v)||{});}else if(p.startsWith(path+'/')){const relative=parts(p.slice(path.length+1)),id=relative.shift();const before=Object.hasOwn(candidate,id)?candidate[id]:await raw(path+'/'+id);const next=put(before,relative,v);if(next==null)delete candidate[id];else candidate[id]=next;}}
   working();return Object.fromEntries(Object.entries(candidate).filter(([,r])=>canonical(child(r,parts(field)))===canonical(value)));
  }};
  try{
   return await context.run(scope,async()=>{
    if(actor.mode==='command'||actor.mode==='user'&&actor.financialAction){
     if(!actor.role||!/^[a-f0-9]{64}$/.test(actor.permissionDigest||''))throw failure(403,'Falta verificar el permiso de esta operación');
     const permissions=await raw('sv_permisos/'+actor.role);
     if(digest(permissions||{})!==actor.permissionDigest)throw failure(409,'Los permisos cambiaron. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
     if(actor.mode==='user'){
      const profile=await raw('sv_chat_roles/'+actor.uid);
      if(profile?.activo!==true||profile.rol!==actor.role)throw failure(409,'La sesión cambió. Volvé a revisar la operación.','SV_LABOR_AUTH_CHANGED');
     }
    }
    const result=await work(scope);live();phase='committing';
    const ready=await get('sv_labor_config');if(actor.mode!=='bootstrap'&&(ready?.ready!==true||ready.schema!==Index.VERSION))throw failure(503,'El circuito de guardado todavía no está habilitado');
    const records=new Set();
    for(const path of staged.keys())for(const domain of ['gastos','hsextra_solicitudes']){
     const root='sisventas/'+domain;if(path===root||root.startsWith(path+'/')){const [before,after]=await Promise.all([raw(root),get(root)]);for(const key of new Set([...Object.keys(before||{}),...Object.keys(after||{})]))records.add(domain+'/'+key);}
     else if(path.startsWith(root+'/'))records.add(domain+'/'+parts(path.slice(root.length+1))[0]);
    }
    const changes=[];for(const record of records){const slash=record.indexOf('/'),domain=record.slice(0,slash),key=record.slice(slash+1),path='sisventas/'+record;changes.push({domain,key,before:await raw(path),after:await get(path)});}
    const patch=Object.fromEntries(staged);await validateExpenseRemovals({actor,raw,changes,patch});await require('./labor-commission-limit').validateCommissionLimit({raw,get,changes,patch});Object.assign(patch,Index.planIndexDelta(changes));
    const paymentKeys=PaymentIndex.paymentKeysForPatch(Object.fromEntries([...staged].filter(([path])=>path.startsWith('sisventas/pagos/'))));
    if(paymentKeys.length){
     const coverage=await get(PaymentIndex.COVERAGE_PATH);
     // Absence deliberately preserves the unoptimized published circuit. An
     // existing invalid/not-ready generation never masquerades as an empty index.
     if(coverage!==null){
      PaymentIndex.validateCoverage(coverage);
      const paymentChanges=[];
      for(const key of paymentKeys){const path='sisventas/pagos/'+key;paymentChanges.push({key,before:await raw(path),after:await get(path),reverseBefore:await raw(PaymentIndex.reversePath(key))});}
      if(actor.mode==='user'&&String(actor.operation||'').startsWith('legacy-')){
       const summaryTouched=[...staged].some(([path])=>{const p=parts(path);return p[0]==='sisventas'&&p[1]==='ventas'&&(p.length<=3||['totalPagado','estadoPago'].includes(p[3]));});
       const economicFields=['monto','importe','montoOriginal','montoUSD','tipoCambio','moneda','anulado','estado'],relationFields=[...PaymentIndex.TECHNICAL_FIELDS,...PaymentIndex.BUSINESS_FIELDS];
       for(const change of paymentChanges){
        const before=PaymentIndex.normalizeRecord(change.before),after=PaymentIndex.normalizeRecord(change.after);if(after===null)continue;
        const changed=fields=>fields.some(field=>canonical(before?.[field]??null)!==canonical(after[field]??null));
        if(before===null||changed(economicFields)||summaryTouched&&changed(relationFields))throw failure(409,'Actualizá la aplicación para registrar o anular cobros con el circuito protegido','SV_PAYMENT_WRITER_VERSION');
        if(changed(relationFields)){
         const body=actor.input||{},path='sisventas/pagos/'+change.key,expected=body.kind==='atomic'?body.expectedHashes?.[path]:body.kind==='compare'&&body.path===path?body.expectedHash:null;
         const role=await raw('sv_chat_roles/'+actor.uid),permissions=await raw('sv_permisos/admin');
         if(body.purpose!=='relationship-normalization'||role?.activo!==true||role.rol!=='admin'||permissions?.acciones?.mantenimiento?.normalizar===false||!/^[a-f0-9]{64}$/.test(expected||'')||digest(change.before)!==expected)throw failure(409,'La normalización de referencias de pagos requiere un mantenimiento de administrador con comparación del registro completo','SV_PAYMENT_RELATION_MAINTENANCE_REQUIRED');
        }
       }
      }
      Object.assign(patch,PaymentIndex.planIndexDelta(paymentChanges,{coverage}).patch);
     }
    }
    // Incluso UNCHANGED confirma el fence, el recibo y la liberación en un PATCH.
    // Los comandos vuelven a validar su estado al repetirlos y no recuperan
    // payloads desde el recibo. No duplicar una venta/factura comercial completa.
    const receiptResult=['user','bootstrap'].includes(actor.mode)?copy(result):{ok:true,committed:true};
    patch['sv_labor_receipts/'+opId]={fence:lease.fence,digest:requestDigest,actorUid:actor.uid,result:receiptResult,confirmedAt:now()};patch.sv_labor_guard=null;
    if(actor.mode==='user'&&actor.financialAction){
     const checked=await Promise.allSettled([store.read('sv_chat_roles/'+actor.uid),store.read('sv_permisos/'+actor.role)]),failed=checked.find(value=>value.status==='rejected');live();
     if(failed)throw failed.reason;validateFinancialContext(actor,checked[0].value,checked[1].value);
    }
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
