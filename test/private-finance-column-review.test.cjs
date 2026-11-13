'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../js/core/private-finance-pdf');
const item=(str,x,y,width=20)=>({str,width,transform:[1,0,0,1,x,y]});
const header=[item('PESOS',470,700),item('DOLARES',540,700)];
const row=(concept,amount,y=680)=>[item('15-Oct-26',20,y,55),item(concept,90,y,240),item(amount,470,y,30)];
test('columnas corrigen dos monedas mal leídas sin cambiar importes ni el original',()=>{
 const proof=P.statementEvidence([''],[[...header,...row('SU PAGO','-2,13'),...row('INTERESES COMPENSATORIOS','0,30',660)]]);
 const reading={fields:{},movements:[{date:'2026-10-15',concept:'SU PAGO',amount:-213,currency:'USD',page:1},{date:'2026-10-15',concept:'INTERESES COMPENSATORIOS',amount:30,currency:'USD',page:1}]},before=JSON.stringify(reading);
 const r=P.reconcileEvidence(reading,proof);assert.deepEqual(r.movements.map(m=>[m.currency,m.amount]),[['ARS',-213],['ARS',30]]);assert.equal(JSON.stringify(reading),before);
});
test('pago omitido requiere signo, fecha y una sola columna; no se agrega dos veces',()=>{
 const proof=P.statementEvidence([''],[[...header,...row('SU PAGO EN PESOS','-800,00')]]),reading={fields:{},movements:[]};
 const once=P.reconcileEvidence(reading,proof),twice=P.reconcileEvidence(once,proof);assert.equal(twice.movements.length,1);assert.equal(twice.movements[0].amount,-80000);assert.equal(twice.movements[0].kind,'Pago del período anterior');
 for(const items of [row('SU PAGO','-800,00'),[...header,...row('COMPRA','-800,00')],[...header,...row('SU PAGO','800,00')],[...header,...row('SU PAGO','-800,00'),item('-800,00',540,680)]])assert.equal(P.reconcileEvidence(reading,P.statementEvidence([''],[items])).movements.length,0);
});
test('candidatos o filas duplicados no resuelven moneda por una suma',()=>{
 const rows=[...header,...row('INTERESES','1,00')],m={date:'2026-10-15',concept:'INTERESES',amount:100,currency:'USD',page:1};
 assert.deepEqual(P.reconcileEvidence({fields:{},movements:[m,m]},P.statementEvidence([''],[rows])).movements.map(m=>m.currency),['USD','USD']);
 assert.equal(P.reconcileEvidence({fields:{},movements:[m]},P.statementEvidence([''],[[...rows,...row('INTERESES','1,00',660)]])).movements[0].currency,'USD');
});
test('aviso informativo no se convierte en cargo y se conserva para revisar',()=>{
 const proof=P.statementEvidence(['Novedades débito automático\n15-Oct-26 SEGURO EJEMPLO 321 50,00']),m={date:'2026-10-15',concept:'SEGURO EJEMPLO',amount:5000,currency:'ARS',page:1,kind:'Débito a confirmar'},reading={fields:{},movements:[m]};
 const r=P.reconcileEvidence(reading,proof);assert.equal(r.movements.length,0);assert.equal(r.informationalMovements.length,1);assert.equal(reading.movements.length,1);
 const ledger=P.statementEvidence(['Novedades débito automático\n15-Oct-26 SEGURO EJEMPLO 321 50,00'],[[...header,...row('SEGURO EJEMPLO 321','50,00')]]);assert.equal(P.reconcileEvidence(reading,ledger).movements.length,1);
});
test('corrección manual es borrador, conserva IDs, cuotas y vínculos y rechaza guardados',()=>{
 const target={newFile:{name:'sintetico.pdf'},statement:{id:'s'},movements:[{id:'m',amount:321,currency:'USD',current:2,total:6,ref:'r'}]},before=JSON.stringify(target);
 const next=P.correctPendingMovement(target,'m',{amount:321,currency:'ARS'});assert.equal(JSON.stringify(target),before);assert.equal(next.movements[0].currency,'ARS');assert.equal(next.movements[0].ref,'r');assert.equal(next.movements[0].current,2);assert.equal(next.readingCorrections.length,1);
 assert.throws(()=>P.correctPendingMovement({...target,saved:true},'m',{amount:321,currency:'ARS'}));assert.throws(()=>P.correctPendingMovement(target,'m',{amount:3.21,currency:'ARS'}));assert.throws(()=>P.correctPendingMovement(target,'m',{amount:321,currency:'EUR'}));
});
test('interés sin fecha propia conserva la fecha leída y corrige sólo su moneda explícita',()=>{
 const proof=P.statementEvidence([''],[[...header,item('INTERESES COMPENSATORIOS',90,680,200),item('0,30',470,680)]]),m={date:'2026-10-29',concept:'INTERESES COMPENSATORIOS',amount:30,currency:'USD',page:1};
 const r=P.reconcileEvidence({fields:{},movements:[m]},proof);assert.equal(r.movements[0].currency,'ARS');assert.equal(r.movements[0].date,m.date);assert.equal(r.movements[0].amount,30);
});
test('aviso con guiones, referencia y símbolo de pesos permanece informativo',()=>{
 const pages=['---- Novedades débito automático ----\n20/10/2026- ASEGURADORA FICTICIA - ref.: 000000-Tarj. terminada en 0000- $ 52,00'],proof=P.statementEvidence(pages),m={date:'2026-10-20',concept:'ASEGURADORA FICTICIA',amount:5200,currency:'ARS',page:1};
 assert.equal(proof.informational.length,1);assert.equal(P.reconcileEvidence({fields:{},movements:[m]},proof).movements.length,0);
 const actual={...proof,ledger:[{date:m.date,concept:m.concept,amount:m.amount,currency:'ARS',page:2}]};assert.equal(P.reconcileEvidence({fields:{},movements:[m]},actual).movements.length,1);
});
