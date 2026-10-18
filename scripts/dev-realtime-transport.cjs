'use strict';
// Estado de conexión y referencia inexistente sin Auth (denegada por reglas).
// Nunca lee/escribe datos de negocio.
const http=require('node:http'),fs=require('node:fs');
const {config}=require('./deploy-secure-hosting.cjs');
const policy=config.headers[0].headers['Content-Security-Policy'];
const sdkBase=process.env.SV_TRANSPORT_SDK_DIR?'':'https://www.gstatic.com/firebasejs/10.12.0';
function html(){return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prueba de conexión alternativa</title>
<style>body{background:#101a2b;color:#e7edff;font:17px system-ui;padding:30px;max-width:850px;margin:auto}pre{white-space:pre-wrap}a{color:#9abaff}</style>
<h1>Conexión alternativa de Firebase</h1><p>Sin sesión, sin datos de negocio y sin cambios en la base.</p><p><a href="/?baseline=1">Política anterior</a> · <a href="/">Política corregida</a></p><pre id="result" role="status">Conectando…</pre>
<script>
const result=document.getElementById('result');
window.addEventListener('error',e=>result.textContent='ERROR: '+e.message);
window.addEventListener('unhandledrejection',e=>result.textContent='ERROR: '+e.reason?.message);
document.addEventListener('securitypolicyviolation',e=>{if(e.violatedDirective.startsWith('script-src'))result.textContent='BLOQUEADO por la política: '+new URL(e.blockedURI).origin;});
// Reproducir la elección normal del SDK después de una interrupción previa.
localStorage.setItem('firebase:previous_websocket_failure','true');
</script><script type="module">
import {initializeApp} from '${sdkBase}/firebase-app.js';
import {getDatabase,ref,onValue,goOffline,enableLogging} from '${sdkBase}/firebase-database.js';
enableLogging(message=>{const transport=message.includes('long-poll')?'long-poll':message.includes('Websocket connecting')?'websocket':'';if(transport){if(!result.dataset.initialTransport)result.dataset.initialTransport=transport;result.dataset.transport=transport;}});
result.textContent='SDK listo. Esperando conexión alternativa…';
const db=getDatabase(initializeApp({projectId:'nixa-sisventas',databaseURL:'https://nixa-sisventas-default-rtdb.firebaseio.com'},'transport-fixture'));
result.dataset.initialized='1';
let connected=false,probe=()=>{},stop=onValue(ref(db,'.info/connected'),s=>{if(s.val()===true){connected=true;result.textContent='CONECTADO · mecanismo alternativo recuperado sin borrar datos';setTimeout(()=>{stop();probe();goOffline(db);},100);}});
// Escuchar .info por sí solo no inicia la conexión. Este path no contiene datos
// y debe ser rechazado para un cliente anónimo; no probar raíces ni colecciones.
probe=onValue(ref(db,'__sisventas_transport_probe__'),()=>{},()=>{});
result.dataset.subscribed='1';
setTimeout(()=>{for(const frame of document.querySelectorAll('iframe')){try{frame.contentDocument.addEventListener('securitypolicyviolation',e=>{if(e.violatedDirective.startsWith('script-src'))result.textContent='BLOQUEADO por la política: '+new URL(e.blockedURI).origin;});}catch(_){}}},100);
setTimeout(()=>{if(!connected&&!result.textContent.startsWith('BLOQUEADO'))result.textContent='SIN CONEXIÓN después de 20 segundos';stop();probe();goOffline(db);},20000);
</script>`;}
const port=Number(process.env.SV_TRANSPORT_PORT||8794);
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 // SV_TRANSPORT_SDK_DIR debe contener SDK públicos, nunca perfiles o credenciales.
 const sdkName={'/firebase-app.js':'firebase-app-diagnostic.js','/firebase-database.js':'firebase-sdk-diagnostic.js'}[url.pathname];
 if(sdkName&&process.env.SV_TRANSPORT_SDK_DIR){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(fs.readFileSync(require('node:path').join(process.env.SV_TRANSPORT_SDK_DIR,sdkName),'utf8').replaceAll('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js','/firebase-app.js'));return;}
 if(url.pathname!=='/'){res.writeHead(404).end();return;}
 const csp=url.searchParams.has('baseline')?policy.replace(' https://*.firebaseio.com/.lp',''):policy;
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':csp});res.end(html());
}).listen(port,'127.0.0.1',()=>console.log('Prueba de transporte sin Auth: http://127.0.0.1:'+port+'/'));
