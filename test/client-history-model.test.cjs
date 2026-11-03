'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../cotizador/client-history-model'),A=require('../cotizador/client-account-projection');
function fixture(){return{records:Object.fromEntries(H.domains.map(domain=>[domain,{}])),customers:{clients:{c1:{nombre:'Persona ficticia',dir:'Sede uno'},c2:{nombre:'Persona ficticia',dir:'Sede dos'}},index:{},structures:{}},owner:()=> 'u',generation:'history-fake'};}
const rows=(result,domain,scope='all')=>Object.entries(result.patch).filter(([path])=>path.startsWith(H.ROOT+'/pages/'+scope+'/')&&path.includes('/'+domain+'/')).map(([,row])=>row);
const meta=(result,id='client:c1',scope='all')=>({domains:Object.fromEntries(H.domains.map(domain=>[domain,result.patch[H.ROOT+'/accounts/'+scope+'/'+A.hash(id)+'/'+domain]?.totals]))});
test('requires every source explicitly, including empty domains and customer directory',async()=>{
 for(const domain of H.domains){const f=fixture();delete f.records[domain];await assert.rejects(H.prepare(f),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});}
 const f=fixture();delete f.customers.index;await assert.rejects(H.prepare(f),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});
 const built=await H.prepare(fixture());assert.equal(built.records,0);for(const domain of H.domains)assert.equal(built.patch[H.ROOT+'/coverage/all/'+domain].records,0);
});
test('preserves originals and exact cents while summaries exclude costs, credentials and media',async()=>{
 const f=fixture();f.records.ventas.s={id:'V-FAKE',clienteFbKey:'c1',cliente:'Persona ficticia',total:100.11,fecha:'2026-10-01',items:[{qty:1,costoUnitarioCompra:40,foto:'PRIVATE_MEDIA'}],credenciales:'PRIVATE_CREDENTIALS'};
 f.records.pagos.p={ventaFbKey:'s',fecha:'2026-10-02',monto:20.03,comprobanteAdjunto:{data:'PRIVATE_RECEIPT'}};
 const before=structuredClone(f.records),built=await H.prepare(f),summary=meta(built).domains;
 assert.deepEqual(f.records,before);assert.deepEqual(summary.ventas,{rows:1,totalCents:10011,paidCents:2003,balanceCents:8008,receivedCents:0,unknownAmounts:0});
 assert.equal(summary.pagos.receivedCents,2003);assert.equal(rows(built,'ventas')[0].paidCents,2003);
 const serialized=JSON.stringify(built.patch);assert.doesNotMatch(serialized,/PRIVATE_|costoUnitarioCompra|credenciales|comprobanteAdjunto/);
});
test('same names never merge physical customers or their domiciles',async()=>{
 const f=fixture();for(const key of ['c1','c2'])f.records.ventas[key]={id:'V-'+key,clienteFbKey:key,cliente:'Persona ficticia',total:100};
 const built=await H.prepare(f);assert.equal(meta(built,'client:c1').domains.ventas.rows,1);assert.equal(meta(built,'client:c2').domains.ventas.rows,1);
 assert.deepEqual(rows(built,'ventas').map(row=>row.addressKey).sort(),['c1','c2']);
});
test('linked operational records inherit a verified sale domicile; contradictory customers fail closed',async()=>{
 const f=fixture();f.records.ventas.s={id:'V1',clienteFbKey:'c1',total:100};f.records.ordenes_trabajo.ot={id:'OT-FAKE',ventaFbKey:'s',fechaProgramada:'2026-11-03'};
 const built=await H.prepare(f),row=rows(built,'ordenes_trabajo')[0];assert.equal(row.identity.accountKey,'client:c1');assert.equal(row.addressKey,'c1');assert.equal(row.saleKey,'s');
 assert.equal(rows(built,'ordenes_trabajo','u_u').length,0,'does not guess technician audiences before reader policy');
 f.records.ordenes_trabajo.ot.clienteFbKey='c2';await assert.rejects(H.prepare(f),/contradice/);
});
test('unknown or conflicting technical sale keys never fall back to a name or visible sale number',async()=>{
 const f=fixture();f.records.ventas.s={id:'V1',clienteFbKey:'c1',total:100};f.records.reclamos.r={ventaFbKey:'missing',ventaId:'V1',cliente:'Persona ficticia'};
 let built=await H.prepare(f),row=rows(built,'reclamos')[0];assert.equal(row.identity.status,'ambiguous');assert.equal(meta(built).domains.reclamos.rows,0);
 f.records.reclamos.r.ventaKey='s';built=await H.prepare(f);assert.equal(rows(built,'reclamos')[0].identity.status,'ambiguous');
});
test('embedded equipment and tickets are retained, and only explicit global links suppress duplicates',async()=>{
 const f=fixture();f.records.ventas.s={id:'V1',clienteFbKey:'c1',total:100,equipos:[{fbKey:'global',serie:'SERIE1',foto:'PRIVATE'},{serie:'SERIE2',modelo:'Equipo ficticio',costo:22}],tickets:[{descripcion:'Revisión ficticia',prioridad:'baja'}]};
 f.records.equipos.global={serie:'SERIE1',ventaFbKey:'s',clienteFbKey:'c1'};
 const built=await H.prepare(f),equipment=rows(built,'equipos');assert.equal(equipment.length,2);assert.equal(rows(built,'tickets').length,1);assert.equal(equipment.filter(row=>row.embedded).length,1);assert.equal(equipment.find(row=>row.embedded).embeddedIndex,1);assert.equal(equipment.find(row=>row.embedded).embeddedToken.length,64);assert.doesNotMatch(JSON.stringify(built.patch),/PRIVATE|"costo"/);
 f.records.equipos.global.clienteFbKey='c2';await assert.rejects(H.prepare(f),/contradice/);
});
test('full domain manifests retain more than fifty rows and exact aggregates',async()=>{
 const f=fixture();for(let i=0;i<121;i++)f.records.presupuestos['p'+i]={id:'PP-FAKE-'+i,clienteFbKey:'c1',total:0.1,fecha:'2026-11-01',estado:'aprobado_int'};
 const built=await H.prepare(f);assert.equal(rows(built,'presupuestos').length,121);assert.equal(meta(built).domains.presupuestos.totalCents,1210);assert.equal(meta(built).domains.presupuestos.rows,121);assert.equal(built.patch[H.ROOT+'/coverage/all/presupuestos'].records,121);
});
test('cancelled sales and overpayments keep displayed amounts separate from canonical debt totals',async()=>{
 const f=fixture();f.records.ventas.s={id:'V1',clienteFbKey:'c1',total:100};f.records.pagos.p={ventaFbKey:'s',monto:120};
 let built=await H.prepare(f);assert.equal(rows(built,'ventas')[0].paidCents,12000);assert.equal(meta(built).domains.ventas.paidCents,10000);assert.equal(meta(built).domains.pagos.receivedCents,12000);assert.equal(meta(built).domains.ventas.balanceCents,0);
 f.records.ventas.s.anulada=true;built=await H.prepare(f);assert.equal(rows(built,'ventas')[0].totalCents,10000);assert.equal(meta(built).domains.ventas.totalCents,0);assert.equal(meta(built).domains.pagos.receivedCents,12000);
});
test('historical budget aliases preserve stored zero and cents; a missing amount is unknown, never recomputed',async()=>{
 const f=fixture();f.records.presupuestos.zero={id:'PP-ZERO',clienteFbKey:'c1',total:0};f.records.presupuestos.alias={id:'PP-ALIAS',clienteFbKey:'c1',importeTotal:'120.34'};f.records.presupuestos.unknown={id:'PP-UNKNOWN',clienteFbKey:'c1',items:[{qty:1,punit:999999}]};const before=structuredClone(f.records),built=await H.prepare(f),list=rows(built,'presupuestos');
 assert.equal(list.find(row=>row.key==='zero').amountKnown,true);assert.equal(list.find(row=>row.key==='zero').totalCents,0);assert.equal(list.find(row=>row.key==='alias').totalCents,12034);assert.equal(list.find(row=>row.key==='unknown').amountKnown,false);assert.equal(meta(built).domains.presupuestos.totalCents,12034);assert.equal(meta(built).domains.presupuestos.unknownAmounts,1);assert.deepEqual(f.records,before);
});
test('canonical embedded payments survive history, but any global payment prevents their resurrection',async()=>{
 const f=fixture();f.records.ventas.s={id:'V-EMBEDDED',clienteFbKey:'c1',total:100,totalPagado:30,pagos:[{fecha:'2026-10-01',monto:10.01,medio:'Efectivo',comprobanteAdjunto:{data:'PRIVATE_RECEIPT'}},{fecha:'2026-10-02',monto:19.99}]};
 let built=await H.prepare(f),payments=rows(built,'pagos');assert.equal(payments.length,2);assert(payments.every(row=>row.embedded&&row.saleNumber==='V-EMBEDDED'));assert.equal(meta(built).domains.pagos.receivedCents,3000);assert.equal(rows(built,'ventas')[0].paymentStatus,'seniado');assert.equal(built.patch[H.ROOT+'/coverage/all/pagos'].originalRecords,0);assert.doesNotMatch(JSON.stringify(built.patch),/PRIVATE_RECEIPT/);
 f.records.pagos.p={ventaFbKey:'s',monto:30,anulado:true};built=await H.prepare(f);payments=rows(built,'pagos');assert.equal(payments.length,1);assert.equal(payments[0].cancelled,true);assert.equal(meta(built).domains.pagos.receivedCents,0);assert.equal(rows(built,'ventas')[0].paymentStatus,'pendiente_pago');assert.equal(rows(built,'ventas')[0].paymentSource,'global');
 delete f.records.pagos.p;delete f.records.ventas.s.pagos;built=await H.prepare(f);assert.equal(rows(built,'pagos').length,0);assert.equal(rows(built,'ventas')[0].paymentSource,'legacy');assert.equal(meta(built).domains.ventas.paidCents,3000);
});
