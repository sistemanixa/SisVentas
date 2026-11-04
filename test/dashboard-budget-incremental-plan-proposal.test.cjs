'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../cotizador/dashboard-budget-projection-proposal'),I=require('../cotizador/dashboard-budget-incremental-plan-proposal');
const {digest,createLaborGuard}=require('../cotizador/labor-guard'),{createBackend,apply}=require('./helpers/labor-ui-flow.cjs');
const {normalizeRtdb}=require('../cotizador/payment-membership-index');
const vm=require('node:vm'),{functionSource}=require('./helpers/app-functions.cjs');
function authority(){return {users:{admin:{uid:'u',nombre:'Admin ficticio',rol:'admin',activo:true},a:{uid:'one',nombre:'Uno',rol:'vendedor',activo:true},b:{uid:'two',nombre:'Dos',rol:'administrativo',activo:true}},identities:{u:{activo:true,rol:'admin'},one:{activo:true,rol:'vendedor'},two:{activo:true,rol:'administrativo'}},permissions:{}};}
const budget=(extra={})=>({id:'PP-FICTICIO',responsableUid:'one',clienteFbKey:'c',cliente:'Cliente ficticio',fecha:'2026-11-04',vence:'2026-11-05',estado:'borrador',ts:100,total:100,subtotal:100,iva:0,conIva:false,descuento:0,items:[{cod:'FICTICIO',qty:1,punit:100,sub:100,costoUnitarioCompra:20}],foto:'PRIVATE PHOTO',...extra});
const canonicalRecords=records=>Object.fromEntries(Object.entries(records).map(([id,row])=>[id,normalizeRtdb(row)]));
const build=records=>M.build({records:canonicalRecords(records),complete:true,...authority(),generation:'incremental-fiction',revision:1,offsetMinutes:-180});
async function fixture(records={a:budget()}){
 records=canonicalRecords(records);
 const f=createBackend({presupuestos:records}),auth=authority(),bootstrap=I.bootstrap({model:build(records),records});apply(f.state,{...bootstrap.patch,sv_usuarios:auth.users,sv_chat_roles:auth.identities,sv_permisos:auth.permissions});assert.equal(f.get(I.ROOT+'/policy/hash'),digest({users:f.get('sv_usuarios'),identities:f.get('sv_chat_roles'),permissions:f.get('sv_permisos')}));
 const guard=createLaborGuard({store:f.store,delay:async()=>{}});let sequence=0;
 async function run(patch,{id='incremental-fixture-'+(++sequence),expectedRevision=f.get(I.ROOT+'/coverage/revision'),projectRecord,hook}={}){
  // Full-model oracles belong to the test setup, never to the point-read adapter.
  const originals=structuredClone(f.get('sisventas/presupuestos'));const scratch={sisventas:{presupuestos:originals}};apply(scratch,patch);const oracle=build(scratch.sisventas.presupuestos),reads=[],projections=[];let callbacks=0;
  const result=await guard.run({uid:'u',claims:{uid:'u'},role:'admin',mode:'user',operation:'budget-incremental-proposal',opId:id,transportDigest:digest({patch,expectedRevision}),input:patch},async scope=>{
   callbacks++;await scope.update(patch);if(hook)scope.beforeCommit(hook);
   const planned=await I.plan({patch,raw:async path=>{reads.push(path);assert(![I.ROOT,I.ROOT+'/sources','sisventas','sisventas/presupuestos','sv_usuarios','sv_chat_roles','sv_permisos'].includes(path),'no historical/directory root reads');return f.store.read(path);},get:path=>scope.get(path),generation:'incremental-fiction',revision:expectedRevision,beforeCommit:fn=>scope.beforeCommit(fn),projectRecord:projectRecord===null?undefined:projectRecord||((args)=>{projections.push(args.key);const row=M.projectRecord(args);assert.deepEqual(row,oracle.entries[args.key]);assert.equal(row.sourceHash,digest(args.original));assert.equal(row.ownerUid,args.ownerUid);return row;})});
   assert(Object.keys(planned.patch).every(p=>p.startsWith(I.ROOT+'/')));await scope.update(planned.patch);return {ok:true,committed:true};
  });return {result,reads,projections,callbacks};
 }
 return {...f,guard,run};
}

