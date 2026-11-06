'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Model=require('../cotizador/budget-presentation-trial-model');
function budget(){return {id:'PP-FICTICIO',tituloSolucion:'Solución ficticia',cliente:'Cliente ficticio',direccionCliente:'Domicilio ficticio',observaciones:'Condición ficticia',items:[{orden:2,cod:'B',desc:'Segundo',qty:2,punit:999,costoUnitarioCompra:400},{orden:1,cod:'A',desc:'Primero',qty:1,punit:50,costoUnitarioCompra:20}],subtotal:123456.78,descuentoAmt:10000.01,descuentoPct:8.1,descuentoGeneral:8.1,descuento:8.1,iva:23456.79,total:136913.56};}
const options={exchangeRate:1234.5,exchangeLabel:'Dólar visible · venta'};
test('projects saved monetary fields independently of line prices, without changing originals',()=>{
 const b=budget(),before=structuredClone(b),dto=Model.build(b,options);
 assert.deepEqual(b,before);assert.equal(dto.status,'READY');assert.equal(dto.sourceCurrency,'ARS');assert.equal(dto.exchange.rate,1234.5);
 assert.deepEqual(dto.items,[{code:'A',description:'Primero',quantity:1,service:false},{code:'B',description:'Segundo',quantity:2,service:false}]);
 assert.deepEqual(dto.money.usd,{subtotal:100.01,discount:8.1,iva:19,total:110.91});assert.equal(dto.money.ars.total,b.total);
 assert.equal(dto.number,'PP-FICTICIO');assert.equal(dto.title,b.tituloSolucion);assert.equal(dto.client,b.cliente);assert.equal(dto.address,b.direccionCliente);assert.equal(dto.observations,b.observaciones);
});
test('no recalculation of intentionally nonmatching saved subtotal/discount/VAT/total',()=>{const b=budget();Object.assign(b,{subtotal:100,descuentoAmt:9,iva:3,total:77});const dto=Model.build(b,{exchangeRate:10,exchangeLabel:'Visible'});assert.deepEqual(dto.money.usd,{subtotal:10,discount:0.9,iva:0.3,total:7.7});});
for(const rate of [undefined,null,'1234.5','1.234,5',true,false,0,-1,NaN,Infinity,-Infinity,{},[]])test('requires an explicit finite positive JSON rate: '+String(rate),()=>{const dto=Model.build(budget(),{exchangeRate:rate,exchangeLabel:'Visible'});assert.equal(dto.code,'RATE_REQUIRED');assert.equal(dto.requireRate,true);assert.equal(Object.hasOwn(dto,'amounts'),false);assert.equal(Object.hasOwn(dto,'items'),false);});
test('never falls back to document/global rates, current prices, private metadata or line currencies',()=>{
 const b=budget();for(const key of ['tipoCambio','cotizacion','dolar','dolarUsado','tcGuardado','cotizacionUsada','DOLAR','catalogo'])Object.defineProperty(b,key,{get(){throw Error('Unexpected read '+key);}});
 b.items[0].monedaOriginal='USD';b.items[0].cotizacionUsada=99;global.DOLAR=99999;
 try{assert.equal(Model.build(b).status,'RATE_REQUIRED');assert.equal(Model.build(b,options).sourceCurrency,'ARS');}finally{delete global.DOLAR;}
});
test('USD document keeps saved USD totals unchanged with a visible ARS/USD snapshot',()=>{const b=budget();b.moneda='USD';Object.assign(b,{subtotal:100.25,descuentoAmt:5.75,iva:19.85,total:114.35});const dto=Model.build(b,{exchangeRate:1400,exchangeLabel:'Visible'});assert.deepEqual(dto.money.usd,{subtotal:100.25,discount:5.75,iva:19.85,total:114.35});assert.equal(dto.sourceCurrency,'USD');});
test('whitelist strips nested costs, prices, credentials, permissions and internal references',()=>{
 const b=budget();Object.assign(b,{password:'PRIVATE',token:'PRIVATE',permisos:{admin:true},audit:[{secret:'PRIVATE'}],costoTotal:999,fbKey:'PRIVATE'});Object.assign(b.items[0],{token:'PRIVATE',proveedor:{secret:'PRIVATE'},imagenUrl:'PRIVATE',precio:999,sub:1998});
 const dto=Model.build(b,options),json=JSON.stringify(dto);assert.equal(json.includes('PRIVATE'),false);assert.deepEqual(Object.keys(dto.items[0]),['code','description','quantity','service']);
});
test('ready snapshot is detached and immutable for preview and PDF reuse',()=>{const b=budget(),dto=Model.build(b,options);b.items[0].desc='Changed';b.total=1;assert.equal(dto.items[1].description,'Segundo');assert.notEqual(dto.money.usd.total,1);assert(Object.isFrozen(dto));assert(Object.isFrozen(dto.items));assert(Object.isFrozen(dto.items[0]));assert(Object.isFrozen(dto.money.usd));});
test('canonical decimal strings and stored aliases preserve zero and exact currency division',()=>{
 const b=budget();b.items={b:{codigo:'B',descripcion:'Dos',cantidad:'0.5',orden:'2'},a:{cod:'A',desc:'Uno',qty:'2',orden:'1'}};delete b.descuentoAmt;b.descuentoMonto='0';Object.assign(b,{subtotal:'1.004',iva:'0',total:'1.004',descuentoPct:0,descuento:0,descuentoGeneral:0});
 const dto=Model.build(b,{exchangeRate:0.2,exchangeLabel:'Visible'});assert.equal(dto.money.usd.total,5.02);assert.equal(dto.money.ars.total,1);assert.equal(dto.money.usd.discount,0);assert.equal(dto.money.usd.iva,0);assert.equal(dto.items[1].quantity,0.5);
});
for(const field of ['subtotal','descuentoAmt','iva','total','cliente','items'])test('missing required documentary field blocks: '+field,()=>{const b=budget();delete b[field];assert.throws(()=>Model.build(b,options),{code:'BUDGET_PRESENTATION_INVALID'});});
for(const field of ['subtotal','descuentoAmt','iva','total'])for(const value of [null,'',true,{},'1.234,56',-1,Infinity])test('invalid saved '+field+' blocks: '+String(value),()=>{const b=budget();b[field]=value;assert.throws(()=>Model.build(b,options),{code:'BUDGET_PRESENTATION_INVALID'});});
test('zero amounts remain confirmed zeros, never replaced by line-derived values',()=>{const b=budget();Object.assign(b,{subtotal:0,descuentoAmt:0,iva:0,total:0});const dto=Model.build(b,options);assert.equal(dto.money.usd.subtotal,0);assert.equal(dto.money.usd.total,0);});
test('ambiguous currency, percent aliases and quantity block rather than infer',()=>{
 for(const change of [b=>{b.moneda='USD';b.monedaOperativa='ARS';},b=>b.moneda='PYG',b=>b.descuentoGeneral=9,b=>b.descuentoPct=101,b=>b.items[0].qty=0,b=>b.items[0].cantidad=3,b=>b.items[0].orden=-1,b=>b.items[0].desc={secret:'PRIVATE'}]){const b=budget();change(b);assert.throws(()=>Model.build(b,options),{code:'BUDGET_PRESENTATION_INVALID'});}
});
test('source label is explicit and never inferred from a saved rate',()=>{assert.throws(()=>Model.build(budget(),{exchangeRate:100}),{code:'BUDGET_PRESENTATION_INVALID',field:'exchangeLabel'});});
test('customer-facing customized documentary description takes precedence without exposing line economics',()=>{
 const b=budget();b.items[0].descripcionPersonalizada='Descripción acordada';for(const key of ['punit','precio','costoUnitarioCompra'])Object.defineProperty(b.items[0],key,{get(){throw Error('Unexpected economics read');}});
 assert.equal(Model.build(b,options).items[1].description,'Descripción acordada');
});
test('frozen input and optional empty documentary text remain unchanged',()=>{
 const b=budget();delete b.tituloSolucion;delete b.direccionCliente;delete b.observaciones;b.obs='Nota histórica';b.items.forEach(Object.freeze);Object.freeze(b.items);Object.freeze(b);
 const dto=Model.build(b,options);assert.equal(dto.title,'');assert.equal(dto.address,'');assert.equal(dto.observations,'Nota histórica');
});
test('integration API exposes bilingual monetary snapshot, explicit label and documentary service flag',()=>{
 const b=budget();b.items[0].esManoDeObra=true;const dto=Model.build(b,options);
 assert.deepEqual(dto.exchange,{rate:1234.5,label:'Dólar visible · venta'});assert.equal(dto.money.discountPct,8.1);assert.equal(dto.money.ars.discount,10000.01);assert.equal(dto.items[1].service,true);assert.equal(dto.items[0].service,false);
 assert.equal(Object.hasOwn(dto,'revision'),false);assert.equal(Object.hasOwn(dto,'generatedAt'),false);
});
test('native USD produces its ARS equivalent once without reconverting the primary USD total',()=>{
 const b=budget();b.moneda='USD';b.total=114.35;const dto=Model.build(b,{exchangeRate:1400,exchangeLabel:'Dólar visible'});assert.equal(dto.money.usd.total,114.35);assert.equal(dto.money.ars.total,160090);
});
