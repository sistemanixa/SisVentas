const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/modules/notifications.js','utf8');
function setup(action){
 const calls=[],notices=[],storage={},listeners={};
 const context={console,Date,Promise,
  Function(){throw Error('Dynamic code forbidden');},
  localStorage:{getItem:key=>storage[key]||null,setItem:(key,val)=>storage[key]=val},
  document:{visibilityState:'visible',documentElement:{},getElementById:()=>null,querySelector:()=>null,addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn);}},
  MutationObserver:function(){this.observe=()=>{};},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,addEventListener(){},
  obtenerContextoSesionSisVentas:()=>({usuario:'Demo',email:'demo@example.invalid',rol:'admin'}),
  obtenerNotificacionesSisVentas:()=>[{id:'demo',accion:action}],notify:text=>notices.push(text),
  abrirPanelAprobacionHsExtra:()=>calls.push(['horas-extra']),showPage:(page)=>calls.push([page])};
 context.window=context;vm.runInNewContext(source,context,{codeGeneration:{strings:false,wasm:false}});
 for(const [type,name]of Object.entries({presupuesto:'abrirPresupuestoDesdeNotificacion',ot:'abrirOTDesdeNotificacion',gasto:'abrirGastoDesdeNotificacion'}))context[name]=id=>calls.push([type,id]);
 return {context,calls,notices,storage,listeners};
}
for(const critical of [false,true]){
 const open=fixture=>fixture.context[critical?'notifAvisoCriticoAbrir':'notifAbrirAccion']('demo');
 test(`${critical?'aviso crítico':'lista'} abre los cinco destinos sin evaluar código`,()=>{
  for(const tipo of ['presupuesto','ot','gasto','cuentacorriente','horas-extra']){
   const f=setup({tipo,id:"REF-'\"\\-001"});open(f);
   assert.deepEqual(f.calls,[[tipo,...(['presupuesto','ot','gasto'].includes(tipo)?["REF-'\"\\-001"]:[])]]);
   assert.equal(f.notices.length,0);
  }
 });
 test(`${critical?'aviso crítico':'lista'} mantiene solo las acciones antiguas conocidas`,()=>{
  const cases=[...[['presupuesto','abrirPresupuestoDesdeNotificacion'],['ot','abrirOTDesdeNotificacion'],['gasto','abrirGastoDesdeNotificacion']].map(([tipo,name])=>({fn:`${name}('DEMO-1')`,expected:[tipo,'DEMO-1']})),{fn:'abrirPanelAprobacionHsExtra()',expected:['horas-extra']},{fn:"showPage('cuentacorriente',document.querySelector('[onclick*=cuentacorriente]'))",expected:['cuentacorriente']}];
  for(const item of cases){const f=setup({fn:item.fn});open(f);assert.deepEqual(f.calls,[item.expected]);}
 });
 test(`${critical?'aviso crítico':'lista'} rechaza código y destinos desconocidos sin efectos`,()=>{
  for(const accion of [{fn:"abrirOTDesdeNotificacion('OT-1'); abrirPanelAprobacionHsExtra()"},{fn:"abrirOTDesdeNotificacion('x\\');alert(1)//')"},{fn:'globalThis.compromised=true'},{tipo:'constructor',fn:'abrirPanelAprobacionHsExtra()'},{tipo:'ot',id:''},{tipo:'ot',id:42},{tipo:'gasto',id:'a'.repeat(513)},null]){
   const f=setup(accion);open(f);assert.deepEqual(f.calls,[]);assert.equal(f.notices.length,1);
  }
 });
}
test('errores de destino se muestran sin ejecutar un reemplazo',()=>{
 const f=setup({tipo:'ot',id:'DEMO'});f.context.abrirOTDesdeNotificacion=()=>{throw Error('failure');};f.context.notifAbrirAccion('demo');assert.equal(f.notices.length,1);assert.deepEqual(f.calls,[]);
});
test('la tarjeta con identificadores especiales usa datos escapados y un único evento delegado',()=>{
 const f=setup({tipo:'ot',id:'OT-DEMO'}),id=`demo'");alert(1)//"<tag>&`,list={innerHTML:'',contains:node=>node.inside===true};
 f.context.obtenerNotificacionesSisVentas=()=>[{id,accion:{tipo:'ot',id:'OT-DEMO'},titulo:'Ejemplo'}];
 f.context.document.getElementById=key=>key==='notif-lista'?list:null;
 f.context.renderNotificaciones();assert.doesNotMatch(list.innerHTML,/\sonclick=/);assert.match(list.innerHTML,/data-sv-notif-action="abrir"/);assert.match(list.innerHTML,/&quot;/);assert.match(list.innerHTML,/&lt;tag&gt;/);
 const node={inside:true,getAttribute:key=>key==='data-sv-notif-id'?id:'abrir'};let stopped=0;
 f.listeners.click[0]({target:{closest:()=>node},stopPropagation:()=>stopped++});assert.deepEqual(f.calls,[['ot','OT-DEMO']]);assert.equal(stopped,1);
 node.inside=false;f.listeners.click[0]({target:{closest:()=>node}});assert.equal(f.calls.length,1);
});
test('los controles delegados conservan sus operaciones sin abrir la tarjeta de fondo',()=>{
 for(const [action,method]of [['no-leida','marcarNoLeida'],['posponer','notifPosponer'],['resolver','notifResolver'],['archivar','notifArchivar']]){
  const f=setup({tipo:'ot',id:'OT-DEMO'}),result=[];
  f.context[method]=(...args)=>result.push(args);f.context.document.getElementById=()=>({contains:()=>true});
  const node={getAttribute:key=>key==='data-sv-notif-id'?'demo':action};let stopped=0;
  f.listeners.click[0]({target:{closest:()=>node},stopPropagation:()=>stopped++});
  assert.deepEqual(result,[action==='posponer'?['demo',1]:['demo']]);assert.equal(stopped,1);assert.equal(f.calls.length,0);
 }
});
