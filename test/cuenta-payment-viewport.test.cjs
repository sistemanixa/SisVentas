const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function target(){const handlers=new Map();return {handlers,addEventListener(n,fn){if(!handlers.has(n))handlers.set(n,new Set());handlers.get(n).add(fn);},removeEventListener(n,fn){handlers.get(n)?.delete(fn);},dispatch(n){for(const fn of handlers.get(n)||[])fn();},count(){return [...handlers.values()].reduce((n,s)=>n+s.size,0);}};}
function fixture(withViewport=true){
 const win=Object.assign(target(),{innerHeight:844}),viewport=Object.assign(target(),{height:844,offsetTop:0}),props=new Map(),cancelled=[];let restored=0,sync=0;
 if(withViewport)win.visualViewport=viewport;
 const modal={isConnected:true,_ccFocoTimer:42,style:{setProperty:(k,v)=>props.set(k,v)},_ccFocoAnterior:{isConnected:true,focus:o=>{assert.equal(o.preventScroll,true);restored++;}},remove(){this.isConnected=false;}};
 const c=load({window:win,document:{getElementById:()=>modal},clearTimeout:id=>cancelled.push(id),svSincronizarPilaModales:()=>sync++},['prepararVentanaPagoCuentaCorriente','cerrarPagoCuentaCorriente']);
 return {c,win,viewport,modal,props,cancelled,restored:()=>restored,sync:()=>sync};
}
test('pago usa el espacio visible al abrir y sigue el teclado sin reemplazar el formulario',()=>{
 const f=fixture();f.c.prepararVentanaPagoCuentaCorriente(f.modal);assert.equal(f.props.get('--ccp-visible-height'),'844px');
 f.viewport.height=360;f.viewport.offsetTop=20;f.viewport.dispatch('resize');assert.equal(f.props.get('--ccp-visible-height'),'360px');assert.equal(f.props.get('--ccp-visible-top'),'20px');
 f.viewport.offsetTop=50;f.viewport.dispatch('scroll');assert.equal(f.props.get('--ccp-visible-top'),'50px');assert.equal(f.modal.isConnected,true);
});
test('cerrar cancela foco pendiente, limpia listeners y devuelve foco sin desplazar el fondo',()=>{
 const f=fixture();f.c.prepararVentanaPagoCuentaCorriente(f.modal);assert.equal(f.viewport.count()+f.win.count(),3);f.c.cerrarPagoCuentaCorriente();
 assert.deepEqual(f.cancelled,[42]);assert.equal(f.viewport.count()+f.win.count(),0);assert.equal(f.modal.isConnected,false);assert.equal(f.restored(),1);assert.equal(f.sync(),1);
 f.viewport.height=844;f.viewport.dispatch('resize');assert.equal(f.props.get('--ccp-visible-height'),'844px');
});
test('sin visualViewport conserva adaptación por resize y limpieza al cerrar',()=>{
 const f=fixture(false);f.c.prepararVentanaPagoCuentaCorriente(f.modal);f.win.innerHeight=430;f.win.dispatch('resize');assert.equal(f.props.get('--ccp-visible-height'),'430px');assert.equal(f.props.get('--ccp-visible-top'),'0px');f.c.cerrarPagoCuentaCorriente();assert.equal(f.win.count(),0);
});
