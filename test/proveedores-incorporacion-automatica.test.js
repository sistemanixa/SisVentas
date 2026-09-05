const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/app.v3.3.15.js', 'utf8');
const start = source.indexOf('function iniciarResumenActualizadorIncremental(');
const end = source.indexOf('\nfunction ', start + 1);

test('al verificar un proveedor incorpora todos sus productos al resumen y deja pendientes las URLs faltantes', () => {
  let verificado = false;
  const proveedor = {fbKey:'nuevo', nombre:'Nuevo', activo:true};
  const ctx = {
    prodData: {
      a:{codigo:'A', proveedores:[{nombre:'Nuevo', url:'valida', vigente:true}]},
      b:{codigo:'B', proveedores:[{nombre:'Nuevo', url:'', vigente:true}]},
      c:{codigo:'C', proveedores:[{nombre:'Nuevo', url:'valida', vigente:false}]}
    },
    proveedoresData:[proveedor], _renderActualizadorPreciosToken:1,
    esProductoManoDeObra:()=>false, proveedoresVinculadosProducto:p=>p.proveedores,
    proveedorAutomaticoDeFila:()=>verificado ? proveedor : null,
    urlAutomaticaValida:pv=>pv.url==='valida',
    estadoVigenciaPrecioProveedor:(p,pv)=>({vigente:pv.vigente}),
    normalizarUrlProveedorProducto:()=>'', URL,
    actualizadorPintarResumenDesdeCache:()=>{},
    document:{getElementById:()=>null}, setTimeout:fn=>fn()
  };
  ctx.window=ctx;
  vm.runInNewContext(source.slice(start,end),ctx);
  ctx.iniciarResumenActualizadorIncremental(1);
  assert.deepEqual(Object.keys(ctx._actualizadorResumenCache.porTipo),[]);
  verificado=true;
  ctx.iniciarResumenActualizadorIncremental(1);
  const resumen=ctx._actualizadorResumenCache.porTipo.auto_nuevo;
  assert.deepEqual(Object.keys(resumen.productos),['A','B','C']);
  assert.deepEqual(Object.keys(resumen.pendientes),['B','C']);
});
