'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../js/core/record-list-model');
const image='data:image/png;base64,'+'a'.repeat(1000000);
test('OT keeps scheduling, materials and stock lineage, never embedded media or credentials',()=>{
 const source={id:'OT-1',fechaProgramada:'2020-01-01',estado:'pendiente',tecnicos:['a'],materiales:[{codigo:'P-1',cantidad:2,instalado:1,costo:0,source:{fbKey:'sale-1'},fotoBase64:image}],notas:[{texto:'texto',fotoBase64:image}],credenciales:{clave:'fixture'},firmaUrl:image};
 const before=structuredClone(source),out=M.summary('ordenes_trabajo',source);
 assert.deepEqual(source,before);assert.equal(out.fechaProgramada,'2020-01-01');assert.equal(out.materiales[0].costo,0);assert.equal(out.materiales[0].source.fbKey,'sale-1');assert.equal(out.materiales[0].cantidad,2);
 for(const field of ['notas','credenciales','firmaUrl'])assert.equal(out[field],undefined);
 assert.equal(out.materiales[0].fotoBase64,undefined);assert.ok(JSON.stringify(out).length<1000);assert.equal(out._svListSummary,true);
});
test('expenses preserve each payment amount, date, cancellation and bonus/commission identity',()=>{
 const source={fecha:'2020-01-01',monto:100,montoPagado:80,empleadoId:'a',comisionVentaId:'V-1',mesComputo:'2020-02',pagos:[{monto:80,fecha:'2020-02-01',anulado:false,comprobante:image},{monto:20,fecha:'2020-03-01',anulado:true}],fotoBase64:image,bajaAdministrativa:{ts:123,uid:'a'}};
 const out=M.summary('gastos',source);assert.equal(out.monto,100);assert.equal(out.montoPagado,80);assert.equal(out.mesComputo,'2020-02');assert.equal(out.comisionVentaId,'V-1');assert.deepEqual(out.bajaAdministrativa,source.bajaAdministrativa);
 assert.deepEqual(out.pagos.map(({monto,fecha,anulado})=>({monto,fecha,anulado})),source.pagos.map(({monto,fecha,anulado})=>({monto,fecha,anulado})));
 assert.equal(out.pagos[0].comprobante,undefined);assert.ok(out._svListAttachments.some(p=>p.join('/')==='pagos/0/comprobante'));
});
test('claims keep searchable history and old relationships without evidence bodies',()=>{
 const source={id:'R-1',descripcion:'Texto de búsqueda',cliente:'Cliente ficticio',estado:'nuevo',ts:1,otKey:'o',ventaFbKey:'v',historial:[{texto:'texto'}],evidenciaUrl:image};
 const out=M.summary('reclamos',source);assert.equal(out.ts,1);assert.equal(out.descripcion,source.descripcion);assert.equal(out.otKey,'o');assert.equal(out.ventaFbKey,'v');assert.deepEqual(out.historial,source.historial);assert.equal(out.evidenciaUrl,undefined);
});
test('summary cannot be mistaken for complete data at a write boundary',()=>{assert.throws(()=>M.requireComplete(M.summary('gastos',{monto:0})),/detalle/);assert.throws(()=>M.complete('gastos',M.summary('gastos',{monto:1})),/detalle/);assert.deepEqual(M.requireComplete({monto:0}),{monto:0});});
test('invalid domains, numbers, prototypes and too-deep records fail closed',()=>{assert.throws(()=>M.summary('ventas',{}));assert.throws(()=>M.summary('gastos',{monto:NaN}));assert.throws(()=>M.summary('gastos',JSON.parse('{"__proto__":{"a":1}}')));let deep={};for(let i=0;i<26;i++)deep={next:deep};assert.throws(()=>M.summary('gastos',deep));});
test('regular links and decimals retain precision, root UI key alone is omitted',()=>{const out=M.summary('gastos',{fbKey:'g',monto:0.123456,comprobante:'https://example.test/file.pdf',relacion:{fbKey:'other'}});assert.equal(out.monto,0.123456);assert.equal(out.comprobante,'https://example.test/file.pdf');assert.equal(out.fbKey,undefined);assert.equal(out.relacion.fbKey,'other');});

