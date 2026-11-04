(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardBudgetFreshRTDB=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const ROOT='sv_dashboard_budget_proposal/v1',fail=(statusCode=503)=>Object.assign(Error('Fresh RTDB read unavailable'),{code:'SV_BUDGET_FRESH_DENIED',statusCode:Number.isInteger(statusCode)?statusCode:503});
function create({databaseURL,expectedOrigin,allowLoopback=false,auth,fetchImpl=globalThis.fetch,requestMs=10000}={}){
 let base;try{base=new URL(databaseURL);}catch(_){throw fail();}const local=base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname);
 const firebaseHost=/^[a-z0-9-]+(?:\.[a-z0-9-]+)?\.firebasedatabase\.app$/.test(base.hostname)||/^[a-z0-9-]+\.firebaseio\.com$/.test(base.hostname);
 if(base.origin!==expectedOrigin||!(base.protocol==='https:'&&firebaseHost&&!base.port||local&&allowLoopback===true)||!Number.isInteger(requestMs)||requestMs<100||requestMs>30000||base.hash||!local&&base.search||base.username||base.password||!['','/'].includes(base.pathname)||[...base.searchParams.keys()].some(k=>k!=='ns')||typeof auth?.currentUser?.getIdToken!=='function'||typeof fetchImpl!=='function')throw fail();
 return async function readFresh(spec){
  if(!spec||typeof spec!=='object'||Array.isArray(spec))throw fail(400);
  const user=auth.currentUser;if(!user||typeof user.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(user.uid))throw fail();
  const ownHeader=spec.path===ROOT+'/read/'+user.uid,index=/^sv_dashboard_budget_proposal\/v1\/(document|noticeBadge)\/(all|u_[A-Za-z0-9_-]{1,128})$/.exec(spec.path||'');
  if(!ownHeader&&!index||Object.keys(spec).some(k=>!['path','orderByKey','startAt','limitToFirst'].includes(k)))throw fail();
  if(ownHeader&&Object.keys(spec).length!==1||index&&(spec.orderByKey!==true||!Number.isInteger(spec.limitToFirst)||spec.limitToFirst<2||spec.limitToFirst>(index[1]==='document'?5:50)||index[1]==='document'&&(Object.hasOwn(spec,'startAt')||spec.limitToFirst!==5)||index[1]==='noticeBadge'&&(typeof spec.startAt!=='string'||spec.startAt.length>768||!/^[a-f0-9]+!(?:[a-f0-9]{64})?$/.test(spec.startAt))))throw fail(400);
  let token;try{token=await user.getIdToken();}catch(_){throw fail();}if(typeof token!=='string'||!token||auth.currentUser!==user)throw fail();
  const url=new URL(spec.path.split('/').map(encodeURIComponent).join('/')+'.json',base);if(local&&base.searchParams.has('ns'))url.searchParams.set('ns',base.searchParams.get('ns'));url.searchParams.set('auth',token);
  if(index){url.searchParams.set('orderBy',JSON.stringify('$key'));url.searchParams.set('limitToFirst',String(spec.limitToFirst));if(Object.hasOwn(spec,'startAt'))url.searchParams.set('startAt',JSON.stringify(spec.startAt));}
  let response,value;try{response=await fetchImpl(url,{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(requestMs)});if(!response.ok){await response.body?.cancel();throw fail(response.status);}value=await response.json();}catch(error){if(error.code==='SV_BUDGET_FRESH_DENIED')throw error;throw fail();}
  if(auth.currentUser!==user||index&&(value!==null&&(typeof value!=='object'||Array.isArray(value))))throw fail();
  return {val:()=>value,forEach(fn){if(value===null)return;for(const key of Object.keys(value).sort())fn({key,val:()=>value[key]});}};
 };
}
return Object.freeze({create});
});
