const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.3.2.js'), 'utf8');

function exigir(fragmento, mensaje) {
  if (!app.includes(fragmento)) throw new Error(mensaje);
}

exigir("var _SV_HISTORIAL_PAGINAS_KEY = 'sisventas:historial-paginas'", 'Falta la clave del historial por pestaña');
exigir('sessionStorage.setItem(_SV_HISTORIAL_PAGINAS_KEY', 'El historial no se conserva al navegar');
exigir("sessionStorage.getItem(_SV_HISTORIAL_PAGINAS_KEY)", 'El historial no se restaura después de recargar');
exigir('anteriorUrl.origin === window.location.origin', 'El retroceso recuperado podría salir fuera de SisVentas');
exigir('_svGuardarHistorialPaginas();\n    var actual', 'Escape no persiste la extracción de la pantalla anterior');

console.log('OK escape conserva un retroceso interno y seguro después de recargar');
