'use strict';
// Prueba aislada: solo loopback y datos ficticios en memoria. No importa
// firebase-admin, no lee credenciales ni puede conectarse a la base real.
const http=require('http'),fs=require('fs'),path=require('path');
const {actor,now,card,statement,seed,run,memoryDB}=require('../test/helpers/private-finance-fixtures.cjs');
const {createPrivateFinance}=require('../cotizador/private-finance');
const root=path.resolve(__dirname,'..'),port=Number(process.env.PRIVATE_FINANCE_TEST_PORT||8765);
let data=seed();data=run(data,'card-save',{...card,id:'card-b',bank:'Banco ficticio B',brand:'Mastercard',color:'#75b4ff'});data=run(data,'statement-save',{...statement,id:'statement-b',card:'card-b',total:250000,usd:0,minimum:25000});data=run(data,'insurance-save',{id:'insurance-a',name:'Seguro de ejemplo',card:'card-a',amount:1250,currency:'ARS',classification:'Por confirmar',decision:'Evaluar'});data=run(data,'installment-save',{id:'quota-a',concept:'Compra ficticia',card:'card-a',amount:5000,currency:'ARS',current:2,total:6,period:'2026-10'});
const db=memoryDB({sv_chat_roles:{[actor.uid]:{activo:true,rol:'admin'},'other-admin':{activo:true,rol:'admin'},tech:{activo:true,rol:'tecnico'}},sv_personal_finance:{[actor.uid]:data}}),files=new Map();
const service=createPrivateFinance({db,auth:{verifyIdToken:async token=>({uid:token})},ownerUid:actor.uid,enabled:true,now:()=>now,documents:{put:async(k,b)=>files.set(k,b),get:async k=>files.get(k)}});
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1');try{
 if(u.pathname==='/statement-import'){
  const delay=Math.min(60000,Math.max(0,Number(process.env.PRIVATE_FINANCE_AI_DELAY_MS)||0));if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  await service.authorize(req);let size=0;const chunks=[];for await(const b of req){size+=b.length;if(size>22*1024*1024)throw Error('Demasiado grande');chunks.push(b);}
  const {payload,normalize}=require('../cloud-functions/asistente/statement-import.cjs');payload(JSON.parse(Buffer.concat(chunks).toString()));
  if(process.env.PRIVATE_FINANCE_AI_RESULT&&process.env.PRIVATE_FINANCE_AI_PDF){
   const crypto=require('node:crypto'),body=JSON.parse(Buffer.concat(chunks).toString()),original=fs.readFileSync(process.env.PRIVATE_FINANCE_AI_PDF);
   if(crypto.createHash('sha256').update(Buffer.from(body.data,'base64')).digest('hex')!==crypto.createHash('sha256').update(original).digest('hex'))throw Error('El PDF no coincide con la lectura privada verificada');
   json(res,200,{ok:true,...JSON.parse(fs.readFileSync(process.env.PRIVATE_FINANCE_AI_RESULT,'utf8'))});return;
  }
  // Doble de IA: solo prueba del recorrido; no es una lectura de proveedor real.
  const field=(value,original)=>({value,original,page:1});
  const data={pages:1,fields:{period:field('2026-09','Periodo 2026-09'),close:field('2026-09-15','Cierre 15/09/2026'),due:field('2026-10-05','Vencimiento 05/10/2026'),total:field('250.00','Saldo actual ARS 250,00'),usd:field('0.00','Saldo actual USD 0,00'),previous:field('0.00','Saldo anterior ARS 0,00'),minimum:field('25.00','Minimo ARS 25,00'),minimumCurrency:field('ARS','Minimo ARS 25,00')},movements:[{date:'2026-09-15',concept:'Compra ficticia',currency:'ARS',amount:'250.00',page:1,kind:'Consumo'}],warnings:['PRUEBA AISLADA: respuesta de IA simulada, sin proveedor ni datos reales.']};
  json(res,200,{ok:true,...normalize({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(data)}]})});return;
 }
 if(u.pathname==='/prototype'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(root,'docs/gastos-personales/prototipo-demo.html')));return;}
 if(u.pathname.startsWith('/privado/finanzas')){
  const a=await service.authorize(req);let result;
  if(req.method==='GET'&&u.pathname==='/privado/finanzas/acceso')result={allowed:true};
  else if(req.method==='GET'&&u.pathname==='/privado/finanzas')result=await service.get(a);
  else if(req.method==='POST'){const chunks=[];let size=0;for await(const b of req){size+=b.length;if(size>22*1024*1024)throw Error('Demasiado grande');chunks.push(b);}const body=JSON.parse(Buffer.concat(chunks).toString());if(u.pathname.endsWith('/guardar'))result=await service.save(a,body);else if(u.pathname.endsWith('/documentos'))result=await service.upload(a,body);else throw Error('Ruta de prueba desconocida');}
  else{const f=await service.download(a,u.pathname.split('/').at(-1));res.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'no-store'});res.end(f.bytes);return;}
  json(res,200,{ok:true,...result});return;
 }
 const route=decodeURIComponent(u.pathname==='/'?'/test/fixtures/private-finance.html':u.pathname);
 if(!/^\/(?:js\/|css\/|personal-finance\.html$|test\/fixtures\/private-finance\.html$)/.test(route)){res.writeHead(404);res.end('No disponible');return;}
 const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch(e){json(res,e.statusCode||500,{ok:false,mensaje:e.statusCode?e.message:'Error de prueba local'});}});
server.listen(port,'127.0.0.1',()=>console.log('Prueba ficticia, sin Firebase: http://127.0.0.1:'+port+'/'));
module.exports={server};
