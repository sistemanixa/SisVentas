const {test}=require('node:test'),assert=require('node:assert/strict');
const {products,validation,schemas}=require('../js/modules/surveys.js');
test('centrales usa catálogo activo y excluye mano de obra',()=>{
 assert.deepEqual(products('central',{a:{nombre:'Central Garnet'},b:{nombre:'Central',activo:false},c:{nombre:'Central',categoria:'Instalación'},d:{nombre:'Sirena exterior',descripcion:'Compatible con central Garnet'},e:{nombre:'GABINETE PARA CENTRAL'}}),[{key:'a',name:'Central Garnet'}]);
});
test('cantidades enteras; campos pendientes no significan cero',()=>{
 const d={cliente:'Prueba',direccion:'Lugar',services:['alarma'],items:{}};
 assert.equal(validation(d),'');d.items['alarma.zonas']={value:'1.5'};assert.match(validation(d),/cantidad/);
 d.items['alarma.zonas'].value='0';assert.equal(validation(d),'');
 d.services=[];assert.match(validation(d),/servicio/);
});
test('servicios desmarcados no invalidan el relevamiento activo',()=>{
 assert.equal(validation({cliente:'A',direccion:'B',services:['redes'],items:{'alarma.zonas':{value:-2}}}),'');
 assert.ok(schemas.camaras.fields.some(f=>f[0]==='ptz'));
});
