const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');

assert(index.includes('id="pf-imagen-preview-box" style="width:clamp(160px,22vw,240px);height:clamp(160px,22vw,240px)'),
  'La vista previa del producto debe ser grande y adaptable.');
assert(index.includes('id="pf-imagen-preview-img" style="display:none;width:100%;height:100%;object-fit:contain;background:#fff"'),
  'La imagen debe verse completa, sin recortarse dentro de la vista previa.');

console.log('OK: vista previa de imagen de producto grande, adaptable y sin recorte.');
