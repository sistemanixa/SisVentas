'use strict';
// Revision-local admission switch. Only absent or exact "false" means open.
function isPaused(value){return value!==undefined&&value!=='false';}
function allowsPausedRead(pathname){return ['/laboral/capacidades','/clientes/historial','/clientes/historial/cliente'].includes(pathname);}
function inventoryCapabilities(state,paused){
 if(!state||state.version!==1||typeof state.installed!=='boolean'||typeof state.ready!=='boolean'||state.ready&&!state.installed||!state.commands||typeof state.commands!=='object'||Array.isArray(state.commands)||Object.values(state.commands).some(value=>typeof value!=='boolean'))throw Object.assign(Error('No se pudo verificar el circuito de inventario.'),{statusCode:503});
 return paused?{...state,ready:false,commands:Object.fromEntries(Object.keys(state.commands).map(key=>[key,false]))}:state;
}
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
async function resolveReadOnly({gateway,read,req,body}){
 const actor=await gateway.authorize(req);
 if(!actor?.uid||actor.claims?.uid!==actor.uid)throw fail(403,'Sesión requerida');
 if(actor.viewing||actor._viewAs||actor.realUid!==undefined&&actor.realUid!==actor.uid)throw fail(403,'Volvé a tu cuenta para consultar el intento');
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['id','digest'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id)||!/^[a-f0-9]{64}$/.test(body.digest))throw fail(400,'Identificador de comprobación inválido');
 const receipt=await read('sv_labor_receipts/'+body.id);
 if(!receipt)return {ok:true,status:'pending'};
 if(receipt.actorUid!==actor.uid||receipt.digest!==body.digest)throw fail(409,'El identificador corresponde a otra operación');
 if(receipt.result?.ok===true&&receipt.result?.committed===true)return {ok:true,status:'confirmed'};
 if(receipt.result?.ok===false&&receipt.result?.committed===false)return {ok:true,status:'rejected'};
 return {ok:true,status:'pending'};
}
module.exports={isPaused,allowsPausedRead,inventoryCapabilities,resolveReadOnly};
