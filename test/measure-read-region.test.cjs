'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{run,COVERAGE_PATH}=require('../scripts/measure-read-region.cjs');
const uid='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',secret='DO_NOT_LOG_TOKEN_OR_DATA',env={FIREBASE_DATABASE_URL:'https://fictional-only.firebaseio.com',READ_PROBE_REGION:'us-central1'};
function fixture({authError='auth/user-not-found',status=200}={}){
 const calls=[];let active=0,maxActive=0,clock=0;
 const credential={getAccessToken:async()=>{calls.push('credential');return{access_token:secret};}},app={options:{credential},delete:async()=>calls.push('delete')};
 const admin={
  credential:{applicationDefault:()=>{calls.push('adc');return credential;}},
  initializeApp:(options,name)=>{a.equal(name,'regional-read-probe');a.equal(options.credential,credential);calls.push('initialize');return app;},
  auth:instance=>{a.equal(instance,app);return{getUser:async value=>{a.equal(value,'regional-read-probe-'+uid);calls.push('auth');if(authError)throw Object.assign(Error(secret+value),{code:authError});return{uid:value,email:secret};}};}
 };
 const fetchImpl=async(url,options)=>{maxActive=Math.max(maxActive,++active);a.equal(options.method,'GET');a.equal(url.pathname,COVERAGE_PATH);a.equal(url.search,'');a.equal(url.origin,new URL(env.FIREBASE_DATABASE_URL).origin);a.equal(options.headers.Authorization,'Bearer '+secret);a.equal(options.redirect,'error');a.equal(options.body,undefined);calls.push('GET');active--;return{status,body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(secret));controller.close();}})};};
 return{admin,fetchImpl,now:()=>++clock,uuid:()=>uid,env,calls,get maxActive(){return maxActive;}};
}
test('one-shot probe makes exactly five sequential metadata GETs and two missing-identity lookups, without outputting content',async()=>{
 const f=fixture(),r=await run(f);a.equal(r.event,'regional_read_probe');a.equal(r.complete,1);a.equal(r.rest.length,5);a.equal(r.auth.length,2);a.equal(f.maxActive,1);a.deepEqual(f.calls,['adc','initialize',...Array.from({length:5},()=>['credential','GET']).flat(),'auth','auth','delete']);a(r.rest.every(x=>x.status===200&&x.bytes===Buffer.byteLength(secret)));a(r.auth.every(x=>x.status===404&&x.bytes===-1));a.equal(r.rest[0].first,1);a(r.rest.slice(1).every(x=>x.first===0));const output=JSON.stringify(r);for(const forbidden of [secret,uid,'fictional-only','access_token','uid','email'])a.equal(output.includes(forbidden),false);for(const row of [...r.rest,...r.auth])a(Object.values(row).every(Number.isFinite));
});
test('unknown Auth error is numeric failure, leaks no error message and starts no second lookup',async()=>{const f=fixture({authError:'auth/internal-error'}),r=await run(f);a.equal(r.complete,0);a.equal(r.auth.length,1);a.equal(r.auth[0].status,0);a.equal(JSON.stringify(r).includes(secret),false);});
test('unexpected existing random identity is reported only as status and never emits profile data',async()=>{const f=fixture({authError:null}),r=await run(f);a.equal(r.complete,0);a(r.auth.every(x=>x.status===200));a.equal(JSON.stringify(r).includes(secret),false);a.equal(JSON.stringify(r).includes(uid),false);});
test('non-success metadata response remains read-only and emits only status and byte count',async()=>{const f=fixture({status:403}),r=await run(f);a.equal(r.complete,0);a.equal(r.rest.length,5);a(r.rest.every(x=>x.status===403));a.equal(JSON.stringify(r).includes(secret),false);});
test('invalid target or region is rejected before ADC initialization',async()=>{for(const bad of [{FIREBASE_DATABASE_URL:'https://fictional-only.firebaseio.com/?auth=secret'},{FIREBASE_DATABASE_URL:'https://fictional-only.firebaseio.com/sisventas'},{FIREBASE_DATABASE_URL:'https://example.com'},{FIREBASE_DATABASE_URL:'http://127.0.0.1'},{READ_PROBE_REGION:'arbitrary-data'}]){const f=fixture();f.env={...env,...bad};await a.rejects(run(f));a.deepEqual(f.calls,[]);}});
