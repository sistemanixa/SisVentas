(function(root){
 'use strict';
 function create(env){
  let entries=new WeakMap(),generation=0,disposed=false;
  const liveEntries=new Set(),events=['sisventas:page-changed','sisventas:session-ended','sisventas:session-ready','sisventas:role-changed'];
  const validKey=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(k)&&!['constructor','prototype','__proto__'].includes(k);
  const idle=()=>({status:'idle',payments:null,complete:false});
  function context(){const role=env.currentRole,detail=env.document?.getElementById?.('venta-detalle-view');return {uid:env.currentUserUid,user:env.fbAuth?.currentUser,auth:env.fbAuth,db:env.fbDB,role,permissionRevision:env.PERMISOS_ROLES?.[role]?.indiceRevision,epoch:env._svOperacionesSesionEpoch||0,route:env.location?.hash,viewAs:env._impersonacionOriginal,selected:env._ventaDetalleActual,visible:!env.document?.hidden&&!!detail&&!detail.hidden&&detail.style.display!=='none',allowed:env.permisoModulo?.('venta')===true||env.permisoModulo?.('detalle')===true};}
  function current(e){const c=context(),s=e.context;return !disposed&&e.generation===generation&&c.visible&&c.allowed&&!c.viewAs&&c.uid&&c.user?.uid===c.uid&&['uid','user','auth','db','role','permissionRevision','epoch','route','viewAs'].every(k=>c[k]===s[k])&&(c.selected===s.selected||c.selected===e.fresh)&&c.selected?.fbKey===e.key;}
  function cancel(e){e.loading?.cancel();e.loading=null;liveEntries.delete(e);}
  function reset(record){generation++;for(const e of liveEntries)cancel(e);entries=new WeakMap();}
  function blockedCurrent(e){const c=context(),s=e.context;return !disposed&&e.generation===generation&&['uid','user','auth','db','role','permissionRevision','epoch','route','viewAs','selected'].every(k=>c[k]===s[k]);}
  function state(record){const e=record&&entries.get(record);return e&&(current(e)||e.blocked&&blockedCurrent(e))?structuredClone(e.state):idle();}
  function validate(data,key){
   const h=data?.paymentHistory,r=data?.record;
   if(data?.ok!==true||!r||typeof r!=='object'||Array.isArray(r)||data.fbKey!==undefined&&data.fbKey!==key||r.fbKey!==undefined&&r.fbKey!==key||h?.schema!==1||!['global','embedded','legacy'].includes(h.source)||h.complete!==true||!Array.isArray(h.payments)||typeof h.paidAmount!=='number'||!Number.isFinite(h.paidAmount)||h.paidAmount<0)throw Error('No se pudo verificar el historial de pagos.');
   if(h.source==='legacy'&&h.payments.length)throw Error('La fuente histórica no contiene un detalle de pagos verificado.');
   const seen=new Set(),metadataId=v=>typeof v==='string'||typeof v==='number'&&Number.isFinite(v),payments=h.payments.map(p=>{
    if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.monto!=='number'||!Number.isFinite(p.monto)||p.monto<0||typeof p.hasReceipt!=='boolean'||p.fecha!=null&&!['string','number'].includes(typeof p.fecha)||typeof p.fecha==='number'&&!Number.isFinite(p.fecha)||['medio','nota','estado'].some(k=>p[k]!==undefined&&typeof p[k]!=='string')||p.anulado!==undefined&&typeof p.anulado!=='boolean'||['id','fbKey'].some(k=>p[k]!==undefined&&!metadataId(p[k])))throw Error('El historial de pagos está incompleto.');
    if(h.source==='global'){if(!validKey(p.fbKey)||seen.has(p.fbKey))throw Error('Falta la identidad original del pago global.');seen.add(p.fbKey);}
    // Embedded identities are presentation metadata only. Array order preserves
    // distinct old entries even when their optional IDs are absent or repeated.
    return Object.fromEntries(['fbKey','id','monto','fecha','medio','nota','anulado','estado','hasReceipt'].filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]));
   });
   return {record:{...structuredClone(r),fbKey:key},state:{status:'ready',source:h.source,payments,paidAmount:h.paidAmount,complete:true}};
  }
  function ensure(record,onReady,{retry=false}={}){
   if(!record||typeof record!=='object'||disposed)return Promise.resolve(idle());
   const old=entries.get(record);if(old?.blocked&&blockedCurrent(old)&&!retry)return old.promise;if(old&&current(old)&&(!retry||old.state.status==='pending'||old.state.status==='ready'))return old.promise;
   if(old&&current(old)&&old.state.status==='error'&&!retry)return old.promise;
   if(old)cancel(old);
   const e={key:record.fbKey,context:context(),generation,state:{status:'pending',payments:null,complete:false},fresh:null,loading:null};entries.set(record,e);
   if(!validKey(e.key)||!current(e)){e.blocked=true;e.state={status:'error',payments:null,complete:false,message:'No se pudo identificar la venta o verificar el acceso a sus pagos.'};e.promise=Promise.resolve().then(()=>{if(blockedCurrent(e)&&typeof onReady==='function')onReady(null,structuredClone(e.state));return structuredClone(e.state);});return e.promise;}
   liveEntries.add(e);e.loading=env.SVDataReadiness?.beginSource('salePaymentHistory','sale-payment-history:'+e.key);
   e.promise=(async()=>{let fresh=null;try{
    const data=await env.SVCommercialOwnership.request('ventas','registro/'+encodeURIComponent(e.key)+'?para=pagos');if(!current(e))return idle();
    const answer=validate(data,e.key);fresh=e.fresh=answer.record;e.state=answer.state;entries.set(fresh,e);e.loading?.ready();
   }catch(error){if(!current(e))return idle();e.state={status:'error',payments:null,complete:false,message:'No se pudieron cargar los pagos. Volvé a intentar.'};e.loading?.error(e.state.message);
   }finally{if(!current(e))cancel(e);}
   if(current(e)&&typeof onReady==='function')onReady(fresh,structuredClone(e.state));return structuredClone(e.state);
   })();return e.promise;
  }
  // A single opening owns the request and its response. No caller-supplied
  // response/ready flag can populate the ordinary history cache.
  function opening(isCurrent){
   if(typeof isCurrent!=='function')throw TypeError('Falta el contexto de apertura.');
   reset();const captured=context(),turn=generation,owner={loading:null};let used=false,consumed=false,cancelled=false,answer=null,key=null,loading=null;
   function check(){const c=context();if(disposed||cancelled||turn!==generation||!isCurrent()||!c.visible||!c.allowed||c.viewAs||!c.uid||c.user?.uid!==c.uid||captured.selected!=null||c.selected!==captured.selected||!['uid','user','auth','db','role','permissionRevision','epoch','route','viewAs'].every(k=>c[k]===captured[k]))throw Object.assign(Error('La apertura de la venta cambió.'),{name:'AbortError'});}
   return Object.freeze({
    async read(id){check();if(used||!validKey(id))throw Error('La lectura de apertura no se puede reutilizar.');used=true;key=id;loading=owner.loading=env.SVDataReadiness?.beginSource('salePaymentHistory','sale-payment-opening:'+key);liveEntries.add(owner);try{const data=await env.SVCommercialOwnership.request('ventas','registro/'+encodeURIComponent(key)+'?para=pagos');check();answer=validate(data,key);return structuredClone(answer.record);}catch(error){if(error.name==='AbortError')cancel(owner);else loading?.error('No se pudieron cargar la venta y sus pagos.');throw error;}},
    commit(record){check();if(consumed||!answer||!record||record.fbKey!==key||JSON.stringify(Object.fromEntries(Object.keys(answer.record).map(k=>[k,record[k]])))!==JSON.stringify(answer.record))throw Error('El original no corresponde a la consulta de apertura.');consumed=true;const e={key,context:captured,generation:turn,state:answer.state,fresh:record,loading,promise:Promise.resolve(structuredClone(answer.state))};entries.set(record,e);liveEntries.delete(owner);liveEntries.add(e);loading?.ready();answer=null;},
    cancel(){cancelled=true;answer=null;cancel(owner);loading=null;}
   });
  }
  const changed=()=>reset(),visibility=()=>{if(env.document?.hidden)reset();};
  for(const name of events)env.document?.addEventListener(name,changed);
  env.document?.addEventListener('visibilitychange',visibility);
  const detail=env.document?.getElementById?.('venta-detalle-view');
  const observer=detail&&env.MutationObserver?new env.MutationObserver(()=>{if(detail.hidden||detail.style.display==='none')reset();}):null;observer?.observe(detail,{attributes:true,attributeFilter:['style','hidden','class']});
  return Object.freeze({state,ensure,opening,reset,dispose(){if(disposed)return;reset();disposed=true;observer?.disconnect();for(const name of events)env.document?.removeEventListener(name,changed);env.document?.removeEventListener('visibilitychange',visibility);}});
 }
 root.SVSalePaymentHistory=Object.freeze({create});
 if(typeof module==='object'&&module.exports)module.exports={create};
})(typeof window==='object'?window:globalThis);
