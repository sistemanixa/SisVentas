'use strict';
// Fictitious permissions only. No production snapshot, real UID or secret.
const {metadataRules}=require('../../cotizador/labor-fence-policy');
module.exports=function(){
 const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()";
 const active="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && (!root.child('sv_access_resets').child(auth.uid).exists() || (root.child('sv_access_resets').child(auth.uid).child('required').val() === false && root.child('sv_access_resets').child(auth.uid).child('version').val() === auth.token.svAccessVersion))";
 const write='('+active+") && ("+role+" === 'admin' || "+role+" === 'administrativo' || "+role+" === 'tecnico')";
 return {rules:{'.read':false,'.write':false,...metadataRules(),sisventas:{'.read':false,'.write':false,equipos:{'.read':active,'.write':write},garantias:{'.read':active,'.write':write},ordenes_trabajo:{'.read':active,'.write':write},ordenesTrabajo:{'.read':active,'.write':write},ventas:{'.read':false,'.write':false},gastos:{'.write':false},pagos:{'.write':false},ctaemp:{'.write':false}},sv_chat_roles:{'.write':false},sv_permisos:{'.write':false},sv_access_resets:{'.write':false}}};
};
