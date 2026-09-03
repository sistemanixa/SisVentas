const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v3.3.10.js'), 'utf8');

if (!app.includes("precio > 0 && !(r.identidad && r.identidad.ok)")) {
  throw new Error('Una identidad automática concluyente no debe pedir confirmación humana');
}

if (!app.includes('requiereConfirmacionIdentidad')) {
  throw new Error('Debe conservarse la revisión humana para identidades dudosas');
}

console.log('OK: la UI sólo consulta cuando la identidad automática no es concluyente.');
