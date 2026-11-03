'use strict';
// Aplicación completa + servicios reales sobre memoria ficticia. Cero credenciales/SDK remotos.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
async function start(port=0,{role='admin',sourceRoot=path.resolve(__dirname,'..'),accounts=null,fullStartup=false}={}){
 const source=path.resolve(sourceRoot),load=name=>require(path.join(source,name));
 const {readActiveApp}=load('test/helpers/active-app'),{createBackend,apply}=load('test/helpers/labor-ui-flow.cjs'),P=load('js/core/permission-index'),{createCommercialOwnership}=load('cotizador/commercial-ownership'),{createPaymentCommands}=load('cotizador/payment-commands');
 if(!['admin','administrativo'].includes(role))throw Error('Rol ficticio no habilitado para este circuito');
 const product={codigo:'QA-001',nombre:'Cámara ficticia de auditoría',categoria:'Cámaras',categoriaFbKey:'cat',compra:100,compraARS:100,precioGremio:100,venta:200,ventaARS:200,moneda:'ARS',monedaCarga:'ARS',unidad:'Unidad',iva:21,activo:true,stock:20,precioActualizadoEn:Date.now()};
 const backend=createBackend({ventas:{},presupuestos:{},pagos:{},clientes:{c:{id:'C-QA',nombre:'Cliente ficticio de auditoría',dir:'Domicilio ficticio 123',direccion:'Domicilio ficticio 123',activo:true}},productos:{p:product},categorias:{cat:{nombre:'Cámaras'}},config:{empresa:{nombre:'EMPRESA FICTICIA · AUDITORÍA'},dolar:{oficial:1500,usdt:1600},tableColumns:{},aprobaciones:{montoLimite:99999999,descuentoLimite:100}},contadores:{presupuesto:9000,venta:9000},sentinel:{stock:20,private:'Sin modificar'}});
 backend.state.sv_chat_roles.u.rol=role;backend.state.sv_usuarios={u:{uid:'u',nombre:'Persona ficticia',rol:role,activo:true}};backend.state.sv_chat_directorio={u:{nombre:'Persona ficticia',activo:true}};
 apply(backend.state,require('../cotizador/payment-membership-index').buildIndex(backend.state.sisventas.pagos,{generation:'master-audit-fixture',ready:true}).patch);
 backend.state.sv_permisos=P.build({[role]:{bloqueados:[],acciones:{presupuestos:{crear:true,editar:true,aprobar:true},ventas:{crear:true,editar:true},cobranzas:{registrar:true}}}});
 if(accounts){
  const sales={},payments={};
  if(accounts!=='empty')for(let i=0;i<121;i++){
   const c='c'+i;backend.state.sisventas.clientes[c]={id:'QA-'+i,nombre:'Persona ficticia '+i,activo:true};
   sales['s'+i]={id:'V-QA-'+i,clienteFbKey:c,cliente:'Persona ficticia '+i,fecha:'2026-10-01',total:100,responsableUid:accounts==='new-user'?'otro':'u',items:[{qty:1,punit:100,costoUnitarioCompra:40}]};
   payments['p'+i]={ventaFbKey:'s'+i,monto:20,fecha:'2026-11-01'};
  }
  backend.state.sisventas.ventas=sales;backend.state.sisventas.pagos=payments;
  const customers={clients:backend.state.sisventas.clientes,index:{},structures:{}};
  const account=await load('cotizador/client-account-projections').prepare({sales,payments,customers,owner:s=>s.responsableUid,generation:'master-account-fixture'});
  apply(backend.state,{...account.patch,sv_client_accounts_config:{schema:1,generation:'master-account-fixture',ready:true}});
  const commercial=await load('cotizador/commercial-pages-projections').prepare({sales,payments,owner:s=>s.responsableUid,generation:'master-commercial',nativeCollections:true});
  apply(backend.state,{...commercial.patch,...load('cotizador/payment-membership-index').buildIndex(payments,{generation:'master-commercial',ready:true}).patch,sv_commercial_pages_config:{schema:1,generation:'master-commercial',ready:true,nativeCollectionsReady:true,nativeCollectionsSchema:1}});
  if(accounts==='missing')delete backend.state.sv_client_accounts.v1.coverage;
 }
 const snap=v=>({val:()=>structuredClone(v),exists:()=>v!=null});
 const db={ref:p=>({get:async()=>snap(backend.get(p)),orderByChild:field=>({equalTo:value=>({get:async()=>snap(Object.fromEntries(Object.entries(backend.get(p)||{}).filter(([,r])=>r?.[field]===value)))})}),on:(_e,cb)=>queueMicrotask(()=>cb(snap(backend.get(p)))),off(){},transaction:async fn=>{const v=fn(backend.get(p));if(v!==undefined)apply(backend.state,{[p]:v});return {committed:v!==undefined,snapshot:snap(v)};},update:async v=>apply(backend.state,Object.fromEntries(Object.entries(v).map(([k,x])=>[p+'/'+k,x])))})};
 const own=createCommercialOwnership({auth:{verifyIdToken:async t=>{if(t!=='fixture-token')throw Error('Sólo identidad ficticia');return {uid:'u'};}},db,enabled:true});
 const directory=load('cotizador/user-directory').createUserDirectory({auth:{verifyIdToken:async token=>{if(token!=='fixture-token')throw Error('Sólo identidad ficticia');return {uid:'u'};}},db,enabled:true});
 const payments=createPaymentCommands({authorize:backend.gateway.authorize,db,store:backend.store,guard:backend.guard,enabled:true});
 const root=source,fixtureRoot=path.resolve(__dirname,'..'),allowed=new Set(load('scripts/deploy-secure-hosting.cjs').files()),requests=[];
 let html=readActiveApp().index.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,(tag,src)=>/^https?:/.test(src)||/\/(?:firebase|security-storage|user-access|service-auth|release-permissions|role-guard|offline-core|private-finance-portal)\.js/.test(src)?'':tag).replace(/<link\b[^>]*href=["']https?:[^>]*>/gi,'');
 html=html.replace('<head>','<head><script src="/qa-bootstrap.js"></script>').replace('</body>','<script src="/qa-start.js"></script></body>');
 const send=(res,status,v)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(v));};
 const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost'),t=performance.now();let body,bytes=0;const end=res.end.bind(res);res.end=(chunk,...args)=>{bytes+=chunk?Buffer.byteLength(chunk):0;return end(chunk,...args);};res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self' blob:; worker-src 'none'; form-action 'none'; object-src 'none'");res.on('finish',()=>requests.push({method:req.method,path:u.pathname,readPath:u.pathname==='/audit/db'?u.searchParams.get('path'):undefined,status:res.statusCode,bytes,ms:+(performance.now()-t).toFixed(2)}));
 try{
 if(req.method==='POST'){let text='';for await(const x of req){text+=x;if(text.length>2000000)throw Error('Payload ficticio demasiado grande');}body=JSON.parse(text||'{}');}
 if(['/usuarios/directorio','/usuarios/perfil'].includes(u.pathname)){const actor=await directory.authorize(req);send(res,200,{ok:true,...await (u.pathname.endsWith('/perfil')?directory.profile(actor):directory.directory(actor))});return;}
 if(u.pathname==='/audit/state'){send(res,200,{state:backend.state,requests});return;}
 if(u.pathname==='/audit/db'){const p=u.searchParams.get('path')||'';if(!/^(sisventas|sv_[a-z_]+)(\/|$)/.test(p)||p.split('/').some(k=>/[.#$\[\]]/.test(k)))throw Error('Ruta inválida');let value=backend.get(p);const query=JSON.parse(u.searchParams.get('query')||'[]');if(query.length){
 let entries=Object.entries(value||{}),field=query.find(q=>q.kind==='child')?.field;
 const sort=([k,v])=>field?v?.[field]:k;
 entries.sort((a,b)=>String(sort(a)).localeCompare(String(sort(b))));
 for(const q of query){if(q.kind==='equal')entries=entries.filter(e=>sort(e)===q.value);if(q.kind==='start')entries=entries.filter(e=>sort(e)>=q.value);if(q.kind==='end')entries=entries.filter(e=>sort(e)<=q.value);if(q.kind==='first')entries=entries.slice(0,q.value);if(q.kind==='last')entries=entries.slice(-q.value);}
 value=Object.fromEntries(entries);
 }send(res,200,{value});return;}
 if(u.pathname==='/audit/sdk'&&body){const {kind,path:p,value,expected}=body;if(!p||p.split('/').some(k=>/[.#$\[\]]/.test(k)))throw Error('Ruta inválida');if(kind==='transaction'&&JSON.stringify(backend.get(p))!==JSON.stringify(expected)){send(res,409,{ok:false,mensaje:'Conflicto ficticio'});return;}if(kind==='update')apply(backend.state,Object.fromEntries(Object.entries(value).map(([k,v])=>[(p?p+'/':'')+k,v])));else apply(backend.state,{[p]:value});send(res,200,{ok:true,value:backend.get(p)});return;}
 const commercial=u.pathname.match(/^\/comerciales\/(ventas|presupuestos)(?:\/(preparar|opciones|reasignar))?$/);
 if(commercial){const actor=await own.authorize(req,commercial[1]);const result=commercial[2]==='preparar'?await own.prepare(actor,body):commercial[2]==='opciones'?await own.options(actor):commercial[2]==='reasignar'?await own.assign(actor,body):await own.list(actor);send(res,200,{ok:true,...result});return;}
 if(u.pathname==='/laboral/escritura'){const actor=await backend.gateway.authorize(req);send(res,200,await backend.gateway.write(actor,body));return;}
 if(u.pathname==='/laboral/capacidades'){send(res,200,{ok:true,payments:{enabled:true,version:1},adminExpense:{enabled:false,version:1}});return;}
 if(u.pathname==='/cobranzas/operacion'){const actor=await backend.gateway.authorize(req);send(res,200,await payments.execute(actor,body));return;}
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return;}
 if(u.pathname==='/qa-bootstrap.js'){res.setHeader('Content-Type','text/javascript');res.end('window.__QA_SEED__='+JSON.stringify(backend.state)+';window.__QA_FULL_STARTUP__='+JSON.stringify(fullStartup)+';\n'+fs.readFileSync(path.join(fixtureRoot,'test/fixtures/master-audit-bootstrap.js'),'utf8'));return;}
 if(u.pathname==='/qa-start.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(fixtureRoot,'test/fixtures/master-audit-start.js'),'utf8'));return;}
 const name=u.pathname.slice(1);if(req.method!=='GET'||!allowed.has(name)||name==='sw.js'||name==='js/core/firebase.js'){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(name)]||'application/octet-stream');res.end(fs.readFileSync(path.join(root,name)));
 }catch(e){send(res,e.statusCode||500,{ok:false,code:e.code,mensaje:e.message});}
 });await new Promise(r=>server.listen(port,'127.0.0.1',r));return {server,backend,requests,url:'http://127.0.0.1:'+server.address().port};
}
if(require.main===module)start(Number(process.argv[2])||8790).then(s=>console.log('AUDITORÍA FICTICIA: '+s.url));module.exports={start};
