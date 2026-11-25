'use strict';
// Full local frontend, authenticated real-data command. Never deploys rules,
// changes remote configuration, or removes an order on startup.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const bridge=`(()=>{'use strict';const original=window.fetch.bind(window),prefix='/__purchase_delete_local';
window.fetch=async function(input,init){const url=new URL(typeof input==='string'?input:input.url,location.href),base=window.SISVENTAS_FUNCTIONS?.cotizadorProveedor;if(!base||url.origin!==new URL(base).origin)return original(input,init);
if(url.pathname==='/laboral/capacidades'){const response=await original(input,init);if(!response.ok)return response;const data=await response.json(),local=await original(prefix+'/capability',init);const capability=await local.json();if(!local.ok)throw Error(capability.mensaje||'No se pudo comprobar el borrado local.');data.orderDelete={enabled:capability.enabled===true,version:1};return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});}
if(url.pathname==='/compras/ordenes/eliminar')return original(prefix+'/delete',init);
return original(input,init);};
document.addEventListener('DOMContentLoaded',()=>{const banner=document.createElement('div');banner.id='purchase-delete-local-status';banner.setAttribute('role','status');banner.textContent='LOCAL · BASE REAL · Borrado de compra pendiente de verificación';banner.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:2147482000;padding:5px 12px;background:#49370b;color:#fff1bd;text-align:center;font-size:12px;pointer-events:none';document.body.append(banner);});})();`;
function hash(value){return require('../cotizador/labor-guard').digest(JSON.parse(value));}
async function start({store,guard,review,authorize,expectedRulesHash,readRules,port=0}){
 if(!/^[a-f0-9]{64}$/.test(expectedRulesHash||'')||typeof readRules!=='function')throw Error('Falta fijar la candidata exacta de reglas.');
 const command=require('../cotizador/purchase-order-delete').createPurchaseOrderDelete({store,guard,review,authorize,enabled:true});
 const allowed=new Set(require('./deploy-secure-hosting.cjs').files()),types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
 async function ready(){return hash(await readRules())===expectedRulesHash&&await command.capability();}
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1'),name=decodeURIComponent(url.pathname).slice(1)||'index.html';res.setHeader('Cache-Control','no-store');
  if(name==='__purchase_delete_local/bridge.js'&&req.method==='GET'){res.setHeader('Content-Type','text/javascript;charset=utf-8');return res.end(bridge);}
  if(name.startsWith('__purchase_delete_local/')){
   if(req.method!=='POST'||url.search)throw Object.assign(Error('Método no permitido.'),{statusCode:405});
   const origin=req.headers.origin;if(origin&&origin!=='http://127.0.0.1:'+server.address().port)throw Object.assign(Error('Origen local inválido.'),{statusCode:403});
   await authorize(req);let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16384)throw Object.assign(Error('Solicitud demasiado grande.'),{statusCode:413});}const input=JSON.parse(body||'{}');
   let result;if(name==='__purchase_delete_local/capability')result={ok:true,enabled:await ready(),version:1};
   else if(name==='__purchase_delete_local/delete'){
    if(!await ready())throw Object.assign(Error('El borrado local todavía no tiene verificadas las reglas compartidas. No se modificó la compra.'),{statusCode:503});
    result=await command.handle({method:'POST',url:'/compras/ordenes/eliminar',headers:req.headers},input);
   }else throw Object.assign(Error('Ruta no disponible.'),{statusCode:404});
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
  }
  if(!['GET','HEAD'].includes(req.method)||!allowed.has(name))return res.writeHead(404).end();
  res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');
  if(req.method==='HEAD')return res.end();
  if(name==='index.html')return res.end(fs.readFileSync(path.join(root,name),'utf8').replace('<head>','<head><script src="/__purchase_delete_local/bridge.js"></script>'));
  fs.createReadStream(path.join(root,name)).pipe(res);
 }catch(error){res.writeHead(error.statusCode||503,{'Content-Type':'application/json'}).end(JSON.stringify({ok:false,mensaje:error.message,code:error.code}));}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {server,url:'http://127.0.0.1:'+server.address().port,ready,close:()=>new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();})};
}
module.exports={start};
