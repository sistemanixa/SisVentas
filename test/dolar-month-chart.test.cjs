const {test}=require('node:test'),assert=require('node:assert/strict');
const {series,period,shift}=require('../js/modules/dolar-month-chart');
test('cursor elige registros reales, incluso con huecos, sin interpolar precios',()=>{
 const {nearest}=require('../js/modules/dolar-month-chart');const points=[{position:0},{position:5},{position:20}];
 assert.equal(nearest(points,8),points[1]);assert.equal(nearest(points,19),points[2]);assert.equal(nearest(points,-2),points[0]);assert.equal(nearest([],2),null);
});
test('movimiento del puntero muestra fecha y valor; salir del gráfico oculta la guía',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 function node(){return {offsetWidth:120,offsetHeight:50,style:{},attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]||'';},append(n){this.children.push(n);},replaceChildren(){this.children=[];}};}
 const svg=node(),plot=node();plot.querySelector=()=>svg;plot.getBoundingClientRect=()=>({left:10,top:20,width:500,height:200});
 svg.getScreenCTM=()=>({inverse:()=>({})});svg.createSVGPoint=()=>({matrixTransform(){return {x:this.x/2,y:this.y/2};}});
 const c={module:{exports:{}},document:{addEventListener(){},createElement:node,createElementNS:node}};
 const src=fs.readFileSync('js/modules/dolar-month-chart.js','utf8').replace('nearest:nearest,','installCursor:installCursor,nearest:nearest,');
 vm.runInNewContext(src,c);
 const points=[{position:0,date:'2026-07-09',oficial:{value:1510}},{position:5,date:'2026-07-14',oficial:{value:1520}}];
 c.module.exports.installCursor(plot,points,p=>74+p*20,v=>v/20,'month');
 svg.onpointermove({clientX:340,clientY:100});const tip=plot.children[0];
 assert.match(tip.textContent,/14\/07\/2026/);assert.match(tip.textContent,/1.520/);assert.equal(tip.style.display,'block');
 assert.equal(tip.style.left,'342px');assert.equal(tip.style.top,'92px');
 svg.onpointermove({clientX:495,clientY:205});assert.equal(tip.style.left,'353px');assert.equal(tip.style.top,'123px');
 svg.onpointerleave();assert.equal(tip.style.display,'none');
});
test('mes: último valor válido diario sin alterar filas ni inventar ceros',()=>{
 const rows=[{fecha:'2026-10-02',ts:4,oficial:1540},{fecha:'2026-10-01',ts:3,oficial:1535,blue:0},{fecha:'2026-10-01',ts:2,oficial:1530,blue:1560},{fecha:'2026-09-30',ts:1,oficial:1500},{fecha:'2026-10-32',ts:10,oficial:9999}];
 const r=series(rows,'2026-10-10','month');assert.equal(r.length,2);assert.equal(r[0].oficial.value,1535);assert.equal(r[0].blue.value,1560);assert.equal(r[1].position,1);assert.equal(rows.length,5);
});
test('períodos vacíos, cambio de año, fin de mes y febrero',()=>{
 assert.deepEqual(series([],'2026-10-10','month'),[]);assert.equal(shift('2026-01-31','month',-1),'2025-12-01');assert.equal(shift('2026-12-10','month',1),'2027-01-01');assert.equal(series([{fecha:'2026-02-29',oficial:100}],'2026-02-01','month').length,0);assert.equal(period('2024-02-12','month').count,29);
});
test('más de 72 puntos conserva comienzo del mes y último de cada día',()=>{
 const rows=Array.from({length:100},(_,i)=>({fecha:'2026-10-'+String(1+Math.floor(i/10)).padStart(2,'0'),ts:i+1,oficial:1500+i}));const r=series(rows,'2026-10-10','month');assert.equal(r.length,10);assert.equal(r[0].oficial.value,1509);assert.equal(r[9].oficial.value,1599);
});
test('día agrupa por hora; año por mes; semana incluye cruce de año',()=>{
 const rows=[{fecha:'2026-10-01',hora:'08:00',oficial:1500},{fecha:'2026-10-01',hora:'15:00',oficial:1510},{fecha:'2026-10-10',hora:'11:00',oficial:1540},{fecha:'2026-09-30',hora:'23:00',oficial:1480}];
 assert.deepEqual(series(rows,'2026-10-01','day').map(p=>p.position),[8,15]);assert.deepEqual(series(rows,'2026-10-01','year').map(p=>p.oficial.value),[1480,1540]);assert.deepEqual(period('2026-01-01','week'),{start:'2025-12-29',end:'2026-01-04',count:7});assert.equal(shift('2026-01-01','week',-1),'2025-12-25');assert.equal(shift('2026-01-01','day',-1),'2025-12-31');
});
