'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {functionSource}=require('./helpers/app-functions.cjs');
function fixture(){
 const card={attrs:{},setAttribute(k,v){this.attrs[k]=v;}},nodes=Object.fromEntries(['kpi-pptos','kpi-pptos-sub','kpi-pptos-conv'].map(id=>[id,{textContent:'old',closest:()=>card}]));
 const context={window:{SVDataReadiness:{status:keys=>{assert.deepEqual(Array.from(keys),['presupuestos']);return context.state;}}},document:{getElementById:id=>nodes[id]},state:{ready:false,errors:[]},pptoData:[]};
 vm.runInNewContext(functionSource('svPintarPresupuestosDashboard'),context);
 return {context,nodes,card,paint:()=>context.svPintarPresupuestosDashboard()};
}
test('active budget card shows pending and error without false totals, including stale cached rows',()=>{
 const f=fixture();f.context.pptoData=[{estado:'borrador'}];const before=JSON.stringify(f.context.pptoData);
 f.paint();assert.equal(f.nodes['kpi-pptos'].textContent,'—');assert.match(f.nodes['kpi-pptos-sub'].textContent,/Cargando/);assert.equal(f.nodes['kpi-pptos-conv'].textContent,'');assert.equal(f.card.attrs['aria-busy'],'true');assert.match(f.card.attrs['aria-label'],/cargando/);
 f.context.state={ready:false,errors:['presupuestos']};f.paint();assert.equal(f.nodes['kpi-pptos'].textContent,'—');assert.match(f.nodes['kpi-pptos-sub'].textContent,/No se pudieron/);assert.equal(f.nodes['kpi-pptos-conv'].textContent,'');assert.equal(f.card.attrs['aria-busy'],'false');assert.match(f.card.attrs['aria-label'],/no se pudieron/);assert.equal(JSON.stringify(f.context.pptoData),before);
});
test('completed empty data is a valid zero and positive recovery preserves conversion calculation',()=>{
 const f=fixture();f.context.state={ready:true,errors:[]};f.paint();assert.equal(f.nodes['kpi-pptos'].textContent,'0');assert.equal(f.nodes['kpi-pptos-sub'].textContent,'0 activos');assert.equal(f.nodes['kpi-pptos-conv'].textContent,'0 convertidos · 0% conversión');assert.equal(f.card.attrs['aria-busy'],'false');
 f.context.pptoData=[{estado:'borrador'},{estado:'convertido'},{estado:'anulado'}];f.paint();assert.equal(f.nodes['kpi-pptos'].textContent,'1');assert.equal(f.nodes['kpi-pptos-conv'].textContent,'1 convertidos · 50% conversión');assert.match(f.card.attrs['aria-label'],/50%/);
 f.context.state={ready:true,errors:['presupuestos']};f.paint();assert.equal(f.nodes['kpi-pptos'].textContent,'—');
});
