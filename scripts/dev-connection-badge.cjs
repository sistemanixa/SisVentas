'use strict';
// Sólo presentación con estados simulados: no SDK, Auth, datos ni red externa.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {functionSource}=require('../test/helpers/app-functions.cjs');
function start(port=8797){return http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-ancestors 'none'");
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/css/app.css'){res.setHeader('Content-Type','text/css');res.end(fs.readFileSync(path.join(__dirname,'../css/app.css')));return;}
 if(url.pathname==='/badge.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end('const navigator={onLine:true};var fbOnline=true;'+functionSource('fbMostrarEstadoConexion')+`
 document.querySelector('#cut').onclick=()=>{navigator.onLine=false;fbMostrarEstadoConexion();};
 document.querySelector('#return').onclick=()=>{navigator.onLine=true;fbMostrarEstadoConexion();};
 document.querySelector('#confirm').onclick=()=>{fbOnline=true;fbMostrarEstadoConexion();};
 fbMostrarEstadoConexion();`);return;}
 if(url.pathname!=='/'){res.writeHead(404).end();return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Estado de conexión · prueba aislada</title><link rel="stylesheet" href="/css/app.css"><body class="dark-mode"><main style="max-width:660px;margin:12vh auto;padding:24px"><div class="card"><h2>Estado de conexión</h2><p style="color:var(--text3);margin:12px 0 24px">Simulación local · sin Firebase ni datos reales</p><p>Encabezado: <span id="fb-status"></span></p><p style="margin:14px 0 24px">Configuración: <span id="fb-status-cfg"></span></p><div style="display:flex;flex-wrap:wrap;gap:10px"><button class="btn" id="cut">Cortar red (simulado)</button><button class="btn" id="return">Volver a la red</button><button class="btn" id="confirm">Confirmar Firebase</button></div></div></main><script src="/badge.js"></script></body></html>`);
 }).listen(port,'127.0.0.1',()=>console.log('Prueba aislada de conexión: http://127.0.0.1:'+port+'/'));}
if(require.main===module)start();module.exports={start};
