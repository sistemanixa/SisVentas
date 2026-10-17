'use strict';
// Demostración aislada: código activo de ventanas, sin Firebase ni datos de negocio.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {readActiveApp}=require('../test/helpers/active-app');
const root=path.resolve(__dirname,'..');
function render(){
 const {source}=readActiveApp();
 const common=source.slice(source.indexOf('var _svDialogoCola'),source.indexOf('function initSearchableSelect'));
 const drag=source.slice(source.indexOf('function svModalEscritorioDisponible'),source.indexOf('// Estado común para botones que ejecutan'));
 if(!common||!drag)throw Error('No se encontraron los componentes activos de ventanas');
 return fs.readFileSync(path.join(root,'test/fixtures/interactions.html'),'utf8').replace('__SV_COMMON_SOURCE__',common).replace('__SV_DRAG_SOURCE__',drag);
}
function start(port=8784){
 const allowed=new Set(['css/app.css','css/v3-preview.css','css/surface-scroll.css','css/projects.css']);
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1);
  res.setHeader('Cache-Control','no-store');
  if(!name){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(render());return;}
  if(!allowed.has(name)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type','text/css; charset=utf-8');res.end(fs.readFileSync(path.join(root,name)));
 });
 return server.listen(port,'127.0.0.1',()=>console.log('Auditoría aislada: http://127.0.0.1:'+server.address().port+'/'));
}
if(require.main===module)start(Number(process.env.INTERACTION_AUDIT_PORT)||8784);
module.exports={render,start};
