const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {eligible,quote,csv,salePrice}=require('../js/modules/paraguay-shopping-access');
test('Ofertas carga el cambio sin iniciar el dashboard y reacciona a cambios de cotización',()=>{
  const {subscribeExchangeRate,saleAmounts}=require('../js/modules/paraguay-shopping-access');
  let callback,errorCallback,active=true,refreshes=0,errors=0,stopped=false;
  const api={fbDB:{},fbRef:(db,path)=>{assert.equal(path,'sisventas/config/tipoCambio');return path;},fbOnValue:(ref,cb,err)=>{callback=cb;errorCallback=err;return ()=>{stopped=true;};}};
  const stop=subscribeExchangeRate(api,()=>active,()=>refreshes++,()=>errors++);
  callback({val:()=>({oficial:1500,dolarConversion:'oficial'})});
  assert.equal(saleAmounts({ventaARS:300000,iva:0},api.TIPO_CAMBIO_CONFIG.oficial).usd,200);
  callback({val:()=>({oficial:1600,dolarConversion:'oficial'})});
  assert.equal(saleAmounts({ventaARS:300000,iva:0},api.TIPO_CAMBIO_CONFIG.oficial).usd,187.5);
  assert.equal(refreshes,2);
  errorCallback(new Error('denied'));assert.equal(errors,1);
  active=false;callback({val:()=>({oficial:1})});errorCallback(new Error('late'));
  assert.equal(api.TIPO_CAMBIO_CONFIG.oficial,1600);assert.equal(errors,1);
  stop();assert.equal(stopped,true);
});
test('venta USD usa el precio final y el cambio vigente, respetando IVA y exentos',()=>{
  const {saleAmounts}=require('../js/modules/paraguay-shopping-access');
  assert.deepEqual(saleAmounts({ventaARS:1000,iva:21},100),{ars:1210,usd:12.1});
  assert.deepEqual(saleAmounts({ventaARS:1000,iva:0},200),{ars:1000,usd:5});
  assert.equal(saleAmounts({ventaARS:1000,iva:10.5},100).usd,11.05);
  assert.equal(saleAmounts({ventaARS:1000},0).usd,0);
  assert.equal(saleAmounts({compra:1000},100).usd,0);
});

