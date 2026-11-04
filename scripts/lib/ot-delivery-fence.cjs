'use strict';
// Offline composition only. Runtime readiness also requires fresh verified
// deployment evidence; producing this candidate never marks a remote fence ready.
const Operational=require('./operational-write-fence.cjs'),{permissionsIdle,financialRule}=require('../../cotizador/labor-fence-policy');
const closed=v=>v===undefined||v===false||v==='false';
function prepare(input){
 const out=Operational.prepare(input),root=out.rules,data=root.sisventas,ot=data.ordenes_trabajo,lists=data.listados_resumen;
 if(!ot||!lists?.ordenes_trabajo||!closed(ot['.write'])||!closed(lists['.write'])||!closed(lists.ordenes_trabajo['.write']))throw Error('Revisar concesiones padre de OT canónica/resúmenes antes de sellar entrega.');
 const keys=Object.keys(ot).filter(k=>k.startsWith('$'));if(keys.length!==1)throw Error('La OT necesita una regla explícita por registro.');const otKey=keys[0];
 const profile="root.child('sv_chat_roles').child(auth.uid)",cfg="root.child('sv_permisos').child(auth.token.svOTLifecycleRole)";
 const permission="root.child('sv_labor_config/otDeliveryVersion').val() === 1 && auth.token.svOTLifecycleVersion === 1 && (auth.token.svOTLifecycleRole === 'admin' || auth.token.svOTLifecycleRole === 'administrativo') && "+profile+".child('activo').val() === true && "+profile+".child('rol').val() === auth.token.svOTLifecycleRole && "+cfg+".child('indiceRevision').val() === auth.token.svOTLifecyclePermissionRevision && "+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos/ordentrabajo').val() === true && ("+cfg+".child('acciones/ot/entregarMateriales').val() === true || !"+cfg+".child('acciones/ot/entregarMateriales').exists())";
 // An ancestor wildcard grant cannot be revoked by a canonical child rule.
 for(const [parent,domain]of [[data,'ordenes_trabajo'],[lists,'ordenes_trabajo']])for(const [wild,node]of Object.entries(parent))if(wild.startsWith('$')){
  function exclude(n){for(const [k,v]of Object.entries(n)){if(k==='.write'&&!closed(v)){if(typeof v!=='string')throw Error('Autoridad comodín no textual.');n[k]='('+wild+" !== '"+domain+"') && ("+v+')';}else if(!k.startsWith('.'))exclude(v);}}exclude(node);
 }
 function seal(node,depth,condition){if(!node||typeof node!=='object')throw Error('Regla OT inválida.');for(const [name,value]of Object.entries(node)){if(name==='.write'){
   if(closed(value))continue;if(typeof value!=='string')throw Error('Revisar autoridad OT no textual.');
   const keyCondition=condition.split(' && ')[0];
   const historical="auth.token.svOTDeliveryHistoricalVerified === true && auth.token.svOTLifecycleVersion === 1 && auth.token.svOTLifecycleKind === 'custody' && "+keyCondition+' && '+profile+".child('activo').val() === true && "+profile+".child('rol').val() === auth.token.svOTLifecycleRole && "+cfg+".child('indiceRevision').val() === auth.token.svOTLifecyclePermissionRevision && "+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos/ordentrabajo').val() === true && ("+cfg+".child('acciones/ot/rendirMateriales').val() === true || (!"+cfg+".child('acciones/ot/rendirMateriales').exists() && (auth.token.svOTLifecycleRole === 'admin' || auth.token.svOTLifecycleRole === 'administrativo' || auth.token.svOTLifecycleRole === 'tecnico' || auth.token.svOTLifecycleRole === 'tecnico_vendedor')))";
   const protocol="(auth.token.svOTDeliveryCommitVersion === 1 && auth.token.svOTDeliveryUnchanged === true) || (auth.token.svOTLifecycleKind === 'delivery' && "+condition+') || (auth.token.svOTDeliveryCommitVersion === 1 && '+historical+')';
   const wrapped="((root.child('sv_labor_config/otDeliveryVersion').val() !== 1) && ("+permissionsIdle+') && ('+value+')) || (('+financialRule(depth,value)+') && ('+protocol+'))';node[name]="(auth != null && auth.token.svOTLifecycleKind === 'delivery') ? (("+wrapped+') && '+condition+') : ('+wrapped+')';
  }else if(!name.startsWith('.'))seal(value,depth+1,condition);}}
 seal(ot[otKey],3,otKey+' === auth.token.svOTLifecycleOTKey && '+permission);
 const summaries=lists.ordenes_trabajo,summaryKeys=Object.keys(summaries).filter(k=>k.startsWith('$'));if(summaryKeys.length!==1)throw Error('El resumen OT necesita una regla por registro.');seal(summaries[summaryKeys[0]],4,summaryKeys[0]+' === auth.token.svOTLifecycleOTKey && '+permission);
 const indexes=ot['.indexOn']||[];if(!Array.isArray(indexes)&&typeof indexes!=='string')throw Error('Índice OT inválido.');ot['.indexOn']=[...new Set([...(Array.isArray(indexes)?indexes:[indexes]),'ventaFbKey'])];
 const catalog=data.productos;if(!catalog||typeof catalog!=='object')throw Error('Falta inventariar el catálogo autoritativo.');const catalogIndexes=catalog['.indexOn']||[];if(!Array.isArray(catalogIndexes)&&typeof catalogIndexes!=='string')throw Error('Índice de catálogo inválido.');catalog['.indexOn']=[...new Set([...(Array.isArray(catalogIndexes)?catalogIndexes:[catalogIndexes]),'codigo','cod'])];
 root.sv_labor_config.otDeliveryVersion={'.validate':'newData.val() === 1'};return out;
}
module.exports={prepare};
