'use strict';
const Query=require('./client-history-query');
const PATH='/clientes/historial',CLIENT_PATH=PATH+'/cliente';
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
function create({access,read,query,resolveClient,enabled=false}={}){
 if(typeof access?.authorize!=='function'||typeof access?.readOriginal!=='function'||typeof read!=='function'||typeof query!=='function')throw TypeError('Faltan fuentes autorizadas del historial.');
 async function handle(req,body){
  const url=new URL(req.url,'http://local.invalid');
  if(![PATH,CLIENT_PATH].includes(url.pathname))throw fail(404,'Ruta inexistente.','SV_CLIENT_HISTORY_ROUTE');
  if(req.method!=='POST')throw fail(405,'Método no permitido.','SV_CLIENT_HISTORY_METHOD');
  if(url.search)throw fail(400,'La consulta no admite parámetros adicionales.','SV_CLIENT_HISTORY_QUERY');
  if(!enabled)throw fail(503,'El historial por cliente todavía no está habilitado.','SV_CLIENT_HISTORY_DISABLED');
  if(url.pathname===CLIENT_PATH){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||typeof body.clientKey!=='string'||!body.clientKey||body.clientKey.length>128||/[.#$\[\]\/\x00-\x1f\x7f]/.test(body.clientKey)||typeof resolveClient!=='function')throw fail(400,'Cliente inválido.','SV_CLIENT_HISTORY_CLIENT_INPUT');const result=await resolveClient(req,body.clientKey);return {statusCode:200,headers:{'Cache-Control':'private, no-store','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff'},body:{ok:true,...result}};}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['accountId','domain','address','cursor','expectedRevision','expectedGeneration','expectedSnapshotRevision'].includes(key)))throw fail(400,'Consulta inválida.','SV_CLIENT_HISTORY_INPUT');
  const reader=Query.create({read,query,trustedAuthorize:()=>access.authorize(req),readOriginal:(domain,key,context)=>access.readOriginal(domain,key,context),...(typeof access.readHistoryOriginal==='function'?{readHistoryOriginal:(...args)=>access.readHistoryOriginal(...args),verifyHistoryOriginal:(...args)=>access.verifyHistoryOriginal(...args)}:{})});
  const result=await reader.page(body);
  return {statusCode:200,headers:{'Cache-Control':'private, no-store','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff'},body:{ok:true,...result}};
 }
 return {handle,path:PATH,enabled:enabled===true};
}
module.exports={create,PATH,CLIENT_PATH};
