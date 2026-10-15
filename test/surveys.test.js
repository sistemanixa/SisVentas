const {test}=require('node:test'),assert=require('node:assert/strict');
const {products,validation,schemas,surveyForStorage,surveyFromStorage}=require('../js/modules/surveys.js');
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

function draft(){return {id:'REL-fixture',cliente:'Prueba',direccion:'Lugar ficticio',services:['alarma','otro'],items:{
 'alarma.central':{value:'producto-1',label:'Central de prueba',note:'Nota con . # $ / [ ]',photo:{data:'data:image/png;base64,AA==',name:'foto.1.png'}},
 'alarma.teclados':{value:'1',note:'Total 2 teclados'},'alarma.zonas':{value:0},
 'otro.necesidad':{value:'Servicio de prueba'},'redes.puntos':{value:3}
}};}
function checkKeys(value){if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){assert.doesNotMatch(key,/[.#$\[\]/\u0000-\u001f\u007f]/);checkKeys(item);}}

test('guardar separa servicio y campo sin claves prohibidas para RTDB',()=>{
 const saved=surveyForStorage(draft());checkKeys(saved);
 assert.equal(saved.items.alarma.central.value,'producto-1');
 assert.equal(saved.items.otro.necesidad.value,'Servicio de prueba');
 assert.equal(Object.hasOwn(saved.items,'alarma.central'),false);
});

test('la ida y vuelta conserva valores, selección, notas y fotos sin tocar el borrador',()=>{
 const original=draft(),before=JSON.stringify(original),saved=surveyForStorage(original),restored=surveyFromStorage(saved);
 assert.equal(JSON.stringify(original),before);
 for(const key of ['alarma.central','alarma.teclados','alarma.zonas','otro.necesidad'])assert.deepEqual(restored.items[key],original.items[key]);
 assert.equal(restored.id,original.id);assert.equal(saved.items.redes,undefined);
});

test('borradores planos anteriores y guardados anidados mantienen la misma validación',()=>{
 const original=draft();assert.deepEqual(surveyFromStorage(original).items,original.items);
 assert.equal(validation(original),'');assert.equal(validation(surveyForStorage(original)),'');
 original.items['alarma.zonas'].value='1.5';
 assert.equal(validation(original),validation(surveyForStorage(original)));assert.match(validation(original),/cantidad/);
});

test('todos los campos de los seis servicios sobreviven al formato de almacenamiento',()=>{
 const d={cliente:'Prueba',direccion:'Lugar',services:Object.keys(schemas),items:{}};
 for(const [service,schema]of Object.entries(schemas))for(const field of schema.fields)d.items[service+'.'+field[0]]={value:field[2]==='number'?0:'Opción',note:'Nota'};
 const saved=surveyForStorage(d);checkKeys(saved);assert.deepEqual(surveyFromStorage(saved).items,d.items);
});

test('los campos sin relevar no se completan con ceros ni se pierde una selección vacía',()=>{
 const d=draft();d.items={'alarma.central':{value:''}};
 assert.deepEqual(surveyFromStorage(surveyForStorage(d)).items,d.items);
});

test('un identificador malformado falla sin alterar el borrador',()=>{
 for(const field of ['a.b','a/b','a#b','a$b','a[b','a]b','a\u0001b']){
  const d=draft();d.items['alarma.'+field]={value:1};const before=JSON.stringify(d);
  assert.throws(()=>surveyForStorage(d),/Identificador/);assert.equal(JSON.stringify(d),before);
 }
});
