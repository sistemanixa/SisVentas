const {test}=require('node:test'),assert=require('node:assert/strict');
const {series,period,shift}=require('../js/modules/dolar-month-chart');
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
