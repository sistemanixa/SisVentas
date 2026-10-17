'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {functionSource}=require('../test/helpers/app-functions.cjs');
const html='<!doctype html><html lang="es" class="dark-mode"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avisos · prueba aislada</title><link rel="stylesheet" href="/style.css"><body style="padding:24px"><h1>Avisos de texto</h1><p style="margin:16px 0">Prueba local sin Firebase ni datos reales.</p><label for="message">Mensaje de ejemplo</label><input id="message" value="Producto de prueba &amp; accesorios: total &lt; 5" style="display:block;width:100%;margin:10px 0"><button id="show" class="btn">Mostrar aviso</button><button id="markup" class="btn">Probar etiquetas como texto</button><div id="notif" class="notif" role="status" aria-live="polite"></div><script src="/toast.js"></script></body></html>';
const js='var notifT=0;\n'+functionSource('notify')+'\ndocument.getElementById("show").addEventListener("click",()=>notify(document.getElementById("message").value,15000));document.getElementById("markup").addEventListener("click",()=>notify("<img src=x onerror=unsafe()> · Texto de prueba & accesorios",15000));';
const server=http.createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'");res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 const p=new URL(req.url,'http://localhost').pathname;
 if(p==='/'||p==='/mobile'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(p==='/'?html:'<!doctype html><title>Avisos móvil 390</title><iframe title="Avisos móvil" src="/" style="width:390px;height:844px;border:1px solid #334;display:block;margin:auto"></iframe>');}
 if(p==='/toast.js'){res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end(js);}
 if(p==='/style.css'){res.setHeader('Content-Type','text/css; charset=utf-8');return res.end(fs.readFileSync(path.join(__dirname,'../css/app.css')));}
 res.writeHead(404);res.end();
});server.listen(Number(process.env.SV_TOAST_FIXTURE_PORT||0),'127.0.0.1',()=>console.log('Prueba de avisos: http://127.0.0.1:'+server.address().port+'/'));
