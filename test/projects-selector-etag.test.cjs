'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),{createProjects}=require(path.join(repo,'cotizador/projects.js')),{createCommercialCollectionReader}=require(path.join(repo,'cotizador/commercial-collection-reader.js')),{memoryDB}=require(path.join(repo,'test/helpers/private-finance-fixtures.cjs'));
const previous=process.env.COMMERCIAL_OWNERSHIP_ENABLED;before(()=>{process.env.COMMERCIAL_OWNERSHIP_ENABLED='true';});after(()=>{if(previous===undefined)delete process.env.COMMERCIAL_OWNERSHIP_ENABLED;else process.env.COMMERCIAL_OWNERSHIP_ENABLED=previous;});
const copy=value=>JSON.parse(JSON.stringify(value)),deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture(){
 const db=memoryDB({sv_chat_roles:{u:{rol:'vendedor',activo:true},other:{rol:'vendedor',activo:true},admin:{rol:'admin',activo:true}},sv_usuarios:{u:{uid:'u',rol:'vendedor',nombre:'Usuario ficticio'},other:{uid:'other',rol:'vendedor',nombre:'Otra persona'},admin:{uid:'admin',rol:'admin',nombre:'Admin ficticio'}},sv_chat_directorio:{u:{nombre:'Usuario ficticio'},other:{nombre:'Otra persona'},admin:{nombre:'Admin ficticio'}},sv_permisos:{vendedor:{indiceVersion:2,indiceRevision:1,indiceModulos:{proyectos:true,presupuesto:true,clientes:true},bloqueados:[]}},sv_proyectos:{project:{id:'project',name:'Proyecto ficticio',owner:'u',members:{u:{access:'owner'},admin:{access:'editor'}},budgets:[],revision:1}},sisventas:{clientes:{c:{nombre:'Cliente ficticio'}},presupuestos:{own:{id:'PP-PROPIO',responsableUid:'u',clienteFbKey:'c',total:75.25,moneda:'ARS',estado:'borrador',tituloSolucion:'Propuesta ficticia',compra:3.33,archivo:'DOCUMENTO-FICTICIO',items:[{desc:'Producto ficticio',qty:2,punit:37.625,compra:1.11}]},legacy:{id:'PP-LEGACY',creadoPor:'Usuario ficticio',total:22.34},foreign:{id:'PP-AJENO',responsableUid:'other',total:900},deleted:{id:'PP-ELIMINADO',responsableUid:'u',eliminado:true,total:200}}}});
 const reads=[],calls=[],native=db.ref.bind(db);let mode,hold;
 db.ref=p=>{const ref=native(p);return {...ref,async get(){reads.push(p);return ref.get();},transaction(){assert.fail('Readonly selector must not transact');},on(){assert.fail('Readonly selector must not subscribe');}};};
 const reader=createCommercialCollectionReader({databaseURL:'http://127.0.0.1:9999',accessToken:async()=>'fixture-oauth',fetchImpl:async(url,init)=>{
  const destination=new URL(url);assert.equal(destination.origin,'http://127.0.0.1:9999');assert.equal(destination.pathname,'/sisventas/presupuestos.json');assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer fixture-oauth');assert.equal(init.headers['X-Firebase-ETag'],'true');
  const text=JSON.stringify(db.root.sisventas.presupuestos),etag='"'+crypto.createHash('sha256').update(text).digest('hex')+'"',unchanged=init.headers['If-None-Match']===etag,call={etag,validator:init.headers['If-None-Match'],status:unchanged?304:200};calls.push(call);
  if(mode==='network')throw Error('Falla de red ficticia');if(mode==='denied')return new Response('DENEGADO',{status:403});if(mode==='malformed')return new Response('{',{status:200,headers:{etag}});
  if(unchanged){if(hold){const current=hold;hold=null;current.started.resolve();await current.release.promise;}return {status:304,ok:false,body:{cancel:async()=>{}},json(){assert.fail('304 must not parse JSON');}};}
  return new Response(text,{status:200,headers:{etag}});
 }});
 const api=createProjects({auth:{verifyIdToken:async uid=>({uid})},db,enabled:true,collectionReader:reader});
 return {db,reads,calls,api,setMode(value){mode=value;},holdNext304(){const started=deferred(),release=deferred();hold={started,release};return {started:started.promise,release:release.resolve};},async selector(uid='u'){const actor=await api.authorize({headers:{authorization:'Bearer '+uid}});return api.options(actor,'project','budgets');},async base(){const actor=await api.authorize({headers:{authorization:'Bearer u'}});return api.options(actor,'project','base');}};
}
test('selector preserves complete authorized DTO and never reads the SDK history or writes',async()=>{
 const f=fixture(),before=copy(f.db.root),rows=await f.selector();assert.deepEqual(rows.people,[]);assert.deepEqual(rows.clients,[]);assert.deepEqual(rows.budgets.map(x=>x.id),['own','legacy']);
 assert.deepEqual(rows.budgets[0],{id:'own',number:'PP-PROPIO',title:'Propuesta ficticia',clientId:'c',total:75.25,currency:'ARS',status:'borrador',items:[{description:'Producto ficticio',qty:2,unitPrice:37.625}]});
 assert.equal(rows.budgets[0].compra,undefined);assert.equal(rows.budgets[0].archivo,undefined);assert.deepEqual(f.db.root,before);assert.ok(!f.reads.includes('sisventas/presupuestos'));assert.equal(f.calls.length,1);
});
test('unchanged source uses a current conditional GET and returns isolated but identical results',async()=>{
 const f=fixture(),first=await f.selector(),second=await f.selector();assert.deepEqual(second,first);assert.equal(f.calls[0].validator,undefined);assert.equal(f.calls[1].validator,f.calls[0].etag);assert.equal(f.calls[1].status,304);first.budgets[0].total=999;assert.equal((await f.selector()).budgets[0].total,75.25);
});
test('source changes are reflected completely and ownership still filters another persons budget',async()=>{
 const f=fixture();await f.selector();f.db.root.sisventas.presupuestos.own.total=76.33;const changed=await f.selector();assert.equal(changed.budgets[0].total,76.33);assert.equal(f.calls.at(-1).status,200);f.db.root.sisventas.presupuestos.own.responsableUid='other';assert.ok(!(await f.selector()).budgets.some(x=>x.id==='own'));
});
test('profile changes affect legacy ownership even while the data source returns 304',async()=>{
 const f=fixture();assert.ok((await f.selector()).budgets.some(x=>x.id==='legacy'));f.db.root.sv_usuarios.u.nombre='Nombre actualizado ficticio';assert.ok(!(await f.selector()).budgets.some(x=>x.id==='legacy'));assert.equal(f.calls.at(-1).status,304);assert.ok(f.reads.filter(x=>x==='sv_usuarios').length>=2);
});
for(const change of ['inactive','module'])test('each explicit selector request rejects current '+change+' revocation before reading cached source',async()=>{
 const f=fixture();await f.selector();const count=f.calls.length;if(change==='inactive')f.db.root.sv_chat_roles.u.activo=false;else f.db.root.sv_permisos.vendedor.bloqueados=['presupuesto'];await assert.rejects(f.selector(),{statusCode:403});assert.equal(f.calls.length,count);
});
for(const mode of ['network','denied','malformed'])test(mode+' fails closed without fallback to stale data or SDK history',async()=>{
 const f=fixture();await f.selector();f.setMode(mode);await assert.rejects(f.selector(),{statusCode:503});assert.ok(!f.reads.includes('sisventas/presupuestos'));f.setMode(undefined);const count=f.calls.length;assert.equal((await f.selector()).budgets[0].total,75.25);assert.equal(f.calls[count].validator,undefined,'A failed read must discard its cache entry');assert.equal(f.calls[count].status,200);
});
test('a delayed 304 stays bound to its old request and cannot replace the cache confirmed by a newer 200',async()=>{
 const f=fixture();await f.selector();const gate=f.holdNext304(),old=f.selector();await gate.started;
 f.db.root.sisventas.presupuestos.own.total=88.88;const latest=await f.selector();assert.equal(latest.budgets[0].total,88.88);assert.equal(f.calls.at(-1).status,200);gate.release();assert.equal((await old).budgets[0].total,75.25);
 const final=await f.selector();assert.equal(final.budgets[0].total,88.88);assert.equal(f.calls.at(-1).status,304);assert.equal(f.calls.at(-1).validator,f.calls.at(-2).etag);
});
test('admin retains all visible budgets and a base form still never requests budgets',async()=>{
 const f=fixture();assert.deepEqual((await f.selector('admin')).budgets.map(x=>x.id),['own','legacy','foreign']);const count=f.calls.length;f.reads.length=0;assert.deepEqual((await f.base()).budgets,[]);assert.equal(f.calls.length,count);assert.ok(!f.reads.includes('sisventas/presupuestos'));
});
