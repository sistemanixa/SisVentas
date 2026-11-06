const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {functionSource}=require('./helpers/app-functions.cjs');
const {install}=require('../js/modules/client-account-legacy-reconcile.v1.js');

function fixture(){
 const listeners=new Map(),frames=[],nodes=new Map();let ready=false,errors=[],paints=0,calculations=0;
 const node=id=>nodes.get(id)||nodes.set(id,{innerHTML:'',textContent:'',value:'',style:{},setAttribute(){},removeAttribute(){}}).get(id);
 const doc={hidden:false,getElementById:node,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);}};
 const root={document:doc,currentUserUid:'ficticio',currentRole:'administrativo',fbAuth:{currentUser:{uid:'ficticio'}},fbDB:{},PERMISOS_ROLES:{administrativo:{indiceRevision:1}},permisoModulo:()=>true,_svEsPaginaActiva:()=>true,svPuedeLeerDominio:()=>true,requestAnimationFrame:fn=>frames.push(fn),SVDataReadiness:{snapshotEpoch:()=>1,status:()=>({ready,errors,missing:ready?[]:['ventas']})},_historialPagosCompleto:[],ventasList:[],escapeHTML:String,_mostrarFecha:String,buscarCC(){},_svCrearIndicePagosVentas:()=>({}),_svPagosIndiceVenta:()=>[],_svPagosEmbebidosVenta:()=>[],_svConstruirCuentaCorriente(){calculations++;return {ficticio:{nombre:'Cliente ficticio',total:100,cobrado:20,ultimoPago:'—'}};}};
 root.window=root;vm.createContext(root);
 for(const name of ['_ccEsperarFuentesCompletas','renderTablaCuentaCorriente','actualizarConciliacionComercial'])vm.runInContext(functionSource(name),root);
 const reconcile=root.actualizarConciliacionComercial;root.actualizarConciliacionComercial=()=>{paints++;reconcile();};
 // Any accidental loader/query is a failure, including detail/history fetches.
 for(const key of ['fetch','fbGet','fbCargarVentas','fbCargarPagos','fbCargarClientes'])root[key]=()=>assert.fail('Unexpected read: '+key);
 function emit(type='sisventas:data-state-changed'){for(const fn of listeners.get(type)||[])fn({type});}
 function flush(){while(frames.length)frames.shift()();}
 return {root,node,emit,flush,start:()=>install(root),setReady(value){ready=value;},setErrors(value){errors=value;},paints:()=>paints,calculations:()=>calculations};
}

test('actual legacy callback before ready recovers saldo 80 without another read',()=>{
 const f=fixture();f.start();f.flush();f.root.actualizarConciliacionComercial();
 assert.match(f.node('cc-tbody').innerHTML,/Cargando cuentas/);assert.equal(f.calculations(),0);
 f.setReady(true);f.emit();f.emit();f.emit();assert.equal(f.calculations(),0);f.flush();
 assert.match(f.node('cc-tbody').innerHTML,/data-saldo="80"/);assert.equal(f.calculations(),1);
 const paints=f.paints();for(let i=0;i<10;i++)f.emit();f.flush();assert.equal(f.paints(),paints);
});
test('ready before callback and unchanged later events retain the same balance',()=>{
 const f=fixture();f.start();f.setReady(true);f.root.actualizarConciliacionComercial();f.emit();f.flush();
 assert.match(f.node('cc-tbody').innerHTML,/data-saldo="80"/);
 const count=f.calculations();f.emit();f.flush();assert.equal(f.calculations(),count);
});
test('ready with errors cannot calculate; recovery reconciles',()=>{
 const f=fixture();f.start();f.setReady(true);f.setErrors(['ventas']);f.emit();f.flush();
 assert.equal(f.calculations(),0);assert.match(f.node('cc-tbody').innerHTML,/No se pudieron verificar/);
 f.setErrors([]);f.emit();f.flush();assert.equal(f.calculations(),1);assert.match(f.node('cc-tbody').innerHTML,/data-saldo="80"/);
});
for(const [name,revoke] of Object.entries({permission:f=>f.root.permisoModulo=()=>false,domain:f=>f.root.currentRole='sin-acceso',auth:f=>f.root.fbAuth.currentUser={uid:'otro'},revision:f=>f.root.PERMISOS_ROLES.administrativo.indiceRevision++,database:f=>f.root.fbDB={},route:f=>f.root._svEsPaginaActiva=()=>false,hidden:f=>f.root.document.hidden=true,nativeClaim:f=>f.root.SVClientAccountHost={claimed:true},nativeActive:f=>f.root.SVClientAccountHost={active:()=>true},nativeCoordination:f=>f.root.SVClientAccountHost={coordinated:()=>true}})){
 test('discards queued work after '+name,()=>{const f=fixture();f.start();f.setReady(true);f.emit();revoke(f);f.flush();assert.equal(f.calculations(),0);});
}
test('return to page and visibility repaint once after retirement',()=>{
 const f=fixture();f.start();f.setReady(true);f.flush();assert.equal(f.calculations(),1);
 f.root._svEsPaginaActiva=()=>false;f.emit('sisventas:page-changed');f.flush();
 f.root._svEsPaginaActiva=()=>true;f.emit('sisventas:page-changed');f.flush();assert.equal(f.calculations(),2);
 f.root.document.hidden=true;f.emit('visibilitychange');f.root.document.hidden=false;f.emit('visibilitychange');f.flush();assert.equal(f.calculations(),3);
});
test('ended session stays retired until session-ready and dispose removes listeners',()=>{
 const f=fixture(),module=f.start();f.setReady(true);f.emit('sisventas:session-ended');f.emit();f.flush();assert.equal(f.calculations(),0);
 f.emit('sisventas:session-ready');f.flush();assert.equal(f.calculations(),0);
 f.emit();f.flush();assert.equal(f.calculations(),1);module.dispose();f.emit();f.flush();assert.equal(f.calculations(),1);
});

