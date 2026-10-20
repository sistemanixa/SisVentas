'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Model=require('../js/core/budget-presentation-model'),Budget=require('../js/v3/budget-read-model');
const {load}=require('./helpers/app-functions.cjs');
const topKeys=['number','title','client','currency','items','subtotal','discountPct','discount','iva','ivaRate','includesIva','total','valid','warning'].sort();
const itemKeys=['code','description','quantity','unit','unitPrice','discountPct','subtotal','image'].sort();
const warning='Este presupuesto necesita revisión';
function record(){return {id:'PP-0001',tituloSolucion:'Solución ficticia',cliente:'Cliente ficticio',moneda:'ARS',conIva:true,subtotal:190.19,descuentoGeneral:10,descuentoAmt:19.02,iva:35.95,total:207.12,
 items:[{cod:'P1',desc:'Equipo ficticio',qty:2,punit:100.10,disc:5,sub:190.19,unidad:'Unidad',productoFbKey:'private-product-key'}]};}
function draft(){return {kind:'presupuesto',data:{currency:'ARS',iva:true,fields:[{id:'pp-numero',value:'PP-0002'},{id:'pp-cli',value:'Cliente de borrador'},{id:'pp-titulo-solucion',value:'Título de borrador'},{id:'pp-descuento',value:'10'}],
 rows:[{cod:'P1',desc:'Equipo de borrador',qty:'2',price:100.10,priceText:'$100,10',disc:'5',data:{productoFbKey:'private-product-key',unidad:'Unidad'}}]}};}
function product(){return {fbKey:'private-product-key',codigo:'P1',unidad:'Unidad',imagenUrl:'https://images.fixture.invalid/producto.png',venta:999999,compra:12345,proveedores:[{nombre:'PRIVADO_PROVEEDOR'}]};}
function assertAllowlist(value){assert.deepEqual(Object.keys(value).sort(),topKeys);for(const item of value.items)assert.deepEqual(Object.keys(item).sort(),itemKeys);}
function assertFinite(value){if(typeof value==='number')assert.ok(Number.isFinite(value));else if(Array.isArray(value))value.forEach(assertFinite);else if(value&&typeof value==='object')Object.values(value).forEach(assertFinite);}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test('CommonJS y navegador usan BudgetReadModel sin DOM, red ni infraestructura',()=>{
 assert.deepEqual(Object.keys(Model).sort(),['fromDraft','fromRecord']);
 const context={SisVentas:{V3:{BudgetReadModel:Budget}},URL};vm.createContext(context);vm.runInContext(fs.readFileSync('js/core/budget-presentation-model.js','utf8'),context);
 const browser=context.SVBudgetPresentationModel.fromRecord(record());assert.deepEqual(JSON.parse(JSON.stringify(browser)),Model.fromRecord(record()));
 assert.throws(()=>vm.runInNewContext(fs.readFileSync('js/core/budget-presentation-model.js','utf8'),{URL}),/cálculo de presupuestos/);
});

test('histórico conserva centavos, descuento, IVA e importes aunque el catálogo tenga otro precio',()=>{
 const source=record(),value=Model.fromRecord(source,[product()]);assertAllowlist(value);
 assert.equal(value.valid,true);assert.equal(value.warning,'');assert.equal(value.subtotal,190.19);assert.equal(value.discount,19.02);assert.equal(value.iva,35.95);assert.equal(value.total,207.12);
 assert.equal(value.items[0].unitPrice,100.10);assert.equal(value.items[0].subtotal,190.19);assert.equal(value.items[0].image,product().imagenUrl);
 assert.deepEqual(source,record());
});

test('histórico inconsistente conserva exactamente su total y subtotales en lugar de recotizarlos',()=>{
 const source=record();source.total=999.123456;source.items[0].sub=190.18;source.items[0].punit=100.101234;
 const value=Model.fromRecord(source,[product()]);assert.equal(value.total,999.123456);assert.equal(value.items[0].subtotal,190.18);assert.equal(value.items[0].unitPrice,100.101234);
 assert.equal(value.valid,false);assert.equal(value.warning,warning);assert.equal(source.total,999.123456);
});

test('tolera el centavo histórico admitido por V3 sin sustituir el importe guardado',()=>{
 const source=record();source.total=207.13;const value=Model.fromRecord(source);assert.equal(Budget.moneyValuesEqual(source.total,207.12),true);assert.equal(value.total,207.13);assert.equal(value.valid,true);assert.equal(value.warning,'');
 source.total=207.14;const conflict=Model.fromRecord(source);assert.equal(conflict.total,207.14);assert.equal(conflict.valid,false);assert.equal(conflict.warning,warning);
});

