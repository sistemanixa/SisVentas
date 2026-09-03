const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v3.3.9.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

assert(index.includes('id="usuarios-uso-periodo"'), 'Usuarios debe permitir elegir el período.');
assert(index.includes('id="usuarios-uso-grafico"'), 'Usuarios debe incluir el gráfico comparativo.');
assert(app.includes("'sisventas/uso_usuarios/' + estado.dia"), 'La medición debe persistirse por día y sesión.');
assert(app.includes("(ahora - estado.ultimaInteraccion) <= 120000"), 'El uso activo debe depender de interacción reciente.');
assert(app.includes("document.visibilityState === 'visible'"), 'Una pestaña oculta no debe contarse como uso activo.');
assert(app.includes('activoMs: Math.round(estado.activoMs)'), 'Debe guardar tiempo activo.');
assert(app.includes('inactivoMs: Math.round(estado.inactivoMs)'), 'Debe guardar tiempo sin interacción.');
assert(css.includes('.usuarios-uso-barra.activo') && css.includes('.usuarios-uso-barra.inactivo'), 'El gráfico debe diferenciar ambos estados.');

console.log('OK: medición y gráfico de tiempo activo/sin interacción por usuario.');
