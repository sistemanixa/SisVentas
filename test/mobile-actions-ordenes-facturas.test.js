const fs = require('fs');
const assert = require('assert');

const orders = fs.readFileSync('js/modules/purchase-orders.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(orders, /<th>Acciones<\/th>/, 'Órdenes y listas deben identificar la columna de acciones');
assert.match(orders, /aria-label="Ver detalle"/, 'La apertura de una orden debe explicarse como Ver detalle');
assert.match(orders, /sv-mobile-action-label">Ver detalle/, 'La acción debe mostrar texto en móvil');
assert.match(css, /\.sv-card-actions \.sv-grid-actions-original\{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/, 'Las acciones móviles deben compartir una grilla compacta de tres botones por fila');
assert.match(css, /\.sv-card-actions > \.btn,[\s\S]*?max-width:160px!important;[\s\S]*?height:38px!important/, 'Una acción móvil única debe conservar tamaño compacto');
assert.match(app, /ppto-row-action[\s\S]*?<span class="sv-mobile-action-label">'\+titulo\+'<\/span>/, 'Presupuestos debe marcar su etiqueta para que el patrón común no la duplique');
assert.match(css, /#page-gastos #gas-tbl \.sv-grid-actions-original\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/, 'Gastos debe usar la grilla compartida de acciones con texto');
assert.match(css, /#page-productos #prod-tbl \.sv-grid-actions-original\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/, 'Productos debe usar la grilla compartida de acciones con texto');
assert.match(app, /sv-mobile-action-label">Abrir<\/span>/, 'Los proveedores de la ficha de producto deben mostrar Abrir en móvil');
assert.match(app, /sv-mobile-action-label">Quitar<\/span>/, 'Los proveedores de la ficha de producto deben mostrar Quitar en móvil');

console.log('OK móvil: acciones con texto comparten grilla compacta y las acciones únicas no se estiran');
