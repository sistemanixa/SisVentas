'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),baseCommit=process.env.SEGMENT_BASE_COMMIT||'a7592ccc853a386a62ce54748a3117895ee36ac0';
const git=process.env.GIT_BIN||'git';
const {chromium}=require('playwright');
const Index=require(root+'/cotizador/payment-membership-index');const {createCommercialOwnership}=require(root+'/cotizador/commercial-ownership');
const {memoryDB}=require(root+'/test/helpers/private-finance-fixtures.cjs');
const {AsyncLocalStorage}=require('async_hooks');const requestContext=new AsyncLocalStorage();
const count=Number(process.env.SEGMENT_COUNT||1000),cache=new Map(),out=process.env.SEGMENT_OUTPUT||path.join(root,'tmp','segment-first-results');fs.mkdirSync(out,{recursive:true});
function old(file){if(!cache.has(file))cache.set(file,cp.execFileSync(git,['-C',root,'show',baseCommit+':'+file],{maxBuffer:20e6,windowsHide:true}));return cache.get(file);}
let variant='before',profile='normal',httpRows=[],dbRows=[],fixtureWrites=0;
const initial=fs.readFileSync(root+'/test/fixtures/module-audit-bootstrap.js','utf8');
const fixtureLiteral=initial.match(/const fixtureRoot=([\s\S]*?);\r?\nconst clone=/)[1];
const data=vm.runInNewContext('('+fixtureLiteral+')');
data.sv_permisos={admin:{indiceVersion:2,indiceRevision:1,indiceModulos:{venta:true,detalle:true,cobranzas:true,presupuesto:true}}};data['.info']={connected:true};
data.sisventas.gastos={};data.sisventas.vacaciones={};data.sisventas.proveedores={};
data.sisventas.ventas={old:{id:'V-OLD',responsableUid:'fixture',creadaPor:'Administrador ficticio',fecha:'2024-01-01',cliente:'Cliente ficticio',clienteFbKey:'c',conIva:false,total:10000,subtotal:10000,items:[{codigo:'P-1',desc:'Equipo ficticio',qty:1,punit:10000,sub:10000}]}};
for(let n=0;n<count;n++)data.sisventas.ventas['unrelated-'+n]={id:'V-'+n,responsableUid:'fixture',cliente:'Cliente ficticio',clienteFbKey:'c',fecha:'2026-01-01',total:100,conIva:false,items:[{codigo:'P-OTHER',desc:'Producto no solicitado '+n,qty:1,punit:100,sub:100}],obs:'No pertenece al detalle solicitado. '.repeat(5)};
data.sisventas.pagos={current:{ventaFbKey:'old',ventaId:'V-OLD',monto:3000,fecha:'2026-10-27'},cancel:{ventaFbKey:'old',monto:7000,fecha:'2026-10-27',anulado:true}};
const index=Index.buildIndex(data.sisventas.pagos,{generation:'benchmark-fixture-generation',ready:true});for(const [p,v]of Object.entries(index.patch)){let at=data,parts=p.split('/');for(const part of parts.slice(0,-1))at=at[part]??={};at[parts.at(-1)]=v;}
const memory=memoryDB(data);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function readDB(p){const value=(await memory.ref(p).get()).val();const bytes=Buffer.byteLength(JSON.stringify(value)),ctx=requestContext.getStore()||{dbRows,profile};ctx.dbRows.push({path:p,bytes});await sleep((ctx.profile==='slow'?30:1)+bytes/(ctx.profile==='slow'?128000:20000000)*1000);return value;}
const db={ref:p=>({get:async()=>({val:()=>null})})};db.ref=p=>({get:async()=>{const value=await readDB(p);return{val:()=>value};}});
const api=createCommercialOwnership({db,auth:{verifyIdToken:async()=>({uid:'fixture'})},enabled:true,pointReadsEnabled:true,pointReader:require(root+'/cotizador/sale-point-read').readSalePoint});
let bootstrap=initial.replace('const fixtureRoot='+fixtureLiteral+';','const fixtureRoot={sisventas:{config:{version:"v3.15.8-firebase"}},sv_usuarios:{fixture:{uid:"fixture",nombre:"Administrador ficticio",rol:"admin",activo:true}}};');
bootstrap=bootstrap.replace("return Promise.resolve(new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}}));","return realFetch(input,options);");
bootstrap=bootstrap.replace('return snapshot(read(ref));','return snapshot(await __fixtureRead(ref));');
bootstrap=bootstrap.replace('Promise.resolve(fn(snapshot(read(ref)))).then(','__fixtureRead(ref).then(value=>{if(row.active)return fn(snapshot(value));}).then(');
bootstrap=bootstrap.replace("return {key,path:ref.path+'/'+key};","return Object.assign(Promise.resolve({key,path:ref.path+'/'+key}),{key,path:ref.path+'/'+key});");
bootstrap=bootstrap.replace("({path,key:path.split('/').at(-1)})","({path,key:path.split('/').at(-1),toString(){return location.origin+'/'+path;}})");
bootstrap+='\nasync function __fixtureRead(ref){const r=await realFetch("/sdk?path="+encodeURIComponent(String(ref?.path??ref??"")));return r.json();}\n';
const start=`document.addEventListener('DOMContentLoaded',async()=>{isAuthenticated=true;currentRole='admin';currentUserUid='fixture';currentUser='Administrador ficticio';currentUserEmail='fixture@example.invalid';window.tienePermiso=()=>true;window.permisoModulo=()=>true;window.svPuedeLeerDominio=()=>true;window.cargarPermisosRoles=async()=>true;window._svPermisosCargaInicial=Promise.resolve(true);window.svV3LaunchBeforeSession=()=>false;window.SVServiceAuth={headers:async()=>({Authorization:'Bearer FICTICIO'})};window.SISVENTAS_FUNCTIONS.cotizadorProveedor=location.origin;window.SISVENTAS_FUNCTIONS.asistente=location.origin;window.__pointStarted=performance.now();await window.SVSessionAssets.forRole(currentRole,()=>true);_completarLogin(currentUser);});`;
// Only fixtures and allowlisted static assets are served; never Firebase SDKs.
const removed=/\/(?:firebase|security-storage|user-access|service-auth|guarded-writes|release-permissions|role-guard|offline-core|private-finance-portal)\.js/;
const server=http.createServer((req,res)=>requestContext.run({httpRows,dbRows,profile},async()=>{
 const u=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'none'; object-src 'none'");
 async function json(value,status=200){const body=Buffer.from(JSON.stringify(value));const ctx=requestContext.getStore();ctx.httpRows.push({path:u.pathname,bytes:body.length,status});await sleep((ctx.profile==='slow'?150:10)+body.length/(ctx.profile==='slow'?128000:20000000)*1000);res.writeHead(status,{'Content-Type':'application/json'}).end(body);}
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 try{
 if(u.pathname==='/sdk'){await json(await readDB(u.searchParams.get('path')));return;}
 if(u.pathname.startsWith('/comerciales/')){const actor=await api.authorize({headers:{authorization:'Bearer fictitious'}},'ventas');await json({ok:true,...(u.pathname.includes('/puntual/')?await api.point(actor,'old'):u.pathname.endsWith('presupuestos')?await api.list(await api.authorize({headers:{authorization:'Bearer fictitious'}},'presupuestos')):await api.list(actor))});return;}
 if(u.pathname.startsWith('/usuarios/')||u.pathname.startsWith('/laboral/')){await json({ok:true,users:Object.values(data.sv_usuarios),profile:{...data.sv_usuarios.fixture,fbKey:'fixture'},empleados:data.sisventas.empleados,cargos:{},records:[]});return;}
 if(u.pathname==='/boot.js'||u.pathname==='/start.js'){res.writeHead(200,{'Content-Type':'text/javascript'}).end(u.pathname==='/boot.js'?bootstrap:start);return;}
 if(u.pathname==='/'){let html=(variant==='before'?old('index.html'):fs.readFileSync(root+'/index.html')).toString().replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,(tag,url)=>/^https?:/.test(url)||removed.test(url)?'':tag).replace(/<link\b[^>]*href=["']https?:[^>]*>/gi,'');html=html.replace('<head>','<head><script src="/boot.js"></script>').replace('</body>','<script src="/start.js"></script></body>');res.writeHead(200,{'Content-Type':'text/html'}).end(html);return;}
 const p=decodeURIComponent(u.pathname.slice(1));if(!/^(js|css)\/[\w./-]+\.(js|css)$/.test(p)||p.includes('..')||removed.test('/'+p)){res.writeHead(404).end();return;}
 const body=variant==='before'?old(p):fs.readFileSync(root+'/'+p);res.writeHead(200,{'Content-Type':p.endsWith('css')?'text/css':'text/javascript'}).end(body);
 }catch(e){await json({ok:false,mensaje:e.message},e.statusCode||503);}
}));
async function main(){if(process.argv.includes('--serve')){variant='after';profile='normal';await new Promise(r=>server.listen(8936,'127.0.0.1',r));console.log('Fixture local sin Firebase real: http://127.0.0.1:8936/?ventaPuntual=old#/detalle');return;}await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{})});const rows=[];
 try{for(const mode of ['normal','slow'])for(const which of (process.env.SEGMENT_QUICK==='1'?['before','after']:['before','after','after','before','before','after'])){variant=which;profile=mode;httpRows=[];dbRows=[];const page=await browser.newPage({serviceWorkers:'block'});await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const errors=[];page.on('pageerror',e=>errors.push(e.message));const began=Date.now();await page.goto(origin+'/?ventaPuntual=old#/detalle',{waitUntil:'domcontentloaded'});
 if(which==='before'){await page.waitForFunction(()=>window.ventasList?.some(v=>v.fbKey==='old'),null,{timeout:45000});await page.waitForFunction(()=>window.SVDataReadiness?.statusFor('detalle').ready&&document.getElementById('screen-loading')?.style.display==='none',null,{timeout:45000});await page.evaluate(()=>{window._svProximaVistaDirecta='detalle';showPage('detalle');verDetalleVenta('old');});await page.waitForSelector('#venta-detalle-metricas',{state:'visible'});}else await page.getByRole('status').filter({hasText:'Consulta de sólo lectura'}).waitFor({timeout:45000});
 const usableMs=Date.now()-began;await page.waitForTimeout(2500);const body=await page.locator(which==='before'?'#venta-detalle-view':'#sv-sale-point').innerText();assert.ok(body.includes('7.000'),body.slice(0,300));
 const row={variant:which,profile:mode,usableMs,httpBytes:httpRows.reduce((n,r)=>n+r.bytes,0),httpRequests:httpRows.slice(),dbJsonBytes:dbRows.reduce((n,r)=>n+r.bytes,0),dbReads:dbRows.slice(),fixtureWrites:await page.evaluate(()=>__moduleAudit.writes.length),errors,correctBalance:true};rows.push(row);await page.screenshot({path:out+'/'+which+'-'+mode+'.png'});console.log(JSON.stringify({variant:which,profile:mode,usableMs,httpBytes:row.httpBytes,dbJsonBytes:row.dbJsonBytes,dbReads:row.dbReads.length,errors:errors.length}));await page.close();}
 fs.writeFileSync(out+'/results.json',JSON.stringify({baseCommit,count,realApplicationCode:true,auth:'fictitious SDK identity, not production',transport:'real HTTP loopback; simulated DB and bandwidth',limits:['Not a Google invoice or actual Firebase framing.','Before uses full detail; after is a read-only narrow detail, not editing, commissions or OT.','No production records or services accessed.'],rows},null,2));
 }finally{await browser.close();server.closeAllConnections();server.close();}}
main().catch(e=>{console.error(e.stack);server.closeAllConnections();server.close();process.exitCode=1;});
