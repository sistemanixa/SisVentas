'use strict';
// Exact summary companion of the approved pristine OT cascade, not standalone.
const crypto=require('node:crypto'),Cascade=require('./sale-delete-ot-cascade-rules.cjs'),Writer=require('./sale-delete-targeted-writer-rules.cjs');
function prepare(input){
 const rules=structuredClone(input),node=rules.rules?.sisventas?.listados_resumen?.ordenes_trabajo?.$record,ot=rules.rules?.sisventas?.ordenes_trabajo?.$record;
 if(typeof node?.['.write']!=='string'||!node['.write'].includes('svOTDeleteOperationalVersion')||typeof ot?.['.write']!=='string')throw Error('Falta la política nativa exacta del resumen OT.');
 const old=node['.write'],otOld=ot['.write'],extended=Cascade.prepare(input,{mode:'live-originals'}).rules.rules.sisventas.ordenes_trabajo.$record['.write'],prefix='('+otOld+') || (';
 if(!extended.startsWith(prefix)||!extended.endsWith(')'))throw Error('La cascada OT cambió de contrato.');
 const next='newData.parent().parent().parent().parent()',original="root.child('sisventas/ordenes_trabajo').child($record)";
 const predicate=extended.slice(prefix.length,-1).replaceAll('newData.parent().parent().parent()',next).replaceAll("data.child('ventaFbKey')",original+".child('ventaFbKey')");
 const extra=[original+'.exists()','!'+next+".child('sisventas/ordenes_trabajo').child($record).exists()",Writer.maintained(4)].map(s=>'('+s+')').join(' && ');
 node['.write']='('+old+') || (('+predicate+') && '+extra+')';
 return {rules,manifest:{path:'sisventas/listados_resumen/ordenes_trabajo/$record/.write',beforeSha256:crypto.createHash('sha256').update(old).digest('hex'),originalPreserved:true,parentGrantsAdded:false,sourceGrantsAdded:true,standaloneActivated:false,requiresSameOTOriginalAndSummaryGone:true,requiresTargetedIndexMaintenance:true}};
}
module.exports={prepare};
