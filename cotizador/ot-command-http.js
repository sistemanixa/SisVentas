'use strict';
const MetadataPolicy=require('./ot-metadata-policy'),Warehouse=require('./ot-warehouse-receipt');
function create({authorize,metadata,structure,inventory,readBody,send}){
 return async function handle(path,req,res){
  if(!['/ot/metadata','/ot/metadata/disponible','/ot/inventario','/ot/inventario/disponible'].includes(path))return false;
  res.setHeader('Cache-Control','private, no-store');const available=path.endsWith('/disponible');
  try{
   if(req.method!==(available?'GET':'POST'))throw Object.assign(Error('Método no permitido.'),{statusCode:405,svLaborAttempted:false});
   const url=new URL(req.url,'http://localhost');
   if([...url.searchParams.keys()].some(key=>!available||!['otKey','kind'].includes(key)||url.searchParams.getAll(key).length!==1))throw Object.assign(Error('Solicitud inválida.'),{statusCode:400,svLaborAttempted:false});
   const actor=await authorize({...req,method:'POST',headers:req.headers,url:req.url});
   const body=available?Object.fromEntries(url.searchParams):await readBody(req,2*1024*1024);
   const service=path.startsWith('/ot/inventario')?inventory:MetadataPolicy.structureKinds.includes(body?.kind)?structure:metadata;
   send(res,200,await service[available?'available':'execute'](actor,body));
  }catch(error){send(res,error.statusCode||503,{ok:false,mensaje:error.statusCode?error.message:'No se pudo confirmar el guardado. Consultá su estado antes de repetirlo.',...(error.code?{code:error.code}:{}),...(error.svLaborAttempted===false?{svLaborAttempted:false}:{}),...Warehouse.errorDetails(error)});}
  return true;
 };
}
module.exports={create};
