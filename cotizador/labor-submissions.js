'use strict';
const {isDeepStrictEqual}=require('node:util');
const {_hsexConsolidarDetalle:consolidate,_hsexDescripcionDetalle:describe}=require('./labor-calculations');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
function validate(body){
 if(!body || typeof body.empFbKey!=='string'||!body.empFbKey||/[.#$\[\]\/]/.test(body.empFbKey)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(body.mes||'')||!/^ap_[A-Za-z0-9_-]{1,150}$/.test(body.aporteId||''))throw fail(400,'Solicitud inválida');
 if(!Array.isArray(body.detalleDias)||!body.detalleDias.length||body.detalleDias.length>31)throw fail(400,'Detalle de horas inválido');
 const details=body.detalleDias.map(d=>{
  if(!d||typeof d.fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)||d.fecha.slice(0,7)!==body.mes||!Number.isFinite(new Date(d.fecha+'T12:00:00Z').getTime())||new Date(d.fecha+'T12:00:00Z').toISOString().slice(0,10)!==d.fecha||typeof d.horas!=='number'||!Number.isFinite(d.horas)||d.horas<=0||d.horas>24||typeof d.lugar!=='string'||!d.lugar.trim()||d.lugar.length>200)throw fail(400,'Día, lugar u horas inválidos');
  return {fecha:d.fecha,horas:d.horas,lugar:d.lugar.trim()};
 });
 const byDate={};for(const d of details)byDate[d.fecha]=(byDate[d.fecha]||0)+d.horas;
 if(Object.values(byDate).some(h=>h>24))throw fail(400,'Las horas de un día no pueden superar 24');
 if(body.observaciones!==undefined && (typeof body.observaciones!=='string'||body.observaciones.length>2000))throw fail(400,'Observaciones inválidas');
 return {...body,detalleDias:consolidate(details),observaciones:(body.observaciones||'').trim()};
}
function createLaborSubmissions({auth,db,transaction,now=Date.now}){
 async function authorize(req){
  const match=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!match)throw fail(401,'Sesión requerida');
  let token;try{token=await auth.verifyIdToken(match[1],true);}catch(_){throw fail(401,'Sesión inválida');}
  const identity=(await db.ref('sv_chat_roles/'+token.uid).get()).val();
  if(identity?.activo!==true||!['admin','administrativo','vendedor','tecnico','tecnico_vendedor'].includes(identity.rol))throw fail(403,'Usuario sin acceso');
  const cfg=(await db.ref('sv_permisos/'+identity.rol).get()).val()||{};
  const blocked=Object.values(cfg.bloqueados||{});
  const manager=!blocked.includes('ctaemp') && (typeof cfg.acciones?.empleados?.autorizarHoras==='boolean'?cfg.acciones.empleados.autorizarHoras:identity.rol==='admin');
  const ownAccess=!blocked.includes('ctaemp') || (!blocked.includes('dashboard') && (typeof cfg.acciones?.dashboard?.miCuenta==='boolean'?cfg.acciones.dashboard.miCuenta:identity.rol!=='admin'));
  if(!manager&&!ownAccess)throw fail(403,'Sin acceso a horas personales');
  const profiles=(await db.ref('sv_usuarios').orderByChild('uid').equalTo(token.uid).get()).val()||{};
  const matches=Object.values(profiles).filter(p=>p.uid===token.uid&&p.activo!==false);
  if(!manager && (matches.length!==1||!matches[0].empleadoFbKey))throw fail(403,'Sin vínculo laboral verificado');
  return {uid:token.uid,nombre:identity.nombre||token.name||token.uid,manager,empleadoFbKey:matches.length===1?matches[0].empleadoFbKey:''};
 }
 async function submit(identity,input){
  const body=validate(input);if(!identity.manager && body.empFbKey!==identity.empleadoFbKey)throw fail(403,'No podés cargar horas de otro empleado');
  const stamp=now();let error;
  const result=await transaction(root=>{
   error=null;try{
    if(!root)return null;const emp=root.empleados?.[body.empFbKey];if(!emp||emp.activo===false)throw fail(409,'Empleado no disponible');
    const requests=root.hsextra_solicitudes||(root.hsextra_solicitudes={});
    const previous=Object.values(requests).find(s=>s.aportes?.[body.aporteId]);
    if(previous){const a=previous.aportes[body.aporteId];if(previous.empFbKey!==body.empFbKey||String(previous.mes||previous.fecha).slice(0,7)!==body.mes||(a.enviadoUid&&a.enviadoUid!==identity.uid)||!isDeepStrictEqual(consolidate(a.detalleDias||[]),body.detalleDias)||String(a.observaciones||'').trim()!==body.observaciones)throw fail(409,'El identificador ya corresponde a otra carga');return root;}
    let key=Object.keys(requests).find(k=>requests[k].estado==='pendiente'&&requests[k].empFbKey===body.empFbKey&&String(requests[k].mes||requests[k].fecha).slice(0,7)===body.mes);
    if(!key){const base='pend_'+body.empFbKey.replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+body.mes.replace('-','');key=base;let i=2;while(requests[key])key=base+'_'+i++;}
    const old=requests[key]||{},aportes={...(old.aportes||{})};
    if(!Object.keys(aportes).length&&(old.detalleDias?.length||Number(old.horas)>0))aportes.legacy={detalleDias:old.detalleDias?.length?old.detalleDias:[{fecha:String(old.fecha||body.mes+'-01').slice(0,10),horas:Number(old.horas)||0,lugar:String(old.descripcion||'Carga anterior')}],observaciones:'',ts:old.ts||stamp};
    aportes[body.aporteId]={detalleDias:body.detalleDias,observaciones:body.observaciones,ts:stamp,enviadoPor:identity.nombre,enviadoUid:identity.uid};
    const details=consolidate(Object.values(aportes).flatMap(a=>a.detalleDias||[])),observations=Object.values(aportes).map(a=>String(a.observaciones||'').trim()).filter(Boolean).join(' · ');
    requests[key]={...old,empFbKey:body.empFbKey,empNombre:emp.nombre||'',fecha:details[0]?.fecha||body.mes+'-01',mes:body.mes,horas:details.reduce((sum,d)=>sum+d.horas,0),descripcion:describe(details,observations),detalleDias:details,aportes,estado:'pendiente',ts:old.ts||stamp,actualizadoTs:stamp,enviadoPor:old.enviadoPor||identity.nombre};return root;
   }catch(e){error=e;return;}
  });
  if(!result.committed)throw error||fail(409,'No se pudo confirmar la solicitud');return {committed:true};
 }
 return {authorize,submit};
}
module.exports={createLaborSubmissions,validate};
