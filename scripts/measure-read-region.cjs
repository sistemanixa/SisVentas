'use strict';
// Opt-in, one-shot Job payload. Never starts a server or deploys a resource.
const {performance}=require('node:perf_hooks'),{randomUUID}=require('node:crypto');
const COVERAGE_PATH='/sv_labor_indexes/paymentRefs_v1/coverage.json';
const numeric=n=>Number.isFinite(n)?Math.max(0,Math.round(n*100)/100):0;
async function bounded(work,ms){let timer;try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('probe timeout')),ms);})]);}finally{clearTimeout(timer);}}
async function discard(response){let bytes=0;if(!response.body)return bytes;const reader=response.body.getReader();try{for(;;){const next=await reader.read();if(next.done)return bytes;bytes+=next.value.byteLength;if(bytes>65536)throw Error('probe body limit');}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
async function run({admin,fetchImpl=globalThis.fetch,env=process.env,now=()=>performance.now(),uuid=randomUUID}={}){
 const base=new URL(env.FIREBASE_DATABASE_URL||'invalid:');
 if(base.protocol!=='https:'||!/(?:\.firebaseio\.com|\.firebasedatabase\.app)$/.test(base.hostname)||base.username||base.password||base.search||base.hash||!['','/'].includes(base.pathname))throw Error('probe configuration');
 const region=env.READ_PROBE_REGION;if(!['us-central1','southamerica-east1'].includes(region))throw Error('probe configuration');
 const sdk=admin||require('firebase-admin'),credential=sdk.credential.applicationDefault(),app=sdk.initializeApp({credential,databaseURL:base.href},'regional-read-probe');
 const started=now(),deadline=started+52000,report={event:'regional_read_probe',region,rest:[],auth:[],totalMs:0,complete:0};
 const limit=maximum=>{const remaining=deadline-now();if(remaining<=0)throw Error('probe deadline');return Math.min(maximum,remaining);};
 try{
  const target=new URL(COVERAGE_PATH,base);
  for(let i=0;i<5;i++){
   const at=now(),row={sample:i+1,first:i===0?1:0,status:0,bytes:0,credentialMs:0,fetchMs:0,totalMs:0};let tokenReady=false;
   try{const tokenAt=now(),token=await bounded(()=>app.options.credential.getAccessToken(),limit(5000));row.credentialMs=numeric(now()-tokenAt);tokenReady=true;
    const fetchAt=now(),controller=new AbortController();try{await bounded(async()=>{const response=await fetchImpl(target,{method:'GET',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},redirect:'error',signal:controller.signal});row.status=response.status;row.bytes=await discard(response);},limit(6000));}finally{controller.abort();row.fetchMs=numeric(now()-fetchAt);}
   }catch(_){row.status=0;}finally{row.totalMs=numeric(now()-at);report.rest.push(row);}
   if(!tokenReady)break;
  }
  // Random nonexistent identity is never emitted, nor are SDK response/error data.
  const uid='regional-read-probe-'+uuid();if(!/^regional-read-probe-[a-f0-9-]{36}$/.test(uid))throw Error('probe random identity');
  for(let i=0;i<2;i++){
   const at=now(),row={sample:i+1,first:i===0?1:0,status:0,bytes:-1,totalMs:0};
   try{await bounded(()=>sdk.auth(app).getUser(uid),limit(9000));row.status=200;}catch(error){row.status=error?.code==='auth/user-not-found'?404:0;}finally{row.totalMs=numeric(now()-at);report.auth.push(row);}
   if(row.status===0)break; // Do not overlap a timed-out SDK call with another.
  }
  report.complete=report.rest.length===5&&report.rest.every(r=>r.status>=200&&r.status<300)&&report.auth.length===2&&report.auth.every(r=>r.status===404)?1:0;
 }catch(_){}finally{report.totalMs=numeric(now()-started);try{await bounded(()=>app.delete(),500);}catch(_){}}
 return report;
}
module.exports={run,COVERAGE_PATH};
if(require.main===module){
 if(process.argv.length!==3||process.argv[2]!=='--run'){console.error('Probe disabled; explicit --run required.');process.exitCode=2;}
 else run().then(report=>{console.log(JSON.stringify(report));process.exit(report.complete?0:1);},()=>{console.log(JSON.stringify({event:'regional_read_probe',status:0,complete:0}));process.exit(1);});
}
