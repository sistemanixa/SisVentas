'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Model=require('../cotizador/client-history-model'),Account=require('../cotizador/client-account-projection'),Reader=require('../js/core/client-history-reader.v1');
async function fixture({withOther=false,unknownAmount=false}={}){
 const records=Object.fromEntries(Model.domains.map(domain=>[domain,{}]));
 records.ventas.sale={id:'V-FAKE',clienteFbKey:'c1',total:100.11};
 for(let i=0;i<121;i++)records.presupuestos['p'+i]={id:'PP-'+i,clienteFbKey:i<59?'c1':'c2',total:0.1,fecha:'2026-11-01',estado:'aprobado_int'};
 if(withOther)records.presupuestos.other={id:'PP-OTHER',cliente:'Sin vínculo de otra cuenta',total:999999,responsableUid:'other'};
 if(unknownAmount)records.presupuestos.unknown={id:'PP-UNKNOWN',clienteFbKey:'c1'};
 const built=await Model.prepare({records,customers:{clients:{c1:{nombre:'Cliente ficticio'},c2:{nombre:'Sede ficticia'}},index:{c1:{clienteKey:'c1'},c2:{clienteKey:'c1'}},structures:{c1:{principalLegacyFbKey:'c1'}}},owner:record=>record.responsableUid||'u',generation:'history-reader'}),db={};
 for(const[path,value]of Object.entries({...built.patch,sv_client_history_config:{schema:1,generation:built.generation,ready:true}})){
  const keys=path.split('/');let node=db;for(const key of keys.slice(0,-1))node=node[key]||(node[key]={});node[keys.at(-1)]=structuredClone(value);
 }
 const get=path=>path.split('/').reduce((value,key)=>value?.[key],db)??null;
 const c={uid:'u',role:'administrativo',auth:{uid:'u'},db:{},route:'historialcliente',permissionRevision:1,canReadClients:true,financialHistoryAccess:{ventas:true,pagos:true,presupuestos:true},allowedDomains:Model.domains.slice(),online:true,hidden:false,viewing:false};
 const reads=[],queries=[],states=[];let held=null;
 const reader=Reader.create({capture:()=>c,read:async path=>{reads.push(path);if(held)await held;return structuredClone(get(path));},query:async(path,spec)=>{queries.push({path,...spec});return Object.fromEntries(Object.entries(get(path)||{}).filter(([key])=>!spec.after||key>spec.after).sort(([a],[b])=>a<b?-1:1).slice(0,spec.limit));},readiness:{beginSource:()=>({ready:()=>states.push('ready'),error:()=>states.push('error'),cancel:()=>states.push('cancel')})}});
 return{db,get,c,reader,reads,queries,states,id:Account.hash('client:c1'),hold:value=>held=value};
}
test('121 historical rows load 50 at a time while every page retains the complete exact total',async()=>{
 const f=await fixture(),all=[];let cursor=null;
 do{const page=await f.reader.page(f.id,'presupuestos',{cursor});all.push(...page.rows);assert.equal(page.totalRows,121);assert.equal(page.totals.totalCents,1210);assert(page.rows.length<=50);cursor=page.cursor;}while(cursor);
 assert.equal(all.length,121);assert.equal(new Set(all.map(row=>row.key)).size,121);assert.deepEqual(f.queries.map(query=>query.limit),[50,50,50]);
 assert(f.reads.every(path=>path.startsWith(Model.ROOT+'/')||path==='sv_client_history_config'));assert(!f.reads.some(path=>path.includes('/ventas')));
});
test('physical address uses its own bounded index without assigning another address or changing domain totals',async()=>{
 const f=await fixture(),page=await f.reader.page(f.id,'presupuestos',{address:'c1'});
 assert.equal(page.totalRows,59);assert.equal(page.totals.totalCents,590);assert.equal(page.domainTotals.totalCents,1210);assert(page.rows.every(row=>row.addressKey==='c1'));assert(f.queries[0].path.includes('/addresses/'));
 await assert.rejects(f.reader.page(f.id,'presupuestos',{address:'missing'}),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});
});
test('permission, hidden, offline and viewing-as prevent all reads before entry',async()=>{
 const f=await fixture();for(const change of [{canReadClients:false},{allowedDomains:[]},{hidden:true},{online:false},{viewing:true}]){
  const old={...f.c};Object.assign(f.c,change);await assert.rejects(f.reader.page(f.id,'presupuestos'),{name:'AbortError'});Object.assign(f.c,old);
 }
 assert.equal(f.reads.length,0);assert.equal(f.queries.length,0);
});
test('session change cancels an in-flight response and never marks it ready',async()=>{
 const f=await fixture();let release;f.hold(new Promise(resolve=>release=resolve));const pending=f.reader.page(f.id,'presupuestos');await new Promise(setImmediate);f.c.uid='other';release();await assert.rejects(pending,{name:'AbortError'});assert(!f.states.includes('ready'));assert(f.states.includes('cancel'));
});
test('coverage change or mismatched frozen revision cannot render mixed totals and rows',async()=>{
 const f=await fixture(),coverage=f.get(Model.ROOT+'/coverage/u_u/presupuestos');coverage.revision=2;
 await assert.rejects(f.reader.page(f.id,'presupuestos',{expectedRevision:1}),{code:'SV_PAGE_CHANGED'});assert.equal(f.queries.length,0);
 const r=Reader.create({capture:()=>f.c,read:async path=>{const value=structuredClone(f.get(path));if(path.endsWith('/coverage/u_u/presupuestos'))value.revision=++count===1?1:2;return value;},query:async()=>Object.fromEntries(Object.entries(f.get(Model.ROOT+'/pages/u_u/'+f.id+'/presupuestos')).sort(([a],[b])=>a<b?-1:1).slice(0,50))});let count=0;
 await assert.rejects(r.page(f.id,'presupuestos'),{code:'SV_PAGE_CHANGED'});
});
test('missing rows and a forged cursor fail instead of reporting a shorter complete history',async()=>{
 const f=await fixture(),pages=f.get(Model.ROOT+'/pages/u_u/'+f.id+'/presupuestos'),first=Object.keys(pages).sort()[0];delete pages[first];
 await assert.rejects(f.reader.page(f.id,'presupuestos'),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});
 const queries=f.queries.length;await assert.rejects(f.reader.page(f.id,'presupuestos',{cursor:'12345678_'+'a'.repeat(64)}),/página/);assert.equal(f.queries.length,queries);
});
test('covered empty domain is zero but missing metadata never becomes an empty history',async()=>{
 const f=await fixture(),page=await f.reader.page(f.id,'pagos');assert.equal(page.totalRows,0);assert.deepEqual(page.rows,[]);assert.equal(f.queries.length,0);
 delete f.get(Model.ROOT+'/accounts/u_u/'+f.id).pagos;await assert.rejects(f.reader.page(f.id,'pagos'),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});
});
test('an operational tab does not request financial metadata or financial pages',async()=>{
 const f=await fixture(),page=await f.reader.page(f.id,'equipos');assert.equal(page.totalRows,0);assert(f.reads.every(path=>!path.includes('/ventas')&&!path.includes('/pagos')&&!path.includes('/presupuestos')));assert(f.reads.some(path=>path.includes('/accounts/all/')));
});
test('bad identifiers fail before IO and disabled configuration has no original-root fallback',async()=>{
 const f=await fixture();for(const [id,domain,options]of [['../bad','presupuestos',{}],[f.id,'unknown',{}],[f.id,'presupuestos',{address:'../bad'}]])await assert.rejects(f.reader.page(id,domain,options),/inválida/);
 assert.equal(f.reads.length,0);f.db.sv_client_history_config.ready=false;await assert.rejects(f.reader.page(f.id,'presupuestos'),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});assert.equal(f.queries.length,0);assert(!f.reads.some(path=>path.startsWith('sisventas/')));
});
test('incomplete address partitions and malformed amounts cannot be shown as verified totals',async()=>{
 let f=await fixture(),meta=f.get(Model.ROOT+'/accounts/u_u/'+f.id+'/presupuestos');delete meta.addresses[Object.keys(meta.addresses)[0]];
 await assert.rejects(f.reader.page(f.id,'presupuestos'),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});assert.equal(f.queries.length,0);
 f=await fixture();const pages=f.get(Model.ROOT+'/pages/u_u/'+f.id+'/presupuestos');pages[Object.keys(pages).sort()[0]].totalCents='NaN';
 await assert.rejects(f.reader.page(f.id,'presupuestos'),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});assert(!f.states.includes('ready'));
});
test('financial coverage and unlinked counters are private to the current owner, never global',async()=>{
 const f=await fixture({withOther:true}),page=await f.reader.page(f.id,'presupuestos');
 assert.equal(page.totalRows,121);assert.equal(page.unlinkedRecords,0);assert.equal(f.get(Model.ROOT+'/coverage/all/presupuestos').records,122);assert.equal(f.get(Model.ROOT+'/coverage/u_other/presupuestos').unlinkedRecords,1);
 assert(!f.reads.some(path=>path.includes('/coverage/all/')||path.includes('/u_other/')));
});
test('unprepared technical audiences are rejected before any query instead of showing a false zero',async()=>{
 const f=await fixture();f.c.role='tecnico';await assert.rejects(f.reader.page(f.id,'equipos'),{code:'SV_CLIENT_HISTORY_AUDIENCE_UNAVAILABLE'});assert.equal(f.reads.length,0);assert.equal(f.queries.length,0);
});
test('an unknown amount outside the first fifty marks the entire selected total incomplete',async()=>{
 const f=await fixture({unknownAmount:true}),page=await f.reader.page(f.id,'presupuestos');assert.equal(page.rows.length,50);assert.equal(page.totalRows,122);assert(page.rows.every(row=>row.amountKnown));assert.equal(page.completeAmounts,false);assert.equal(page.totals.unknownAmounts,1);
 const otherAddress=await f.reader.page(f.id,'presupuestos',{address:'c2'});assert.equal(otherAddress.completeAmounts,true);assert.equal(otherAddress.totals.totalCents,620);assert.equal(otherAddress.domainTotals.unknownAmounts,1);
});
test('a commission-only domain grant cannot authorize commercial history without its explicit financial permission',async()=>{
 const f=await fixture();f.c.financialHistoryAccess={};f.c.allowedDomains=['ventas','pagos','presupuestos'];
 for(const domain of f.c.allowedDomains)await assert.rejects(f.reader.page(f.id,domain),{name:'AbortError'});assert.equal(f.reads.length,0);assert.equal(f.queries.length,0);
});
