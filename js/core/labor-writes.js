(function(root,factory){
 'use strict';
 const create=factory();
 if(typeof module==='object'&&module.exports)module.exports={create};
 if(root&&!root.SVLaborWrites)root.SVLaborWrites=create(root);
})(typeof window==='object'?window:null,function(){
 'use strict';
 const watched=['empleados','hsextra_solicitudes','gastos','ctaemp','haberes','aguinaldos','gastos_periodicos_emp','pagos_realizados','auditoria_pagos','comisiones_generacion','gastos_adjuntos','ventas','presupuestos','pagos','ordenes','listas_materiales','inventario_operativo'].map(key=>'sisventas/'+key).concat(['cargos','maxComisionPct','comisiones','comisionesEmpleados'].map(key=>'sisventas/config/'+key));
 const fail=(code,message)=>Object.assign(Error(message),{code});
 function canonical(value){
  if(value==null)return 'null';
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(typeof value==='object')return '{'+Object.keys(value).filter(key=>value[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
 }
 function pathOf(ref){
  let path=String(ref?.toString?ref.toString():ref??'');
  if(/^https?:\/\//.test(path))path=decodeURIComponent(new URL(path).pathname);
  path=path.replace(/^\/+|\/+$/g,'');
  if(path&&path.split('/').some(key=>!key||/[.#$\[\]\x00-\x1f\x7f]/.test(key)))throw fail('SV_LABOR_PATH','Ruta de escritura inválida.');
  return path;
 }
 const serviceOnly=path=>/^(?:sv_labor_|sv_commission_|sv_commercial_|sv_employee_account_views(?:$|_))/.test(path.split('/')[0]||'');
 const intersectsPath=path=>serviceOnly(path)||watched.some(base=>path===base||path.startsWith(base+'/')||!path||base.startsWith(path+'/'));
 const ancestor=path=>watched.some(base=>base.startsWith(path+'/'))||!path;
 const copy=value=>value==null?null:JSON.parse(JSON.stringify(value));
 function validateJSON(value,parents=new Set()){
  if(value===undefined||['function','symbol','bigint'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))throw fail('SV_LABOR_VALUE','Datos de escritura inválidos.');
  if(!value||typeof value!=='object')return;
  if(parents.has(value))throw fail('SV_LABOR_VALUE','Datos de escritura inválidos.');parents.add(value);
  for(const [key,child]of Object.entries(value)){
   if(key!=='.sv'&&/[.#$\[\]\/\x00-\x1f\x7f]/.test(key))throw fail('SV_LABOR_VALUE','Clave de escritura inválida.');
   validateJSON(child,parents);
  }
  parents.delete(value);
 }
 return function create(root){
  let installed=false,sdk,settings,wrappers;
  function capture(){
   const user=root.fbAuth?.currentUser,uid=root.currentUserUid,role=root.currentRole,epoch=root._svOperacionesSesionEpoch||0;
   const revision=root.PERMISOS_ROLES?.[role]?.indiceRevision,permissions=canonical(root.PERMISOS_ROLES?.[role]??null),dataEpoch=root._svDataEpoch||0,valid=root.svCapturarContextoOperacion?.();
   return function check(){
    if(root._impersonacionOriginal)throw fail('SV_LABOR_PREVIEW','Volvé a tu cuenta para guardar.');
    if(!uid||!user||user.uid!==uid||root.currentUserUid!==uid||root.fbAuth?.currentUser!==user||root.currentRole!==role||(root._svOperacionesSesionEpoch||0)!==epoch||root.PERMISOS_ROLES?.[role]?.indiceRevision!==revision||canonical(root.PERMISOS_ROLES?.[role]??null)!==permissions||(root._svDataEpoch||0)!==dataEpoch||valid&&!valid())throw fail('SV_LABOR_SESSION','La sesión cambió. Verificá el estado antes de reintentar.');
   };
  }
  async function held(task){
   return task();
  }
  async function network(task){
   let release;try{release=root.SVForegroundSession?.holdDatabase?.();return await task();}
   finally{try{release?.();}catch(_){/* La liberación visual no cambia un commit confirmado. */}}
  }
  function available(){root.SVLaborWriteRecovery?.assertAvailable();}
  async function read(ref,check){
   if(root.SVForegroundSession?.waitVisible)await root.SVForegroundSession.waitVisible();check();
   return network(()=>sdk.get(ref));
  }
  function prepareValue(value){validateJSON(value);return copy(value);}
  function requireScoped(path){
   if(serviceOnly(path))throw fail('SV_LABOR_SERVICE_ONLY','Esta información sólo puede actualizarla el servidor.');
   if(ancestor(path))throw fail('SV_LABOR_SCOPED_REQUIRED','Esta operación requiere un guardado por registros. No se guardaron cambios.');
  }
  function uuid(){
   if(typeof root.crypto?.randomUUID==='function')return root.crypto.randomUUID();
   if(typeof root.crypto?.getRandomValues!=='function')throw fail('SV_LABOR_CRYPTO','No se pudo identificar el guardado.');
   const bytes=root.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
   const h=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  async function hash(value){
   if(!root.crypto?.subtle)throw fail('SV_LABOR_CRYPTO','No se pudo verificar el guardado.');
   const digest=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));
   return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  async function send(command,check,endpoint){
   available();const recovery=root.SVLaborWriteRecovery;
   if(!recovery)return transmit(command,check,endpoint);
   const digest=await hash(command);check();return recovery.execute({uid:root.currentUserUid,id:command.id,digest},()=>transmit(command,check,endpoint),check);
  }
  async function transmit(command,check,endpoint){
   let requestStarted=false;try{
   check();const base=endpoint||(typeof settings.endpoint==='function'?settings.endpoint():settings.endpoint)||(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'')+'/laboral/escritura';
   if(!base||base==='/laboral/escritura')throw fail('SV_LABOR_ENDPOINT','No se pudo conectar con el guardado seguro.');
   const body=JSON.stringify(command);
   if(new TextEncoder().encode(body).byteLength>16*1024*1024)throw fail('SV_LABOR_SIZE','El guardado supera el tamaño permitido. No se enviaron cambios.');
   const headers=await (settings.headers||((base)=>root.SVServiceAuth.headers(base)))({'Content-Type':'application/json'});check();
   const {response,data}=await network(async()=>{requestStarted=true;const response=await root.fetch(base,{method:'POST',headers,body,cache:'no-store',...(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(90000)}:{})});return {response,data:await response.json().catch(()=>({}))};});check();
   if(!response.ok||data.ok!==true||data.committed!==true){
    const error=fail(data.code||'SV_LABOR_UNCONFIRMED',data.mensaje||data.message||'No se pudo confirmar el guardado. Verificá el estado antes de reintentar.');
    error.statusCode=response.status;error.httpStatus=response.status;error.operationId=command.id;throw error;
   }
   return data;
   }catch(error){if(error&&typeof error==='object')error.svLaborAttempted=requestStarted;throw error;}
  }
  function command(resource,fields){
   return held(async()=>{
    const check=capture();check();available();if(!['cuenta','gastos','empleados','movimientos','haberes','liquidacion','compras'].includes(resource)||!fields||typeof fields!=='object'||Array.isArray(fields)||Object.hasOwn(fields,'id'))throw fail('SV_LABOR_COMMAND','La operación requiere una acción válida.');
    const value=prepareValue(fields),endpoint=(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'')+'/laboral/'+resource+'/comando';
    if(endpoint.startsWith('/'))throw fail('SV_LABOR_ENDPOINT','No se pudo conectar con el guardado seguro.');
    return send({id:uuid(),...value},check,endpoint);
   });
  }
  function snapshot(ref,value){
   const saved=copy(value),parts=pathOf(ref).split('/'),key=parts.at(-1)||null;
   const read=path=>String(path).split('/').filter(Boolean).reduce((node,part)=>node&&Object.hasOwn(node,part)?node[part]:null,saved)??null;
   return {key,ref,val:()=>copy(saved),exists:()=>saved!==null,toJSON:()=>copy(saved),exportVal:()=>copy(saved),getPriority:()=>null,
    child:path=>snapshot(sdk.ref(root.fbDB,[pathOf(ref),path].filter(Boolean).join('/')),read(path)),hasChild:path=>read(path)!==null,hasChildren:()=>!!saved&&typeof saved==='object'&&Object.keys(saved).length>0,
    size:saved&&typeof saved==='object'?Object.keys(saved).length:0,
    forEach(action){for(const child of Object.keys(saved&&typeof saved==='object'?saved:{})){if(action(this.child(child))===true)return true;}return false;}};
  }
  function protectedWrite(ref){return root.SVEmployeeAccountViews?.isWriteProtected?.(ref)===true;}
  function proofsOf(snap,ref){
   const proofs=root.SVEmployeeAccountViews?.proofs?.(snap)||{};
   if(root.SVEmployeeAccountViews?.isProtected?.(ref)&&!Object.keys(proofs).length)throw fail('SV_ACCOUNT_VIEW_UNREADY','Falta verificar la vista protegida antes de guardar.');
   return proofs;
  }
  function mergeProofs(target,source){
   for(const [path,revision]of Object.entries(source)){
    if(Object.hasOwn(target,path)&&target[path]!==revision)throw fail('SV_CAS_CONFLICT','Los registros cambiaron durante la lectura. Volvé a revisar.');
    target[path]=revision;
   }
  }
  function compactProofs(proofs){
   const out={...proofs};for(const parent of Object.keys(out))if(/^sv_employee_account_views\/v1\/global[^/]+$/.test(parent))for(const child of Object.keys(out))if(child.startsWith(parent+'/rows/'))delete out[child];return out;
  }
  function commercialMapping(path){const mapping=root.SVCommercialViews?.route?.(path);return mapping&&!mapping.private?mapping:null;}
  function financialCommercial(){return root.SVCommercialViews?.isFinancial?.()===true;}
  function cleanCommercial(path,value){return commercialMapping(path)&&financialCommercial()?root.SVCommercialViews.stripTechnical(value):value;}
  function commercialProofs(snap,ref){const mapping=commercialMapping(pathOf(ref));if(!mapping||financialCommercial())return {};if(!mapping.id)throw fail('SV_COMMERCIAL_COLLECTION','Esta operación necesita las ventas o presupuestos concretos.');const proof=root.SVCommercialViews.proofs(snap),doc='sisventas/'+mapping.domain+'/'+mapping.id;if(!Object.hasOwn(proof,doc)||proof[doc]!==null&&!/^[A-Za-z0-9_-]{16,128}$/.test(proof[doc]||''))throw fail('SV_COMMERCIAL_VERSION','Prepará la ficha comercial antes de guardar.');return {[doc]:proof[doc]};}
  function ackCommercial(data,check){check();try{return data?.currentView===true&&data.records&&typeof root.SVCommercialViews?.acceptRecords==='function'?root.SVCommercialViews.acceptRecords(data.records):null;}catch(_){return null;}}
  async function compareCommercial(ref,transform){
   const check=capture();check();available();const path=pathOf(ref),mapping=commercialMapping(path);if(!mapping?.id)throw fail('SV_COMMERCIAL_COLLECTION','Esta operación necesita las fichas comerciales concretas.');if(typeof transform!=='function')throw fail('SV_LABOR_CALLBACK','El guardado requiere una transformación válida.');
   const current=await read(ref,check);check();const value=current.val(),proofs=commercialProofs(current,ref),next=transform(copy(value));if(next&&typeof next.then==='function'){Promise.resolve(next).catch(()=>{});throw fail('SV_LABOR_CALLBACK','La transformación debe ser síncrona.');}if(next===undefined)return {committed:false,snapshot:current};
   const plan=root.SVCommercialViews.buildWrite({[path]:value},{[path]:prepareValue(next)},proofs),data=await send({id:uuid(),kind:'commercial-atomic',path:'',...plan,expectedHashes:{}},check),accepted=ackCommercial(data,check);
   const doc='sisventas/'+mapping.domain+'/'+mapping.id;let saved=null;if(accepted&&Object.hasOwn(accepted,doc)){saved=accepted[doc];for(const part of mapping.relative)saved=saved&&Object.hasOwn(saved,part)?saved[part]:null;}
   return {committed:true,snapshot:snapshot(ref,saved),currentView:accepted!==null};
  }
  function set(ref,value){
   const path=pathOf(ref);if(!intersectsPath(path))return sdk.set(ref,value);if(commercialMapping(path)&&!financialCommercial())return compareCommercial(ref,()=>value).then(()=>undefined);if(protectedWrite(ref))return compare(ref,()=>value).then(()=>undefined);
   return held(async()=>{const check=capture();check();available();requireScoped(path);const prepared=prepareValue(cleanCommercial(path,value));await send({id:uuid(),kind:'set',path,value:prepared},check);});
  }
  function flattenPatch(path,value){
   if(!value||typeof value!=='object'||Array.isArray(value))throw fail('SV_LABOR_VALUE','Cambios de escritura inválidos.');
   const result=Object.create(null);
   for(const [relative,data]of Object.entries(value)){
    if(!relative||relative.startsWith('/')||relative.endsWith('/'))throw fail('SV_LABOR_PATH','Ruta de escritura inválida.');
    const full=pathOf([path,relative].filter(Boolean).join('/'));result[full]=data;
   }
   const paths=Object.keys(result).sort();
   for(let i=1;i<paths.length;i++)if(paths[i].startsWith(paths[i-1]+'/'))throw fail('SV_LABOR_PATH','Los cambios contienen rutas superpuestas.');
   return result;
  }
  function update(ref,value){
   const path=pathOf(ref),flat=flattenPatch(path,value);
   if(!Object.keys(flat).some(intersectsPath))return sdk.update(ref,value);
   if(Object.keys(flat).some(key=>commercialMapping(key))&&!financialCommercial()){const paths=[...new Set(Object.keys(flat).map(path=>{const m=commercialMapping(path);return m?.id?'sisventas/'+m.domain+'/'+m.id:path;}))];return atomic({paths,build:()=>flat}).then(()=>undefined);}
   if(Object.keys(flat).some(key=>protectedWrite(sdk.ref(root.fbDB,key))))return atomic({paths:Object.keys(flat),build:()=>flat}).then(()=>undefined);
   return held(async()=>{const check=capture();check();available();for(const key of Object.keys(flat))if(intersectsPath(key))requireScoped(key);
    const prepared=Object.create(null);for(const [key,data]of Object.entries(flat))prepared[key]=prepareValue(cleanCommercial(key,data));
    await send({id:uuid(),kind:'patch',path:'',value:prepared},check);});
  }
  function remove(ref){return intersectsPath(pathOf(ref))?set(ref,null):sdk.remove(ref);}
  function push(ref,value){
   if(serviceOnly(pathOf(ref)))throw fail('SV_LABOR_SERVICE_ONLY','Esta información sólo puede actualizarla el servidor.');
   if(value==null||!intersectsPath(pathOf(ref)))return arguments.length<2?sdk.push(ref):sdk.push(ref,value);
   // El SDK genera la clave localmente sin guardar ni resolver la nueva promesa
   // con el mismo ThenableReference (eso produciría un ciclo de resolución).
   const child=sdk.push(ref),plain=sdk.ref(root.fbDB,pathOf(child)),pending=set(plain,value).then(()=>plain);
   child.then=pending.then.bind(pending);child.catch=pending.catch.bind(pending);child.finally=pending.finally.bind(pending);return child;
  }
  function compare(ref,transform){
   if(commercialMapping(pathOf(ref))&&!financialCommercial())return held(()=>compareCommercial(ref,transform));
   return held(async()=>{
    const check=capture();check();available();const path=pathOf(ref);requireScoped(path);
    if(typeof transform!=='function')throw fail('SV_LABOR_CALLBACK','El guardado requiere una transformación válida.');
    for(let attempt=0;attempt<3;attempt++){
     check();const current=await read(ref,check);check();const value=current.val(),expectedViews=proofsOf(current,ref),viewVersioned=Object.keys(expectedViews).length>0,expectedHash=viewVersioned?undefined:await hash(cleanCommercial(path,value));check();
     const next=transform(copy(value));
     if(next&&typeof next.then==='function'){Promise.resolve(next).catch(()=>{});throw fail('SV_LABOR_CALLBACK','La transformación del guardado debe ser síncrona.');}
     if(next===undefined)return {committed:false,snapshot:current};
     const prepared=prepareValue(cleanCommercial(path,next));check();
     try{const data=await send({id:uuid(),kind:viewVersioned?'view-compare':'compare',path,value:prepared,...(viewVersioned?{expectedViews:compactProofs(expectedViews)}:{expectedHash})},check);
      if(!viewVersioned&&!Object.hasOwn(data,'value')&&!root.SVLaborWriteRecovery)throw fail('SV_LABOR_UNCONFIRMED','No se recibió el resultado confirmado del guardado.');
      return {committed:true,snapshot:snapshot(ref,Object.hasOwn(data,'value')?data.value:prepared)};
     }catch(error){if(error.statusCode===409&&error.code==='SV_CAS_CONFLICT'&&attempt<2){check();continue;}throw error;}
    }
   });
  }
  function atomic({paths,build,purpose}={}){
   return held(async()=>{
    const check=capture();check();available();
    if(!Array.isArray(paths)||!paths.length||paths.length>128||typeof build!=='function'||purpose!==undefined&&!['relationship-normalization','expense-removal','employee-bonus-batch','employee-sac-batch','employee-sac-migration'].includes(purpose))throw fail('SV_LABOR_ATOMIC','El guardado requiere hasta 128 registros y una transformación.');
    const selected=paths.map(pathOf);if(new Set(selected).size!==selected.length)throw fail('SV_LABOR_ATOMIC','Hay registros repetidos en el guardado.');
    for(const path of selected)requireScoped(path);
    for(let attempt=0;attempt<3;attempt++){
     check();const values=Object.create(null),expectedHashes=Object.create(null),expectedViews=Object.create(null),expectedCommercial=Object.create(null);let cursor=0,failure;
     await Promise.all(Array.from({length:Math.min(6,selected.length)},async()=>{
      while(!failure&&cursor<selected.length){const path=selected[cursor++];try{
       const ref=sdk.ref(root.fbDB,path),current=await read(ref,check);check();const value=current.val(),commercial=commercialProofs(current,ref),proofs=proofsOf(current,ref);values[path]=copy(value);if(Object.keys(commercial).length)mergeProofs(expectedCommercial,commercial);else if(Object.keys(proofs).length)mergeProofs(expectedViews,proofs);else expectedHashes[path]=await hash(cleanCommercial(path,value));check();
      }catch(error){failure||=error;}}
     }));
     if(failure){if(failure.code==='SV_CAS_CONFLICT'&&attempt<2){check();continue;}throw failure;}check();const changes=build(copy(values));
     if(changes&&typeof changes.then==='function'){Promise.resolve(changes).catch(()=>{});throw fail('SV_LABOR_CALLBACK','La transformación del guardado debe ser síncrona.');}
     if(changes===undefined)return {committed:false};
     const flat=flattenPatch('',changes),prepared=Object.create(null);
     if(!Object.keys(flat).length)throw fail('SV_LABOR_ATOMIC','El guardado no tiene cambios.');
     for(const [path,value]of Object.entries(flat)){
      if(purpose||intersectsPath(path)){requireScoped(path);if(!selected.some(before=>path===before||path.startsWith(before+'/')))throw fail('SV_LABOR_ATOMIC','Falta verificar un registro del guardado.');}
      prepared[path]=prepareValue(cleanCommercial(path,value));
     }
     const commercialVersioned=Object.keys(expectedCommercial).length>0;if(commercialVersioned){if(Object.keys(expectedViews).length||purpose)throw fail('SV_COMMERCIAL_MIXED_VIEWS','Esta operación requiere un contrato que proteja ambas fuentes.');const plan=root.SVCommercialViews.buildWrite(values,prepared,expectedCommercial);check();const data=await send({id:uuid(),kind:'commercial-atomic',path:'',...plan,expectedHashes},check),accepted=ackCommercial(data,check);return {committed:true,value:copy(prepared),records:copy(accepted),currentView:accepted!==null};}
     const viewVersioned=Object.keys(expectedViews).length>0;if(viewVersioned&&purpose)throw fail('SV_ACCOUNT_SOURCE_COMMAND_REQUIRED','Esta operación necesita su comando específico para conservar los registros originales.');
     check();try{await send({id:uuid(),kind:viewVersioned?'view-atomic':'atomic',path:'',value:prepared,expectedHashes,...(viewVersioned?{expectedViews:compactProofs(expectedViews)}:{}),...(purpose?{purpose}:{})},check);return {committed:true,value:copy(prepared)};}
     catch(error){if(error.statusCode===409&&error.code==='SV_CAS_CONFLICT'&&attempt<2){check();continue;}throw error;}
    }
   });
  }
  function runTransaction(ref,transform,options){return intersectsPath(pathOf(ref))?compare(ref,transform):sdk.runTransaction(ref,transform,options);}
  async function restTransaction(ref,transform){
   if(!intersectsPath(pathOf(ref)))throw fail('SV_LABOR_PATH','La operación no pertenece al guardado laboral.');
   const result=await compare(ref,transform);return {committed:result.committed,...(result.committed?{value:result.snapshot.val()}:{})};
  }
  // Integración explícita después de inicializar Firebase y antes de offline-core:
  // install({sdk:{set,update,push,remove,runTransaction,get,ref}}).
  // Las rutas ajenas mantienen el SDK; nunca hay fallback directo tras un fallo.
  function install(options={}){
   if(installed)return api;
   settings=options;sdk=options.sdk||Object.fromEntries(['set','update','push','remove','runTransaction','get','ref'].map(name=>[name,root['fb'+name[0].toUpperCase()+name.slice(1)]]));
   for(const name of ['set','update','push','remove','runTransaction','get','ref'])if(typeof sdk[name]!=='function')throw fail('SV_LABOR_SDK','No está listo el guardado seguro.');
   wrappers={fbSet:set,fbUpdate:update,fbPush:push,fbRemove:remove,fbRunTransaction:runTransaction};
   Object.assign(root,wrappers);installed=true;return api;
  }
  const api={install,canonical,hash,pathOf,intersects:ref=>intersectsPath(pathOf(ref)),restTransaction,atomic,command};return api;
 };
});
