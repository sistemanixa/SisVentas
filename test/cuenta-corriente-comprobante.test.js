const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const s=require('./helpers/active-app').readActiveApp().source;
function context(){const c={FileReader:class {readAsDataURL(){this.result='data:application/pdf;base64,JVBERg==';this.onload();}}};vm.createContext(c);vm.runInContext(s.slice(s.indexOf('function _ccLeerComprobante('),s.indexOf('function abrirPagoCuentaCorriente(')),c);return c;}
test('adjunto opcional, PDF legible y rechazos por tamaño o tipo',async()=>{
 const c=context();assert.equal(await c._ccLeerComprobante(null),null);
 const a=await c._ccLeerComprobante({name:'pago.pdf',type:'application/pdf',size:100});assert.equal(a.nombre,'pago.pdf');assert.match(a.data,/^data:application\/pdf/);
 await assert.rejects(c._ccLeerComprobante({type:'application/pdf',size:900001}),/900 KB/);
 await assert.rejects(c._ccLeerComprobante({type:'text/html',size:100}),/imagen/);
});
test('archivo se guarda una sola vez junto a las imputaciones',()=>{
 const f=s.slice(s.indexOf('async function confirmarPagoCuentaCorriente('),s.indexOf('function cargosActualizarModalidad('));
 assert.match(f,/await _ccLeerComprobante/);
 assert.match(f,/s\.pago\.comprobanteCuenta = true/);
 assert.match(f,/await _ccGuardarPagoAcotado\(grupo, solicitudes, cabecera, comprobanteCuenta\)/);
 assert.match(s,/updates\['cobros_cuenta_adjuntos\/\'\+grupo\] = comprobante/);
 assert.match(s,/_ccBotonesComprobantes\(m\.comprobantes\)/);
});
