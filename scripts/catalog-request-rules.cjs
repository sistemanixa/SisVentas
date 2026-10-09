'use strict';
function catalogRequestRules(){
 const admin="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && root.child('sv_chat_roles').child(auth.uid).child('rol').val() === 'admin'";
 const fields=['nombre','lista','telefono','email','contenido','creadaEn'];
 const same=fields.map(k=>"newData.child('"+k+"').val() === data.child('"+k+"').val()").join(' && ');
 const text=n=>({'.validate':'newData.isString() && newData.val().length <= '+n});
 return {sv_catalogo_solicitudes:{'.read':admin,'$id':{
 '.write':"$id.matches(/^[a-f0-9-]{36}$/) && newData.exists() && (!data.exists() || ("+same+"))",
 '.validate':"newData.hasChildren(['nombre','lista','telefono','email','contenido','creadaEn']) && (newData.child('telefono').val() !== '' || newData.child('email').val() !== '') && (data.exists() || (newData.child('creadaEn').val() <= now + 300000 && newData.child('creadaEn').val() >= now - 86400000))",
 nombre:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 100'},lista:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 100'},telefono:text(40),email:text(160),contenido:{'.validate':'newData.isString() && newData.val().length > 2 && newData.val().length <= 20000'},creadaEn:{'.validate':'newData.isNumber()'},'$otro':{'.validate':false}
 }},sv_catalogo_solicitudes_estado:{'.read':admin,'$id':{'.write':admin,'.validate':"newData.val() === 'pendiente' || newData.val() === 'atendida'"}}};
}
module.exports={catalogRequestRules};
