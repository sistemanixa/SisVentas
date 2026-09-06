const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');const {source}=require('./helpers/active-app').readActiveApp();
test('buscadores comparten campos generales y descripción opcional',()=>{
 const c={_prodBusquedaListaCache:null,document:{getElementById:()=>({value:'principales'})}};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function _prodTextosBusqueda(p)'),source.indexOf('function _renderFilaProd(p)')),c);
 const p={codigo:'P-35656',nombre:'CAMARA BULLET EZVIZ COLOR VU FULL-HD',descripcion:'Modelo H3C',marca:'EZVIZ',proveedores:[{nombre:'Biosegur'}]};
 assert.equal(c._prodCoincideBusqueda(p,'h3c','principales'),false);assert.equal(c._prodCoincideBusqueda(p,'h3c','todo'),true);assert.equal(c._prodCoincideBusqueda(p,'h3c','descripcion'),true);assert.equal(c._prodCoincideBusqueda(p,'biosegur ezviz','principales'),true);
 p.catalogoDescripcion='Compatible WiFi';assert.equal(c._prodCoincideBusqueda(p,'wifi','todo'),true);
});
