'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDistributorDocuments}=require('../cotizador/distributor-documents');
const {createBusinessAuth}=require('../cotizador/user-access');
const {memoryDB}=require('./helpers/private-finance-fixtures.cjs');
const flush=()=>new Promise(setImmediate);
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(size=300){
 const catalog={},products={};for(let n=0;n<size;n++){const id='p'+n;catalog[id]={nombre:'Producto ficticio '+n,precioUSD:70.23,imagenUrl:'https://example.invalid/publica.png',marca:'Marca pública',descripcion:'Descripción pública'};products[id]={codigo:'FICTICIO-'+n,categoria:'COMPRAS PARAGUAY',garantiaConfig:{estado:'no'},costoPrivado:123.456,notasPrivadas:'x'.repeat(500)};}
 const db=memoryDB({sv_chat_roles:{admin:{rol:'admin',activo:true},dist:{rol:'distribuidora',activo:true}},sv_chat_directorio:{admin:{nombre:'Cuenta ficticia'},dist:{nombre:'Distribuidora ficticia'}},sv_distribuidora_permisos:{comprobantes:true},sv_catalogo_publico:catalog,sisventas:{productos:products,config:{tipoCambio:{dolarConversion:'oficial',oficial:1500},empresa:{nombre:'Empresa ficticia',dir:'Domicilio original'}}}});
 const reads=[],transactions=[],pending=[],failures=new Set(),checks=[];let active=0,maxActive=0,hold=false,revoked=false;
 const ref=db.ref.bind(db);db.ref=path=>{const r=ref(path);return {...r,get:async()=>{const record={path,bytes:0};reads.push(record);active++;maxActive=Math.max(maxActive,active);try{if(hold&&path!=='sv_distribuidora_comprobantes/admin/doc')await new Promise((resolve,reject)=>pending.push({path,resolve,reject}));if(failures.has(path))throw Error('Fallo ficticio de lectura');const snap=await r.get();record.bytes=Buffer.byteLength(JSON.stringify(snap.val()));return snap;}finally{active--;}} ,transaction:async fn=>{transactions.push(path);return r.transaction(fn);}};};
 const auth=createBusinessAuth({verifyIdToken:async(uid,checkRevoked)=>{checks.push(checkRevoked);if(revoked)throw Error('Revocada');return {uid};}},db);
 const api=createDistributorDocuments({db,auth,enabled:true,now:()=>123456});
 return {db,api,reads,transactions,pending,failures,checks,authorize:(uid='admin')=>api.authorize({headers:{authorization:'Bearer '+uid}}),clear(){reads.length=0;transactions.length=0;maxActive=0;},set hold(value){hold=value;},set revoked(value){revoked=value;},get maxActive(){return maxActive;},release(){for(const p of pending.splice(0))p.resolve();}};
}
function payload(ids=['p0'],extra={}){return {id:'doc',type:'remito',currency:'USD',client:{name:'Cliente ficticio'},items:ids.map(id=>({id,qty:2,price:70.23})),notes:'',...extra};}
function domainPaths(f){return f.reads.map(r=>r.path);}

test('emisión de 2 seleccionados no lee raíces y reduce los bytes del catálogo ficticio',async t=>{
 const f=fixture(),actor=await f.authorize();f.clear();const original=clone(f.db.root.sisventas),result=await f.api.issue(actor,payload(['p2','p0']));
 const bytes=f.reads.reduce((n,r)=>n+r.bytes,0),fullBytes=Buffer.byteLength(JSON.stringify(f.db.root.sv_catalogo_publico))+Buffer.byteLength(JSON.stringify(f.db.root.sisventas.productos));
 t.diagnostic('Fixture: GET='+f.reads.length+', bytesJSON='+bytes+', raícesJSON='+fullBytes);
 assert.deepEqual(domainPaths(f).sort(),['sv_distribuidora_comprobantes/admin/doc','sisventas/config/tipoCambio','sisventas/config/empresa','sv_catalogo_publico/p2','sisventas/productos/p2','sv_catalogo_publico/p0','sisventas/productos/p0'].sort());
 assert.ok(bytes<fullBytes/10);assert.deepEqual(f.db.root.sisventas,original);assert.deepEqual(result.document.items.map(i=>i.id),['p2','p0']);assert.equal(result.document.total,280.92);
 assert.equal(result.document.items[0].catalogPriceUSD,70.23);assert.equal(result.document.items[0].costoPrivado,undefined);
});

