const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('guardar producto de Ofertas conserva Exento al agregar proveedor local',async()=>{
 const code=fs.readFileSync('js/app.v3.10.15.js','utf8');
 const context={currentRole:'distribuidora',window:{SVDistribuidora:{saveProduct:p=>Promise.resolve(p)}}};vm.createContext(context);
 vm.runInContext(code.slice(code.indexOf('function productoPersistirGuardar('),code.indexOf('function productoPersistirActualizar(')),context);
 const product={categoria:'COMPRAS PARAGUAY',iva:21,compra:550,proveedor:'COMPRAS PARAGUAY',proveedores:[{nombre:'COMPRAS PARAGUAY',sinIva:false},{nombre:'MERCADO LIBRE',sinIva:true}]};
 const saved=await context.productoPersistirGuardar(product);assert.equal(saved.iva,0);assert.equal(saved.compra,550);assert.equal(saved.proveedor,product.proveedor);assert.deepEqual(saved.proveedores,product.proveedores);assert.equal(product.iva,21);
 const local=await context.productoPersistirGuardar({categoria:'ACCESORIOS',iva:21});assert.equal(local.iva,21);
});
