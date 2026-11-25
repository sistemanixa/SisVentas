'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readActiveApp}=require('./helpers/active-app'),{functionSource}=require('./helpers/app-functions.cjs');

test('Dashboard muestra capacidad de facturación con el mismo cálculo que Facturas',()=>{
 const {index}=readActiveApp();assert.match(index,/<div\b[^>]*id="kpi-iva-label"[^>]*>Podés facturar hasta<\/div>/);
 const nodes=Object.fromEntries(['kpi-iva-label','kpi-iva','kpi-iva-mes'].map(id=>[id,{textContent:'',style:{}}]));
 let balance=-21000,requestedMonth;const context={Math,Number,parseFloat,document:{getElementById:id=>nodes[id]},calcularCompensacionIVA:month=>{requestedMonth=month;return{saldo:balance};},cfPesos:value=>'$'+value.toFixed(2)};
 vm.createContext(context);vm.runInContext(functionSource('calcularFacturaParaAgotarCreditoFiscal')+'\n'+functionSource('actualizarKpiIvaDashboard'),context);
 context.actualizarKpiIvaDashboard();assert.match(requestedMonth,/^\d{4}-\d{2}$/);assert.equal(nodes['kpi-iva-label'].textContent,'Podés facturar hasta');assert.equal(nodes['kpi-iva'].textContent,'$121000.00');assert.match(nodes['kpi-iva-mes'].textContent,/saldo a favor \$21000\.00/);assert.equal(nodes['kpi-iva'].style.color,'var(--green)');
 balance=21000;context.actualizarKpiIvaDashboard();assert.equal(nodes['kpi-iva-label'].textContent,'Compras para compensar IVA');assert.equal(nodes['kpi-iva'].textContent,'$121000.00');assert.match(nodes['kpi-iva-mes'].textContent,/IVA a compensar \$21000\.00/);assert.equal(nodes['kpi-iva'].style.color,'var(--amber)');
 balance=0;context.actualizarKpiIvaDashboard();assert.equal(nodes['kpi-iva-label'].textContent,'IVA compensado');assert.equal(nodes['kpi-iva'].textContent,'$0.00');assert.match(nodes['kpi-iva-mes'].textContent,/sin saldo a favor/);
});
