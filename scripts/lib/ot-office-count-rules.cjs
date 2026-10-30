'use strict';
// Offline candidate only. Existing authorization is preserved outside a lease.
const {permissionsIdle,fence,userActor,serverActor}=require('../../cotizador/labor-fence-policy');
const closed=v=>v===undefined||v===false||v==='false';
const marker="auth.token.svFinancialAction !== 'ot.ajustarStockOficina'";
function build(input){
 const result=structuredClone(input),r=result?.rules,s=r?.sisventas;
 if(!s||!closed(r['.write'])||!closed(s['.write']))throw Error('Concesión de escritura en un padre: requiere revisión.');
 if(r.sv_labor_config)r.sv_labor_config.otOfficeCountVersion={'.validate':'newData.val() === 1'};
 for(const [key,value]of Object.entries(r))if(key.startsWith('$')&&value&&typeof value==='object')throw Error('Comodín raíz sin revisar.');
 // Explicit reviewed domains must be excluded from every fallback wildcard.
 for(const [key,value]of Object.entries(s))if(key.startsWith('$')&&value&&typeof value==='object'){
  for(const domain of ['inventario_operativo','ordenes_trabajo'])if(!closed(value['.write'])&&!String(value['.write']).includes(key+" !== '"+domain+"'"))throw Error('Comodín de escritura no excluye '+domain);
  function descendants(n){for(const [k,v]of Object.entries(n))if(!k.startsWith('.')&&v&&typeof v==='object'){if(!closed(v['.write']))throw Error('Concesión descendiente del comodín sin revisar.');descendants(v);}}descendants(value);
 }
 const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()",cfg="root.child('sv_permisos').child("+role+")";
 const explicit="root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && "+role+" === auth.token.svFinancialActorRole && "+cfg+".child('indiceRevision').val() === auth.token.svFinancialPermissionRevision && "+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos/ordentrabajo').val() === true && ("+cfg+".child('acciones/ot/ajustarStockOficina').val() === true || (!"+cfg+".child('acciones/ot/ajustarStockOficina').exists() && "+role+" === 'admin')) && auth.token.svPasswordChangeRequired !== true && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && (!root.child('sv_access_resets').child(auth.uid).child('version').exists() || auth.token.svAccessVersion === root.child('sv_access_resets').child(auth.uid).child('version').val())";
 for(const domain of ['inventario_operativo','ordenes_trabajo']){
  if(!s[domain])throw Error('Dominio explícito no encontrado: '+domain);
  function wrap(node,depth){
   if(!closed(node['.write'])&&!String(node['.write']).includes(marker)){
    if(typeof node['.write']!=='string'&&node['.write']!==true)throw Error('Expresión de escritura inválida.');
    node['.write']='('+node['.write']+') && (('+permissionsIdle+') || (('+fence(depth,'('+userActor+') || ('+serverActor+')')+') && ('+marker+' || ('+explicit+'))))';
   }
   for(const [key,value]of Object.entries(node))if(!key.startsWith('.')&&value&&typeof value==='object')wrap(value,depth+1);
  }wrap(s[domain],2);
 }
 return result;
}
module.exports={build};
