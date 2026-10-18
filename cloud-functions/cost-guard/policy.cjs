'use strict';
const project='nixa-sisventas',projectNumber='171899432710',region='southamerica-east1';
const database=`projects/${projectNumber}/locations/us-central1/instances/nixa-sisventas-default-rtdb`;
const services=['cotizador','asistente','emitirfactura','testtfapp'].map(name=>`projects/${project}/locations/${region}/services/${name}`);
function monthAt(time){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit'}).formatToParts(time);return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;}
function decide(message,{billingAccountId,budgetId,now=new Date()}={}){
 if(!billingAccountId||!budgetId)throw Error('Configurar la cuenta y el presupuesto exactos antes de habilitar el corte');
 const attributes=message?.attributes||{};
 if(attributes.billingAccountId!==billingAccountId||attributes.budgetId!==budgetId||attributes.schemaVersion!=='1.0')return {pause:false,reason:'foreign-notification'};
 let body;try{if(typeof message.data!=='string'||message.data.length>32768)throw Error();body=JSON.parse(Buffer.from(message.data,'base64').toString('utf8'));}catch(_){return {pause:false,reason:'invalid-notification'};}
 if(body.currencyCode!=='USD'||body.budgetAmountType!=='SPECIFIED_AMOUNT'||body.budgetAmount!==60||typeof body.costAmount!=='number'||!Number.isFinite(body.costAmount)||body.costAmount<0)return {pause:false,reason:'invalid-amount'};
 const start=new Date(body.costIntervalStart);
 if(!Number.isFinite(start.getTime()))return {pause:false,reason:'invalid-period'};
 const period=start.toISOString().slice(0,7);
 // The owner's explicit choice: stay operational in October, begin November.
 if(period<'2026-11'||period!==monthAt(now)||start>now)return {pause:false,reason:'outside-period'};
 return body.costAmount>=60?{pause:true,reason:'monthly-limit',period}:{pause:false,reason:'below-limit'};
}
function servicePauseBody(service){
 // Remove tags as well: manual scaling=0 alone leaves tagged revisions live.
 const traffic=(service.traffic||[]).filter(t=>Number(t.percent)>0).map(({type,revision,percent})=>({...type?{type}:{},...revision?{revision}:{},percent}));
 if(!traffic.length||traffic.reduce((sum,t)=>sum+t.percent,0)!==100)throw Error('No se pudo confirmar el tráfico del servicio; no se reemplaza a ciegas');
 return {scaling:{manualInstanceCount:0},traffic};
}
async function suspend({request,logger=()=>{},sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 // Disable, never delete or unlink billing. All resource names are fixed here.
 const instance=(await request({url:`https://firebasedatabase.googleapis.com/v1beta/${database}`,method:'GET'})).data;
 if(instance.state!=='DISABLED'){
  const response=await request({url:`https://firebasedatabase.googleapis.com/v1beta/${database}:disable`,method:'POST',data:{}});
  if(response.data?.state!=='DISABLED')throw Error('No se confirmó la suspensión de la base');
 }
 const failures=[];
 for(const name of services){
  try{
   const service=(await request({url:`https://run.googleapis.com/v2/${name}`,method:'GET'})).data;
   if(service.scaling?.scalingMode==='MANUAL'&&service.scaling?.manualInstanceCount===0&&!(service.traffic||[]).some(t=>t.tag))continue;
   const data=servicePauseBody(service);
   // Traffic metadata only, for a manual recovery. Never log env or secrets.
   logger({event:'cost_guard_traffic_before_pause',service:name,traffic:service.traffic||[]});
   const response=await request({url:`https://run.googleapis.com/v2/${name}?update_mask=scaling.manualInstanceCount,traffic`,method:'PATCH',data});
   if(response.data?.error)throw Error('Cambio de servicio rechazado');
   let operation=response.data;
   if(operation?.name){
    const prefix=`projects/${project}/locations/${region}/operations/`;
    if(!operation.name.startsWith(prefix))throw Error('Operación inesperada');
    for(let attempt=0;!operation.done&&attempt<10;attempt++){await sleep(1000);operation=(await request({url:`https://run.googleapis.com/v2/${operation.name}`,method:'GET'})).data;}
    if(!operation.done||operation.error)throw Error('No se confirmó el cambio de servicio');
   }
   const confirmed=(await request({url:`https://run.googleapis.com/v2/${name}`,method:'GET'})).data;
   if(confirmed.scaling?.manualInstanceCount!==0||confirmed.scaling?.scalingMode!=='MANUAL'||(confirmed.traffic||[]).some(t=>t.tag))throw Error('El servicio todavía admite tráfico');
  }catch(_){failures.push(name);}
 }
 if(failures.length)throw Error('Quedan servicios por suspender: '+failures.join(', '));
 logger({event:'cost_guard_configuration_paused'});
 // In-flight requests may finish. No new data operations are admitted.
}
module.exports={decide,suspend,servicePauseBody,services,database,monthAt};
