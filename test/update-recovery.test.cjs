const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/app.v3.8.8.js','utf8');
const routine=source.slice(source.indexOf('function actualizarAutomaticamente('),source.indexOf('function restaurarPaginaPostActualizacion('));
function setup(options={}) {
  let now=1000,id=0;const timers=new Map(),nodes=new Map(),storage=new Map(),redirects=[],messages=[];
  const context={URL,encodeURIComponent,APP_CONFIG:{VERSION:'v3.8.7-firebase'},_actualizandoAhora:false,
    Date:{now:()=>now},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:i=>timers.delete(i),
    document:{getElementById:k=>nodes.get(k),querySelector:()=>({id:'page-balancecompra'}),
      createElement:()=>({style:{},remove(){nodes.delete(this.id);}}),body:{appendChild(n){nodes.set(n.id,n);for(const k of ['upd-bar','upd-status','upd-cancel'])nodes.set(k,{style:{}});}}},
    location:{href:'http://127.0.0.1:8765/?vista=compras-exterior#/balancecompra',hostname:options.host||'127.0.0.1',replace(url){if(options.throwNavigation)throw Error('blocked');redirects.push(url);}},
    navigator:{serviceWorker:{getRegistrations(){throw Error('No debe depender de SW');}}},
    caches:{keys(){throw Error('No debe borrar caches');}},
    _mostrarBotonActualizacion:()=>{},notify:m=>messages.push(m),svBloquearSalidaCotizacion:()=>!!options.critical};
  context.window=context;vm.createContext(context);vm.runInContext(routine,context);
  function advance(ms){now+=ms;for(const [key,t] of [...timers])if(t.at<=now){timers.delete(key);t.fn();}}
  return {context,nodes,redirects,messages,advance,timers,storage};
}
test('recarga sin tocar SW ni cache y conserva consulta, página y versión',()=>{
  const h=setup();h.context.actualizarAutomaticamente('v3.8.7-firebase','v3.8.8-firebase');h.advance(400);
  assert.equal(h.redirects.length,1);const u=new URL(h.redirects[0]);assert.equal(u.searchParams.get('vista'),'compras-exterior');assert.equal(u.searchParams.get('app_version'),'v3.8.8');assert.equal(u.hash,'#/balancecompra');
  assert.equal(h.storage.get('sisventas_pagina_previa'),'balancecompra');assert.notEqual(h.nodes.get('upd-bar').style.width,'100%');
});
test('si replace no navega, devuelve el control a los seis segundos',()=>{
  const h=setup();h.context.actualizarAutomaticamente();h.advance(400);h.advance(5600);
  assert.equal(h.nodes.has('overlay-actualizando'),false);assert.equal(h.context._actualizandoAhora,false);assert.equal(h.timers.size,0);assert.ok(h.messages[0].includes('No se pudo'));assert.ok(h.context._svUpdatePausedUntil>6000);
});
test('navegación rechazada recupera inmediatamente la pantalla',()=>{
  const h=setup({throwNavigation:true});h.context.actualizarAutomaticamente();h.advance(400);assert.equal(h.nodes.has('overlay-actualizando'),false);assert.equal(h.timers.size,0);
});
test('seguir trabajando cancela definitivamente la recarga pendiente',()=>{
  const h=setup();h.context.actualizarAutomaticamente();h.nodes.get('upd-cancel').onclick();h.advance(20000);assert.equal(h.redirects.length,0);assert.equal(h.context._actualizandoAhora,false);
});
test('doble clic no duplica la recarga y operaciones críticas no quedan bloqueadas',()=>{
  const h=setup();h.context.actualizarAutomaticamente();h.context.actualizarAutomaticamente();h.advance(400);assert.equal(h.redirects.length,1);
  const critical=setup({critical:true});critical.context._actualizandoAhora=true;critical.context.actualizarAutomaticamente();assert.equal(critical.context._actualizandoAhora,false);assert.equal(critical.nodes.size,0);
});
test('localhost anuncia la versión sin consultar ni interrumpir automáticamente',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]']){
    const h=setup({host});let announcements=0;
    Object.assign(h.context,{_versionMasNueva:()=>true,_mostrarBotonActualizacion:()=>announcements++});
    vm.runInContext(source.slice(source.indexOf('function _dispararActualizacion('),source.indexOf('// Respaldo de baja frecuencia:',source.indexOf('function _dispararActualizacion('))),h.context);
    h.context._dispararActualizacion('v3.8.8-firebase');assert.equal(announcements,1);assert.equal(h.nodes.size,0);assert.equal(h.redirects.length,0);
  }
});
test('pausa de recuperación impide volver a bloquear por otro aviso',()=>{
  const h=setup({host:'ventas.sistemanixa.com'});h.context._svUpdatePausedUntil=50000;
  vm.runInContext(source.slice(source.indexOf('function _dispararActualizacion('),source.indexOf('// Respaldo de baja frecuencia:',source.indexOf('function _dispararActualizacion('))),h.context);
  h.context._dispararActualizacion('v3.8.8-firebase');assert.equal(h.nodes.size,0);
});

test('activación conserva PDFs y cachés ajenas, elimina sólo versiones anteriores',async()=>{
  const listeners={},deleted=[];let pending;
  const c={URL,Request,Response,Promise,self:{addEventListener:(type,fn)=>listeners[type]=fn,clients:{claim:()=>{}},location:{origin:'https://ventas.sistemanixa.com'}},caches:{keys:async()=>['sisventas-v3.8.7','sisventas-v3.8.8','sisventas-pdf-transitorios','otra-aplicacion'],delete:async key=>deleted.push(key)}};
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'),c);listeners.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['sisventas-v3.8.7']);
});
