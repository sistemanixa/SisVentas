'use strict';
const {_claveOperacionConcurrente:key,_hsexAgruparPendientes:group,_hsexDescripcionDetalle:describe,_pagableGastoBase:expense}=require('./labor-calculations');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
function createLaborOperations({auth,db,transaction,now=Date.now}){
 async function authorize(req){
  const match=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!match)throw fail(401,'Sesión requerida');
  let token;try{token=await auth.verifyIdToken(match[1],true);}catch(_){throw fail(401,'Sesión inválida');}
  const identity=(await db.ref('sv_chat_roles/'+token.uid).get()).val();
  if(identity?.activo!==true||!['admin','administrativo','vendedor','tecnico','tecnico_vendedor'].includes(identity.rol))throw fail(403,'Usuario sin acceso');
  const cfg=(await db.ref('sv_permisos/'+identity.rol).get()).val()||{};
  if(cfg.bloqueados?.includes('empleados')||(typeof cfg.acciones?.empleados?.autorizarHoras==='boolean'? !cfg.acciones.empleados.autorizarHoras:identity.rol!=='admin'))throw fail(403,'Sin permiso para aprobar horas extra');
  return {uid:token.uid,nombre:identity.nombre||token.name||token.email||token.uid};
 }
 async function approve(identity,body){
  const keys=body?.claves;
  if(!Array.isArray(keys)||!keys.length||keys.length>100||new Set(keys).size!==keys.length||keys.some(k=>typeof k!=='string'||!k||/[.#$\[\]\/]/.test(k)))throw fail(400,'Solicitudes inválidas');
  const legacy=body.individual===true;if(legacy&&keys.length!==1)throw fail(400,'Solicitud individual inválida');
  const stamp=now(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(stamp));
  const sorted=[...keys].sort(),gastoKey=key('hextra',sorted);let error;
  const result=await (transaction || (fn=>db.ref('sisventas').transaction(fn,undefined,false)))(root=>{
   error=null;if(!root)return null;
   try{
    const requests=sorted.map(k=>({...root.hsextra_solicitudes?.[k],fbKey:k}));
    let target=gastoKey;
    if(legacy){const existing=Object.keys(root.gastos||{}).find(k=>root.gastos[k]?.legacyKey==='hsextra_solicitudes/'+sorted[0]);if(existing)target=existing;}
    if(requests.every(s=>s.estado==='aprobado'&&s.gastoFbKey===target)&&root.gastos?.[target])return root;
    if(requests.some(s=>s.estado!=='pendiente'))throw fail(409,'Las solicitudes ya no están pendientes');
    const groups=group(requests);if(groups.length!==1)throw fail(400,'Las solicitudes deben pertenecer al mismo empleado y período');
    const g=groups[0],emp=root.empleados?.[g.empFbKey];if(!emp||emp.activo===false)throw fail(409,'Empleado no disponible');
    const cargo=root.config?.cargos?.[emp.cargoId],rate=Number(cargo?.valorHoraExtra)||0;
    const hours=legacy?Number(requests[0].horas)||0:g.horas;
    const amount=Math.round(hours*rate);
    if(!(hours>0)||!Number.isFinite(amount)||amount<0||Number(body.monto)!==amount)throw fail(409,'El valor de las horas cambió. Volvé a revisar la aprobación.');
    const details=g.detalleDias,description=legacy?requests[0].descripcion||'':details.length?describe(details,''):requests.map(s=>String(s.descripcion||'').trim()).filter(Boolean).join(' · ');
    root.gastos=root.gastos||{};
    if(!root.gastos[target])root.gastos[target]=expense({tipoPagable:'hextra',tipo:'Variable',fecha:date,fechaTrabajo:legacy?requests[0].fecha:(details[0]||{}).fecha||g.mes+'-01',periodoTrabajo:g.mes,monto:amount,descripcion:'Hs extra '+(g.empNombre||'')+' — '+description+' ('+hours+' hs)',empleadoFbKey:g.empFbKey,empleadoNombre:g.empNombre||'',hsExtra:hours,legacyKey:legacy?'hsextra_solicitudes/'+sorted[0]:'hsextra_grupo/'+sorted.join('+'),aprobadoTs:stamp,ts:stamp});
    for(const s of requests){const approved={...root.hsextra_solicitudes[s.fbKey],estado:'aprobado',aprobadoPor:identity.nombre,aprobadoTs:stamp,monto:legacy?amount:Math.round(amount*(Number(s.horas)||0)/hours),gastoFbKey:target};if(!legacy)Object.assign(approved,{montoGrupo:amount,grupoAprobacion:sorted,valorHoraExtraAplicado:rate,cargoIdAplicado:emp.cargoId||''});root.hsextra_solicitudes[s.fbKey]=approved;}
    return root;
   }catch(e){error=e;return;}
  });
  if(!result.committed)throw error||fail(409,'No se pudo confirmar la aprobación');
  return {committed:true};
 }
 return {authorize,approve};
}
module.exports={createLaborOperations};
