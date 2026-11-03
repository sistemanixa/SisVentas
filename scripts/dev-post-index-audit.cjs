'use strict';
// Loopback-only disposable fixtures. No Firebase initialization or real credentials.
const http=require('node:http');
async function start({port=0}={}){
 const targets=[];let server;
 try{
  for(const [title,module]of [['Ventas y Dashboard','./dev-sales-indexed.cjs'],['Alta y edición de Gastos','../test/fixtures/expense-save-local.cjs'],['Volver a presupuesto','../test/fixtures/sale-return-local.cjs'],['Reportes, Estadísticas y Rentabilidad','../test/fixtures/commercial-reports-local.cjs']])targets.push({title,...await require(module).start()});
  const html='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SisVentas · revisión aislada</title><style>body{background:#0b1424;color:#e7efff;font:16px system-ui;margin:24px}main{max-width:900px;margin:auto}nav{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}a{display:block;padding:22px;border:1px solid #34445e;background:#152137;border-radius:14px;color:#a9caff;text-decoration:none}p{line-height:1.5;color:#bdc9dc}h1{font-size:24px}</style><main><h1>SisVentas · prueba aislada</h1><p>Datos ficticios, sin conexión a producción. Podés recorrer los botones de estos circuitos; los cambios quedan sólo en memoria de esta prueba.</p><nav>'+targets.map(t=>'<a href="'+t.url+'">'+t.title+'</a>').join('')+'</nav><p>Estos recorridos acompañan las pruebas de reglas y cálculos. No reemplazan una sesión completa con todos los módulos.</p></main></html>';
  server=http.createServer((req,res)=>{if(req.method!=='GET'||req.url!=='/'){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(html);});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return{url:'http://127.0.0.1:'+server.address().port,server,targets,async close(){await Promise.all(targets.map(t=>new Promise(resolve=>t.server.close(resolve))));await new Promise(resolve=>server.close(resolve));}};
 }catch(error){for(const t of targets)t.server.close();server?.close();throw error;}
}
if(require.main===module)start({port:Number(process.argv[2])||8918}).then(local=>{console.log(JSON.stringify({url:local.url,fixtures:local.targets.map(t=>({title:t.title,url:t.url})),production:false}));process.once('SIGINT',()=>void local.close());}).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={start};