function badgeReader(f,{scope='all',queryTransform,readTransform,authorizeTransform,maxPages=100}={}){
 const pointReads=[],queries=[];let bytes=0;
 const read=()=>I.badgeCounts({asOfDay:'2026-11-04',pageSize:50,maxPages,
  authorize:async()=>{const access={scope,policyHash:f.get(I.ROOT+'/coverage/policyHash')};return authorizeTransform?authorizeTransform(access):access;},
  raw:async path=>{assert([I.ROOT+'/coverage',I.ROOT+'/stats/'+scope,I.ROOT+'/scopeProof/'+scope].includes(path));pointReads.push(path);const value=readTransform?readTransform(path,f.get(path)):f.get(path);bytes+=Buffer.byteLength(JSON.stringify(value));return structuredClone(value);},
  query:async spec=>{assert.equal(spec.path,I.ROOT+'/noticeBadge/'+scope);assert.equal(spec.limit,50);assert.equal(spec.orderBy,'key');const candidates=Object.entries(f.get(spec.path)||{}).sort(([a],[b])=>a<b?-1:a>b?1:0).filter(([sort])=>(!spec.startAt||sort>=spec.startAt)&&(!spec.startAfter||sort>spec.startAfter)).slice(0,spec.limit).map(([sort,value])=>({sort,value}));const result=queryTransform?queryTransform(candidates,spec,queries.length):candidates;queries.push({spec,returned:result.length,bytes:Buffer.byteLength(JSON.stringify(result))});bytes+=Buffer.byteLength(JSON.stringify(result));return structuredClone(result);}
 });return {read,pointReads,queries,get bytes(){return bytes;}};
}

function legacyBadge(records){
 const ctx={};vm.runInNewContext(functionSource('_pptoAdmiteAvisosNotificacion'),ctx);
 const eligible=Object.values(records).filter(p=>ctx._pptoAdmiteAvisosNotificacion(p)&&M.NOTICE_ACTIVE.includes(p.estado)&&p.vence);
 return {badgeCount:eligible.filter(p=>p.vence<='2026-11-06').length,upcoming48Count:eligible.filter(p=>p.vence>='2026-11-04'&&p.vence<='2026-11-06').length};
}

test('raw-lex badge counts preserve ISO, slash, whitespace, invalid and UTF-16 legacy dates across guarded mutations',async()=>{
 const dates=['2026-01-01','2026-11-04','2026-11-06','2026-11-06T01:00:00Z','2026-11-07','04/11/2026','31/02/2026','01/99/2026',' 2026-11-07','2026-2-1','garbage','😀','\ue000',''],records=Object.fromEntries(dates.map((vence,i)=>['d'+i,budget({vence})]));
 Object.assign(records,{accepted:budget({estado:'aceptado'}),disabled:budget({eliminado:true}),other:budget({responsableUid:'two'})});
 const f=await fixture(records),check=async()=>{const result=await badgeReader(f).read();const expected=legacyBadge(f.get('sisventas/presupuestos'));assert.equal(result.badgeCount,expected.badgeCount);assert.equal(result.upcoming48Count,expected.upcoming48Count);assert.equal(result.complete,true);assert.equal(result.contract,'legacy-raw-lex/v1');};
 await check();await f.run({'sisventas/presupuestos/d0/vence':'2026-11-10','sisventas/presupuestos/d1/estado':'convertido','sisventas/presupuestos/d2/responsableUid':'two','sisventas/presupuestos/d3':null});await check();
 for(const scope of ['u_one','u_two']){const result=await badgeReader(f,{scope}).read(),expected=legacyBadge(Object.fromEntries(Object.entries(f.get('sisventas/presupuestos')).filter(([,p])=>p.responsableUid===scope.slice(2))));assert.equal(result.badgeCount,expected.badgeCount);assert.equal(result.upcoming48Count,expected.upcoming48Count);}
 assert.notEqual(M.day('04/11/2026'),'04/11/2026');assert('04/11/2026'<'2026-11-04');
});