test('Ofertas usa venta canónica con IVA, nunca el costo del proveedor',()=>{
  const p={ventaARS:1000,compra:600,iva:21};
  assert.equal(salePrice(p,()=>({precioARS:1200})),1452);
  assert.equal(salePrice({...p,iva:10.5}),1105);
  assert.equal(salePrice({...p,iva:0}),1000);
  assert.equal(salePrice({compra:600}),0);
});
test('exporta compra real sin reemplazar la cantidad solicitada ni mezclar monedas',()=>{
  const p={categoria:'COMPRAS PARAGUAY',nombre:'Ejemplo'};
  const out=csv({p:3},{p},{p:{cantidad:2,precioUnitario:420.5,moneda:'USD',proveedor:'Ejemplo'}});
  assert.match(out,/"3";/);assert.match(out,/"2";"420.5";"USD";"Ejemplo"/);
});
test('solo admite productos activos de la categoría exacta, no otro proveedor paraguayo',()=>{
  assert.equal(eligible({categoria:'COMPRAS PARAGUAY'}),true);
  for(const p of [{categoria:'CAMARAS IP',proveedor:'FLYTEC PARAGUAY'},{categoria:'COMPRAS PARAGUAY',activo:false},{categoria:'COMPRAS PARAGUAY',esManoDeObra:true}])assert.equal(eligible(p),false);
});
test('lista exporta cantidad, precio USD y costo con envío sin incluir otros productos',()=>{
  const products={p:{categoria:'COMPRAS PARAGUAY',codigo:'P-1',nombre:'Patinete',proveedores:[{url:'https://www.comprasparaguai.com.br/producto__1/',precioOriginal:597,monedaOriginal:'USD',precio:922365,costoRealArs:932365}]},otro:{categoria:'CAMARAS IP',nombre:'Oculto'}};
  assert.equal(quote(products.p).ars,932365);
  const value=csv({p:2,otro:10},products);assert.match(value,/"2";"597";"932365"/);assert.doesNotMatch(value,/Oculto/);
  products.p.nombre='=IMPORTXML("datos")';assert.match(csv({p:1},products),/'=IMPORTXML/);
});
test('el rol no puede abrir ningún módulo general aunque intenten habilitarlo',()=>{
  const window={currentRole:'compras_paraguay',PERMISOS_ROLES:{compras_paraguay:{bloqueados:[]}}};
  vm.runInNewContext(fs.readFileSync('js/core/access-control.js','utf8'),{window});
  for(const page of ['productos','dashboard','clientes','venta','usuarios','balancecompra','desconocido'])assert.equal(window.SisVentas.Access.canAccess(page),false);
});
test('compara venta final con la referencia ML menor y descarta valores inválidos o sin stock',()=>{
  const {mlComparison}=require('../js/modules/paraguay-shopping-access');
  const p={iva:21,proveedores:[{nombre:'Mercado Libre',precio:150000},{url:'https://articulo.mercadolibre.com.ar/MLA-1',precio:100000},{nombre:'Mercado Libre',precio:50000,disponibilidadProveedor:'sin_stock'},{nombre:'Otro',precio:10000}]};
  assert.deepEqual(mlComparison(p,85000),{reference:100000,saving:15000,percent:15});
  assert.equal(mlComparison(p,100000),null);
  assert.equal(mlComparison(p,110000),null);
  assert.equal(mlComparison(p,0),null);
  assert.equal(mlComparison({proveedores:[{nombre:'Mercado Libre',precio:-1}]},1),null);
  assert.equal(mlComparison({proveedores:[{nombre:'Mercado Libre',precio:100,sinIva:true}],iva:21},100).reference,121);
  assert.equal(mlComparison(p,85000,()=>200000).reference,200000);
});
test('PDF muestra relación con ML en destacados y marcas, incluso igualdad o mayor precio',()=>{
 const {pdfEntries,pdfComparisonText,pdfPages}=require('../js/modules/paraguay-shopping-access');
 const entries=[50,85,100,120].map((ventaARS,i)=>({p:{nombre:'Producto '+i,marca:'JBL',ventaARS,iva:0,proveedores:[{nombre:'Mercado Libre',precio:100}]},qty:1}));
 entries.push({p:{nombre:'Sin referencia',marca:'JBL',ventaARS:80,iva:0},qty:1});
 const result=pdfEntries(entries),labels=result.map(r=>pdfComparisonText(r.comparison));
 assert.equal(result.filter(r=>r.featured).length,1);
 assert.deepEqual(labels,['50% menos que Mercado Libre · Ahorrás ARS $ 50,00 por unidad','15% menos que Mercado Libre · Ahorrás ARS $ 15,00 por unidad','Mismo precio que Mercado Libre','20% más que Mercado Libre · Diferencia ARS $ 20,00 por unidad','Sin referencia de Mercado Libre']);
 assert.deepEqual(pdfPages(result).map(page=>page.length),[1,4]);
 const code=fs.readFileSync('js/modules/paraguay-shopping-access.js','utf8');
 assert.match(code,/esc\(pdfComparisonText\(comparison\)\)/);
 assert.doesNotMatch(code,/featured\?'<div class="saving"/);
});

test('tarjetas muestran comparación aunque Mercado Libre sea más barato o igual',()=>{
 const code=fs.readFileSync('js/modules/paraguay-shopping-access.js','utf8');
 const vm=require('node:vm');const {mlComparison,pdfComparisonText}=require('../js/modules/paraguay-shopping-access');
 const context={root:{},mlComparison,pdfComparisonText,esc:String,amount:n=>n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})};vm.createContext(context);
 vm.runInContext(code.slice(code.indexOf('  function mlBadge('),code.indexOf('  let productSheet=')),context);
 const p={proveedores:[{nombre:'MERCADO LIBRE',precio:427500}]};
 const html=context.mlBadge(p,446826.38);assert.match(html,/4,52% más que Mercado Libre/);assert.match(html,/19.326,38/);assert.doesNotMatch(html,/Ahorrás/);
 assert.match(context.mlBadge(p,427500),/Mismo precio/);assert.match(context.mlBadge(p,400000),/Ahorrás/);
 assert.equal(context.mlBadge({},446826.38),'');
});
