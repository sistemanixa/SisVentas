'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {M,seed,run,statement}=require('./helpers/private-finance-fixtures.cjs'),P=require('../js/core/private-finance-pdf');
const f=(value,original)=>({value,original,page:1,origin:'PDF · IA'});
test('próximo ciclo se guarda por resumen; una revisión sin fechas conserva manuales, pagos e historial',()=>{
 let s=run(seed(),'statement-cycle-save',{id:statement.id,nextClose:'2026-10-29',nextDue:'2026-11-11'});
 s=run(s,'payment-save',{id:'payment-cycle',statement:statement.id,date:'2026-10-10',amount:10000,currency:'ARS',type:'Mínimo'});
 s=run(s,'statement-save',statement);assert.equal(s.statements[0].nextClose,'2026-10-29');assert.equal(s.payments.length,1);assert.equal(s.statements[0].versions.length,2);
 s=run(s,'statement-save',{...statement,id:'older',period:'2026-09',close:'2026-09-01',due:'2026-09-10',nextClose:'2026-09-29',nextDue:'2026-10-11'});
 assert.equal(M.latest(s,statement.card).nextClose,'2026-10-29');
 assert.throws(()=>run(s,'statement-save',{...statement,id:'newer',period:'2026-10',close:'2026-10-02'}),e=>e.statusCode===409);
});
test('nuevo período no hereda fechas vencidas; PDF explícito reemplaza el próximo ciclo de su propia revisión',()=>{
 let s=run(seed(),'statement-save',{...statement,nextClose:'2026-10-29',nextDue:'2026-11-11'});
 s=run(s,'statement-save',{...statement,nextClose:'2026-10-30',nextDue:'2026-11-12'});assert.equal(s.statements[0].versions.at(-1).previous.nextClose,'2026-10-29');
 s=run(s,'statement-save',{...statement,id:'older',period:'2026-09',close:'2026-09-01',due:'2026-09-10'});assert.equal(s.statements.find(x=>x.id==='older').nextClose,null);
});
test('fechas inválidas y ciclo invertido se rechazan, limpiar campos es explícito',()=>{
 const s=seed();for(const dates of [{nextClose:'2026-02-30'},{nextClose:statement.close},{nextDue:'2026-09-20'},{nextClose:'2026-10-29',nextDue:'2026-10-28'}])assert.throws(()=>run(s,'statement-cycle-save',{id:statement.id,...dates}),e=>e.statusCode===400);
 let x=run(s,'statement-cycle-save',{id:statement.id,nextClose:'2026-10-29',nextDue:'2026-11-11'});x=run(x,'statement-cycle-save',{id:statement.id,nextClose:'',nextDue:''});assert.equal(x.statements[0].nextClose,null);assert.equal(x.statements[0].nextDue,null);
});
test('días restantes de calendario: hoy, pasado, diciembre–enero y año bisiesto',()=>{
 assert.equal(M.daysUntil(null,'2026-10-22'),null);assert.equal(M.daysUntil('2026-10-22','2026-10-22'),0);assert.equal(M.daysUntil('2026-10-21','2026-10-22'),-1);assert.equal(M.daysUntil('2027-01-02','2026-12-30'),3);assert.equal(M.daysUntil('2028-03-01','2028-02-28'),2);
});
test('lector conservador reconoce próximos rotulados, no fechas sueltas, y conserva página',()=>{
 const out=P.parse(['Cierre: 27/09/2026\nVencimiento: 02/10/2026\nPróximo cierre: 27/10/2026\nPróximo vencimiento:\n02/11/2026']);assert.equal(out.fields.close.value,'2026-09-27');assert.equal(out.fields.nextClose.value,'2026-10-27');assert.equal(out.fields.nextDue.value,'2026-11-02');assert.equal(out.fields.nextDue.page,1);
 assert.deepEqual(P.cycleEvidence(['22/10/2026\n02/11/2026'],'2026-09-24').fields,{});
});
test('años ausentes del próximo ciclo se resuelven por el cierre, no por el año de carga',()=>{
 const x={fields:{close:f('2024-12-27','27 de diciembre'),due:f('2024-01-02','2 de enero'),nextClose:f('2024-01-27','27 de enero'),nextDue:f('2024-02-02','2 de febrero')},movements:[]};
 const out=P.calendar(x,'2027-01-03');assert.equal(out.fields.close.value,'2026-12-27');assert.equal(out.fields.nextClose.value,'2027-01-27');assert.equal(out.fields.nextDue.value,'2027-02-02');assert.equal(x.fields.nextClose.value,'2024-01-27');
 const proof=P.cycleEvidence(['Próximo cierre: 27 de enero\nPróximo vencimiento: 2 de febrero'],'2026-12-27');assert.equal(proof.fields.nextClose.value,'2027-01-27');assert.equal(proof.fields.nextDue.value,'2027-02-02');
});
test('conflicto local/IA y valores repetidos diferentes quedan pendientes, sin elegir una fecha',()=>{
 const proof=P.cycleEvidence(['Próximo cierre: 27/10/2026'],'2026-09-27');const out=P.mergeCycleEvidence({fields:{nextClose:f('2026-10-28','28/10/2026')},movements:[]},proof);assert.equal(out.fields.nextClose,undefined);assert.equal(out.warnings.length,1);
 assert.equal(P.cycleEvidence(['Próximo cierre: 27/10/2026\nPróximo cierre: 28/10/2026'],'2026-09-27').fields.nextClose,undefined);
 const conflict=P.cycleEvidence(['Próximo cierre: 27/10/2026\nPróximo cierre: 28/10/2026'],'2026-09-27');assert.equal(P.mergeCycleEvidence({fields:{nextClose:f('2026-10-27','27/10/2026')}},conflict).fields.nextClose,undefined);
});
test('esquema IA admite próximos con evidencia sin cambiar cierre ni vencimiento actual',()=>{
 const {normalize}=require('../cloud-functions/asistente/statement-import.cjs');const out=normalize({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({pages:1,fields:{close:f('2026-09-24','24/09/26'),due:f('2026-10-05','05/10/26'),nextClose:f('2026-10-22','Próximo cierre 22/10/26'),nextDue:f('2026-11-02','Próximo vencimiento 02/11/26')},movements:[],warnings:[]})}]});assert.equal(out.fields.nextClose.value,'2026-10-22');assert.equal(out.fields.due.value,'2026-10-05');
});
test('vistas muestran próximos, días, desconocidos y fecha pasada sin declarar deuda impaga',()=>{
 const src=fs.readFileSync('js/modules/private-finance-ui.js','utf8'),c={M,Date,date:x=>x||'Sin dato',button:()=>'',state:seed()};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('function cycleStatus('),src.indexOf('function cycleEdit(')),c);
 assert.match(c.cycleSummary({}),/Próximo cierre/);assert.match(c.cycleSummary({}),/Sin dato/);assert.match(c.cycleStatus('2026-01-01','due'),/Fecha pasada/);assert.doesNotMatch(c.cycleStatus('2026-01-01','due'),/impag|deuda|mora/i);
 assert.equal(fs.readFileSync('cotizador/private-finance-model.js','utf8'),fs.readFileSync('js/core/private-finance-model.js','utf8'));
});
