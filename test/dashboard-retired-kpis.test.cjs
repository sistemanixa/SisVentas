const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('gráfico mensual de ventas conserva su salida y no recorre ventas para indicadores retirados',()=>{
 let dates=0,events=0;const svg={},nodes={'dash-month-svg':svg,'dash-month-total':{},'dash-month-var':{style:{}}};const now=new Date(),record={total:100,get fecha(){dates++;return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-01';}};
 const c={window:{},document:{getElementById:id=>nodes[id],dispatchEvent(){events++;}},CustomEvent:function(){}};vm.runInNewContext(fs.readFileSync('js/modules/dashboard-filters.js','utf8'),c);c.window.dashRenderEvolucionMensual([record]);assert.equal(dates,1);assert.equal(events,1);assert.match(svg.innerHTML,/<path/);assert.match(nodes['dash-month-total'].textContent,/100/);
});
