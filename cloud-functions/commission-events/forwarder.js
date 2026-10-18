'use strict';
const crypto=require('node:crypto');
const digest=id=>crypto.createHash('sha256').update(String(id)).digest('hex');
function createForwarder({instance,target,deliveryURL=target,probeRef='',client,now=Date.now,logger=()=>{}}){
 const expected='https://cotizador-is54pr4fha-rj.a.run.app';
 return async function forward(_data,context){
  if(instance!=='nixa-sisventas-default-rtdb'||target!==expected||!/^https:\/\/(?:[a-z0-9-]{1,63}---)?cotizador-is54pr4fha-rj\.a\.run\.app$/.test(deliveryURL))throw Error('Configuración de entrega incompleta');
  const id=String(context?.eventId||''),stamp=Date.parse(context?.timestamp||''),resource=typeof context?.resource==='string'?context.resource:context?.resource?.name;
  const prefix='projects/_/instances/'+instance+'/refs/';
  if(!id||id.length>512||/[\r\n]/.test(id)||!['providers/google.firebase.database/eventTypes/ref.write','google.firebase.database.ref.write'].includes(context?.eventType)||!String(resource||'').startsWith(prefix)||!Number.isFinite(stamp)||stamp>now()+300000)throw Error('Evento de entrega inválido');
  const path=resource.slice(prefix.length),isProbe=!!probeRef&&/^sv_commission_probe\/[A-Za-z0-9_-]{16,80}$/.test(probeRef)&&path===probeRef;
  if(!isProbe&&!/^sisventas\/(?:pagos\/[A-Za-z0-9_-]{1,128}\/monto|ventas\/[A-Za-z0-9_-]{1,128}\/(?:estadoPago|comisionHabilitada))$/.test(path))throw Error('Ruta de entrega inválida');
  // A failed delivery is a retry of this concrete operation, never a scan or a
  // clock query. Permanent failures stop after a day and require reconciliation.
  if(now()-stamp>86400000){logger({event:'commission_forward_review',eventHash:digest(id),reason:'expired'});return;}
  let response;
  try {
   const identity=await client(target);
   response=await identity.request({url:deliveryURL+'/internal/commission-event'+(isProbe?'-probe':''),method:'POST',timeout:20000,retry:false,maxRedirects:0,headers:{'Content-Type':'application/json','ce-specversion':'1.0','ce-type':'google.firebase.database.ref.v1.written','ce-instance':instance,'ce-id':id,'ce-source':'//firebasedatabase.googleapis.com/projects/_/locations/us-central1/instances/'+instance,'ce-ref':path},data:{}});
  } catch(_) { throw Error('No se pudo entregar el evento de comisión'); }
  if(response.status!==200||response.data?.ok!==true||!(isProbe?['probe_received']:['completed','ignored','review']).includes(response.data?.status))throw Error('Entrega de comisión no confirmada');
  logger({event:isProbe?'commission_forward_probe_completed':'commission_forward_completed',eventHash:digest(id),result:response.data.status});
 };
}
module.exports={createForwarder};