test('redondeos históricos al peso conservan todos sus importes sin una revisión ajena al criterio V3',()=>{
 const source={id:'PP-LEGADO',cliente:'Cliente legado',conIva:true,subtotal:100,descuentoGeneral:0,descuentoAmt:0,iva:21,total:121,items:[{cod:'P1',desc:'Equipo legado',qty:1,punit:100.10,disc:0,sub:100}]};
 assert.equal(Budget.build(source).ready,true);const value=Model.fromRecord(source);assert.equal(value.valid,true);assert.equal(value.warning,'');
 assert.equal(value.items[0].unitPrice,100.10);assert.equal(value.items[0].subtotal,100);assert.equal(value.subtotal,100);assert.equal(value.iva,21);assert.equal(value.total,121);
 source.total=120;assert.equal(Budget.build(source).ready,false);const different=Model.fromRecord(source);assert.equal(different.total,120);assert.equal(different.valid,false);
});

test('totales o subtotal de línea faltantes quedan pendientes, incluso con ítems completos',()=>{
 for(const [field,output]of [['subtotal','subtotal'],['descuentoAmt','discount'],['iva','iva'],['total','total']]){
  const source=record();delete source[field];const value=Model.fromRecord(source);assert.equal(value[output],null,field);assert.equal(value.valid,false);assert.equal(value.warning,warning);
 }
 const source=record();delete source.items[0].sub;const value=Model.fromRecord(source);assert.equal(value.items[0].subtotal,null);assert.equal(value.total,207.12);assert.equal(value.valid,false);
 const legacy=Model.fromRecord({id:'PP-ANTIGUO',total:123.45});assert.equal(legacy.total,123.45);assert.equal(legacy.subtotal,null);assert.deepEqual(legacy.items,[]);assert.equal(legacy.valid,false);
});

test('campos históricos alternativos, orden de filas y moneda se conservan sin inferirla del producto',()=>{
 const source={numero:'PP-LEGADO',clienteNombre:'Cliente legado',currency:'USD',conIva:true,subtotal:200.20,descuento:0,descuentoAmt:0,iva:42.04,total:242.24,
  productos:{later:{codigo:'B',descripcion:'Segundo',cantidad:1,precio:'100,10',importe:'100,10',orden:2},first:{codigo:'A',descripcion:'Primero',cantidad:1,precio:'100,10',importe:'100,10',orden:1}}};
 const value=Model.fromRecord(source,[{codigo:'A',moneda:'ARS',venta:100000}]);assert.equal(value.currency,'USD');assert.equal(value.valid,true);assert.deepEqual(value.items.map(x=>x.code),['A','B']);assert.equal(value.items[0].unitPrice,100.10);
 const fallback=record();delete fallback.moneda;assert.equal(Model.fromRecord(fallback).currency,'ARS');fallback.moneda='EUR';assert.equal(Model.fromRecord(fallback).valid,false);assert.equal(Model.fromRecord(fallback).currency,'');
});

test('borrador calcula importes canónicos a partir del raw del editor y campos explícitos',()=>{
 const input=draft(),value=Model.fromDraft(input,record(),[product()]),canonical=Budget.build({items:[{qty:2,punit:100.10,disc:5}],descuentoGeneral:10,conIva:true});assertAllowlist(value);
 assert.equal(value.valid,true);assert.equal(value.number,'PP-0002');assert.equal(value.title,'Título de borrador');assert.equal(value.client,'Cliente de borrador');assert.equal(value.total,canonical.total);
 assert.equal(value.subtotal,190.19);assert.equal(value.discount,19.02);assert.equal(value.iva,35.95);assert.equal(value.items[0].subtotal,190.19);assert.equal(value.items[0].image,product().imagenUrl);
});

test('centavos pequeños y cantidades fraccionarias del borrador no se pierden por formato o redondeo entero',()=>{
 const input=draft();input.data.rows[0].qty='3';input.data.rows[0].price=.10;input.data.rows[0].priceText='$999.999';input.data.rows[0].disc='0';
 const value=Model.fromDraft(input);assert.equal(value.valid,true);assert.equal(value.subtotal,.30);assert.equal(value.discount,.03);assert.equal(value.iva,.06);assert.equal(value.total,.33);
 input.data.rows[0].qty='1.234';input.data.rows[0].price=100;input.data.fields.find(f=>f.id==='pp-descuento').value='0';input.data.iva=false;
 const fractional=Model.fromDraft(input);assert.equal(fractional.valid,true);assert.equal(fractional.items[0].quantity,1.234);assert.equal(fractional.total,123.40);
});

