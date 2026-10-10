const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const src=require('./helpers/active-app').readActiveApp().source;
test('Cobranzas solo construye filas visible, conserva historial completo y búsqueda al volver',()=>{
 let active=false,writes=0,html='',filter='';const tbody={set innerHTML(v){writes++;html=v}};
 const c={window:{_historialPagosCompleto:[]},document:{getElementById:id=>id==='pagos-tbody'?tbody:id==='cob-buscador'?{value:'Cliente'}:null},_svEsPaginaActiva:()=>active,escapeHTML:String,_mostrarFecha:String,formatoMedioPago:String,nombreClienteVigente:p=>p.cliente,_cobroMontoHistorialHTML:()=>'$100',_cobroSaldoRestanteHistorialHTML:()=>'$0',_cobroTieneComprobante:()=>false,filtrarCobros:q=>filter=q};vm.createContext(c);
 const a=src.indexOf('function renderHistorialCobranzas()'),b=src.indexOf('function fbCargarPagos()',a);vm.runInContext(src.slice(a,b),c);c.renderHistorialCobranzas();assert.equal(writes,0);
 c.window._historialPagosCompleto=Array.from({length:25},(_,i)=>({fbKey:String(i),cliente:'Cliente '+i,fecha:'2026-10-10',monto:100,anulado:i===0}));active=true;c.renderHistorialCobranzas();assert.equal(writes,1);assert.equal((html.match(/<tr /g)||[]).length,20);assert.equal(c.window._historialPagosActual.length,25);assert.match(html,/ANULADO/);assert.equal(filter,'Cliente');
 active=false;c.renderHistorialCobranzas();assert.equal(writes,1);assert.match(src,/fbCargarPagos\(\); renderHistorialCobranzas\(\)/);
});
