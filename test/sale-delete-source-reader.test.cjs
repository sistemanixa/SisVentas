'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {create}=require('../cotizador/sale-delete-source-reader');
const root='sisventas/ventas',options={databaseURL:'https://fixture.firebaseio.com/',accessToken:async()=> 'FICTITIOUS'};
const response=(value,etag)=>new Response(JSON.stringify(value),{headers:etag?{etag}:{}});
const denied=error=>error.code==='SV_SALE_DELETE_SOURCE_READ'&&error.statusCode===503;
test('200 then conditional 304 reuses captured text, never returned mutable objects',async()=>{
 const calls=[];const r=create({...options,fetchImpl:async(url,o)=>{calls.push({url:String(url),...o});return calls.length===1?response({a:{n:1}},'"one"'):new Response(null,{status:304,headers:{etag:'"one"'}});}});
 const first=await r.read(root);first.a.n=90;a.deepEqual(await r.read(root),{a:{n:1}});a.equal(calls[0].headers['If-None-Match'],undefined);a.equal(calls[1].headers['If-None-Match'],'"one"');for(const c of calls){a.equal(c.method,'GET');a.equal(c.headers['X-Firebase-ETag'],'true');a.equal(c.redirect,'error');a.equal(c.cache,'no-store');}r.dispose();await a.rejects(r.read(root),denied);
});
test('changed ETag returns changed full source and no ETag causes two unconditional GETs',async()=>{
 for(const etag of [true,false]){let n=0;const headers=[];const r=create({...options,fetchImpl:async(_,o)=>{headers.push(o.headers);return response({n:++n},etag?'"'+n+'"':null);}});a.deepEqual(await r.read(root),{n:1});a.deepEqual(await r.read(root),{n:2});a.equal(headers[1]['If-None-Match'],etag?'"1"':undefined);r.dispose();}
});
test('304 without a captured previous entry, or with a foreign ETag, fails closed',async()=>{
 for(const primed of [false,true]){let n=0;const r=create({...options,fetchImpl:async()=>++n===1&&primed?response({},'"old"'):new Response(null,{status:304,headers:{etag:'"foreign"'}})});if(primed)await r.read(root);await a.rejects(r.read(root),denied);r.dispose();}
});
test('HTTP errors drain, invalidate cache, and never return stale data',async()=>{
 let n=0,cancelled=0;const sent=[];const r=create({...options,fetchImpl:async(_,o)=>{sent.push(o.headers['If-None-Match']);if(++n===1)return response({old:1},'"old"');if(n===2)return new Response(new ReadableStream({cancel(){cancelled++;}}),{status:500});return response({fresh:1},'"fresh"');}});
 await r.read(root);await a.rejects(r.read(root),denied);a.equal(cancelled,1);a.deepEqual(await r.read(root),{fresh:1});a.equal(sent[2],undefined);r.dispose();
});
test('root whitelist is exact and configuration admits only isolated ns loopback',async()=>{
 for(const url of ['http://localhost:9000/?ns=demo-test','http://127.0.0.1:9000/?ns=demo-test','https://fixture.firebaseio.com/']){let called=0;const r=create({...options,databaseURL:url,fetchImpl:async target=>{called++;const u=new URL(target);a.equal(u.searchParams.get('ns'),url.startsWith('http:')?'demo-test':null);return response(null);}});await r.read(root);for(const p of ['sisventas','sisventas/ventas/sale','sisventas/ventas/','/sisventas/ventas','sv_usuarios'])await a.rejects(r.read(p),denied);a.equal(called,1);r.dispose();}
 for(const url of ['http://remote.invalid/','https://fixture.firebaseio.com/?ns=x','http://localhost/?ns=x&extra=y','http://localhost/?ns=x&ns=y','http://localhost/?ns=','https://user:password@fixture.firebaseio.com/','https://fixture.firebaseio.com/a','https://fixture.firebaseio.com/#x'])a.throws(()=>create({...options,databaseURL:url}),TypeError);
});
test('two reader instances have no shared cache or authorization cache',async()=>{
 const headers=[];let tokens=0;const o={...options,accessToken:async()=>{tokens++;return 'FICTITIOUS';},fetchImpl:async(_,o)=>{headers.push(o.headers['If-None-Match']);return response({},'"same"');}};for(let i=0;i<2;i++){const r=create(o);await r.read(root);await r.read(root);r.dispose();}a.deepEqual(headers,[undefined,'"same"',undefined,'"same"']);a.equal(tokens,4);
});
test('concurrent requests can only use their own captured ETag',async()=>{
 let release,n=0;const waiting=new Promise(resolve=>release=resolve);const r=create({...options,fetchImpl:async()=>{if(++n===1){await waiting;return new Response(null,{status:304});}return response({new:1},'"new"');}});const first=r.read(root);await new Promise(resolve=>setImmediate(resolve));a.deepEqual(await r.read(root),{new:1});release();await a.rejects(first,denied);a.deepEqual(await r.read(root),{new:1});r.dispose();
});
test('timeouts cover credentials and hung streams; dispose aborts active requests',async()=>{
 let fetches=0;const credentials=create({...options,requestMs:15,accessToken:()=>new Promise(()=>{}),fetchImpl:async()=>{fetches++;}});await a.rejects(credentials.read(root),denied);a.equal(fetches,0);credentials.dispose();
 let cancelled=0;const stream=create({...options,requestMs:15,fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancelled++;return new Promise(()=>{});}}))});await a.rejects(stream.read(root),denied);a.equal(cancelled,1);stream.dispose();
 const disposed=create({...options,accessToken:()=>new Promise(()=>{})});const pending=disposed.read(root);disposed.dispose();await a.rejects(pending,denied);
});
test('strict UTF8, truncated JSON and bad ETags cannot become cached sources',async()=>{
 for(const body of [new Uint8Array([0xff]),'{"incomplete":']){const r=create({...options,fetchImpl:async()=>new Response(body,{headers:{etag:'"x"'}})});await a.rejects(r.read(root),denied);r.dispose();}
 let n=0;const r=create({...options,fetchImpl:async(_,o)=>{a.equal(o.headers['If-None-Match'],undefined);n++;return response({},'bad tag');}});await r.read(root);await r.read(root);a.equal(n,2);r.dispose();
});
for(const [path,limit]of [[root,8*1024*1024],['sisventas/gastos',16*1024*1024]])test('stream byte boundary '+path,async()=>{
 // A JSON string is exactly limit bytes, including its surrounding quotes.
 for(const extra of [0,1]){let cancelled=0;const bytes=new TextEncoder().encode('"'+'x'.repeat(limit-2+extra)+'"');let offset=0;const r=create({...options,fetchImpl:async()=>new Response(new ReadableStream({pull(controller){if(offset===bytes.length){if(!extra)controller.close();return;}controller.enqueue(bytes.subarray(offset,offset+=Math.min(65536,bytes.length-offset)));},cancel(){cancelled++;}}))});if(extra){await a.rejects(r.read(path),e=>e.statusCode===413&&e.code==='SV_SALE_DELETE_LIVE_SCOPE_SIZE');a.equal(cancelled,1);}else a.equal((await r.read(path)).length,limit-2);r.dispose();}
});
test('Guard final-check assertion permits only a live lease; working/write APIs remain closed and retained checker closes after commit',async()=>{
 const {createLaborGuard,child,parts,put}=require('../cotizador/labor-guard');let state={sv_labor_config:{schema:1,ready:true}},clock=1000,commits=0,check;
 const store={read:async p=>child(state,parts(p)),acquire:async lease=>{state.sv_labor_guard=lease;},abort:async()=>{state.sv_labor_guard=null;},commit:async patch=>{commits++;for(const [p,v]of Object.entries(patch))state=put(state,parts(p),v);}};
 const guard=createLaborGuard({store,now:()=>clock});await guard.run({uid:'fixture',mode:'server',operation:'fixture'},async scope=>{scope.beforeCommit(async args=>{check=args.assertActive;check();a.throws(scope.assertActive,{code:'SV_LABOR_SCOPE_CLOSED'});await a.rejects(scope.update({'sisventas/ventas/forged':{}}),{code:'SV_LABOR_SCOPE_CLOSED'});await args.readFresh('sv_labor_config');check();});return{ok:true};});
 a.equal(commits,1);a.throws(check,{code:'SV_LABOR_SCOPE_CLOSED'});a.equal(child(state,parts('sisventas/ventas/forged')),null);
 await a.rejects(guard.run({uid:'fixture',mode:'server',operation:'fixture-expired'},async scope=>{scope.beforeCommit(async({assertActive})=>{assertActive();clock+=30001;assertActive();});return{ok:true};}),{code:'SV_LABOR_LEASE_EXPIRED'});a.equal(commits,1);a.equal(state.sv_labor_guard,null);
});
