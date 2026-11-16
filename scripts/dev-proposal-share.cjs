'use strict';
// Local presentation bridge: no Firebase credentials, database writes or generic
// file server. Only authenticated official reads and ephemeral sanitized shares.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const OFFICIAL_BASE='https://cotizador-171899432710.southamerica-east1.run.app';
const ROOT=path.resolve(__dirname,'..');
const SCENES=['cerradura-camara','cerradura-teclado','portero-pantalla','portero-teclado','videovigilancia','portero-columna'];
const STATIC=new Set(['propuestas-compartidas.html','css/proposal-share.css','js/modules/proposal-share-viewer.js','nixa-icon-192.png',...SCENES.flatMap(n=>['assets/proposal-scenes/'+n+'.jpg','assets/proposal-scenes/'+n+'-thumb.jpg'])]);
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png'};
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
const clone=v=>structuredClone(v);
function bearer(identity){const value=identity?.authorization;if(typeof value!=='string'||value.length>16384||!/^Bearer [A-Za-z0-9._~-]+$/.test(value))throw fail(401,'Volvé a ingresar para compartir las propuestas.');return value;}
function createMemoryStore({now=Date.now,maxShares=128}={}){
 const records=new Map();
 return {
  async create(hash,record){if(records.has(hash))return false;for(const [k,v]of records)if(v.revokedAt!==null||v.expiresAt<=now())records.delete(k);if(records.size>=maxShares)throw fail(429,'Hay demasiados enlaces activos. Revocá uno antes de crear otro.');records.set(hash,clone(record));return true;},
  async read(hash){return records.has(hash)?clone(records.get(hash)):null;},
  async revoke(hash,{createdBy,at,by}){const record=records.get(hash);if(!record||record.createdBy!==createdBy)return false;if(record.revokedAt===null){record.revokedAt=at;record.revokedBy=by;}return true;}
 };
}
async function boundedJson(response,limit){
 const declared=Number(response.headers?.get?.('content-length'));if(Number.isFinite(declared)&&declared>limit)throw fail(502,'La respuesta supera el tamaño permitido.');
 let raw='';if(response.body&&Symbol.asyncIterator in response.body){let length=0,parts=[];for await(const part of response.body){const b=Buffer.from(part);length+=b.length;if(length>limit){await response.body.cancel?.().catch?.(()=>{});throw fail(502,'La respuesta supera el tamaño permitido.');}parts.push(b);}raw=Buffer.concat(parts).toString('utf8');}
 else{raw=await response.text();if(Buffer.byteLength(raw)>limit)throw fail(502,'La respuesta supera el tamaño permitido.');}
 try{return JSON.parse(raw);}catch{throw fail(502,'No se pudo consultar la información protegida.');}
}
function createOfficialReaders({fetchImpl=globalThis.fetch}={}){
 if(typeof fetchImpl!=='function')throw Error('Fetch required');
 async function get(identity,suffix,limit=8*1024*1024){
  const authorization=bearer(identity);let response;try{response=await fetchImpl(OFFICIAL_BASE+suffix,{method:'GET',headers:{Authorization:authorization,Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw fail(503,'No se pudo consultar el servidor. Reintentá.');}
  if(!response.ok)throw fail([401,403,404,409].includes(response.status)?response.status:503,'No se pudo consultar la información protegida.');
  const value=await boundedJson(response,limit);if(value?.ok===false)throw fail(403,'La consulta no está autorizada.');return value;
 }
 return {
  async authorize(identity,action,details){
   const data=await get(identity,'/usuarios/perfil',32768),p=data?.profile;
   if(!p||p.rol!=='admin'||p.activo!==true||typeof p.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(p.uid))throw fail(403,'Sólo Administración puede compartir estas propuestas.');
   // The profile endpoint verifies identity; the commercial endpoint additionally
   // checks the current budget module permission. No decoded JWT is trusted.
   if(action==='create'){const key=details?.budgetKeys?.[0];if(typeof key!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(key))throw fail(400,'Presupuesto inválido.');await get(identity,'/presupuestos/registro/'+encodeURIComponent(key));}
   return {uid:p.uid,role:'admin',allowed:true};
  },
  async readBudget(identity,key){if(typeof key!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(key))throw fail(400,'Presupuesto inválido.');const result=await get(identity,'/presupuestos/registro/'+encodeURIComponent(key));if(!result?.record||typeof result.record!=='object'||Array.isArray(result.record))throw fail(404,'El presupuesto no está disponible.');return result.record;}
 };
}
function origin(value){let u;try{u=new URL(value);}catch{throw Error('Explicit valid local origin required');}if(u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.protocol!=='http:')throw Error('Local HTTP origin required');const h=u.hostname,parts=h.split('.').map(Number),privateIP=parts.length===4&&parts.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&(parts[0]===10||parts[0]===192&&parts[1]===168||parts[0]===172&&parts[1]>=16&&parts[1]<=31);if(!['127.0.0.1','localhost','[::1]'].includes(h)&&!privateIP)throw Error('Only loopback or explicitly configured private LAN origin');return u.origin;}
function createServer({shares,root=ROOT,frontendOrigin='http://127.0.0.1:8766',publicOrigin='http://127.0.0.1:8874'}={}){
 if(!shares||!['create','read','revoke'].every(k=>typeof shares[k]==='function'))throw Error('Share service required');
 frontendOrigin=origin(frontendOrigin);publicOrigin=origin(publicOrigin);const own=new URL(publicOrigin),allowedNames=new Set(['127.0.0.1','localhost','[::1]',own.hostname]);let server;
 function headers(res){res.setHeader('Cache-Control','no-store');res.setHeader('Pragma','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; worker-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");}
 function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
 function body(req){return new Promise((resolve,reject)=>{let length=0,parts=[],done=false;req.on('data',data=>{if(done)return;length+=data.length;if(length>16384){done=true;parts=[];reject(fail(413,'La solicitud supera el tamaño permitido.'));return;}parts.push(data);});req.on('end',()=>{if(done)return;done=true;try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch{reject(fail(400,'Solicitud inválida.'));}});req.on('error',()=>{if(!done){done=true;reject(fail(400,'Solicitud incompleta.'));}});});}
 server=http.createServer(async(req,res)=>{headers(res);try{
  let host;try{host=new URL('http://'+req.headers.host);}catch{throw fail(403,'Dirección local inválida.');}
  const port=String(server.address()?.port||own.port||80);if(host.username||host.password||host.pathname!=='/'||!allowedNames.has(host.hostname)||String(host.port||80)!==port)throw fail(403,'Dirección local inválida.');
  const requestOrigin=req.headers.origin,allowedOrigin=requestOrigin===frontendOrigin||requestOrigin===publicOrigin;
  if(requestOrigin&&!allowedOrigin)throw fail(403,'Origen no autorizado.');
  if(requestOrigin&&allowedOrigin){res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');}
  const pathname=new URL(req.url,'http://local.invalid').pathname;
  if(pathname.startsWith('/api/')){
   if(!['/api/proposal-shares','/api/proposal-shares/read','/api/proposal-shares/revoke'].includes(pathname))throw fail(404,'No disponible.');
   if(req.method==='OPTIONS'){if(!allowedOrigin)throw fail(403,'Origen no autorizado.');if(req.headers['access-control-request-method']!=='POST')throw fail(405,'Método no permitido.');const requested=String(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);if(requested.some(v=>!['authorization','content-type'].includes(v)))throw fail(403,'Cabeceras no permitidas.');res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.writeHead(204);res.end();return;}
   if(req.method!=='POST')throw fail(405,'Método no permitido.');if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||''))throw fail(415,'Usá JSON para esta solicitud.');
   const value=await body(req),identity={authorization:req.headers.authorization};
   if(pathname==='/api/proposal-shares/read'){send(res,200,await shares.read(value));return;}
   if(!allowedOrigin||req.headers['x-sv-view-uid']||req.headers['x-sisventas-view-uid'])throw fail(403,'Origen o contexto no autorizado.');bearer(identity);
   const result=await shares[pathname.endsWith('/revoke')?'revoke':'create'](identity,value);send(res,200,pathname.endsWith('/revoke')?result:{...result,viewerBase:publicOrigin+'/propuestas-compartidas.html'});return;
  }
  if(!['GET','HEAD'].includes(req.method))throw fail(405,'Método no permitido.');const name=pathname==='/'?'propuestas-compartidas.html':pathname.slice(1);if(!STATIC.has(name))throw fail(404,'No disponible.');let bytes;try{bytes=await fs.promises.readFile(path.join(root,name));}catch{throw fail(404,'No disponible.');}res.writeHead(200,{'Content-Type':MIME[path.extname(name)],'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(error){if(!res.headersSent)send(res,error.statusCode||503,{ok:false,mensaje:error.statusCode?error.message:'No se pudo completar la solicitud.'});else res.end();}});
 server.requestTimeout=30000;server.headersTimeout=10000;server.maxHeadersCount=30;return server;
}
function start({port=8874,host='127.0.0.1',frontendOrigin='http://127.0.0.1:8766',publicOrigin='http://127.0.0.1:8874'}={}){
 if(!['127.0.0.1','localhost','::1'].includes(host))throw Error('LAN binding must be explicitly prepared and approved; loopback only in this launcher');
 const {createProposalShare}=require('../cotizador/proposal-share-server'),readers=createOfficialReaders(),shares=createProposalShare({...readers,store:createMemoryStore()});const server=createServer({shares,frontendOrigin,publicOrigin});server.listen(port,host,()=>console.log('Visor local de propuestas disponible en '+publicOrigin+' (enlaces temporales en memoria).'));return server;
}
if(require.main===module)start();
module.exports={OFFICIAL_BASE,STATIC,createMemoryStore,createOfficialReaders,createServer,start};
