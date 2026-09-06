const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('js/app.v3.3.15.js','utf8');
const inicio=app.indexOf('function resumenProductosProveedorRegistrado(');
const fin=app.indexOf('\nfunction ',inicio+1);
test('resume productos únicos, URLs faltantes y vigencia sin mezclar proveedores',()=>{
  const fila=(url,extras={})=>({proveedorKey:'casa',nombre:'Casa Blanco',url,...extras});
  const ctx={URL,prodData:{a:{proveedores:[fila('https://tienda.com/producto',{vigente:true}),fila('https://tienda.com/producto')]},b:{proveedores:[fila('')]},c:{proveedores:[fila('https://otro.com/producto')]},d:{proveedores:[fila('https://tienda.com/otro')]},e:{proveedores:[fila('',{proveedorKey:'otro'})]},f:{activo:false,proveedores:[fila('')]}},esProductoManoDeObra:()=>false,proveedoresVinculadosProducto:p=>p.proveedores,estadoVigenciaPrecioProveedor:(p,pv)=>({vigente:!!pv.vigente})};ctx.window=ctx;
  vm.runInNewContext(app.slice(inicio,fin),ctx);
  const r=ctx.resumenProductosProveedorRegistrado({fbKey:'casa',nombre:'Casa Blanco',web:'https://tienda.com'});
  assert.deepEqual(JSON.parse(JSON.stringify(r)),{total:4,pendientes:3,vigentes:1,sinUrl:2});
});
