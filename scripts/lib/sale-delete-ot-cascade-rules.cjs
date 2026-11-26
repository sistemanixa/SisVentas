'use strict';
// One explicitly approved leaf extension, not an OTDelete standalone capability.
const crypto=require('node:crypto'),Fence=require('../../cotizador/labor-fence-policy');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function prepare(input,{mode='indexed'}={}){
 if(!['indexed','live-originals'].includes(mode))throw Error('Modo de evidencia inválido.');
 const rules=structuredClone(input),ot=rules.rules?.sisventas?.ordenes_trabajo;
 if(!ot||![false,'false',undefined].includes(ot['.write']))throw Error('Autoridad padre OT no revisable.');
 const names=Object.keys(ot).filter(k=>k.startsWith('$'));if(names.length!==1||names[0]!=='$record')throw Error('Hoja OT distinta.');
 const node=ot[names[0]],old=node['.write'];if(typeof old!=='string'||!old.includes('svOTDeleteOperationalVersion')||!old.includes('sv_labor_receipts'))throw Error('Falta preservar la política nativa OT.');
 const next="newData.parent().parent().parent()",receipt=next+".child('sv_labor_receipts').child(auth.token.opId)",sale="data.child('ventaFbKey').val()";
 const conditions=["data.exists() && !newData.exists()","auth.token.svFinancialAction === 'ventas.eliminar'",Fence.fence(3,Fence.userActor),
 "auth.token.svLaborWriterSchema === 2",...(mode==='indexed'?['ClientAccounts','ClientHistory','SaleFinancial'].map(f=>'auth.token.sv'+f+'WriterVersion === 1'):["auth.token.svClientAccountsWriterVersion === 1",require('./sale-delete-namespace-precondition-rules.cjs').modePredicate(3)]),"auth.token.svPaymentIndexVersion === 1",
 "auth.token.svFinancialActorRole === 'admin'","root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true","root.child('sv_chat_roles').child(auth.uid).child('rol').val() === 'admin'",
 "root.child('sv_permisos/admin/indiceVersion').val() === 2","root.child('sv_permisos/admin/indiceRevision').val() === auth.token.svFinancialPermissionRevision",
 ...['venta','ordentrabajo'].map(m=>"root.child('sv_permisos/admin/indiceModulos/"+m+"').val() === true"),
 "root.child('sv_permisos/admin/acciones/ventas/eliminar').val() !== false","root.child('sv_permisos/admin/acciones/ot/eliminar').val() !== false",
 ...['venta','ordentrabajo'].flatMap(m=>Array.from({length:64},(_,i)=>"root.child('sv_permisos/admin/bloqueados/"+i+"').val() !== '"+m+"'")),
 "auth.token.svPasswordChangeRequired !== true","root.child('sv_access_resets').child(auth.uid).child('required').val() !== true","(!root.child('sv_access_resets').child(auth.uid).child('version').exists() || root.child('sv_access_resets').child(auth.uid).child('version').val() === auth.token.svAccessVersion)",
 "data.child('ventaFbKey').isString()",sale+".length > 0",receipt+".child('actorUid').val() === auth.uid",receipt+".child('result/ok').val() === true",receipt+".child('result/committed').val() === true",receipt+".child('result/ventaKey').isString()",sale+' === '+receipt+".child('result/ventaKey').val()",
 "root.child('sisventas/ventas').child("+sale+').exists()',"!"+next+".child('sisventas/ventas').child("+sale+').exists()'];
 const predicate=conditions.map(s=>'('+s+')').join(' && ');node['.write']='('+old+') || ('+predicate+')';
 return{rules,manifest:{path:'sisventas/ordenes_trabajo/$record/.write',beforeSha256:sha(old),originalPreserved:true,parentGrantsAdded:false,standaloneActivated:false,requiresTechnicalSaleFK:true,pristineProof:'server-typed-raw-plan-and-fresh-CAS-not-a-Rules-object-hash'}};
}
module.exports={prepare};
