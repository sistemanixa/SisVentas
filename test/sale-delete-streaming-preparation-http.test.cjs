'use strict';
const test=require('node:test'),a=require('node:assert/strict'),http=require('node:http');
const {create}=require('./helpers/sale-delete-native-http-lab.cjs');
async function lab(input={}){
 const f=await create({mode:'targeted',input});f.set('sv_sale_delete_relations',null);f.set('sv_permisos/admin/indiceModulos/configuracion',true);f.set('sv_permisos/admin/acciones/mantenimiento',{migrar:true});
 const authorize=f.gateway.authorize;
 const Adapter=require('../cotizador/sale-delete-target-preparation-http'),adapter=Adapter.create({authorize,guard:f.runtime.guard,store:f.runtime.store,enabled:true});
 const server=http.createServer(async(req,res)=>{try{let raw='';for await(const b of req)raw+=b;const r=await adapter.handle(req,JSON.parse(raw));res.writeHead(r.statusCode,{'Content-Type':'application/json'});res.end(JSON.stringify(r.body));}catch(e){res.writeHead(e.statusCode||503,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,code:e.code,message:e.message}));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+Adapter.PATH;
 return {...f,prepare:async()=>{const r=await fetch(url,{method:'POST',headers:{authorization:'Bearer FICTITIOUS_DELETE_LAB','Content-Type':'application/json'},body:JSON.stringify({id:'streamed-preparation-operation'})});return {status:r.status,body:await r.json()};},close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await f.close();}};
}
test('streamed preparation handles collection payloads over eight MiB without a full original root GET',async()=>{
 const payload='x'.repeat(4300000),f=await lab({ordenes_trabajo:{a:{id:'OT-A',ventaFbKey:'sale',image:payload},b:{id:'OT-B',ventaFbKey:'other',image:payload}},reclamos:{a:{id:'R-A',ventaKey:'sale',image:payload},b:{id:'R-B',ventaKey:'other',image:payload}}});
 try{const before=f.get('sisventas'),r=await f.prepare();a.equal(r.status,200,JSON.stringify(r));a.equal(f.commits.length,1);a.deepEqual(f.get('sisventas'),before);
  for(const root of ['sisventas/ordenes_trabajo','sisventas/reclamos']){const rootReads=f.calls.filter(c=>c.method==='GET'&&c.path===root);a.equal(rootReads.length,4);a(rootReads.every(c=>c.shallow===true));for(const key of ['a','b'])a.equal(f.calls.filter(c=>c.method==='GET'&&c.path===root+'/'+key).length,2);}
  a(Object.keys(f.commits[0].patch).every(p=>p.startsWith('sv_sale_delete_relations/')||p.startsWith('sv_labor_receipts/')||p==='sv_labor_guard'));
  const count=f.calls.length,replay=await f.prepare();a.equal(replay.status,200,JSON.stringify(replay));a.equal(f.commits.length,1);a(f.calls.slice(count).every(c=>!c.path.startsWith('sisventas/')));a.deepEqual(f.get('sisventas'),before);
 }finally{await f.close();}
});
for(const mode of ['new-key','changed-record'])test('streamed preparation rejects fresh '+mode+' with no partial metadata',async()=>{
 const f=await lab();try{let checks=0,changed=false;f.control.beforeRead=async p=>{if(p==='sisventas/ordenes_trabajo'&&++checks===3){changed=true;if(mode==='new-key')f.set(p+'/late',{id:'OT-LATE'});else f.set(p+'/ot/nota','changed');}};
  const r=await f.prepare();a.equal(changed,true);a.equal(r.status,409,JSON.stringify(r));a.equal(f.commits.length,0);a.equal(f.get('sv_sale_delete_relations'),null);a.equal(f.get('sv_labor_guard'),null);
 }finally{await f.close();}
});