test('el mismo precio, metadatos y garantía proyectados por opciones se conservan al emitir',async()=>{
 const f=fixture(),actor=await f.authorize();f.db.root.sisventas.productos.p0.garantiaConfig={estado:'si',meses:12,inicio:'instalacion',serie:true};const option=(await f.api.options()).products.find(p=>p.id==='p0');f.clear();
 const document=(await f.api.issue(actor,payload(['p0'],{warrantyReport:true,items:[{id:'p0',qty:2,price:option.usd,warranty:option.warranty,serials:['FICTICIA-1','FICTICIA-2']}]}))).document;
 const item=document.items[0];assert.equal(item.name,option.name);assert.equal(item.code,option.code);assert.equal(item.unitPrice,option.usd);assert.equal(item.catalogPriceUSD,option.usd);assert.deepEqual(item.warranty,option.warranty);assert.deepEqual(item.serials,['FICTICIA-1','FICTICIA-2']);assert.equal(document.rate,1500);assert.equal(document.company.dir,'Domicilio original');assert.equal(item.notasPrivadas,undefined);
});

test('moneda USD canónica y conversión ARS mantienen centavos y configuración fresca por emisión',async()=>{
 const f=fixture(),actor=await f.authorize();const first=(await f.api.issue(actor,payload())).document;assert.equal(first.items[0].unitPrice,70.23);assert.equal(first.total,140.46);
 f.db.root.sisventas.config.tipoCambio={dolarConversion:'mep',mep:1567.89,oficial:1500};f.db.root.sisventas.config.empresa.nombre='Empresa actual';f.clear();
 const price=Math.round((70.23*1567.89+Number.EPSILON)*100)/100;
 const second=(await f.api.issue(actor,payload(['p0'],{id:'nuevo',type:'recibo',method:'transferencia',currency:'ARS',items:[{id:'p0',qty:2,price}]}))).document;
 assert.equal(second.items[0].unitPrice,price);assert.equal(second.items[0].catalogPriceUSD,70.23);assert.equal(second.total,Math.round((price*2+Number.EPSILON)*100)/100);assert.equal(second.rate,1567.89);assert.equal(second.company.nombre,'Empresa actual');assert.ok(domainPaths(f).includes('sisventas/config/tipoCambio'));
});

test('faltantes, inactivos, ocultos, categoría ajena y precios no canónicos no reservan número',async()=>{
 const scenarios=[f=>{delete f.db.root.sv_catalogo_publico.p0;},f=>{delete f.db.root.sisventas.productos.p0;},f=>{f.db.root.sisventas.productos.p0.activo=false;},f=>{f.db.root.sisventas.productos.p0.estado='Inactivo';},f=>{f.db.root.sisventas.productos.p0.catalogoVisible=false;},f=>{f.db.root.sisventas.productos.p0.esManoDeObra=true;},f=>{f.db.root.sisventas.productos.p0.categoria='OTRA';},f=>{f.db.root.sv_catalogo_publico.p0.precioUSD='70.23';},f=>{f.db.root.sv_catalogo_publico.p0.precioUSD=0;}];
 for(const change of scenarios){const f=fixture(2),actor=await f.authorize();change(f);f.clear();await assert.rejects(f.api.issue(actor,payload()),e=>e.statusCode===409);assert.equal(f.transactions.length,0);assert.equal(f.db.root.sv_distribuidora_comprobantes,undefined);}
 const f=fixture(2),actor=await f.authorize();f.db.root.sisventas.config.tipoCambio={};await assert.rejects(f.api.issue(actor,payload(['p0'],{currency:'ARS'})),e=>e.statusCode===409);assert.equal(f.transactions.length,0);
});

test('rechaza cambio de precio, garantía y series inválidas antes de cualquier transacción',async()=>{
 const f=fixture(2),actor=await f.authorize();await assert.rejects(f.api.issue(actor,payload(['p0'],{items:[{id:'p0',qty:1,price:70}]})),e=>e.statusCode===409);
 f.db.root.sisventas.productos.p0.garantiaConfig={estado:'si',meses:12,inicio:'entrega',serie:true};
 for(const [warranty,serials]of [[{state:'si',months:24,start:'entrega',serialRequired:true},['A','B']],[{state:'si',months:12,start:'entrega',serialRequired:true},['A','A']],[{state:'si',months:12,start:'entrega',serialRequired:true},['A','']]])await assert.rejects(f.api.issue(actor,payload(['p0'],{warrantyReport:true,items:[{id:'p0',qty:2,price:70.23,warranty,serials}]})));
 assert.equal(f.transactions.length,0);
});

