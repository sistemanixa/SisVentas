const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.274.js', 'utf8');
const service = fs.readFileSync('cotizador/index.js', 'utf8');

assert(index.includes('app.v2.0.274.js'));
assert(index.includes('version.v2.0.274.js'));
assert(app.includes("VERSION: 'v2.0.274-firebase'"));
assert(app.includes("controlador.abort()"));
assert(app.includes('La consulta superó 45 segundos'));
assert(service.includes('/sites/MLA/search?'));
assert(service.includes('mercado_libre_publicacion_encontrada'));
assert(service.includes('ivaAlicuota:21'));

console.log('v2.0.274: Mercado Libre usa publicación activa y consulta acotada');
