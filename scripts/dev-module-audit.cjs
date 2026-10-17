'use strict';
// La interfaz completa solo recibe datos ficticios. No se cargan SDK de Firebase.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {readActiveApp}=require('../test/helpers/active-app');
const root=path.resolve(__dirname,'..');
const allowed=new Set(require('./deploy-secure-hosting.cjs').files());
const removed=/\/(?:firebase|security-storage|user-access|service-auth|guarded-writes|release-permissions|role-guard|offline-core|private-finance-portal)\.js/;
function page(){
 let html=readActiveApp().index.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,(tag,src)=>/^https?:/.test(src)||removed.test(src)?'':tag);
 html=html.replace(/<link\b[^>]*href=["']https?:[^>]*>/gi,'');
 html=html.replace('<head>','<head><script src="/fixture-bootstrap.js"></script>');
 return html.replace('</body>','<script src="/fixture-start.js"></script></body>');
}
function start(port=8786){return http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self' blob:; worker-src 'self' blob:; form-action 'none'; object-src 'none'");
 const name=new URL(req.url,'http://127.0.0.1').pathname.slice(1);
 if(req.method!=='GET'){res.writeHead(405).end('Operación remota bloqueada en auditoría');return;}
 if(!name){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page());return;}
 if(name==='fixture-bootstrap.js'||name==='fixture-start.js'){
  res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(root,'test/fixtures/module-audit-'+(name.includes('bootstrap')?'bootstrap':'start')+'.js')));return;
 }
 if(name==='sw.js'){res.setHeader('Content-Type','text/javascript');res.end('self.addEventListener("install",()=>self.skipWaiting());');return;}
 if(!allowed.has(name)||removed.test('/'+name)){res.writeHead(404).end();return;}
 const type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'}[path.extname(name)]||'application/octet-stream';
 res.setHeader('Content-Type',type+'; charset=utf-8');res.end(fs.readFileSync(path.join(root,name)));
 }).listen(port,'127.0.0.1',()=>console.log('Interfaz ficticia aislada: http://127.0.0.1:'+port+'/'));}
if(require.main===module)start(Number(process.env.MODULE_AUDIT_PORT)||8786);
module.exports={page,start};
