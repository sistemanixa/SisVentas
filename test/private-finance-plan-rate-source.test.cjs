'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../js/core/private-finance-model'),source=fs.readFileSync('js/modules/private-finance-ui.js','utf8');
const MANUAL='Tasa ingresada para este escenario; no modifica el resumen';
function fixture(){
 const statements={unknown:{id:'s-unknown',card:'unknown',tem:null,tea:82,total:100000},known:{id:'s-known',card:'known',tem:5.25,total:50000}},before=JSON.stringify(statements);
 const fields=Object.fromEntries(Object.entries({card:'unknown',extra:'100.00',rate:'',monthly:'50.00',strategy:'accessible',name:'Ficticio'}).map(([name,value])=>[name,{name,_value:value,get value(){return this._value;},set value(next){this._value=String(next);},closest:selector=>selector==='#planForm'?form:null}]));
 const form={elements:fields,dataset:{}},nodes={planForm:form,rateSource:{textContent:''},planError:{textContent:''},planResults:{innerHTML:'',textContent:''},planChart:{innerHTML:''}},handlers=new Map();
 const context={M,state:{cards:[{id:'unknown'},{id:'known'}],strategies:[{id:'saved',card:'unknown',rate:3.75,extra:10000,monthly:5000,strategy:'accessible',name:'Guardado ficticio'}]},latest:id=>statements[id],balance:s=>s.total,totalDebt:()=>150000,amount:M.amount,raw:n=>n==null?'':(n/100).toFixed(2),cname:String,esc:String,money:n=>String(n),empty:(a,b)=>a+' '+b,notice:String,toast(){},applyFilters(){},stage:null,document:{getElementById:id=>nodes[id],addEventListener:(name,fn)=>handlers.set(name,fn)}};
 vm.createContext(context);const from=source.indexOf('function updateRateSource('),to=source.indexOf('const actionNames=',from);assert.ok(from>=0&&to>from);vm.runInContext(source.slice(from,to),context);
 for(const type of ['input','change']){const line=source.split('\n').find(line=>line.startsWith("document.addEventListener('"+type+"',"));assert.ok(line);vm.runInContext(line,context);}
 context.recalcPlan();
 return {context,fields,nodes,form,statements,
  input(value){fields.rate.value=value;handlers.get('input')({target:fields.rate});},
  select(card){fields.card.value=card;handlers.get('change')({target:fields.card});},
  load(){context.a='loadplan';context.id='saved';const line=source.split('\n').find(line=>line.trimStart().startsWith("if(a==='loadplan')"));assert.ok(line);vm.runInContext(line,context);},
  unchanged(){assert.equal(JSON.stringify(statements),before,'El escenario no modifica el resumen ni convierte su TEA en TEM');}};
}
test('tarjeta sin TEM conserva ayuda de tasa faltante aunque el resumen tenga TEA',()=>{
 const f=fixture();assert.equal(f.fields.rate.value,'');assert.match(f.nodes.rateSource.textContent,/Tasa desconocida/);assert.doesNotMatch(f.nodes.planChart.innerHTML,/<svg/);assert.equal(f.context.scenario().rate,null);f.unchanged();
});
for(const rate of ['7,125','0'])test('TEM manual '+rate+' actualiza ayuda y gráfico sin tocar el resumen',()=>{
 const f=fixture();f.input(rate);assert.equal(f.nodes.rateSource.textContent,MANUAL);assert.match(f.nodes.planChart.innerHTML,/<svg/);assert.equal(f.context.scenario().rate,rate==='0'?0:7.125);f.unchanged();
});
for(const empty of ['', '   '])test('vaciar TEM '+JSON.stringify(empty)+' muestra faltante y nunca inventa cero',()=>{
 const f=fixture();f.input('7.125');f.input(empty);assert.match(f.nodes.rateSource.textContent,/Tasa desconocida/);assert.doesNotMatch(f.nodes.planChart.innerHTML,/<svg/);assert.equal(f.context.scenario().rate,null);f.unchanged();
});
test('cambiar a otra tarjeta recupera su TEM actual y procedencia del resumen',()=>{
 const f=fixture();f.input('7.125');f.select('known');assert.equal(f.fields.rate.value,'5.25');assert.match(f.nodes.rateSource.textContent,/TEM del resumen/);assert.match(f.nodes.planChart.innerHTML,/<svg/);f.unchanged();
});
test('escribir manualmente el mismo valor del resumen sigue siendo una entrada de escenario',()=>{
 const f=fixture();f.select('known');f.input('5.25');assert.equal(f.nodes.rateSource.textContent,MANUAL);f.unchanged();
});
test('reiniciar el cálculo vuelve a la TEM y procedencia de la tarjeta actual',()=>{
 const f=fixture();f.select('known');f.input('7.125');f.context.recalcPlan(true);assert.equal(f.fields.rate.value,'5.25');assert.match(f.nodes.rateSource.textContent,/TEM del resumen/);f.unchanged();
});
test('cambiar a otra tarjeta sin TEM no arrastra la tasa manual anterior',()=>{
 const f=fixture();f.select('known');f.input('7.125');f.select('unknown');assert.equal(f.fields.rate.value,'');assert.match(f.nodes.rateSource.textContent,/Tasa desconocida/);assert.doesNotMatch(f.nodes.planChart.innerHTML,/<svg/);f.unchanged();
});
test('cargar una versión guardada distingue su tasa propia de la del resumen',()=>{
 const f=fixture();f.load();assert.equal(f.fields.rate.value,'3.75');assert.equal(f.nodes.rateSource.textContent,MANUAL);assert.match(f.nodes.planChart.innerHTML,/<svg/);assert.equal(f.fields.name.value,'Guardado ficticio');f.unchanged();
});
test('una TEM inválida conserva el error de cálculo y no anuncia una tasa válida',()=>{
 const f=fixture();f.input('abc');assert.match(f.nodes.rateSource.textContent,/Revisá la TEM/);assert.match(f.nodes.planError.textContent,/TEM inválida/);assert.doesNotMatch(f.nodes.planChart.innerHTML,/<svg/);f.unchanged();
});
test('editar otro campo conserva la procedencia manual de la tasa del escenario',()=>{
 const f=fixture();f.input('7.125');f.fields.monthly.value='60.00';f.context.recalcPlan();assert.equal(f.nodes.rateSource.textContent,MANUAL);assert.equal(f.fields.rate.value,'7.125');f.unchanged();
});
test('versión guardada sin tasa muestra faltante aunque la tarjeta actual tenga TEM',()=>{
 const f=fixture();f.context.state.strategies[0].card='known';f.context.state.strategies[0].rate=null;f.load();assert.equal(f.fields.rate.value,'');assert.match(f.nodes.rateSource.textContent,/Tasa desconocida/);assert.doesNotMatch(f.nodes.planChart.innerHTML,/<svg/);f.unchanged();
});
