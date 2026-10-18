'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../js/core/private-finance-pdf');
test('cargo punitorio usa la columna del cargo y no la base ni dólares inventados',()=>{
 const proof=P.statementEvidence(['26 Setiem. 24 IMPUESTO DE SELLOS $ 10,00\n24 PUNIT. PAG.MIN.ANTERIOR $ 8.000,00 80,00']);
 const reading={fields:{},warnings:[],movements:[{concept:'PUNIT. PAG.MIN.ANTERIOR',amount:800000,currency:'ARS',date:'2026-09-24',page:1},{concept:'PUNIT. PAG.MIN.ANTERIOR (USD)',amount:8000,currency:'USD',date:'2026-09-24',page:1}]},before=JSON.stringify(reading);
 const r=P.reconcileEvidence(reading,proof);assert.equal(r.movements.length,1);assert.equal(r.movements[0].amount,8000);assert.equal(r.movements[0].currency,'ARS');assert.equal(r.movements[0].amountSource.page,1);assert.equal(JSON.stringify(reading),before);
});
test('sin columna explícita o con candidatos ambiguos no corrige cifras para conciliar',()=>{
 const m={concept:'PUNIT. PAG.MIN.ANTERIOR',amount:7000,currency:'ARS',date:'2026-09-24',page:1},reading={fields:{},movements:[m]};
 assert.equal(P.reconcileEvidence(reading,P.statementEvidence(['24 PUNIT. PAG.MIN.ANTERIOR 8.000,00 80,00'])).movements[0].amount,7000);
 const proof=P.statementEvidence(['26 Setiem. 24 PUNIT. PAG.MIN.ANTERIOR $ 8.000,00 80,00']);assert.equal(P.reconcileEvidence(reading,proof).movements[0].amount,7000);
 assert.equal(P.reconcileEvidence({...reading,movements:[{...m,amount:800000},{...m,amount:800000}]},proof).movements.length,2);
});
test('fechas año mes día y continuación se cotejan con importe y concepto únicos',()=>{
 const proof=P.statementEvidence(['26 Setiem. 01 SU PAGO EN PESOS 10,00-\n08 SU PAGO EN PESOS 20,00-\n26 Abril 28 000111 * COMPRA EJEMPLO C.05/06 30,00']);
 const r=P.reconcileEvidence({fields:{},movements:[{concept:'SU PAGO EN PESOS',amount:-1000,currency:'ARS',date:'2026-09-26',page:1},{concept:'COMPRA EJEMPLO',amount:3000,currency:'ARS',date:'2026-04-26',page:1}]},proof);
 assert.deepEqual(r.movements.map(m=>m.date),['2026-09-01','2026-04-28']);
});
test('saldo anterior bruto excluye la fila de encabezado y conserva el pago como movimiento',()=>{
 const proof=P.statementEvidence(['Tarjeta de crédito\nSaldo del periodo anterior $ 800,00','27/ago Total a pagar del periodo anterior $ 1.000,00\n30/ago Pago del resumen -$ 200,00']);
 const r=P.reconcileEvidence({fields:{bank:{value:'Mercado Pago'},previous:{value:80000}},movements:[{concept:'Total a pagar del periodo anterior',currency:'ARS',amount:100000},{concept:'Pago del resumen',currency:'ARS',amount:-20000}]},proof);
 assert.equal(r.fields.previous.value,100000);assert.equal(r.movements.length,1);assert.equal(r.movements[0].amount,-20000);assert.equal(r.fields.brand.value,'Crédito');
 assert.equal(P.reconcileEvidence({fields:{brand:{value:'Visa'}},movements:[]},proof).fields.brand.value,'Visa');
});
test('saldo anterior no coincidente o evidencia duplicada exige revisión',()=>{
 const proof=P.statementEvidence(['Saldo del periodo anterior $ 800,00\n27/ago Total a pagar del periodo anterior $ 1.000,00']);
 assert.equal(P.reconcileEvidence({fields:{previous:{value:70000}},movements:[]},proof).fields.previous.value,70000);
 proof.openings.push(proof.openings[0]);assert.equal(P.reconcileEvidence({fields:{previous:{value:80000}},movements:[]},proof).fields.previous.value,80000);
 assert.equal(P.decimal('1234.567,89'),123456789);assert.equal(P.decimal('1.00,00'),null);
});
test('referencia monetaria del comercio no se duplica como otro cargo; requiere columnas verificables',()=>{
 const item=(str,x,y,width=20)=>({str,transform:[1,0,0,1,x,y],width});
 const items=[item('PESOS',470,400),item('DOLARES',530,400),item('12-Sep-26',30,380),item('SERVICIO EJEMPLO (USA,ARS, 1500,00)',90,380,220),item('00999',300,380),item('1,00',535,380)];
 const proof={references:P.currencyReferences([items])},ars={concept:'SERVICIO EJEMPLO (USA,ARS)',date:'2026-09-12',currency:'ARS',amount:150000,page:1},usd={...ars,currency:'USD',amount:100};
 assert.equal(proof.references.length,1);assert.equal(proof.references[0].charge.currency,'USD');
 const r=P.reconcileEvidence({fields:{},movements:[ars,usd]},proof);assert.equal(r.movements.length,1);assert.equal(r.movements[0].amount,100);
 assert.equal(P.reconcileEvidence({fields:{},movements:[ars]},proof).movements.length,1);
 assert.equal(P.currencyReferences([items.filter(i=>i.str!=='DOLARES')]).length,0);
});
test('fechas cortas del documento aportan evidencia y no cambian el año leído',()=>{
 const proof=P.statementEvidence(['28/sep Intereses de financiación $ 10,00']);
 const r=P.reconcileEvidence({fields:{},movements:[{date:'2024-09-28',page:1,concept:'Intereses de financiación',amount:1000,currency:'ARS'}]},proof);
 assert.equal(r.movements[0].dateEvidence.date,'2024-09-28');assert.match(r.movements[0].dateEvidence.original,/28\/sep/);
});
test('saldo anterior USD cero sólo se incorpora si está impreso bajo columnas explícitas',()=>{
 const reading={fields:{},movements:[]},proof=P.statementEvidence(['PESOS DÓLARES\nSALDO ANTERIOR 100,00 0,00']);
 assert.equal(P.reconcileEvidence(reading,proof).fields.previousUSD.value,0);
 assert.equal(P.reconcileEvidence(reading,P.statementEvidence(['SALDO ANTERIOR 100,00'])).fields.previousUSD,undefined);
});
test('modelo acepta fecha impresa posterior al cierre hasta vencimiento y rechaza evidencia falsa o manual',()=>{
 const {seed,run,statement}=require('./helpers/private-finance-fixtures.cjs');
 const m={id:'printed-date',date:'2026-10-02',page:1,dateSource:'documento',dateEvidence:{date:'2026-10-02',page:1,original:'02/oct Intereses de financiación $ 1.000,01'},origin:'PDF',concept:'Intereses',currency:'ARS',amount:100001,kind:'Interés'};
 const data={...statement,id:'printed-statement',period:'2026-09',movements:[m],reconciliation:'',extracted:{}};
 assert.equal(run(seed(),'statement-save',data).statements.at(-1).total,100001);
 for(const change of [{origin:'Manual'},{date:'2026-10-21'},{dateEvidence:{...m.dateEvidence,original:'01/oct Intereses'}},{dateEvidence:{...m.dateEvidence,page:2}}])assert.throws(()=>run(seed(),'statement-save',{...data,movements:[{...m,...change}]}));
});
test('dólares también deben conciliar y un centavo de diferencia bloquea el servidor',()=>{
 const {seed,run,statement}=require('./helpers/private-finance-fixtures.cjs');
 const data={...statement,id:'usd-statement',period:'2026-09',previous:0,total:0,usd:125,extracted:{previousUSD:{value:100,page:1,original:'Saldo anterior USD 1,00',origin:'PDF'}},reconciliation:'',movements:[{id:'usd-movement',date:'2026-10-01',concept:'Consumo',currency:'USD',amount:25,kind:'Consumo'}]};
 assert.equal(run(seed(),'statement-save',data).statements.at(-1).usd,125);assert.throws(()=>run(seed(),'statement-save',{...data,usd:126}),/no concilian/);
});
