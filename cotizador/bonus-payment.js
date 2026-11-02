const Money=require('./commercial-models/commercial-money');
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
 for(const row of body.items){if(!object(row)||Object.keys(row).some(k=>!['key','monto','expectedHash'].includes(k)))throw fail(400,'Detalle de pago inválido');key(row.key);if(seen.has(row.key)||typeof row.monto!=='number'||!Number.isFinite(row.monto)||row.monto<=0||!Money.isAmount(row.monto)||!/^[a-f0-9]{64}$/.test(row.expectedHash||''))throw fail(400,'Importe o versión de pago inválidos');seen.add(row.key);}
 if(typeof body.medio!=='string'||!body.medio.trim()||body.medio.length>160)throw fail(400,'Elegí el medio de pago');
 if(body.loteKey!=null)key(body.loteKey);
 if(body.comprobante!=null){const c=body.comprobante;if(!object(c)||Object.keys(c).some(k=>!['nombre','tipo','data','externo'].includes(k))||typeof c.nombre!=='string'||c.nombre.length>240||typeof c.tipo!=='string'||!['image/png','image/jpeg','image/webp','application/pdf'].includes(c.tipo)||typeof c.data!=='string'||!new RegExp('^data:'+c.tipo.replace('/','\\/')+';base64,[A-Za-z0-9+/=\\r\\n]+$').test(c.data))throw fail(400,'Comprobante inválido');}
 return body;
}
function allowed(profile,cfg,actions=['administrar','pagar']){
 if(profile?.activo!==true||!roles.includes(profile.rol)||cfg!=null&&(!object(cfg)||cfg.indiceVersion!==2||cfg.indiceModulos?.gastos!==true||Object.values(cfg.bloqueados||{}).includes('gastos')))throw fail(403,'Sin permiso para pagar gastos','SV_BONUS_PAYMENT_DENIED');
 for(const action of actions){const override=cfg?.acciones?.gastos?.[action];if(typeof override==='boolean'?!override:!(action==='corregirPago'?['admin']:['admin','administrativo']).includes(profile.rol))throw fail(403,'Sin permiso para pagar gastos','SV_BONUS_PAYMENT_DENIED');}
 return {role:profile.rol,permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{}),name:String(profile.nombre||profile.usuario||'')};
}
function linkedPath(g,reimbursement=false){
 const legacy=String(g.legacyKey||(reimbursement&&g.movimientoCtaKey?'ctaemp/'+(g.empleadoFbKey||g.empleadoId)+'/'+g.movimientoCtaKey:'')).split('/');if(legacy.length!==3||legacy[0]!=='ctaemp')throw fail(409,'La bonificación requiere revisar su vínculo','SV_CAS_CONFLICT');
 const employee=key(legacy[1]),movement=key(legacy[2]);
 if(['empleadoId','empleadoFbKey'].some(k=>g[k]!=null&&g[k]!==''&&String(g[k])!==employee)||g.movimientoCtaKey&&g.movimientoCtaKey!==movement)throw fail(409,'El vínculo de la bonificación cambió','SV_CAS_CONFLICT');
 return 'sisventas/ctaemp/'+employee+'/'+movement;
}
function mapPayments(value){if(value==null)return {};if(typeof value!=='object')throw fail(409,'El historial de pagos requiere revisión','SV_CAS_CONFLICT');return Array.isArray(value)?Object.fromEntries(value.map((v,i)=>['legacy_'+i,copy(v)])):copy(value);}
function paymentTotal(g){const values=Object.values(g?.pagos||{});return values.length?Money.sum([Number(g.saldoPagadoLegacy)||0,...values.filter(p=>p&&p.anulado!==true&&String(p.estado||'').toLowerCase()!=='anulado').map(p=>Number(p.monto))]):Number(g?.montoPagado)||0;}
async function resolveExpenseMovement(g,expenseKey,scope){
 const snapshots=new Map(),emp=String(g.empleadoFbKey||g.empleadoId||'');
 if(g.empleadoId&&g.empleadoFbKey&&String(g.empleadoId)!==String(g.empleadoFbKey))throw fail(409,'El empleado del gasto requiere revisión','SV_CAS_CONFLICT');
 const explicit=/^ctaemp\//.test(String(g.legacyKey||''))||!!g.movimientoCtaKey;
 if(!emp){if(explicit)throw fail(409,'Falta el empleado vinculado','SV_CAS_CONFLICT');return {path:null,movement:null,snapshots};}
 key(emp);
 const kind=String(g.tipoPagable||g.origen||'').toLowerCase(),salary=['sueldo','haber','haberes'].includes(kind)&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(String(g.mes||''));
 const path=explicit?linkedPath(g,true):salary?'sisventas/ctaemp/'+emp+'/haber_'+g.mes.replace('-','_'):'sisventas/ctaemp/'+emp+'/gasto_empresa_'+key(expenseKey),movement=await scope.get(path);
 snapshots.set(path,movement);
 const types={bonificacion:['bonificacion'],comision:['comision'],gasto_empresa:['transporte','materiales','gasto_empresa','otro'],sueldo:['sueldo'],haber:['sueldo','haber'],haberes:['sueldo','haberes'],aguinaldo:['aguinaldo','sac'],hextra:['hextra','hsextra','horas_extra'],adelanto:['adelanto'],adelanto_personal:['adelanto']};
 if(!movement){if(explicit||salary||['bonificacion','comision','gasto_empresa','adelanto','adelanto_personal'].includes(kind)&&!(kind==='gasto_empresa'&&g.origen==='periodico_empleado'&&g.recurrenciaGenerada===true&&typeof g.reglaPeriodicaFbKey==='string'&&g.reglaPeriodicaFbKey))throw fail(409,'Falta el movimiento vinculado al gasto','SV_CAS_CONFLICT');return {path:null,movement:null,snapshots};}
 const permitted=types[kind]||(!kind?(explicit?['sueldo','haber','haberes','comision','bonificacion','adelanto','gasto_empresa','materiales','transporte','otro']:['gasto_empresa']):[]);
 if(!object(movement)||!permitted.includes(movement.tipo)||(movement.gastoFbKey||movement.gastoKey)!==expenseKey||['gastoFbKey','gastoKey'].some(k=>movement[k]!=null&&movement[k]!==''&&movement[k]!==expenseKey)||g.mes&&movement.mes&&g.mes!==movement.mes)throw fail(409,'El vínculo del gasto requiere revisión','SV_CAS_CONFLICT');
 return {path,movement,snapshots};
}
function createBonusPayment({authorize,db,guard,store,enabled=false,now=Date.now,reimbursement=false,expense=false}={}){
 if(typeof authorize!=='function'||!db||!guard?.run||!store?.readAsUser)throw Error('Falta el circuito de pago');
 async function access(actor,read){if(actor?.claims?.uid!==actor?.uid||!actor?.uid)throw fail(403,'Sesión requerida');const profile=await read('sv_chat_roles/'+actor.uid),cfg=profile?.rol?await read('sv_permisos/'+profile.rol):null,reset=await read('sv_access_resets/'+actor.uid);if(actor.claims.svPasswordChangeRequired===true||reset?.required===true||reset?.version!=null&&actor.claims.svAccessVersion!==reset.version)throw fail(403,'La sesión requiere volver a ingresar','SV_BONUS_PAYMENT_DENIED');return allowed(profile,cfg);}
 async function execute(actor,input){
  if(!enabled)throw fail(503,'El pago de bonificaciones todavía no está disponible','SV_BONUS_PAYMENT_DISABLED');
  const body=describe(input),captured=await access(actor,p=>store.read(p));
  const result=await guard.run({uid:actor.uid,claims:actor.claims,mode:'command',role:captured.role,permissionRevision:captured.permissionRevision,permissionDigest:captured.permissionDigest,opId:body.id,transportDigest:digest(body),recoverReceipt:true,operation:expense?'expense-payment':reimbursement?'expense-reimbursement':'bonus-payment',input:body},async scope=>{
   if(!same(await access(actor,p=>scope.get(p)),captured))throw fail(409,'Los permisos cambiaron','SV_LABOR_AUTH_CHANGED');
   const patch={},snapshots=new Map(),usedMovements=new Set(),ts=now(),fecha=new Date(ts).toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}),lot=body.items.length>1?(body.loteKey||'lote_bonus_'+body.id):null,rows=[];
   for(let i=0;i<body.items.length;i++){
    const item=body.items[i],path='sisventas/gastos/'+item.key,visible=await store.readAsUser(path,actor),g=await scope.get(path);
    if(g?.bajaAdministrativa)throw fail(409,'El gasto fue retirado. Actualizá la lista','SV_CAS_CONFLICT');
    if(!g||!same(visible,g)||!(expense?Model.isPayableExpense(g):reimbursement?Model.isReimbursement(g):Model.isBonus(g))||g.bajaAdministrativa)throw fail(403,'El gasto no está disponible para pagar','SV_BONUS_PAYMENT_DENIED');
    if(digest(Model.revisionData(g))!==item.expectedHash)throw fail(409,'El estado o saldo del gasto cambió. Actualizá la lista','SV_CAS_CONFLICT');
    if(['pendiente_aprobacion','rechazado','anulado','pagado'].includes(Calc.normalizarEstadoGasto(g))||g.requiereAprobacion===true||!['aprobado','pendiente_pago','pagado_parcial',...((expense||reimbursement&&Model.isStandaloneExpense(g))?['pendiente']:[])].includes(String(g.estado||'').toLowerCase()))throw fail(409,'La bonificación no tiene saldo aprobado para pagar','SV_CAS_CONFLICT');
    const resolution=expense?await resolveExpenseMovement(g,item.key,scope):null;
    const standalone=expense?!resolution.path:reimbursement&&Model.isStandaloneExpense(g),movementPath=expense?resolution.path:standalone?null:linkedPath(g,reimbursement),m=expense?resolution.movement:movementPath?await scope.get(movementPath):null,employee=movementPath?movementPath.split('/')[2]:String(g.empleadoFbKey||g.empleadoId||'');
    if(expense){for(const [p,v]of resolution.snapshots)snapshots.set(p,v);}
    if(!expense&&standalone){if(g.empleadoId&&g.empleadoFbKey&&g.empleadoId!==g.empleadoFbKey)throw fail(409,'El empleado del gasto requiere revisión','SV_CAS_CONFLICT');const derived='sisventas/ctaemp/'+key(employee)+'/gasto_empresa_'+item.key;const possible=await scope.get(derived);if(possible!==null)throw fail(409,'El gasto tiene un movimiento vinculado. Requiere revisión','SV_CAS_CONFLICT');snapshots.set(derived,null);}
    if(!standalone&&(usedMovements.has(movementPath)||!object(m)||(!expense&&(reimbursement?!['transporte','materiales','gasto_empresa','otro'].includes(m.tipo):m.tipo!=='bonificacion'))||(m.gastoFbKey||m.gastoKey)!==item.key||m.bajaAdministrativa||['rechazado','anulado','pendiente_aprobacion'].includes(String(m.estado||'').toLowerCase())||['empleadoId','empleadoFbKey'].some(k=>m[k]!=null&&m[k]!==''&&String(m[k])!==employee)||m.legacyKey&&m.legacyKey!==movementPath.slice('sisventas/'.length)||Number(m.monto)!==Number(g.monto)||(m.periodoComputo??null)!==(g.periodoComputo??null)))throw fail(409,'El gasto y su movimiento requieren revisión','SV_CAS_CONFLICT');
    if(expense&&m&&(m.requiereAprobacion===true||m.tipo==='comision'&&!g.aprobadoTs&&!g.aprobadoPor&&!g.fechaAprobacion&&g.estado!=='aprobado'&&!m.aprobadoTs&&!m.aprobadoPor&&!m.fechaAprobacion&&m.estado!=='aprobado'))throw fail(409,'La comisión o el movimiento requiere aprobación','SV_CAS_CONFLICT');
    if(movementPath)usedMovements.add(movementPath);
    const total=Number(g.monto),previous=paymentTotal(g),priorMovement=standalone?previous:paymentTotal(m);
    if(!Number.isFinite(total)||total<=0||!Number.isFinite(previous)||previous<0||previous>total||Object.values(g.pagos||{}).some(p=>!object(p)||!Number.isFinite(Number(p.monto))||Number(p.monto)<0)||Math.abs(previous-priorMovement)>0.000001||!standalone&&!same(g.pagos||{},m.pagos||{})||item.monto>Money.sum([total,-previous]))throw fail(409,'El saldo de la bonificación cambió','SV_CAS_CONFLICT');
    const paymentKey='pago_bonus_'+body.id+'_'+i,gPayments=mapPayments(g.pagos),mPayments=mapPayments(m?.pagos);
    if(gPayments[paymentKey]||mPayments[paymentKey])throw fail(409,'Este pago ya está registrado','SV_CAS_CONFLICT');
    const full=body.comprobante,light=full?{nombre:full.nombre,tipo:full.tipo,externo:true}:null,payment={fecha,ts,monto:item.monto,medio:body.medio,usuario:captured.name||actor.claims.name||'Usuario autorizado',rol:captured.role,lotePagoKey:lot,comprobante:light},amount=Money.sum([previous,item.monto]),state=Money.cents(Money.decimal(amount))>=Money.cents(Money.decimal(total))?'pagado':'pagado_parcial';
    const nextG=copy(g),nextM=m?copy(m):null;nextG.pagos=gPayments;if(nextM)nextM.pagos=mPayments;nextG.pagos[paymentKey]=copy(payment);if(nextM)nextM.pagos[paymentKey]=copy(payment);
    for(const next of [nextG,nextM].filter(Boolean)){next.montoPagado=amount;next.estado=state;if(!Object.keys(g.pagos||{}).length&&previous>0)next.saldoPagadoLegacy=previous;}
    nextG.medio=body.medio;if(state==='pagado')nextG.reembolsado=true;if(nextM){nextM.fechaPago=fecha;nextM.medioPago=body.medio;}
    patch[path]=nextG;snapshots.set(path,g);if(movementPath){patch[movementPath]=nextM;snapshots.set(movementPath,m);}
    if(full){const attachment='sisventas/gastos_adjuntos/'+item.key+'/pagos/'+paymentKey+'/comprobanteData';if(await scope.get(attachment)!==null)throw fail(409,'El comprobante ya existe','SV_CAS_CONFLICT');snapshots.set(attachment,null);patch[attachment]=full.data;}
    rows.push({gastoFbKey:item.key,descripcion:g.descripcion||'',monto:total,saldoPagado:item.monto});
   }
   if(lot){const p='sisventas/pagos_realizados/'+lot;if(await scope.get(p)!==null)throw fail(409,'El lote ya existe','SV_CAS_CONFLICT');snapshots.set(p,null);patch[p]={fecha,ts,medio:body.medio,monto:Money.sum(body.items.map(x=>x.monto)),usuario:captured.name||actor.claims.name||'Usuario autorizado',rol:captured.role,comprobante:body.comprobante||null,gastos:rows};}
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
  const updates=[];for(let i=0;i<body.items.length;i++){const item=body.items[i],g=await store.readAsUser('sisventas/gastos/'+item.key,actor),paymentKey='pago_bonus_'+body.id+'_'+i,payment=g?.pagos?.[paymentKey];if(!g||!payment)throw fail(409,'El pago quedó confirmado. Actualizá Gastos para ver su estado','SV_LABOR_COMMIT_UNCONFIRMED');updates.push({key:item.key,montoPagado:g.montoPagado,estado:g.estado,saldoPagadoLegacy:g.saldoPagadoLegacy??null,medio:g.medio||'',reembolsado:g.reembolsado===true,paymentKey,payment:copy(payment)});}
  return {ok:true,committed:true,keys:body.items.map(x=>x.key),updates};
 }
 return {authorize,execute};
}
module.exports={createBonusPayment,describe,allowed,linkedPath,resolveExpenseMovement,mapPayments,paymentTotal};
