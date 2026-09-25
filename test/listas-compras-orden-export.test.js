const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/modules/purchase-orders.js', 'utf8');

function loadModule() {
  const products = [
    { fbKey:'prod-a', codigo:'A', nombre:'Producto A', proveedores:[{nombre:'Proveedor Uno', proveedorKey:'p1', precio:100, sinIva:true, url:'https://proveedor.test/a'}] },
    { fbKey:'prod-b', codigo:'B', nombre:'Producto B', proveedores:[{nombre:'Proveedor Dos', proveedorKey:'p2', precio:200, sinIva:true, url:'https://proveedor.test/b'}] },
    { fbKey:'servicio', codigo:'MO', nombre:'Instalación y configuración remota', categoria:'Mano de obra', proveedores:[] }
  ];
  const window = {
    prodData:Object.fromEntries(products.map(product => [product.fbKey, product])),
    proveedoresData:[{fbKey:'p1',nombre:'Proveedor Uno'},{fbKey:'p2',nombre:'Proveedor Dos'}],
    proveedoresVinculadosProducto:product => product.proveedores,
    esProductoManoDeObra:() => false
  };
  const sandbox = {
    window,
    document:{addEventListener(){}},
    console,
    Date,
    Object,
    Array,
    String,
    Number,
    Math,
    JSON,
    Promise,
    setTimeout
  };
  vm.runInNewContext(source, sandbox);
  return window.SisVentasCompras;
}

test('la lista vuelve al orden vigente de la venta y conserva decisiones por producto', () => {
  const purchases = loadModule();
  const list = {
    estado:'preparacion',
    ordenesIds:[],
    items:[
      {productoKey:'prod-b',codigo:'B',descripcion:'Producto B',cantidadNecesaria:1,incluir:true,usarExistente:0,cantidadComprar:1,proveedor:'Proveedor Dos',proveedorKey:'p2',costoUnitario:242},
      {productoKey:'prod-a',codigo:'A',descripcion:'Producto A',cantidadNecesaria:1,incluir:true,usarExistente:1,cantidadComprar:0,proveedor:'Proveedor Uno',proveedorKey:'p1',costoUnitario:121}
    ]
  };
  const sale = {items:[{productoKey:'prod-a',cod:'A',desc:'Producto A',qty:3},{productoKey:'prod-b',cod:'B',desc:'Producto B',qty:2}]};
  assert.equal(purchases.syncListItemsWithSale(list, sale), true);
  assert.deepEqual(list.items.map(item => item.codigo), ['A','B']);
  assert.equal(list.items[0].usarExistente, 1);
  assert.equal(list.items[0].cantidadComprar, 2);
  assert.equal(list.items[0].proveedorKey, 'p1');
  assert.equal(list.items[0].proveedorUrl, 'https://proveedor.test/a');
});

