const {test}=require('node:test'),assert=require('node:assert/strict');
const {monthlyWindow,validatePeriods}=require('../js/catalog-promotions');
const at=s=>Date.parse(s+'-03:00');
test('usa períodos guardados y respeta apertura, cierre inclusivo y próxima apertura',()=>{
 const rows=[{nombre:'Especial',inicio:5,fin:7},{nombre:'Última',inicio:25,fin:31}];
 assert.equal(monthlyWindow(at('2026-10-01T12:00:00'),rows).proximaApertura,at('2026-10-05T00:00:00'));
 assert.equal(monthlyWindow(at('2026-10-07T23:59:59'),rows).abierto,true);
 assert.equal(monthlyWindow(at('2026-10-08T00:00:00'),rows).abierto,false);
 assert.equal(monthlyWindow(at('2027-02-28T23:59:59'),rows).fin,at('2027-03-01T00:00:00'));
 assert.equal(monthlyWindow(at('2026-12-31T23:59:59'),rows).abierto,true);
});
test('rechaza períodos superpuestos, vacíos o inválidos',()=>{
 for(const rows of [[],[{nombre:'A',inicio:1,fin:10},{nombre:'B',inicio:10,fin:15}],[{nombre:'',inicio:1,fin:2}],[{nombre:'A',inicio:2.5,fin:4}],[{nombre:'A',inicio:30,fin:29}]])assert.throws(()=>validatePeriods(rows));
});
