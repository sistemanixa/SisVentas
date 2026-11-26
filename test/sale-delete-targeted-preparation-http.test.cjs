'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),{createRequire}=require('node:module');
const {create}=require('./helpers/sale-delete-native-http-lab.cjs');
const sourceRoot=path.resolve(process.env.SV_SALE_DELETE_TARGET_SOURCE_ROOT||path.join(__dirname,'..')),at=createRequire(path.join(sourceRoot,'cotizador/index.js'));
async function lab(){
 const f=await create({sourceRoot,mode:'targeted'});f.set('sv_sale_delete_relations',null);f.set('sv_permisos/admin/indiceModulos/configuracion',true);f.set('sv_permisos/admin/acciones/mantenimiento',{migrar:true});
 const Adapter=at('./sale-delete-target-preparation-http'),adapter=Adapter.create({authorize:f.gateway.authorize,guard:f.runtime.guard,store:f.runtime.store,enabled:true});
 const server=http.createServer(async(req,res)=>{try{let raw='';for await(const b of req)raw+=b;const result=await adapter.handle(req,JSON.parse(raw));res.writeHead(result.statusCode,{'Content-Type':'application/json'});res.end(JSON.stringify(result.body));}catch(e){res.writeHead(e.statusCode||503,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,code:e.code||'LAB_FAILURE'}));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+Adapter.PATH;
 return {...f,prepare:async(body={id:'targeted-preparation-operation'})=>{const r=await fetch(url,{method:'POST',headers:{authorization:'Bearer FICTITIOUS_DELETE_LAB','Content-Type':'application/json'},body:JSON.stringify(body)});return{status:r.status,body:await r.json()};},close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await f.close();}};
}
test('real preparation HTTP writes only verified metadata and replays exactly one operation',async()=>{
 const f=await lab();try{const before=f.get('sisventas'),body={id:'targeted-preparation-operation'},r=await f.prepare(body);a.equal(r.status,200,JSON.stringify(r));a.equal(r.body.prepared,true);a.equal(f.commits.length,1);a.deepEqual(f.get('sisventas'),before);
  a(Object.keys(f.commits[0].patch).every(p=>p.startsWith('sv_sale_delete_relations/')||p.startsWith('sv_labor_receipts/')||p==='sv_labor_guard'));const M=at('./sale-delete-target-index');M.validateConfig(f.get(M.CONFIG),f.get(M.ROOT+'/coverage'));for(const p of ['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies'])a.equal(f.get(p),null);
  const replay=await f.prepare(body);a.equal(replay.status,200,JSON.stringify(replay));a.equal(replay.body.operationId,body.id);a.equal(f.commits.length,1);a.deepEqual(f.get('sisventas'),before);
 }finally{await f.close();}
});
test('real preparation HTTP rejects an original changing during its fresh verification',async()=>{
 const f=await lab();try{let reads=0,changed=false;f.control.beforeRead=async p=>{if(p==='sisventas/ventas'&&++reads===2){changed=true;f.set('sisventas/ventas/sale/total',101);}};
  const r=await f.prepare();a.equal(changed,true);a.equal(r.status,409,JSON.stringify(r));a.equal(f.commits.length,0);a.equal(f.get('sisventas/ventas/sale/total'),101);a.equal(f.get('sv_sale_delete_relations'),null);a.equal(f.get('sv_labor_guard'),null);
 }finally{await f.close();}
});
test('real preparation HTTP rejects revoked Auth and same-revision maintenance revocation without publishing metadata',async()=>{
 for(const mode of ['revoked','late-permission']){const f=await lab();try{const before=f.get('sisventas');let reads=0,changed=false;
   if(mode==='revoked')f.control.revoked=true;else f.control.beforeRead=async p=>{if(p==='sv_commission_generation'&&++reads===2){changed=true;f.set('sv_permisos/admin/acciones/mantenimiento/migrar',false);}};
   const r=await f.prepare();if(mode==='late-permission')a.equal(changed,true);a([401,403,409].includes(r.status),JSON.stringify(r));a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas'),before);a.equal(f.get('sv_sale_delete_relations'),null);a.equal(f.get('sv_labor_guard'),null);
  }finally{await f.close();}}
});
