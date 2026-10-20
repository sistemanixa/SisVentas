'use strict';
// Adapta la API usada por los servicios. Dentro del circuito todas las lecturas
// ven el mismo plan; ninguna escritura Admin se adelanta al PATCH confirmado.
const {affected,parts,child}=require('./labor-guard');
const fail=(message)=>Object.assign(Error(message),{statusCode:400});
const copy=value=>value==null?null:structuredClone(value);
function snapshot(ref,value){
 const saved=copy(value);
 return {ref,key:ref.key,val:()=>copy(saved),exists:()=>saved!==null,toJSON:()=>copy(saved),exportVal:()=>copy(saved),getPriority:()=>null,
  child:path=>snapshot(ref.child(path),child(saved,parts(path))),hasChild:path=>child(saved,parts(path))!==null,
  hasChildren:()=>!!saved&&typeof saved==='object'&&Object.keys(saved).length>0,
  numChildren:()=>saved&&typeof saved==='object'?Object.keys(saved).length:0,
  forEach(action){for(const key of Object.keys(saved&&typeof saved==='object'?saved:{})){if(action(this.child(key))===true)return true;}return false;}};
}
function flatten(path,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw fail('Cambios inválidos');
 const out=Object.create(null);
 for(const [relative,value]of Object.entries(patch)){parts(relative);const target=[path,relative].filter(Boolean).join('/');parts(target);out[target]=value;}
 const keys=Object.keys(out).sort();for(let i=1;i<keys.length;i++)if(keys[i].startsWith(keys[i-1]+'/'))throw fail('Rutas de guardado superpuestas');
 return out;
}
function createLaborDb({db,guard}){
 if(!db||!guard)throw Error('Falta el circuito de guardado');
 let wrappedDb;
 const internal={uid:'sv-labor-service',mode:'server',operation:'service-write'};
 const pathOf=ref=>decodeURIComponent(new URL(ref.toString()).pathname).replace(/^\/+|\/+$/g,'');
 function scoped(ref,path,query){
  const listeners=new Map(),remoteListeners=new Map();
  function wrapSnapshot(original){return new Proxy(original,{get(target,key){if(key==='ref')return scoped(target.ref,pathOf(target.ref));if(key==='child')return relative=>wrapSnapshot(target.child(relative));if(key==='forEach')return action=>target.forEach(next=>action(wrapSnapshot(next)));const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});}
  const get=async()=>{const scope=guard.current();if(!scope)return wrapSnapshot(await ref.get());if(!path)throw fail('No se permite leer la base completa');
   if(['sisventas','sisventas/config'].includes(path))throw fail('La lectura requiere registros individuales');
   if(query&&!Object.hasOwn(query,'value'))throw fail('La consulta requiere un valor exacto');
   const value=query?await scope.query(path,query.field,query.value):await scope.get(path);return snapshot(proxy,value);};
  const stage=async(patch)=>{
   const perform=async scope=>{await scope.update(patch);};
   for(const key of Object.keys(patch))if(['sisventas','sisventas/config'].includes(key))throw fail('El guardado requiere registros individuales');
   if(guard.current())return perform(guard.current());
   if(Object.keys(patch).some(affected))return guard.run({...internal,input:patch},perform);
   return ref.update(Object.fromEntries(Object.entries(patch).map(([key,value])=>[path?key.slice(path.length+1):key,value])));
  };
  const proxy=new Proxy(ref,{get(target,key){
   if(key==='get')return get;
   if(key==='once')return (event,success,failure)=>{if(!guard.current()){const result=target.once(event).then(wrapSnapshot);if(success||failure)result.then(success,failure);return result;}if(event!=='value')throw fail('Lectura de evento no compatible');const result=get();if(success||failure)result.then(success,failure);return result;};
   if(key==='on')return (event,success,failure)=>{if(!guard.current()){const wrapped=(next,previous)=>success(wrapSnapshot(next),previous),bindings=remoteListeners.get(success)||[];bindings.push({event,wrapped});remoteListeners.set(success,bindings);target.on(event,wrapped,failure);return success;}if(event!=='value')throw fail('Suscripción no permitida durante un guardado');const state={active:true};listeners.set(success,state);get().then(value=>{if(state.active)success(value);},error=>{if(state.active)failure?.(error);});return success;};
   if(key==='off')return (event,callback)=>{if(listeners.has(callback)){listeners.get(callback).active=false;listeners.delete(callback);return;}if(callback&&remoteListeners.has(callback)){const bindings=remoteListeners.get(callback);for(const b of bindings)if(!event||b.event===event)target.off(b.event,b.wrapped);const remaining=bindings.filter(b=>event&&b.event!==event);if(remaining.length)remoteListeners.set(callback,remaining);else remoteListeners.delete(callback);return;}return target.off(event,callback);};
   if(key==='child')return relative=>{parts(relative);const next=target.child(relative);return scoped(next,[path,relative].filter(Boolean).join('/'));};
   if(key==='ref')return query?scoped(target.ref,path):proxy;
   if(key==='database')return wrappedDb;
   if(key==='parent')return path?scoped(target.parent,path.includes('/')?path.slice(0,path.lastIndexOf('/')):''):null;
   if(key==='root')return scoped(target.root,'');
   if(key==='orderByChild')return field=>{parts(field);return scoped(target.orderByChild(field),path,{field});};
   if(key==='equalTo')return value=>{if(!query?.field)throw fail('Consulta sin campo de orden');return scoped(target.equalTo(value),path,{...query,value});};
   if(key==='set')return value=>{if(!path||['sisventas','sisventas/config'].includes(path))throw fail('No se permite sustituir la base completa');return !guard.current()&&!affected(path)?target.set(value):stage({[path]:value});};
   if(key==='remove')return ()=>{if(!path||['sisventas','sisventas/config'].includes(path))throw fail('No se permite borrar la base completa');return !guard.current()&&!affected(path)?target.remove():stage({[path]:null});};
   if(key==='update')return patch=>{const flat=flatten(path,patch);return !guard.current()&&!Object.keys(flat).some(affected)?target.update(patch):stage(flat);};
   if(key==='transaction')return async(update,completion,applyLocally)=>{
    if(!path||['sisventas','sisventas/config'].includes(path)||query)throw fail('La transacción requiere registros individuales');
    if(!guard.current()&&!affected(path))return target.transaction(update,completion,applyLocally);
    const perform=async()=>{const before=await get(),next=update(before.val());if(next&&typeof next.then==='function'){Promise.resolve(next).catch(()=>{});throw fail('La transformación debe ser síncrona');}if(next===undefined)return {committed:false,snapshot:before};await stage({[path]:next});return {committed:true,snapshot:snapshot(proxy,next)};};
    try{let result;if(guard.current())result=await perform();else await guard.run({...internal,operation:'service-transaction',input:{path}},async()=>{result=await perform();return {committed:result.committed};});completion?.(null,result.committed,result.snapshot);return result;}
    catch(error){completion?.(error,false,null);throw error;}
   };
   if(key==='push')return function(value){const raw=target.push(),p=scoped(target.child(raw.key),[path,raw.key].filter(Boolean).join('/'));if(!arguments.length)return p;const pending=p.set(value).then(()=>p);return new Proxy(p,{get(t,k){if(['then','catch','finally'].includes(k))return pending[k].bind(pending);return Reflect.get(t,k);}});};
   // A query shape without an implemented overlay must fail during a commit,
   // rather than accidentally querying the live Admin connection behind it.
   if((guard.current()||path&&affected(path))&&['orderByKey','orderByValue','orderByPriority','startAt','startAfter','endAt','endBefore','limitToFirst','limitToLast','setWithPriority','setPriority','onDisconnect'].includes(key))return ()=>{throw fail('Operación no compatible con el guardado coordinado');};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});return proxy;
 }
 wrappedDb=new Proxy(db,{get(target,key){if(['ref','refFromURL'].includes(key))return value=>{const raw=target[key](value);return scoped(raw,pathOf(raw));};if(key==='app')throw fail('Usá el circuito de datos verificado');const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});return wrappedDb;
}
module.exports={createLaborDb,flatten,snapshot};
