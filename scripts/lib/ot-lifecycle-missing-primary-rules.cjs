'use strict';
// Candidate-only transformation: no IO or deployment. Preserve all outer gates.
function prepare(input){
 const out=structuredClone(input),sales=out?.rules?.sisventas?.ventas;
 if(!sales)throw Error('Missing sales rules');
 const keys=Object.keys(sales).filter(k=>k.startsWith('$'));if(keys.length!==1)throw Error('Ambiguous sales wildcard');
 const key=keys[0],row=sales[key],ot="root.child('sisventas/ordenes_trabajo').child(auth.token.svOTLifecycleOTKey)",summary="root.child('sisventas/listados_resumen/ordenes_trabajo').child(auth.token.svOTLifecycleOTKey)",sale='data.parent()';
 const old="(data.parent().child('otId').val() === auth.token.svOTLifecycleOTKey || (root.child('sisventas/ordenes_trabajo').child(data.parent().child('otId').val()).child('ventaFbKey').val() === "+key+" && root.child('sisventas/ordenes_trabajo').child(data.parent().child('otId').val()).child('ventaId').val() === data.parent().child('id').val() && root.child('sisventas/listados_resumen/ordenes_trabajo').child(auth.token.svOTLifecycleOTKey).child('ventaFbKey').val() === "+key+"))";
 const missing=['otId','otFbKey','otKey','ordenTrabajoId','ordenTrabajoFbKey','ot','otNumero'].map(k=>"!"+sale+".child('"+k+"').exists()");
 const verified=missing.concat([
  ot+".child('id').isString()",ot+".child('id').val() !== ''",
  ot+".child('ventaId').val() === "+sale+".child('id').val()",
  summary+".child('id').val() === "+ot+".child('id').val()",
  summary+".child('ventaFbKey').val() === "+key,
  summary+".child('ventaId').val() === "+sale+".child('id').val()",
  summary+".child('_svListRevision').isNumber()",summary+".child('_svListRevision').val() > 0",
  summary+".child('_svListRevision').val() === "+ot+".child('_svListRevision').val()"
 ]).join(' && ');
 for(const field of ['estadoInst','audit']){
  const value=row[field]?.['.write'];
  if(typeof value!=='string'||value.split(old).length!==2||value.includes(verified)||!value.includes('svOTLifecycleVersion === 1'))throw Error('Unknown or already patched OT lifecycle grant');
  row[field]['.write']=value.replace(old,'(('+verified+') || '+old+')');
 }
 return out;
}
module.exports={prepare};
