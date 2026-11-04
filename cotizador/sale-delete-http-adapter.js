'use strict';
const {createSaleDeleteCommand}=require('./sale-delete-command');
const Fence=require('./sale-delete-fence');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const PATH='/comerciales/ventas/eliminar';
function createSaleDeleteHttpAdapter({authorize,guard,store,enabled=false,now}={}){
 if(typeof authorize!=='function'||!guard?.run||!store?.read)throw TypeError('Falta autorización o guard compartido.');
 async function handle(req,body){
  const url=new URL(req.url,'http://local.invalid');
  if(url.pathname!==PATH)throw fail(404,'Ruta inexistente','SV_SALE_DELETE_ROUTE');
  if(req.method!=='POST')throw fail(405,'Método no permitido','SV_SALE_DELETE_METHOD');
  if(url.search)throw fail(400,'La eliminación no admite parámetros de consulta','SV_SALE_DELETE_QUERY');
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(field=>!['id','ventaKey','expectedHash'].includes(field))||!/^[a-f0-9]{64}$/.test(body.expectedHash||'')||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id||'')||typeof body.ventaKey!=='string'||!body.ventaKey||Buffer.byteLength(body.ventaKey)>768||/[.#$\[\]/\x00-\x1f\x7f]/.test(body.ventaKey))throw fail(400,'Solicitud de eliminación inválida','SV_SALE_DELETE_INPUT');
  Fence.assertReady(guard,store);
  const actor=await authorize(req);
  const verifyActor=async expected=>{
   const fresh=await authorize(req);
   if(!fresh?.uid||fresh.uid!==expected.uid||fresh.claims?.uid!==expected.uid||fresh.viewing||fresh.realUid&&fresh.realUid!==fresh.uid||fresh.claims.svPasswordChangeRequired)throw fail(403,'La sesión cambió. Consultá la operación antes de repetirla.','SV_SALE_DELETE_AUTH');
  };
  const command=createSaleDeleteCommand({guard,store,enabled,now,verifyActor});
  const result=await command.execute(actor,{id:body.id,ventaKey:body.ventaKey,expectedHash:body.expectedHash});
  return {statusCode:200,headers:{'Cache-Control':'private, no-store'},body:{ok:true,committed:result.committed===true,operationId:body.id,ventaKey:body.ventaKey}};
 }
 return {handle,path:PATH,capability:()=>enabled===true&&Fence.ready(guard,store)};
}
module.exports={createSaleDeleteHttpAdapter,PATH};
