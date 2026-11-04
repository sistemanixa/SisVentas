'use strict';
// Test-only disk REST adapter. Runtime/store/guard/gateway are production modules.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=process.env.SV_PROCESS_RESTART_SOURCE,file=process.env.SV_PROCESS_RESTART_FILE,load=p=>require(path.join(source,p));
if(!path.isAbsolute(source||'')||!path.isAbsolute(file||''))throw Error('Explicit isolated source/state file required');
const {parts,child,put,digest}=load('cotizador/labor-guard');
const read=()=>JSON.parse(fs.readFileSync(file,'utf8'));
function persist(value){const temp=file+'.'+process.pid+'.new',fd=fs.openSync(temp,'wx');try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,file);}
let crashPoint=null;
async function hold(stage){process.send({event:'held',stage,pid:process.pid});await new Promise(()=>{});}
async function fetchImpl(url,init={}){
 const u=new URL(url);if(u.origin!=='http://127.0.0.1:1'||u.searchParams.get('ns')!=='demo-runtime-process-durable')throw Error('Only disk fixture URL allowed');
 const p=decodeURIComponent(u.pathname.slice(1).replace(/\.json$/,'')),state=read(),actor=JSON.parse(u.searchParams.get('auth_variable_override')||'null');let value=p?child(state.data,parts(p)):state.data;
 if(init.method==='GET')return new Response(JSON.stringify(value));
 if(init.method==='PUT'&&p==='sv_labor_guard'){
  if(state.data.sv_labor_guard?.expiresAt>Date.now())return new Response('{}',{status:401});
  state.data=put(state.data,parts(p),JSON.parse(init.body));persist(state);
  if(crashPoint==='acquired')await hold('acquired');
 }else if(init.method==='DELETE'&&p==='sv_labor_guard'){
  if(state.data.sv_labor_guard?.fence===actor?.token?.fence){state.data=put(state.data,parts(p),null);persist(state);}
 }else if(init.method==='PATCH'&&p===''){
  const patch=JSON.parse(init.body),lease=state.data.sv_labor_guard;
  if(!lease||lease.fence!==actor?.token?.fence||lease.expiresAt<=Date.now())return new Response('{}',{status:401});
  for(const [key,v]of Object.entries(patch))state.data=put(state.data,parts(key),v);
  state.commits.push({operationId:lease.opId,businessEffect:Object.hasOwn(patch,'sisventas/empleados/fixture/restartCount')});persist(state);
  if(crashPoint==='committed')await hold('committed');
 }else throw Error('Unexpected fixture operation '+init.method+' '+p);
 return new Response('null');
}
const db={ref:p=>({get:async()=>({val:()=>child(read().data,parts(p))})})};
const runtime=load('cotizador/labor-runtime').createLaborRuntime({db,databaseURL:'http://127.0.0.1:1/?ns=demo-runtime-process-durable',accessToken:async()=> 'demo-only-owner',fetchImpl,enabled:true,commercialPages:false,clientAccounts:false,clientHistory:false,dashboardBudgets:false,dashboardActivity:false});
const gateway=load('cotizador/labor-write-gateway').createLaborWriteGateway({db,store:runtime.store,guard:runtime.guard,enabled:true});
process.on('message',async msg=>{try{
 if(msg.kind==='resolve'){const result=await gateway.resolve({uid:msg.uid||'u',claims:{uid:msg.uid||'u'}},{id:msg.id,digest:msg.digest});process.send({event:'result',request:msg.request,result});return;}
 if(msg.kind==='run'){
  crashPoint=msg.crashPoint||null;
  const result=await runtime.guard.run({uid:'u',claims:{uid:'u'},mode:'user',opId:msg.id,operation:'durable-process-fixture',transportDigest:msg.digest},async scope=>{const p='sisventas/empleados/fixture/restartCount',n=await scope.get(p)||0;await scope.update({[p]:n+1});return {ok:true,committed:true};});
  process.send({event:'result',request:msg.request,result});return;
 }
 throw Error('Unknown command');
}catch(e){process.send({event:'error',request:msg.request,error:{message:e.message,code:e.code,statusCode:e.statusCode}});}});
process.send({event:'ready',pid:process.pid,stateSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
