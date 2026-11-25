(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVPurchaseCommandForm=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 function create(root){
  const pending=new Map();
  function run(key,panel,operation,confirmed,signature=key){
   if(pending.has(key)){const previous=pending.get(key);return previous.signature===signature?previous.promise:Promise.reject(Error('Hay otra operación de Compras pendiente. Confirmala antes de cambiar sus datos.'));}
   const valid=root.svCapturarContextoOperacion?.()||(()=>true),origin=root.document?.activeElement;
   const controls=Array.from(panel?.querySelectorAll?.('button,input,select,textarea')||[]).map(node=>({node,disabled:node.disabled}));
   for(const entry of controls)entry.node.disabled=true;
   panel?.setAttribute?.('aria-busy','true');
   // Install the pending promise before beginning an asynchronous capability/hash step.
   const task=Promise.resolve().then(()=>{if(!valid())throw Error('La sesión cambió. Volvé a abrir Compras.');return operation();}).then(async result=>{
    if(!result||result.ok!==true||result.committed!==true)throw Error('No se confirmó el guardado. Consultá la operación antes de repetir.');
    if(valid())try{await confirmed?.(result);}catch(_){root.notify?.('Guardado confirmado. Actualizá el listado para verlo; no repitas la operación.');}
    return result;
   }).finally(()=>{
    if(pending.get(key)?.promise===task)pending.delete(key);
    for(const entry of controls)if(entry.node.isConnected!==false)entry.node.disabled=entry.disabled;
    panel?.removeAttribute?.('aria-busy');
    if(valid()&&origin?.isConnected&&panel?.contains?.(origin))origin.focus?.({preventScroll:true});
   });
   pending.set(key,{promise:task,signature});return task;
  }
  return Object.freeze({run,pending:key=>pending.has(key)});
 }
 return Object.freeze({create});
});
