'use strict';
// Only synthetic records and loopback transport. No Firebase SDK or credentials.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {performance}=require('node:perf_hooks');
const Accounts=require('../../cotizador/client-account-projections');
const Commercial=require('../../cotizador/commercial-pages-projections');
const Membership=require('../../cotizador/payment-membership-index');
const {createBackend,apply}=require('./labor-ui-flow.cjs');
const {createLaborGuard}=require('../../cotizador/labor-guard');
const Reader=require('../../js/core/client-account-reader.v1');
const {functionSource}=require('./app-functions.cjs');
const ROOT=path.resolve(__dirname,'../..'),ACCOUNT_ROOT='sv_client_accounts/v1';
const clone=value=>value==null?null:structuredClone(value);

function synthetic({salesCount=1100,customerCount=225}={}){
 if(![1100,10000].includes(salesCount)||customerCount!==225)throw Error('Only reviewed synthetic volumes are supported.');
 const sales={},payments={},clients={},expected={all:{totalCents:0,paidCents:0,balanceCents:0},u:{totalCents:0,paidCents:0,balanceCents:0},v:{totalCents:0,paidCents:0,balanceCents:0},clients:{}};
 for(let i=0;i<customerCount;i++)clients['c'+i]={id:'CF-'+String(i).padStart(3,'0'),nombre:i===224?'ZZZ Cliente histórico':'Cliente ficticio '+String(i).padStart(3,'0'),telefono:'0223 555 '+String(i).padStart(4,'0'),email:'persona'+i+'@example.invalid',direccion:'Calle ficticia '+i};
 for(let i=0;i<salesCount;i++){
  const customer=i<121?0:1+(i-121)%224,key='s'+String(i).padStart(5,'0'),clientKey='c'+customer,owner=i%2?'v':'u',totalCents=10000+(i%7)*123;
  const date=customer===224?'2017-01-01':i<121?'2018-01-'+String(1+i%28).padStart(2,'0'):'2026-10-'+String(1+i%28).padStart(2,'0');
  sales[key]={id:'VF-'+String(i).padStart(5,'0'),clienteFbKey:clientKey,cliente:clients[clientKey].nombre,responsableUid:owner,creadorOriginalUid:owner,fecha:date,total:totalCents/100,subtotal:totalCents/100,descuento:0,iva:0,conIva:false,items:[{cod:'PF-'+i,qty:1,punit:totalCents/100,sub:totalCents/100,costoUnitarioCompra:40.01,descripcion:'Producto exclusivamente ficticio '+'.'.repeat(180)}],audit:[{accion:'Alta sintética',usuario:'Fixture',fecha:date}]};
  let paid=0;
  if(i%3===0){payments['p'+key]={ventaFbKey:key,ventaId:sales[key].id,monto:25.01,fecha:'2026-11-01'};paid=2501;}
  if(i%5===0)payments['annulled'+key]={ventaFbKey:key,monto:9.99,fecha:'2026-11-02',anulado:true};
  for(const target of [expected.all,expected[owner],expected.clients[clientKey]??=( {totalCents:0,paidCents:0,balanceCents:0,sales:0,payments:0})]){target.totalCents+=totalCents;target.paidCents+=paid;target.balanceCents+=totalCents-paid;}
  expected.clients[clientKey].sales++;expected.clients[clientKey].payments+=Number(paid>0);
 }
 return {sales,payments,clients,expected,salesCount,customerCount};
}