test('5001 past and 50 future dates read only 50 future candidates in two bounded pages after real planner commit',async t=>{
 const run=async past=>{const records=Object.fromEntries(Array.from({length:past},(_,i)=>['p'+i,budget({vence:'2020-01-01'})]));for(let i=0;i<50;i++)records['f'+i]=budget({vence:'2027-01-01'});const f=await fixture(records);await f.run({'sisventas/presupuestos/f0/vence':'2026-11-05'});const reader=badgeReader(f),r=await reader.read();assert.equal(r.badgeCount,past+1);assert.equal(r.upcoming48Count,1);assert.equal(r.candidates,50);assert.equal(r.pages,2);assert.equal(reader.pointReads.length,6);assert.deepEqual(reader.queries.map(q=>q.returned),[50,0]);return {pages:r.pages,candidates:r.candidates,queryBytes:reader.queries.reduce((n,q)=>n+q.bytes,0),mockBytes:reader.bytes};};
 const short=await run(1),long=await run(5001);assert.equal(short.queryBytes,long.queryBytes);assert.equal(short.pages,long.pages);t.diagnostic('MOCK only: '+JSON.stringify({past1:short,past5001:long})+'; no real network savings measured');
});

test('badge refuses page exhaustion, malformed pages, stale coverage and unknown legacy representation rather than partial zero',async()=>{
 const f=await fixture(Object.fromEntries(Array.from({length:50},(_,i)=>['b'+i,budget({vence:'2027-01-01'})])));
 await assert.rejects(badgeReader(f,{maxPages:1}).read(),/page budget exhausted/);
 await assert.rejects(badgeReader(f,{queryTransform:rows=>rows.slice().reverse()}).read(),/unordered/);
 await assert.rejects(badgeReader(f,{queryTransform:rows=>rows.length?[...rows,rows[0]]:rows}).read(),/query page/);
 await assert.rejects(badgeReader(f,{queryTransform:rows=>rows.map(r=>({...r,value:{...r.value,dueRaw:'changed'}}))}).read(),/candidate/);
 await assert.rejects(badgeReader(f,{readTransform:(path,value)=>path.endsWith('/stats/all')?{...value,totalDueEligible:undefined}:value}).read(),/metadata/);
 let reads=0;await assert.rejects(badgeReader(f,{readTransform:(path,value)=>path.endsWith('/coverage')&&++reads>1?{...value,revision:value.revision+1}:value}).read(),/changed during read/);
 let auth=0;await assert.rejects(badgeReader(f,{authorizeTransform:a=>++auth>1?{...a,scope:'u_one'}:a}).read(),/authorization changed/);
 const before=structuredClone(f.state);await assert.rejects(f.run({'sisventas/presupuestos/b0/vence':'x'.repeat(81)}),/cannot be represented exactly/);assert.deepEqual(f.state,before);
 await assert.rejects(f.run({'sisventas/presupuestos/b0/vence':123}),/cannot be represented exactly/);assert.deepEqual(f.state,before);
 await f.run({'sv_permisos/admin':{indiceRevision:2}});await assert.rejects(badgeReader(f).read(),/coverage incomplete/);
});

test('badge zero requires complete certified scope; RTDB normalization and flag transitions preserve exact counts',async()=>{
 const empty=await fixture({});assert.equal((await badgeReader(empty).read()).badgeCount,0);
 await assert.rejects(badgeReader(empty,{scope:'u_one'}).read(),/metadata/);
 const f=await fixture({a:budget({vence:'01/99/2026'}),b:budget({vence:'2027-01-01'})});
 const normalize=()=>{const next=normalizeRtdb(f.state);for(const k of Object.keys(f.state))delete f.state[k];Object.assign(f.state,next);};normalize();
 assert.equal((await badgeReader(f).read()).badgeCount,1);
 await f.run({'sisventas/presupuestos/a/cancelada':true});normalize();assert.equal((await badgeReader(f).read()).badgeCount,0);
 await f.run({'sisventas/presupuestos/a/cancelada':null,'sisventas/presupuestos/b':null});normalize();assert.equal((await badgeReader(f).read()).badgeCount,1);
});

