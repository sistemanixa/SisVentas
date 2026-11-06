'use strict';
const crypto=require('node:crypto');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const key=value=>typeof value==='string'&&value.length>0&&value.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
function create({auth,db,storage,bucketName,model=require('./budget-presentation-trial-model')}={}){
 const read=async path=>(await db.ref(path).get()).val();
 async function authorize(req){
  const bearer=String(req.headers?.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!bearer)throw fail(401,'Iniciá sesión nuevamente.');
  let token;try{token=await auth.verifyIdToken(bearer[1],true);}catch{throw fail(401,'Iniciá sesión nuevamente.');}
  if(!key(token.uid)||token.svPasswordChangeRequired===true||req.headers['x-sv-view-as']||req.headers['x-sisventas-view-as'])throw fail(403,'Esta prueba está disponible sólo para Administrador.');
  const [role,cfg,reset]=await Promise.all([read('sv_chat_roles/'+token.uid),read('sv_permisos/admin'),read('sv_access_resets/'+token.uid)]);
  if(role?.activo!==true||role.rol!=='admin'||cfg?.indiceVersion!==2||cfg.indiceModulos?.presupuesto!==true||Object.values(cfg.bloqueados||{}).includes('presupuesto')||reset?.required===true||reset?.version!=null&&reset.version!==token.svAccessVersion)throw fail(403,'Esta prueba está disponible sólo para Administrador.');
  return {uid:token.uid,revision:cfg.indiceRevision??null,access:token.svAccessVersion??null};
 }
 async function bucket(){if(!storage||!bucketName)throw fail(503,'La presentación todavía no está preparada.');const b=storage().bucket(bucketName),[m]=await b.getMetadata();if(m.iamConfiguration?.publicAccessPrevention!=='enforced'||m.iamConfiguration?.uniformBucketLevelAccess?.enabled!==true)throw fail(503,'La presentación requiere almacenamiento privado.');return b;}
 async function handle(req,body){
  if(req.method!=='POST')throw fail(405,'Método no permitido.');
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['budgetKey','exchangeRate','exchangeLabel','includeImages'].includes(k))||!key(body.budgetKey)||typeof body.includeImages!=='boolean'||typeof body.exchangeRate!=='number'||!Number.isFinite(body.exchangeRate)||body.exchangeRate<=0||body.exchangeRate>1e9||typeof body.exchangeLabel!=='string'||body.exchangeLabel.length>160)throw fail(400,'Revisá el presupuesto y la cotización de la barra superior.');
  const actor=await authorize(req),b=await bucket();let manifest;
  try{const [bytes]=await b.file('budget-presentations/pp0167/manifest.json').download();if(bytes.length>16384)throw Error();manifest=JSON.parse(bytes);}catch{throw fail(503,'La presentación todavía no está preparada.');}
  if(manifest?.schema!==1||manifest.budgetKey!==body.budgetKey||!Array.isArray(manifest.images)||manifest.images.length!==6)throw fail(404,'No hay una presentación de prueba para este presupuesto.');
  let totalBytes=0;manifest.images.forEach((row,index)=>{if(!row||typeof row.path!=='string'||!new RegExp('^budget-presentations/pp0167/v[0-9]+/page-'+(index+1)+'-[a-f0-9]{64}\\.png$').test(row.path)||!/^[a-f0-9]{64}$/.test(row.sha256)||!row.path.endsWith('-'+row.sha256+'.png')||!Number.isInteger(row.bytes)||row.bytes<24||row.bytes>4e6||row.width!==([0,1,3].includes(index)?1671:1672)||row.height!==941)throw fail(503,'La presentación requiere revisar sus imágenes.');totalBytes+=row.bytes;});if(totalBytes>16e6)throw fail(503,'La presentación supera el tamaño permitido.');
  const original=await read('sisventas/presupuestos/'+body.budgetKey);
  if(!original||String(original.numero||original.id||'').replace(/^#/,'')!=='PP-0167'||original.eliminado===true)throw fail(404,'Volvé a abrir el presupuesto desde el listado.');
  const dto=model.build(original,{exchangeRate:body.exchangeRate,exchangeLabel:body.exchangeLabel}),revision=crypto.createHash('sha256').update(JSON.stringify(dto)).digest('hex');
  const images=body.includeImages?await Promise.all(manifest.images.map(async row=>{
   if(typeof row.path!=='string'||!/^budget-presentations\/pp0167\/v[0-9]+\/page-[1-6]-[a-f0-9]{64}\.png$/.test(row.path)||!/^[a-f0-9]{64}$/.test(row.sha256)||!Number.isInteger(row.bytes)||row.bytes<1||row.bytes>4e6)throw fail(503,'La presentación requiere revisar sus imágenes.');
   const [bytes]=await b.file(row.path).download();if(bytes.length!==row.bytes||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==row.width||bytes.readUInt32BE(20)!==row.height||crypto.createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw fail(503,'No se pudo comprobar una imagen de la presentación.');return{data:bytes.toString('base64'),type:'image/png'};
  })):undefined;
  const fresh=await read('sisventas/presupuestos/'+body.budgetKey);if(!fresh||fresh.eliminado===true||String(fresh.numero||fresh.id||'').replace(/^#/,'')!=='PP-0167')throw fail(409,'El presupuesto cambió. Volvé a abrir la presentación.');const again=model.build(fresh,{exchangeRate:body.exchangeRate,exchangeLabel:body.exchangeLabel});if(JSON.stringify(again)!==JSON.stringify(dto))throw fail(409,'El presupuesto cambió. Volvé a abrir la presentación.');
  const current=await authorize(req);if(JSON.stringify(current)!==JSON.stringify(actor))throw fail(403,'La sesión cambió. Volvé a abrir la presentación.');
  return {ok:true,dto,revision,generatedAt:new Date().toISOString(),...(images?{images}:{})};
 }
 return {handle,authorize};
}
module.exports={create};
