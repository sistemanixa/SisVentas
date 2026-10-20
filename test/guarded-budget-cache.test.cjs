'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs'),{fixture:ownershipFixture}=require('./helpers/commercial-ownership-fixtures.cjs');
const clone=value=>value==null?value:structuredClone(value);
const response=(value,status=200,etag=null)=>({ok:status>=200&&status<300,status,headers:{get:name=>name.toLowerCase()==='etag'?etag:null},json:async()=>clone(value)});
const sourceBudget=()=>({id:'PP-0001',numero:'PP-0001',cliente:'Cliente ficticio',usuario:'Persona a',creadoPor:'Persona a',empleadoUid:'a',fecha:'2026-10-01',vence:'2026-10-30',ts:1000,estado:'enviado',subtotal:100,descuento:0,descuentoGeneral:0,descuentoAmt:0,iva:21,conIva:true,total:121,items:[{cod:'P-FICTICIO',desc:'Producto ficticio',qty:1,punit:100,sub:100}],observaciones:'Movido desde venta V-FICTICIA',audit:[{fecha:'2026-10-01',usuario:'Persona a',accion:'Creado desde venta V-FICTICIA'}]});
function fixture(){
 const backend=ownershipFixture(),records=backend.db.root.sisventas.presupuestos,versions=new Map(),cache=new Map();
 for(const key of Object.keys(records))delete records[key];records.source=sourceBudget();
 const calls={prepare:[],sdkGet:[],sdkTransaction:[],sdkPush:[],restGet:[],restPut:[],unexpected:[]},hooks={},effects={items:null,opened:0,calculated:0},fields=new Map();let created=0;
 const field=id=>{if(!fields.has(id))fields.set(id,{value:'',style:{},focus(){},innerHTML:''});return fields.get(id);};
 function read(path){assert.match(path,/^sisventas\/presupuestos\/[A-Za-z0-9_-]+$/);return clone(records[path.split('/').at(-1)]??null);}
 function etag(path){return '"v'+(versions.get(path)||0)+'"';}
 function write(path,value){const key=path.split('/').at(-1);if(value===null)delete records[key];else records[key]=clone(value);versions.set(path,(versions.get(path)||0)+1);}
 const user={uid:'admin',getIdToken:async()=>'admin'},c={window:null,currentUserUid:'admin',currentRole:'admin',currentUser:'Persona admin',currentUserEmail:'',fbAuth:{currentUser:user},fbDB:{},FB_PATHS:{presupuestos:'sisventas/presupuestos'},
  SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://service.fixture.invalid'},AbortController,AbortSignal,URL,TextEncoder,console,structuredClone,
  document:{addEventListener(){},getElementById:field,querySelector:selector=>selector.includes('Condiciones, notas')?field('pp-obs'):null},
  notify(){},abrirNuevoPresupuesto(){effects.opened++;},actualizarAccesoVentasClientePpto(){},mostrarDomicilioOperacionSeleccionado(){},
  pptoNumeroGuardado:value=>Number(value)||0,pptoCargarItemsEnEditor:record=>{effects.items=clone(record.items);},calcPpTotales:()=>effects.calculated++,
  fbRef:(_db,path)=>({path,toString:()=> 'https://db.fixture.invalid/'+path}),
  fbGet:async ref=>{const value=read(ref.path);calls.sdkGet.push({path:ref.path,value});return {val:()=>clone(value)};},
  fbPush:async(ref,value)=>{assert.equal(ref.path,'sisventas/presupuestos');const key='copy-'+(++created);calls.sdkPush.push({key,value:clone(value)});write(ref.path+'/'+key,value);cache.set(ref.path+'/'+key,clone(value));return {key};},
  fbRunTransaction:async(ref,update,options)=>{
   assert.equal(options.applyLocally,false);const current=cache.has(ref.path)?clone(cache.get(ref.path)):read(ref.path),next=update(current);
   calls.sdkTransaction.push({path:ref.path,current,next:clone(next)});if(hooks.afterSdk)await hooks.afterSdk();
   if(next===undefined)return {committed:false};
   assert.deepEqual(current,read(ref.path),'El SDK ficticio sólo confirma sobre la misma versión del servidor');
   write(ref.path,next);cache.set(ref.path,clone(next));return {committed:true,snapshot:{val:()=>clone(next)}};
  }};
 async function authorize(){return backend.api.authorize({headers:{authorization:'Bearer admin'}},'presupuestos');}
 c.fetch=async(input,options={})=>{
  const url=new URL(String(input));
  if(url.origin==='https://service.fixture.invalid'){
   assert.equal(url.pathname,'/comerciales/presupuestos/preparar');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer admin');
   const body=JSON.parse(options.body);calls.prepare.push(body);
   try{const result=await backend.api.prepare(await authorize(),body);return response({ok:true,...result});}
   catch(error){return response({ok:false,mensaje:error.message},error.statusCode||500);}
  }
  if(url.origin!=='https://db.fixture.invalid'){calls.unexpected.push(String(input));throw Error('Red ajena a la fixture bloqueada');}
  assert.equal(url.searchParams.get('auth'),'admin');const path=url.pathname.slice(1).replace(/\.json$/,'');
  try{await authorize();}catch(error){return response({error:'Permiso revocado en fixture'},error.statusCode||403);}
  if(!options.method){
   assert.equal(options.headers['X-Firebase-ETag'],'true');const value=read(path),version=etag(path);calls.restGet.push({path,value,etag:version});
   if(hooks.afterRestGet)await hooks.afterRestGet({path,value});return response(value,200,version);
  }
  assert.equal(options.method,'PUT');assert.equal(options.headers['Content-Type'],'application/json');
  const value=JSON.parse(options.body),call={path,value,ifMatch:options.headers['if-match'],status:null};calls.restPut.push(call);
  if(hooks.beforeRestPut)await hooks.beforeRestPut({path,value});
  if(call.ifMatch!==etag(path)){call.status=412;return response({error:'ETag ficticio cambió'},412);}
  write(path,value);call.status=200;return response(value);
 };
 c.window=c;vm.createContext(c);
 for(const filename of ['js/core/guarded-writes.js','js/core/commercial-ownership.js','js/modules/commercial-document-controls.js'])vm.runInContext(fs.readFileSync(filename,'utf8'),c);
 load(c,['_cargarDuplicadoPresupuesto','pptoV3Invocar','pptoPersistirGuardar']);
 function record(key){return {...clone(records[key]),fbKey:key};}
 function stale(key,value){cache.set('sisventas/presupuestos/'+key,clone(value));}
 function foreign(key,changes){write('sisventas/presupuestos/'+key,{...clone(records[key]),...clone(changes)});}
 async function independentCopy(){
  const original=record('source');c._pptoEditorBase=clone(original);c._pptoEditandoFbKey='source';c._pptoEditandoId=original.id;
  c._cargarDuplicadoPresupuesto(original,{nombre:'Cliente de la copia',fbKey:'cliente-copia'});
  assert.equal(c._pptoEditorBase,null);assert.equal(c._pptoEditandoFbKey,null);assert.equal(c._pptoEditandoId,null);
  const candidate={id:'PP-0002',numero:'PP-0002',cliente:field('pp-cli').value,clienteFbKey:field('pp-cli-id').value,fecha:'2026-10-20',vence:original.vence,ts:2000,estado:'enviado',items:effects.items,subtotal:100,descuento:0,descuentoGeneral:0,descuentoAmt:0,iva:21,conIva:c._pptoConIva,total:121,observaciones:field('pp-obs').value,usuario:'Persona admin',creadoPor:'Persona admin',audit:[{fecha:'2026-10-20',usuario:'Persona admin',accion:'Presupuesto creado como borrador'}]};
  const saved=await c.pptoPersistirGuardar(candidate,null);assert.notEqual(saved.fbKey,original.fbKey);assert.deepEqual(records.source,sourceBudget());return saved;
 }
 return {c,backend,calls,hooks,records,effects,record,stale,foreign,write,independentCopy};
}
function discounted(base,pct){const subtotal=100,net=subtotal*(1-pct/100);return {...clone(base),descuento:pct,descuentoGeneral:pct,descuentoAmt:subtotal-net,iva:Math.round(net*21)/100,total:Math.round(net*121)/100,audit:[...(base.audit||[]),{fecha:'2026-10-20',usuario:'Persona admin',accion:'Descuento editado '+pct}]};}

