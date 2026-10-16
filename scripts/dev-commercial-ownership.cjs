'use strict';
// Solo fixture en memoria. No carga Firebase Admin ni credenciales.
const http=require('http'),fs=require('fs'),path=require('path'),{fixture}=require('../test/helpers/commercial-ownership-fixtures.cjs');
const {api,db}=fixture(),root=path.resolve(__dirname,'..');
db.root.sisventas.presupuestos.budget.id='PP-DEMO';
db.root.sisventas.presupuestos.budget.audit.push({fecha:'14/10/2026 08:44',usuario:'Operador de prueba',accion:'Cliente considerado visto y aceptado al convertir a venta'});
const app=fs.readFileSync(path.join(root,'js/app.v3.11.13.js'),'utf8');
const fragments=app.slice(app.indexOf('function montarCreadorComercial('),app.indexOf('function renderVentasTabla('));
const json=(r,status,v)=>{r.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});r.end(JSON.stringify(v));};
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1');try{
 const route=u.pathname.match(/^\/comerciales\/(ventas|presupuestos)(?:\/(opciones|reasignar|preparar))?$/);
 if(route){const actor=await api.authorize(req,route[1],u.searchParams.get('verComo'));let result;
  if(req.method==='GET')result=route[2]==='opciones'?await api.options(actor):await api.list(actor);
  else{let text='';for await(const chunk of req){text+=chunk;if(text.length>16000)throw Error('Tamaño inválido');}const data=JSON.parse(text);result=route[2]==='reasignar'?await api.assign(actor,data):await api.prepare(actor,data);}
  json(res,200,{ok:true,...result});return;
 }
 if(u.pathname==='/fixture-functions.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(fragments);return;}
 const file=u.pathname==='/'?'test/fixtures/commercial-ownership.html':u.pathname.slice(1);
 if(!/^(test\/fixtures\/commercial-ownership\.html|js\/(core\/commercial-ownership|modules\/commercial-document-controls)\.js|css\/(?:app|v3-preview)\.css)$/.test(file)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(root,file)));
 }catch(e){json(res,e.statusCode||500,{ok:false,mensaje:e.message});}}).listen(8764,'127.0.0.1',()=>console.log('Ventas/presupuestos ficticios: http://127.0.0.1:8764/'));
