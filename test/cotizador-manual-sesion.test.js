const fs = require('fs');
const assert = require('assert').strict;

const source = fs.readFileSync('cotizador/index.js', 'utf8');

assert(source.includes('const SESION_PROVEEDOR_TTL_MS = 15 * 60 * 1000'), 'La sesión manual debe tener vencimiento corto.');
assert(source.includes('const sesionesProveedorManual = new Map()'), 'Las sesiones deben mantenerse sólo en memoria del servidor.');
assert(source.includes("addTrace('sesion_reutilizada'"), 'El diagnóstico debe indicar cuándo evitó un nuevo login.');
assert(source.includes("addTrace('sesion_cache_expirada'"), 'Una sesión rechazada debe invalidarse y renovarse.');
assert(source.includes('firmaCredencialesProveedor(usuario, password)'), 'Cambiar credenciales debe invalidar la sesión anterior.');
assert(source.includes('storageState:sesionGuardada.storageState'), 'La cotización siguiente debe reutilizar cookies autenticadas.');
assert(source.includes('proveedor, proveedorKey, url'), 'La sesión debe aislarse por proveedor, no compartirse globalmente.');

console.log('OK: el cotizador manual reutiliza sesiones breves, aisladas y renovables.');
