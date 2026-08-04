const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const moduleCode = fs.readFileSync('js/modules/notifications.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.260.js', 'utf8');

assert(index.includes('notifications.js?v=2.0.260'), 'Debe cargar el modulo corregido sin cache anterior');
assert(moduleCode.includes("estado.estado==='pospuesta'&&estado.reaparece&&estado.reaparece<=svToday()"), 'La posposicion debe vencer al llegar su fecha');
assert(moduleCode.includes("Object.assign({},estado,{estado:'',reaparecida:true})"), 'Una notificacion reaparecida debe volver a ser pendiente');
assert(app.includes("VERSION: 'v2.0.260-firebase'"), 'La aplicacion debe publicar v260');

console.log('v2.0.260: recordatorios vencidos vuelven a pendientes y no desaparecen al sincronizar');
