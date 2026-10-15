const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const money=require('../js/core/distribuidora-money');
const portal=require('../js/modules/paraguay-shopping-access');
test('USD se presenta entero y ARS conserva centavos sin cambiar el importe',()=>{
  const original={price:79.95};
  assert.equal(money.amount(original.price,'USD'),'80');
  assert.equal(money.amount(original.price,'ARS'),'79,95');
  assert.equal(money.amount(1535,'USD'),'1.535');
  assert.equal(original.price,79.95);
});
test('precio de origen USD permanece igual al variar el cambio y alternar equivalencias',()=>{
  const p={moneda:'USD',venta:597,iva:0};
  for(const rate of [1535,1540.43,1700,0]){
    const values=portal.saleAmounts(p,rate,()=>({monedaOrigen:'USD',precioOrigen:597,precioARS:916395}));
    assert.equal(values.usd,597);
    assert.equal(values.ars,Math.round(597*rate*100)/100);
  }
  assert.equal(p.venta,597);
});
test('precio nativo ARS convierte una vez; IVA USD se aplica sin reconvertir pesos',()=>{
  assert.deepEqual(money.saleAmounts({precioARS:1000},21,100),{ars:1210,usd:12.1});
  assert.deepEqual(money.saleAmounts({monedaOrigen:'USD',precioOrigen:100,precioARS:999999},21,1535),{usd:121,ars:185735});
});
test('guardar campos mostrados redondeados conserva originales hasta una edición explícita',()=>{
  const source=fs.readFileSync('js/modules/paraguay-shopping-access.js','utf8');
  const start=source.indexOf('    function capturePurchase('),end=source.indexOf("    panel.querySelector('[data-cart-items]').oninput",start);
  const c={purchases:{p:{moneda:'USD',precioUnitario:79.95,precioVentaUnitarioUSD:110.42}},selected:{p:1}};
  vm.createContext(c);vm.runInContext(source.slice(start,end),c);
  const input={dataset:{key:'p',purchase:'precioUnitario'},value:'80'};
  c.capturePurchase(input);assert.equal(c.purchases.p.precioUnitario,79.95);
  c.capturePurchase(input,true);assert.equal(c.purchases.p.precioUnitario,80);
  c.capturePurchase({dataset:{key:'p',purchase:'precioVentaUnitarioUSD'},value:'110'});
  assert.equal(c.purchases.p.precioVentaUnitarioUSD,110.42);
});
