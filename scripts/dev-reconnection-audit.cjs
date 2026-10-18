'use strict';
// Simula sólo en RAM la indisponibilidad de lecturas HTTP, sin Firebase/Auth.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const allowed=new Map([['/','test/fixtures/reconnection-audit.html'],['/js/core/data-readiness.js','js/core/data-readiness.js'],['/js/core/commercial-ownership.js','js/core/commercial-ownership.js'],['/js/core/user-directory.js','js/core/user-directory.js']]);
function start(port=8796){
 let mode='online',revision=1;
 return http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  const url=new URL(req.url,'http://localhost');
  if(req.method!=='GET'){res.writeHead(405).end('Sin escrituras');return;}
  const json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
  if(url.pathname==='/__fixture/network'){
   const next=url.searchParams.get('state');if(next&&!['online','offline','error'].includes(next)){res.writeHead(400).end();return;}
   if(next){mode=next;if(next==='online')revision++;}json({mode,revision});return;
  }
  if(['/comerciales/ventas','/comerciales/presupuestos','/usuarios/directorio'].includes(url.pathname)){
   if(req.headers.authorization!=='Bearer FICTICIO'){res.writeHead(401).end();return;}
   if(mode==='offline'){req.socket.destroy();return;}
   if(mode==='error'){res.statusCode=503;json({ok:false,mensaje:'Fallo ficticio de lectura'});return;}
   json(url.pathname==='/usuarios/directorio'?{ok:true,users:[{uid:'fixture',fbKey:'f',nombre:'Persona ficticia',rol:'vendedor'}]}:{ok:true,records:{demo:{total:revision,responsableUid:'fixture'}}});return;
  }
  const name=allowed.get(url.pathname);if(!name){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(root,name)));
 }).listen(port,'127.0.0.1',()=>console.log('Auditoría HTTP aislada: http://127.0.0.1:'+port+'/'));
}
if(require.main===module)start(Number(process.env.SV_RECONNECTION_PORT||8796));
module.exports={start};
