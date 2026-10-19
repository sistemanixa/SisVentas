const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const fs=require('node:fs'),vm=require('node:vm');
function fixture(exists=true){
 const timers=[],cleared=[],classes=new Set(),nodes=[],icon={style:{},setAttribute(key,value){this[key]=value;}};
 const toast={setAttribute(key,value){this[key]=value;},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)},replaceChildren(...children){nodes.splice(0,nodes.length,...children);},set innerHTML(_){throw Error('HTML must not be parsed');}};
 const ctx={notifT:7,document:{getElementById:()=>exists?toast:null,createElement:tag=>{assert.equal(tag,'i');return icon;},createTextNode:text=>({nodeType:3,textContent:text})},setTimeout:(callback,ms)=>{timers.push({callback,ms});return 8;},clearTimeout:id=>cleared.push(id)};
 load(ctx,['notify']);return {ctx,timers,cleared,classes,nodes,icon};
}
test('mensajes y errores con etiquetas permanecen texto y no crean HTML ejecutable',()=>{
 for(const text of ['<img src=x onerror="alert(1)">','</div><script>alert(1)</script>','Nombre "de prueba" & saldo < 5','&lt;etiqueta&gt;',null]){
  const f=fixture();f.ctx.notify(text);assert.equal(f.nodes.length,2);assert.equal(f.nodes[1].nodeType,3);assert.equal(f.nodes[1].textContent,' '+String(text||''));assert.equal(f.icon.className,'ti ti-info-circle');assert.equal(f.icon.style.fontSize,'15px');assert.equal(f.icon['aria-hidden'],'true');
 }
});
test('el aviso conserva su duración, reemplaza el anterior y se cierra con el mismo temporizador',()=>{
 const f=fixture();f.ctx.notify('Primer aviso');assert.deepEqual(f.cleared,[7]);assert.equal(f.ctx.notifT,8);assert.equal(f.timers[0].ms,8000);assert.ok(f.classes.has('show'));f.ctx.notify('Otro aviso',12000);assert.equal(f.nodes[1].textContent,' Otro aviso');assert.deepEqual(f.cleared,[7,8]);assert.equal(f.timers[1].ms,12000);f.timers[1].callback();assert.equal(f.classes.has('show'),false);
});
test('duraciones inválidas usan el valor habitual y la ausencia del contenedor no produce efectos',()=>{
 for(const duration of [0,-1,'no-numero']){const f=fixture();f.ctx.notify('Mensaje',duration);assert.equal(f.timers[0].ms,8000);}
 const f=fixture(false);f.ctx.notify('Mensaje');assert.equal(f.nodes.length,0);assert.equal(f.timers.length,0);assert.equal(f.cleared.length,0);
});
test('el panel de diagnóstico anexa errores como texto y conserva las filas anteriores',()=>{
 const rows=[],listeners={},element=tag=>({tag,style:{},children:[],appendChild(node){this.children.push(node);}}),log={appendChild:node=>rows.push(node),set innerHTML(_){throw Error('No interpretar errores como HTML');}};
 const context={window:{addEventListener:(name,fn)=>listeners[name]=fn},document:{getElementById:()=>log,createElement:element,createTextNode:text=>({nodeType:3,textContent:text})}};
 vm.runInNewContext(fs.readFileSync('js/core/error-monitor.js','utf8'),context);
 listeners.error({message:'<img src=x onerror=unsafe()>',lineno:12,colno:3});listeners.error({message:'Segundo error',lineno:13,colno:4});
 assert.equal(rows.length,2);assert.equal(rows[0].children[0].textContent,'❌ <img src=x onerror=unsafe()>');assert.equal(rows[0].children[2].textContent,'L12:3');assert.equal(rows[1].children[0].textContent,'❌ Segundo error');
});
test('el error de carga de Notificaciones escapa el mensaje dentro de su diseño',()=>{
 const list={innerHTML:''},ctx={console:{error(){}},document:{getElementById:()=>list},pptoData:{forEach(){throw Error('<img src=x onerror=unsafe()>');}}};ctx.window=ctx;
 load(ctx,['svTextoLegible','escapeHTML','generarNotificaciones']);ctx.generarNotificaciones();assert.match(list.innerHTML,/&lt;img/);assert.doesNotMatch(list.innerHTML,/<img/);
});
