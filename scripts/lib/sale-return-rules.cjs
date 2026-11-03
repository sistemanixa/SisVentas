'use strict';
// Local candidate only. It never reads or applies remote rules.
const {fence,userActor}=require('../../cotizador/labor-fence-policy');
function build(input){
 const out=structuredClone(input),rules=out?.rules,sales=rules?.sisventas?.ventas,node=sales?.$venta;
 if(!node||typeof node['.write']!=='string'||![undefined,false,'false'].includes(rules['.write'])||![undefined,false,'false'].includes(rules.sisventas['.write']))throw Error('Revisar las reglas comerciales y sus padres.');
 const profile="root.child('sv_chat_roles').child(auth.uid)",cfg="root.child('sv_permisos').child(auth.token.svFinancialActorRole)",destination="newData.parent().parent().child('presupuestos').child('desde_venta_' + $venta)";
 const access="auth.token.svFinancialAction === 'ventas.moverPresupuesto' && "+profile+".child('activo').val() === true && "+profile+".child('rol').val() === auth.token.svFinancialActorRole && "+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceRevision').val() === auth.token.svFinancialPermissionRevision && "+cfg+".child('indiceModulos/venta').val() === true && "+cfg+".child('indiceModulos/presupuesto').val() === true && "+cfg+".child('acciones/ventas/moverPresupuesto').val() === true && auth.token.svPasswordChangeRequired !== true && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && (!root.child('sv_access_resets').child(auth.uid).child('version').exists() || auth.token.svAccessVersion === root.child('sv_access_resets').child(auth.uid).child('version').val())";
 const pair="data.exists() && !newData.exists() && data.child('responsableUid').val() === auth.uid && !root.child('sisventas/presupuestos').child('desde_venta_' + $venta).exists() && "+destination+".exists() && "+destination+".child('ventaOrigenFbKey').val() === $venta && "+destination+".child('responsableUid').val() === auth.uid && "+destination+".child('total').val() === data.child('total').val() && "+destination+".child('subtotal').val() === data.child('subtotal').val() && "+destination+".child('descuento').val() === data.child('descuento').val() && "+destination+".child('iva').val() === data.child('iva').val()";
 const addition='('+fence(3,userActor)+' && '+access+' && '+pair+')';
 if(!node['.write'].endsWith(' || '+addition))node['.write']='('+node['.write']+') || '+addition;
 return out;
}
module.exports={build};
