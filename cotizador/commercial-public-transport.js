'use strict';
const View=require('./commercial-view-protocol');
const fail=(statusCode,code,message)=>Object.assign(Error(message),{statusCode,code});
const copy=value=>value==null?null:structuredClone(value),eq=(a,b)=>View.canonical(a)===View.canonical(b);
function createCommercialPublicTransport({guard,store,db}={}){
 if(!guard?.current||!store?.read||!db?.ref)throw TypeError('Falta el transporte comercial protegido');
 const read=path=>store.read(path);
 async function context(actor,{issue=false}={}){
  if(!actor?.uid||actor.claims?.uid!== (actor.realUid||actor.uid))throw fail(403,'SV_COMMERCIAL_AUTH','Sesión comercial requerida.');
  const scope=guard.current(),get=scope?path=>scope.get(path):read,config=await get('sv_labor_config');
  if(!View.active(config))throw fail(503,'SV_COMMERCIAL_PROTOCOL_OFF','El transporte comercial protegido todavía no está habilitado.');
  if(issue&&!scope)throw fail(503,'SV_COMMERCIAL_FENCE','La preparación requiere el guardado protegido.');
  const path='sv_chat_roles/'+actor.uid,profile=await get(path);if(profile?.activo!==true||actor.claims?.svPasswordChangeRequired===true||actor.role&&profile.rol!==actor.role)throw fail(403,'SV_COMMERCIAL_AUTH_CHANGED','La sesión comercial cambió.');
  const cfgPath='sv_permisos/'+profile.rol,cfg=await get(cfgPath)??null,current={...actor,role:profile.rol},captured={profile,cfg};
  const fresh=async()=>{const [p,c,flag]=await Promise.all([read(path),read(cfgPath),read('sv_labor_config')]);if(!eq(p,profile)||!eq(c??null,cfg)||!View.active(flag))throw fail(403,'SV_COMMERCIAL_AUTH_CHANGED','La sesión o los permisos cambiaron.');};
  if(issue){if(typeof scope.beforeCommit!=='function')throw fail(503,'SV_COMMERCIAL_FENCE');scope.beforeCommit(fresh);}
  return {active:true,scope:scope||{get:read},actor:current,cfg,captured,fresh};
 }
 async function projectWith(c,domain,id,raw,{issue=false}={}){
  if(!c.active)return copy(raw);const revision=await View.version(c.scope,domain,id,raw,{issue});return View.projectRecord(raw,{actor:c.actor,permissions:c.cfg,domain,id,revision}).value;
 }
 async function projectRecord(actor,domain,id,raw,options={}){const c=await context(actor,options),value=await projectWith(c,domain,id,raw,options);if(c.active&&!options.issue)await c.fresh();return value;}
 async function list(actor,domain,records){const c=await context(actor),out={};for(const [id,raw]of Object.entries(records||{})){const value=await projectWith(c,domain,id,raw);if(value){for(const name of ['_svOwnerUid','_svOriginalAuthor','_svConversionAudit'])if(raw[name]!==undefined)value[name]=name==='_svOwnerUid'?String(raw[name]):Object.fromEntries(Object.entries(raw[name]||{}).filter(([k,v])=>['name','uid','tipo','fecha','usuario','accion','referenciaHistorica'].includes(k)&&['string','number','boolean'].includes(typeof v)));out[id]=value;}}if(c.active)await c.fresh();return out;}
 async function paymentResult(actor,result){
  const c=await context(actor);if(!c.active)return copy(result);const out={};for(const name of ['ok','committed','grupoPago','replayed','currentView'])if(result[name]!==undefined)out[name]=copy(result[name]);
  if(Array.isArray(result.links))out.links=result.links.map(link=>({pagoKey:link.pagoKey,ventaKey:link.ventaKey}));
  if(Array.isArray(result.resultados)){out.resultados=[];for(const row of result.resultados){const id=row.venta?.fbKey;if(typeof id!=='string')throw fail(409,'SV_COMMERCIAL_PAYMENT_REFERENCE','El cobro se confirmó, pero falta la referencia de la venta.');out.resultados.push({pago:View.financial(c.actor,c.cfg)?copy(row.pago):View.payment(row.pago),venta:{...await projectWith(c,'ventas',id,row.venta),fbKey:id}});}}
  await c.fresh();return out;
 }
 return {projectRecord,list,paymentResult};
}
module.exports={createCommercialPublicTransport};