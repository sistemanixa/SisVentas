'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {prepare,ACCOUNT_ROOT}=require('./helpers/client-account-volume-fixture.cjs');
const Projection=require('../cotizador/client-account-projection');
const Reader=require('../js/core/client-account-reader.v1');
let smallPromise,largePromise;
const small=()=>smallPromise??=prepare(),large=()=>largePromise??=prepare({salesCount:10000,readOnly:true});

test('225 fictional customer accounts preserve all1100 sales and old debt beyond the first fifty visible rows',async()=>{
 const f=await small(),{reader}=f.nodeReader(),first=await reader.browse(),id=Projection.hash('client:c224');
 assert.equal(first.rows.length,50);assert.equal(first.totals.accounts,225);assert.equal(first.totals.totalCents,f.data.expected.all.totalCents);assert.equal(first.totals.paidCents,f.data.expected.all.paidCents);assert.equal(first.totals.balanceCents,f.data.expected.all.balanceCents);
 assert(!first.rows.some(row=>row.id===id),'the historical customer is deliberately outside page one');
 const account=await reader.account(id);for(const k of ['totalCents','paidCents','balanceCents'])assert.equal(account.account[k],f.data.expected.clients.c224[k]);
 const searched=await reader.browse('ZZZ');assert.equal(searched.rows.length,1);assert.equal(searched.rows[0].id,id);assert.equal(searched.totals.balanceCents,f.data.expected.all.balanceCents);
 const dated=await reader.ledger(id,{from:'2026-01-01',to:'2026-12-31'});assert.equal(dated.openingCents,f.data.expected.clients.c224.totalCents);assert.equal(dated.closingCents,f.data.expected.clients.c224.balanceCents);
 assert(!f.measures.some(r=>/^sisventas\/(ventas|pagos|clientes)(?:\/)?$/.test(r.path)));
});

test('cold browse transfer and request shape stay bounded when unrelated history grows from1100 to10000 sales',async()=>{
 const observations=[];
 for(const getFixture of [small,large]){const f=await getFixture();f.measures.length=0;const {reader}=f.nodeReader(),page=await reader.browse();assert.equal(page.totals.balanceCents,f.data.expected.all.balanceCents);assert.equal(page.rows.length,50);const cold=f.measures.slice(),totals=cold.filter(r=>r.path===ACCOUNT_ROOT+'/totals/all').length;assert.equal(totals,1);await reader.browse('ZZZ');await reader.browse();assert.equal(f.measures.filter(r=>r.path===ACCOUNT_ROOT+'/totals/all').length,1,'unchanged coverage retains only the authorized complete totals');assert(cold.filter(r=>r.limit).every(r=>r.limit===50));assert(cold.every(r=>r.path==='sv_client_accounts_config'||r.path.startsWith(ACCOUNT_ROOT+'/')));observations.push({sales:f.data.salesCount,requests:cold.length,bytes:cold.reduce((s,r)=>s+r.bytes,0),legacySalesBytes:Buffer.byteLength(JSON.stringify(f.data.sales)),paths:cold.map(r=>r.path)});}
 assert.deepEqual(observations[1].paths,observations[0].paths);assert.equal(observations[1].requests,observations[0].requests);assert(observations.every(row=>row.bytes<row.legacySalesBytes));
 console.log('Synthetic CC transport only; no production timing or USD: '+JSON.stringify(observations.map(({paths,...row})=>row)));
});

test('121 historical sales in one customer paginate the real ledger without losing prior balance or cents',async()=>{
 const f=await small(),{reader}=f.nodeReader(),id=Projection.hash('client:c0'),all=[];let cursor=null,revision=null;
 do{const page=await reader.ledger(id,{cursor,expectedRevision:revision});revision=page.revision;assert(page.rows.length<=50);if(all.length)assert.equal(page.rows[0].openingCents,all.at(-1).balanceCents);all.push(...page.rows);cursor=page.hasMore?page.cursor:null;}while(cursor);
 assert.equal(all.filter(r=>r.kind==='sale').length,121);assert.equal(all.at(-1).balanceCents,f.data.expected.clients.c0.balanceCents);assert.equal(new Set(all.map(r=>r.sort)).size,all.length);assert(all.every(r=>Number.isSafeInteger(r.balanceCents)));
});

test('another authorized synthetic actor updates customer metadata and search through the real shared guard without altering financial originals',async()=>{
 const f=await prepare(),before={sales:structuredClone(f.get('sisventas/ventas')),payments:structuredClone(f.get('sisventas/pagos')),stock:structuredClone(f.get('sisventas/inventario_operativo'))},oldRevision=f.get(ACCOUNT_ROOT+'/coverage/all/revision'),id=Projection.hash('client:c224');
 await f.updateClient('c224',{nombre:'Cliente actualizado externo',telefono:'0223 555 9999',email:'cambio@example.invalid'},{actor:'v'});
 assert.equal(f.commits.length,1);assert.equal(f.get(ACCOUNT_ROOT+'/records/all/'+id+'/identity/label'),'Cliente actualizado externo');assert.equal(f.get(ACCOUNT_ROOT+'/coverage/all/revision'),oldRevision+1);assert.equal(f.get(ACCOUNT_ROOT+'/totals/all/balanceCents'),f.data.expected.all.balanceCents);
 const {reader}=f.nodeReader(),found=await reader.browse('actualizado');assert.equal(found.rows.length,1);assert.equal(found.rows[0].id,id);assert.equal((await reader.browse('ZZZ')).rows.length,0);
 assert.deepEqual(f.get('sisventas/ventas'),before.sales);assert.deepEqual(f.get('sisventas/pagos'),before.payments);assert.deepEqual(f.get('sisventas/inventario_operativo'),before.stock);
 assert(!f.reads.some(([,p])=>['sisventas/ventas','sisventas/pagos','sisventas/clientes'].includes(p)));
});

test('same volume remains isolated by owner and a revoked fixture permission cannot trigger global source fallback',async()=>{
 const f=await prepare();f.state.sv_chat_roles.u.rol='administrativo';const {reader,context}=f.nodeReader({uid:'u',role:'administrativo',auth:{uid:'u'},db:{},route:'cuentacorriente',permissionRevision:1,canReadAccounts:true,online:true});
 const own=await reader.browse();assert.equal(own.totals.balanceCents,f.data.expected.u.balanceCents);assert.notEqual(own.totals.balanceCents,f.data.expected.all.balanceCents);assert(!f.measures.some(r=>r.path.includes('/all')));
 context.canReadAccounts=false;const count=f.measures.length;await assert.rejects(reader.browse(),{name:'AbortError'});assert.equal(f.measures.length,count);
 assert.throws(()=>f.read({path:'sv_client_accounts/v1/totals/all'},context),/foreign account scopes/);
});

test('coverage changing during a volume read never publishes mixed totals or a falsely ready result',async()=>{
 const f=await small(),context={uid:'u',role:'admin',auth:{uid:'u'},db:{},route:'cuentacorriente',permissionRevision:1,canReadAccounts:true,online:true};let coverage=0,ready=0;
 const reader=Reader.create({capture:()=>context,read:async p=>{const row=f.read({path:p});if(p===ACCOUNT_ROOT+'/coverage/all'&&++coverage===2)return {...row,revision:row.revision+1};return row;},query:async(p,o)=>f.read({path:p,order:true,limit:o.limit}),readiness:{beginSource:()=>({ready:()=>ready++,cancel(){},error(){}})}});
 await assert.rejects(reader.browse(),{code:'SV_PAGE_CHANGED'});assert.equal(ready,0);
});
