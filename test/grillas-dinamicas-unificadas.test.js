const fs = require('fs');
const path = require('path');

const resize = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'resizable-tables.js'), 'utf8');
const compras = fs.readFileSync(path.join(__dirname, '..', 'js', 'modules', 'purchase-orders.js'), 'utf8');

function exigir(origen, fragmento, mensaje) {
  if (!origen.includes(fragmento)) throw new Error(mensaje);
}

exigir(resize, "Array.from(searchRoot.querySelectorAll('table')).find", 'El botón de columnas no busca la tabla dinámica visible');
exigir(resize, 'function isTableVisible', 'Falta detectar qué tabla dinámica está visible');
exigir(resize, 'visibleTable || btn._svFallbackTable || table', 'Falta respaldo seguro al cambiar una tabla dinámica');
exigir(resize, 'function ensureActionsColumnPolicy', 'Acciones no posee una política común de ancho');
exigir(resize, 'function actionContainersInCell', 'La alineación de acciones sigue limitada a módulos concretos');
exigir(compras, 'id="oc2-orders-table" data-sv-column-key="ordenes-compra-principal"', 'Órdenes de compra no tiene identidad estable');
exigir(compras, 'id="oc2-lists-table" data-sv-column-key="ordenes-compra-listas"', 'Listas de compra no tiene identidad estable');

console.log('OK grillas dinámicas usan editor, alineación y acciones comunes');
