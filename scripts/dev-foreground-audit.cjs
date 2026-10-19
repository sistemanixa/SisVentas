'use strict';
// Fixture en RAM: sin Firebase SDK, credenciales, servicios externos ni escrituras.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const allowed=new Map([
 ['/','test/fixtures/foreground-audit.html'],
 ['/js/core/foreground-session.js','js/core/foreground-session.js'],
 ['/js/core/commercial-ownership.js','js/core/commercial-ownership.js'],
 ['/js/core/user-directory.js','js/core/user-directory.js'],
 ['/js/core/connection-monitor.js','js/core/connection-monitor.js']
]);
const profile={uid:'fixture',fbKey:'fixture',nombre:'Persona ficticia',rol:'vendedor',activo:true};
function authWrapper(){
 const source=fs.readFileSync(path.join(root,'js/core/firebase.js'),'utf8');
 const begin=source.indexOf('window.fbOnAuth = function'),end=source.indexOf('window.fbCreateUser  =',begin);
 const writeBegin=source.indexOf('function svTrackedDatabaseWrite('),writeEnd=source.indexOf('window.fbApp ',writeBegin);
 if(begin<0||end<0||writeBegin<0||writeEnd<0)throw Error('No se encontraron los wrappers vigentes de Firebase');
 return `(function(){'use strict';
 function onAuthStateChanged(auth,next){window.__fixtureAuthObserver=next;queueMicrotask(()=>next(auth.currentUser));return()=>{if(window.__fixtureAuthObserver===next)window.__fixtureAuthObserver=null;};}
 let authStateReceived=false;window.fbAuthStateReceived=()=>authStateReceived;
 ${source.slice(begin,end)}
 ${source.slice(writeBegin,writeEnd)}
 window.__fixtureFailWrite=svTrackedDatabaseWrite(function(){window.__foregroundAudit.localWrites++;return Promise.reject(Error('Operación ficticia rechazada; no se guardó nada.'));});
 })();`;
}
function page(){return fs.readFileSync(path.join(root,'test/fixtures/foreground-audit.html'),'utf8');}
function start(port=8882){
 const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.writeHead(405).end('Sólo GET; esta prueba no admite escrituras HTTP.');return;}
  const url=new URL(req.url,'http://127.0.0.1');
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  if(url.pathname==='/'&&url.searchParams.has('sv_connection_probe'))return json(401,{ok:false,mensaje:'Sonda ficticia sin datos'});
  if(url.pathname==='/auth-wrapper.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(authWrapper());return;}
  if(['/usuarios/perfil','/usuarios/directorio','/usuarios/administracion','/comerciales/ventas','/comerciales/presupuestos'].includes(url.pathname)){
   if(req.headers.authorization!=='Bearer FICTICIO-SIN-VALIDEZ')return json(401,{ok:false,mensaje:'Esta ruta acepta sólo la identidad ficticia'});
   if(url.pathname==='/usuarios/perfil')return json(200,{ok:true,profile});
   if(url.pathname.startsWith('/usuarios/'))return json(200,{ok:true,users:[profile]});
   const domain=url.pathname.split('/').at(-1),etag='"fixture-'+domain+'-1"';res.setHeader('ETag',etag);
   if(req.headers['if-none-match']===etag){res.writeHead(304).end();return;}
   return json(200,{ok:true,records:{demo:{nombre:domain==='ventas'?'Venta ficticia':'Presupuesto ficticio',responsableUid:'fixture',revision:1}}});
  }
  const file=allowed.get(url.pathname);if(!file){res.writeHead(404).end('Activo no permitido');return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8'});
  res.end(fs.readFileSync(path.join(root,file)));
 });
 return server.listen(port,'127.0.0.1',()=>console.log('Primer plano ficticio: http://127.0.0.1:'+server.address().port+'/?hidden=1'));
}
if(require.main===module)start(Number(process.env.SV_FOREGROUND_AUDIT_PORT||8882));
module.exports={start,page,authWrapper};
