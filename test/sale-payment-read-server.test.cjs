'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs');
const Index=require('../cotizador/payment-membership-index');
const {createFromEnv,createServer}=require('../cotizador/sale-payment-read-server');
const origin='https://ventas.fixture.invalid',route='/comerciales/ventas/registro/one?para=pagos';
async function setup(t){
 const f=fixture(),root=f.db.root,calls=[],tokens=[],control={denyPayment:false,fail:false,revoked:false,hook:null};
 root.sisventas.ventas.one.responsableUid='a';root.sisventas.pagos={p:{id:'P-FICTICIO',ventaFbKey:'one',monto:40,obs:'Nota',comprobante:{data:'PRIVATE_ATTACHMENT'}}};
 function build(){for(const [path,value]of Object.entries(Index.buildIndex(root.sisventas.pagos,{generation:'reader-http-fixture',ready:true}).patch)){const keys=path.split('/');let n=root;for(const k of keys.slice(0,-1))n=n[k]??={};n[keys.at(-1)]=value;}}
 build();
 const auth={verifyIdToken:async(token,checkRevoked)=>{tokens.push(token);a.equal(checkRevoked,true);if(control.revoked||!root.sv_chat_roles[token])throw Error('revoked');return {uid:token};}};
 const admin={credential:{applicationDefault:()=>({getAccessToken:async()=>({access_token:'FIXTURE_ONLY'})})},initializeApp:(config,name)=>{a.equal(name,'sale-payment-reader');return {options:config,auth:()=>auth,database(){throw Error('SDK database must never start');}};}};
 const fetchImpl=async(url,options)=>{
  a.equal(options.method,'GET','No database writes are authorized');const u=new URL(url),path=decodeURIComponent(u.pathname).slice(1,-5),override=JSON.parse(u.searchParams.get('auth_variable_override')||'null');calls.push({path,override});
  if(control.fail&&path.startsWith('sisventas/pagos/'))throw Error('private transport error');
  if(override){a.equal(override.token.uid,override.uid);const role=root.sv_chat_roles[override.uid];if(role?.activo!==true||root.sv_access_resets?.[override.uid]?.required||control.denyPayment&&path.startsWith('sisventas/pagos/'))return {ok:false,status:403,json:async()=>({})};}
  let value=path.split('/').reduce((n,k)=>n?.[k],root)??null;
  if(u.searchParams.has('orderBy')){a.equal(path,'sv_usuarios');a.equal(JSON.parse(u.searchParams.get('orderBy')),'uid');const uid=JSON.parse(u.searchParams.get('equalTo'));value=Object.fromEntries(Object.entries(value).filter(([,r])=>r.uid===uid));}
  value=structuredClone(value);await control.hook?.(path,override);return {ok:true,status:200,json:async()=>value};
 };
 const server=createFromEnv({env:{FIREBASE_DATABASE_URL:'http://127.0.0.1:1/?ns=reader-fictitious',ALLOW_ORIGIN:origin,GOOGLE_CLOUD_PROJECT:'demo-reader-fixture'},admin,fetchImpl});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port;
 const request=(path=route,options={})=>fetch(base+path,{...options,headers:{origin,authorization:'Bearer a',...options.headers}});
 return {root,calls,tokens,control,build,request};
}
test('real HTTP entry composes real Auth/Ownership/REST/reader and preserves DTO without writes',async t=>{
 const f=await setup(t),before=structuredClone(f.root),response=await f.request();a.equal(response.status,200);a.equal(response.headers.get('cache-control'),'private, no-store');a.equal(response.headers.get('access-control-allow-origin'),origin);
 const body=await response.json();a.deepEqual(Object.keys(body).sort(),['ok','paymentHistory','record']);a.equal(body.ok,true);a.equal(body.record.fbKey,'one');a.equal(body.paymentHistory.paidAmount,40);a.deepEqual(body.paymentHistory.payments,[{fbKey:'p',id:'P-FICTICIO',monto:40,nota:'Nota',hasReceipt:true}]);a.equal(JSON.stringify(body).includes('PRIVATE_ATTACHMENT'),false);a.deepEqual(f.root,before);a.equal(f.tokens.length,2);
 a(f.calls.some(c=>c.override&&c.path==='sisventas/pagos/p'));a.equal(f.calls.filter(c=>!c.override&&c.path==='sisventas/pagos/p').length,0);
});
test('unsupported methods and all other routes/queries perform zero auth or database work',async t=>{
 const f=await setup(t);
 for(const method of ['POST','PUT','PATCH','DELETE','HEAD']){const r=await f.request(route,{method});a.equal(r.status,501);}
 for(const path of ['/','/comerciales/ventas','/comerciales/presupuestos/registro/one?para=pagos','/comerciales/ventas/registro/one','/comerciales/ventas/registro/one?para=comision',route+'&verComo=b',route+'&para=pagos','/compras/ordenes/crear'])a.equal((await f.request(path)).status,404);
 a.equal(f.calls.length,0);a.equal(f.tokens.length,0);
});
test('preflight only permits configured origin and GET on the exact route',async t=>{
 const f=await setup(t);let r=await f.request(route,{method:'OPTIONS',headers:{'access-control-request-method':'GET'}});a.equal(r.status,204);a.equal(r.headers.get('access-control-allow-methods'),'GET, OPTIONS');
 r=await f.request(route,{method:'OPTIONS',headers:{'access-control-request-method':'POST'}});a.equal(r.status,501);
 r=await f.request(route,{headers:{origin:'https://foreign.invalid'}});a.equal(r.status,403);a.equal(r.headers.get('access-control-allow-origin'),null);a.equal(f.calls.length,0);a.equal(f.tokens.length,0);
});
test('missing or revoked session returns 401 before all reads',async t=>{
 const f=await setup(t);a.equal((await f.request(route,{headers:{authorization:''}})).status,401);f.control.revoked=true;a.equal((await f.request()).status,401);a.equal(f.calls.length,0);
});
for(const kind of ['inactive','foreignOwner','permission','reset'])test('denies '+kind+' without payment disclosure',async t=>{
 const f=await setup(t);if(kind==='inactive')f.root.sv_chat_roles.a.activo=false;if(kind==='foreignOwner')f.root.sisventas.ventas.one.responsableUid='b';if(kind==='permission')f.root.sv_permisos.vendedor.indiceModulos={};if(kind==='reset')f.root.sv_access_resets={a:{required:true}};
 const r=await f.request();a.equal(r.status,kind==='foreignOwner'?404:kind==='reset'?401:403);a.equal((await r.json()).ok,false);a.equal(f.calls.filter(c=>c.path==='sisventas/pagos/p').length,0);
});
test('numeric alias collision cannot substitute service access for denied original payment',async t=>{
 const f=await setup(t);f.root.sisventas.ventas.one.id='V-001';f.root.sisventas.pagos.p={ventaId:'OT-001',monto:90};f.build();f.control.denyPayment=true;
 const r=await f.request();a.equal(r.status,403);a.equal((await r.json()).ok,false);a(f.calls.some(c=>c.path==='sisventas/pagos/p'&&c.override));a.equal(f.calls.filter(c=>c.path==='sisventas/pagos/p'&&!c.override).length,0);
});
test('revocation during payment read aborts the HTTP response',async t=>{
 const f=await setup(t);f.control.hook=(path,override)=>{if(path==='sisventas/pagos/p'&&override)f.root.sv_chat_roles.a.activo=false;};const r=await f.request();a.equal(r.status,403);a.equal((await r.json()).ok,false);
});
test('transport error returns bounded 503 without internal details',async t=>{
 const f=await setup(t);f.control.fail=true;const r=await f.request();a.equal(r.status,503);a.equal(JSON.stringify(await r.json()).includes('private transport error'),false);
});
test('missing configuration and writable-only substitute fail closed',()=>{a.throws(()=>createFromEnv({env:{}}),/FIREBASE_DATABASE_URL/);a.throws(()=>createServer({auth:{verifyIdToken(){}},store:{commit(){}}}),/puertos/);});

