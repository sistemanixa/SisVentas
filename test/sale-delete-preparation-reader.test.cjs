'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {create}=require('../cotizador/sale-delete-preparation-reader');
const OT='sisventas/ordenes_trabajo',R='sisventas/reclamos',MiB=1024*1024;
const options={databaseURL:'https://fixture.firebaseio.com/',accessToken:async()=> 'FICTITIOUS_PREPARATION_ONLY'};
const denied=e=>e.statusCode===503&&e.code==='SV_SALE_DELETE_PREPARATION_READ';
const oversized=e=>e.statusCode===413&&e.code==='SV_SALE_DELETE_PREPARATION_SIZE';
const reply=value=>new Response(JSON.stringify(value));
test('phase API is closed, sequential, single-use and retires old ports; all reads are fresh GETs',async()=>{
 const calls=[];let n=0,tokens=0;const r=create({...options,accessToken:async()=>{tokens++;return 'FICTITIOUS';},fetchImpl:async(url,o)=>{calls.push({url:new URL(url),...o});return reply(++n);}});
 a.throws(()=>r.phase('fresh'),denied);for(const name of ['',true,null,'INITIAL','third'])a.throws(()=>r.phase(name),denied);
 const initial=r.phase('initial');a.throws(()=>r.phase('initial'),denied);a.equal(await initial.read(OT,'a'),1);a.equal(await initial.read(OT,'a'),2);
 const fresh=r.phase('fresh');await a.rejects(initial.read(OT,'a'),denied);a.equal(await fresh.read(OT,'a'),3);a.throws(()=>r.phase('fresh'),denied);
 a.equal(tokens,3);for(const c of calls){a.equal(c.method,'GET');a.equal(c.cache,'no-store');a.equal(c.redirect,'error');a.equal(c.headers['If-None-Match'],undefined);a.equal(c.url.search,'');a.equal(c.url.pathname,'/'+OT+'/a.json');}r.dispose();await a.rejects(fresh.read(OT,'a'),denied);a.throws(()=>r.phase('initial'),denied);
});
test('shallow keys distinguish null and empty object, preserve original keys and reject non-shallow/invalid shapes',async()=>{
 for(const [value,expected]of [[null,{keys:[],exists:false}],[{},{keys:[],exists:true}],[{'0001':true,z:true},{keys:['0001','z'],exists:true}]]){const r=create({...options,fetchImpl:async(url,o)=>{const u=new URL(url);a.equal(u.pathname,'/'+OT+'.json');a.equal(u.search,'?shallow=true');a.equal(o.method,'GET');return reply(value);}});a.deepEqual(await r.phase('initial').keys(OT),expected);r.dispose();}
 for(const value of [[],false,0,{'a':{}},{a:false},{'bad.key':true}]){const r=create({...options,fetchImpl:async()=>reply(value)});await a.rejects(r.phase('initial').keys(OT),denied);a.throws(()=>r.phase('fresh'),denied);r.dispose();}
});
test('only exact two roots and valid original keys; loopback ns and component encoding preserved',async()=>{
 let gets=0;const r=create({...options,databaseURL:'http://127.0.0.1:9000/?ns=demo-preparation',fetchImpl:async url=>{gets++;const u=new URL(url);a.equal(u.search,'?ns=demo-preparation');a.equal(u.pathname,'/'+R+'/a%20%25.json');return reply({id:'RAW',cost:12.345,rows:null});}}),p=r.phase('initial');
 for(const root of ['sisventas','sisventas/ventas',OT+'/',OT+'/a'])await a.rejects(p.read(root,'a'),denied);
 for(const key of ['',null,'a/b','a.b','a#b','a$b','a[b','a\u0000b','x'.repeat(769)])await a.rejects(p.read(OT,key),denied);
 a.deepEqual(await p.read(R,'a %'),{id:'RAW',cost:12.345,rows:null});a.equal(gets,1);r.dispose();
 for(const url of ['http://remote.invalid/','https://fixture.firebaseio.com/?ns=x','http://localhost/?ns=x&extra=y','http://localhost/?ns=x&ns=y','https://user:password@fixture.firebaseio.com/','https://fixture.firebaseio.com/a','https://fixture.firebaseio.com/#x'])a.throws(()=>create({...options,databaseURL:url}),TypeError);
});
test('six in-flight reads allowed; phase switch and seventh GET rejected without hidden queue',async()=>{
 let release,n=0;const wait=new Promise(resolve=>release=resolve),r=create({...options,fetchImpl:async()=>{n++;await wait;return reply({});}}),p=r.phase('initial');
 const pending=Array.from({length:6},(_,i)=>p.read(OT,'k'+i));await new Promise(resolve=>setImmediate(resolve));a.equal(n,6);await a.rejects(p.read(OT,'seventh'),denied);a.throws(()=>r.phase('fresh'),denied);release();await Promise.all(pending);a.equal(n,6);a.doesNotThrow(()=>r.phase('fresh'));r.dispose();
});
test('HTTP failure aborts parallel reads and poisons the operation; no stale success or subsequent GET',async()=>{
 let n=0,cancelled=0;const r=create({...options,fetchImpl:async(_,o)=>{n++;if(n===1)return new Response('FICTITIOUS_PRIVATE_ERROR',{status:403});return new Response(new ReadableStream({cancel(){cancelled++;}}));}}),p=r.phase('initial');
 const results=await Promise.allSettled([p.read(OT,'a'),p.read(R,'b')]);a(results.every(r=>r.status==='rejected'&&denied(r.reason)));a.equal(cancelled,1);const count=n;await a.rejects(p.read(OT,'c'),denied);a.equal(n,count);a.throws(()=>r.phase('fresh'),denied);r.dispose();
});
test('timeout includes credentials; late token never starts GET; dispose aborts hung fetch and late response is discarded',async()=>{
 let release,n=0;const token=new Promise(resolve=>release=resolve),r=create({...options,requestMs:10,accessToken:()=>token,fetchImpl:async()=>{n++;return reply({});}}),p=r.phase('initial');await a.rejects(p.read(OT,'a'),denied);release('FICTITIOUS');await new Promise(resolve=>setImmediate(resolve));a.equal(n,0);await a.rejects(p.read(OT,'b'),denied);r.dispose();
 let resolveFetch,cancelled=0;const late=create({...options,fetchImpl:()=>new Promise(resolve=>resolveFetch=resolve)}),read=late.phase('initial').read(OT,'a');await new Promise(resolve=>setImmediate(resolve));late.dispose();await a.rejects(read,denied);resolveFetch(new Response(new ReadableStream({cancel(){cancelled++;}})));await new Promise(resolve=>setImmediate(resolve));a.equal(cancelled,1);
});
test('hung stream cancellation remains bounded even when its cancellation promise hangs',async()=>{
 let cancelled=0;const r=create({...options,requestMs:10,fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancelled++;return new Promise(()=>{});}}))});await a.rejects(r.phase('initial').read(OT,'a'),denied);a.equal(cancelled,1);r.dispose();
});
test('malformed JSON and UTF8 fail closed without provider body leakage',async()=>{
 for(const data of ['{"truncated":',new Uint8Array([0xff])]){const r=create({...options,fetchImpl:async()=>new Response(data)});await a.rejects(r.phase('initial').read(R,'a'),e=>denied(e)&&!e.message.includes('truncated'));r.dispose();}
});
test('point RAW is never mutated or reused across reads, phases, or instances',async()=>{
 let n=0;const o={...options,fetchImpl:async()=>{n++;return reply({raw:{cost:12.345}});}};for(let i=0;i<2;i++){const r=create(o),p=r.phase('initial'),v=await p.read(OT,'a');v.raw.cost=0;a.equal((await p.read(OT,'a')).raw.cost,12.345);a.equal((await r.phase('fresh').read(OT,'a')).raw.cost,12.345);r.dispose();}a.equal(n,6);
});
for(const shallow of [true,false])test('exact streamed '+(shallow?'1MiB shallow':'8MiB point')+' limit before parse and +1 rejected/cancelled',async()=>{
 const limit=(shallow?1:8)*MiB,prefix=shallow?'{}':'""';
 for(const extra of [0,1]){let offset=0,cancelled=0;const bytes=Buffer.from(prefix+' '.repeat(limit-prefix.length+extra));const r=create({...options,fetchImpl:async()=>new Response(new ReadableStream({pull(c){if(offset===bytes.length){if(!extra)c.close();return;}const next=Math.min(offset+65536,bytes.length);c.enqueue(bytes.subarray(offset,next));offset=next;},cancel(){cancelled++;}}))}),p=r.phase('initial');const work=shallow?p.keys(OT):p.read(OT,'a');if(extra){await a.rejects(work,oversized);a.equal(cancelled,1);}else a.deepEqual(await work,shallow?{keys:[],exists:true}:'');r.dispose();}
});
for(const [root,maxReads]of [[OT,10],[R,4]])test('aggregate per-phase limit '+root+' and fresh budget reset',async()=>{
 const payload='"'+'x'.repeat(8*MiB-2)+'"';let gets=0;const r=create({...options,fetchImpl:async()=>{gets++;return new Response(payload);}}),p=r.phase('initial');for(let i=0;i<maxReads;i++)await p.read(root,'k'+i);const fresh=r.phase('fresh');a.equal((await fresh.read(root,'fresh')).length,8*MiB-2);for(let i=1;i<maxReads;i++)await fresh.read(root,'fresh'+i);await a.rejects(fresh.read(root,'overflow'),oversized);const count=gets;await a.rejects(fresh.read(root,'after'),denied);a.equal(gets,count);r.dispose();
});
test('Store factory preserves ADC/fetch/namespace ports and exposes no writing API',async()=>{
 const Store=require('../cotizador/labor-rtdb-store');let tokens=0;const store=Store.createLaborRtdbStore({...options,databaseURL:'http://localhost:9000/?ns=demo-native-factory',accessToken:async()=>{tokens++;return 'FICTITIOUS';},fetchImpl:async(url,o)=>{a.equal(o.method,'GET');a.equal(o.headers.Authorization,'Bearer FICTITIOUS');a.equal(new URL(url).searchParams.get('ns'),'demo-native-factory');return reply(null);}}),r=store.createSaleDeletePreparationReader();a.deepEqual(Object.keys(r),['phase','dispose']);a.deepEqual(await r.phase('initial').keys(R),{keys:[],exists:false});a.equal(tokens,1);r.dispose();
});
