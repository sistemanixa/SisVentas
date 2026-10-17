'use strict';
// Preview isolated from Firebase, credentials and production. All writes stay in RAM.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {memoryDB}=require('../test/helpers/private-finance-fixtures.cjs');
const {createDistributorDocuments}=require('../cotizador/distributor-documents');
const root=path.resolve(__dirname,'..'),port=Number(process.env.SV_DISTRIBUTOR_PREVIEW_PORT||8763);
const db=memoryDB({sv_chat_roles:{demo:{rol:'admin',activo:true}},sv_chat_directorio:{demo:{nombre:'Administrador de prueba'}},sv_catalogo_publico:{headphone:{nombre:'Auriculares inalámbricos · Ejemplo',precioUSD:85},speaker:{nombre:'Parlante portátil · Ejemplo',precioUSD:120},adapter:{nombre:'Adaptador USB · Ejemplo',precioUSD:12.5}},sisventas:{productos:Object.fromEntries(['headphone','speaker','adapter'].map((id,n)=>[id,{codigo:'DEMO-'+(n+1),categoria:'COMPRAS PARAGUAY',garantiaConfig:id==='adapter'?{estado:'no'}:{estado:'si',meses:12,inicio:'entrega',serie:id==='headphone'}}])),config:{tipoCambio:{oficial:1500},empresa:{nombre:'Distribuidora · Ejemplo',dir:'Dirección configurada · Datos ficticios',tel:'Contacto de prueba'}}}});
const api=createDistributorDocuments({auth:{verifyIdToken:async t=>{if(t!=='demo')throw Error();return {uid:'demo'};}},db,enabled:true});
const json=(r,status,data)=>{r.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});r.end(JSON.stringify(data));};
http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1');try{
 if(url.pathname.startsWith('/api')){const actor=await api.authorize(req);let result;
  if(req.method==='GET'&&url.pathname==='/api/opciones')result=await api.options(actor);
  else if(req.method==='GET'&&url.pathname==='/api')result=await api.list(actor);
  else if(req.method==='POST'&&['/api/emitir','/api/anular'].includes(url.pathname)){let raw='';for await(const c of req){raw+=c;if(raw.length>40000)throw Error('Tamaño inválido');}const body=JSON.parse(raw);result=url.pathname.endsWith('/emitir')?await api.issue(actor,body):await api.cancel(actor,body);}
  else return json(res,405,{ok:false,mensaje:'Método no permitido'});return json(res,200,{ok:true,...result});
 }
 const file=url.pathname==='/'?'test/fixtures/distributor-documents.html':url.pathname==='/mobile'?'test/fixtures/distributor-documents-mobile.html':url.pathname.slice(1);
 if(!['test/fixtures/distributor-documents.html','test/fixtures/distributor-documents-mobile.html','test/fixtures/serial-camera.html','test/fixtures/serial-code128.js','js/modules/distributor-documents.js','js/modules/serial-camera-scanner.js','js/vendor/zxing/zxing-browser-0.1.5.min.js','css/app.css','css/v3-preview.css'].includes(file)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(root,file)));
 }catch(e){json(res,e.statusCode||500,{ok:false,mensaje:e.message});}}).listen(port,'127.0.0.1',()=>console.log('Comprobantes ficticios, solo memoria: http://127.0.0.1:'+port+'/'));