test('copia independiente, primer guardado y segunda edición de descuento toleran caché SDK antigua no nula',async()=>{
 const f=fixture(),copy=await f.independentCopy();assert.equal(f.calls.sdkPush.length,1);assert.equal(f.effects.opened,1);
 assert.equal(copy.responsableUid,'admin');assert.equal(copy.creadorOriginalUid,'admin');assert.equal(copy.cliente,'Cliente de la copia');
 const first=await f.c.pptoPersistirGuardar(discounted(copy,10),copy);assert.equal(first.descuento,10);assert.equal(f.calls.restPut.length,0);
 const baseline=f.record(copy.fbKey);f.stale(copy.fbKey,f.calls.sdkPush[0].value);
 const second=await f.c.pptoPersistirGuardar(discounted(baseline,20),baseline);
 assert.equal(second.descuento,20);assert.equal(second.total,96.8);assert.deepEqual(second.items,baseline.items);
 assert.equal(f.calls.sdkGet.at(-1).value.descuento,10);assert.equal(f.calls.sdkTransaction.at(-1).current.descuento,0);assert.equal(f.calls.sdkTransaction.at(-1).next,undefined);
 assert.equal(f.calls.restGet.length,1);assert.equal(f.calls.restPut.length,1);assert.equal(f.calls.restPut[0].ifMatch,f.calls.restGet[0].etag);assert.equal(f.calls.restPut[0].status,200);
 assert.equal(f.calls.sdkPush.length,1);assert.deepEqual(f.records.source,sourceBudget());assert.equal(f.records[copy.fbKey].responsableUid,'admin');assert.deepEqual(f.calls.unexpected,[]);
});

