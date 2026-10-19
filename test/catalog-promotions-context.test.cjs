'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const source=fs.readFileSync('js/modules/catalog-promotions-config.js','utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function setup({holdIndex=false}={}){
 const reads=[],pending=[],listeners=[],writes=[],index=deferred(),write=deferred();let stopped=0,active=0,maxActive=0;
 function form(){const options=[],status={textContent:''};return {isConnected:true,status,elements:{codigo:{value:'DEMO'},porcentaje:{value:'10'},inicio:{value:'2026-10-01T00:00'},fin:{value:'2026-10-31T23:59'},alcance:{value:'pedido'},activa:{checked:true},productos:{selectedOptions:[],options,append(option){options.push(option);}}},querySelector:()=>status};}
 const host={isConnected:true,hidden:false,classList:{add(){}},form:null,offers:{innerHTML:''},products:{hidden:true},querySelector(q){return q==='form[data-offer]'?this.form:q==='[data-offers]'?this.offers:q==='[data-products]'?this.products:q==='[role=status]'?this.form.status:{};},querySelectorAll(){return [];},set innerHTML(_value){this.form=form();}};
 const c={console,Date,Promise,document:{createElement:()=>({})},currentUserUid:'a',currentRole:'admin',fbAuth:{currentUser:{uid:'a'}},fbDB:{},fbRef:(_db,path)=>path,
  SVCatalogOrderPeriodsConfig:{mount(){},reset(){}},
  fbGet(path){reads.push(path);if(path==='sv_catalogo_publico_index')return index.promise;const d=deferred();pending.push({...d,path});active++;maxActive=Math.max(maxActive,active);return d.promise.finally(()=>active--);},
  fbOnValue(_path,next,error){listeners.push({next,error});return ()=>stopped++;},fbSet(path,value){writes.push({path,value,uid:c.currentUserUid});return write.promise;}};
 c.window=c;load(c,['svCapturarContextoOperacion']);vm.runInContext(source,c);c.SVCatalogPromotionsConfig.mount(host);
 if(!holdIndex)index.resolve({val:()=>Object.fromEntries(Array.from({length:20},(_,i)=>['p'+i,true]))});
 return {c,host,reads,pending,listeners,writes,index,write,get stopped(){return stopped;},get maxActive(){return maxActive;},release(batch=pending.splice(0)){for(const p of batch)p.resolve({val:()=>({nombre:p.path})});}};
}

test('reset con6productos en vuelo no inicia los14restantes ni modifica una vista desmontada',async()=>{
 const f=setup();await flush();assert.equal(f.pending.length,6);assert.equal(f.maxActive,6);f.host.form.isConnected=false;f.c.currentRole='vendedor';f.c.SVCatalogPromotionsConfig.reset();
 f.release();await flush();assert.equal(f.reads.length,7);assert.equal(f.host.form.elements.productos.options.length,0);assert.equal(f.stopped,1);assert.equal(f.writes.length,0);
 f.listeners[0].next({val:()=>({})});f.listeners[0].error(Error('Error tardío'));assert.equal(f.host.offers.innerHTML,'');assert.equal(f.host.form.status.textContent,'');
});

test('la cola se invalida por UID, rol, revisión, logout, Ver como, cierre o formulario reemplazado',async()=>{
 const changes=[f=>{f.c.currentUserUid='b';f.c.fbAuth.currentUser={uid:'b'};},f=>{f.c.currentRole='vendedor';},f=>{f.c.PERMISOS_ROLES={admin:{indiceRevision:2}};},f=>{f.c._svOperacionesSesionEpoch=1;},f=>{f.c._impersonacionOriginal={uid:'a'};},f=>{f.host.hidden=true;},f=>{f.host.isConnected=false;},f=>{f.host.form.isConnected=false;},f=>{f.host.innerHTML='Otra vista';}];
 for(const change of changes){const f=setup();await flush();change(f);f.release();await flush();assert.equal(f.reads.length,7);assert.equal(f.host.form.elements.productos.options.length,0);assert.equal(f.writes.length,0);}
});

test('índice retenido no inicia ningún producto después de reset y un remount descarta la cola anterior',async()=>{
 const f=setup({holdIndex:true});f.c.SVCatalogPromotionsConfig.reset();f.index.resolve({val:()=>({p0:true})});await flush();assert.equal(f.reads.length,1);
 const g=setup();await flush();const old=g.pending.splice(0),oldForm=g.host.form;g.c.SVCatalogPromotionsConfig.mount(g.host);await flush();assert.notEqual(g.host.form,oldForm);assert.equal(g.pending.length,6);
 g.release(old);await flush();assert.equal(g.reads.length,14);assert.equal(g.host.form.elements.productos.options.length,0);
 g.c.SVCatalogPromotionsConfig.reset();g.release();await flush();assert.equal(g.reads.length,14);
});

test('la vista vigente carga20productos con máximo6en vuelo, ordena opciones y no escribe',async()=>{
 const f=setup();await flush();while(f.pending.length){f.release();await flush();}
 assert.equal(f.reads.length,21);assert.equal(f.maxActive,6);assert.equal(f.host.form.elements.productos.options.length,20);assert.equal(f.writes.length,0);
 const names=f.host.form.elements.productos.options.map(option=>option.textContent);assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b,'es')));
});

test('guardar oferta sigue siendo explícito y un resultado tardío no informa éxito en otro contexto',async()=>{
 const f=setup();await flush();const form=f.host.form,running=form.onsubmit({preventDefault(){}});assert.equal(f.writes.length,1);assert.equal(f.writes[0].uid,'a');
 f.c.currentUserUid='b';f.c.fbAuth.currentUser={uid:'b'};f.write.resolve();await running;assert.equal(form.status.textContent,'');await form.onsubmit({preventDefault(){}});assert.equal(f.writes.length,1);
 f.c.SVCatalogPromotionsConfig.reset();f.release();await flush();
 const g=setup();await flush();const saved=g.host.form.onsubmit({preventDefault(){}});g.write.resolve();await saved;assert.equal(g.host.form.status.textContent,'Oferta guardada.');assert.equal(g.writes.length,1);g.c.SVCatalogPromotionsConfig.reset();g.release();await flush();
});
