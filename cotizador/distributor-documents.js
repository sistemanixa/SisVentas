'use strict';
const crypto=require('node:crypto');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const key=v=>{if(typeof v!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(v)||['__proto__','constructor','prototype'].includes(v))throw fail(400,'Identificador inválido');return v;};
const text=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())throw fail(400,'Revisá los datos del comprobante');return v.trim();};
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
function warranty(c){
 if(c?.estado==='no')return {state:'no'};
 if(c?.estado!=='si'||!Number.isInteger(c.meses)||c.meses<1||c.meses>120||!['entrega','instalacion'].includes(c.inicio))return {state:'sin_definir'};
 return {state:'si',months:c.meses,start:c.inicio,serialRequired:c.serie===true};
}
function reviewedWarranty(c){return warranty(c?.state==='si'?{estado:c.state,meses:c.months,inicio:c.start,serie:c.serialRequired}:{estado:c?.state});}
function input(body){
 if(!body||!['remito','recibo'].includes(body.type)||!['USD','ARS'].includes(body.currency))throw fail(400,'Tipo o moneda inválidos');
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)throw fail(400,'Agregá entre 1 y 50 productos');
 const includeWarranty=body.warrantyReport===true;if(includeWarranty&&body.type!=='remito')throw fail(400,'El informe de garantía acompaña al remito de entrega');
 const seen=new Set();const items=body.items.map(i=>{key(i.id);if(seen.has(i.id)||!Number.isInteger(i.qty)||i.qty<1||i.qty>999||typeof i.price!=='number'||!Number.isFinite(i.price)||i.price<=0)throw fail(400,'Revisá cantidades y precios');seen.add(i.id);const serials=i.serials??[];if(!Array.isArray(serials)||serials.length>i.qty||serials.length>100)throw fail(400,'Revisá las series de los productos');return {id:i.id,qty:i.qty,price:i.price,...(includeWarranty?{warranty:reviewedWarranty(i.warranty),serials:serials.map(s=>text(s,120))}:{})};});
 if(includeWarranty&&items.reduce((n,i)=>n+i.qty,0)>100)throw fail(400,'El informe admite hasta 100 unidades por remito');
 const client={name:text(body.client?.name,160,true),address:text(body.client?.address||'',240),contact:text(body.client?.contact||'',160)};
 const method=body.type==='recibo'?body.method:'';if(body.type==='recibo'&&!['efectivo','transferencia','tarjeta','otro'].includes(method))throw fail(400,'Elegí el medio de pago');
 return {id:key(body.id),type:body.type,currency:body.currency,client,items,method,notes:text(body.notes||'',1500),warrantyReport:includeWarranty};
}
function createDistributorDocuments({auth,db,enabled=false,now=Date.now}){
 const read=async p=>(await db.ref(p).get()).val();
 async function authorize(req){
  const bearer=String(req.headers.authorization||'').match(/^Bearer (\S+)$/i);if(!bearer)throw fail(401,'Sesión requerida');
  let user;try{user=await auth.verifyIdToken(bearer[1],true);}catch(_){throw fail(401,'Sesión inválida');}key(user.uid);
  const identity=await read('sv_chat_roles/'+user.uid);if(identity?.activo!==true)throw fail(403,'Usuario inactivo');
  if(!enabled)throw fail(503,'Comprobantes todavía no está habilitado en el servidor');
  const role=identity.rol,cfg=await read('sv_permisos/'+role);
  const allowed=role==='admin'||(role==='distribuidora'?(await read('sv_distribuidora_permisos/comprobantes'))===true:cfg?.distribuidora===true&&cfg?.acciones?.distribuidora?.comprobantes===true);
  if(!allowed)throw fail(403,'Sin permiso para emitir comprobantes de Distribuidora');
  return {uid:user.uid,role,name:String(await read('sv_chat_directorio/'+user.uid+'/nombre')||'Usuario').slice(0,160)};
 }
 async function options(){
  const [catalog,exchange,company,master]=await Promise.all([read('sv_catalogo_publico'),read('sisventas/config/tipoCambio'),read('sisventas/config/empresa'),read('sisventas/productos')]);
  const rateValue=Number(exchange?.[exchange?.dolarConversion||'oficial']||exchange?.oficial||exchange?.blue||exchange?.mep)||0;
  const rate=Number.isFinite(rateValue)&&rateValue>0?rateValue:0;
  const products=Object.entries(catalog||{}).filter(([id,p])=>{const m=master?.[id];return m?.categoria==='COMPRAS PARAGUAY'&&m.activo!==false&&!['Inactivo','inactivo'].includes(m.estado)&&!m.esManoDeObra&&m.catalogoVisible!==false&&Number.isFinite(p.precioUSD)&&p.precioUSD>0&&p.precioUSD<=1e9;}).map(([id,p])=>({id,name:String(p.nombre||'Producto').slice(0,250),code:String(master[id].codigo||'').slice(0,60),warranty:warranty(master[id].garantiaConfig),usd:p.precioUSD,ars:rate>0&&Number.isFinite(rate)&&Number.isSafeInteger(Math.round(p.precioUSD*rate*100))?round(p.precioUSD*rate):null}));
  const issuer=Object.fromEntries(['nombre','dir','cuit','tel','email'].map(k=>[k,String(company?.[k]||'').slice(0,240)]));
  return {products,rate,company:issuer,quotedAt:now()};
 }
 async function list(actor){const data=await read('sv_distribuidora_comprobantes/'+actor.uid)||{};return {documents:Object.values(data).sort((a,b)=>b.createdAt-a.createdAt)};}
 async function issue(actor,body){
  const payload=input(body),hash=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),path='sv_distribuidora_comprobantes/'+actor.uid+'/'+payload.id;
  const existing=await read(path);if(existing){if(existing.requestHash!==hash)throw fail(409,'Este envío ya fue utilizado con otros datos');return {document:existing};}
  const quote=await options(),items=payload.items.map(i=>{const p=quote.products.find(p=>p.id===i.id),price=p?.[payload.currency.toLowerCase()];if(!(price>0))throw fail(409,'Un producto ya no tiene precio disponible. Revisá el catálogo');if(price!==i.price)throw fail(409,'Cambió el precio del catálogo. Actualizá los precios y revisá antes de emitir');if(payload.warrantyReport){if(JSON.stringify(i.warranty)!==JSON.stringify(p.warranty))throw fail(409,'Cambió la garantía del producto. Actualizá el catálogo y revisá el informe');if(p.warranty.state==='sin_definir')throw fail(400,'Falta configurar la garantía de '+p.name);if(p.warranty.serialRequired&&(i.serials.length!==i.qty||i.serials.some(s=>!s)))throw fail(400,'Completá las series de '+p.name);if(new Set(i.serials.filter(Boolean)).size!==i.serials.filter(Boolean).length)throw fail(400,'Hay series repetidas en '+p.name);}return {id:i.id,code:p.code,name:p.name,qty:i.qty,unitPrice:price,catalogPriceUSD:p.usd,total:round(price*i.qty),warranty:p.warranty,...(payload.warrantyReport?{serials:i.serials}:{})};});
  if(!Number.isSafeInteger(Math.round(items.reduce((n,i)=>n+i.total,0)*100)))throw fail(400,'El importe excede el límite del comprobante');
  const sequence=await db.ref('sv_distribuidora_comprobantes_contadores/'+payload.type).transaction(value=>value==null?1:Number.isSafeInteger(value)&&value>=0&&value<999999999?value+1:undefined,undefined,false);
  if(!sequence.committed)throw fail(409,'No se pudo reservar el número del comprobante');
  const stamp=now(),number=(payload.type==='remito'?'RE':'RC')+'-'+String(sequence.snapshot.val()).padStart(6,'0');
  const record={id:payload.id,number,type:payload.type,currency:payload.currency,client:payload.client,items,method:payload.method,notes:payload.notes,warrantyReport:payload.warrantyReport,total:round(items.reduce((n,i)=>n+i.total,0)),rate:quote.rate,company:quote.company,createdAt:stamp,createdBy:actor.uid,createdByName:actor.name,status:'emitido',requestHash:hash,audit:[{type:'emitido',at:stamp,uid:actor.uid,name:actor.name,warrantyReport:payload.warrantyReport}]};
  let conflict=false;const result=await db.ref(path).transaction(current=>{conflict=false;if(current){if(current.requestHash!==hash){conflict=true;return;}return current;}return record;},undefined,false);
  if(conflict||!result.committed)throw fail(409,'El comprobante cambió. Recargá antes de continuar');return {document:result.snapshot.val()};
 }
 async function cancel(actor,body){const id=key(body.id),reason=text(body.reason,500,true),stamp=now();let error;const ref=db.ref('sv_distribuidora_comprobantes/'+actor.uid+'/'+id);
  // Prime the exact record so SDK transactions do not treat an uncached null as missing.
  let listener;await new Promise((resolve,reject)=>{listener=()=>resolve();ref.on('value',listener,reject);});
  try{const r=await ref.transaction(current=>{error=null;if(!current){error=fail(404,'Comprobante no disponible');return;}if(current.status==='anulado')return current;return {...current,status:'anulado',cancelledAt:stamp,cancelReason:reason,audit:[...current.audit,{type:'anulado',at:stamp,uid:actor.uid,name:actor.name,reason}]};},undefined,false);if(error)throw error;if(!r.committed)throw fail(409,'No se pudo confirmar la anulación');return {document:r.snapshot.val()};}finally{ref.off('value',listener);}
 }
 return {authorize,options,list,issue,cancel};
}
module.exports={createDistributorDocuments,input};