for(const field of ['total','items'])test('cambio real de otro editor en '+field+' conserva SV_CONFLICT y no envía PUT',async()=>{
 const f=fixture(),copy=await f.independentCopy(),baseline=f.record(copy.fbKey),changes=field==='total'?{total:500}:{items:[{...baseline.items[0],qty:7,sub:700}]};
 f.foreign(copy.fbKey,changes);const current=clone(f.records[copy.fbKey]);f.stale(copy.fbKey,{...baseline,descuento:3});
 await assert.rejects(f.c.pptoPersistirGuardar(discounted(baseline,20),baseline),{code:'SV_CONFLICT'});
 assert.equal(f.calls.restGet.length,1);assert.equal(f.calls.restPut.length,0);assert.deepEqual(f.records[copy.fbKey],current);assert.deepEqual(f.records.source,sourceBudget());
});

test('412 seguido de cambio comercial conserva al otro editor y no repite el PUT',async()=>{
 const f=fixture(),copy=await f.independentCopy(),baseline=f.record(copy.fbKey);f.stale(copy.fbKey,{...baseline,descuento:3});
 f.hooks.beforeRestPut=({path})=>{delete f.hooks.beforeRestPut;f.write(path,{...clone(f.records[copy.fbKey]),total:500,items:[{...baseline.items[0],qty:7}]});};
 await assert.rejects(f.c.pptoPersistirGuardar(discounted(baseline,20),baseline),{code:'SV_CONFLICT'});
 assert.equal(f.calls.restGet.length,2);assert.equal(f.calls.restPut.length,1);assert.equal(f.calls.restPut[0].status,412);
 assert.equal(f.records[copy.fbKey].total,500);assert.equal(f.records[copy.fbKey].items[0].qty,7);assert.equal(f.records[copy.fbKey].descuento,0);
});

