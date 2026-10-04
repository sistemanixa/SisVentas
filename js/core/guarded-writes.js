(function(root){
  'use strict';
  function canonical(value) {
    if (value == null) return 'null';
    if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
    if (typeof value === 'object') return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
    return JSON.stringify(value);
  }
  function equal(a,b){return canonical(a)===canonical(b);}
  function conflict(){const e=new Error('Otro usuario modificó este registro. Volvé a abrirlo para revisar los cambios antes de guardar.');e.code='SV_CONFLICT';return e;}
  function merge(current,baseline,changes){
    if(!current || !baseline)return undefined;
    const next=Object.assign({},current);
    for(const key of Object.keys(changes)){
      if(key==='fbKey'||changes[key]===undefined)continue;
      if(equal(changes[key],baseline[key]))continue;
      if(!equal(current[key],baseline[key])&&!equal(current[key],changes[key]))return undefined;
      if(changes[key]===null)delete next[key];else next[key]=changes[key];
    }
    return next;
  }
  async function save(path,baseline,changes,requireUnchanged){
    if(!root.fbDB||typeof root.fbRunTransaction!=='function')throw new Error('No hay conexión segura para guardar');
    // Precargar evita abortar una transacción por la primera llamada con caché vacía.
    const ref=root.fbRef(root.fbDB,path);
    const uid=root.currentUserUid;
    await root.fbGet(ref);
    if(uid!==root.currentUserUid)throw conflict();
    const result=await root.fbRunTransaction(ref,current=>{
      if(uid!==root.currentUserUid)return undefined;
      if(requireUnchanged){
        const original=Object.assign({},baseline);delete original.fbKey;
        const latest=Object.assign({},current);delete latest.fbKey;
        if(!current||!equal(latest,original))return undefined;
      }
      return merge(current,baseline,changes);
    },{applyLocally:false});
    if(!result.committed)throw conflict();
    return result.snapshot.val();
  }
  async function conditionalUpdate(path,validate,updates){
    if(!root.fbDB||typeof root.fbRunTransaction!=='function')throw new Error('No hay conexión segura para guardar');
    const ref=root.fbRef(root.fbDB,path);
    const uid=root.currentUserUid;
    await root.fbGet(ref);
    if(uid!==root.currentUserUid)throw conflict();
    const result=await root.fbRunTransaction(ref,current=>{
      if(uid!==root.currentUserUid||!current||!validate(current))return undefined;
      const next=JSON.parse(JSON.stringify(current));
      for(const [key,value] of Object.entries(updates)){
        const parts=key.split('/');
        if(parts.some(p=>!p||['__proto__','prototype','constructor'].includes(p)))throw new Error('Ruta inválida');
        const field=parts.pop();let target=next;
        for(const part of parts)target=target[part]||(target[part]={});
        if(value===null)delete target[field];else target[field]=value;
      }
      return next;
    },{applyLocally:false});
    if(!result.committed)throw conflict();
    return result;
  }

  function errorMessage(error){
    return /disconnect|network|failed to fetch|abort|timeout/i.test(String(error?.message||error))
      ? 'Se interrumpió la conexión. No se pudo confirmar la operación. Conservá esta ventana y verificá el estado antes de reintentar.'
      : String(error?.message||'No se pudo completar la operación.');
  }
  // Las operaciones entre ventas y listas necesitan una única escritura condicional.
  // El SDK corta escrituras de más de 16 MB; REST admite hasta 256 MB y preserva
  // concurrencia con ETag. Reservar esto para aplicar/cancelar, nunca para borradores.
  async function restTransaction(ref, transform){
    const user=root.fbAuth?.currentUser,uid=root.currentUserUid;
    if(!user||user.uid!==uid)throw new Error('La sesión cambió. Volvé a ingresar.');
    const token=await user.getIdToken();
    const url=new URL(ref.toString().replace(/\/$/,'')+'.json');
    url.searchParams.set('auth',token);
    const checkSession=()=>{if(root.currentUserUid!==uid||root.fbAuth.currentUser!==user)throw new Error('La sesión cambió. Volvé a ingresar.');};
    for(let attempt=0;attempt<2;attempt++){
      checkSession();
      const response=await root.fetch(url.href,{headers:{'X-Firebase-ETag':'true'},cache:'no-store',signal:AbortSignal.timeout(90000)});
      if(!response.ok)throw new Error('No se pudo leer la preparación. Revisá la conexión y los permisos.');
      const etag=response.headers.get('etag');
      if(!etag)throw new Error('No se pudo verificar la versión de los datos. Reintentá.');
      const next=transform(await response.json());
      if(next===undefined)return {committed:false};
      if(!next||typeof next!=='object')throw new Error('La operación no produjo datos válidos.');
      const body=JSON.stringify(next);
      if(new TextEncoder().encode(body).byteLength>128*1024*1024)throw new Error('La operación requiere procesamiento del servidor. No se guardaron cambios.');
      checkSession();
      url.searchParams.set('print','silent');
      const write=await root.fetch(url.href,{method:'PUT',headers:{'if-match':etag,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(90000)});
      if(write.ok)return {committed:true};
      if(write.status===412){url.searchParams.delete('print');continue;}
      if(write.status===401||write.status===403)throw new Error('No tenés permiso para completar esta operación.');
      throw new Error('No se pudo confirmar la operación. Verificá el estado antes de reintentar.');
    }
    throw conflict();
  }
  const api={equal,merge,save,conditionalUpdate,conflict,restTransaction,errorMessage};
  if(typeof module!=='undefined')module.exports=api;
  root.SVGuardedWrites=api;
})(typeof window==='undefined'?globalThis:window);