test('confirmado repetido se devuelve antes del precio y nunca actualiza el histórico',async()=>{
 const f=fixture(2),actor=await f.authorize(),body=payload();const first=await f.api.issue(actor,body),before=clone(f.db.root.sv_distribuidora_comprobantes);
 delete f.db.root.sv_catalogo_publico;delete f.db.root.sisventas.productos;f.db.root.sisventas.config.empresa.nombre='Cambio posterior';f.db.root.sisventas.config.tipoCambio.oficial=9999;f.clear();
 assert.deepEqual(await f.api.issue(actor,body),first);assert.deepEqual(domainPaths(f),['sv_distribuidora_comprobantes/admin/doc']);assert.equal(f.transactions.length,0);assert.deepEqual(f.db.root.sv_distribuidora_comprobantes,before);
 await assert.rejects(f.api.issue(actor,{...body,notes:'Cambio'}),e=>e.statusCode===409);assert.equal(f.transactions.length,0);
});

test('hasta 50 IDs se leen con máximo 6 GET en vuelo y conservan el orden de selección',async()=>{
 const f=fixture(55),actor=await f.authorize(),ids=Array.from({length:50},(_,n)=>'p'+n);f.clear();f.hold=true;let done=false;
 const running=f.api.issue(actor,payload(ids)).finally(()=>{done=true;});await flush();assert.equal(f.pending.length,6);assert.equal(f.maxActive,6);
 while(!done){f.release();await flush();}const result=await running;assert.ok(f.maxActive<=6);assert.equal(f.reads.length,103);assert.deepEqual(result.document.items.map(i=>i.id),ids);
});

test('un fallo de lectura detiene el trabajo nuevo, espera los envíos en vuelo y no persiste',async()=>{
 const f=fixture(55),actor=await f.authorize(),ids=Array.from({length:50},(_,n)=>'p'+n);f.clear();f.hold=true;
 const running=f.api.issue(actor,payload(ids));const rejected=assert.rejects(running,/Fallo ficticio/);await flush();assert.equal(f.pending.length,6);
 f.failures.add(f.pending[0].path);f.pending.shift().resolve();await flush();const afterFailure=f.reads.length;assert.equal(afterFailure,7);f.release();await rejected;await flush();
 assert.equal(f.reads.length,afterFailure);assert.equal(f.transactions.length,0);assert.equal(f.db.root.sv_distribuidora_comprobantes,undefined);
});

test('fronteras de 1/50 productos e IDs inválidos no generan rutas ajenas',async()=>{
 const f=fixture(55),actor=await f.authorize();for(const body of [payload([]),payload(Array.from({length:51},(_,n)=>'p'+n)),payload(['p0','p0']),payload(['../otro']),payload(['constructor'])]){f.clear();await assert.rejects(f.api.issue(actor,body),e=>e.statusCode===400);assert.equal(f.reads.length,0);assert.equal(f.transactions.length,0);}
 f.clear();await f.api.issue(actor,payload());assert.equal(f.reads.length,5);assert.equal(f.reads.filter(r=>r.path.startsWith('sv_catalogo_publico/')).length,1);
});

test('cada petición vuelve a comprobar revocación, bloqueo de acceso, rol y permiso antes de datos',async()=>{
 for(const scenario of ['revocado','inactivo','permiso','reset']){
  const f=fixture(2);await f.authorize('dist');if(scenario==='revocado')f.revoked=true;if(scenario==='inactivo')f.db.root.sv_chat_roles.dist.activo=false;if(scenario==='permiso')f.db.root.sv_distribuidora_permisos.comprobantes=false;if(scenario==='reset')f.db.root.sv_access_resets={dist:{required:true}};f.clear();
  await assert.rejects(async()=>f.api.issue(await f.authorize('dist'),payload()));assert.equal(f.transactions.length,0);assert.ok(f.checks.every(Boolean));assert.ok(!domainPaths(f).some(path=>path.startsWith('sisventas/')||path.startsWith('sv_catalogo_publico')||path.startsWith('sv_distribuidora_comprobantes/')));
 }
});

test('dos emisiones concurrentes del mismo ID conservan un documento y sus snapshots',async()=>{
 const f=fixture(4),actor=await f.authorize();f.clear();const body=payload(['p0','p1']),results=await Promise.all([f.api.issue(actor,body),f.api.issue(actor,body)]);
 assert.deepEqual(results[0],results[1]);assert.equal(Object.keys(f.db.root.sv_distribuidora_comprobantes.admin).length,1);assert.equal(results[0].document.items[0].unitPrice,70.23);
 assert.ok(!domainPaths(f).includes('sisventas/productos'));assert.ok(!domainPaths(f).includes('sv_catalogo_publico'));
});
