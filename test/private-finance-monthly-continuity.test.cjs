'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {M,actor,card,statement}=require('./helpers/private-finance-fixtures.cjs');
let n=0;const run=(s,type,data)=>M.apply(s,{id:'monthly-'+(++n),type,revision:s.revision,data},actor,{now:Date.parse('2026-12-20T12:00:00Z'),digest:'fixture-'+n}).state;
const base=()=>run(M.empty(actor.uid),'card-save',card);
const rows=p=>[{id:'insurance-'+p,date:p+'-01',concept:'ASEGURADORA FICTICIA',ref:'POLIZA-001',amount:5000,currency:'ARS',kind:'Seguro'},{id:'quota-'+p,date:'2026-09-01',concept:'COMPRA FICTICIA',ref:'COMPRA-001',amount:2000,currency:'ARS',kind:'Cuota',current:Number(p.slice(-2))-8,total:3}];
const data=(p,m=rows(p))=>({...statement,id:'st-'+p,period:p,close:p+'-15',due:p+'-25',movements:m,total:7000,usd:0});
test('tres meses conservan una tarjeta, seguro gestionado y compra; no duplican liberación',()=>{
 let s=run(base(),'statement-save',data('2026-09'));const insurance=s.insurances[0];
 s=run(s,'insurance-save',{...insurance,name:'Nombre elegido',coverage:'Cobertura revisada',decision:'Mantener',portalUrl:'https://example.invalid/portal',note:'Gestión previa'});
 s=run(s,'payment-save',{statement:'st-2026-09',amount:1000,currency:'ARS',date:'2026-09-20',type:'Parcial'});
 for(const p of ['2026-10','2026-11'])s=run(s,'statement-save',data(p));
 assert.equal(s.cards.length,1);assert.equal(s.statements.length,3);assert.equal(s.insurances.length,1);assert.equal(s.installments.length,1);
 assert.equal(s.insurances[0].name,'Nombre elegido');assert.equal(s.insurances[0].coverage,'Cobertura revisada');assert.equal(s.insurances[0].decision,'Mantener');assert.equal(s.insurances[0].note,'Gestión previa');assert.equal(s.insurances[0].charges.length,3);
 assert.equal(s.installments[0].current,3);assert.equal(M.quota(s.installments[0]).release,'2026-12');assert.equal(s.installments[0].observations.length,3);assert.equal(s.payments.length,1);assert.equal(M.totalDebt(s),7000);
 const before=structuredClone(s.installments[0]);s=run(s,'statement-save',data('2026-09'));assert.equal(s.installments[0].period,before.period);assert.equal(s.installments[0].current,3);assert.equal(s.installments[0].observations.length,3);
});
test('referencia modificada requiere elegir, conserva gestión y no fusiona automáticamente',()=>{
 let s=run(base(),'statement-save',data('2026-09')),d=data('2026-10');d.movements[0].ref='POLIZA-002';
 assert.equal(M.continuity(s,d)[0].selected,'');assert.throws(()=>run(s,'statement-save',d),/Revisá si/);
 const snapshot=structuredClone(s);d.movements[0].insuranceId=s.insurances[0].id;s=run(s,'statement-save',d);assert.equal(s.insurances.length,1);assert.deepEqual(snapshot.statements,s.statements.slice(0,1));
});
test('otro seguro y otra compra se crean sólo cuando se elige nuevo, sin fusionar pólizas',()=>{
 let s=run(base(),'statement-save',data('2026-09')),d=data('2026-10');d.movements[0].insuranceNew=true;d.movements[1].installmentNew=true;
 s=run(s,'statement-save',d);assert.equal(s.insurances.length,2);assert.equal(s.installments.length,2);
});
test('no vincula tarjeta/moneda distinta ni calendario incompatible ni dos cargos a una ficha',()=>{
 const s=run(base(),'statement-save',data('2026-09'));let d=data('2026-10');d.movements[0].insuranceId=s.insurances[0].id;d.movements[0].currency='USD';assert.throws(()=>run(s,'statement-save',d),/tarjeta y moneda/);
 d=data('2026-10');d.movements[1].current=1;d.movements[1].installmentId=s.installments[0].id;assert.throws(()=>run(s,'statement-save',d),/calendario/);
 d=data('2026-10');d.movements.push({...d.movements[0],id:'another',insuranceId:s.insurances[0].id});assert.throws(()=>run(s,'statement-save',d),/Dos cargos/);
});
test('importes nuevos se reflejan sin cambiar el histórico ni rejuvenecerlo al revisar',()=>{
 let s=run(base(),'statement-save',data('2026-09')),d=data('2026-10');d.movements[0].amount=5500;s=run(s,'statement-save',d);assert.equal(s.insurances[0].amount,5500);assert.equal(s.movements.find(m=>m.id==='insurance-2026-09').amount,5000);
 s=run(s,'statement-save',data('2026-09'));assert.equal(s.insurances[0].amount,5500);
});
test('un consumo reconocido conserva seguro gestionado aunque el nuevo PDF no lo marque seguro',()=>{
 let s=run(base(),'statement-save',data('2026-09')),d=data('2026-10');d.movements[0].kind='Consumo';
 s=run(s,'statement-save',d);assert.equal(s.insurances.length,1);assert.equal(s.insurances[0].charges.length,2);
 const q=s.installments[0];s=run(s,'installment-save',{...q,note:'Observación conservada'});assert.equal(s.installments[0].observations.length,2);
});
test('un cargo ya gestionado no se separa de su ficha al revisar el mismo período',()=>{
 const s=run(base(),'statement-save',data('2026-09')),d=data('2026-09');d.movements[0].insuranceNew=true;
 assert.throws(()=>run(s,'statement-save',d),/ya tiene una ficha/);
});
