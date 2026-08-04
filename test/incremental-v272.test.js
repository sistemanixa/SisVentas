const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.272.js', 'utf8');
const service = fs.readFileSync('cotizador/index.js', 'utf8');

assert(index.includes('app.v2.0.272.js'));
assert(index.includes('version.v2.0.272.js'));
assert(app.includes("VERSION: 'v2.0.272-firebase'"));
assert(app.includes('function alicuotaIvaProveedorProducto(pv, ivaProducto)'));
assert(app.includes('function factorIvaProveedorProducto(pv, ivaProducto)'));
assert(app.includes('ivaAlicuota: r.ivaAlicuota'));
assert(app.includes('cambios.iva = parseFloat(resultado.ivaAlicuota)'));
assert(service.includes('function extraerCondicionIva(texto)'));
assert(service.includes('[0-9][0-9.,\\s]*'));

console.log('v2.0.272: formatos de precio e IVA generalizados por publicación');