async function prepare(options={}){
 const readOnly=options.readOnly===true;
 const data=synthetic(options),backend=createBackend({ventas:data.sales,pagos:data.payments,clientes:data.clients,ctaemp:{},gastos:{},inventario_operativo:{sentinel:{general:37}}});
 const customers={clients:data.clients,index:{},structures:{}};
 const prepared=await Accounts.prepare({sales:data.sales,payments:data.payments,customers,owner:s=>s.responsableUid,owners:['u','v'],generation:'volume-accounts-fiction'});
 apply(backend.state,{...prepared.patch,sv_client_accounts_config:{schema:1,ready:true,generation:'volume-accounts-fiction',writerMode:'coordinated-v1',scopeBootstrapVersion:1}});
 if(!readOnly)apply(backend.state,{...(await Commercial.prepare({sales:data.sales,payments:data.payments,owner:s=>s.responsableUid,generation:'volume-commercial-fiction',nativeCollections:true})).patch,...Membership.buildIndex(data.payments,{generation:'volume-commercial-fiction',ready:true}).patch,sv_commercial_pages_config:{schema:1,ready:true,generation:'volume-commercial-fiction',nativeCollectionsReady:true,nativeCollectionsSchema:1,accountWriter:{schema:1,generation:'volume-accounts-fiction',writerMode:'coordinated-v1',scopeBootstrapVersion:1}}});
 if(readOnly)apply(backend.state,{sv_commercial_pages_config:{schema:1,ready:true,generation:'volume-commercial-fiction',accountWriter:{schema:1,generation:'volume-accounts-fiction',writerMode:'coordinated-v1',scopeBootstrapVersion:1}}});
 const permissions={indiceVersion:2,indiceRevision:1,indiceModulos:{cuentacorriente:true,clientes:true},acciones:{clientes:{editar:true}}};
 apply(backend.state,{'sv_chat_roles/u':{activo:true,rol:'admin'},'sv_chat_roles/v':{activo:true,rol:'admin'},'sv_permisos/admin':permissions,'sv_permisos/administrativo':clone(permissions)});
 const guard=createLaborGuard({store:backend.store,commercialPages:true,clientAccounts:true,delay:async()=>{}}),measures=[],subscribers=new Map();
 function measured(path,value,spec={},kind='get',started=performance.now()){
  measures.push({path,kind,...spec,bytes:Buffer.byteLength(JSON.stringify(value)),elapsedMs:performance.now()-started});return value;
 }
 function read(spec,actor={uid:'u',role:'admin'}){
  const p=spec.path,scope=actor.role==='admin'?'all':'u_'+actor.uid;
  const profile=backend.get('sv_chat_roles/'+actor.uid),permission=backend.get('sv_permisos/'+profile?.rol);
  if(profile?.activo!==true||profile.rol!==actor.role||permission?.indiceModulos?.cuentacorriente!==true||p.startsWith('sisventas/clientes/')&&permission.indiceModulos.clientes!==true)throw Error('The synthetic session does not have access to this source.');
  if(!['sv_client_accounts_config','sv_commercial_pages_config'].includes(p)&&!new RegExp('^sv_client_accounts/v1/(?:coverage|totals|pages|pagesByStatus|search|searchByStatus|records|members|ledgers)/'+scope+'(?:/|$)').test(p)&&!/^sisventas\/clientes\/c(?:0|[1-9][0-9]*)$/.test(p))throw Error('The synthetic fixture rejects original roots and foreign account scopes.');
  let value=backend.get(p);
  if(spec.order){if(spec.limit!==50)throw Error('Every list query must be limited to fifty.');value=Object.fromEntries(Object.entries(value||{}).filter(([k])=>(!spec.from||k>=spec.from)&&(!spec.to||k<=spec.to)).sort(([a],[b])=>a.localeCompare(b)).slice(0,50));}
  return measured(p,value,{...(spec.order?{limit:spec.limit,from:spec.from,to:spec.to}:{} )});
 }
 function nodeReader(context={uid:'u',role:'admin',auth:{uid:'u'},db:{},route:'cuentacorriente',permissionRevision:1,canReadAccounts:true,online:true}){
  const states=[];const reader=Reader.create({capture:()=>context,read:async p=>read({path:p},context),query:async(p,{after,limit,from,to})=>read({path:p,order:true,limit,from:after?after+'\u0000':from,to},context),readiness:{beginSource:()=>({ready:()=>states.push('ready'),error:()=>states.push('error'),cancel:()=>states.push('cancel')})}});
  return {reader,context,states};
 }
 function notify(path){for(const [key,sub]of subscribers)if(sub.path===path){const value=backend.get(path);measured(path,value,{},'push');sub.response.write('data: '+JSON.stringify(value)+'\n\n');}}
 async function updateClient(clientKey,changes,{actor='v',order='client-first'}={}){
  if(readOnly)throw Error('The large fixture only measures read transport. Use the1100-sale fixture for guarded events.');
  if(!['u','v'].includes(actor)||backend.get('sv_chat_roles/'+actor)?.activo!==true||!/^c(?:0|[1-9][0-9]*)$/.test(clientKey)||!backend.get('sisventas/clientes/'+clientKey)||!changes||Object.keys(changes).some(k=>!['nombre','telefono','email','direccion'].includes(k))||Object.values(changes).some(v=>typeof v!=='string'||v.length>300))throw Error('Synthetic customer edit is not allowed.');
  const patch=Object.fromEntries(Object.entries(changes).map(([k,v])=>['sisventas/clientes/'+clientKey+'/'+k,v]));
  const result=await guard.run({uid:actor,claims:{uid:actor},mode:'user',operation:'fixture-client-event'},async scope=>{await scope.update(patch);return {committed:true};});
  const events=['sisventas/clientes/'+clientKey,...['all','u_u','u_v'].map(scope=>ACCOUNT_ROOT+'/coverage/'+scope)];
  for(const p of order==='client-first'?events:events.slice().reverse())notify(p);
  return result;
 }
 return {...backend,data,measures,subscribers,read,nodeReader,updateClient,guard};
}

