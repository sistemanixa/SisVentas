const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('js/app.v3.5.6.js','utf8');
function extract(name){const start=src.indexOf('function '+name+'(');return src.slice(start,src.indexOf('\nfunction ',start+1));}
const ctx={Date,proveedoresVinculadosProducto:p=>p.proveedores};vm.createContext(ctx);
vm.runInContext(extract('datosActualizadosProductoBiosegur'),ctx);
const original={proveedores:[{precio:100,actualizadoEn:123,favorito:true}],precioCompra:100};
const result=ctx.datosActualizadosProductoBiosegur({producto:original,proveedorIdx:0},{precio:999,disponibilidadProveedor:'sin_stock'});
assert.equal(result.proveedores[0].precio,100);
assert.equal(result.proveedores[0].actualizadoEn,123);
assert.equal(result.proveedores[0].disponibilidadProveedor,'sin_stock');
assert.deepEqual(Object.keys(result),['proveedores']);
assert.equal(original.proveedores[0].disponibilidadProveedor,undefined);
vm.runInContext(extract('estadoVigenciaPrecioProveedor'),ctx);
assert.equal(ctx.estadoVigenciaPrecioProveedor(original,result.proveedores[0]).vigente,false);
console.log('OK: sin stock conserva precio y fecha, no modifica costo ni vigencia');
