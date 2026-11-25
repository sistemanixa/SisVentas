'use strict';
const {digest,put}=require('./labor-guard'),Materials=require('./ot-material-edit-policy'),Assigned=require('./ot-personal-scope');
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
const fail=()=>Object.assign(Error('La corrección de materiales requiere sus fuentes y permisos vigentes.'),{statusCode:403,code:'SV_OT_MATERIAL_NATIVE_AUTHORITY'});
function describe(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(field=>!['id','kind','path','purpose','value','expectedHashes'].includes(field))||!key(body.id)||body.id.length<8||body.kind!=='atomic'||body.path!==''||body.purpose!==Materials.PURPOSE||!body.value||typeof body.value!=='object'||Array.isArray(body.value)||!body.expectedHashes||typeof body.expectedHashes!=='object'||Array.isArray(body.expectedHashes))throw fail();
 const expected=Object.keys(body.expectedHashes),ots=expected.filter(path=>/^sisventas\/ordenes_trabajo\/[A-Za-z0-9_-]+$/.test(path)),sales=expected.filter(path=>/^sisventas\/ventas\/[A-Za-z0-9_-]+$/.test(path));if(expected.length!==2||ots.length!==1||sales.length!==1||expected.some(path=>!/^[a-f0-9]{64}$/.test(body.expectedHashes[path])))throw fail();
 const otKey=ots[0].split('/')[2],saleKey=sales[0].split('/')[2];if(!key(otKey)||!key(saleKey))throw fail();
 for(const path of Object.keys(body.value))if(![ots[0]+'/materiales',ots[0]+'/audit',ots[0]+'/ventasAdicionales/'+saleKey].includes(path)&&path!==sales[0]&&!path.startsWith(sales[0]+'/')&&!/^sisventas\/notificaciones_admin\/[A-Za-z0-9_-]+$/.test(path))throw fail();
 return {otKey,saleKey,otPath:ots[0],salePath:sales[0]};
}
function accessReset(actor,reset){if(actor?.viewing||actor?.claims?.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims?.svAccessVersion)throw fail();}
async function assigned(ot,actor,profile,read,query){
 if(!['tecnico','tecnico_vendedor'].includes(profile.rol))return;
 const binding=await read('sv_empleado_uid/'+actor.uid),account=key(binding?.perfilFbKey)?await read('sv_usuarios/'+binding.perfilFbKey):null;if(!account||account.uid!==actor.uid||account.activo===false||!key(account.empleadoFbKey))throw fail();
 const employee=await read('sisventas/empleados/'+account.empleadoFbKey);if(!employee||employee.activo===false)throw fail();
 const keyed=['tecnicoFbKey','empleadoFbKey','tecnicoKey'].some(field=>ot[field]!=null&&String(ot[field]).trim());let directory={};if(!keyed){if(typeof query!=='function'||!employee.nombre)throw fail();directory=await query('sisventas/empleados','nombre',employee.nombre);}
 if(!Assigned.assigned(ot,{...employee,fbKey:account.empleadoFbKey},Object.fromEntries(Object.entries(directory||{}).map(([id,value])=>[id,{...value,fbKey:id}]))))throw fail();
}
async function prepare({actor,lease,body,patch,scope,now=Date.now}){
 const descriptor=describe(body);if(typeof scope?.get!=='function'||typeof scope?.getAsUser!=='function'||typeof scope?.beforeCommit!=='function')throw fail();
 const cache=new Map(),read=(path,user=false)=>{const id=JSON.stringify([path,user]);if(!cache.has(id))cache.set(id,Promise.resolve().then(()=>user?scope.getAsUser(path):scope.get(path)));return cache.get(id);};
 const [profile,ot,reset,originalSale]=await Promise.all([read('sv_chat_roles/'+actor.uid),read(descriptor.otPath,true),read('sv_access_resets/'+actor.uid),read(descriptor.salePath,true)]);accessReset(actor,reset);Materials.authority(profile,await read('sv_permisos/'+profile?.rol));if(!ot||digest(ot)!==body.expectedHashes[descriptor.otPath])throw fail();
 if(descriptor.saleKey===ot.ventaFbKey?!originalSale:originalSale!==null)throw fail();
 await assigned(ot,actor,profile,path=>read(path),scope.query?scope.query.bind(scope):undefined);
 const prepared=await Materials.prepare({actor,lease,body,patch,scope:{...scope,get:path=>read(path),getAsUser:path=>read(path,true)},now});
 if(prepared.otKey!==descriptor.otKey||prepared.saleKey!==descriptor.saleKey)throw fail();
 scope.beforeCommit(async({readFresh,readFreshAsUser,queryFresh})=>{
  const current=await readFresh('sv_chat_roles/'+actor.uid);Materials.authority(current,await readFresh('sv_permisos/'+current?.rol));if(current.rol!==profile.rol)throw fail();accessReset(actor,await readFresh('sv_access_resets/'+actor.uid));
  const original=await readFreshAsUser(descriptor.otPath);if(digest(original)!==body.expectedHashes[descriptor.otPath])throw fail();await assigned(original,actor,current,readFresh,queryFresh);
  if(lease.expiresAt<=now())throw fail();
 });
 let canonicalOT=structuredClone(ot);for(const [path,value]of Object.entries(prepared.plan.related))canonicalOT=put(canonicalOT,path.slice(descriptor.otPath.length+1).split('/'),value);
 return {patch:prepared.patch,otKey:prepared.otKey,canonicalOT};
}
module.exports={PURPOSE:Materials.PURPOSE,prepare,describe};
