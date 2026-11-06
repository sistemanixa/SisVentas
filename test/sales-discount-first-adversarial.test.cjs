const test=require('node:test'),assert=require('node:assert/strict');
const readers=[['browser',require('../js/v3/sales-read-model')],['server',require('../cotizador/commercial-models/sales-read-model')]];
function sale(){return {id:'SALE-FICTION',fbKey:'fiction',items:[{cod:'P-FICTION',qty:1,punit:101.05,sub:101.05,costoUnitarioCompra:20}],descuentoGeneral:10,descuento:10.11,subtotal:90.94,iva:0,conIva:false,total:90.94};}
for(const [name,Sales]of readers){
 test(name+' preserves exact historical chain and its input',()=>{const s=sale(),before=structuredClone(s);assert.equal(Sales.saleEconomic(s).ready,true);assert.deepEqual(s,before);});
 for(const [label,change]of [
 ['invalid VAT string',s=>s.iva='invalid'],['invalid VAT boolean',s=>s.iva=false],
 ['subcent subtotal',s=>s.subtotal=90.9401],['subcent total',s=>s.total=90.9401],['subcent discount',s=>s.descuento=10.1101],
 ['subcent line',s=>s.items[0].sub=101.0501],['rounded whole line',s=>s.items[0].sub=101],
 ['conflicting amount',s=>s.descuentoAmt=88],['invalid amount',s=>s.descuentoAmt='invalid'],['conflicting percentage',s=>s.descuentoPct=20],
 ['missing original unit price',s=>delete s.items[0].punit],['missing stored line',s=>delete s.items[0].sub],
 ['rounded total alias',s=>s.totalPresupuesto=91],['subcent amount alias',s=>s.descuentoAmt=10.11001],
 ['invalid tax rate',s=>{s.conIva=true;s.ivaPct='invalid';}],['negative tax rate',s=>{s.conIva=true;s.ivaPct=-1;}],
 ['quantity alias',s=>s.items[0].cantidad=2],['price alias',s=>s.items[0].precio=202.10],
 ['line discount alias',s=>s.items[0].descuentoPct=50],['line total alias',s=>s.items[0].total=99]
 ])test(name+' rejects '+label,()=>{const s=sale();change(s);assert.equal(Sales.saleEconomic(s).ready,false);});
}
