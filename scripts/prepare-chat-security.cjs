'use strict';
// Composición offline. No autentica ni escribe en Firebase.
const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()";
const active="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true";
const internal=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const {GUARD,rulesProtectPasswords}=require('../cotizador/password-policy');
const known=names=>'('+names.map(r=>role+" === '"+r+"'").join(' || ')+')';
function build(input){
 const out=structuredClone(input),r=out.rules;
 function restrict(node,condition){for(const [k,v]of Object.entries(node)){if(['.read','.write'].includes(k)&&typeof v==='string')node[k]='('+v+') && ('+condition+')';else if(v&&typeof v==='object')restrict(v,condition);}}
 for(const k of ['sv_permisos','sv_ia_reglas','sv_borradores'])restrict(r[k],active+' && '+known(internal));
 const chat=r.sv_chat.$canal;
 let access='('+chat['.read']+') && ('+active+' && '+known([...internal,'distribuidora'])+" && ("+role+" === 'distribuidora' || root.child('sv_permisos').child("+role+").child('acciones/dashboard/chat').val() !== false))";
 access=access.replaceAll("$canal.endsWith('_' + auth.uid)","($canal.beginsWith('directo_') && $canal.endsWith('_' + auth.uid))");
 chat['.read']=access;
 const name="root.child('sv_chat_directorio').child(auth.uid).child('nombre').val()";
 chat['.write']='('+access+") && !newData.exists() && "+role+" === 'admin' && root.child('sv_permisos/admin/acciones/chat/limpiar').val() !== false";
 const properties={autorUid:"newData.val() === auth.uid",autor:'newData.isString() && newData.val() === '+name,rol:'newData.val() === '+role,ts:'newData.isNumber() && newData.val() >= 0 && newData.val() <= now + 300000',canal:'newData.val() === $canal',texto:'newData.isString() && newData.val().length <= 10000',audioDuracion:'newData.isNumber() && newData.val() >= 0 && newData.val() <= 86400'};
 for(const k of ['fotoUrl','audioUrl','archivoUrl'])properties[k]="newData.isString() && newData.val().length <= 4000 && (newData.val() === '' || newData.val().matches(/^https:\\/\\/firebasestorage\\.googleapis\\.com\\/.*/))";
 for(const k of ['archivoNombre','archivoTipo','replyFbKey','replyAutor','replyTexto'])properties[k]='newData.isString() && newData.val().length <= 1000';
 const message=chat.$mensaje={'.write':'('+access+") && !data.exists() && newData.hasChildren(['autorUid','autor','rol','ts','canal','texto']) && !newData.child('leido').exists() && !newData.child('reacciones').exists()"};
 for(const [k,v]of Object.entries(properties))message[k]={'.validate':v};
 message.$other={'.validate':false};
 message.leido={$uid:{'.write':'('+access+") && $uid === auth.uid && data.parent().parent().exists() && newData.val() === true",'.validate':'newData.val() === true'}};
 // Editar, eliminar y reaccionar se resuelven transaccionalmente en servidor.
 message.reacciones={'.validate':false};
 r.sv_chat_escribiendo.$canal={'.read':access,'$uid':{'.write':'('+access+') && $uid === auth.uid','.validate':"newData.hasChildren(['nombre','ts'])",nombre:{'.validate':'newData.val() === '+name},ts:{'.validate':'newData.isNumber() && newData.val() >= now - 10000 && newData.val() <= now + 30000'},'$other':{'.validate':false}}};
 r.sv_chat_directorio['.read']='('+r.sv_chat_directorio['.read']+') && ('+active+' && '+known([...internal,'distribuidora'])+')';
 function guard(node){for(const[k,v]of Object.entries(node)){if(['.read','.write'].includes(k)&&typeof v==='string'&&v!=='false'&&!v.endsWith(' && '+GUARD))node[k]='('+v+') && '+GUARD;else if(v&&typeof v==='object')guard(v);}}
 guard(r);if(!rulesProtectPasswords(out))throw Error('Guard de acceso incompleto');
 return out;
}
module.exports={build};
