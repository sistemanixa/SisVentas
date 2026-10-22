'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../js/core/private-finance-model'),source=fs.readFileSync('js/modules/private-finance-ui.js','utf8');
const from=source.indexOf('function planProjectionChart('),to=source.indexOf('function recalcPlan(',from);
assert.ok(from>=0&&to>from);
const context={Date:class{constructor(){throw Error('La proyección no tiene fechas de calendario');}}};
vm.createContext(context);vm.runInContext(source.slice(from,to),context);
const render=(a,b)=>context.planProjectionChart(a,b);
const polylines=html=>[...html.matchAll(/<polyline points="([^"]+)"/g)].map(m=>m[1]);

test('eje temporal muestra Inicio y cada mes 1–12 con nombre accesible y sin inventar fechas',()=>{
 const html=render(M.project(100000,5,12000),M.project(80000,5,12000));
 const labels=[...html.matchAll(/<span role="listitem" aria-label="([^"]+)" style="[^"]*">([^<]+)<\/span>/g)];
 assert.deepEqual(labels.map(x=>x[2]),['Inicio',...Array.from({length:12},(_,i)=>String(i+1))]);
 assert.deepEqual(labels.map(x=>x[1]),['Mes 0: saldo inicial',...Array.from({length:12},(_,i)=>'Mes '+(i+1))]);
 assert.match(html,/aria-label="Meses de proyección"/);
 assert.match(html,/Meses de proyección · Inicio = mes 0, saldo inicial/);
 assert.match(html,/font-size:12px/,'Las etiquetas HTML no se achican con el SVG');
 assert.doesNotMatch(html,/\b\d{4}-\d{2}-\d{2}\b/);
});

for(const [base,extra,rate,monthly]of [[100000,20000,5,12000],[100000,100000,0,100000],[100000,0,15,100]])test('eje conserva los 13 puntos e importes de ambas series '+JSON.stringify({base,extra,rate,monthly}),()=>{
 const a=M.project(base,rate,monthly),b=M.project(base-extra,rate,monthly),before=JSON.stringify([a,b]);
 const html=render(a,b),max=Math.max(1,...a.values,...b.values);
 assert.deepEqual(polylines(html),[a,b].map(series=>series.values.map((v,i)=>(30+i*60)+','+(180-v/max*150)).join(' ')));
 assert.equal(JSON.stringify([a,b]),before,'Dibujar no modifica saldos ni intereses');
 const ticks=[...html.matchAll(/<line x1="(\d+)" y1="180" x2="\1" y2="187"/g)];
 assert.deepEqual(ticks.map(x=>Number(x[1])),Array.from({length:13},(_,i)=>30+i*60));
 const positions=[...html.matchAll(/role="listitem"[^>]+left:([\d.]+)%/g)].map(x=>Number(x[1]));
 assert.equal(positions.length,13);positions.forEach((percent,i)=>assert.ok(Math.abs(percent/100*720+30-(30+i*60))<1e-10));
 assert.match(html,/margin:0 6\.25% 0 3\.75%/,'La escala HTML usa el mismo rango horizontal del SVG');
});

test('recalcPlan real conserva saldos, resultado del mes 12 y tabla exacta después de agregar el eje',()=>{
 const statement={card:'card-fixture',total:100000,tem:5},state={cards:[{id:'card-fixture'}]},before=JSON.stringify({statement,state});
 const values={card:'card-fixture',extra:'200.00',rate:'5',monthly:'120.00',strategy:'accessible',name:'Ficticio'};
 const form={elements:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value}])),dataset:{ready:'1'}};
 const nodes={planForm:form,rateSource:{textContent:''},planError:{textContent:''},planResults:{innerHTML:'',textContent:''},planChart:{innerHTML:''}};
 const c={M,state,latest:()=>statement,balance:s=>s.total,totalDebt:()=>100000,amount:M.amount,money:String,cname:String,esc:String,notice:String,empty:String,document:{getElementById:id=>nodes[id]}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function updateRateSource('),source.indexOf('const actionNames=')),c);c.recalcPlan();
 const a=M.project(100000,5,12000),b=M.project(80000,5,12000);
 assert.equal(nodes.planError.textContent,'');assert.match(nodes.planResults.innerHTML,/<div class="value">80000<\/div>/);
 assert.ok(nodes.planChart.innerHTML.includes('Mes 12: '+b.values[12]+' · interés evitado aproximado: '+(a.interest-b.interest)));
 assert.deepEqual([...nodes.planChart.innerHTML.matchAll(/<tr><td>(\d+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td><\/tr>/g)].map(x=>x.slice(1).map(Number)),a.values.map((value,i)=>[i,value,b.values[i]]));
 assert.equal(JSON.stringify({statement,state}),before,'El simulador no escribe resúmenes ni saldos');
});
