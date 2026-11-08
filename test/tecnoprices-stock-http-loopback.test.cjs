'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http'),crypto=require('node:crypto');
const overlay=path.resolve(__dirname,'../cotizador/tecnoprices-stock-overlay'),Patch=require(path.join(overlay,'attach.cjs')),helper=require(path.join(overlay,'tecnoprices-login.js'));
const reference=process.env.SV_STOCK_ENTRYPOINT_FILE,retained=process.env.SV_STOCK_RUNTIME_SOURCE;
test('exact composed scraper and preserved Presentation handler over own HTTP loopback; provider API is fictitious',{skip:!reference||!retained,timeout:10000},async()=>{
 const original=fs.readFileSync(reference,'utf8'),source=Patch.apply(original);assert.equal(Patch.sha(source),'4184b4c820517f2730bbae8a34e202678c231b6d54776dc7512a324c7a7f5758');assert.equal(Patch.revert(source),original);Patch.verifyHelper(fs.readFileSync(path.join(overlay,'tecnoprices-login.js')));
 const handler=source.split('\n').find(line=>line.includes("if(pathname==='/presupuestos/presentacion-proyecto'"));assert.equal(handler,original.split('\n').find(line=>line.includes("if(pathname==='/presupuestos/presentacion-proyecto'")));
 const API=require(path.join(path.resolve(retained),'budget-presentation-trial.js'));
 const presentation=API.create({model:{},auth:{verifyIdToken:async()=>{throw Error('fictional revoked token');}},db:{ref(){assert.fail('Unauthenticated Presentation must not read data');}}});
 const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 const readBody=async req=>{let bytes='';for await(const part of req)bytes+=part;return JSON.parse(bytes||'{}');};
 const route=vm.runInNewContext('(async function(req,res,pathname){'+handler+' return false;})',{budgetPresentationTrial:presentation,readBody,send});
 let posts=0,prices=0,contextsClosed=0;
 async function quote(failed){
  const sessions=new Map();let current='https://www.tecnoprices.com/ingresar';
  const page={url:()=>current,route:async()=>{},locator:name=>name==='form'?{evaluateAll:async()=>[{csrf:'fixture-only'}]}:{innerText:async()=> 'Fictitious product $1234'},context:()=>context,goto:async url=>{assert.equal(new URL(url).origin,'https://www.tecnoprices.com');current=url;},evaluate:async()=>({login:false,logout:true}),waitForLoadState:async()=>{},waitForTimeout:async()=>{}};
  const context={newPage:async()=>page,close:async()=>{contextsClosed++;},storageState:async()=>({cookies:[],origins:[]}),request:{post:async(url,options)=>{posts++;assert.equal(url,'https://www.tecnoprices.com/control.php');assert.equal(options.maxRedirects,0);return{status:()=>failed?401:200,headers:()=>({}),dispose:async()=>{}};}}};
  const scope={require:id=>{assert.equal(id,'./tecnoprices-login');return helper;},crypto,sesionesProveedorManual:sessions,SESION_PROVEEDOR_TTL_MS:900000,claveSesionProveedorManual:()=> 'fixture-only',normalizarUrl:v=>v,adquirirNavegador:async()=>({newContext:async()=>context,close:async()=>{}}),extraerPrecioPaginaProveedor:async()=>{prices++;return{precioArs:1234};},extraerDisponibilidadPaginaProveedor:async()=> 'disponible',extraerCondicionIva:()=>({}),tituloVisibleProducto:async()=> 'Ficticio',identidadAlta:()=>({ok:true}),validarIdentidadProducto:()=>({ok:true}),Date,Map,URL};
  const scraper=source.slice(source.indexOf('function firmaCredencialesProveedor('),source.indexOf('\nasync function cotizarBiosegur('));vm.runInNewContext(scraper,scope);
  return scope.cotizarProveedorConLogin({proveedor:{usuario:'fixture-only',password:'not-a-secret'},proveedorKey:'fixture-only',producto:'Ficticio',url:'https://www.tecnoprices.com/producto-exacto',tipo:'tecnoprices'});
 }
 const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/presupuestos/presentacion-proyecto'){await route(req,res,url.pathname);return;}if(url.pathname==='/fixture/cotizar'){if(req.headers.authorization!=='Bearer fixture-only'){send(res,401,{ok:false});return;}try{send(res,200,await quote(url.searchParams.get('failed')==='1'));}catch(error){send(res,503,{ok:false,code:error.code,mensaje:error.message});}return;}send(res,404,{ok:false});}catch{send(res,500,{ok:false});}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  const request=(endpoint,headers={},body={})=>fetch(origin+endpoint,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const body={budgetKey:'fiction-only',exchangeRate:1,exchangeLabel:'fixture',includeImages:false};
  for(const headers of [{},{authorization:'Bearer fictional-revoked'}]){const result=await request('/presupuestos/presentacion-proyecto',headers,body);assert.equal(result.status,401);assert.equal((await result.json()).ok,false);}
  const denied=await request('/fixture/cotizar');assert.equal(denied.status,401);await denied.body.cancel();assert.equal(posts,0);
  const valid=await request('/fixture/cotizar',{authorization:'Bearer fixture-only'});assert.equal(valid.status,200);assert.equal((await valid.json()).precioArs,1234);
  const failed=await request('/fixture/cotizar?failed=1',{authorization:'Bearer fixture-only'});assert.equal(failed.status,503);const error=await failed.json();assert.equal(error.code,'TECNOPRICES_LOOKUP_FAILED');assert(!/not-a-secret|Call log|Timeout/.test(error.mensaje));assert.equal(posts,2);assert.equal(prices,1);assert.equal(contextsClosed,2);
 }finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