test('request without Origin still requires real authentication and has no cached bypass',async t=>{
 const f=await setup(t);a.equal((await f.request(route,{headers:{origin:'',authorization:''}})).status,401);a.equal(f.calls.length,0);
 a.equal((await f.request(route,{headers:{origin:''}})).status,200);f.control.revoked=true;a.equal((await f.request(route,{headers:{origin:''}})).status,401);
});
test('source and coverage races abort exact GET with no successful partial response',async t=>{
 for(const target of ['source','coverage']){const f=await setup(t);let changed=false;
  f.control.hook=(path,override)=>{if(changed||!override||path!=='sisventas/pagos/p')return;changed=true;
   if(target==='source')f.root.sisventas.pagos.p.monto=99;
   else{const keys=Index.COVERAGE_PATH.split('/');let node=f.root;for(const key of keys.slice(0,-1))node=node[key];node[keys.at(-1)].generation='changed-generation';}
  };
  const r=await f.request();a.equal(r.status,409);a.equal((await r.json()).ok,false);a.equal(changed,true);
 }
});

test('reader entry does not load runtime, main server, browser or Admin SDK eagerly',()=>{
 const loaded=Object.keys(require.cache).map(p=>p.replaceAll('\\','/'));
 for(const suffix of ['/cotizador/index.js','/cotizador/labor-runtime.js','/cotizador/navegador-compartido.js'])a.equal(loaded.some(p=>p.endsWith(suffix)),false,suffix);
 a.equal(loaded.some(p=>p.includes('/node_modules/firebase-admin/')),false);
});
