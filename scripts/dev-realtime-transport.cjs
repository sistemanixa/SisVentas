'use strict';
// Estado de conexión y referencia inexistente sin Auth (denegada por reglas).
// Nunca lee/escribe datos de negocio.
const http=require('node:http'),fs=require('node:fs');
const {config}=require('./deploy-secure-hosting.cjs');
const policy=config.headers[0].headers['Content-Security-Policy'];
const sdkBase=process.env.SV_TRANSPORT_SDK_DIR?'':'https://www.gstatic.com/firebasejs/10.12.0';
function html(reconnect=false){return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prueba de conexión alternativa</title>
<style>body{background:#101a2b;color:#e7edff;font:17px system-ui;padding:30px;max-width:850px;margin:auto}pre{white-space:pre-wrap}a{color:#9abaff}</style>
<h1>Conexión alternativa de Firebase</h1><p>Sin sesión, sin datos de negocio y sin cambios en la base.</p><p><a href="/?baseline=1">Política anterior</a> · <a href="/">Política corregida</a></p><pre id="result" role="status">Conectando…</pre>
${reconnect?'<p><button id="cut" disabled>Interrumpir conexión</button> <button id="restore" disabled>Restablecer conexión</button> <button id="stop">Finalizar prueba</button></p><ol id="history"></ol>':''}
<script>
const result=document.getElementById('result');
window.addEventListener('error',e=>result.textContent='ERROR: '+e.message);
window.addEventListener('unhandledrejection',e=>result.textContent='ERROR: '+e.reason?.message);
document.addEventListener('securitypolicyviolation',e=>{if(e.violatedDirective.startsWith('script-src'))result.textContent='BLOQUEADO por la política: '+new URL(e.blockedURI).origin;});
// Reproducir la elección normal del SDK después de una interrupción previa.
localStorage.setItem('firebase:previous_websocket_failure','true');
</script><script type="module">
import {initializeApp} from '${sdkBase}/firebase-app.js';
import {getDatabase,ref,onValue,goOffline,goOnline,enableLogging} from '${sdkBase}/firebase-database.js';
enableLogging(message=>{const transport=message.includes('long-poll')?'long-poll':message.includes('Websocket connecting')?'websocket':'';if(transport){if(!result.dataset.initialTransport)result.dataset.initialTransport=transport;result.dataset.transport=transport;}});
result.textContent='SDK listo. Esperando conexión alternativa…';
const db=getDatabase(initializeApp({projectId:'nixa-sisventas',databaseURL:'https://nixa-sisventas-default-rtdb.firebaseio.com'},'transport-fixture'));
result.dataset.initialized='1';
const reconnect=${JSON.stringify(reconnect)};
let connected=false,interrupted=false,cycles=0,probe=()=>{},stop=onValue(ref(db,'.info/connected'),s=>{
 connected=s.val()===true;
 if(connected){result.textContent='CONECTADO · mecanismo alternativo recuperado sin borrar datos';
  if(!reconnect)setTimeout(()=>{stop();probe();goOffline(db);},100);
  else{if(interrupted){cycles++;interrupted=false;}result.dataset.recoveredCycles=String(cycles);document.getElementById('cut').disabled=false;document.getElementById('restore').disabled=true;const item=document.createElement('li');item.textContent='Conexión confirmada · recuperaciones: '+cycles;document.getElementById('history').append(item);}
 }else if(reconnect&&interrupted)result.textContent='SIN CONEXIÓN · sesión de prueba conservada';
});
// Escuchar .info por sí solo no inicia la conexión. Este path no contiene datos
// y debe ser rechazado para un cliente anónimo; no probar raíces ni colecciones.
probe=onValue(ref(db,'__sisventas_transport_probe__'),()=>{},()=>{});
result.dataset.subscribed='1';
if(reconnect){
 document.getElementById('cut').onclick=()=>{interrupted=true;goOffline(db);document.getElementById('cut').disabled=true;document.getElementById('restore').disabled=false;};
 document.getElementById('restore').onclick=()=>{result.textContent='RECONECTANDO…';probe();probe=onValue(ref(db,'__sisventas_transport_probe__'),()=>{},()=>{});goOnline(db);document.getElementById('restore').disabled=true;};
 document.getElementById('stop').onclick=()=>{stop();probe();goOffline(db);result.textContent='Prueba finalizada · sin escrituras';document.getElementById('cut').disabled=document.getElementById('restore').disabled=true;};
}
setTimeout(()=>{for(const frame of document.querySelectorAll('iframe')){try{frame.contentDocument.addEventListener('securitypolicyviolation',e=>{if(e.violatedDirective.startsWith('script-src'))result.textContent='BLOQUEADO por la política: '+new URL(e.blockedURI).origin;});}catch(_){}}},100);
if(!reconnect)setTimeout(()=>{if(!connected&&!result.textContent.startsWith('BLOQUEADO'))result.textContent='SIN CONEXIÓN después de 20 segundos';stop();probe();goOffline(db);},20000);
</script>`;}
const port=Number(process.env.SV_TRANSPORT_PORT||8794);
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 // SV_TRANSPORT_SDK_DIR debe contener SDK públicos, nunca perfiles o credenciales.
 const sdkName={'/firebase-app.js':'firebase-app-diagnostic.js','/firebase-database.js':'firebase-sdk-diagnostic.js'}[url.pathname];
 if(sdkName&&process.env.SV_TRANSPORT_SDK_DIR){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(fs.readFileSync(require('node:path').join(process.env.SV_TRANSPORT_SDK_DIR,sdkName),'utf8').replaceAll('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js','/firebase-app.js'));return;}
 if(url.pathname!=='/'){res.writeHead(404).end();return;}
 const csp=url.searchParams.has('baseline')?policy.replace(' https://*.firebaseio.com/.lp',''):policy;
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':csp});res.end(html(url.searchParams.has('reconnect')));
}).listen(port,'127.0.0.1',()=>console.log('Prueba de transporte sin Auth: http://127.0.0.1:'+port+'/'));
