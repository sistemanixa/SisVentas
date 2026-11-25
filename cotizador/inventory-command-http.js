'use strict';
// Routing only: domain commands retain authentication, admission and fresh CAS.
function create({purchase,link,stock,readBody,send}){
 const purchases=new Map(purchase.routes.map(route=>[route.path,route]));
 const links=new Map([['/stock-oficina/vinculo/vista-previa','preview'],['/stock-oficina/vinculo/guardar','execute'],['/stock-oficina/vinculo/estado','recover']]);
 return async function handle(path,req,res){
  if(!purchases.has(path)&&!links.has(path)&&path!=='/stock-oficina/identidad')return false;
  res.setHeader('Cache-Control','private, no-store');
  try{
   if(req.method!=='POST')throw Object.assign(Error('Método no permitido.'),{statusCode:405,svLaborAttempted:false});
   if(purchases.has(path)){const body=await readBody(req,purchases.get(path).maxBytes);send(res,200,await purchase.handle(path,req,body));}
   else if(links.has(path)){const actor=await link.authorize(req),body=await readBody(req,4096);send(res,200,await link[links.get(path)](actor,body));}
   else{const actor=await stock.authorize(req),body=await readBody(req,4096);send(res,200,{ok:true,result:await stock.lookupInventory(actor,body)});}
  }catch(error){send(res,error.statusCode||503,{ok:false,mensaje:error.statusCode?error.message:'No se pudo confirmar la operación. Consultá la operación antes de repetirla.',...(error.code?{code:error.code}:{}),...(error.svLaborAttempted===false?{svLaborAttempted:false}:{})});}
  return true;
 };
}
module.exports={create};
