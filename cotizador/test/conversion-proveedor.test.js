const test=require('node:test');const assert=require('node:assert/strict');
const {convertirPrecioProveedor:c}=require('../conversion-proveedor');
const {dolarSistema,validarGuarani}=require('../conversion-proveedor');
test('usa el dólar seleccionado del sistema y valida la moneda y vigencia de la fuente web',()=>{
 assert.equal(dolarSistema({dolarConversion:'mep',oficial:1000,mep:1500}),1500);
 assert.throws(()=>dolarSistema({}));
 const datos={base:'USD',quote:'PYG',rate:5960.75,date:new Date().toISOString().slice(0,10)};
 assert.equal(validarGuarani(datos).pygPorUsd,5960.75);
 assert.throws(()=>validarGuarani({...datos,quote:'ARS'}));
 assert.throws(()=>validarGuarani({...datos,date:'2000-01-01'}));
});
const cfg={habilitado:true,arsPorUsd:1500,pygPorUsd:7500,actualizadoEn:123};
test('convierte USD y PYG preservando el precio original y la cotización',()=>{
 const usd=c({requiereConversion:true,moneda:'USD',precioOriginal:67},cfg);
 assert.equal(usd.precioArs,100500);assert.equal(usd.precioOriginal,67);assert.equal(usd.monedaOriginal,'USD');assert.equal(usd.moneda,'ARS');assert.equal(usd.conversion.configuradaEn,123);
 const pyg=c({requiereConversion:true,moneda:'PYG',precioOriginal:75000},cfg);assert.equal(pyg.precioArs,15000);
 assert.equal(c(usd,cfg),usd);
});
test('no convierte sin autorización o con cotizaciones inválidas',()=>{
 const r={requiereConversion:true,moneda:'USD',precioOriginal:67};
 for(const config of [null,{...cfg,habilitado:false},{...cfg,arsPorUsd:0},{...cfg,arsPorUsd:Infinity}])assert.throws(()=>c(r,config));
 assert.throws(()=>c({...r,moneda:'PYG'},{...cfg,pygPorUsd:0}));
});
