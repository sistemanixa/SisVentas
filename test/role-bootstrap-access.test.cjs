'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/app.v3.10.32.js','utf8');
function extract(name){const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}',start)+2);}
test('Roles vacíos o desconocidos no reciben acceso por defecto, aun con override',()=>{
 for(const role of ['', 'inventado', 'distribuidora','compras_paraguay']){
  const window={currentRole:role,PERMISOS_ROLES:{[role]:{bloqueados:[]}}};
  vm.runInNewContext(fs.readFileSync('js/core/access-control.js','utf8'),{window});
  for(const page of ['dashboard','clientes','venta','configuracion'])assert.equal(window.SisVentas.Access.canAccess(page),false);
 }
});
test('Roles internos conservan normalización, permisos y bloqueos configurados',()=>{
 for(const role of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico','técnico','administrador']){
  const window={currentRole:role};vm.runInNewContext(fs.readFileSync('js/core/access-control.js','utf8'),{window});
  const config={[window.SisVentas.Access.current()]:{bloqueados:['configuracion']}};
  assert.equal(window.SisVentas.Access.canAccess('dashboard',config),true);
  assert.equal(window.SisVentas.Access.canAccess('configuracion',config),false);
 }
});
test('Una ruta bloqueada no abre listeners ni consulta sus dependencias',()=>{
 const ctx={_svPaginaDesdeRuta:()=> 'venta',permisoModulo:()=>false};
 vm.runInNewContext(extract('svCargarDatosDePaginaActual'),ctx);
 ctx.svCargarDatosDePaginaActual(); // Las funciones de carga ni siquiera están disponibles.
});
test('Arranque rechaza roles desconocidos antes de suscribir datos comerciales',()=>{
 for(const role of ['', 'inventado','distribuidora','compras_paraguay']){
  const ctx={rolActualNormalizado:()=>role};vm.runInNewContext(extract('fbCargarTodo'),ctx);
  assert.equal(ctx.fbCargarTodo(),false);
 }
});