test('inclusive today lower bound keeps every same-date hash tie across exclusive pages',async()=>{
 const records=Object.fromEntries(Array.from({length:100},(_,i)=>['today'+i,budget({vence:'2026-11-04'})]));records['漢'.repeat(128)]=budget({vence:'z'.repeat(80)});
 const f=await fixture(records),reader=badgeReader(f),result=await reader.read();assert.equal(result.badgeCount,100);assert.equal(result.upcoming48Count,100);assert.equal(result.candidates,101);assert.deepEqual(reader.queries.map(q=>q.returned),[50,50,1]);
 for(const sort of Object.keys(f.get(I.ROOT+'/noticeBadge/all')))assert(Buffer.byteLength(sort)<=768);
});

test('shared document digest survives guarded Unicode reassignment/date changes and refuses mixed old coverage',async()=>{
 const id='漢'.repeat(128),original=budget(),f=await fixture({[id]:original}),before=structuredClone(f.state),oldSort=M.documentSort(original.fecha,id);
 assert.equal(oldSort.length,73);assert.equal(f.get(I.ROOT+'/document/u_one/'+oldSort).key,id);
 await f.run({['sisventas/presupuestos/'+id+'/fecha']:'2026-11-05',['sisventas/presupuestos/'+id+'/responsableUid']:'two'});
 const sort=M.documentSort('2026-11-05',id);assert.equal(f.get(I.ROOT+'/document/u_one/'+oldSort),null);assert.equal(f.get(I.ROOT+'/document/all/'+oldSort),null);assert.equal(f.get(I.ROOT+'/document/u_two/'+sort).key,id);assert.equal(f.get(I.ROOT+'/sources/'+id+'/row/key'),id);
 assert.equal(f.get(I.ROOT+'/sources/'+id+'/sourceHash'),digest({...original,fecha:'2026-11-05',responsableUid:'two'}));
 const old=await fixture();delete old.state.sv_dashboard_budget_proposal.v1.coverage.documentOrder;const unchanged=structuredClone(old.state);await assert.rejects(old.run({'sisventas/presupuestos/a/estado':'convertido'}),/explicit rebuild/);assert.deepEqual(old.state,unchanged);assert.equal(old.commits.length,0);
 const model=build({a:budget()});delete model.documentOrder;assert.throws(()=>I.bootstrap({model,records:canonicalRecords({a:budget()})}),/explicit rebuild/);assert.equal(before.sisventas.presupuestos[id].fecha,'2026-11-04');
});
test('parent replacements reject before planner fast return and leave originals and indexes intact under real guard',async()=>{
 const f=await fixture();
 for(const path of ['sisventas','']){
  const before=structuredClone(f.state),patch={[path]:{presupuestos:{a:budget({estado:'convertido'})},sv_usuarios:{}}};let reads=0,callbacks=0;
  await assert.rejects(f.guard.run({uid:'u',claims:{uid:'u'},role:'admin',mode:'user',operation:'budget-incremental-proposal',opId:'parent-'+(path||'root'),transportDigest:digest(patch),input:patch},async scope=>{
   callbacks++;
   const planned=await I.plan({patch,raw:async()=>{reads++;throw Error('unexpected read');},get:p=>scope.get(p),generation:'incremental-fiction',revision:1,beforeCommit:fn=>scope.beforeCommit(fn),projectRecord:M.projectRecord});
   await scope.update({...patch,...planned.patch});return {ok:true,committed:true};
  }),/Parent replacement/);
  assert.equal(callbacks,1);assert.equal(reads,0);assert.equal(f.commits.length,0);assert.deepEqual(f.state,before);
 }
});

