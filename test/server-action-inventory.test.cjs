'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8'),inventory=JSON.parse(read('docs/OPTIMIZACION_SERVIDOR_20261125.json'));
test('el inventario cubre cada ruta literal y familia dinámica del router sin confundir sufijos auxiliares',()=>{
 const source=read('cotizador/index.js'),router=source.slice(source.indexOf('const server = http.createServer')),suffix=new Set(['/anular','/emitir','/opciones','/operacion','/revisar']),literal=[...new Set([...router.matchAll(/['"]((?:\/[a-z][a-z0-9_-]*)+(?:\/[a-z0-9_-]+)*)['"]/g)].map(m=>m[1]))].filter(p=>!suffix.has(p));
 const names=new Set(inventory.routes.map(r=>r.route));assert.equal(names.size,inventory.routes.length);for(const p of literal)assert(names.has(p),'Ruta nueva sin inventario: '+p);
 for(const d of ['ventas','presupuestos'])for(const tail of ['','/opciones','/reasignar','/preparar','/registro/:id'])assert(names.has('/comerciales/'+d+tail));
 for(const d of ['ventas','pagos','ordenes_trabajo'])assert(names.has('/commercial/dashboard/'+d+'/actividad-v2'));
 assert(names.has('/privado/finanzas/documentos/:hash'));assert(names.has('/'));
 for(const r of inventory.routes){assert(inventory.groups[r.group],r.route);assert(r.callers.length,r.route);assert(r.decision,r.route);assert(r.runtimeStatus.includes('source-inspected'));}
});
test('los comandos privados/proyecto y las exportaciones condicionales no desaparecen bajo una sola ruta genérica',()=>{
 for(const [file,name]of [['cotizador/projects-model.js','projects'],['cotizador/private-finance-model.js','privateFinance']]){const kinds=[...new Set([...read(file).matchAll(/command\.type\s*===\s*'([^']+)'/g)].map(m=>m[1]))];assert.deepEqual(inventory.commands[name],kinds);}
 const extra=inventory.otherServices;for(const action of ['sisventasCostGuard','sisventasCommissionEventForward','correoSolicitudConfirmada','correoSolicitudDeclinada'])assert(extra.some(r=>r.action===action),action);
 const push=extra.filter(r=>r.service==='push-experiment');assert.equal(push.length,8);assert(push.every(r=>r.runtimeStatus.includes('conditional')));
 assert.equal(inventory.routes.filter(r=>r.decision==='direct-firebase-media-only').length,1);assert(inventory.routes.filter(r=>r.method==='POST').every(r=>r.decision!=='direct-firebase-media-only'));
});
