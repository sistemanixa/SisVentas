'use strict';
// Prueba visual local: sólo activos explícitos y datos ficticios en memoria.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=new Set([
 'test/fixtures/budget-presentation.html','test/fixtures/budget-presentation-viewer.html',
 'test/fixtures/budget-presentation-fixture.js','test/fixtures/budget-presentation-fixture.css',
 'js/v3/budget-read-model.js','js/core/budget-presentation-model.js',
 'js/modules/budget-presentation-view.js','js/modules/budget-presentation.js',
 'css/budget-presentation.css','css/app.css','css/v3-preview.css','css/surface-scroll.css',
 'test/fixtures/budget-presentation-camera.png','test/fixtures/budget-presentation-monitor.png',
 'nixa-icon-192.png','nixa-icon-512.png'
]);
const policy="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; frame-src 'self'; frame-ancestors 'self'; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
function createServer(){return http.createServer((request,response)=>{
 response.setHeader('Content-Security-Policy',policy);
 response.setHeader('Cache-Control','no-store');
 response.setHeader('X-Content-Type-Options','nosniff');
 response.setHeader('Referrer-Policy','no-referrer');
 if(!['GET','HEAD'].includes(request.method)){response.setHeader('Allow','GET, HEAD');response.writeHead(405);response.end();return;}
 let name;try{const pathname=new URL(request.url,'http://127.0.0.1').pathname;name=pathname==='/'?'test/fixtures/budget-presentation.html':pathname==='/viewer'?'test/fixtures/budget-presentation-viewer.html':pathname.slice(1);}catch(_){response.writeHead(400);response.end();return;}
 if(!files.has(name)){response.writeHead(404);response.end();return;}
 try{
  const body=fs.readFileSync(path.join(root,name));
  response.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'})[path.extname(name)]);
  response.setHeader('Content-Length',body.length);response.writeHead(200);response.end(request.method==='HEAD'?undefined:body);
 }catch(_){response.writeHead(404);response.end();}
});}
function start(port=8898){
 if(!Number.isInteger(port)||port<0||port>65535)throw Error('Puerto local inválido');
 const server=createServer();server.listen(port,'127.0.0.1',()=>console.log('Visualizador ficticio: http://127.0.0.1:'+server.address().port+'/ · vista sola: /viewer'));
 return server;
}
if(require.main===module){const index=process.argv.indexOf('--port');start(Number(index>=0?process.argv[index+1]:process.env.BUDGET_PRESENTATION_PORT||8898));}
module.exports={createServer,start,files,policy};
