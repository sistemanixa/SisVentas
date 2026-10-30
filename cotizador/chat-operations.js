'use strict';
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const internal=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
const emojis=['👍','❤️','😂','😮','😢','🙏'];
const key=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,240}$/.test(x);
const safeName=x=>String(x||'').replace(/[.#$[\]/\s]/g,'_');
function createChatOperations({auth,db,enabled=false,now=Date.now,headerStore=null}){
 const read=async path=>(await db.ref(path).get()).val();
 async function authorize(req,channel){
  const match=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!match)throw fail(401,'Sesión requerida');
  let token;try{token=await auth.verifyIdToken(match[1],true);}catch(_){throw fail(401,'Sesión inválida');}
  if(!enabled)throw fail(503,'Las acciones protegidas del chat todavía no están habilitadas');
  if(!key(token.uid)||!key(channel))throw fail(400,'Conversación inválida');
  const [identity,directory]=await Promise.all([read('sv_chat_roles/'+token.uid),read('sv_chat_directorio')]);
  const role=identity?.rol;if(identity?.activo!==true||![...internal,'distribuidora'].includes(role)||directory?.[token.uid]?.activo===false||!directory?.[token.uid]?.nombre)throw fail(403,'Acceso al chat inactivo');
  if(role==='distribuidora'&&(await read('sv_distribuidora_permisos/chat'))===false)throw fail(403,'Chat no habilitado');
  if(internal.includes(role)&&(await read('sv_permisos/'+role+'/acciones/dashboard/chat'))===false)throw fail(403,'Chat no habilitado para tu rol');
  let allowed=channel==='general'||channel==='admin'&&['admin','administrativo','vendedor','tecnico_vendedor'].includes(role)||channel==='tecnicos'&&['admin','tecnico','tecnico_vendedor'].includes(role)||channel.startsWith('archivo_')&&role==='admin';
  if(channel.startsWith('directo_'))allowed=Object.keys(directory||{}).some(uid=>uid!==token.uid&&channel==='directo_'+[uid,token.uid].sort().join('_'));
  if(!allowed)throw fail(403,'No tenés acceso a esta conversación');
  return {uid:token.uid,role,name:directory[token.uid].nombre,directory,channel,claims:token};
 }
 async function modify(actor,body){
  if(!key(body.key)||!['editar','eliminar','reaccion'].includes(body.action))throw fail(400,'Acción inválida');
  if(body.action==='editar'&&(typeof body.texto!=='string'||!body.texto.trim()||body.texto.length>10000||typeof body.expectedText!=='string'))throw fail(400,'Texto inválido');
  if(body.action==='reaccion'&&(!emojis.includes(body.emoji)||typeof body.remove!=='boolean'))throw fail(400,'Reacción inválida');
  if(headerStore?.ready&&!await headerStore.ready())throw fail(503,'El chat está actualizándose. Volvé a intentar en unos minutos.');
  let legacyUnique=false;
  if(body.action!=='reaccion'){
   // Los mensajes antiguos no tenían UID: no se reescribe su autoría. Solo
   // conservar la edición histórica cuando el nombre protegido es inequívoco.
   legacyUnique=Object.values(actor.directory).filter(p=>p.nombre===actor.name).length===1;
  }
  let reason='El mensaje cambió. Volvé a revisarlo.';
  const target=db.ref('sv_chat/'+actor.channel+'/'+body.key);
  const initial=await target.get();
  const transform=m=>{
   // Admin SDK puede invocar primero con caché vacía. Devolver null solicita
   // la comparación del servidor; abortar con undefined perdería la operación.
   if(!m)return null;
   if(m.eliminado){reason='El mensaje ya no está disponible';return;}
   if(body.action==='reaccion'){
    const reactions={...m.reacciones};if(body.remove){if(reactions[actor.uid]?.emoji===body.emoji)delete reactions[actor.uid];}
    else reactions[actor.uid]={emoji:body.emoji,nombre:actor.name};
    return {...m,reacciones:reactions};
   }
   const own=m.autorUid?m.autorUid===actor.uid:legacyUnique&&m.autor===actor.name&&m.rol===actor.role;
   if(!own){reason='Solo el autor puede modificar el mensaje';return;}
   if(body.action==='editar'){
    if(typeof m.texto!=='string'||!m.texto||m.texto!==body.expectedText)return;
    return {...m,texto:body.texto.trim(),editadoEn:now(),editadoPorUid:actor.uid};
   }
   if(Object.entries(m.leido||{}).some(([uid,v])=>v&&![actor.uid,actor.name,safeName(actor.name)].includes(uid))){reason='El mensaje ya fue leído; podés editarlo';return;}
   return {...m,texto:'Mensaje eliminado',eliminado:true,fotoUrl:null,audioUrl:null,archivoUrl:null,eliminadoEn:now(),eliminadoPorUid:actor.uid};
  };
  if(headerStore&&body.action!=='reaccion'){
   const before=initial.val(),after=transform(before);
   if(!before||!after)throw fail(409,reason);
   await headerStore.commit(actor,body,before,after,legacyUnique);
   return {committed:true};
  }
  const tx=await target.transaction(transform);
  if(!tx.committed||!tx.snapshot.val())throw fail(409,reason);return {committed:true};
 }
 return {authorize,modify};
}
module.exports={createChatOperations};