test('la interfaz permite agrupar sin reemplazar el orden y exporta un xlsx con hipervínculos', () => {
  assert.match(source, /Agrupar por proveedor/);
  assert.match(source, /Ver orden de venta/);
  assert.match(source, /Exportar Excel/);
  assert.match(source, /window\.XLSX\.utils\.aoa_to_sheet/);
  assert.match(source, /linkCell\.l = \{ Target: linkCell\.v/);
  assert.match(source, /window\.SisVentas\.prepareResizablePage\(body\)/);
  assert.match(source, /\.xlsx'/);
});

test('cada proveedor seleccionado conserva su URL en la lista y en la orden generada', () => {
  assert.match(source, /data-url=/);
  assert.match(source, /item\.proveedorUrl = option \? safeProviderUrl\(option\.dataset\.url\)/);
  assert.match(source, /proveedorUrl: providerUrlForItem\(item\)/);
  assert.match(source, /Abrir link de compra/);
});

test('puede volver a aplicar el proveedor recomendado actual a toda la lista', () => {
  const purchases = loadModule();
  const list = {items:[
    {productoKey:'prod-a',codigo:'A',descripcion:'Producto A',incluir:false,cantidadComprar:0,proveedor:'Proveedor Dos',proveedorKey:'p2',proveedorUrl:'https://proveedor.test/b',costoUnitario:242},
    {productoKey:'prod-b',codigo:'B',descripcion:'Producto B',incluir:true,cantidadComprar:2,proveedor:'Proveedor Uno',proveedorKey:'p1',proveedorUrl:'https://proveedor.test/a',costoUnitario:121},
    {productoKey:'servicio',codigo:'MO',descripcion:'Instalación remota',esManoDeObra:true,incluir:false,cantidadComprar:0,proveedor:'',costoUnitario:0}
  ]};
  const result = purchases.applyRecommendedProviders(list);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {reviewed:2,applied:2,changed:2,unavailable:0});
  assert.equal(list.items[0].proveedorKey, 'p1');
  assert.equal(list.items[0].proveedorUrl, 'https://proveedor.test/a');
  assert.equal(list.items[0].costoUnitario, 121);
  assert.equal(list.items[0].incluir, false);
  assert.equal(list.items[0].cantidadComprar, 0);
  assert.equal(list.items[1].proveedorKey, 'p2');
  assert.equal(list.items[2].proveedor, '');
  assert.match(source, /Poner todos en recomendado/);
  assert.match(source, /Guardando recomendados/);
  assert.match(source, /saveCurrentList\(true\)\.then/);
  assert.match(source, /Proveedor recomendado aplicado y guardado/);
});

test('la mano de obra se excluye de la lista aun cuando estaba guardada anteriormente', () => {
  const purchases = loadModule();
  const list = {
    estado:'preparacion',
    ordenesIds:[],
    items:[
      {productoKey:'servicio',codigo:'MO',descripcion:'Instalación y configuración remota',cantidadNecesaria:1,incluir:true,cantidadComprar:1},
      {productoKey:'prod-a',codigo:'A',descripcion:'Producto A',cantidadNecesaria:2,incluir:true,cantidadComprar:2,proveedor:'Proveedor Uno',proveedorKey:'p1'}
    ]
  };
  const sale = {items:[
    {productoKey:'servicio',cod:'MO',desc:'Instalación y configuración remota',qty:1},
    {productoKey:'prod-a',cod:'A',desc:'Producto A',qty:2}
  ]};
  assert.equal(purchases.syncListItemsWithSale(list, sale), true);
  assert.deepEqual(Array.from(list.items, item => item.codigo), ['A']);
  assert.equal(purchases.isPurchasableMaterialItem({productoKey:'servicio',codigo:'MO',descripcion:'Instalación y configuración remota'}), false);
});

test('la exportación agrupada replica los grupos visibles y mantiene el orden original dentro de cada proveedor', () => {
  const purchases = loadModule();
  purchases.state.groupMaterialsByProvider = true;
  const list = {items:[
    {linea:0,productoKey:'prod-b',codigo:'B',descripcion:'Producto B',cantidadNecesaria:1,incluir:true,cantidadComprar:1,proveedor:'Proveedor Dos',proveedorKey:'p2',costoUnitario:242},
    {linea:1,productoKey:'servicio',codigo:'MO',descripcion:'Instalación remota',cantidadNecesaria:1,incluir:true,cantidadComprar:1},
    {linea:2,productoKey:'prod-a',codigo:'A',descripcion:'Producto A',cantidadNecesaria:1,incluir:true,cantidadComprar:1,proveedor:'Proveedor Uno',proveedorKey:'p1',costoUnitario:121}
  ]};
  const exported = purchases.buildMaterialExportRows(list);
  assert.deepEqual(Array.from(exported.rows, row => row[0]), ['Orden venta','Proveedor: Proveedor Dos',1,'Proveedor: Proveedor Uno',3]);
  assert.deepEqual(Array.from(exported.groupRows), [2,4]);
  assert.equal(exported.rows.some(row => row.includes('MO')), false);
});

test('el pedido para WhatsApp conserva negritas, enlaces y crea un bloque por proveedor', () => {
  const purchases = loadModule();
  const text = purchases.buildWhatsAppOrderText({items:[
    {productoKey:'prod-a',codigo:'A',descripcion:'Producto A',incluir:true,cantidadComprar:1,proveedor:'Proveedor Uno',proveedorKey:'p1',proveedorUrl:'https://proveedor.test/a'},
    {productoKey:'prod-b',codigo:'B',descripcion:'Producto B',incluir:true,cantidadComprar:2,proveedor:'Proveedor Dos',proveedorKey:'p2',proveedorUrl:'https://proveedor.test/b'},
    {productoKey:'prod-a',codigo:'A2',descripcion:'Producto A dos',incluir:true,cantidadComprar:3,proveedor:'Proveedor Uno',proveedorKey:'p1',proveedorUrl:'https://proveedor.test/a2'},
    {productoKey:'servicio',codigo:'MO',descripcion:'Instalación remota',incluir:true,cantidadComprar:1,proveedor:'Proveedor Uno',proveedorUrl:'https://proveedor.test/mo'}
  ]});
  assert.equal(text,
    '*PEDIDO – PROVEEDOR UNO*\n\n' +
    '*1 x A*\nProducto A\nhttps://proveedor.test/a\n\n' +
    '*3 x A2*\nProducto A dos\nhttps://proveedor.test/a2\n\n\n' +
    '*PEDIDO – PROVEEDOR DOS*\n\n' +
    '*2 x B*\nProducto B\nhttps://proveedor.test/b'
  );
  assert.doesNotMatch(text, /Instalación remota|\/mo/);
  assert.equal(purchases.buildWhatsAppOrderText({items:[
    {productoKey:'prod-a',codigo:'A',descripcion:'Producto A',incluir:true,cantidadComprar:1,proveedor:'Proveedor Uno',proveedorKey:'p1',proveedorUrl:'https://proveedor.test/a'},
    {productoKey:'prod-b',codigo:'B',descripcion:'Producto B',incluir:true,cantidadComprar:2,proveedor:'Proveedor Dos',proveedorKey:'p2',proveedorUrl:'https://proveedor.test/b'}
  ]}, 'p2'), '*PEDIDO – PROVEEDOR DOS*\n\n*2 x B*\nProducto B\nhttps://proveedor.test/b');
  assert.match(source, /Copiar pedido para WhatsApp/);
  assert.match(source, /Copiar para WhatsApp/);
  assert.match(source, /Pedido para WhatsApp copiado/);
});

test('el encabezado agrupado calcula productos, unidades y total de cada proveedor', () => {
  const purchases = loadModule();
  const list = {items:[
    {productoKey:'prod-a',codigo:'A',incluir:true,cantidadComprar:2,proveedor:'Proveedor Uno',proveedorKey:'p1',costoUnitario:100},
    {productoKey:'prod-a',codigo:'A2',incluir:true,cantidadComprar:3,proveedor:'Proveedor Uno',proveedorKey:'p1',costoUnitario:50},
    {productoKey:'prod-b',codigo:'B',incluir:true,cantidadComprar:4,proveedor:'Proveedor Dos',proveedorKey:'p2',costoUnitario:200},
    {productoKey:'servicio',codigo:'MO',incluir:true,cantidadComprar:8,proveedor:'Proveedor Uno',proveedorKey:'p1',costoUnitario:999}
  ]};
  assert.deepEqual(JSON.parse(JSON.stringify(purchases.purchaseSummaryForProvider(list, 'p1'))), {items:2,units:5,total:350});
  assert.match(source, /productos · .* unidades · Total/);
  assert.match(source, /oc-material-table/);
  assert.match(source, /data-label="Proveedor"/);
  assert.match(source, /data-sv-mobile-cards="off"/);
});

test('el pedido para WhatsApp exige proveedor y URL en cada material seleccionado', () => {
  const purchases = loadModule();
  assert.throws(() => purchases.buildWhatsAppOrderText({items:[
    {productoKey:'prod-a',codigo:'A',descripcion:'Producto A',incluir:true,cantidadComprar:1,proveedor:'',proveedorUrl:''}
  ]}), /Elegí un proveedor/);
  assert.throws(() => purchases.buildWhatsAppOrderText({items:[
    {productoKey:'prod-a',codigo:'A',descripcion:'Producto A',incluir:true,cantidadComprar:1,proveedor:'Proveedor Uno',proveedorUrl:''}
  ]}), /Falta el link de compra de A/);
});
