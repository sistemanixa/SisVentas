const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const {applySaleCosts}=require('../js/modules/exterior-preparation');
const cost=i=>i.costoTotalCompra ?? i.costoUnitarioCompra*i.qty;
const ctx=load({obtenerCostoItemVenta:cost,_svTotalVentaCanonico:v=>v.total},['_calcularBaseComisionVenta']);
const base=v=>ctx._calcularBaseComisionVenta(v);
const sale=()=>({items:[{cod:'A',qty:2,punit:1000,costoUnitarioCompra:600,costoTotalCompra:1200},{cod:'MO',qty:1,punit:500,costoTotalCompra:200}],descuento:100});
test('ahorro exterior mejora la empresa sin aumentar la comisión, conservando descuento y mano de obra',()=>{
 const original=sale();
 const rows=[{key:'A|0',sourceLine:0,code:'A',needed:2,requestedQty:2,method:'exterior',agreed:3,providerKey:'PY',provider:'Paraguay'}];
 const updated=applySaleCosts(original,rows,100,cost,()=>2400);
 assert.equal(updated.costoTotal,800);
 assert.equal(base(original).ganancia,1000);
 assert.equal(base(updated).ganancia,1000);
 assert.equal((2400-updated.costoTotal),1600);
 rows[0].agreed=2;
 const twice=applySaleCosts(updated,rows,100,cost,()=>2400);
 assert.equal(twice.costoTotal,600);
 assert.equal(base(twice).ganancia,1000);
 assert.equal(base(twice).ganancia*0.1,100);
});
test('la recepción real y su repetición conservan el costo original para comisiones',async()=>{
 const current=sale();
 const window={SVPurchaseReceiptCosts:require('../js/core/purchase-receipt-costs.v1'),fbDB:{},fbRef:(_,p)=>p,fbRunTransaction:async(_,fn)=>{const value=fn(current);return {committed:value!==undefined,snapshot:{val:()=>value}};},obtenerCostoItemVenta:cost,_rentIngresoNetoVenta:()=>2400};
 const scope=vm.createContext({window});
 const src=fs.readFileSync(require.resolve('../js/modules/purchase-orders.js'),'utf8');
 const start=src.indexOf('  function syncSalePurchaseCosts');
 vm.runInContext(src.slice(start,src.indexOf('  function ',start+12)),scope);
 for(let n=0;n<2;n++)await scope.syncSalePurchaseCosts({ventaFbKey:'S',receiptOperation:'fictional-receipt'},[{item:{codigo:'A'},qty:2,costoUnitarioReal:300}],true);
 assert.equal(current.items[0].costoTotalCompra,600);
 assert.equal(current.items[0].costoUnitarioAntesPreparacion,600);
 assert.equal(base(current).ganancia,1000);
});
test('preparación tiene prioridad sobre costo presupuestado de una recepción',()=>{
 const s=sale();Object.assign(s.items[0],{costoUnitarioAntesPreparacion:600,costoUnitarioPresupuestado:300,costoTotalCompra:400});
 assert.equal(base(s).ganancia,1000);
 delete s.items[0].costoUnitarioAntesPreparacion;s.items[0].costoUnitarioPresupuestado=600;
 assert.equal(base(s).ganancia,1000);
});
test('costo original cero es válido y un dato ausente o inválido no reemplaza el costo vigente',()=>{
 for(const value of [undefined,null,'',NaN]){const s=sale();s.items[0].costoUnitarioAntesPreparacion=value;assert.equal(base(s).ganancia,1000);}
 const s=sale();s.items[0].costoUnitarioAntesPreparacion=0;assert.equal(base(s).ganancia,2200);
});
test('desglosa el costo histórico de mano de obra sin alterar costo ni ganancia',()=>{
 const ctx=load({obtenerCostoItemVenta:cost,_svTotalVentaCanonico:v=>v.total,itemVentaEsManoDeObraReporte:i=>i.cod==='MO'},['_calcularBaseComisionVenta']);
 const v=sale();const r=ctx._calcularBaseComisionVenta(v);assert.equal(r.costoManoObra,200);assert.equal(r.costoTotal,1400);assert.equal(r.ganancia,1000);
 v.items[2-1].costoUnitarioAntesPreparacion=150;assert.equal(ctx._calcularBaseComisionVenta(v).costoManoObra,150);
 assert.equal(ctx._calcularBaseComisionVenta({total:100,costoTotal:20}).costoManoObra,null);
});
