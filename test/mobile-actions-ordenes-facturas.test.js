const fs = require('fs');
const assert = require('assert');

const orders = fs.readFileSync('js/modules/purchase-orders.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

assert.match(orders, /<th>Acciones<\/th>/, 'Órdenes y listas deben identificar la columna de acciones');
assert.match(orders, /aria-label="Ver detalle"/, 'La apertura de una orden debe explicarse como Ver detalle');
assert.match(orders, /sv-mobile-action-label">Ver detalle/, 'La acción debe mostrar texto en móvil');
assert.match(css, /\.sv-card-actions > \.btn,[\s\S]*?height:42px!important;[\s\S]*?flex:0 0 42px!important/, 'Una acción móvil única no debe estirarse verticalmente');

console.log('OK móvil: Órdenes explica Ver detalle y Facturas conserva botones compactos');
