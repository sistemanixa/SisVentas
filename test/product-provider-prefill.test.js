const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('al abrir reconoce al proveedor de la URL guardada sin importar ni guardar',()=>{
  const select={value:'',replaceChildren(){this.value='';},add(){}};
  const nodes={'pf-importar-panel':{},'pf-importar-proveedor':select,'pf-cod-web':{value:'https://www.biosegur.com.ar/producto'}};
  const c={window:{proveedoresData:[{fbKey:'bio',nombre:'BIOSEGUR'}]},document:{getElementById:id=>nodes[id]},Option:function(){},URL,
    prodProveedoresActuales:[{proveedorKey:'bio',nombre:'BIOSEGUR',url:nodes['pf-cod-web'].value}]};
  vm.runInNewContext(fs.readFileSync('js/modules/product-url-import.js','utf8'),c);
  c.window.inicializarFichaProducto();assert.equal(select.value,'bio');
});
