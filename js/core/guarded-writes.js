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
  const api={equal,merge,save,conditionalUpdate,conflict};
  if(typeof module!=='undefined')module.exports=api;
  root.SVGuardedWrites=api;
})(typeof window==='undefined'?globalThis:window);
