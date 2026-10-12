'use strict';
const FROM='nixa@sistemanixa.com';
function buildMessage(request,event,type){
 const email=String(request?.email||'').trim();
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))return null;
 if(!['confirmada','declinada'].includes(type))throw Error('Estado de correo inválido');
 const name=String(request.nombre||'').trim(),list=String(request.lista||'tu pedido').trim();
 const reason=String(event?.motivo||'No podemos completar tu pedido por falta de stock.').trim();
 return {from:FROM,to:email,subject:type==='confirmada'?'Confirmación de tu pedido · Nixa':'Respuesta a tu pedido · Nixa',text:'Hola '+name+',\n\n'+(type==='confirmada'?'Confirmamos la recepción y atención de tu pedido «'+list+'». Ya creamos la lista de compras para gestionarlo.':'No podemos completar tu pedido «'+list+'».\n\nMotivo: '+reason)+'\n\nGracias por comunicarte con Nixa.\nPodés responder este correo si tenés alguna consulta.',replyTo:FROM};
}
async function dispatch({db,id,type,event,send}){
 const state=db.ref('sv_catalogo_solicitudes_correo/'+id+'/'+type);
 const now=Date.now();
 const claimed=await state.transaction(old=>old?.estado==='enviado'||old?.estado==='sin_email'||(old?.estado==='enviando'&&now-Number(old.actualizadoEn||0)<600000)?undefined:{estado:'enviando',actualizadoEn:now});
 if(!claimed.committed){if(claimed.snapshot.val()?.estado==='enviando')throw Error('Correo en proceso');return;}
 try{const request=(await db.ref('sv_catalogo_solicitudes/'+id).get()).val();const message=buildMessage(request,event,type);
 if(!message){await state.set({estado:'sin_email',actualizadoEn:Date.now()});return;}
 const sent=await send(message);if(sent.rejected?.length||!sent.accepted?.length)throw Error('Destinatario no aceptado por SMTP');await state.set({estado:'enviado',actualizadoEn:Date.now(),messageId:String(sent.messageId||'')});
 }catch(error){await state.set({estado:'error',actualizadoEn:Date.now()});throw error;}
}
module.exports={buildMessage,dispatch};

