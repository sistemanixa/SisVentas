'use strict';
// El coordinador conserva el fence desde la primera lectura hasta el único
// PATCH de negocio e índices. No usar este adaptador con un lock sólo local.
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const DefaultIndices=require('./labor-index');
const {identity:expenseIdentity}=require('./personal-expenses');
const {esComision,claveGrupo}=require('./commission-calculations');
const {_claveOperacionConcurrente:operationKey,_hsexAgruparPendientes:groupRequests}=require('./labor-calculations');
const UNCHANGED=Symbol('labor-scoped-transaction.UNCHANGED');
const control=Object.freeze({UNCHANGED});
const KINDS=Object.freeze(['solicitar-horas','aprobar-horas','solicitar-gasto','redistribuir-comisiones']);
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const dictionary=()=>Object.create(null);
const own=(object,key)=>Object.hasOwn(object||{},key);
function clone(value){
 if(Array.isArray(value))return value.map(clone);
 if(value&&typeof value==='object'){
  const copy=Object.create(Object.getPrototypeOf(value)===null?null:Object.prototype);
  for(const [k,v]of Object.entries(value))Object.defineProperty(copy,k,{value:clone(v),writable:true,enumerable:true,configurable:true});
  return copy;
 }
 return value;
}
function key(value){
 if(typeof value!=='string'||!value||Buffer.byteLength(value)>768||/[.#$\[\]\/\x00-\x1f\x7f]/.test(value))throw fail(400,'Referencia laboral inválida');
 return value;
}
function validRecord(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
async function settled(work){
 const results=await Promise.allSettled(work.map(fn=>Promise.resolve().then(fn)));
 const rejected=results.find(r=>r.status==='rejected');if(rejected)throw rejected.reason;
 return results.map(r=>r.value);
}
async function pool(items,work){
 const results=new Array(items.length);let next=0,error;
 await Promise.all(Array.from({length:Math.min(6,items.length)},async()=>{
  while(!error){const i=next++;if(i>=items.length)return;try{results[i]=await work(items[i],i);}catch(e){error=e;}}
 }));
 if(error)throw error;return results;
}

async function loadLaborSnapshot(scope,ctx,indices=DefaultIndices){
 if(!scope||typeof scope.get!=='function'||!ctx||!KINDS.includes(ctx.kind)||!validRecord(ctx.identity)||typeof ctx.identity.uid!=='string'||!ctx.identity.uid||!validRecord(ctx.body))throw fail(400,'Comando laboral inválido');
 const cache=new Map(),read=path=>{
  if(!cache.has(path))cache.set(path,Promise.resolve().then(()=>scope.get(path)).then(value=>value==null?null:clone(value)));
  return cache.get(path);
 };
 const config=await read('sv_labor_config');
 if(config?.ready!==true||config.schema!==indices.VERSION)throw fail(503,'El circuito laboral todavía no está preparado');
 const root={empleados:dictionary(),config:{cargos:dictionary()},hsextra_solicitudes:dictionary(),gastos:dictionary(),ctaemp:dictionary()};
 const allowed={gastos:new Set(),hsextra_solicitudes:new Set(),ctaemp:new Set()};
 async function record(domain,id,store=true){
  key(id);const value=await read('sisventas/'+domain+'/'+id);
  if(value!==null&&!validRecord(value))throw fail(409,'Un registro laboral requiere revisión');
  if(store&&value!==null)root[domain][id]=value;
  return value;
 }
 async function bucket(domain,index,value){
  const path=indices.bucketPath(domain,index,value),members=await read(path);
  if(members===null)return [];
  if(typeof members!=='object')throw fail(409,'No se pudo verificar el índice laboral');
  const ids=Object.keys(members);
  for(const id of ids)if(members[id]!==true)throw fail(409,'No se pudo verificar el índice laboral');else key(id);
  const values=await pool(ids,async id=>{
   const value=await record(domain,id,false);
   if(value===null||indices.indexEntries(domain,id,value)[path+'/'+id]!==true)throw fail(409,'El índice laboral cambió o requiere revisión');
   return value;
  });
  ids.forEach((id,i)=>{root[domain][id]=values[i];});
  return ids;
 }
 async function employee(id){return record('empleados',key(id));}
 function permit(domain,id){allowed[domain].add(id);}
 const body=ctx.body;
 if(ctx.kind==='solicitar-horas'){
  const emp=await employee(body.empFbKey);
  if(emp&&emp.activo!==false){
   const previous=await bucket('hsextra_solicitudes','aporteId',body.aporteId);
   if(!previous.length){
    await bucket('hsextra_solicitudes','employeeMonth',[body.empFbKey,body.mes]);
    let target=Object.keys(root.hsextra_solicitudes).find(id=>{
     const r=root.hsextra_solicitudes[id];return r.estado==='pendiente'&&r.empFbKey===body.empFbKey&&String(r.mes||r.fecha).slice(0,7)===body.mes;
    });
    if(!target){
     const base='pend_'+body.empFbKey.replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+body.mes.replace('-','');
     target=base;let suffix=2;
     // La asignación conserva claves ocupadas de otro empleado cuyo nombre
     // normalizado coincide; no basta consultar sólo el índice empleado/mes.
     while(await record('hsextra_solicitudes',target))target=base+'_'+suffix++;
    }
    permit('hsextra_solicitudes',target);
   }
  }
 }else if(ctx.kind==='aprobar-horas'){
  const ids=[...body.claves].sort();for(const id of ids)key(id);
  await pool(ids,id=>record('hsextra_solicitudes',id));
  let target=operationKey('hextra',ids);
  if(body.individual===true){
   const matches=await bucket('gastos','legacyKey','hsextra_solicitudes/'+ids[0]);
   if(matches.length)target=Object.keys(root.gastos).find(id=>root.gastos[id].legacyKey==='hsextra_solicitudes/'+ids[0]);
  }
  await record('gastos',target);permit('gastos',target);for(const id of ids)permit('hsextra_solicitudes',id);
  const requests=ids.map(id=>({...root.hsextra_solicitudes[id],fbKey:id}));
  const already=requests.every(r=>r.estado==='aprobado'&&r.gastoFbKey===target)&&root.gastos[target];
  if(!already&&requests.every(r=>r.estado==='pendiente')){
   const groups=groupRequests(requests);
   if(groups.length===1){
    const emp=await employee(groups[0].empFbKey);
    if(emp&&emp.activo!==false){
     const cargoId=String(emp.cargoId);
     if(cargoId&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(cargoId)&&Buffer.byteLength(cargoId)<=768){
      const cargo=await read('sisventas/config/cargos/'+cargoId);
      if(cargo!==null)root.config.cargos[cargoId]=cargo;
     }
    }
   }
  }
 }else if(ctx.kind==='solicitar-gasto'){
  const emp=await employee(ctx.identity.empleadoFbKey);
  if(emp&&emp.activo!==false){
   const signature=expenseIdentity(body),target='gasto_'+crypto.createHash('sha256').update(signature).digest('hex');
   const previous=await bucket('gastos','identity',signature);
   if(!previous.length){
    const existing=await record('gastos',target);
    if(existing&&expenseIdentity(existing)!==signature)throw fail(409,'La referencia del gasto ya está ocupada. Requiere revisión');
    permit('gastos',target);
   }
  }
 }else{
  await bucket('gastos','commissionGroup',body.grupo.clave);
  const movements=[];
  for(const [id,g]of Object.entries(root.gastos)){
   if(!esComision(g)||claveGrupo({...g,fbKey:id})!==body.grupo.clave)throw fail(409,'El grupo de comisión requiere revisión');
   permit('gastos',id);
   const match=String(g.legacyKey||'').match(/^ctaemp\/([^/]+)\/([^/]+)$/);
   if(match)movements.push([key(match[1]),key(match[2])]);
  }
  await settled([
   async()=>{root.config.maxComisionPct=await read('sisventas/config/maxComisionPct');},
   ()=>pool(movements,async([emp,id])=>{
    const value=await read('sisventas/ctaemp/'+emp+'/'+id);
    if(value!==null&&!validRecord(value))throw fail(409,'Un movimiento laboral requiere revisión');
    if(value!==null){root.ctaemp[emp]||=dictionary();root.ctaemp[emp][id]=value;}
    permit('ctaemp',emp+'/'+id);
   })
  ]);
 }
 return {root,allowed};
}

function diffRecords(before,after,allowed){
 if(!validRecord(after))throw fail(409,'Resultado laboral inválido');
 for(const branch of new Set([...Object.keys(before),...Object.keys(after)])){
  if(!['gastos','hsextra_solicitudes','ctaemp'].includes(branch)&&!isDeepStrictEqual(before[branch],after[branch]))throw fail(409,'La operación excede su alcance laboral');
 }
 const patch=dictionary();
 for(const domain of ['gastos','hsextra_solicitudes']){
  if(!validRecord(after[domain]))throw fail(409,'Resultado laboral inválido');
  for(const id of new Set([...Object.keys(before[domain]),...Object.keys(after[domain])])){
   const previous=before[domain][id],next=after[domain][id];
   if(isDeepStrictEqual(previous,next))continue;
   if(!allowed[domain].has(id)||!validRecord(next))throw fail(409,'La operación excede su alcance laboral');
   patch['sisventas/'+domain+'/'+id]=next;
  }
 }
 if(!validRecord(after.ctaemp))throw fail(409,'Resultado laboral inválido');
 for(const emp of new Set([...Object.keys(before.ctaemp),...Object.keys(after.ctaemp)])){
  if(own(after.ctaemp,emp)&&!validRecord(after.ctaemp[emp]))throw fail(409,'Resultado laboral inválido');
  const previous=before.ctaemp[emp]||{},next=after.ctaemp[emp]||{};
  for(const id of new Set([...Object.keys(previous),...Object.keys(next)])){
   if(isDeepStrictEqual(previous[id],next[id]))continue;
   if(!allowed.ctaemp.has(emp+'/'+id)||!validRecord(next[id]))throw fail(409,'La operación excede su alcance laboral');
   patch['sisventas/ctaemp/'+emp+'/'+id]=next[id];
  }
 }
 return patch;
}
function createScopedTransaction({guard,indices=DefaultIndices}={}){
 if(!guard||typeof guard.run!=='function')throw TypeError('Falta el coordinador laboral');
 return async function transaction(update,ctx){
  if(typeof update!=='function'||!ctx||!KINDS.includes(ctx.kind)||typeof ctx.identity?.uid!=='string'||!ctx.identity.uid)throw fail(400,'Comando laboral inválido');
  return guard.run({uid:ctx.identity.uid,claims:ctx.identity.claims,role:ctx.identity.role,permissionRevision:ctx.identity.permissionRevision,permissionDigest:ctx.identity.permissionDigest,mode:'command',operation:ctx.kind,input:clone(ctx.body)},async scope=>{
   const loaded=await loadLaborSnapshot(scope,ctx,indices),root=clone(loaded.root),allowed=loaded.allowed,before=clone(root),next=update(root,control);
   if(next===UNCHANGED)return {committed:true,unchanged:true};
   if(next===undefined||next===null)return {committed:false};
   const patch=diffRecords(before,next,allowed);
   if(Object.keys(patch).length)await scope.update(patch);
   return {committed:true};
  });
 };
}
module.exports={createScopedTransaction,loadLaborSnapshot,KINDS};
