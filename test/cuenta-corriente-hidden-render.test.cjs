const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const src=require('./helpers/active-app').readActiveApp().source;
test('Cuenta corriente oculta no escribe filas; al abrir usa mapa vigente y conserva filtro',()=>{
 let active=false,writes=0,html='',filtered='';const table={set innerHTML(v){writes++;html=v}};
 const c={window:{_ccMapActual:{cliente:{nombre:'Cliente',total:100,cobrado:20,ultimoPago:'—'}}},document:{getElementById:id=>id==='cc-tbody'?table:id==='cc-buscador'?{value:'Cliente'}:null},_svEsPaginaActiva:()=>active,escapeHTML:String,_mostrarFecha:String,setTimeout:fn=>fn(),buscarCC:x=>filtered=x};vm.createContext(c);
 const a=src.indexOf('function renderTablaCuentaCorriente('),b=src.indexOf('function fbCargarPagos()',a);vm.runInContext(src.slice(a,b),c);
 c.renderTablaCuentaCorriente();assert.equal(writes,0);c.window._ccMapActual.cliente.cobrado=70;active=true;c.renderTablaCuentaCorriente();assert.equal(writes,1);assert.match(html,/data-saldo="30"/);assert.equal(filtered,'Cliente');
 c.window._ccMapActual.cliente.cobrado=100;c.renderTablaCuentaCorriente();assert.match(html,/Al día/);assert.equal(writes,2);
 assert.match(src,/fbCargarPagos\(\); renderTablaCuentaCorriente\(\)/);
});
