const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.v3.1.3.js', 'utf8');
const inicio = app.indexOf('function spBuscarCliente(val)');
const fin = app.indexOf('\nfunction spSelCliente', inicio);
assert(inicio >= 0 && fin > inicio, 'Debe existir el buscador de clientes de Reclamos');
const buscador = app.slice(inicio, fin);

assert(buscador.includes('c.dir,c.direccion,c.domicilio,c.localidad'), 'Debe buscar también por domicilio');
assert(buscador.includes('terminos.every'), 'Todos los términos escritos deben aplicarse sobre el mismo cliente');
assert(buscador.includes('.slice(0,20)'), 'No debe ocultar coincidencias relevantes con el antiguo límite de seis');
assert(buscador.includes("ti ti-map-pin"), 'Cada resultado debe identificar visualmente su domicilio');
assert(buscador.includes("'Sin dirección cargada'"), 'Debe informar cuando un domicilio realmente no tiene dirección');
assert(buscador.indexOf('.sort(') < buscador.indexOf('.slice(0,20)'), 'Debe ordenar por relevancia antes de limitar resultados');

console.log('OK: Reclamos busca por nombre y domicilio y muestra la sede seleccionable.');