test('412 con contenido idéntico revalida la misma base y confirma con el ETag nuevo',async()=>{
 const f=fixture(),copy=await f.independentCopy(),baseline=f.record(copy.fbKey);f.stale(copy.fbKey,{...baseline,descuento:3});
 f.hooks.beforeRestPut=({path})=>{delete f.hooks.beforeRestPut;f.write(path,f.records[copy.fbKey]);};
 const result=await f.c.pptoPersistirGuardar(discounted(baseline,20),baseline);
 assert.equal(result.descuento,20);assert.deepEqual(f.calls.restPut.map(x=>x.status),[412,200]);assert.equal(f.calls.restGet.length,2);
 assert.notEqual(f.calls.restPut[0].ifMatch,f.calls.restPut[1].ifMatch);assert.deepEqual(f.calls.restPut[0].value,f.calls.restPut[1].value);assert.deepEqual(f.records.source,sourceBudget());
});

test('vinculación legítima de identidad legacy no convierte su caché anterior en conflicto comercial',async()=>{
 const f=fixture(),baseline=f.record('source');f.stale('source',f.records.source);
 const result=await f.c.pptoPersistirGuardar(discounted(baseline,20),baseline);
 assert.equal(result.responsableUid,'a');assert.equal(result.creadorOriginalUid,'a');assert.equal(result.descuento,20);
 assert.equal(f.calls.sdkTransaction[0].current.responsableUid,undefined);assert.equal(f.calls.sdkGet[0].value.responsableUid,'a');assert.equal(f.calls.restPut.length,1);
 assert.equal(result.audit.filter(x=>x.accion==='Vinculación de identidad histórica').length,1);assert.equal(f.calls.sdkPush.length,0);
});

test('preparación legacy sin permiso no migra identidad ni alcanza SDK/REST',async()=>{
 const f=fixture(),baseline=f.record('source');f.backend.db.root.sv_chat_roles.admin.activo=false;
 await assert.rejects(f.c.pptoPersistirGuardar(discounted(baseline,20),baseline),error=>error.status===403);
 assert.equal(f.calls.prepare.length,1);assert.equal(f.calls.sdkGet.length,0);assert.equal(f.calls.sdkTransaction.length,0);assert.equal(f.calls.restGet.length,0);assert.equal(f.calls.restPut.length,0);
 assert.deepEqual(f.records.source,sourceBudget());
});

const changes={logout:c=>{c.currentUserUid='';c.fbAuth.currentUser=null;},sameUidNewAuth:c=>{c.fbAuth.currentUser={uid:'admin',getIdToken:async()=>'admin'};},role:c=>{c.currentRole='vendedor';}};
for(const [name,change]of Object.entries(changes))test('cambio de contexto '+name+' tras callback SDK no inicia verificación REST ni escribe',async()=>{
 const f=fixture(),copy=await f.independentCopy(),baseline=f.record(copy.fbKey);f.stale(copy.fbKey,{...baseline,descuento:3});f.hooks.afterSdk=()=>change(f.c);
 await assert.rejects(f.c.pptoPersistirGuardar(discounted(baseline,20),baseline));
 assert.equal(f.calls.restGet.length,0);assert.equal(f.calls.restPut.length,0);assert.deepEqual(f.records[copy.fbKey],f.calls.sdkPush[0].value);
});

for(const [name,change]of Object.entries(changes))test('cambio de contexto '+name+' al recibir REST impide el PUT',async()=>{
 const f=fixture(),copy=await f.independentCopy(),baseline=f.record(copy.fbKey);f.stale(copy.fbKey,{...baseline,descuento:3});f.hooks.afterRestGet=()=>change(f.c);
 await assert.rejects(f.c.pptoPersistirGuardar(discounted(baseline,20),baseline));
 assert.equal(f.calls.restGet.length,1);assert.equal(f.calls.restPut.length,0);assert.deepEqual(f.records[copy.fbKey],f.calls.sdkPush[0].value);
});
