const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../js/modules/product-query-guard.js'),'utf8');
function setup(fn) {
  const events = {}, winEvents = {};
  const window = {location:{href:'https://local/#/productos'},notify(){},cotizarPreciosProveedores:fn,
    addEventListener(n,fn){winEvents[n]=fn;}, history:{replaceState(){}}};
  let masivo = null;
  vm.runInNewContext(source,{window,document:{addEventListener(n,fn){events[n]=fn;},getElementById(){return masivo;}}});
  return {window,events,winEvents,setMasivo(v){masivo=v;}};
}
function event(key) {return {key,target:{closest(){return null;}},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};}
test('bloquea salida y recarga mientras consulta, y libera al terminar',async()=>{
  let resolve;const c=setup(()=>new Promise(r=>{resolve=r;}));const p=c.window.cotizarPreciosProveedores();
  assert.equal(c.window.svBloquearSalidaCotizacion(),true);
  for(const key of ['Escape','F5','F8']) {const e=event(key);c.events.keydown(e);assert.ok(e.prevented);}
  const e=event();c.winEvents.beforeunload(e);assert.ok(e.prevented);
  resolve();await p;assert.equal(c.window.svBloquearSalidaCotizacion(),false);
});
test('un error libera la ficha y no deja un bloqueo permanente',async()=>{
  const c=setup(async()=>{throw new Error('sin conexión');});await assert.rejects(c.window.cotizarPreciosProveedores());
  assert.equal(c.window._svConsultaProductoEnCurso,false);
});
test('masivo protege recarga sin bloquear navegación ni clics',()=>{
  const c=setup(async()=>{});c.setMasivo({dataset:{ejecutando:'1'}});
  assert.equal(c.window.svBloquearSalidaCotizacion(),false);
  const click=event();c.events.click(click);assert.ok(!click.prevented);
  const unload=event();c.winEvents.beforeunload(unload);assert.ok(unload.prevented);
});
