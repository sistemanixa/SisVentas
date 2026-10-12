const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const src=require('./helpers/active-app').readActiveApp().source;
test('Cuenta corriente aplica búsqueda y estado en la misma ejecución del render, sin temporizador',()=>{
 const events=[];let active=true;const tbody={set innerHTML(html){events.push('tabla');assert.match(html,/Yago/);}};
 const context={window:{_ccMapActual:{yago:{nombre:'Yago',total:100,cobrado:50,ultimoPago:'—'}}},document:{getElementById:id=>id==='cc-tbody'?tbody:id==='cc-buscador'?{value:'yago'}:null},_svEsPaginaActiva:()=>active,escapeHTML:String,_mostrarFecha:String,buscarCC:q=>{events.push('filtro');assert.equal(q,'yago');},setTimeout:()=>assert.fail('No debe aplazar el filtro')};
 vm.createContext(context);const a=src.indexOf('function renderTablaCuentaCorriente(lista)'),b=src.indexOf('var _cobPaginaActual=',a);vm.runInContext(src.slice(a,b),context);
 context.renderTablaCuentaCorriente();assert.deepEqual(events,['tabla','filtro']);active=false;context.renderTablaCuentaCorriente();assert.equal(events.length,2);
});
