const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const source = fs.readFileSync('js/modules/purchase-orders.js', 'utf8');

test('las grillas internas de compras muestran miniaturas de productos', () => {
  assert.match(source, /function productThumbnail\(item, product\)/);
  assert.match(source, /product\.imagenUrl \|\| product\.imagen \|\| product\.imageUrl \|\| product\.foto/);
  assert.match(source, /loading="lazy"/);
  assert.match(source, /var thumbnail = productThumbnail\(item, product\);/);
  assert.match(source, /oc-product-thumb-fallback/);
});
