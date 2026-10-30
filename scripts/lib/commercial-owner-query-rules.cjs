'use strict';
// Candidata de índices, nunca despliega ni cambia autorizaciones.
function build(input){
 const out=structuredClone(input);
 for(const domain of ['ventas','presupuestos']){
  const node=out?.rules?.sisventas?.[domain];if(!node||typeof node!=='object')throw Error('Falta la colección comercial '+domain);
  const before=node['.indexOn'];if(before!==undefined&&typeof before!=='string'&&!Array.isArray(before))throw Error('Índices comerciales inválidos');
  node['.indexOn']=[...new Set([...(before===undefined?[]:Array.isArray(before)?before:[before]),'responsableUid'])];
 }
 const users=out?.rules?.sv_usuarios;if(!users||typeof users!=='object')throw Error('Falta el directorio de usuarios');
 const existing=users['.indexOn'];if(existing!==undefined&&typeof existing!=='string'&&!Array.isArray(existing))throw Error('Índice de usuarios inválido');
 users['.indexOn']=[...new Set([...(existing===undefined?[]:Array.isArray(existing)?existing:[existing]),'uid'])];
 return out;
}
module.exports={build};
