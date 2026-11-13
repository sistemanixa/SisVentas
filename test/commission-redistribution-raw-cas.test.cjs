'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createBackend,apply}=require('./helpers/labor-ui-flow.cjs');
const {createCommissionOperations}=require('../cotizador/commission-operations');
const {createScopedTransaction}=require('../cotizador/labor-scoped-transaction');
const Lists=require('../js/core/record-list-model');

async function fixture(){
 const pending={tipoPagable:'comision',ventaFbKey:'sale',ventaId:'V-FICTICIA',cliente:'Cliente ficticio',empleadoFbKey:'e',gananciaBase:1000,pct:4,pctOriginal:4,monto:40,estado:'aprobado',aprobadoPor:'Autor histórico',aprobadoTs:10,legacyKey:'ctaemp/e/m',descripcion:'Descripción original conservada',audit:[{accion:'Aprobación histórica',fecha:'2026-11-01'}]};
 const paid={tipoPagable:'comision',ventaFbKey:'sale',ventaId:'V-FICTICIA',gananciaBase:1000,pct:4,monto:40,estado:'pagado',pagos:{preserved:{monto:40,fecha:'2026-11-02',referencia:'Pago histórico'}},audit:[{accion:'Pago histórico'}]};
 const move={tipo:'comision',ventaFbKey:'sale',ventaId:'V-FICTICIA',pct:4,pctOriginal:4,monto:40,gananciaBase:1000,estado:'pendiente',aprobadoPor:'Autor histórico',aprobadoTs:10};
 const f=createBackend({gastos:{pending,paid,unrelated:{tipo:'Variable',monto:123.45,pagos:{old:{monto:123.45}}}},ctaemp:{e:{m:move,other:{tipo:'bonificacion',monto:7.351,estado:'pagado'}}},ventas:{sale:{id:'V-FICTICIA',total:5000,creadorOriginalUid:'creator',responsableUid:'owner'}},pagos:{preserved:{ventaFbKey:'sale',monto:5000}},config:{maxComisionPct:10}});
 f.state.sv_permisos={admin:{indiceVersion:2,indiceRevision:7,indiceModulos:{comisiones:true},acciones:{comisiones:{distribuir:true}}}};
 const service=createCommissionOperations({auth:{verifyIdToken:async(token,revoked)=>{assert.equal(token,'FICTION');assert.equal(revoked,true);return {uid:'u'};}},db:{ref:p=>({get:async()=>({val:()=>f.get(p)})})},transaction:createScopedTransaction({guard:f.guard}),now:()=>12345});
 const actor=await service.authorize({headers:{authorization:'Bearer FICTION'}});
 const body={grupo:{clave:'sale',items:['pending','paid'].map(fbKey=>({...f.get('sisventas/gastos/'+fbKey),fbKey}))},movimientos:{pending:{...f.get('sisventas/ctaemp/e/m'),empFbKey:'e',movFbKey:'m'}},valores:[{fbKey:'pending',pct:5}]};
 return {...f,body,run:()=>service.redistribute(actor,body)};
}

async function rejectsWithoutBusinessPatch(f,message){
 const before=structuredClone(f.state.sisventas),input=structuredClone(f.body);
 await assert.rejects(f.run(),error=>error.statusCode===409&&message.test(error.message));
 assert.deepEqual(f.state.sisventas,before);
 assert.deepEqual(f.body,input);
 // The real command guard confirms completion of the comparison under its
 // fence. Its control receipt is allowed, but no business/index patch may exist;
 // the public service result above must still reject with409.
 assert.equal(f.commits.length,1);
 for(const patch of f.commits)assert(Object.keys(patch).every(p=>p==='sv_labor_guard'||p.startsWith('sv_labor_receipts/')));
 assert.equal(f.state.sv_labor_guard??null,null);
 assert.equal(Object.keys(f.state.sv_labor_receipts||{}).length,1);
}

test('redistribution accepts exact raw expenses through the real scoped guard and preserves paid history and unrelated finances',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas),input=structuredClone(f.body);
 assert.deepEqual(await f.run(),{committed:true});
 assert.equal(f.commits.length,1);
 for(const path of ['sisventas/gastos/pending','sisventas/ctaemp/e/m']){const row=f.get(path);assert.equal(row.monto,50);assert.equal(row.pct,5);assert.equal(row.pctOriginal,4);assert.equal(row.gananciaBase,1000);}
 assert.equal(f.get('sisventas/gastos/pending').estado,'pendiente_aprobacion');
 assert.deepEqual(f.get('sisventas/gastos/pending').audit,before.gastos.pending.audit);
 for(const path of ['gastos/paid','gastos/unrelated','ctaemp/e/other','ventas','pagos'])assert.deepEqual(f.get('sisventas/'+path),path.split('/').reduce((v,k)=>v[k],before));
 assert.deepEqual(f.body,input,'the captured originals are not edited to make comparison pass');
 const business=Object.keys(f.commits[0]).filter(p=>p.startsWith('sisventas/')&&!p.startsWith('sisventas/listados_resumen/')&&!p.startsWith('sisventas/empleados_gastos/'));
 assert(business.includes('sisventas/gastos/pending'));assert(business.includes('sisventas/ctaemp/e/m'));
 assert(!business.some(p=>p.startsWith('sisventas/ventas/')||p.startsWith('sisventas/pagos/')||p==='sisventas/gastos/paid'));
 assert(!f.reads.some(([,p])=>['sisventas','sisventas/gastos','sisventas/ctaemp','sisventas/ventas','sisventas/pagos'].includes(p)));
});

for(const [name,project]of [['private list summary',raw=>Lists.summary('gastos',raw)],['public commission summary',raw=>Lists.publicExpense(raw)]])test('redistribution rejects the actual '+name+' with409 instead of comparing it as a raw original',async()=>{
 const f=await fixture();f.body.grupo.items=f.body.grupo.items.map(row=>({...project(row),fbKey:row.fbKey}));
 assert.equal(f.body.grupo.items[0]._svListSummary,true);
 assert.notDeepEqual(f.body.grupo.items[0],f.get('sisventas/gastos/pending'));
 await rejectsWithoutBusinessPatch(f,/comisión cambió/);
});

test('removing only summary markers cannot authorize a public commission summary with missing original fields',async()=>{
 const f=await fixture();f.body.grupo.items=f.body.grupo.items.map(row=>{const summary=Lists.publicExpense(row);for(const key of Object.keys(summary))if(key.startsWith('_sv'))delete summary[key];return {...summary,fbKey:row.fbKey};});
 assert.equal('gananciaBase' in f.body.grupo.items[0],false);
 assert.equal('pct' in f.body.grupo.items[0],false);
 await rejectsWithoutBusinessPatch(f,/comisión cambió/);
});

for(const [name,patch,message]of [
 ['expense payment',{'sisventas/gastos/pending/pagos/new':{monto:10,fecha:'2026-11-13'}},/comisión cambió/],
 ['expense edit',{'sisventas/gastos/pending/descripcion':'Edición concurrente ficticia'},/comisión cambió/],
 ['expense amount',{'sisventas/gastos/pending/monto':41},/comisión cambió/],
 ['linked movement payment',{'sisventas/ctaemp/e/m/pagos/new':{monto:10}},/movimiento cambió/],
 ['linked movement edit',{'sisventas/ctaemp/e/m/pct':4.5},/movimiento cambió/]
])test('a concurrent '+name+' after raw capture returns409 without any redistribution patch',async()=>{
 const f=await fixture();apply(f.state,patch);await rejectsWithoutBusinessPatch(f,message);
});
