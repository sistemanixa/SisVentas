const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/app.v3.6.9.js','utf8');
const scope={_prodBusquedaListaCache:null};
vm.createContext(scope);
vm.runInContext(source.slice(source.indexOf('function _prodTextosBusqueda(p)'),source.indexOf('function _renderFilaProd(p)')),scope);
test('DVR y salida de alarma pueden estar en campos separados',()=>{
  const p={nombre:'DVR HIKVISION',descripcion:'Incluye salida ALARMA'};
  assert.equal(scope._prodCoincideBusqueda(p,'dvr salida de alarma','principales'),true);
  assert.equal(scope._prodCoincideBusqueda({nombre:'DVR',descripcion:'HDMI'},'dvr alarma','principales'),false);
  assert.equal(scope._prodCoincideBusqueda({nombre:'Alarma'},'dvr alarma','principales'),false);
});
test('respeta el campo elegido y normaliza acentos',()=>{
  assert.equal(scope._prodCoincideBusqueda({nombre:'Cámara',descripcion:'Exterior'},'camara exterior','principales'),true);
  assert.equal(scope._prodCoincideBusqueda({nombre:'DVR',descripcion:'alarma'},'alarma','nombre'),false);
});