test('moneda USD explícita no vuelve a convertir precio raw ni usa el precio actual del producto',()=>{
 const input=draft();input.data.currency='USD';input.data.iva=false;input.data.rows[0].price=42.37;input.data.rows[0].qty='1';input.data.rows[0].disc='0';input.data.rows[0].priceData={raw:99999,precioArs:40000,precioUsd:1};input.data.fields.find(f=>f.id==='pp-descuento').value='0';
 const value=Model.fromDraft(input,record(),[product()]);assert.equal(value.currency,'USD');assert.equal(value.items[0].unitPrice,42.37);assert.equal(value.total,42.37);assert.equal(value.iva,0);assert.equal(value.ivaRate,0);assert.equal(value.valid,true);
 delete input.data.currency;const missing=Model.fromDraft(input,record());assert.equal(missing.currency,'');assert.equal(missing.valid,false);assert.equal(missing.total,null);
});

test('fila preparada vacía y placeholder se omiten, pero un producto elegido sin precio queda en revisión',()=>{
 const input=draft();input.data.rows.push({cod:'',desc:'Seleccioná un producto',qty:'1',price:0,disc:'',data:{}},{cod:'',desc:'',qty:'1',price:0,disc:'0',data:{}});
 const value=Model.fromDraft(input);assert.equal(value.items.length,1);assert.equal(value.valid,true);
 input.data.rows=[{cod:'P-SIN-PRECIO',desc:'Equipo sin precio',qty:'1',price:0,disc:'',data:{}}];const incomplete=Model.fromDraft(input);assert.equal(incomplete.items.length,1);assert.equal(incomplete.valid,false);assert.equal(incomplete.total,null);
 input.data.rows=[{cod:'',desc:'Selecciona un producto...',qty:'1',price:0,disc:'',data:{}}];const empty=Model.fromDraft(input);assert.deepEqual(empty.items,[]);assert.equal(empty.valid,false);
});

test('cantidades, precios y porcentajes inválidos nunca producen totales definitivos ni NaN/Infinity',()=>{
 const changes=[d=>d.data.rows[0].qty='0',d=>d.data.rows[0].qty='-1',d=>d.data.rows[0].qty=Infinity,d=>d.data.rows[0].qty='texto',d=>d.data.rows[0].price=NaN,d=>d.data.rows[0].price=-1,d=>d.data.rows[0].disc='100.01',d=>d.data.rows[0].disc='-1',d=>d.data.fields.find(f=>f.id==='pp-descuento').value='101',d=>d.data.currency='EUR',d=>d.data.iva='false'];
 for(const change of changes){const input=draft();change(input);const value=Model.fromDraft(input,record());assert.equal(value.valid,false);assert.equal(value.warning,warning);assert.equal(value.total,null);assertFinite(value);}
 for(const change of [r=>r.items[0].qty=Infinity,r=>r.items[0].disc=101,r=>r.descuentoGeneral=-1,r=>r.total=Infinity,r=>r.ivaPct=101]){const input=record();change(input);const value=Model.fromRecord(input);assert.equal(value.valid,false);assert.equal(value.warning,warning);assertFinite(value);}
});

test('descuento100 y sin IVA respetan los límites inclusivos sin alterar registros',()=>{
 const input=draft();input.data.fields.find(f=>f.id==='pp-descuento').value='100';input.data.iva=false;
 const value=Model.fromDraft(input);assert.equal(value.valid,true);assert.equal(value.total,0);assert.equal(value.discount,190.19);assert.equal(value.includesIva,false);assert.equal(value.iva,0);
});

test('valores finitos cuyo cálculo desborda no se convierten en un total cero válido',()=>{
 for(const [qty,price]of [[1e308,1e308],[1,1e308]]){
  const input=draft();input.data.rows[0].qty=qty;input.data.rows[0].price=price;const value=Model.fromDraft(input);
  assert.equal(value.valid,false);assert.equal(value.total,null);assertFinite(value);
 }
 const source=record();source.items[0].qty=1e308;source.items[0].punit=1e308;source.total=207.12;const value=Model.fromRecord(source);assert.equal(value.valid,false);assert.equal(value.total,207.12);assertFinite(value);
 const invalid=record();invalid.total='9'.repeat(400);const missing=Model.fromRecord(invalid);assert.equal(missing.total,null);assert.equal(missing.valid,false);
});

