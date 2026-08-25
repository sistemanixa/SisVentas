const fs=require('fs');
const assert=require('assert');
const app=fs.readFileSync('js/app.js','utf8');
const inicio=app.indexOf('// Últimas ventas del administrativo');
const fin=app.indexOf('function verDetalleVentaDesdeId',inicio);
const bloque=app.slice(inicio,fin);
assert.match(bloque,/title="Ver detalle completo" aria-label="Ver detalle completo"/);
console.log('dashboard-accesibilidad-acciones.test.js OK');
