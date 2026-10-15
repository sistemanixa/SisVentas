const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/configuration-mobile.js','utf8');
function setup(){
 const events={},timers=[];let removed=0,appended=0,editing=false,dirty=false;
 const input={};const old={contains:el=>editing&&el===input,querySelector:()=>dirty?{}:null,remove:()=>removed++};
 const card={children:[],appendChild:()=>appended++};const panel={querySelector:()=>card};
 const window={innerWidth:390,matchMedia:()=>({matches:window.innerWidth<=760}),addEventListener:(name,fn)=>{events[name]=fn;},CARGOS_DATA:{}};
 const document={activeElement:input,getElementById:id=>id==='sv-mobile-ux-331-css'?{}:id==='cfg-cargos'?panel:id==='sv331-cargos-list'?old:null,createElement:()=>({}),addEventListener(){}};
 const context={window,document,CARGOS_DATA:{},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){}};vm.runInNewContext(source,context);
 return {window,events,timers,edit:()=>editing=true,dirty:()=>dirty=true,get removed(){return removed;},get appended(){return appended;}};
}
test('abrir y cerrar teclado con ancho constante no recrea tarjetas',()=>{
 const s=setup(),initial=s.timers.length;s.window.innerHeight=480;s.events.resize();s.window.innerHeight=844;s.events.resize();assert.equal(s.timers.length,initial);assert.equal(s.removed,0);
});
test('cambiar ancho sí actualiza la composición cuando no se está editando',()=>{
 const s=setup();s.window.innerWidth=700;s.events.resize();const update=s.timers.at(-1);assert.equal(update.ms,150);update.fn();assert.equal(s.removed,1);assert.equal(s.appended,1);
});
test('refrescos tardíos conservan foco y cambios sin guardar',()=>{
 for(const mode of ['edit','dirty']){const s=setup();s[mode]();s.timers.find(t=>t.ms===700).fn();s.timers.find(t=>t.ms===3200).fn();assert.equal(s.removed,0);assert.equal(s.appended,0);}
});
