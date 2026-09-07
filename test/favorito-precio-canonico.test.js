const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const vm=require('vm');
const html=fs.readFileSync('index.html','utf8');const source=fs.readFileSync(html.match(/src="\.\/(js\/app\.v[0-9.]+\.js)"/)[1],'utf8');
function fn(name){const a=source.indexOf('function '+name+'(');const b=source.indexOf('\nfunction ',a+10);return source.slice(a,b<0?undefined:b);}
test('favorito distinto al primero define costo y venta, sin cambiar datos guardados',()=>{
 const c={URL,proveedorProductoEsFavorito:(pv,p)=>pv.url===p.codWeb,costoUnitarioProveedorProducto:(p,pv)=>pv.costoRealArs,precioVentaDesdeCostoUnitarioProducto:(p,n)=>Math.round(n*(1+p.margenDeseado/100)*100)/100};
 vm.runInNewContext(fn('precioGremioARSDesdeProducto')+'\n'+fn('precioVentaCanonicoProducto'),c);
 const p={codWeb:'https://biosegur.com.ar/p',compraARS:65478.4,ventaARS:85121.92,margenDeseado:30,proveedores:[{url:'https://free-electron.com.ar/p',costoRealArs:65478.4},{url:'https://biosegur.com.ar/p',costoRealArs:81901.51}]};
 assert.equal(c.precioGremioARSDesdeProducto(p),81901.51);assert.equal(c.precioVentaCanonicoProducto(p).precioARS,106471.96);assert.equal(p.compraARS,65478.4);
});
