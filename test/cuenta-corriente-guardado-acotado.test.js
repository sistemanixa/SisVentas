const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('./helpers/active-app').readActiveApp().source;

test('Cuenta Corriente delega en el mismo núcleo canónico que Cobranzas',()=>{
 const desde=s.indexOf('async function _ccGuardarPagoAcotado(');
 const hasta=s.indexOf('async function confirmarPagoCuentaCorriente(',desde);
 const f=s.slice(desde,hasta);
 assert.match(f,/return registrarCobrosCanonicos\(/);
 assert.match(f,/origen:'cuenta_corriente'/);
 assert.match(f,/solicitudes:solicitudes/);
 assert.match(f,/comprobante:comprobante/);
});

test('el núcleo usa un único grupo, comprobante canónico y bloqueo recuperable',()=>{
 assert.match(s,/updates\['cobros_grupos\/' \+ grupo\] = cabecera/);
 assert.match(s,/updates\['cobros_adjuntos\/' \+ adjuntoKey\] = opciones\.comprobante/);
 assert.match(s,/ref\('control_cobros'\)/);
 assert.match(s,/ahoraLock - \(Number\(actual\.ts\) \|\| 0\) > 120000/);
 assert.doesNotMatch(s,/updates\['cobros_cuenta_adjuntos/);
});
