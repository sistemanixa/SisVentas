'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../cotizador/sale-financial-dependencies-model'),D=require('../cotizador/sale-financial-dependencies-delta'),Provider=require('../cotizador/sale-financial-dependencies-provider');
test('financial originals and derived certificates survive actual RTDB serialization and repeated deltas',{skip:process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9046',timeout:60000},async()=>{
 const namespace='demo-financial-roundtrip-'+process.pid,base='http://127.0.0.1:9046';
 async function rest(method,path,value){const r=await fetch(base+'/'+path+'.json?ns='+namespace,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});assert.equal(r.ok,true,method+' '+path+' '+r.status);return r.json();}
 const read=path=>rest('GET',path),sale={id:'V-ROUNDTRIP',ordenesCompraIds:[],items:[{cod:'P',qty:1}],nested:{empty:{}},nullable:null,sparse:[null,{qty:1},null],numeric:{0:{qty:2}}};
 await rest('PUT','',{sisventas:{ventas:{s:sale}}});
 const saved=await read('sisventas/ventas/s');assert.notEqual(M.digest(sale),M.digest(saved));assert.deepEqual(saved,M.normalizeRtdb(sale));
 const sources={ventas:{s:sale},gastos:{},ctaemp:{},comisiones_generacion:{},sv_commission_generation:{}},prepared=await M.prepare(sources,{generation:'rtdb-roundtrip'});await rest('PATCH','',prepared.patch);
 const provider=Provider.create(),evidence=()=>provider({saleKey:'s',read});assert.deepEqual((await evidence()).dependencies,[]);
 async function check(){const complete={};for(const domain of ['ventas',...M.domains])complete[domain]=await read(domain==='sv_commission_generation'?domain:'sisventas/'+domain);const rebuilt=await M.prepare(complete,{generation:'rtdb-roundtrip'}),coverage=await read(M.ROOT+'/coverage');assert.deepEqual(coverage.sources,rebuilt.coverage.sources);assert.deepEqual(coverage.counts,rebuilt.coverage.counts);assert.equal(coverage.unresolved,rebuilt.coverage.unresolved);}
 async function mutate(path,after){const before=await read(path),patch=await D.delta({changes:[{path,before,after}],read});await rest('PATCH','',{[path]:after,...patch});await check();}
 for(const path of ['sisventas/gastos/unlinked','sisventas/ctaemp/e/unlinked']){
  await mutate(path,{tipo:'bonificacion',monto:7.351,empty:[],nested:{nil:null}});
  const entry=await read(M.ROOT+'/records/'+M.digest(path));assert(!Object.hasOwn(entry,'tokens'));assert(!Object.hasOwn(entry,'targets'));
  await mutate(path,{tipo:'bonificacion',monto:8.351,empty:{}});assert.deepEqual((await evidence()).dependencies,[]);await mutate(path,null);
 }
 await mutate('sisventas/gastos/commission',{tipo:'comision',ventaFbKey:'s',monto:8,empty:[]});assert.equal((await evidence()).dependencies.length,1);
 await mutate('sisventas/gastos/commission',{tipo:'comision',ventaFbKey:'s',monto:9,numeric:{0:{qty:2}},empty:{}});assert.equal((await evidence()).dependencies.length,1);
 await mutate('sisventas/gastos/commission',null);
 await mutate('sisventas/ctaemp/e/unknown',{tipo:'comision',monto:8,empty:[]});await assert.rejects(evidence(),/sin resolver/);
 await mutate('sisventas/ctaemp/e/unknown',{tipo:'comision',monto:9,empty:{}});await assert.rejects(evidence(),/sin resolver/);
 await mutate('sisventas/ctaemp/e/unknown',null);assert.deepEqual((await evidence()).dependencies,[]);
 await mutate('sisventas/ventas/s',{...saved,ordenesCompraIds:[],nullable:null,numeric:{0:{qty:3}}});assert.deepEqual((await evidence()).dependencies,[]);assert.equal((await read(M.ROOT+'/sales/s')).sourceHash,M.digest(await read('sisventas/ventas/s')));
});
