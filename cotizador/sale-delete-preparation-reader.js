'use strict';
// One preparation/lease; no data or authorization cache survives a request.
const MiB=1024*1024;
const budgets=new Map([['sisventas/ordenes_trabajo',80*MiB],['sisventas/reclamos',32*MiB]]);
const failure=()=>Object.assign(Error('No se pudo verificar la preparación completa del borrado.'),{statusCode:503,code:'SV_SALE_DELETE_PREPARATION_READ'});
const sizeFailure=()=>Object.assign(Error('La preparación supera el alcance permitido.'),{statusCode:413,code:'SV_SALE_DELETE_PREPARATION_SIZE'});
const validKey=value=>typeof value==='string'&&value.length>0&&Buffer.byteLength(value)<=768&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(value);
function discard(response){try{void response?.body?.cancel?.().catch(()=>{});}catch(_){}}
async function boundedText(response,limit,signal,charge){
 if(!response.body?.getReader)throw failure();
 const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true}),pieces=[];
 let bytes=0;
 const abort=()=>{try{void reader.cancel().catch(()=>{});}catch(_){}};
 signal.addEventListener('abort',abort,{once:true});
 try{
  for(;;){
   if(signal.aborted)throw failure();
   const chunk=await reader.read();
   if(signal.aborted)throw failure();
   if(chunk.done)break;
   bytes+=chunk.value.byteLength;
   if(bytes>limit)throw sizeFailure();
   charge(chunk.value.byteLength);
   pieces.push(decoder.decode(chunk.value,{stream:true}));
  }
  pieces.push(decoder.decode());
  return pieces.join('');
 }finally{
  signal.removeEventListener('abort',abort);
  abort();
  try{reader.releaseLock();}catch(_){}
 }
}
function create({databaseURL,accessToken,fetchImpl=fetch,requestMs=20000}={}){
 let base;try{base=new URL(databaseURL);}catch(_){throw TypeError('Configuración de preparación inválida');}
 const local=['127.0.0.1','localhost'].includes(base.hostname),queryKeys=[...base.searchParams.keys()];
 if((base.protocol!=='https:'&&!(base.protocol==='http:'&&local))||base.username||base.password||base.hash||base.pathname!=='/'||base.search&&(!local||base.protocol!=='http:'||queryKeys.length!==1||queryKeys[0]!=='ns'||!base.searchParams.get('ns'))||typeof accessToken!=='function'||typeof fetchImpl!=='function'||!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>2147483647)throw TypeError('Configuración de preparación inválida');
 const namespace=local?base.searchParams.get('ns'):null;
 base.search='';
 const active=new Set();let current=null,disposed=false,failed=false;
 function live(state){if(disposed||failed||current!==state)throw failure();}
 function stop(){failed=true;for(const controller of active)controller.abort();}
 async function get(state,root,key,shallow){
  live(state);
  if(!budgets.has(root)||!shallow&&!validKey(key)||active.size>=6)throw failure();
  const controller=new AbortController();active.add(controller);
  let response,timer,onAbort;
  try{
   const work=async()=>{
    const token=await accessToken();
    live(state);
    if(controller.signal.aborted||typeof token!=='string'||!token||/[\x00-\x20\x7f]/.test(token))throw failure();
    const target=new URL(root+(shallow?'':'/'+encodeURIComponent(key))+'.json',base);
    if(namespace)target.searchParams.set('ns',namespace);
    if(shallow)target.searchParams.set('shallow','true');
    response=await fetchImpl(target,{method:'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},cache:'no-store',redirect:'error',signal:controller.signal});
    if(disposed||failed||controller.signal.aborted||current!==state){discard(response);throw failure();}
    if(response.status!==200||!response.ok){discard(response);throw failure();}
    const text=await boundedText(response,shallow?MiB:budgets.get(root),controller.signal,bytes=>{
     live(state);const total=(state.bytes.get(root)||0)+bytes;
     if(total>budgets.get(root))throw sizeFailure();
     state.bytes.set(root,total);
    });
    live(state);if(controller.signal.aborted)throw failure();
    const value=JSON.parse(text);
    if(!shallow)return value;
    if(value===null)return {keys:[],exists:false};
    if(typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([k,v])=>!validKey(k)||v!==true))throw failure();
    return {keys:Object.keys(value),exists:true};
   };
   return await Promise.race([work(),new Promise((_,reject)=>{
    onAbort=()=>reject(failure());controller.signal.addEventListener('abort',onAbort,{once:true});
    timer=setTimeout(()=>controller.abort(),requestMs);
   })]);
  }catch(error){
   stop();discard(response);
   if(error?.code==='SV_SALE_DELETE_PREPARATION_SIZE')throw error;
   throw failure();
  }finally{
   clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);active.delete(controller);
  }
 }
 function phase(name){
  if(disposed||failed||active.size||name!==(current?'fresh':'initial')||current?.name==='fresh')throw failure();
  const state={name,bytes:new Map()};current=state;
  return Object.freeze({keys:root=>get(state,root,null,true),read:(root,key)=>get(state,root,key,false)});
 }
 function dispose(){disposed=true;for(const controller of active)controller.abort();}
 return Object.freeze({phase,dispose});
}
module.exports={create};
