const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function node(id,z){const classes=new Set();return {id,isConnected:true,dataset:{},style:{display:'flex',visibility:'visible',position:'fixed',zIndex:String(z)},getClientRects:()=>[{}],contains:()=>false,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)}};}
test('ventana activa bloquea fondo; diálogo superior bloquea también la ventana inferior',()=>{
 const window=node('modal-actualizador-precios',10020),dialog=node('confirmacion',1000002),body=new Set();let candidates=[window];
 const c=load({_svModalSyncPendiente:false,getComputedStyle:el=>el.style,requestAnimationFrame:fn=>fn(),document:{querySelectorAll:()=>candidates,body:{classList:{contains:name=>body.has(name),toggle:(name,on)=>on?body.add(name):body.delete(name)}}}},['_svModalEsVisible','svSincronizarPilaModales']);
 c.svSincronizarPilaModales();assert.ok(body.has('sv-modal-stack-open'));
 candidates=[window,dialog];c.svSincronizarPilaModales();assert.ok(window.classList.contains('sv-modal-underlay'));assert.equal(dialog.classList.contains('sv-modal-underlay'),false);
 window.dataset.minimizado='1';candidates=[window];c.svSincronizarPilaModales();assert.equal(body.has('sv-modal-stack-open'),false);
});

test('una pila sin cambios no vuelve a escribir clases ni dispara el observador indefinidamente',()=>{
 let writes=0;const lower=node('modal-base',20),upper=node('modal-top',30),body=new Set();
 for(const el of [lower,upper]){const original=el.classList;el.classList={contains:original.contains,add:c=>{writes++;original.add(c);},remove:c=>{writes++;original.remove(c);}};}
 const c=load({_svModalSyncPendiente:false,getComputedStyle:el=>el.style,requestAnimationFrame:fn=>fn(),document:{querySelectorAll:()=>[lower,upper],body:{classList:{contains:n=>body.has(n),toggle:(n,on)=>{writes++;on?body.add(n):body.delete(n);}}}}},['_svModalEsVisible','svSincronizarPilaModales']);
 c.svSincronizarPilaModales();writes=0;for(let i=0;i<20;i++)c.svSincronizarPilaModales();assert.equal(writes,0);
});

test('lector nativo sobre buscador conserva los clics aunque su z-index sea auto',()=>{
 const search=node('modal-busq-avanz',10000),scanner=node('lector',0),body=new Set();
 scanner.style.zIndex='auto';scanner.matches=selector=>selector==='dialog:modal';let candidates=[search,scanner];
 const c=load({_svModalSyncPendiente:false,getComputedStyle:el=>el.style,requestAnimationFrame:fn=>fn(),document:{querySelectorAll:()=>candidates,body:{classList:{contains:n=>body.has(n),toggle:(n,on)=>on?body.add(n):body.delete(n)}}}},['_svModalEsVisible','svSincronizarPilaModales']);
 c.svSincronizarPilaModales();assert.equal(scanner.classList.contains('sv-modal-underlay'),false);assert.ok(search.classList.contains('sv-modal-underlay'));
 scanner.isConnected=false;candidates=[search];c.svSincronizarPilaModales();assert.equal(search.classList.contains('sv-modal-underlay'),false);assert.ok(body.has('sv-modal-stack-open'));
 search.isConnected=false;candidates=[];c.svSincronizarPilaModales();assert.equal(body.has('sv-modal-stack-open'),false);
});

test('role dialog en el overlay no convierte todo el panel en una cabecera',()=>{
 const panel={};const overlay={matches:s=>s==='[role="dialog"]',querySelector:()=>panel};
 const c=load({},['svModalPanelDesdeContenedor']);assert.equal(c.svModalPanelDesdeContenedor(overlay),panel);
 const realPanel={matches:s=>s==='[role="dialog"]',querySelector:()=>null};assert.equal(c.svModalPanelDesdeContenedor(realPanel),realPanel);
});
test('restaurar actualizador vuelve a bloquear y recuperar flex; minimizar libera la pantalla',()=>{
 const modal=node('modal-actualizador-precios',10020),panel={style:{}},mini={style:{}};let sync=0;
 const elements={'modal-actualizador-precios':modal,'actualizador-precios-panel':panel,'actualizador-precios-minimizado':mini};
 const c=load({document:{getElementById:id=>elements[id]},svSincronizarPilaModales:()=>sync++},['minimizarActualizadorMasivoPrecios','restaurarActualizadorMasivoPrecios']);
 c.minimizarActualizadorMasivoPrecios();assert.equal(modal.dataset.minimizado,'1');assert.equal(panel.style.display,'none');assert.equal(mini.style.display,'flex');
 c.restaurarActualizadorMasivoPrecios();assert.equal(modal.dataset.minimizado,'0');assert.equal(modal.dataset.noBloqueante,'0');assert.equal(panel.style.display,'flex');assert.equal(mini.style.display,'none');assert.equal(sync,2);
});
test('ventana oculta, eliminada o minimizada nunca bloquea el fondo',()=>{
 const c=load({getComputedStyle:el=>el.style},['_svModalEsVisible']);
 const el=node('modal-test',1);assert.equal(c._svModalEsVisible(el),true);el.dataset.minimizado='1';assert.equal(c._svModalEsVisible(el),false);delete el.dataset.minimizado;el.style.display='none';assert.equal(c._svModalEsVisible(el),false);el.style.display='flex';el.isConnected=false;assert.equal(c._svModalEsVisible(el),false);
});
