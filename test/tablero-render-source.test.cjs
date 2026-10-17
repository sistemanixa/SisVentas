'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
test('Tablero usa la colección vigente de gastos y termina de dibujar sin un alias inexistente',()=>{
 const nodes=new Map(),month=new Date().toISOString().slice(0,7);
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',value:''});return nodes.get(id);}};
 const c=load({document,ventasList:[],otData:[],gastosData:[{fecha:month+'-05',monto:125}],escapeHTML:String,_svTotalVentaCanonico:()=>0,_svMontoPagadoVenta:()=>0,_svSaldoPendienteVenta:()=>0},['renderTablero']);
 c.renderTablero();assert.equal(nodes.get('tab-gastos-sub').textContent,'1 gastos este mes');assert.match(nodes.get('tab-gastos-mes').textContent,/125/);assert.match(nodes.get('tab-chart').innerHTML,/Gastos: \$125/);
});