async function start({port=0,salesCount=1100}={}){
 const f=await prepare({salesCount,readOnly:salesCount===10000}),index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),from=index.indexOf('<div id="page-cuentacorriente"'),to=index.indexOf('<!-- ── TESORERÍA',from);
 if(from<0||to<from)throw Error('The current native account section was not found.');
 const section=index.slice(from,to).replace('class="page"','class="page active"');
 const files=['css/app.css','css/loading-status.css','css/v3-preview.css','css/surface-scroll.css','css/responsive-forms.css','css/cuenta-corriente.css','js/core/data-readiness.js','js/core/collection-search-model.v1.js','js/core/client-account-mode.v1.js','js/core/client-account-reader.v1.js','js/core/client-account-writer-proof.v1.js','js/modules/client-account-host.v1.js'];
 const setup=`let isAuthenticated=true;window.isAuthenticated=true;window.fixtureTrace={legacy:[],errors:[],events:[],times:[]};window.addEventListener('error',e=>fixtureTrace.errors.push(e.message));window.currentUserUid=new URLSearchParams(location.search).get('actor')==='v'?'v':'u';window.currentRole='admin';window.currentUser=currentUserUid==='u'?'Usuario ficticio A':'Usuario ficticio B';window.fbAuth={currentUser:{uid:currentUserUid,getIdToken:async()=> 'fiction-'+currentUserUid}};window.fbDB={};window.PERMISOS_ROLES={admin:{indiceRevision:1},administrativo:{indiceRevision:1}};window.SV_CLIENT_ACCOUNTS_ROLLOUT={schema:1,enabled:true};window.fixtureRoute='cuentacorriente';window.fixturePermission=true;window._ccFiltroActual='todos';window._svPaginaDesdeRuta=()=>fixtureRoute;window.permisoModulo=()=>fixturePermission;window.svPuedeLeerDominio=()=>fixturePermission;window.escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.notify=v=>document.getElementById('fixture-message').textContent=v;window._mostrarFecha=v=>v;window.svFechaLocalISO=()=> '2026-11-13';window.SISVENTAS_FUNCTIONS={cotizadorProveedor:location.origin};window.fbRef=(_,path)=>({path});window.fbOrderByKey=()=>({order:true});window.fbStartAt=from=>({from});window.fbEndAt=to=>({to});window.fbLimitToFirst=limit=>({limit});window.fbQuery=(ref,...args)=>Object.assign({},ref,...args);window.fbGet=async spec=>{const started=performance.now(),response=await fetch('/read?spec='+encodeURIComponent(JSON.stringify(spec))+'&uid='+encodeURIComponent(currentUserUid)+'&role='+encodeURIComponent(currentRole));if(!response.ok)throw Error('Synthetic read denied');const value=await response.json();fixtureTrace.times.push({path:spec.path,elapsedMs:performance.now()-started});return{val:()=>value};};window.fixtureSubscriptions=new Map();window.fbOnValue=(ref,cb,onError)=>{const id=Symbol(ref.path),source=new EventSource('/events?path='+encodeURIComponent(ref.path)+'&uid='+encodeURIComponent(currentUserUid)+'&role='+encodeURIComponent(currentRole));const entry={path:ref.path,source,cb};fixtureSubscriptions.set(id,entry);source.onmessage=e=>{const value=JSON.parse(e.data);fixtureTrace.events.push(ref.path);cb({val:()=>value});};source.onerror=()=>{source.close();fixtureSubscriptions.delete(id);onError?.(Error('Synthetic listener closed'));};return()=>{source.close();fixtureSubscriptions.delete(id);};};
 for(const name of ['svCargarDatosDePaginaActual','fbCargarTodo','fbCargarVentas','fbCargarPagos','fbCargarClientes','actualizarConciliacionComercial','renderTablaCuentaCorriente','_ccEsperarFuentesCompletas','buscarCC','setFiltroCC','verCuentaClienteReal','volverListaCuentaCorriente','aplicarFiltroExtractoCuentaCorriente','limpiarFiltroExtractoCuentaCorriente','abrirPagoCuentaCorriente','_ccVentasPendientesActuales','imprimirExtractoCuentaCorriente'])window[name]=()=>{fixtureTrace.legacy.push(name);throw Error('Legacy root reader/action is forbidden in this read-only fixture: '+name);};window.ventasList=[];window._ccAbrirVistaPreviaExtracto=()=>{};window._svSaldoPendienteVenta=v=>v.total-(v.totalPagado||0);window.fixtureShow=page=>{fixtureRoute=page;location.hash='#/'+page;document.getElementById('page-cuentacorriente').classList.toggle('active',page==='cuentacorriente');document.getElementById('fixture-other').hidden=page==='cuentacorriente';document.dispatchEvent(new Event('sisventas:page-changed'));};window.fixtureRename=async()=>{const r=await fetch('/fixture/customer',{method:'POST',headers:{'Content-Type':'application/json','X-Fixture-Actor':'v'},body:JSON.stringify({actor:'v',clientKey:'c224',changes:{nombre:'ZZZ Cliente actualizado',telefono:'0223 555 9999',email:'actualizado@example.invalid'}})});if(!r.ok)throw Error('Synthetic edit failed');return r.json();};`;
 const boot=`(${functionSource('asegurarDesplazamientoTablas')})(document);for(const button of document.querySelectorAll('#cc-detail button'))if(['Registrar pago de cuenta','Imprimir extracto','Ver cliente'].includes(button.textContent.trim())){button.disabled=true;button.title='Demostración de lectura con datos ficticios';}document.getElementById('fixture-away').onclick=()=>fixtureShow('otra');document.getElementById('fixture-return').onclick=()=>fixtureShow('cuentacorriente');document.getElementById('fixture-find').onclick=()=>{document.getElementById('cc-buscador').value='ZZZ';buscarCC();};document.getElementById('fixture-rename').onclick=()=>fixtureRename();document.dispatchEvent(new Event('sisventas:session-ready'));svCargarDatosDePaginaActual();`;
 const html='<!doctype html><html lang="es" class="dark-mode sv-v3-preview"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\';script-src \'self\' \'unsafe-inline\';style-src \'self\' \'unsafe-inline\';connect-src \'self\';img-src \'self\' data:;font-src \'none\'">'+files.filter(p=>p.endsWith('.css')).map(p=>'<link rel="stylesheet" href="/'+p+'">').join('')+'<style>body{margin:0;height:auto;min-height:100vh;overflow-y:auto}.fixture-header{padding:16px;border-bottom:1px solid #2c3b54;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.fixture-header strong{margin-right:auto}.fixture-header button{min-height:44px}.content{padding:16px;max-width:1440px;margin:auto}.page.active{display:block}.page:not(.active){display:none}#fixture-message{display:block;padding:0 16px;color:#efca69}#fixture-other{padding:30px}</style></head><body class="dark-mode"><header class="fixture-header"><strong>Cuenta corriente · datos ficticios · '+salesCount.toLocaleString('es-AR')+' ventas / 225 clientes</strong><button class="btn" id="fixture-find">Cliente histórico</button><button class="btn" id="fixture-rename">Cambio desde otra sesión</button><button class="btn" id="fixture-away">Salir</button><button class="btn" id="fixture-return">Volver a Cuenta corriente</button></header><output id="fixture-message"></output><main class="content">'+section+'<div id="fixture-other" hidden>Otra sección de la demostración.</div></main><script src="/setup.js"></script>'+files.filter(p=>p.endsWith('.js')).map(p=>'<script src="/'+p+'"></script>').join('')+'<script src="/boot.js"></script></body></html>';
 let serial=0;
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1');
  const send=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  if(url.pathname==='/read'){if(req.method!=='GET')return send({error:'Read only'},405);return send(f.read(JSON.parse(url.searchParams.get('spec')),{uid:url.searchParams.get('uid'),role:url.searchParams.get('role')}));}
  if(url.pathname==='/fixture/baseline'&&req.method==='GET'){
   const source=url.searchParams.get('source');if(!['ventas','pagos','clientes'].includes(source))return send({error:'Unknown synthetic baseline'},400);
   const value=f.get('sisventas/'+source);f.measures.push({path:'sisventas/'+source,kind:'explicit-synthetic-baseline',bytes:Buffer.byteLength(JSON.stringify(value))});return send(value);
  }
  if(url.pathname==='/events'){
   const spec={path:url.searchParams.get('path')},actor={uid:url.searchParams.get('uid'),role:url.searchParams.get('role')},value=f.read(spec,actor),id=++serial;
   if(!/^sv_client_accounts\/v1\/coverage\//.test(spec.path)&&!/^sisventas\/clientes\/c\d+$/.test(spec.path))return send({error:'Listener is not approved'},403);
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write('data: '+JSON.stringify(value)+'\n\n');f.subscribers.set(id,{path:spec.path,response:res});req.on('close',()=>f.subscribers.delete(id));return;
  }
  if(url.pathname==='/fixture/customer'&&req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('Synthetic request too large');}const input=JSON.parse(body);if(req.headers['x-fixture-actor']!==input.actor)throw Error('The synthetic actor header must match the editing session.');const result=await f.updateClient(input.clientKey,input.changes,{actor:input.actor,order:input.order});return send(result);}
  if(req.method!=='GET')return send({error:'Financial mutations are disabled'},405);
  if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'});return res.end(html);}
  if(url.pathname==='/setup.js'||url.pathname==='/boot.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(url.pathname==='/setup.js'?setup:boot);}
  const file=url.pathname.slice(1);if(files.includes(file)){res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':'text/javascript'});return fs.createReadStream(path.join(ROOT,file)).pipe(res);}
  return send({error:'Not found'},404);
 }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return {...f,server,url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
module.exports={synthetic,prepare,start,ACCOUNT_ROOT};
