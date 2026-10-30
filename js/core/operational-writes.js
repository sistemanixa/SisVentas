(function(root,factory){'use strict';const create=factory();if(typeof module==='object'&&module.exports)module.exports={create};else root.SVOperationalWrites=create(root);})(typeof window==='object'?window:null,function(){
 'use strict';return function create(root){
  const M=root.SVOperationalReadModel;let sdk,installed=false;
  const conflict=()=>Object.assign(Error('La compra o el stock cambió. Actualizá el detalle antes de reintentar.'),{code:'SV_OPERATIONAL_CONFLICT'});
  function capture(){const user=root.fbAuth?.currentUser,uid=root.currentUserUid,role=root.currentRole;return ()=>{if(!user||uid!==user.uid||root.fbAuth?.currentUser!==user||root.currentUserUid!==uid||root.currentRole!==role||root._impersonacionOriginal)throw Error('La sesión cambió. Volvé a abrir la operación.');};}
  function child(value,parts){for(const key of parts)value=value?.[key];return value??null;}
  function put(value,parts,next){if(!parts.length)return M.clone(next);const out=M.clone(value)||{};let target=out;for(const key of parts.slice(0,-1)){if(!M.key(key))throw Error('Ruta inválida.');target=target[key]||(target[key]={});}const key=parts.at(-1);if(!M.key(key))throw Error('Ruta inválida.');if(next===null)delete target[key];else target[key]=M.clone(next);return out;}
  function snapshot(reference,value){const saved=M.clone(value);return {ref:reference,key:reference.key||M.path(reference).split('/').at(-1),val:()=>M.clone(saved),exists:()=>saved!==null};}
  async function records(paths,transform){
   const check=capture();check();const operation=root.crypto.randomUUID();paths=[...new Set(paths)];if(paths.some(path=>M.recordPath(path)!==path))throw Error('Seleccioná registros concretos para guardar.');
   for(let attempt=0;attempt<3;attempt++){
    const values=await Promise.all(paths.map(async path=>{const snap=await sdk.get(sdk.ref(root.fbDB,path));return [path,snap.val()];}));check();
    const before=Object.fromEntries(values),next=transform(M.clone(before));if(next===undefined)return {committed:false,values:before};
    if(!next||typeof next!=='object'||Array.isArray(next)||typeof next.then==='function')throw Error('La operación debe devolver los registros seleccionados.');
    const patch={},confirmed={};for(const path of paths){if(!Object.hasOwn(next,path))throw Error('Falta un registro en el guardado.');if(JSON.stringify(before[path])===JSON.stringify(next[path])){confirmed[path]=before[path];continue;}const delta=M.plan(path,before[path],next[path],operation);Object.assign(patch,delta);confirmed[path]=delta[path];}
    if(Object.keys(next).some(path=>!paths.includes(path)))throw Error('La operación intentó guardar un registro no seleccionado.');
    if(!Object.keys(patch).length)return {committed:true,values:before};
    try{check();await sdk.update(sdk.ref(root.fbDB),patch);check();return {committed:true,values:confirmed};}
    catch(error){check();const fresh=await Promise.all(paths.map(async path=>(await sdk.get(sdk.ref(root.fbDB,path))).val()));check();
     const changed=paths.filter(path=>Object.hasOwn(patch,path));
     if(changed.every(path=>{const value=fresh[paths.indexOf(path)];return patch[path]===null?value===null:value?.[M.operation]===operation;}))return {committed:true,values:Object.fromEntries(paths.map((path,i)=>[path,fresh[i]]))};
     if(attempt===2||!/permission.?denied/i.test(String(error.code||''))||!fresh.some((v,i)=>(v?.[M.revision]??0)!==(before[paths[i]]?.[M.revision]??0)))throw error;
    }
   }throw conflict();
  }
  async function transaction(reference,fn){
   const path=M.path(reference),record=M.recordPath(path);if(!record)throw Error('La operación requiere registros concretos.');const relative=path.slice(record.length).split('/').filter(Boolean);
   const result=await records([record],values=>{const next=fn(M.clone(child(values[record],relative)));if(next===undefined)return undefined;if(next&&typeof next.then==='function')throw Error('La operación debe ser síncrona.');values[record]=put(values[record],relative,next);return values;});
   const value=child(result.values[record],relative);return {committed:result.committed,value,snapshot:snapshot(reference,value)};
  }
  function isCollection(path){return M.domains.some(domain=>path==='sisventas/'+domain);}
  function set(reference,value){const path=M.path(reference);if(isCollection(path))throw Error('No se reemplaza un historial completo.');return M.recordPath(path)?transaction(reference,()=>value).then(()=>{}):sdk.set(reference,value);}
  function update(reference,value){
   const base=M.path(reference),flat=Object.fromEntries(Object.entries(value).map(([key,v])=>[[base,key].filter(Boolean).join('/'),v])),operational=Object.keys(flat).filter(path=>M.recordPath(path)||isCollection(path));
   if(!operational.length)return sdk.update(reference,value);
   if(operational.length!==Object.keys(flat).length)throw Error('Este guardado combinado necesita su circuito protegido.');
   if(operational.some(isCollection))throw Error('No se reemplaza un historial completo.');
   const paths=[...new Set(operational.map(M.recordPath))];return records(paths,records=>{for(const [path,value]of Object.entries(flat)){const record=M.recordPath(path);if(path!==record&&records[record]===null)throw Error('El registro ya no existe. Volvé a abrir la lista.');records[record]=put(records[record],path.slice(record.length).split('/').filter(Boolean),value);}return records;}).then(()=>{});
  }
  function push(reference,value){if(arguments.length<2)return sdk.push(reference);const base=M.path(reference);if(!isCollection(base))return sdk.push(reference,value);const child=sdk.push(reference),plain=sdk.ref(root.fbDB,base+'/'+child.key),pending=set(plain,value).then(()=>plain);child.then=pending.then.bind(pending);child.catch=pending.catch.bind(pending);child.finally=pending.finally.bind(pending);return child;}
  async function multi(domain,ids,fn){if(!M.domains.includes(domain)||ids.some(id=>!M.key(id)))throw Error('Selección inválida.');const paths=ids.map(id=>'sisventas/'+domain+'/'+id),result=await records(paths,records=>{const map=Object.fromEntries(ids.map((id,i)=>[id,records[paths[i]]]));const next=fn(map);if(next===undefined)return undefined;if(!next||typeof next!=='object'||Array.isArray(next)||ids.some(id=>!Object.hasOwn(next,id)||next[id]===undefined))throw Error('Falta un registro seleccionado; no se guardaron cambios.');return Object.fromEntries(ids.map((id,i)=>[paths[i],next[id]]));});const value=Object.fromEntries(ids.map((id,i)=>[id,result.values[paths[i]]]));return {committed:result.committed,snapshot:{val:()=>M.clone(value)}};}
  function install(options){if(installed)return;sdk=options.sdk;Object.assign(root,{fbSet:set,fbUpdate:update,fbPush:push,fbRemove:reference=>set(reference,null),fbRunTransaction:(reference,fn,options)=>{const path=M.path(reference);return M.recordPath(path)||isCollection(path)?transaction(reference,fn):sdk.runTransaction(reference,fn,options);}});installed=true;}
  return Object.freeze({install,transaction,multi,records,intersects:reference=>!!M.recordPath(reference)});
 };
});
