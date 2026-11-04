'use strict';
const {createOTDeleteCommand}=require('./ot-delete-command');
const PATH='/operaciones/ot/eliminar';
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
function createOTDeleteHttpAdapter({authorize,guard,store,enabled=false}){
 if(typeof authorize!=='function'||!guard?.run||!store?.read)throw TypeError('Falta autoridad de OT.');
 const capability=()=>enabled===true&&guard.clientHistory===true&&store.otDeleteFenceReady===true;
 async function handle(req,body){
  const url=new URL(req.url,'http://fixture.invalid');
  if(url.pathname!==PATH)throw fail(404,'Ruta inexistente.','SV_OT_DELETE_ROUTE');
  if(req.method!=='POST')throw fail(405,'Método no permitido.','SV_OT_DELETE_METHOD');
  if(url.search||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(name=>!['id','otKey','expectedHash'].includes(name))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id||'')||typeof body.otKey!=='string'||!body.otKey||Buffer.byteLength(body.otKey)>768||['__proto__','constructor','prototype'].includes(body.otKey)||/[.#$\[\]/\x00-\x1f\x7f]/.test(body.otKey)||!/^[a-f0-9]{64}$/.test(body.expectedHash||''))throw fail(400,'Solicitud de OT inválida.','SV_OT_DELETE_INPUT');
  if(!capability())throw fail(503,'La eliminación protegida de OT todavía no está habilitada.','SV_OT_DELETE_UNAVAILABLE');
  const actor=await authorize(req),verifyActor=async expected=>{const fresh=await authorize(req);if(!fresh?.uid||fresh.uid!==expected.uid||fresh.claims?.uid!==expected.uid||fresh.viewing||fresh.realUid&&fresh.realUid!==fresh.uid)throw fail(403,'La sesión cambió.','SV_OT_DELETE_AUTH');};
  const result=await createOTDeleteCommand({guard,store,verifyActor,enabled}).execute(actor,body);
  if(result?.ok!==true||result.otKey!==body.otKey)throw fail(503,'Consultá la operación antes de repetirla.','SV_OT_DELETE_UNCONFIRMED');
  return {ok:true,committed:true,otKey:body.otKey};
 }
 return {handle,capability,path:PATH};
}
module.exports={createOTDeleteHttpAdapter,PATH};
