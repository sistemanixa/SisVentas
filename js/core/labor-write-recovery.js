(function(root,factory){
 'use strict';const create=factory();
 if(typeof module==='object'&&module.exports)module.exports={create};
 if(root&&!root.SVLaborWriteRecovery)root.SVLaborWriteRecovery=create(root);
})(typeof window==='object'?window:null,function(){
 'use strict';const STORAGE_KEY='sisventas:labor-write-attempts:v1';
 const fail=(code,message)=>Object.assign(Error(message),{code});
 return function create(root){
  const attempts=new Map(),removed=new Set();let loadedUid=null,checking=false,layer=null,previousFocus=null,restoreScroll=null,keyboard=null,focusin=null;
  function uid(){return root.currentUserUid&&root.fbAuth?.currentUser?.uid===root.currentUserUid?root.currentUserUid:null;}
  const metadata=()=>[...attempts.values()].map(({uid,id,digest})=>({uid,id,digest}));
  const storageId=attempt=>JSON.stringify([attempt.uid,attempt.id]);
  function stored(){let rows=[];try{rows=JSON.parse(root.sessionStorage.getItem(STORAGE_KEY)||'[]');}catch(_){return[];}return Array.isArray(rows)?rows.filter(a=>typeof a?.uid==='string'&&a.uid.length>0&&a.uid.length<=128&&/^[a-zA-Z0-9_-]{8,160}$/.test(a.id||'')&&/^[a-f0-9]{64}$/.test(a.digest||'')).map(({uid,id,digest})=>({uid,id,digest})):[];}
  function persist(required=false){try{const all=new Map(stored().filter(a=>!removed.has(storageId(a))).map(a=>[storageId(a),a]));for(const a of metadata())all.set(storageId(a),a);if(all.size)root.sessionStorage.setItem(STORAGE_KEY,JSON.stringify([...all.values()]));else root.sessionStorage.removeItem(STORAGE_KEY);removed.clear();}catch(error){if(required)throw fail('SV_LABOR_RECOVERY_STORAGE','No se pudo preparar el guardado. Reintentá.');}}
  function pending(){const current=uid();return [...attempts.values()].find(attempt=>attempt.uid===current&&attempt.status!=='sending');}
  function state(){const attempt=pending();return attempt?{uid:attempt.uid,id:attempt.id,digest:attempt.digest,status:checking?'checking':'unknown',count:[...attempts.values()].filter(a=>a.uid===attempt.uid&&a.status!=='sending').length}:null;}
  function render(){
   const current=state(),document=root.document;
   if(!current){
    layer?.remove();layer=null;document?.removeEventListener?.('keydown',keyboard,true);document?.removeEventListener?.('focusin',focusin,true);keyboard=null;focusin=null;
    restoreScroll?.();restoreScroll=null;root.svSincronizarPilaModales?.();
    if(previousFocus?.isConnected)previousFocus.focus?.({preventScroll:true});previousFocus=null;return;
   }
   if(!document?.createElement||!document.body)return;
   if(!layer){
    previousFocus=document.activeElement;
    layer=document.createElement('section');layer.id='sv-labor-write-recovery';layer.className='modal-overlay open sv-labor-write-recovery';
    layer.setAttribute('role','alertdialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','Confirmación del guardado');layer.setAttribute('aria-describedby','sv-labor-recovery-status');
    layer.style.cssText='position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);place-items:center!important;padding:16px;box-sizing:border-box;pointer-events:auto;background:rgba(0,0,0,.64);overscroll-behavior:contain';
    const card=document.createElement('div');card.className='sv-data-status';card.style.cssText='pointer-events:auto;width:min(480px,100%);min-width:0;max-height:calc(100dvh - 32px);overflow:auto;padding:24px;margin:0;align-items:center;text-align:center;border:1px solid var(--border,#34425c);border-radius:14px;background:var(--bg2,#111c2e);color:var(--text,#eef0f5);box-sizing:border-box;box-shadow:0 12px 36px #0007';
    card.tabIndex=-1;card.style.overscrollBehavior='contain';
    const message=document.createElement('p');message.id='sv-labor-recovery-status';message.setAttribute('role','status');message.setAttribute('aria-live','polite');
    const button=document.createElement('button');button.type='button';button.className='btn btn-primary';button.style.cssText='align-self:center;background:#f0f2f5;color:#161b24;border:1px solid #f0f2f5;border-radius:8px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer';button.textContent='Consultar operación';button.onclick=()=>check().catch(()=>{});
    card.append(message,button);layer.append(card);
    const native=Array.from(document.querySelectorAll?.('dialog[open]')||[]).filter(node=>node.matches?.(':modal')).pop();(native||document.body).append(layer);
    layer._message=message;layer._button=button;layer._card=card;
    const overflow=document.body.style.overflow,htmlOverflow=document.documentElement?.style.overflow;
    document.body.style.overflow='hidden';if(document.documentElement)document.documentElement.style.overflow='hidden';
    restoreScroll=()=>{document.body.style.overflow=overflow;if(document.documentElement)document.documentElement.style.overflow=htmlOverflow;};
    const focus=()=>{(button.disabled?card:button).focus?.({preventScroll:true});};
    keyboard=event=>{if(!layer)return;if(event.key==='Tab'||event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation?.();if(event.key==='Tab')focus();}};
    focusin=event=>{if(layer&&!layer.contains(event.target))focus();};
    document.addEventListener?.('keydown',keyboard,true);document.addEventListener?.('focusin',focusin,true);
    layer.addEventListener?.('click',event=>{event.stopPropagation();if(event.target===layer){event.preventDefault();focus();}});
    layer.addEventListener?.('touchmove',event=>{if(!card.contains(event.target))event.preventDefault();},{passive:false});
    root.svSincronizarPilaModales?.();focus();
   }
   layer._message.textContent=checking?'Comprobando guardado…':'No se pudo confirmar el guardado. Consultá la operación antes de volver a guardar.';
   layer._button.disabled=checking;
  }
  function emit(){
   try{render();}catch(_){/* La presentación no cambia la confirmación financiera. */}
   try{if(root.CustomEvent)root.document?.dispatchEvent?.(new root.CustomEvent('sisventas:labor-write-recovery',{detail:state()}));}catch(_){}
  }
  function restore(){
   const current=uid();if(!current||loadedUid===current)return;loadedUid=current;
   for(const item of stored())if(item.uid===current)attempts.set(item.id,{uid:current,id:item.id,digest:item.digest,status:'unknown'});
   persist();emit();
  }
  function assertAvailable(){restore();if(pending())throw fail('SV_LABOR_PENDING_OPERATION','Hay un guardado sin confirmar. Consultá la operación antes de volver a guardar.');}
  function finish(attempt,result,error){
   if(attempts.get(attempt.id)!==attempt)return;
   attempts.delete(attempt.id);removed.add(storageId(attempt));persist();emit();
   if(!attempt.resolve)return;
   if(!error)try{attempt.validate();}catch(changed){error=changed;}
   if(error)attempt.reject(error);else attempt.resolve(result);
  }
  function uncertain(error){
   if(error?.statusCode===409&&['SV_BONUS_BATCH_CONFLICT','SV_BONUS_EMPLOYEE_UNAVAILABLE'].includes(error?.code))return false;
   if(['SV_LABOR_BUSY','SV_LABOR_AUTH_CHANGED','SV_LABOR_COMMISSION_LIMIT','SV_LABOR_LEASE_EXPIRED','SV_LABOR_READ_ONLY','SV_PAYMENTS_NOT_ENABLED','SV_PAYMENT_INDEX_INVALID','SV_PAYMENT_INDEX_INPUT','SV_PAYMENT_SCOPE_SIZE','SV_PAYMENT_SALE_MISSING','SV_PAYMENT_BALANCE_CHANGED','SV_PAYMENT_GROUP_EXISTS','SV_PAYMENT_KEY_EXISTS','SV_PAYMENT_WRITER_VERSION','SV_PAYMENT_RELATION_MAINTENANCE_REQUIRED','SV_ADMIN_EXPENSE_DISABLED','SV_GASTO_INDEX_UNREADY','SV_GASTO_INDEX_INVALID','SV_GASTO_DUPLICATE'].includes(error?.code))return false;
   if(error?.svLaborAttempted===false)return false;
   if(error?.code==='SV_LABOR_CANCELLED')return false;
   if(error?.code==='SV_LABOR_COMMIT_UNCONFIRMED')return true;
   if(error?.statusCode===409&&error?.code==='SV_CAS_CONFLICT')return false;
   return ![400,401,403].includes(error?.statusCode);
  }
  async function execute(meta,send,validate){
   validate();assertAvailable();if(meta.uid!==uid())throw fail('SV_LABOR_SESSION','La sesión cambió.');
   let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
   const attempt={uid:meta.uid,id:meta.id,digest:meta.digest,status:'sending',resolve,reject,validate};attempts.set(meta.id,attempt);
   try{persist(true);}catch(error){attempts.delete(meta.id);throw error;}
   Promise.resolve().then(send).then(result=>finish(attempt,result),error=>{if(attempts.get(attempt.id)===attempt){if(uncertain(error)){attempt.status='unknown';emit();}else finish(attempt,null,error);}});
   return promise;
  }
  async function check(id){
   restore();if(checking)return {status:'pending'};
   const attempt=id?attempts.get(id):pending();if(!attempt)return {status:'none'};
   const user=root.fbAuth?.currentUser,current=uid();if(!current||current!==attempt.uid||root._impersonacionOriginal)throw fail('SV_LABOR_SESSION','Volvé a tu cuenta para consultar el guardado.');
   checking=true;emit();
   try{
    const base=(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'');if(!base)throw Error('Servicio no disponible');
    const headers=await root.SVServiceAuth.headers({'Content-Type':'application/json'});
    if(uid()!==current||root.fbAuth.currentUser!==user)throw fail('SV_LABOR_SESSION','La sesión cambió.');
    const response=await root.fetch(base+'/laboral/operacion',{method:'POST',headers,body:JSON.stringify({id:attempt.id,digest:attempt.digest}),cache:'no-store',signal:AbortSignal.timeout(20000)});
    const data=await response.json();if(uid()!==current||root.fbAuth.currentUser!==user)throw fail('SV_LABOR_SESSION','La sesión cambió.');
    if(!response.ok||data.ok!==true)throw Error(data.mensaje||'No se pudo comprobar el guardado.');
    if(data.status==='confirmed'){finish(attempt,{ok:true,committed:true,recovered:true});if(!attempt.resolve)root.notify?.('Guardado confirmado.');}
    else if(data.status==='rejected'){finish(attempt,null,fail('SV_LABOR_REJECTED',data.mensaje||'El intento no se guardó. Podés volver a intentarlo.'));if(!attempt.resolve)root.notify?.('El intento no se guardó. Podés volver a intentarlo.');}
    else if(data.status!=='pending')throw Error('No se recibió una confirmación definitiva.');
    return {status:data.status};
   }finally{checking=false;emit();}
  }
  function clear(){
   // Ending the UI/session is not evidence that an in-flight commit failed.
   // Retain only uid/id/digest for an explicit check on that user's next login.
   persist();const error=fail('SV_LABOR_SESSION','La sesión terminó.');for(const attempt of attempts.values())attempt.reject?.(error);attempts.clear();loadedUid=null;checking=false;emit();
  }
  root.document?.addEventListener?.('sisventas:session-ended',clear);
  root.document?.addEventListener?.('sisventas:session-ready',restore);
  return {execute,check,assertAvailable,restore,state,clear,STORAGE_KEY};
 };
});
