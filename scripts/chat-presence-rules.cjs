'use strict';
function chatPresenceRules(){
 const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()",active="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true";
 const can=active+" && ("+role+" === 'admin' || "+role+" === 'administrativo' || "+role+" === 'vendedor' || "+role+" === 'tecnico' || "+role+" === 'tecnico_vendedor' || ("+role+" === 'distribuidora' && root.child('sv_distribuidora_permisos/chat').val() === true))";
 return {'.read':can,'$uid':{'$session':{'.write':"auth != null && auth.uid === $uid && (!newData.exists() || ("+can+"))",'.validate':"newData.hasChildren(['uid','nombre','rol','online','ultimaConexion'])",uid:{'.validate':'newData.val() === auth.uid'},nombre:{'.validate':"newData.isString() && newData.val() === root.child('sv_chat_directorio').child(auth.uid).child('nombre').val()"},rol:{'.validate':'newData.val() === '+role},online:{'.validate':'newData.val() === true'},ultimaConexion:{'.validate':'newData.isNumber() && newData.val() <= now + 30000 && newData.val() >= now - 300000'},'$other':{'.validate':false}}}};
}
module.exports={chatPresenceRules};