test('fotos faltantes no invalidan y códigos ambiguos no inventan una foto ni unidad',()=>{
 const input=draft();delete input.data.rows[0].data.unidad;delete input.data.rows[0].data.productoFbKey;
 const missing=Model.fromDraft(input);assert.equal(missing.valid,true);assert.equal(missing.items[0].image,'');assert.equal(missing.items[0].unit,'');
 const products=[product(),{...product(),fbKey:'another-private-key',imagenUrl:'https://images.fixture.invalid/otro.png',unidad:'Metro'}];
 const ambiguous=Model.fromDraft(input,null,products);assert.equal(ambiguous.items[0].image,'');assert.equal(ambiguous.items[0].unit,'');
 input.data.rows[0].data.productoFbKey='another-private-key';const exact=Model.fromDraft(input,null,products);assert.equal(exact.items[0].image,products[1].imagenUrl);assert.equal(exact.items[0].unit,'Metro');
});

test('código de producto histórico usa la misma equivalencia de la app y exige coincidencia única',()=>{
 const source=record();delete source.items[0].productoFbKey;source.items[0].cod='60876';const products=[{codigo:'P-60876',imagenUrl:'https://images.fixture.invalid/legado.jpg',unidad:'Metro'}];
 const context={prodData:products};load(context,['_codigoProductoComparable','productoRefDesdeItem','productoDesdeItem','urlImagenProductoVisual']);
 const expected=context.urlImagenProductoVisual(context.productoDesdeItem(source.items[0]),'');const value=Model.fromRecord(source,products);assert.equal(value.items[0].image,expected);assert.equal(value.items[0].unit,'Unidad');
 delete source.items[0].unidad;assert.equal(Model.fromRecord(source,products).items[0].unit,'Metro');source.items[0].unidad='Unidad';
 products.push({codigo:'060876',imagenUrl:'https://images.fixture.invalid/otra.jpg',unidad:'Otra'});const ambiguous=Model.fromRecord(source,products);assert.equal(ambiguous.items[0].image,'');assert.equal(ambiguous.items[0].unit,'Unidad');
});

test('fotos web válidas se resuelven en memoria, con alternativa si la archivada es data URL',()=>{
 const source=record(),products={'private-product-key':{codigo:'P1',imagenUrl:'data:image/png;base64,AA==',imagenUrlOriginal:'https://images.fixture.invalid/original.jpg'}};
 assert.equal(Model.fromRecord(source,products).items[0].image,products['private-product-key'].imagenUrlOriginal);
 source.items[0].imagenUrl='http://images.fixture.invalid/propia.webp';assert.equal(Model.fromRecord(source).items[0].image,source.items[0].imagenUrl);
 const input=draft();input.data.rows[0].data.imagenUrl='https://images.fixture.invalid/borrador.png';assert.equal(Model.fromDraft(input).items[0].image,input.data.rows[0].data.imagenUrl);
});

test('fotos con credenciales, esquemas locales o archivos activos quedan fuera de la proyección',()=>{
 for(const image of ['javascript:alert(1)','data:image/png;base64,AA==','blob:https://fixture.invalid/id','file:///C:/secreto.png','//images.fixture.invalid/foto.jpg','https://user:password@images.fixture.invalid/foto.jpg','https://images.fixture.invalid/foto.svg','https://images.fixture.invalid/foto%2Esvg','https://images.fixture.invalid/foto.html','https://images.fixture.invalid/foto.js','https://images.fixture.invalid/foto.jpg?token=PRIVADO','https://images.fixture.invalid/foto.jpg?auth=PRIVADO','https://images.fixture.invalid/foto.jpg?key=PRIVADO']){
  const source=record();source.items[0].imagenUrl=image;assert.equal(Model.fromRecord(source).items[0].image,'',image);
  const input=draft();input.data.rows[0].data.imagenUrl=image;assert.equal(Model.fromDraft(input).items[0].image,'',image);
 }
});

