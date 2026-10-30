(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SVChatHeaderModel=api;
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 // Explicit read contracts. Never use these records as a baseline for a write:
 // receipts, allocations and attachments intentionally belong to the detail.
 const scalar=value=>value===null||['string','number','boolean'].includes(typeof value);
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 function select(value,fields){
  const result={};for(const field of fields){
   if(!own(value,field)||value[field]===undefined||value[field]===null)continue;
   if(!scalar(value[field])||typeof value[field]==='number'&&!Number.isFinite(value[field]))throw Error('Dato de resumen inválido: '+field);
   result[field]=value[field];
  }return result;
 }
 function object(value){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Registro inválido');return value;}
 const chatFields=Object.freeze(['autor','autorUid','rol','ts','texto','archivoNombre','eliminado','editadoEn','leidoNonce']);
 function chat(message){
  object(message);const result=select(message,chatFields);
  for(const field of ['fotoUrl','audioUrl','archivoUrl'])if(message[field])result[field]=true;
  if(message.leido){object(message.leido);const markers={};for(const [uid,read]of Object.entries(message.leido)){
   if(read!==true)throw Error('Marca de lectura inválida');markers[uid]=true;
  }if(Object.keys(markers).length)result.leido=markers;}
  return result;
 }
 return Object.freeze({chat,chatFields});
});
