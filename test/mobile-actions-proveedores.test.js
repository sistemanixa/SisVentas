const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

assert.match(app, /class="btn btn-sm btn-icon" title="WhatsApp"/, 'WhatsApp debe conservar el acceso compacto');
assert.doesNotMatch(app, /title="WhatsApp"[^>]*sv-mobile-action-label/, 'WhatsApp no debe incorporar texto dentro del botón');
assert.match(app, /class="btn btn-sm btn-icon prov-action-btn" title="Abrir web"[^>]*aria-label="Abrir web"/, 'La web del proveedor debe ser una acción identificable');
assert.match(app, /<span class="sv-mobile-action-label">Portal<\/span>/, 'El portal debe mostrar texto en móvil');
assert.match(app, /<span class="sv-mobile-action-label">Editar<\/span>/, 'Editar proveedor debe mostrar texto en móvil');
assert.match(app, /<span class="sv-mobile-action-label">Eliminar<\/span>/, 'Eliminar proveedor debe mostrar texto en móvil');
assert.match(app, /textoMovil\.className = 'sv-mobile-action-label'/, 'Las grillas deben etiquetar sus acciones de forma uniforme');
assert.match(css, /table\.sv-mobile-card-grid \.sv-card-actions \.sv-grid-actions-original\{[\s\S]*?display:flex!important/, 'Las acciones deben permanecer visibles en tarjetas móviles');
assert.match(css, /\.sv-grid-actions-trigger,[\s\S]*?\.sv-grid-actions-menu\{display:none!important\}/, 'Las tarjetas móviles no deben depender del menú de tres puntos');
assert.match(css, /min-height:42px!important/, 'Los botones móviles deben tener una superficie táctil adecuada');

console.log('OK móvil: acciones coherentes y Proveedores conserva WhatsApp compacto');