test('closed OT documentary indicators remain exact across legacy photos, duplicates and signatures',()=>{for(const record of [
 {estado:'completada',notasTecnico:[{fotoUrl:'https://example.test/a'},{fotoBase64:'data:image/png;base64,abc'}],fotos:['https://example.test/a','https://example.test/b'],firmaCliente:{base64:'data:image/png;base64,x'},conformidad:'Sí',nombreConformidad:'Cliente fixture',observacionesCierre:'Listo'},
 {estado:'con_observaciones',notasTecnico:{a:{texto:'texto',foto:{url:'https://example.test/a'}}},firmaUrl:'data:image/png;base64,x'},
 {estado:'pendiente',fotos:['https://example.test/a']}
 ]){const dto=M.summary('ordenes_trabajo',record);assert.deepEqual(dto._svListDocumental,M.documental(record));assert.equal(dto.fotos,undefined);}const complete=M.documental({estado:'cerrada',fotos:['https://example.test/a'],firmaUrl:'x',conformidad:'Sí',nombreConformidad:'A',observacionesCierre:'B'});assert.equal(complete.completo,true);assert.equal(complete.fotos,1);});
test('paired plans preserve every original and refuse stale DTOs as write payloads',()=>{const before={id:'OT-1',fotos:['data:image/png;base64,x'],secret:{nested:1}},p='sisventas/ordenes_trabajo/o',plan=M.plan(p,before,{...before,estado:'completada'},'once');assert.equal(plan[p]._svListRevision,1);assert.deepEqual(plan[p].fotos,before.fotos);assert.equal(plan[M.index+'/ordenes_trabajo/o'].fotos,undefined);assert.throws(()=>M.plan(p,before,M.summary('ordenes_trabajo',before),'bad'),/detalle/);assert.deepEqual(M.plan(p,plan[p],null,'remove'),{[p]:null,[M.index+'/ordenes_trabajo/o']:null});});
test('client and server contracts are byte-identical',()=>{const fs=require('node:fs');assert.equal(fs.readFileSync(require.resolve('../js/core/record-list-model'),'utf8'),fs.readFileSync(require.resolve('../cotizador/record-list-model'),'utf8'));});

test('an older full snapshot cannot replace a newer record even after the writer rereads it',()=>{assert.throws(()=>M.plan('sisventas/ordenes_trabajo/o',{_svListRevision:2,notes:'new'},{_svListRevision:1,notes:'old'},'stale'),/cambió/);});

test('own expense headers remove private commission fields and historic descriptions without changing amount',()=>{const original={tipoPagable:'comision',empleadoId:'emp',monto:17.50,montoPagado:5,pct:10,gananciaBase:175,descripcion:'10% de ganancia175',ventaId:'V-1',cliente:'Cliente fixture',pagos:{p:{monto:5,fecha:'2020-01-01',pct:10,gananciaBase:175,comprobante:'data:image/png;base64,x'}}},row=M.publicExpense(original);assert.equal(row.monto,17.50);assert.equal(row.montoPagado,5);assert.equal(row.pct,undefined);assert.equal(row.gananciaBase,undefined);assert.equal(row.pagos.p.monto,5);assert.equal(row.pagos.p.gananciaBase,undefined);assert.doesNotMatch(JSON.stringify(row),/ganancia175|10%/);assert.equal(original.gananciaBase,175);});

test('public commission preserves withdrawal marker and chronological order without audit bodies',()=>{const row=M.publicExpense({tipoPagable:'comision',monto:20,ts:123,bajaAdministrativa:{ts:456,motivo:'private'},pct:10});assert.equal(row.ts,123);assert.equal(row.bajaAdministrativa,true);assert.equal(row.pct,undefined);});
