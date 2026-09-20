const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const c={window:{},setInterval:()=>{}};vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/budget-exterior.js','utf8'),c);
test('escenario mantiene costos sin alternativa e incluye gastos adicionales',()=>{const r=c.window.calcularEscenarioExterior([{qty:2,actual:100,exterior:60},{qty:1,actual:50,exterior:0}],400,20);assert.equal(r.actual,250);assert.equal(r.exterior,190);assert.equal(r.ganancia,210);assert.equal(r.margen,52.5);assert.equal(r.comparados,1);});
test('costos desconocidos impiden anunciar margen total y venta cero no divide',()=>{assert.equal(c.window.calcularEscenarioExterior([{qty:1,actual:0,exterior:30}],100,0).margen,null);assert.equal(c.window.calcularEscenarioExterior([{qty:1,actual:20,exterior:10}],0,0).margen,null);});
test('traslado ya guardado integra el costo actual una sola vez y el nuevo escenario',()=>{
  const r=c.window.calcularEscenarioExterior([{qty:2,actual:100,exterior:70}],400,30,30);
  assert.equal(r.actual,230);assert.equal(r.exterior,170);assert.equal(r.ahorro,60);assert.equal(r.ganancia,230);
});
test('cada ítem distingue costo exterior aplicado, cotización disponible y faltante',()=>{
  c.origenProveedorProducto=pv=>({etiqueta:pv.pais});
  c.costoExteriorVigenteARS=pv=>pv.costo;
  c.metrosPorPresentacionProducto=()=>1;
  const item={desc:'Cámara',costoUnitarioCompra:100,origenCompra:'Paraguay'};
  const prod={nombre:'Cámara',proveedores:[{pais:'Paraguay',costo:80,disponibilidadProveedor:'disponible'}]};
  assert.deepEqual(JSON.parse(JSON.stringify(c.window.estadoCotizacionExteriorItem(item,prod))),{aplicado:true,origen:'Paraguay',disponible:true});
  assert.equal(c.window.estadoCotizacionExteriorItem({desc:'Cámara'},prod).disponible,true);
  assert.equal(c.window.estadoCotizacionExteriorItem({desc:'Cámara'},{}).disponible,false);
  assert.equal(c.window.estadoCotizacionExteriorItem({desc:'2 - INSTALACIÓN & CONFIGURACIÓN X CAMARA'},{}),null);
});
