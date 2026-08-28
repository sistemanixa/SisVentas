const fs = require('fs');
const assert = require('assert');

const launch = fs.readFileSync('js/modules/v3-launch.js', 'utf8');
const app = fs.readFileSync('js/app.v3.0.1.js', 'utf8');

assert.match(launch, /window\.svBienvenidaV3Pendiente\s*=\s*bienvenidaPendiente/,
  'el lanzamiento debe exponer si la bienvenida sigue pendiente');
assert.match(launch, /VERSION_LANZAMIENTO = 'v3\.0\.0'/,
  'el cierre de sesión forzado debe continuar ligado solo al salto mayor');
assert.match(launch, /Number\(partesBienvenida\[1\]\) <= 20/,
  'la campaña de bienvenida debe permanecer durante los primeros veinte parches');
assert.match(launch, /localStorage\.setItem\(claveBienvenida\(\), VERSION_BIENVENIDA\)/,
  'cada parche de la campaña debe registrar su propia bienvenida');
assert.match(launch, /sisventas:v3-welcome-closed/,
  'la bienvenida debe avisar cuando terminó de cerrarse');
assert.match(app, /window\.svBienvenidaV3Pendiente\(\)\) return;/,
  'Novedades no debe abrirse mientras la bienvenida esté pendiente');
assert.match(app, /addEventListener\('sisventas:v3-welcome-closed'[\s\S]*_mostrarNovedadActualizacionPendiente/,
  'Novedades debe reintentarse después de cerrar la bienvenida');

console.log('OK: bienvenida V3 antes de Novedades');
