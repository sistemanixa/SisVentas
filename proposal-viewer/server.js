'use strict';
// Standalone capability viewer. No Firebase SDK, commercial writes, operating-
// system access, service worker or generic checkout server belongs here.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const BUSINESS_ORIGIN='https://ventas.sistemanixa.com';
const OFFICIAL_BASE='https://cotizador-171899432710.southamerica-east1.run.app';
const SCENES=Object.freeze(['cerradura-camara','cerradura-teclado','portero-pantalla','portero-teclado','videovigilancia','portero-columna']);
const STATIC_FILES=Object.freeze(['propuestas-compartidas.html','css/proposal-share.css','css/proposal-deck.css','assets/proposal-scenes/cover-fade.png','js/modules/proposal-share-viewer.js','js/core/proposal-slide.js','nixa-icon-192.png',...SCENES.flatMap(name=>['assets/proposal-scenes/'+name+'.jpg','assets/proposal-scenes/'+name+'-thumb.jpg'])]);
const STATIC=new Set(STATIC_FILES),MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png'};
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
function bearer(identity){const value=identity?.authorization;if(typeof value!=='string'||value.length>16384||!/^Bearer [A-Za-z0-9._~-]+$/.test(value))throw fail(401,'Volvé a ingresar para compartir las propuestas.');return value;}
function validatePublicOrigin(value,{allowFixtureHttp=false}={}){
 let url;try{url=new URL(value);}catch{throw Error('PUBLIC_ORIGIN must be the exact HTTPS Cloud Run origin');}
 const localFixture=allowFixtureHttp===true&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname);
 const cloud=url.protocol==='https:'&&url.hostname.endsWith('.run.app')&&url.hostname.length<=253&&url.hostname.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))&&!url.port;
 if(typeof value!=='string'||(!cloud&&!localFixture)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||value!==url.origin)throw Error('PUBLIC_ORIGIN must be the exact HTTPS Cloud Run origin');return url.origin;
}
async function boundedJson(response,limit){
 const size=Number(response.headers?.get?.('content-length'));if(Number.isFinite(size)&&size>limit)throw fail(502,'La respuesta supera el tamaño permitido.');let raw;
 if(response.body&&Symbol.asyncIterator in response.body){let length=0;const parts=[];for await(const chunk of response.body){const bytes=Buffer.from(chunk);length+=bytes.length;if(length>limit)throw fail(502,'La respuesta supera el tamaño permitido.');parts.push(bytes);}raw=Buffer.concat(parts).toString('utf8');}
 else{raw=await response.text();if(Buffer.byteLength(raw)>limit)throw fail(502,'La respuesta supera el tamaño permitido.');}
 try{return JSON.parse(raw);}catch{throw fail(502,'No se pudo consultar la información protegida.');}
}
function createOfficialReaders({fetchImpl=globalThis.fetch}={}){
 if(typeof fetchImpl!=='function')throw Error('Fetch required');
 async function get(identity,suffix,limit=8*1024*1024){const authorization=bearer(identity);let response;try{response=await fetchImpl(OFFICIAL_BASE+suffix,{method:'GET',headers:{Authorization:authorization,Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw fail(503,'No se pudo consultar el servidor. Reintentá.');}
  if(!response.ok)throw fail([401,403,404,409].includes(response.status)?response.status:503,'No se pudo consultar la información protegida.');const value=await boundedJson(response,limit);if(value?.ok===false)throw fail(403,'La consulta no está autorizada.');return value;
 }
 return {
  async authorize(identity,action,details){const value=await get(identity,'/usuarios/perfil',32768),profile=value?.profile;if(!profile||profile.rol!=='admin'||profile.activo!==true||typeof profile.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(profile.uid))throw fail(403,'Sólo Administración puede compartir estas propuestas.');
   if(action==='create'){const key=details?.budgetKeys?.[0];if(typeof key!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(key))throw fail(400,'Presupuesto inválido.');await get(identity,'/comerciales/presupuestos/registro/'+encodeURIComponent(key));}return {uid:profile.uid,role:'admin',allowed:true};
  },
  async readBudget(identity,key){if(typeof key!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(key))throw fail(400,'Presupuesto inválido.');const value=await get(identity,'/comerciales/presupuestos/registro/'+encodeURIComponent(key));if(!value?.record||typeof value.record!=='object'||Array.isArray(value.record))throw fail(404,'El presupuesto no está disponible.');return value.record;}
 };
}
function clientAddress(req,{trustProxy=false}={}){
 // Cloud Run's single proxy is trusted only by the production launcher. Use
 // the closest forwarded IP, never attacker-controlled leftmost additions.
 // Reference: GoogleCloudPlatform/nodejs-docs-samples PR3586 (trust proxy 1).
 const forwarded=req.headers?.['x-forwarded-for'];if(trustProxy&&typeof forwarded==='string'&&forwarded.length<=1024){const parts=forwarded.split(',');if(parts.length<=8){const candidate=parts.at(-1).trim();if(net.isIP(candidate))return candidate.toLowerCase().replace(/^::ffff:/,'');}}
 const remote=req.socket?.remoteAddress;return typeof remote==='string'&&net.isIP(remote)?remote.toLowerCase().replace(/^::ffff:/,''):'unknown';
}
function createRateLimiter({now=Date.now,perAction=100,globalPerMinute=500,maxEntries=4096}={}){
 if(!Number.isInteger(perAction)||perAction<1||perAction>100||!Number.isInteger(globalPerMinute)||globalPerMinute<1||globalPerMinute>10000||!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>4096)throw Error('Bounded rate limits required');
 const entries=new Map();let minute=-1,total=0;
 function allow(action,address){const at=now();if(!Number.isSafeInteger(at)||at<0)return false;const current=Math.max(minute,Math.floor(at/60000));if(current>minute){minute=current;total=0;entries.clear();}if(!['static','create','read','revoke','other'].includes(action))action='other';if(total>=globalPerMinute)return false;total++;
  const key=action+':'+crypto.createHash('sha256').update(String(address).slice(0,128)).digest('hex');let count=entries.get(key)||0;if(!count&&entries.size>=maxEntries)return false;if(count>=perAction)return false;entries.set(key,count+1);return true;
 }
 return Object.freeze({allow,stats:()=>Object.freeze({entries:entries.size,total,minute})});
}
function readBody(req){return new Promise((resolve,reject)=>{let length=0,parts=[],done=false;req.on('data',chunk=>{if(done)return;length+=chunk.length;if(length>16384){done=true;parts=[];reject(fail(413,'La solicitud supera el tamaño permitido.'));return;}parts.push(chunk);});req.on('end',()=>{if(done)return;done=true;try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch{reject(fail(400,'Solicitud inválida.'));}});req.on('error',()=>{if(!done){done=true;reject(fail(400,'Solicitud incompleta.'));}});});}
function createServer({shares,publicOrigin,root=path.resolve(__dirname,'../../public'),allowLocalReview=false,allowFixtureHttp=false,trustProxy=false,rateLimiter=createRateLimiter()}={}){
 if(!shares||!['create','read','revoke'].every(key=>typeof shares[key]==='function'))throw Error('Share service required');publicOrigin=validatePublicOrigin(publicOrigin,{allowFixtureHttp});const own=new URL(publicOrigin),adminOrigins=new Set([BUSINESS_ORIGIN]);if(allowLocalReview===true)for(const origin of ['http://127.0.0.1:8766','http://localhost:8766'])adminOrigins.add(origin);const allowedOrigins=new Set([...adminOrigins,publicOrigin]);let server;
 function headers(res){res.setHeader('Cache-Control','private, no-store');res.setHeader('Pragma','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; worker-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");if(own.protocol==='https:')res.setHeader('Strict-Transport-Security','max-age=31536000');}
 function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
 server=http.createServer(async(req,res)=>{headers(res);try{
  const pathname=new URL(req.url,'http://viewer.invalid').pathname;const action=pathname==='/api/proposal-shares'?'create':pathname==='/api/proposal-shares/read'?'read':pathname==='/api/proposal-shares/revoke'?'revoke':pathname.startsWith('/api/')?'other':'static';if(!rateLimiter.allow(action,clientAddress(req,{trustProxy}))){res.setHeader('Retry-After','60');throw fail(429,'Esperá un minuto antes de volver a intentar.');}
  let host;try{host=new URL('https://'+req.headers.host);}catch{throw fail(403,'Dirección no autorizada.');}const fixtureHost=allowFixtureHttp===true&&['127.0.0.1','localhost'].includes(host.hostname)&&host.port===String(server.address()?.port);if(host.username||host.password||host.pathname!=='/'||host.search||host.hash||(!fixtureHost&&(host.hostname!==own.hostname||host.port)))throw fail(403,'Dirección no autorizada.');
  const requestOrigin=req.headers.origin;if(requestOrigin&&!allowedOrigins.has(requestOrigin))throw fail(403,'Origen no autorizado.');if(requestOrigin){res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');}
  if(pathname.startsWith('/api/')){
   if(action==='other')throw fail(404,'No disponible.');
   if(req.method==='OPTIONS'){if(!requestOrigin||!allowedOrigins.has(requestOrigin)||(action!=='read'&&!adminOrigins.has(requestOrigin)))throw fail(403,'Origen no autorizado.');if(req.headers['access-control-request-method']!=='POST')throw fail(405,'Método no permitido.');const requested=String(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(value=>value.trim()).filter(Boolean);if(requested.some(value=>!['authorization','content-type'].includes(value)))throw fail(403,'Cabeceras no permitidas.');res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.writeHead(204);res.end();return;}
   if(req.method!=='POST')throw fail(405,'Método no permitido.');if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||''))throw fail(415,'Usá JSON para esta solicitud.');if(req.headers['content-encoding'])throw fail(415,'Formato no permitido.');
   if(action!=='read'){if(!adminOrigins.has(requestOrigin)||req.headers['x-sv-view-uid']||req.headers['x-sisventas-view-uid'])throw fail(403,'Origen o contexto no autorizado.');bearer({authorization:req.headers.authorization});}
   const body=await readBody(req);if(action==='create'&&body?.ttlHours!==undefined&&(!Number.isInteger(body.ttlHours)||body.ttlHours<1||body.ttlHours>24))throw fail(400,'El enlace puede durar hasta 24 horas.');if(action==='read'){send(res,200,await shares.read(body));return;}const result=await shares[action]({authorization:req.headers.authorization},body);send(res,200,action==='create'?{...result,viewerBase:publicOrigin+'/propuestas-compartidas.html',viewerOrigin:publicOrigin}:result);return;
  }
  if(!['GET','HEAD'].includes(req.method))throw fail(405,'Método no permitido.');const name=pathname==='/'?'propuestas-compartidas.html':pathname.slice(1);if(!STATIC.has(name))throw fail(404,'No disponible.');let bytes;try{bytes=await fs.promises.readFile(path.join(root,name));}catch{throw fail(404,'No disponible.');}res.writeHead(200,{'Content-Type':MIME[path.extname(name)],'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(error){if(!res.headersSent)send(res,error.statusCode||503,{ok:false,mensaje:error.statusCode?error.message:'No se pudo completar la solicitud.'});else res.end();}});server.requestTimeout=30000;server.headersTimeout=10000;server.maxHeadersCount=30;return server;
}
function createProductionShare({bucketName,storage,fetchImpl=globalThis.fetch}={}){
 if(typeof bucketName!=='string'||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucketName))throw Error('Dedicated PROPOSAL_SHARE_BUCKET required');
 const {createProposalShare}=require('../cotizador/proposal-share-server'),{createGCSShareStore}=require('./share-store');if(!storage){const {Storage}=require('@google-cloud/storage');storage=new Storage();}return createProposalShare({...createOfficialReaders({fetchImpl}),store:createGCSShareStore({bucket:storage.bucket(bucketName)})});
}
function start(env=process.env){const publicOrigin=validatePublicOrigin(env.PUBLIC_ORIGIN),port=env.PORT===undefined?8080:Number(env.PORT);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');const shares=createProductionShare({bucketName:env.PROPOSAL_SHARE_BUCKET});const server=createServer({shares,publicOrigin,allowLocalReview:env.PROPOSAL_SHARE_LOCAL_REVIEW==='true',trustProxy:!!env.K_SERVICE});server.listen(port,'0.0.0.0',()=>console.log('Visor de propuestas iniciado.'));return server;}
if(require.main===module){try{start();}catch{console.error('No se pudo iniciar el visor: revisá su configuración.');process.exitCode=1;}}
module.exports=Object.freeze({BUSINESS_ORIGIN,OFFICIAL_BASE,STATIC_FILES,validatePublicOrigin,createOfficialReaders,clientAddress,createRateLimiter,createServer,createProductionShare,start});