for(const installedBefore of [false,true])test('real ownership/readiness with one request, installed before callback: '+installedBefore,async()=>{
 const f=fixture(),r=f.root;let requests=0,callbacks=0;
 r.addEventListener=()=>{};r.URL=URL;r.AbortController=AbortController;r.AbortSignal=AbortSignal;
 r.CustomEvent=class{constructor(type){this.type=type;}};
 r.document.dispatchEvent=event=>f.emit(event.type);
 r.document.querySelectorAll=()=>[];r.document.querySelector=()=>null;
 const getNode=r.document.getElementById;r.document.getElementById=id=>id.startsWith('page-')?null:getNode(id);
 r.navigator={onLine:true};r.SISVENTAS_FUNCTIONS={cotizadorProveedor:'https://fake.invalid'};
 r.fbAuth.currentUser.getIdToken=async()=>'ficticio';
 r.fetch=async()=>{requests++;return{ok:true,status:200,headers:{get:()=>null},json:async()=>({ok:true,records:{v:{id:'FICTICIA'}}})};};
 vm.runInContext(fs.readFileSync(require.resolve('../js/core/data-readiness.js'),'utf8'),r);
 r.SVDataReadiness.beginSource('clientes').ready();r.SVDataReadiness.beginSource('pagos').ready();
 vm.runInContext(fs.readFileSync(require.resolve('../js/core/commercial-ownership.js'),'utf8'),r);
 if(installedBefore)f.start();
 r.SVCommercialOwnership.onValue('ventas',()=>{callbacks++;r.actualizarConciliacionComercial();});
 for(let i=0;i<10&&!callbacks;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(callbacks,1);assert.match(f.node('cc-tbody').innerHTML,/Cargando cuentas/);
 assert.equal(r.SVDataReadiness.status(['ventas','pagos','clientes']).ready,true);
 f.flush();
 if(!installedBefore){assert.match(f.node('cc-tbody').innerHTML,/Cargando cuentas/);assert.equal(f.calculations(),0);f.start();f.flush();}
 assert.match(f.node('cc-tbody').innerHTML,/data-saldo="80"/);
 assert.equal(requests,1);assert.equal(callbacks,1);
});

test('domain revocation and native ownership already present never render legacy',()=>{
 for(const change of [r=>r.svPuedeLeerDominio=()=>false,r=>r.SVClientAccountHost={claimed:true},r=>r.SVClientAccountHost={active:()=>true},r=>r.SVClientAccountHost={coordinated:()=>true}]){
  const f=fixture();change(f.root);f.setReady(true);f.start();f.emit();f.flush();assert.equal(f.calculations(),0);
 }
});

test('preserves legacy readable-source scope without requiring private clientes',()=>{
 const f=fixture();f.root.svPuedeLeerDominio=key=>key!=='clientes';f.setReady(true);f.start();f.flush();assert.equal(f.calculations(),1);
});
test('changed readable-source scope retires queued work',()=>{
 const f=fixture();f.start();f.setReady(true);f.emit();f.root.svPuedeLeerDominio=key=>key!=='pagos';f.flush();assert.equal(f.calculations(),0);
});

for(const [name,change] of Object.entries({uid:r=>{r.currentUserUid='nuevo';r.fbAuth.currentUser={uid:'nuevo'};},role:r=>r.currentRole='administrador',auth:r=>r.fbAuth.currentUser={uid:'ficticio'},permissions:r=>r.PERMISOS_ROLES.administrativo.indiceRevision++,epoch:r=>r.SVDataReadiness.snapshotEpoch=()=>2})){
 test('fresh readiness replaces pending old actor: '+name,()=>{
  const f=fixture();f.start();change(f.root);
  f.root._historialPagosCompleto=[];f.root._ccMapActual=undefined;
  f.setReady(true);f.emit();f.emit();f.flush();
  assert.equal(f.calculations(),1);assert.match(f.node('cc-tbody').innerHTML,/data-saldo="80"/);
  f.emit();f.flush();assert.equal(f.calculations(),1);
 });
}

for(const type of ['sisventas:role-changed','sisventas:session-ready'])test(type+' alone never paints retained old data; fresh data can resume',()=>{
 const f=fixture();f.start();f.setReady(true);f.root.currentRole='administrador';
 f.emit(type);f.flush();assert.equal(f.calculations(),0);
 f.root._historialPagosCompleto=[];f.root._ccMapActual=undefined;f.emit();f.flush();assert.equal(f.calculations(),1);
});
