'use strict';
const {affected,parts,digest}=require('./labor-guard');
const {flatten}=require('./labor-db');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const forbidden=path=>/^(sv_labor_[^/]*|sv_commission_generation|sv_commission_events)(\/|$)/.test(path);
function validate(value,depth=0){
 if(depth>30||value===undefined||typeof value==='number'&&!Number.isFinite(value)||!['object','string','number','boolean'].includes(typeof value))throw fail(400,'Datos de guardado inválidos');
 if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){parts(key);validate(child,depth+1);}
}
function specific(path){
 parts(path);if(['sisventas','sisventas/config'].includes(path)||forbidden(path))throw fail(400,'Esta operación requiere guardar registros individuales');
}
function createLaborWriteGateway({auth,db,guard,store,enabled=false}){
 async function authorize(req){
  if(!enabled)throw fail(503,'El nuevo circuito todavía no está habilitado');
  if(req.method!=='POST')throw fail(405,'Método no permitido');
  if(new URL(req.url,'http://localhost').searchParams.has('verComo'))throw fail(403,'Volvé a tu cuenta para guardar');
  const match=String(req.headers?.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!match)throw fail(401,'Sesión requerida');
  let identity;try{identity=await auth.verifyIdToken(match[1],true);}catch(_){throw fail(401,'La sesión venció; volvé a ingresar');}
  const role=(await db.ref('sv_chat_roles/'+identity.uid).get()).val();
  if(role?.activo!==true||!['admin','administrativo','vendedor','tecnico','tecnico_vendedor','distribuidor'].includes(role.rol))throw fail(403,'Usuario sin acceso');
  return {uid:identity.uid,claims:identity};
 }
 async function write(actor,body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['id','kind','path','value','expectedHash','expectedHashes'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id)||!['set','patch','compare','atomic'].includes(body.kind)||typeof body.path!=='string')throw fail(400,'Solicitud de guardado inválida');
  if(!actor?.uid||!actor.claims||actor.claims.uid!==actor.uid)throw fail(403,'Sesión requerida');
  if(Buffer.byteLength(JSON.stringify(body))>16*1024*1024)throw fail(413,'El guardado supera el tamaño permitido');
  let patch;
  if(['patch','atomic'].includes(body.kind)){
   if(body.expectedHash!==undefined)throw fail(400,'Comparación inválida');
   if(body.path)parts(body.path);patch=flatten(body.path,body.value);
   if(!Object.keys(patch).length||Object.keys(patch).length>10000)throw fail(400,'Cambios de guardado inválidos');
   for(const [path,value]of Object.entries(patch)){specific(path);validate(value);}
   if(!Object.keys(patch).some(affected))throw fail(400,'La operación no pertenece a este circuito');
  }else{specific(body.path);if(!affected(body.path))throw fail(400,'La operación no pertenece a este circuito');validate(body.value);patch={[body.path]:body.value};}
  if(body.kind==='compare'&&!/^[a-f0-9]{64}$/.test(body.expectedHash))throw fail(400,'Falta verificar la versión del registro');
  if(body.kind!=='atomic'&&body.expectedHashes!==undefined)throw fail(400,'Comparación inválida');
  const expected=body.kind==='compare'?{[body.path]:body.expectedHash}:body.kind==='atomic'?body.expectedHashes:{};
  if(body.kind==='atomic'){
   if(!expected||typeof expected!=='object'||Array.isArray(expected)||!Object.keys(expected).length||Object.keys(expected).length>128)throw fail(400,'Comparación de registros inválida');
   for(const [path,hash]of Object.entries(expected)){specific(path);if(!/^[a-f0-9]{64}$/.test(hash))throw fail(400,'Comparación de registros inválida');}
   for(const path of Object.keys(patch))if(affected(path)&&!Object.keys(expected).some(base=>path===base||path.startsWith(base+'/')))throw fail(400,'Falta verificar un registro del guardado');
  }
  const result=await guard.run({uid:actor.uid,claims:actor.claims,mode:'user',opId:body.id,transportDigest:digest(body),operation:'legacy-'+body.kind,input:body},async scope=>{
   for(const [path,hash]of Object.entries(expected)){
    // La lectura conserva el permiso del usuario, además del control de escritura
    // evaluado por Firebase para el PATCH final, nunca un resultado Admin público.
    const current=await store.readAsUser(path,actor);
    if(digest(current)!==hash)throw fail(409,'El registro cambió. Se volverá a comprobar.','SV_CAS_CONFLICT');
   }
   await scope.update(patch);
   return {ok:true,committed:true};
  });
  // El recibo guarda sólo la confirmación. No duplica ventas ni adjuntos; el
  // digest ya verifica que un replay corresponde al mismo valor solicitado.
  return {...result,...(body.kind==='compare'?{value:body.value}:{})};
 }
 async function resolve(actor,body){
  if(!actor?.uid||actor.claims?.uid!==actor.uid)throw fail(403,'Sesión requerida');
  if(!body||Object.keys(body).some(k=>!['id','digest'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(body.id)||!/^[a-f0-9]{64}$/.test(body.digest))throw fail(400,'Identificador de comprobación inválido');
  try{
   // Reservar el MISMO intento antes de declararlo rechazado. Si una petición
   // demorada llega después, encuentra este recibo y no puede volver a guardar.
   const result=await guard.run({uid:actor.uid,claims:actor.claims,mode:'user',opId:body.id,transportDigest:body.digest,operation:'resolve'},async()=>({ok:false,committed:false,code:'SV_LABOR_CANCELLED',mensaje:'El intento no se guardó. Podés volver a intentarlo.'}));
   return {ok:true,status:result.ok===true&&result.committed===true?'confirmed':'rejected'};
  }catch(error){if(error.statusCode===423)return {ok:true,status:'pending'};throw error;}
 }
 return {authorize,write,resolve};
}
module.exports={createLaborWriteGateway,validate,specific};
