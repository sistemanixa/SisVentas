'use strict';
// Executes the literal index branch and its literal JSON sender. No substitute
// router, server boot, POST implementation or production network is installed.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const sourceRoot=path.resolve(process.env.SV_PAYMENT_HISTORY_SOURCE_ROOT||path.join(__dirname,'..')),indexFile=path.join(sourceRoot,'cotizador/index.js'),nativeRequire=createRequire(indexFile);
const index=fs.readFileSync(indexFile,'utf8').replaceAll('\r\n','\n');
function literal(start,end){a.equal(index.split(start).length,2,'Unique literal start');a.equal(index.split(end).length,2,'Unique literal end');const from=index.indexOf(start),to=index.indexOf(end,from);a(to>from);return index.slice(from,to);}
const branch=literal("  if(pathname.startsWith('/comerciales/')){","\n  if (req.method === 'GET' && pathname === '/mercadolibre/oauth/start')"),sender=literal('function send(res, status, payload) {','\nfunction sendHtml(res, status, html) {');
a(branch.includes('/* sale-payment-history-v1 */'),'The reviewed root handler must be present');
async function fixture(){
 const f=nativeRequire('../test/helpers/commercial-ownership-fixtures.cjs').fixture(),root=f.db.root,Index=nativeRequire('./payment-membership-index'),calls=[],control={change:null};
 root.sisventas.ventas.one.responsableUid='a';root.sisventas.ventas.one.totalPagado=40;root.sisventas.ventas.one.pagos=[];
 root.sisventas.pagos={p:{id:'P-FIXTURE',ventaFbKey:'one',monto:40,fecha:'2026-11-25',medio:'Efectivo',comprobanteCuenta:true,grupoPago:'fixture-group'}};
 const set=(p,v)=>{const parts=p.split('/');let node=root;for(const k of parts.slice(0,-1))node=node[k]??={};node[parts.at(-1)]=structuredClone(v);};
 for(const [p,v]of Object.entries(Index.buildIndex(root.sisventas.pagos,{generation:'http-history-fixture',ready:true}).patch))set(p,v);
 const get=p=>p.split('/').reduce((v,k)=>v?.[k],root)??null;
 const store=nativeRequire('./labor-rtdb-store').createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=fiction-http-no-network',accessToken:async()=>'FIXTURE_ONLY',fetchImpl:async(url,options)=>{
  a.equal(options.method,'GET','No business writes');const target=new URL(url);a.equal(target.origin,'http://127.0.0.1:1');const p=decodeURIComponent(target.pathname).slice(1,-5),identity=JSON.parse(target.searchParams.get('auth_variable_override')||'null');calls.push({path:p,identity});
  if(identity){a.equal(identity.uid,identity.token.uid);a.deepEqual(Object.keys(identity.token),['uid']);const actor=await f.auth(identity.uid);if(p.startsWith('sisventas/ventas/')){const id=p.split('/').at(-1);if(!(await f.api.visibleRecordsByIds(actor,'ventas',[id]))[id])return {ok:false,status:403,json:async()=>({})};}}
  const value=structuredClone(get(p));if(identity&&p==='sisventas/pagos/p')control.change?.();return {ok:true,status:200,json:async()=>value};
 }});
 const handler=vm.runInNewContext(sender+'\n(async function(req,res){const pathname=new URL(req.url,"http://localhost").pathname;\n'+branch+'\n})',{URL,require:nativeRequire,commercialOwnership:f.api,laborRuntime:{store}});
 async function request(url,uid='a'){
  const headers={},res={statusCode:null,text:null,setHeader(k,v){headers[k.toLowerCase()]=v;},writeHead(status,fields){this.statusCode=status;for(const [k,v]of Object.entries(fields))headers[k.toLowerCase()]=v;},end(text){a.equal(this.text,null,'Exactly one response');this.text=text;}};
  await handler({method:'GET',url,headers:uid?{authorization:'Bearer '+uid}:{}},res);a.notEqual(res.statusCode,null);return {status:res.statusCode,headers,body:JSON.parse(res.text)};
 }
 return {...f,root,calls,control,request};
}
test('literal GET returns one global payment with original actor/Store, no binary fields and zero writes',async()=>{
 const f=await fixture(),before=structuredClone(f.root),r=await f.request('/comerciales/ventas/registro/one?para=pagos');a.equal(r.status,200);a.equal(r.headers['cache-control'],'private, no-store');a.equal(r.headers.vary,'Authorization, Origin');a.equal(r.body.ok,true);a.equal(r.body.record.fbKey,'one');a.deepEqual(r.body.record.pagos,[]);a.equal(r.body.paymentHistory.source,'global');a.equal(r.body.paymentHistory.paidAmount,40);a.equal(r.body.paymentHistory.complete,true);a.deepEqual(r.body.paymentHistory.payments,[{fbKey:'p',id:'P-FIXTURE',monto:40,fecha:'2026-11-25',medio:'Efectivo',hasReceipt:true}]);a(f.calls.some(c=>c.path==='sisventas/pagos/p'&&c.identity?.token.uid==='a'));a.deepEqual(f.root,before);
});
test('literal purpose denies budgets and administrator view-as without successful empty history',async()=>{
 const f=await fixture();for(const [url,uid]of [['/comerciales/presupuestos/registro/budget?para=pagos','a'],['/comerciales/ventas/registro/one?para=pagos&verComo=a','admin']]){const r=await f.request(url,uid);a.equal(r.status,403);a.equal(r.body.ok,false);a.equal(Object.hasOwn(r.body,'paymentHistory'),false);}a.equal(f.calls.length,0);
});
test('literal GET rejects missing session, inactive role and another owner',async()=>{
 const f=await fixture();for(const uid of [null,'tech','b']){const r=await f.request('/comerciales/ventas/registro/one?para=pagos',uid);a([401,403,404].includes(r.status));a.equal(r.body.ok,false);a.equal(Object.hasOwn(r.body,'paymentHistory'),false);}a.equal(f.calls.length,0);
});
test('role change after payment source read aborts HTTP response instead of empty success',async()=>{
 const f=await fixture();f.control.change=()=>{f.root.sv_chat_roles.a.activo=false;};const r=await f.request('/comerciales/ventas/registro/one?para=pagos');a.equal(r.status,403);a.equal(r.body.ok,false);a.equal(Object.hasOwn(r.body,'paymentHistory'),false);
});
test('ordinary record GET is unchanged and does not load payment sources',async()=>{
 const f=await fixture(),before=structuredClone(f.root),r=await f.request('/comerciales/ventas/registro/one');a.equal(r.status,200);a.deepEqual(r.body,{ok:true,record:{...f.root.sisventas.ventas.one,fbKey:'one'}});a.equal(f.calls.length,0);a.deepEqual(f.root,before);
});
test('commission purpose retains its native economic projection and authorization',async()=>{
 const f=await fixture();f.root.sisventas.ventas.one.audit=[{accion:'Private fixture audit'}];f.root.sisventas.ventas.one.total=100;const before=structuredClone(f.root),r=await f.request('/comerciales/ventas/registro/one?para=comision','admin');a.equal(r.status,200);a.deepEqual(r.body,{ok:true,record:{...nativeRequire('./commission-detail-projection').project(before.sisventas.ventas.one),fbKey:'one'},projection:'commission-economic-v1'});const denied=await f.request('/comerciales/ventas/registro/one?para=comision');a.equal(denied.status,403);a.equal(denied.body.ok,false);a.equal(f.calls.length,0);a.deepEqual(f.root,before);
});
