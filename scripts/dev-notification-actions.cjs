'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=Number(process.env.SV_NOTIFICATIONS_FIXTURE_PORT||8762);
const policy="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'";
const html='<!doctype html><html lang="es" class="dark-mode"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notificaciones · prueba aislada</title><link rel="stylesheet" href="/style.css"><body style="padding:24px;max-width:1100px;margin:auto"><h1>Notificaciones · prueba aislada</h1><p>Datos ficticios en memoria. Scripts embebidos y evaluación dinámica bloqueados.</p><span id="notif-count-label"></span><section id="notif-lista" style="margin-top:16px"></section><h2>Resultado del recorrido</h2><pre id="result" style="white-space:pre-wrap"></pre><script src="/setup.js"></script><script src="/notifications.js"></script><script src="/ready.js"></script></body></html>';
function fixtureSetup(){
 window.currentUserName='Demo';window.obtenerContextoSesionSisVentas=()=>({usuario:'Demo',email:'demo@example.invalid',rol:'admin'});
 const events=[];window.fixtureLog=(type,id)=>{events.push({type,id});document.getElementById('result').textContent=JSON.stringify(events,null,2);};window.notify=text=>fixtureLog('aviso',text);
 const rows=['presupuesto','ot','gasto','cuentacorriente','horas-extra'].map((tipo,i)=>({id:i===1?"demo'\");alert(1)//<tag>":'demo-'+tipo,titulo:'Ejemplo '+tipo,sub:'Referencia ficticia, sin operaciones reales',color:'blue',accion:{tipo,id:'DEMO-'+i,label:'Abrir '+tipo}}));
 rows.push({id:'legacy',titulo:'Ejemplo anterior',accion:{fn:"abrirOTDesdeNotificacion('OT-ANTERIOR')",label:'Abrir anterior'}});
 rows.push({id:'untrusted',titulo:'Acción desconocida bloqueada',accion:{fn:'window.compromised=true',label:'No debe aparecer'}});
 window.obtenerNotificacionesSisVentas=()=>rows;
}
function fixtureReady(){
 for(const [tipo,name]of Object.entries({presupuesto:'abrirPresupuestoDesdeNotificacion',ot:'abrirOTDesdeNotificacion',gasto:'abrirGastoDesdeNotificacion'}))window[name]=id=>fixtureLog(tipo,id);
 window.showPage=page=>fixtureLog(page);window.abrirPanelAprobacionHsExtra=()=>fixtureLog('horas-extra');renderNotificaciones();
}
const files=new Map([['/notifications.js','js/modules/notifications.js'],['/style.css','css/app.css']]);
for(const file of ['js/core/private-finance-pdf.js','js/vendor/pdfjs/pdf.min.mjs','js/vendor/pdfjs/pdf.worker.min.mjs','js/vendor/zxing/zxing-browser-0.1.5.min.js'])files.set('/'+file,file);
const dependencyHtml='<!doctype html><html lang="es" class="dark-mode"><meta charset="utf-8"><title>Dependencias · CSP sin eval</title><link rel="stylesheet" href="/style.css"><body style="padding:24px"><h1>Dependencias · CSP sin eval</h1><div id="paper" style="width:260px;height:120px;background:white;color:black;padding:20px">Documento ficticio de prueba · 250 ARS</div><pre id="result" style="white-space:pre-wrap">Verificando…</pre><script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script><script src="/js/core/private-finance-pdf.js"></script><script src="/js/vendor/zxing/zxing-browser-0.1.5.min.js"></script><script src="/dependencies.js"></script></body></html>';
async function checkDependencies(){
 const results=[];const run=async(name,fn)=>{try{results.push({name,ok:true,result:await fn()});}catch(e){results.push({name,ok:false,error:e.message});}document.getElementById('result').textContent=JSON.stringify(results,null,2);};
 await run('Excel en memoria',()=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Prueba','Importe'],['Ficticio',250]]),'Ejemplo');const bytes=XLSX.write(book,{bookType:'xlsx',type:'array'});if(!bytes.byteLength)throw Error('Archivo vacío');return {bytes:bytes.byteLength};});
 await run('Captura del documento ficticio',async()=>{const canvas=await html2canvas(document.getElementById('paper'));if(!canvas.width)throw Error('Canvas vacío');return {width:canvas.width,height:canvas.height};});
 await run('Generación PDF en memoria',async()=>{const pdf=await html2pdf().from(document.getElementById('paper')).toPdf().outputPdf('arraybuffer');if(!pdf.byteLength)throw Error('PDF vacío');return {bytes:pdf.byteLength};});
 await run('Extracción PDF sintético sin importación',async()=>{const bytes=await(await fetch('/fixture.pdf')).arrayBuffer(),result=await SVPrivateFinancePDF.extract(bytes);if(!result)throw Error('Extracción vacía');return {extracted:true};});
 await run('Lector de códigos',()=>{const reader=new ZXingBrowser.BrowserMultiFormatReader();if(!reader)throw Error('Lector ausente');return {initialized:true};});
}
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',policy);res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(['/dependencies','/dependencies.js','/fixture.pdf'].includes(url.pathname)||url.pathname.startsWith('/js/'))res.setHeader('Content-Security-Policy',policy.replace("script-src 'self'","script-src 'self' https://cdnjs.cloudflare.com").replace("connect-src 'none'","connect-src 'self'; worker-src 'self' blob:"));
 if(url.pathname==='/dependencies'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(dependencyHtml);}
 if(url.pathname==='/dependencies.js'){res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end('('+checkDependencies.toString()+')();');}
 if(url.pathname==='/fixture.pdf'){res.setHeader('Content-Type','application/pdf');return res.end(require('../test/helpers/private-finance-pdf-fixture.cjs')());}
 if(url.pathname==='/mobile'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><title>Prueba móvil 390</title><iframe title="Notificaciones móvil" src="/" style="display:block;width:390px;height:844px;border:1px solid #334;margin:auto"></iframe>');}
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
 if(['/setup.js','/ready.js'].includes(url.pathname)){res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end('('+(url.pathname==='/setup.js'?fixtureSetup:fixtureReady).toString()+')();');}
 if(files.has(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8');return res.end(fs.readFileSync(path.join(root,files.get(url.pathname))));}
 res.writeHead(404);res.end();
}).listen(port,'127.0.0.1',()=>console.log('Prueba aislada: http://127.0.0.1:'+port+'/ (móvil: /mobile)'));
