const {test}=require('node:test'),assert=require('node:assert/strict');
const {clean,eligible,publicProviders}=require('../js/modules/distribuidora-access.js');
test('permisos faltantes no permiten editar ni crear',()=>{assert.equal(clean({}).editar,false);assert.equal(clean({}).crear,false);});
test('catálogo restringido a productos activos de Compras Paraguay',()=>{assert.equal(eligible({categoria:'COMPRAS PARAGUAY'}),true);assert.equal(eligible({categoria:'OTRA'}),false);assert.equal(eligible({categoria:'COMPRAS PARAGUAY',esManoDeObra:true}),false);});
test('directorio local y exterior sin credenciales ni datos privados',()=>{
 const result=publicProviders([{fbKey:'local',nombre:'Local',pais:'Argentina'},{fbKey:'flytec',nombre:'FLYTEC PARAGUAY',web:'https://example.com',usuario:'privado',password:'secreto',telefono:'privado'},{fbKey:'china',pais:'China',nombre:'Exterior',activo:false}]);
 assert.deepEqual(Object.keys(result),['local','flytec','china']);assert.deepEqual(result.flytec,{nombre:'FLYTEC PARAGUAY',web:'https://example.com'});assert.equal(result.china.activo,false);
});
