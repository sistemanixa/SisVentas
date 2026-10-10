const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
test('mover campos a ficha conserva firma; editar un campo sí cambia firma',()=>{
 const general={id:'nombre',value:'Producto'},provider={id:'precio',value:'100'};let moved=false;
 const c=load({prodProveedoresActuales:[{precio:100}],document:{querySelectorAll:selector=>moved?(selector.includes('#pd-proveedores-box')?[provider,general]:[general]):[general,provider]}},['firmaNavegacionEditorProducto']);
 const original=c.firmaNavegacionEditorProducto();moved=true;assert.equal(c.firmaNavegacionEditorProducto(),original);
 provider.value='200';assert.notEqual(c.firmaNavegacionEditorProducto(),original);
});
test('snapshot de ficha no destruye editor activo ni botones de guardado',()=>{
 let touched=0;const c=load({_proveedoresEnFicha:{id:'p'},notify(){touched++;},document:{getElementById(){throw Error('No debe redibujar');}}},['verProducto']);
 c.verProducto('p');assert.equal(touched,0);c.verProducto('otro');assert.equal(touched,1);
});
test('actualización automática no compite con borrador abierto',async()=>{
 let warns=0;const c=load({_proveedoresEnFicha:{id:'p'},notify(){warns++;}},['_svCargaOperacion_actualizarProveedoresDesdeFicha']);
 await c._svCargaOperacion_actualizarProveedoresDesdeFicha();assert.equal(warns,1);
});
test('fila vacía agregada al abrir no genera cambios; proveedor con datos sí',()=>{
 const c=load({prodProveedoresActuales:[{nombre:'Existente',precio:100}],document:{querySelectorAll:()=>[]}},['firmaNavegacionEditorProducto']);
 const base=c.firmaNavegacionEditorProducto();c.prodProveedoresActuales.push({nombre:'',precio:0,actualizado:'2026-10-10'});
 assert.equal(c.firmaNavegacionEditorProducto(),base);c.prodProveedoresActuales[1].nombre='Nuevo';assert.notEqual(c.firmaNavegacionEditorProducto(),base);
});
