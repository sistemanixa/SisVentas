'use strict';
function catalogRequestRules(){
 const admin="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && root.child('sv_chat_roles').child(auth.uid).child('rol').val() === 'admin'";
 let inbox="("+admin+") || (auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true && root.child('sv_chat_roles').child(auth.uid).child('rol').val() === 'distribuidora' && root.child('sv_distribuidora_permisos/solicitudes').val() === true)";
 inbox='('+inbox+') || ('+require('./distribuidora-menu-rules.cjs').grant+')';
 const fields=['nombre','lista','telefono','email','contenido','creadaEn'];
 const same=fields.map(k=>"newData.child('"+k+"').val() === data.child('"+k+"').val()").join(' && ');
 const text=n=>({'.validate':'newData.isString() && newData.val().length <= '+n});
 return {sv_catalogo_solicitudes_atencion:{'.read':inbox,'$id':{
 '.write':'('+inbox+") && !data.exists() && newData.exists() && root.child('sv_catalogo_solicitudes').child($id).exists()",
 '.validate':"newData.hasChildren(['fecha','uid','usuario','lista']) && newData.child('uid').val() === auth.uid && newData.child('lista').val() === 'solicitud_'+$id && !root.child('sv_listas_paraguay').child(auth.uid).child(newData.child('lista').val()).exists() && newData.parent().parent().child('sv_listas_paraguay').child(auth.uid).child(newData.child('lista').val()).exists() && newData.parent().parent().child('sv_catalogo_solicitudes_estado').child($id).val() === 'atendida'",
 fecha:{'.validate':'newData.isNumber() && newData.val() === now'},uid:text(128),usuario:text(200),lista:text(100),'$other':{'.validate':false}
 }},sv_catalogo_solicitudes_edicion:{'.read':inbox,'$id':{'$index':{'.write':'('+inbox+") && root.child('sv_catalogo_solicitudes').child($id).exists() && $index.matches(/^(0|[1-9]|[1-3][0-9])$/)",cantidad:{'.validate':'newData.isNumber() && newData.val() >= 1 && newData.val() <= 999 && newData.val() % 1 === 0'},precioUSD:{'.validate':'data.exists() && newData.val() === data.val()'},eliminado:{'.validate':'newData.isBoolean()'},'$other':{'.validate':false}}}},sv_catalogo_solicitudes:{'.read':inbox,'$id':{
 '.write':"$id.matches(/^[a-f0-9-]{36}$/) && newData.exists() && (!data.exists() || ("+same+"))",
 '.validate':"newData.hasChildren(['nombre','lista','telefono','email','contenido','creadaEn']) && (newData.child('telefono').val() !== '' || newData.child('email').val() !== '') && (data.exists() || (newData.child('creadaEn').val() <= now + 300000 && newData.child('creadaEn').val() >= now - 86400000))",
 nombre:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 100'},lista:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 100'},telefono:text(40),email:text(160),contenido:{'.validate':'newData.isString() && newData.val().length > 2 && newData.val().length <= 20000'},creadaEn:{'.validate':'newData.isNumber()'},'$otro':{'.validate':false}
 }},sv_catalogo_solicitudes_estado:{'.read':inbox,'$id':{'.write':inbox,'.validate':"newData.val() === 'pendiente' || newData.val() === 'atendida'"}}};
}
module.exports={catalogRequestRules};
