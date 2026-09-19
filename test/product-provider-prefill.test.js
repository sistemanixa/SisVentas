const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {readActiveApp}=require('./helpers/active-app');
test('al abrir reconoce al proveedor de la URL guardada sin importar ni guardar',()=>{
  const select={value:'',replaceChildren(){this.value='';},add(){}};
  const nodes={'pf-importar-panel':{},'pf-importar-proveedor':select,'pf-cod-web':{value:'https://www.biosegur.com.ar/producto'}};
  const c={window:{proveedoresData:[{fbKey:'bio',nombre:'BIOSEGUR'}]},document:{getElementById:id=>nodes[id]},Option:function(){},URL,
    prodProveedoresActuales:[{proveedorKey:'bio',nombre:'BIOSEGUR',url:nodes['pf-cod-web'].value}]};
  vm.runInNewContext(fs.readFileSync('js/modules/product-url-import.js','utf8'),c);
  c.window.inicializarFichaProducto();assert.equal(select.value,'bio');
});

test('si cambia la URL general de Flytec usa esa URL en la fila vinculada aunque la fila tenga una anterior',async()=>{
  const ids=['pf-importar-panel','pf-importar-proveedor','pf-cod-web','prod-form-view','pf-es-mano-obra','pf-nombre','pf-descripcion','pf-marca','pf-imagen-url','pf-importar-boton','pf-importar-estado'];
  const nodes=Object.fromEntries(ids.map(id=>[id,{value:'',checked:false,textContent:'',disabled:false,replaceChildren(){},add(){},querySelectorAll(){return []}}]));
  nodes['prod-form-view'].querySelectorAll=()=>ids.map(id=>nodes[id]);
  const urlNueva='https://www.flytec.com.py/produto/kit-camera/123456';
  let body;
  const c={
    URL,AbortController,setTimeout,clearTimeout,Option:function(){},
    editingProdId:'prod1',
    prodProveedoresActuales:[{proveedorKey:'fly',nombre:'Flytec Paraguay',url:'https://www.flytec.com.py/produto/anterior/111111',precio:10}],
    proveedoresData:[{fbKey:'fly',nombre:'Flytec Paraguay',web:'https://www.flytec.com.py'}],
    document:{getElementById:id=>nodes[id]},
    getComputedStyle:()=>({display:'block'}),
    normalizarUrlProveedorProducto:u=>u,
    SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://cotizador.example.com'},
    headersCotizadorProtegido:async()=>({Authorization:'Bearer prueba'}),
    fetch:async(_endpoint,options)=>{
      body=JSON.parse(options.body);
      return {ok:true,json:async()=>({ok:true,url:urlNueva,moneda:'ARS',precioArs:1500,sinIva:false,identidad:{ok:true},ficha:{nombre:'Camara Flytec',marca:'Hikvision',detalle:'IP',imagenUrl:''}})};
    },
    completarReferenciaProveedorProducto:p=>p,
    renderTablaProveedoresProducto(){},
    recalcularCompraDesdeProveedores(){},
    actualizarPreviewImagenURL(){}
  };
  c.window=c;
  nodes['pf-cod-web'].value=urlNueva;
  vm.runInNewContext(fs.readFileSync('js/modules/product-url-import.js','utf8'),c);
  c.window.inicializarFichaProducto();
  assert.equal(nodes['pf-importar-proveedor'].value,'fly');
  await c.window.completarProductoDesdeUrl();
  assert.equal(body.url,urlNueva);
  assert.equal(c.prodProveedoresActuales.length,1);
  assert.equal(c.prodProveedoresActuales[0].url,urlNueva);
  assert.equal(c.prodProveedoresActuales[0].precio,1500);
});

test('cotizar online sincroniza Flytec con la URL general nueva antes de armar la consulta',()=>{
  const source=readActiveApp().source;
  const nombres=['normalizarUrlComparacionProveedor','urlsProveedorEquivalentes','completarReferenciaProveedorProducto','sincronizarUrlGeneralProveedorProducto'];
  const c={
    URL,
    window:{},
    document:{getElementById:id=>({value:id==='pf-cod-web'?'https://www.flytec.com.py/produto/nuevo/222222':''})},
    proveedoresData:[{fbKey:'fly',nombre:'Flytec Paraguay',web:'https://www.flytec.com.py'}],
    prodProveedoresActuales:[{proveedorKey:'fly',nombre:'Flytec Paraguay',url:'https://www.flytec.com.py/produto/anterior/111111',precio:10}],
    obtenerDolarReferenciaProducto:()=>({valor:1530,tipo:'oficial'}),
    factorIvaProveedorProducto:()=>1,
    normalizarUrlProveedorProducto:u=>u
  };
  vm.createContext(c);
  for(const nombre of nombres){
    const a=source.indexOf('function '+nombre+'(');
    const b=source.indexOf('\nfunction ',a+10);
    assert.notEqual(a,-1,nombre);
    vm.runInContext(source.slice(a,b),c);
  }
  c.sincronizarUrlGeneralProveedorProducto(0);
  assert.equal(c.prodProveedoresActuales[0].url,'https://www.flytec.com.py/produto/nuevo/222222');
});

test('cotizacion Flytec conserva el precio original nuevo y no el USD anterior',()=>{
  const source=readActiveApp().source;
  const nombres=['normalizarUrlComparacionProveedor','urlsProveedorEquivalentes','parsePrecioProveedorARS','alicuotaIvaProveedorProducto','factorIvaProveedorProducto','completarReferenciaProveedorProducto','precioExteriorProductoHTML','origenProveedorProducto'];
  const c={
    URL,
    window:{TIPO_CAMBIO_CONFIG:{oficial:1530,dolarConversion:'oficial'}},
    document:{getElementById:id=>({value:id==='pf-iva'?'21':''})},
    proveedoresData:[{fbKey:'fly',nombre:'Flytec Paraguay',web:'https://www.flytec.com.py',monedaPrecios:'USD'}],
    obtenerDolarReferenciaProducto:()=>({valor:1530,tipo:'oficial'}),
    normalizarUrlProveedorProducto:u=>u,
    escapeHTML:s=>String(s),
    prodProveedoresActuales:[]
  };
  vm.createContext(c);
  for(const nombre of nombres){
    const a=source.indexOf('function '+nombre+'(');
    const b=source.indexOf('\nfunction ',a+10);
    assert.notEqual(a,-1,nombre);
    vm.runInContext(source.slice(a,b),c);
  }
  const actualizado=c.completarReferenciaProveedorProducto({
    proveedorKey:'fly',
    nombre:'Flytec Paraguay',
    url:'https://www.flytec.com.py/produto/nuevo/222222',
    precio:48960,
    precioOriginal:32,
    monedaOriginal:'USD',
    conversion:{arsPorUsd:1530,factor:1530}
  },'', 'flytec_precio_dinamico');
  assert.equal(actualizado.precioOriginal,32);
  assert.match(c.precioExteriorProductoHTML(actualizado),/USD 32,00/);

  const sinConversion=c.completarReferenciaProveedorProducto({
    proveedorKey:'fly',
    nombre:'Flytec Paraguay',
    url:'https://www.flytec.com.py/produto/nuevo/222222',
    precio:48960,
    precioOriginal:85,
    monedaOriginal:'USD'
  },'', 'manual');
  assert.equal(sinConversion.precioOriginal,undefined);
});
