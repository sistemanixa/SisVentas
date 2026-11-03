(function(root,factory){'use strict';const create=factory();if(typeof module==='object'&&module.exports)module.exports={create};if(root)root.SVBonusPayments=create(root);})(typeof window==='object'?window:null,function(){
 'use strict';const fail=(code,message,statusCode)=>Object.assign(Error(message),{code,statusCode,httpStatus:statusCode});
 function canonical(v){if(v==null)return'null';if(Array.isArray(v))return'['+v.map(canonical).join(',')+']';if(typeof v==='object')return'{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
 return function create(root){let active=null;
  async function hash(value){const b=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
  function context(){const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,revision=root.PERMISOS_ROLES?.[role]?.indiceRevision,epoch=root._svOperacionesSesionEpoch||0,valid=root.svCapturarContextoOperacion?.();return function check(){
   if(root._impersonacionOriginal||!uid||user?.uid!==uid||root.currentUserUid!==uid||root.fbAuth?.currentUser!==user||root.currentRole!==role||root.PERMISOS_ROLES?.[role]?.indiceRevision!==revision||(root._svOperacionesSesionEpoch||0)!==epoch||valid&&!valid())throw fail('SV_LABOR_SESSION','La sesión cambió. Revisá el pago antes de continuar.',403);
   if(!root.tienePermiso?.('gastos.pagar')||!root.tienePermiso?.('gastos.administrar'))throw fail('SV_BONUS_PAYMENT_DENIED','No tenés permiso para pagar gastos.',403);
  };}
  async function pay(cargas,medio,comprobante,loteKey,reimbursement=false){
   const signature=canonical({cargas,medio,comprobante,reimbursement,loteKey:loteKey||null}),uid=root.currentUserUid;
   if(active){active.check();if(active.uid!==uid||active.signature!==signature)throw fail('SV_PAYMENT_ATTEMPT_CHANGED','Hay un pago en curso. Esperá su confirmación.',409);return active.promise;}
   const check=context();check();root.SVLaborWriteRecovery?.assertAvailable();
   if(!root.SVLaborWriteRecovery?.execute||!root.SVBonusPaymentModel||!root.crypto?.randomUUID)throw fail('SV_BONUS_PAYMENT_DISABLED','Actualizá SisVentas para registrar este pago.',503);
   const state={uid,signature,check,promise:null};active=state;
   state.promise=(async()=>{
    const initial=new Map(),body={id:root.crypto.randomUUID(),items:[],medio:String(medio||'')};
    if(loteKey)body.loteKey=String(loteKey);
    if(comprobante){const data=comprobante.data||comprobante.base64||'',type=comprobante.tipo||comprobante.type||String(data).match(/^data:([^;]+);/)?.[1]||'';body.comprobante={nombre:String(comprobante.nombre||comprobante.name||'Comprobante'),tipo:type,data};}
    for(const item of cargas||[]){let g=(root.gastosData||[]).find(g=>g.fbKey===item.fbKey);if(g?._svListSummary===true&&root.SVRecordLists){g=await root.SVRecordLists.detail('gastos',String(item.fbKey));check();}if(g?.bajaAdministrativa)throw fail('SV_CAS_CONFLICT','El gasto fue retirado. Actualizá la lista.',409);if(!(reimbursement==='expense'?root.SVBonusPaymentModel.isPayableExpense(g):reimbursement?root.SVBonusPaymentModel.isReimbursement(g):root.SVBonusPaymentModel.isBonus(g)))throw fail('SV_BONUS_PAYMENT_INVALID',reimbursement==='expense'?(g?.esFijoBase?'Este registro es una plantilla recurrente, no un gasto mensual para pagar.':'El gasto ya no está disponible. Actualizá la lista.'):reimbursement?'Este gasto no está disponible para reembolsar.':'Elegí sólo bonificaciones para este pago.',400);if(root.SVCommercialMoney){const money=root.SVCommercialMoney,values=Object.values(g.pagos||{}),paid=values.length?money.sum([Number(g.saldoPagadoLegacy)||0,...values.filter(p=>p&&p.anulado!==true&&p.estado!=='anulado').map(p=>Number(p.monto))]):Number(g.montoPagado)||0;if(!money.isAmount(Number(item.monto))||!(Number(item.monto)>0)||Number(item.monto)>money.sum([Number(g.monto),-paid]))throw fail('SV_CAS_CONFLICT','El saldo del gasto cambió. Actualizá la pantalla.',409);}initial.set(String(item.fbKey),canonical(root.SVBonusPaymentModel.revisionData(g)));body.items.push({key:String(item.fbKey),monto:Number(item.monto),expectedHash:await hash(root.SVBonusPaymentModel.revisionData(g))});check();}
    if(!body.items.length)throw fail('SV_BONUS_PAYMENT_INVALID','No hay bonificaciones para pagar.',400);
    const digest=await hash(body);check();
    async function send(){let attempted=false,release;try{
     if(root.SVForegroundSession?.waitVisible)await root.SVForegroundSession.waitVisible();check();
     if(root.navigator?.onLine===false)throw Object.assign(fail('SV_BONUS_PAYMENT_OFFLINE','Sin conexión. Volvé a intentar cuando haya Internet.',400),{svLaborAttempted:false});
     const base=String(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,''),headers=await root.SVServiceAuth.headers({'Content-Type':'application/json'});check();if(!base)throw fail('SV_BONUS_PAYMENT_DISABLED','Servicio no disponible.',400);
     release=root.SVForegroundSession?.holdDatabase?.();attempted=true;
     const response=await root.fetch(base+(reimbursement==='expense'?'/laboral/gastos/pagar':reimbursement?'/laboral/gastos/reembolsar':'/laboral/bonificaciones/pagar'),{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(90000)}),data=await response.json().catch(()=>null);check();
     if(!response.ok||data?.ok!==true||data?.committed!==true)throw fail(data?.code||'SV_LABOR_COMMIT_UNCONFIRMED',data?.mensaje||'No se pudo confirmar el pago. Consultá la operación antes de repetirla.',response.status||503);
     if(!Array.isArray(data.updates)||data.updates.length!==body.items.length||new Set(data.updates.map(x=>x.key)).size!==body.items.length||data.updates.some(x=>!body.items.some(i=>i.key===x.key)||!x.payment||typeof x.paymentKey!=='string'))throw fail('SV_LABOR_COMMIT_UNCONFIRMED','El pago quedó confirmado. Actualizá Gastos para ver su estado.',409);
     return data;
    }catch(e){e.svLaborAttempted=attempted;throw e;}finally{release?.();}}
    let result=await root.SVLaborWriteRecovery.execute({uid,id:body.id,digest},send,check);
    while(result?.recovered===true){check();result=await root.SVLaborWriteRecovery.execute({uid,id:body.id,digest},send,check);}
    check();for(const row of result.updates){const g=(root.gastosData||[]).find(x=>x.fbKey===row.key);if(g&&canonical(root.SVBonusPaymentModel.revisionData(g))===initial.get(row.key)){Object.assign(g,{montoPagado:row.montoPagado,estado:row.estado,saldoPagadoLegacy:row.saldoPagadoLegacy??g.saldoPagadoLegacy,medio:row.medio,reembolsado:row.reembolsado});if(Array.isArray(g.pagos))g.pagos=Object.fromEntries(g.pagos.map((p,i)=>['legacy_'+i,p]));g.pagos=g.pagos||{};g.pagos[row.paymentKey]=row.payment;}}
    root._gastosPagosCache=typeof WeakMap==='function'?new WeakMap():null;root._gastosFechaImputacionCache=typeof WeakMap==='function'?new WeakMap():null;
    if(root._paginaGastosActiva?.()){root.renderTablaGastos?.();root.actualizarMetricasGastos?.();}return true;
   })();
   try{return await state.promise;}finally{if(active===state)active=null;}
  }
  async function adjust(gasto,pago,token,cambios,accion,motivo){
   // Correction has its own permission; paying never grants correction.
   if(!root.tienePermiso?.('gastos.corregirPago'))throw fail('SV_BONUS_PAYMENT_DENIED','No tenés permiso para corregir pagos.',403);
   // Session guard is shared, but correction does not require the separate pay action.
   const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,rev=root.PERMISOS_ROLES?.[role]?.indiceRevision,epoch=root._svOperacionesSesionEpoch||0;
   const valid=()=>{if(root._impersonacionOriginal||!uid||root.currentUserUid!==uid||root.fbAuth?.currentUser!==user||user?.uid!==uid||root.currentRole!==role||root.PERMISOS_ROLES?.[role]?.indiceRevision!==rev||(root._svOperacionesSesionEpoch||0)!==epoch||!root.tienePermiso?.('gastos.administrar')||!root.tienePermiso?.('gastos.corregirPago'))throw fail('SV_LABOR_SESSION','La sesión o los permisos cambiaron.',403);};
   valid();root.SVLaborWriteRecovery?.assertAvailable();
   if(!root.SVLaborWriteRecovery?.execute)throw fail('SV_BONUS_PAYMENT_DISABLED','Actualizá SisVentas.',503);
   let full=gasto;if(gasto?._svListSummary&&root.SVRecordLists)full=await root.SVRecordLists.detail('gastos',gasto.fbKey);valid();
   const changes=accion==='anulacion'?{}:{monto:Number(cambios.monto??pago.monto),fecha:cambios.fecha??pago.fecha,medio:cambios.medio??pago.medio};
   if(cambios.comprobante){const c=cambios.comprobante;changes.comprobante={nombre:c.nombre,tipo:c.tipo,data:c.data||c.base64};}
   const body={id:root.crypto.randomUUID(),key:String(gasto.fbKey),paymentKey:String(token),expectedHash:await hash(root.SVBonusPaymentModel.revisionData(full)),action:accion,reason:String(motivo||''),changes},signature=await hash(body);valid();
   async function send(){let attempted=false,release;try{valid();if(root.navigator?.onLine===false)throw fail('SV_BONUS_PAYMENT_OFFLINE','Sin conexión.',400);const base=String(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,''),headers=await root.SVServiceAuth.headers({'Content-Type':'application/json'});valid();release=root.SVForegroundSession?.holdDatabase?.();attempted=true;const response=await root.fetch(base+'/laboral/gastos/corregir-pago',{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(90000)}),data=await response.json();valid();if(!response.ok||data?.ok!==true||data?.committed!==true||data.key!==body.key||!data.update)throw fail(data?.code||'SV_LABOR_COMMIT_UNCONFIRMED',data?.mensaje||'Consultá el estado antes de repetir.',response.status);return data;}catch(e){e.svLaborAttempted=attempted;throw e;}finally{release?.();}}
   let result=await root.SVLaborWriteRecovery.execute({uid,id:body.id,digest:signature},send,valid);while(result?.recovered===true)result=await root.SVLaborWriteRecovery.execute({uid,id:body.id,digest:signature},send,valid);valid();
   Object.assign(gasto,result.update);root._gastosPagosCache?.delete(gasto);root._gastosFechaImputacionCache?.delete(gasto);return true;
  }
  return {pay,adjust};
 };
});