test('actual guard atomically maintains original, counters and date/notices indexes; replay uses only existing receipt',async()=>{
 const f=await fixture(),after=budget({estado:'convertido',fecha:'2026-11-06'}),patch={'sisventas/presupuestos/a':after},id='same-guard-receipt';
 const first=await f.run(patch,{id,expectedRevision:1});assert.equal(f.commits.length,1);const commit=f.commits[0];assert(commit['sisventas/presupuestos/a']);assert(commit[I.ROOT+'/coverage']);assert(commit['sv_labor_receipts/'+id]);assert(!Object.keys(commit).some(p=>p.includes(I.ROOT+'/receipts')));assert.equal(f.get(I.ROOT+'/stats/all/active'),0);assert.equal(f.get(I.ROOT+'/stats/all/converted'),1);assert.equal(f.get(I.ROOT+'/coverage/revision'),2);assert(first.reads.length<20);
 const before=structuredClone(f.state),retry=await f.run(patch,{id,expectedRevision:1});assert.equal(retry.callbacks,0);assert.equal(f.commits.length,1);assert.deepEqual(f.state,before);assert(!JSON.stringify(f.get(I.ROOT)).includes('PRIVATE PHOTO'));assert(!JSON.stringify(f.get(I.ROOT)).includes('costoUnitarioCompra'));
});
test('point-read cost and patch size do not scale with unrelated budget history',async t=>{
 const run=async size=>{const records=Object.fromEntries(Array.from({length:size},(_,i)=>['b'+i,budget({id:'PP-'+i})])),f=await fixture(records),result=await f.run({'sisventas/presupuestos/b0':budget({id:'PP-0',estado:'convertido'})});return {reads:result.reads.length,keys:Object.keys(f.commits[0]).length};};
 const one=await run(1),many=await run(1001);assert.deepEqual(one,many);t.diagnostic('Both 1 and 1001 originals: plannerReads='+one.reads+', commitPaths='+one.keys+' (oracles built outside the operation)');
});
test('create, nested modification, reassignment and deletion keep all and own scopes in the same fence',async()=>{
 const f=await fixture();await f.run({'sisventas/presupuestos/new':budget({id:'PP-NEW',responsableUid:'two'})});assert.equal(f.get(I.ROOT+'/stats/all/records'),2);assert.equal(f.get(I.ROOT+'/stats/u_two/records'),1);
 await f.run({'sisventas/presupuestos/a/responsableUid':'two','sisventas/presupuestos/a/estado':'convertido'});assert.equal(f.get(I.ROOT+'/stats/u_one/records'),0);assert.equal(f.get(I.ROOT+'/stats/u_two/records'),2);assert.equal(f.get(I.ROOT+'/stats/all/converted'),1);
 await f.run({'sisventas/presupuestos/a':null});assert.equal(f.get(I.ROOT+'/coverage/records'),1);assert.equal(f.get(I.ROOT+'/stats/all/converted'),0);assert.equal(f.get('sisventas/presupuestos/new/total'),100);
 assert.equal(Object.values(f.get(I.ROOT+'/months/all')).reduce((n,m)=>n+m.records,0),1);
});
test('stale generation/revision, uncovered before image and missing scope metadata never produce a commit',async()=>{
 for(const corrupt of [f=>apply(f.state,{[I.ROOT+'/coverage/generation']:'other'}),f=>apply(f.state,{[I.ROOT+'/sources/a/sourceHash']:'0'.repeat(64)}),f=>apply(f.state,{[I.ROOT+'/stats/all']:null}),f=>apply(f.state,{[I.ROOT+'/scopeProof/all']:'0'.repeat(64)})]){const f=await fixture();corrupt(f);const before=structuredClone(f.get('sisventas'));await assert.rejects(f.run({'sisventas/presupuestos/a/estado':'enviado'}));assert.equal(f.commits.length,0);assert.deepEqual(f.get('sisventas'),before);}
 const f=await fixture();await assert.rejects(f.run({'sisventas/presupuestos/a/estado':'enviado'},{expectedRevision:9}));assert.equal(f.commits.length,0);
});
test('fresh coverage or point source drift during the existing commit checks aborts the whole operation',async()=>{
 for(const target of [I.ROOT+'/coverage/revision',I.ROOT+'/policy/hash','sisventas/presupuestos/a/total']){const f=await fixture();await assert.rejects(f.run({'sisventas/presupuestos/a/estado':'enviado'},{hook:async()=>apply(f.state,{[target]:target.endsWith('hash')?'0'.repeat(64):999})}));assert.equal(f.commits.length,0);assert.equal(f.get('sisventas/presupuestos/a/estado'),'borrador');}
});
test('directory/identity/permissions mutations invalidate coverage explicitly without scanning original budgets',async()=>{
 for(const patch of [{'sv_usuarios/new':{uid:'new',nombre:'Nueva persona ficticia',rol:'vendedor'}},{'sv_chat_roles/one/activo':false},{'sv_permisos/vendedor/indiceRevision':2}]){const f=await fixture(),r=await f.run(patch);assert.equal(f.get(I.ROOT+'/coverage/ready'),false);assert.equal(f.get(I.ROOT+'/coverage/requiresReconciliation'),true);assert.deepEqual(r.reads,[...(Object.hasOwn(patch,'sv_usuarios/new')?['sv_usuarios/new']:[]),I.ROOT+'/coverage',I.ROOT+'/policy']);await assert.rejects(f.run({'sisventas/presupuestos/a/estado':'enviado'}));}
});
test('legacy name changes/new aliases require reconciliation; unchanged legacy metadata can retain its certified owner',async()=>{
 const old=budget({usuario:'Uno'});delete old.responsableUid;const f=await fixture({a:old});await f.run({'sisventas/presupuestos/a/estado':'enviado'});assert.equal(f.get(I.ROOT+'/sources/a/ownerUid'),'one');
 await assert.rejects(f.run({'sisventas/presupuestos/a/usuario':'Dos'}));await assert.rejects(f.run({'sisventas/presupuestos/new':{...old,id:'PP-NEW'}}));assert.equal(f.commits.length,1);
 const justCreator=budget({creadaPorUid:'one'});delete justCreator.responsableUid;await assert.rejects(f.run({'sisventas/presupuestos/new':justCreator}));
 const unknown={...old,usuario:'Nombre no resuelto'},unresolved=await fixture({a:unknown});await unresolved.run({'sisventas/presupuestos/a/estado':'enviado'});assert.equal(unresolved.get(I.ROOT+'/sources/a/ownerUid'),'');assert.equal(unresolved.get(I.ROOT+'/coverage/unresolvedOwners'),1);assert.equal(unresolved.get(I.ROOT+'/stats/u_one'),null);
});
test('missing point projector, derived injection, parent replacement and nested-data projection are refused',async()=>{
 const f=await fixture();for(const patch of [{[I.ROOT+'/stats/all']:{records:999}},{'sisventas/presupuestos':{} }])await assert.rejects(f.run(patch));
 await assert.rejects(f.run({'sisventas/presupuestos/a/estado':'enviado'},{projectRecord:()=>({key:'a',items:[]})}));assert.equal(f.commits.length,0);
 await assert.rejects(f.run({'sisventas/presupuestos/a/estado':'enviado'},{projectRecord:null}));assert.equal(f.commits.length,0);
});
test('shared RTDB roundtrip preserves covered source hashes, nullable metadata and a second incremental mutation',async()=>{
 const record=budget({vence:null,ts:null,audit:[],attachments:{}}),f=await fixture({a:record}),commit=f.store.commit;
 f.store.commit=async(...args)=>{await commit(...args);const normalized=normalizeRtdb(f.state);for(const key of Object.keys(f.state))delete f.state[key];Object.assign(f.state,normalized);};
 await f.run({'sisventas/presupuestos/a':{...record,estado:'enviado',empty:[],nested:{remove:null}}});assert.equal(f.get('sisventas/presupuestos/a/empty'),null);assert.equal(f.get(I.ROOT+'/sources/a/row/dueDay'),null);
 await f.run({'sisventas/presupuestos/a/estado':'convertido'});assert.equal(f.get(I.ROOT+'/stats/all/converted'),1);assert.equal(f.get(I.ROOT+'/coverage/records'),1);assert.equal(f.commits.length,2);
 const current=f.get('sisventas/presupuestos/a');assert.equal(f.get(I.ROOT+'/sources/a/sourceHash'),digest(normalizeRtdb(current)));
});
