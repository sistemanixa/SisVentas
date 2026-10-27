'use strict';
// Explicit payout command. Employee accounts remain internal; no list/history
// reads, scheduler, client supplied patches or permission grants are introduced.
const {digest,parts}=require('./labor-guard'),Calc=require('./commission-calculations'),Model=require('./bonus-payment-model');
const fail=(statusCode,message,code='SV_BONUS_PAYMENT_INVALID')=>Object.assign(Error(message),{statusCode,code});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),copy=v=>structuredClone(v),same=(a,b)=>digest(a??null)===digest(b??null);
const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];
function key(v){if(typeof v!=='string'||!v||v.length>768||['__proto__','prototype','constructor'].includes(v))throw fail(400,'Referencia inválida');try{if(parts(v).length!==1)throw Error();}catch(_){throw fail(400,'Referencia inválida');}return v;}
function describe(input){
 if(!object(input)||Object.keys(input).some(k=>!['id','items','medio','comprobante','loteKey'].includes(k))||!/^[A-Za-z0-9_-]{8,160}$/.test(input.id||'')||!Array.isArray(input.items)||!input.items.length||input.items.length>100)throw fail(400,'Solicitud de pago inválida');
 if(Buffer.byteLength(JSON.stringify(input))>4*1024*1024)throw fail(413,'El comprobante supera el tamaño permitido');
 const body=copy(input),seen=new Set();
 for(const row of body.items){if(!object(row)||Object.keys(row).some(k=>!['key','monto','expectedHash'].includes(k)))throw fail(400,'Detalle de pago inválido');key(row.key);if(seen.has(row.key)||typeof row.monto!=='number'||!Number.isFinite(row.monto)||row.monto<=0||Math.abs(row.monto*100-Math.round(row.monto*100))>0.00001||!/^[a-f0-9]{64}$/.test(row.expectedHash||''))throw fail(400,'Importe o versión de pago inválidos');seen.add(row.key);}
 if(typeof body.medio!=='string'||!body.medio.trim()||body.medio.length>160)throw fail(400,'Elegí el medio de pago');
 if(body.loteKey!=null)key(body.loteKey);
 if(body.comprobante!=null){const c=body.comprobante;if(!object(c)||Object.keys(c).some(k=>!['nombre','tipo','data','externo'].includes(k))||typeof c.nombre!=='string'||c.nombre.length>240||typeof c.tipo!=='string'||!['image/png','image/jpeg','image/webp','application/pdf'].includes(c.tipo)||typeof c.data!=='string'||!new RegExp('^data:'+c.tipo.replace('/','\\/')+';base64,[A-Za-z0-9+/=\\r\\n]+$').test(c.data))throw fail(400,'Comprobante inválido');}
 return body;
}
function allowed(profile,cfg){
 if(profile?.activo!==true||!roles.includes(profile.rol)||cfg!=null&&(!object(cfg)||cfg.indiceVersion!==2||cfg.indiceModulos?.gastos!==true||Object.values(cfg.bloqueados||{}).includes('gastos')))throw fail(403,'Sin permiso para pagar gastos','SV_BONUS_PAYMENT_DENIED');
 for(const action of ['administrar','pagar']){const override=cfg?.acciones?.gastos?.[action];if(typeof override==='boolean'?!override:!['admin','administrativo'].includes(profile.rol))throw fail(403,'Sin permiso para pagar gastos','SV_BONUS_PAYMENT_DENIED');}
 return {role:profile.rol,permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{}),name:String(profile.nombre||profile.usuario||'')};
}
function linkedPath(g){
 const legacy=String(g.legacyKey||'').split('/');if(legacy.length!==3||legacy[0]!=='ctaemp')throw fail(409,'La bonificación requiere revisar su vínculo','SV_CAS_CONFLICT');
 const employee=key(legacy[1]),movement=key(legacy[2]);
 if(['empleadoId','empleadoFbKey'].some(k=>g[k]!=null&&g[k]!==''&&String(g[k])!==employee)||g.movimientoCtaKey&&g.movimientoCtaKey!==movement)throw fail(409,'El vínculo de la bonificación cambió','SV_CAS_CONFLICT');
 return 'sisventas/ctaemp/'+employee+'/'+movement;
}
function mapPayments(value){if(value==null)return {};if(typeof value!=='object')throw fail(409,'El historial de pagos requiere revisión','SV_CAS_CONFLICT');return Array.isArray(value)?Object.fromEntries(value.map((v,i)=>['legacy_'+i,copy(v)])):copy(value);}
function createBonusPayment({authorize,db,guard,store,enabled=false,now=Date.now}={}){
 if(typeof authorize!=='function'||!db||!guard?.run||!store?.readAsUser)throw Error('Falta el circuito de pago');
 async function access(actor,read){if(actor?.claims?.uid!==actor?.uid||!actor?.uid)throw fail(403,'Sesión requerida');const profile=await read('sv_chat_roles/'+actor.uid),cfg=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+actor.uid);if(actor.claims.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&actor.claims.svAccessVersion!==reset.version)throw fail(403,'La sesión requiere volver a ingresar','SV_BONUS_PAYMENT_DENIED');return allowed(profile,cfg);}
 async function execute(actor,input){
  if(!enabled)throw fail(503,'El pago de bonificaciones todavía no está disponible','SV_BONUS_PAYMENT_DISABLED');
  const body=describe(input),captured=await access(actor,p=>store.read(p));
  const result=await guard.run({uid:actor.uid,claims:actor.claims,mode:'command',role:captured.role,permissionRevision:captured.permissionRevision,permissionDigest:captured.permissionDigest,opId:body.id,transportDigest:digest(body),recoverReceipt:true,operation:'bonus-payment',input:body},async scope=>{
   if(!same(await access(actor,p=>scope.get(p)),captured))throw fail(409,'Los permisos cambiaron','SV_LABOR_AUTH_CHANGED');
   const patch={},snapshots=new Map(),usedMovements=new Set(),ts=now(),fecha=new Date(ts).toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}),lot=body.items.length>1?(body.loteKey||'lote_bonus_'+body.id):null,rows=[];
   for(let i=0;i<body.items.length;i++){
    const item=body.items[i],path='sisventas/gastos/'+item.key,visible=await store.readAsUser(path,actor),g=await scope.get(path);
    if(!g||!same(visible,g)||!Model.isBonus(g)||g.bajaAdministrativa)throw fail(403,'El gasto no está disponible como bonificación','SV_BONUS_PAYMENT_DENIED');
    if(digest(Model.revisionData(g))!==item.expectedHash)throw fail(409,'La bonificación cambió. Actualizá la lista','SV_CAS_CONFLICT');
    if(['pendiente_aprobacion','rechazado','anulado','pagado'].includes(Calc.normalizarEstadoGasto(g))||g.requiereAprobacion===true||!['aprobado','pendiente_pago','pagado_parcial'].includes(String(g.estado||'').toLowerCase()))throw fail(409,'La bonificación no tiene saldo aprobado para pagar','SV_CAS_CONFLICT');
    const movementPath=linkedPath(g),m=await scope.get(movementPath),employee=movementPath.split('/')[2];
    if(usedMovements.has(movementPath)||!object(m)||m.tipo!=='bonificacion'||m.gastoFbKey!==item.key||m.bajaAdministrativa||['rechazado','anulado','pendiente_aprobacion'].includes(String(m.estado||'').toLowerCase())||['empleadoId','empleadoFbKey'].some(k=>m[k]!=null&&m[k]!==''&&String(m[k])!==employee)||m.legacyKey&&m.legacyKey!==g.legacyKey||Number(m.monto)!==Number(g.monto)||(m.periodoComputo??null)!==(g.periodoComputo??null))throw fail(409,'La bonificación y su movimiento requieren revisión','SV_CAS_CONFLICT');
    usedMovements.add(movementPath);
    const total=Number(g.monto),previous=Calc.totalPagadoGasto(g),priorMovement=Calc.totalPagadoGasto(m);
    if(!Number.isFinite(total)||total<=0||!Number.isFinite(previous)||previous<0||previous>total||Object.values(g.pagos||{}).some(p=>!object(p)||!Number.isFinite(Number(p.monto))||Number(p.monto)<0)||Math.abs(previous-priorMovement)>0.000001||!same(g.pagos||{},m.pagos||{})||item.monto>Math.round((total-previous)*100)/100)throw fail(409,'El saldo de la bonificación cambió','SV_CAS_CONFLICT');
    const paymentKey='pago_bonus_'+body.id+'_'+i,gPayments=mapPayments(g.pagos),mPayments=mapPayments(m.pagos);
    if(gPayments[paymentKey]||mPayments[paymentKey])throw fail(409,'Este pago ya está registrado','SV_CAS_CONFLICT');
    const full=body.comprobante,light=full?{nombre:full.nombre,tipo:full.tipo,externo:true}:null,payment={fecha,ts,monto:item.monto,medio:body.medio,usuario:captured.name||actor.uid,rol:captured.role,lotePagoKey:lot,comprobante:light},amount=Math.round((previous+item.monto)*100)/100,state=amount>=total-.01?'pagado':'pagado_parcial';
    const nextG=copy(g),nextM=copy(m);nextG.pagos=gPayments;nextM.pagos=mPayments;nextG.pagos[paymentKey]=copy(payment);nextM.pagos[paymentKey]=copy(payment);
    for(const next of [nextG,nextM]){next.montoPagado=amount;next.estado=state;if(!Object.keys(g.pagos||{}).length&&previous>0)next.saldoPagadoLegacy=previous;}
    nextG.medio=body.medio;if(state==='pagado')nextG.reembolsado=true;nextM.fechaPago=fecha;nextM.medioPago=body.medio;
    patch[path]=nextG;patch[movementPath]=nextM;snapshots.set(path,g);snapshots.set(movementPath,m);
    if(full){const attachment='sisventas/gastos_adjuntos/'+item.key+'/pagos/'+paymentKey+'/comprobanteData';if(await scope.get(attachment)!==null)throw fail(409,'El comprobante ya existe','SV_CAS_CONFLICT');snapshots.set(attachment,null);patch[attachment]=full.data;}
    rows.push({gastoFbKey:item.key,descripcion:g.descripcion||'',monto:total,saldoPagado:item.monto});
   }
   if(lot){const p='sisventas/pagos_realizados/'+lot;if(await scope.get(p)!==null)throw fail(409,'El lote ya existe','SV_CAS_CONFLICT');snapshots.set(p,null);patch[p]={fecha,ts,medio:body.medio,monto:body.items.reduce((s,x)=>s+x.monto,0),usuario:captured.name||actor.uid,rol:captured.role,comprobante:body.comprobante||null,gastos:rows};}
   scope.beforeCommit(async({readFresh,readFreshAsUser})=>{
    if(!same(await access(actor,readFresh),captured))throw fail(409,'Los permisos cambiaron','SV_LABOR_AUTH_CHANGED');
    for(const item of body.items){const p='sisventas/gastos/'+item.key;if(!same(await readFreshAsUser(p),snapshots.get(p)))throw fail(409,'El gasto cambió','SV_CAS_CONFLICT');}
    for(const [p,value]of snapshots)if(!same(await readFresh(p),value))throw fail(409,'El registro cambió durante el pago','SV_CAS_CONFLICT');
   });
   await scope.update(patch);return {ok:true,committed:true};
  });
  if(result?.ok!==true||result?.committed!==true)throw fail(409,'El intento anterior no se guardó. Volvé a confirmar','SV_LABOR_CANCELLED');
  // Refresh only the already-authorized expense; never return the private CTA.
  const current=await access(actor,p=>store.read(p));if(!same(current,captured))throw fail(409,'El pago quedó confirmado. Volvé a abrir Gastos para ver su estado','SV_LABOR_COMMIT_UNCONFIRMED');
  const updates=[];for(let i=0;i<body.items.length;i++){const item=body.items[i],g=await store.readAsUser('sisventas/gastos/'+item.key,actor),paymentKey='pago_bonus_'+body.id+'_'+i,payment=g?.pagos?.[paymentKey];if(!g||!payment)throw fail(409,'El pago quedó confirmado. Actualizá Gastos para ver su estado','SV_LABOR_COMMIT_UNCONFIRMED');updates.push({key:item.key,montoPagado:g.montoPagado,estado:g.estado,medio:g.medio||'',reembolsado:g.reembolsado===true,paymentKey,payment:copy(payment)});}
  return {ok:true,committed:true,keys:body.items.map(x=>x.key),updates};
 }
 return {authorize,execute};
}
module.exports={createBonusPayment,describe,allowed,linkedPath};
