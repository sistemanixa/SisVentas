const fs = require('fs');
const assert = require('assert');

const { readActiveApp } = require('./helpers/active-app');
const activo = readActiveApp();
const app = activo.source;
const html = activo.index;

assert.match(html, /id="movi-modal-titulo"/, 'El modal debe tener un título identificable');
assert.match(html, /id="movi-tipo-wrap"><label>Tipo<\/label>\s*<select id="movi-tipo"/, 'El contenedor ocultable debe pertenecer al selector del movimiento');
assert.doesNotMatch(html, /id="movi-tipo-wrap"><label>Tipo<\/label>\s*<select id="g-tipo"/, 'El formulario de Gastos no debe reutilizar el identificador del modal');
assert.match(app, /function abrirAdelantoEmpleadoDesdeEmpleados\(empFbKey\)/, 'Debe existir el acceso directo al adelanto');
assert.match(app, /abrirNuevoMovEmp\('adelanto', \{ soloAdelanto: true \}\)/, 'Debe reutilizar el movimiento en modo exclusivo de adelanto');
assert.match(app, /modal\.dataset\.modo = soloAdelanto \? 'adelanto-directo' : 'movimiento-general'/, 'El modal compartido debe distinguir el flujo específico de adelantos');
assert.match(app, /if \(tipoWrap\) tipoWrap\.style\.display = soloAdelanto \? 'none' : ''/, 'El adelanto directo no debe permitir cambiar el tipo');
assert.match(app, /if \(periodicoWrap\) periodicoWrap\.style\.display = \(esAdmin && !soloAdelanto\) \? '' : 'none'/, 'El adelanto directo no debe ofrecer repetición mensual');
assert.match(app, /soloAdelanto \? '<i class="ti ti-check"><\/i> Registrar adelanto'/, 'La acción final debe nombrar específicamente el adelanto');
assert.match(app, /estado\.value = 'pagado';[\s\S]*?onMoviEstadoChange\(\)/, 'El adelanto entregado debe solicitar el medio de pago');
assert.match(html, /onclick="abrirModalAdelantoGeneral\(\)"/, 'Empleados debe ofrecer una acción general para cargar adelantos');
assert.doesNotMatch(app, /title="Cargar adelanto"/, 'La grilla no debe repetir una acción por cada empleado');
assert.match(app, /> Cargar adelanto<\/button>/, 'El legajo debe ofrecer una acción explícita');
assert.doesNotMatch(app, /293[.\s]?100/, 'El monto informado por el usuario no debe quedar fijo en el código');
assert.doesNotMatch(app, /osmar tello/i, 'El empleado informado por el usuario no debe quedar fijo en el código');
assert.match(html, /id="nav-label-ctaemp">Cuentas de empleados</, 'La cuenta del personal debe figurar como módulo separado');
assert.match(html, /id="ctaemp-page-heading"[^>]*>Cuentas de empleados</, 'El módulo debe tener un encabezado propio');
assert.match(app, /gestiona(?:CuentasEmpleados)?\s*\?\s*'Cuentas de empleados'\s*:\s*'Mi cuenta'/, 'Los empleados deben conservar su acceso personal');
assert.match(app, /var gestiona = window\.tienePermiso\('empleados\.verCuentas'\)/, 'La vista completa debe depender del permiso vigente');

console.log('OK empleados: carga directa de adelantos');
