const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
test('eliminar cliente rechaza otros roles incluso con permiso de acción delegado',async()=>{
 const messages=[];const c=load({esAdmin:()=>false,window:{tienePermiso:()=>true},notify:m=>messages.push(m)},['eliminarCliente']);
 await c.eliminarCliente(null);assert.equal(messages.length,1);assert.match(messages[0],/administrador/);
});
test('cambiar estado rechaza roles que no sean administrador o administrativo',()=>{
 const messages=[];const c=load({esAdminOAdministrativo:()=>false,window:{tienePermiso:()=>true},notify:m=>messages.push(m)},['toggleActivoCliente']);
 c.toggleActivoCliente('prueba');assert.equal(messages.length,1);
});
test('abrir Pagos prepara su tabla después de hacer visible la pestaña',()=>{
 let active=false,calls=0;const sec={classList:{add:()=>{active=true},remove:()=>{active=false}}};
 const c=load({document:{querySelectorAll:()=>[sec],getElementById:id=>id==='hist-pagos'?sec:null},window:{SisVentas:{prepareResizablePage:el=>{assert.equal(el,sec);assert.equal(active,true);calls++;}}}},['switchHistTab']);
 c.switchHistTab('pagos',null);assert.equal(calls,1);c.switchHistTab('pagos',null);assert.equal(calls,2);
});
