const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.270.js', 'utf8');

assert(index.includes('app.v2.0.270.js'));
assert(index.includes('version.v2.0.270.js'));
assert(index.includes("abrirListadoActualizadorPrecios('vinculados')"));
assert(index.includes("abrirListadoActualizadorPrecios('pendientes')"));
assert(index.includes("abrirListadoActualizadorPrecios('vigentes')"));
assert(index.includes('role="button" tabindex="0"'));
assert(app.includes('function productosParaListadoActualizadorPrecios(tipo)'));
assert(app.includes('function filtrarListadoActualizadorPrecios(texto)'));
assert(app.includes('function abrirProductoDesdeListadoActualizador(fbKey)'));
assert(app.includes("pagina:'actualizadorprecios', filtroActualizador:tipo"));
assert(app.includes("VERSION: 'v2.0.270-firebase'"));

console.log('v2.0.270: KPIs del actualizador navegables y filtrados');
