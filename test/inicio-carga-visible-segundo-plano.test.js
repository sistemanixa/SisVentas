const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

if (!index.includes('id="screen-loading"')) throw new Error('Falta la pantalla de carga inicial');
if (!index.includes('id="loading-msg"')) throw new Error('Falta el estado visible de carga');
if (!app.includes('svEsperarCargaInicial(3200)')) throw new Error('La pantalla se oculta sin esperar los datos principales');
if (!app.includes("msg.textContent = 'Cargando datos principales...'")) throw new Error('Falta explicar qué está cargando');
if (!app.includes('svProgramarTrabajoFondo(function()')) throw new Error('Los módulos secundarios no se distribuyen en segundo plano');
if (app.includes("setTimeout(function(){\n    if (loadingEl) {\n      loadingEl.style.display = 'none';") && app.includes('modoIntroRecarga ? 280 : 120')) {
  throw new Error('Sigue activo el cierre prematuro de la pantalla de carga');
}

console.log('OK inicio mantiene feedback visible y difiere módulos secundarios');