test('descarga media de Firebase Storage admite sólo su token UUID único en host y ruta exactos',()=>{
 const token='12345678-1234-4234-9234-123456789abc',url='https://firebasestorage.googleapis.com/v0/b/bucket-ficticio.appspot.com/o/productos%2Fequipo.jpg?alt=media&token='+token;
 const source=record(),products=[{...product(),imagenUrl:url}];assert.equal(Model.fromRecord(source,products).items[0].image,url);
 assert.equal(Model.fromDraft(draft(),null,products).items[0].image,url);
 const direct=record();direct.items[0].imagenUrl=url;assert.equal(Model.fromRecord(direct).items[0].image,url);
 for(const image of [
  url.replace('firebasestorage.googleapis.com','firebasestorage.googleapis.com.engañoso.invalid'),
  url.replace('firebasestorage.googleapis.com','sub.firebasestorage.googleapis.com'),
  url.replace('https:','http:'),url.replace('.com/v0/','.com:8443/v0/'),
  url.replace('.com/v0/','.com/v1/'),url.replace('/b/bucket-ficticio.appspot.com/','/b//'),
  url.replace('/o/productos%2Fequipo.jpg','/o/'),url.replace('/o/productos%2Fequipo.jpg','/o/productos//equipo.jpg'),
  url.replace('productos%2Fequipo.jpg','productos%2F%2Fequipo.jpg'),url.replace('productos%2Fequipo.jpg','%20'),
  url.replace('alt=media','alt=json'),url.replace('alt=media&',''),url+'&alt=media',url+'&token='+token,
  url.replace(token,'no-es-uuid'),url.replace(token,token+',otro'),
  url+'&auth=secreto',url+'&access_token=secreto',url+'&api_key=secreto',url+'&X-Goog-Signature=secreto',
  url.replace('.com/v0/','.com@engañoso.invalid/v0/'),url.replace('https://','https://usuario:clave@'),
  url.replace('equipo.jpg','equipo.svg')
 ]){const input=record();input.items[0].imagenUrl=image;assert.equal(Model.fromRecord(input).items[0].image,'',image);}
});

test('la excepción de Firebase no habilita URLs firmadas de otros servicios',()=>{
 for(const image of ['https://storage.googleapis.com/bucket/foto.jpg?X-Goog-Signature=secreto','https://bucket.s3.amazonaws.com/foto.jpg?X-Amz-Signature=secreto','https://images.fixture.invalid/foto.jpg?sig=secreto','https://storage.googleapis.com/bucket/foto.jpg?GoogleAccessId=cuenta']){
  const input=record();input.items[0].imagenUrl=image;assert.equal(Model.fromRecord(input).items[0].image,'',image);
 }
});

test('allowlist excluye costos, proveedores, IDs, auditoría, contactos y observaciones incluso anidados',()=>{
 const source=record(),input=draft(),products=[product()];Object.assign(source,{fbKey:'PRIVADO_REGISTRO',empleadoUid:'PRIVADO_UID',telefono:'PRIVADO_TELEFONO',direccion:'PRIVADO_DIRECCION',observaciones:'PRIVADO_OBSERVACIONES',audit:[{accion:'PRIVADO_AUDITORIA'}],costosTrasladoExteriorARS:875432,source:{secreto:'PRIVADO_SOURCE'}});
 Object.assign(source.items[0],{costoUnitarioCompra:654321,origenCompra:'PRIVADO_ORIGEN',proveedores:[{password:'PRIVADO_PASSWORD'}],audit:{secret:'PRIVADO_ITEM_AUDIT'}});
 Object.assign(input.data.rows[0].data,{costoPropuesta:JSON.stringify({costoUnitarioCompra:654321,origenCompra:'PRIVADO_COSTO'}),password:'PRIVADO_PASSWORD'});input.data.fields.push({id:'pp-obs',value:'PRIVADO_OBSERVACIONES'},{id:'telefono',value:'PRIVADO_TELEFONO'});
 for(const value of [Model.fromRecord(source,products),Model.fromDraft(input,source,products)]){assertAllowlist(value);assert.doesNotMatch(JSON.stringify(value),/PRIVADO_|654321|875432|private-product-key/);}
});

test('modelo no modifica fuentes y sus salidas no conservan referencias editables al registro',()=>{
 const source=freeze(record()),input=freeze(draft()),products=freeze([product()]),before=JSON.stringify({source,input,products});
 const saved=Model.fromRecord(source,products),pending=Model.fromDraft(input,source,products);
 assert.equal(JSON.stringify({source,input,products}),before);assert.equal(Object.isFrozen(saved),true);assert.equal(Object.isFrozen(saved.items),true);assert.equal(Object.isFrozen(pending.items[0]),true);
 assert.notEqual(saved.items[0],source.items[0]);assert.notEqual(pending.items[0],input.data.rows[0]);
});
