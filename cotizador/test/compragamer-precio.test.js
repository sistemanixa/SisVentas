const test=require('node:test');
const assert=require('node:assert/strict');
const {seleccionarPrecioCompraGamer,aplicarCondicionComercial}=require('../proveedor-automatico');
const datos={id:'8647',titulo:'AMD Ryzen 3 3200G',transferencia:'$ 109.100',otros:'$ 121.222'};
const url='https://compragamer.com/producto/Procesador_AMD_8647?criterio=INTEL';
test('elige el precio de transferencia sin volver a descontar su promoción',()=>{const precio=seleccionarPrecioCompraGamer(datos,url,'transferencia');assert.equal(precio,109100);assert.equal(aplicarCondicionComercial({ok:true,precioArs:precio},{activa:false,medioPago:'transferencia'}).precioArs,109100);assert.equal(seleccionarPrecioCompraGamer(datos,url,'otros'),121222);});
test('el criterio de búsqueda no cambia el ID; rechaza otra ficha y precio ausente',()=>{assert.throws(()=>seleccionarPrecioCompraGamer({...datos,id:'123'},url,'transferencia'));assert.throws(()=>seleccionarPrecioCompraGamer({...datos,transferencia:''},url,'transferencia'));assert.throws(()=>seleccionarPrecioCompraGamer(datos,url,'automatico'));});
