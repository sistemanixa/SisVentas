'use strict';
const ROUTES=Object.freeze({'/recursos-empleados/indumentaria':'clothing','/recursos-empleados/categorias':'categories'});
function create({service,readBody,send}){
 if(!service||typeof readBody!=='function'||typeof send!=='function')throw Error('Falta conectar el transporte laboral.');
 return async function handle(req,res){const url=new URL(req.url,'http://localhost'),domain=ROUTES[url.pathname];if(!domain)return false;
  res.setHeader('Cache-Control','private, no-store');
  try{if(!['GET','POST'].includes(req.method)||[...url.searchParams.keys()].some(k=>!['employeeId','cursor','query','revision'].includes(k)||url.searchParams.getAll(k).length!==1)||req.method==='POST'&&url.searchParams.size||domain==='categories'&&url.searchParams.size)throw Object.assign(Error('Solicitud inválida.'),{statusCode:400});const actor=await service.authorize({...req,method:'POST',url:req.url,headers:req.headers});let result;
   if(req.method==='GET')result=await service.read(actor,domain,Object.fromEntries(url.searchParams));else{const body=await readBody(req,65536);if(body.domain!==undefined&&body.domain!==domain)throw Object.assign(Error('Sección inválida.'),{statusCode:400});result=await service.execute(actor,{...body,domain});}send(res,200,{ok:true,...result});
  }catch(e){send(res,e.statusCode||503,{ok:false,code:e.code,mensaje:e.statusCode?e.message:'No se pudo confirmar la operación.'});}return true;
 };
}
module.exports={create,ROUTES};
