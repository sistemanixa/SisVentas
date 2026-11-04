(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./dashboard-budget-notice-adapter-proposal'):root.SVBudgetNoticeAdapterProposal);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardBudgetNoticeConsumer=api;})(typeof globalThis==='object'?globalThis:this,function(Adapter){
 'use strict';
 const retired=()=>Object.assign(Error('Budget notice consumer context retired'),{code:'SV_BUDGET_NOTICE_CONSUMER_RETIRED'});
 const denied=e=>[401,403].includes(e?.statusCode)||[401,403].includes(e?.status)||e?.code==='SV_BUDGET_SOURCE_RETIRED';
 const fields=['uid','role','permissionRevision','permissionSignature','sessionEpoch','dataEpoch','auth','user','db','timeZone','sourceLocale','grantsKey'];
 function create({capture,valid,source,enabled=()=>false}={}){
  if(typeof capture!=='function'||typeof valid!=='function'||typeof source?.peek!=='function'||typeof enabled!=='function'||!Adapter)throw TypeError('Missing budget notice consumer ports');
  // A view-local clone belongs to one Source delivery; never a second global list.
  let cached=null,withdrawn=null;
  function drop(){if(cached)withdrawn={data:cached.data,sequence:cached.sequence};cached=null;}
  function pin(){const c=capture(),user=c?.auth?.currentUser;if(!c||c.allowed!==true||c.viewing||!user||user.uid!==c.uid||!c.db||!Number.isSafeInteger(c.permissionRevision)||c.permissionRevision<0||typeof c.permissionSignature!=='string'||!c.permissionSignature.trim()||!Number.isSafeInteger(c.sessionEpoch)||c.sessionEpoch<0||!Number.isSafeInteger(c.dataEpoch)||c.dataEpoch<0||c.grants?.presupuestos!==(c.role==='admin'?'all':'own')||!valid(c))throw retired();return {context:c,...Object.fromEntries(fields.map(f=>[f,c[f]])),user,grantsKey:JSON.stringify(['ventas','pagos','ordenes_trabajo','presupuestos'].map(d=>c.grants?.[d]??null))};}
  function peek(){
   if(enabled()!==true){cached=null;withdrawn=null;return {status:'off',rows:null,complete:false,error:null,revalidating:false};}
   let view;
   try{
    view=source.peek('notices');const p=pin();
    if(denied(view?.error)){drop();if(view.data)withdrawn={data:view.data,sequence:view.sequence};return {...view,rows:null,complete:false,revalidating:false};}
    if(!view?.data){drop();return {status:view?.status||'idle',error:view?.error||null,revalidating:view?.revalidating===true,rows:null,complete:false};}
    if(!['ready','loading','error'].includes(view.status)||!Number.isSafeInteger(view.sequence)||view.sequence<1)throw retired();
    if(cached&&cached.data===view.data&&cached.sequence===view.sequence){
     if(!fields.every(f=>cached.pin[f]===p[f]))throw retired();
     // This clone was already validated. Connection drift does not change its
     // authority; new deliveries still pass the unchanged adapter's full pin.
    }else{
     if(withdrawn?.data===view.data&&withdrawn.sequence===view.sequence)throw retired();
     const snapshot=Adapter.adapt(view.data,p.context,{expectedGeneration:view.data.generation,expectedRevision:view.data.revision});
     cached={data:view.data,sequence:view.sequence,pin:p,snapshot,rows:Adapter.rowsFor(snapshot,p.context)};
    }
    return {status:view.status,error:view.error||null,revalidating:view.revalidating===true,rows:cached.rows,complete:true,generation:cached.snapshot.generation,revision:cached.snapshot.revision};
   }catch(error){drop();return {status:'error',error:denied(view?.error)?view.error:error,revalidating:false,rows:null,complete:false};}
  }
  return Object.freeze({peek,reset:drop});
 }
 return Object.freeze({create});
});
