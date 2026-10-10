const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/core/session-assets.js','utf8');
function setup(){
 const scripts=[],timers=new Map();let timerId=0;
 const window={};
 const context={window,Promise,Error,
  setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  document:{createElement:()=>({remove(){this.removed=true;}}),head:{appendChild:script=>scripts.push(script)}}};
 vm.runInNewContext(source,context);
 function complete(index){const script=scripts[index];const globals={
  'distribuidora-access':'SVDistribuidora','paraguay-shopping-access':'SVParaguayPortal',
  'purchase-orders':'SisVentasCompras','paraguay-planner':'SVParaguayPlanner',
  'exterior-preparation':'SVExteriorPreparation','purchase-pdf-import':'SVPurchasePDF'};
  const name=Object.keys(globals).find(n=>script.src.includes(n+'.js'));
  window[globals[name]]={};script.onload();
 }
 return{window,scripts,timers,complete,load:window.SVSessionAssets.load,forRole:window.SVSessionAssets.forRole};
}
test('el login inicial no descarga módulos opcionales',()=>{assert.equal(setup().scripts.length,0);});
test('grupo interno espera todos los scripts y conserva el simulador sin descargar',async()=>{
 const x=setup();let ready=false;const pending=x.forRole('admin',()=>true).then(()=>ready=true);
 assert.equal(x.scripts.length,3);assert.ok(x.scripts.every(s=>s.async===false));
 assert.deepEqual(x.scripts.map(s=>s.src.split('/').pop().split('?')[0]),['distribuidora-access.js','paraguay-shopping-access.js','purchase-orders.js']);
 x.complete(0);x.complete(1);await Promise.resolve();assert.equal(ready,false);
 x.complete(2);await pending;assert.equal(ready,true);assert.equal(x.timers.size,0);
 assert.ok(!x.scripts.some(s=>s.src.includes('paraguay-planner')));
});
for(const role of ['distribuidora','compras_paraguay'])test('portal '+role+' no descarga Órdenes de compra',async()=>{
 const x=setup();const pending=x.forRole(role,()=>true);assert.equal(x.scripts.length,2);
 x.complete(0);x.complete(1);await pending;assert.ok(!x.scripts.some(s=>s.src.includes('purchase-orders')));
});
test('varios pedidos simultáneos del simulador comparten una descarga',async()=>{
 const x=setup();const first=x.load('planner'),second=x.load('planner');assert.equal(first,second);
 assert.equal(x.scripts.length,1);x.complete(0);await first;await x.load('planner');assert.equal(x.scripts.length,1);
});
test('fallo de red elimina el script y permite reintentar',async()=>{
 const x=setup();const first=x.load('planner');x.scripts[0].onerror();await assert.rejects(first,/descargar/);
 assert.equal(x.scripts[0].removed,true);const next=x.load('planner');assert.equal(x.scripts.length,2);
 x.complete(1);await next;assert.equal(x.timers.size,0);
});
test('código sin export esperado no se considera cargado',async()=>{
 const x=setup();const first=x.load('planner');x.scripts[0].onload();await assert.rejects(first,/inicializar/);
 const retry=x.load('planner');x.complete(1);await retry;
});
test('timeout se informa y permite otra descarga',async()=>{
 const x=setup();const first=x.load('planner');x.timers.values().next().value();await assert.rejects(first,/demoró/);
 const retry=x.load('planner');x.complete(1);await retry;
});
test('una sesión cancelada no comienza nuevas descargas ni se declara lista',async()=>{
 const x=setup();assert.equal(await x.forRole('admin',()=>false),false);assert.equal(x.scripts.length,0);
 let current=true;const pending=x.forRole('admin',()=>current);current=false;
 x.complete(0);x.complete(1);x.complete(2);assert.equal(await pending,false);
});
test('manifiestos no vuelven a precargar los módulos separados',()=>{
 const index=fs.readFileSync('index.html','utf8'),worker=fs.readFileSync('sw.js','utf8');
 for(const name of ['purchase-orders','distribuidora-access','paraguay-shopping-access','paraguay-planner']){
  assert.ok(!index.includes('src="./js/modules/'+name+'.js'));
  const shell=worker.slice(worker.indexOf('const SHELL'),worker.indexOf("self.addEventListener('install'"));
  assert.ok(!shell.includes('./js/modules/'+name+'.js'));
 }
 assert.ok(index.indexOf('session-assets.js')<index.indexOf('js/app.v'));
});
function simulator(locked=false){
 const code=fs.readFileSync('js/modules/purchase-orders.js','utf8');
 const start=code.indexOf('  window.ocAbrirSimuladorParaguay = async function');
 const snippet=code.slice(start,code.indexOf('\n  };',start)+6);
 const loaded=[],opened=[];
 const state={activeList:{items:[],locked},inventory:{},lists:[]};
 const window={permisoModulo:()=>true,notify:()=>{},SVSessionAssets:{load:async name=>{
  loaded.push(name);
  if(name==='planner')window.SVParaguayPlanner={open:()=>opened.push('planner')};
  if(name==='preparation')window.SVExteriorPreparation={open:()=>opened.push('preparation')};
  if(name==='purchasePDF')window.SVPurchasePDF={};
 }}};
 vm.runInNewContext(snippet,{window,state,materialListLocked:l=>l.locked,loadMaterialQuote:()=>{},saleRef:()=>({}),materialRates:{},balancePurchaseTitle:()=>'',productList:()=>[]});
 return{window,state,loaded,opened,run:window.ocAbrirSimuladorParaguay};
}
test('compra nueva abre preparación sin descargar el planificador legado',async()=>{
 const x=simulator();await x.run();assert.deepEqual(x.loaded,['preparation','purchasePDF']);assert.deepEqual(x.opened,['preparation']);
});
test('compra histórica cerrada conserva el planificador legado',async()=>{
 const x=simulator(true);await x.run();assert.deepEqual(x.loaded,['planner','purchasePDF']);assert.deepEqual(x.opened,['planner']);
});
test('cerrar o cambiar la lista durante la descarga no abre un simulador obsoleto',async()=>{
 const x=simulator();let release;const original=x.window.SVSessionAssets.load;
 x.window.SVSessionAssets.load=async name=>{if(name==='preparation')await new Promise(r=>release=r);await original(name);};
 const pending=x.run();x.state.activeList=null;release();await pending;assert.deepEqual(x.opened,[]);
});
test('si la compra se cierra mientras se prepara el simulador no abre la edición anterior',async()=>{
 const x=simulator();let release;const original=x.window.SVSessionAssets.load;
 x.window.SVSessionAssets.load=async name=>{if(name==='preparation')await new Promise(r=>release=r);await original(name);};
 const pending=x.run();x.state.activeList.locked=true;release();await pending;assert.deepEqual(x.opened,[]);
});
test('auditoría de mantenimiento no se descarga al iniciar y comparte carga bajo demanda',async()=>{
 const x=setup();assert.equal(x.scripts.length,0);
 const a=x.load('diagnostics'),b=x.load('diagnostics');assert.equal(a,b);assert.equal(x.scripts.length,1);
 x.window.SisVentas={V3Diagnostics:{}};x.scripts[0].onload();await a;await x.load('diagnostics');assert.equal(x.scripts.length,1);
 const index=fs.readFileSync('index.html','utf8');assert.ok(!index.includes('<script src="./js/v3/admin-diagnostics.js'));
});
test('mantenimiento muestra fallo y permite reintentar sin bloquear otras pantallas',async()=>{
 const scripts=[],nodes={};const panel={style:{display:'block'},appendChild:n=>nodes[n.id]=n};nodes['cfg-mantenimiento']=panel;
 const window={};const document={getElementById:id=>nodes[id],head:{appendChild:s=>scripts.push(s)},createElement:()=>({children:[],setAttribute(){},appendChild(n){this.children.push(n)},remove(){delete nodes[this.id]}})};
 vm.runInNewContext(source,{window,document,setTimeout,clearTimeout,Promise,Error});
 const first=window.SVSessionAssets.maintenance();scripts[0].onerror();await first;
 const status=nodes['mnt-diagnostics-loading'];assert.match(status.textContent,/descargar/);assert.equal(status.children[0].textContent,'Reintentar');
 const retry=status.children[0].onclick();let mounts=0;window.SisVentas={V3Diagnostics:{mount(){mounts++}}};scripts[1].onload();await retry;assert.equal(mounts,1);assert.equal(nodes['mnt-diagnostics-loading'],undefined);
});
