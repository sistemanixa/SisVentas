'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../cotizador/dashboard-budget-projection-proposal'),{digest}=require('../cotizador/labor-guard'),{functionSource}=require('./helpers/app-functions.cjs');
function authority(){return {users:{admin:{uid:'admin',nombre:'Admin ficticio',rol:'admin',activo:true},one:{uid:'one',nombre:'Uno',rol:'vendedor',activo:true},two:{uid:'two',nombre:'Dos',rol:'administrativo',activo:true}},identities:{admin:{rol:'admin',activo:true},one:{rol:'vendedor',activo:true},two:{rol:'administrativo',activo:true}},permissions:{}};}
const row=(status='borrador',extra={})=>({id:'PP-0001',responsableUid:'one',estado:status,cliente:'Cliente ficticio',fecha:'2026-11-04',vence:'2026-11-05',ts:1000,...extra});
const build=(records,extra={})=>P.build({records,complete:true,...authority(),generation:'budget-proposal-fiction',offsetMinutes:-180,...extra});
const actor=(uid='admin',extra={})=>({uid,...authority(),...extra});
const options=(extra={})=>({asOfDay:'2026-11-04',horizonDays:1,expiryEnabled:true,noResponseEnabled:true,canApprove:false,canApproveWithinLimit:false,...extra});
test('all KPI records beyond fifty match the actual active card arithmetic without mutating input',()=>{
 const states=[...P.ACTIVE,'convertido','anulado','rechazado','ENVIADO',''],records=Object.fromEntries(Array.from({length:501},(_,i)=>['b'+i,row(states[i%states.length],{items:[{secret:'NO COPIAR'}],fotoBase64:'NO COPIAR',total:987.654})])),before=structuredClone(records),model=build(records),metric=P.metrics(model,actor());
 const nodes=Object.fromEntries(['kpi-pptos','kpi-pptos-sub','kpi-pptos-conv'].map(id=>[id,{textContent:'',closest:()=>({setAttribute(){}})}]));
 const c={window:{SVDataReadiness:{status:()=>({ready:true,errors:[]})}},document:{getElementById:id=>nodes[id]},pptoData:Object.values(records)};
 vm.runInNewContext(functionSource('svPintarPresupuestosDashboard'),c);c.svPintarPresupuestosDashboard();
 assert.equal(nodes['kpi-pptos'].textContent,String(metric.counts.active));assert.equal(nodes['kpi-pptos-conv'].textContent,metric.counts.converted+' convertidos · '+metric.counts.conversionPercent+'% conversión');assert.equal(metric.counts.totalNonCancelled,456);assert.deepEqual(records,before);assert.equal(model.sourceCount,501);assert(!JSON.stringify(model).includes('NO COPIAR'));assert(Buffer.byteLength(JSON.stringify(metric))<512);
});
test('empty complete scope yields valid zeros; incomplete or missing source is never a zero',()=>{assert.deepEqual(P.metrics(build({}),actor()).counts,{active:0,converted:0,totalNonCancelled:0,conversionPercent:0});assert.throws(()=>build({}, {complete:false}));assert.throws(()=>build(undefined));assert.throws(()=>build({}, {offsetMinutes:undefined}));});
test('canonical responsibility controls scope; employee string never grants foreign access',()=>{
 const model=build({a:row('borrador',{empleado:'Dos'}),b:row('convertido',{responsableUid:'two',empleado:'Uno'}),unknown:{id:'PP-UNKNOWN',estado:'enviado',cliente:'No inventar dueño'}});
 assert.equal(P.metrics(model,actor()).counts.totalNonCancelled,3);assert.equal(P.metrics(model,actor('one')).counts.totalNonCancelled,1);assert.deepEqual(P.scope(model,actor('one')).rows.map(r=>r.key),['a']);
 assert.equal(P.legacyMonth(model,actor('one'),{month:'2026-11',employeeLabel:'Uno'}).total,0);assert.equal(P.legacyMonth(model,actor('one'),{month:'2026-11',employeeLabel:'Dos'}).total,1);
});
test('unique legacy owner is retained, homonyms stay admin-only and never choose arbitrary UID',()=>{
 const records={a:{id:'PP-0001',usuario:'Uno',estado:'borrador'}},model=build(records);assert.equal(P.metrics(model,actor('one')).counts.active,1);
 const auth=authority();auth.users.two.nombre='Uno';const ambiguous=build(records,auth);assert.equal(P.metrics(ambiguous,actor('one',auth)).counts.active,0);assert.equal(P.metrics(ambiguous,actor('admin',auth)).counts.active,1);
});
test('inactive, denied module, foreign identity and changed permission revision reject reads',()=>{
 const model=build({a:row()});for(const uid of ['missing','distribuidora'])assert.throws(()=>P.metrics(model,actor(uid)),{code:'SV_BUDGET_PROPOSAL_ACCESS'});
 const inactive=authority();inactive.identities.one.activo=false;assert.throws(()=>P.metrics(model,actor('one',inactive)));
 const blocked=authority();blocked.permissions.vendedor={indiceVersion:2,indiceRevision:1,indiceModulos:{presupuesto:false}};assert.throws(()=>P.metrics(model,actor('one',blocked)),{code:'SV_BUDGET_PROPOSAL_ACCESS'});
 const changed=authority();changed.permissions.admin={indiceVersion:2,indiceRevision:9,indiceModulos:{presupuesto:true}};assert.throws(()=>P.metrics(model,actor('admin',changed)),{code:'SV_BUDGET_PROPOSAL_POLICY_CHANGED'});
});
test('recent budget contribution matches real activity module prewindow and top-five order',()=>{
 const records=Object.fromEntries(Array.from({length:81},(_,i)=>['r'+i,row(i%2?'convertido':'anulado',{id:'PP-'+String(i).padStart(4,'0'),ts:100000+i,cliente:'Cliente '+i})]));const model=build(records),scope=P.scope(model,actor()),input=scope.rows.slice().sort((a,b)=>Number(b.number.slice(3))-Number(a.number.slice(3))).map(r=>({id:r.number,cliente:r.client,estado:r.status,ts:r.ts}));let html='';
 const container={set innerHTML(value){html=value;}},window={pptoData:input,tienePermiso:()=>true},context={window,document:{getElementById:id=>id==='dash-actividad-lista'?container:null}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/modules/activity-history.js'),'utf8'),context);window.dashRenderActividadReciente();
 const result=P.recent(model,actor());assert.equal(result.rows.length,5);assert.equal(result.completeMixedActivity,false);const positions=result.rows.map(r=>html.indexOf(r.number));assert(positions.every(p=>p>=0));assert.deepEqual(positions,positions.slice().sort((a,b)=>a-b));assert.equal(result.candidateWindow,60);
});
test('62 budgets expose the legacy sixty-window omission; authoritative document prefix includes the old-number recent document',()=>{
 const Activity=require('../js/core/dashboard-activity-model.v1'),records={hot:row('enviado',{id:'PP-0001',fecha:'2026-11-04',ts:1793800000000})};
 for(let i=0;i<61;i++)records['older'+i]=row('borrador',{id:'PP-'+String(100+i).padStart(4,'0'),fecha:'2026-11-03',ts:1793700000000+i});
 const model=build(records),legacy=P.recent(model,actor());assert(!legacy.rows.some(r=>r.key==='hot'));assert.equal(legacy.completeForBudgetContribution,false);assert.equal(legacy.completeGlobalTopFive,false);
 const context={uid:'admin',role:'admin',auth:{},db:{},permissionRevision:0,grants:{ventas:null,pagos:null,ordenes_trabajo:null,presupuestos:'all'}},prefix=P.documentPrefix(model,actor(),{context});assert.equal(prefix.rows[0].key,'hot');assert.equal(prefix.rows.length,5);assert.equal(prefix.precision,'day');assert.equal(prefix.certifiedActivityInstant,false);assert.equal(prefix.exhausted,false);assert(!Object.hasOwn(prefix.rows[0],'ms'));
 const merged=Activity.merge({context,sources:{presupuestos:prefix},expected:{presupuestos:{generation:model.generation,revision:model.revision}}});assert.equal(merged.complete,true,JSON.stringify(merged.sources));assert.equal(merged.items[0].key,'hot');assert.equal(merged.precision,'day');
});
test('document date and stored timestamp are distinct orders; unknown dates cannot certify an authoritative prefix',()=>{
 const model=build({oldDayNewStamp:row('borrador',{id:'PP-9999',fecha:'2026-01-01',ts:1793800000000}),newDayOldStamp:row('borrador',{id:'PP-0001',fecha:'2026-11-04',ts:1})}),context={uid:'one',role:'vendedor',auth:{},db:{},permissionRevision:0,grants:{ventas:null,pagos:null,ordenes_trabajo:null,presupuestos:'own'}};
 assert.equal(P.recent(model,actor('one')).rows[0].key,'oldDayNewStamp');assert.equal(P.documentPrefix(model,actor('one'),{context}).rows[0].key,'newDayOldStamp');
 const unknown=build({a:row('borrador',{fecha:''})}),prefix=P.documentPrefix(unknown,actor('one'),{context});assert.equal(prefix.complete,false);assert.equal(prefix.kind,'incomplete-budget-prefix');assert.equal(P.metrics(unknown,actor('one')).counts.active,1);
 assert.throws(()=>P.documentPrefix(model,actor('one'),{context:{...context,uid:'two'}}));assert.throws(()=>P.documentPrefix(model,actor('one'),{context:{...context,grants:{presupuestos:'all'}}}));
});
test('notices preserve five-state badge including overdue, while accepted is KPI-active but not badge-active',()=>{
 const model=build({accepted:row('aceptado'),overdue:row('enviado',{vence:'2026-01-01'}),tomorrow:row('borrador'),disabled:row('revision',{eliminado:true})}),n=P.notices(model,actor(),options());
 assert.equal(P.metrics(model,actor()).counts.active,4);assert.equal(n.badgeCount,2);assert.equal(n.upcoming48Count,1);assert(n.rows.some(r=>r.key==='accepted'&&r.kind==='expiry'));assert(!n.rows.some(r=>r.key==='disabled'));
});
test('approval notices require explicit capabilities and approved notice additionally requires own responsibility',()=>{
 const model=build({review:row('revision'),one:row('aprobado_int',{aprobadoPor:'Admin ficticio',aprobadoEn:'stamp'}),two:row('aprobado_int',{responsableUid:'two'})});
 const denied=P.notices(model,actor('one'),options({expiryEnabled:false}));assert.equal(denied.total,0);
 const own=P.notices(model,actor('one'),options({canApprove:true,canApproveWithinLimit:true,expiryEnabled:false}));assert.deepEqual(own.rows.map(r=>r.kind).sort(),['approval','approved']);assert(own.rows.every(r=>r.key!=='two'));
});
test('no-response requires five elapsed days, resolves last sent audit, and preserves due-date short circuit',()=>{
 const model=build({audit:row('enviado',{audit:[{accion:'Enviado al cliente',fecha:'29/10/2026'}]}),recent:row('enviado',{fechaEnvio:'2026-11-03'}),missingDue:row('enviado',{fechaEnvio:'2026-10-01',vence:''})});
 const n=P.notices(model,actor(),options({expiryEnabled:false}));assert.deepEqual(n.rows.map(r=>r.key),['audit']);assert.equal(n.rows[0].days,6);
});
test('notice pagination bounds rows but counts all eligible notices, never labels first page complete',()=>{
 const model=build(Object.fromEntries(Array.from({length:101},(_,i)=>['p'+i,row('revision',{id:'PP-'+i})]))),n=P.notices(model,actor(),options({canApprove:true,expiryEnabled:false,limit:10}));assert.equal(n.total,101);assert.equal(n.rows.length,10);assert.equal(n.allNoticesReturned,false);assert.equal(n.next,10);assert.throws(()=>P.notices(model,actor(),options({limit:51})));
});
test('pure explicit-day reads do not consult the clock or mutate originals',()=>{const original=Date.now;Date.now=()=>{throw Error('No clock');};try{const model=build({a:row()});assert.equal(P.notices(model,actor(),options()).total,1);assert.equal(P.day('31/02/2026'),null);}finally{Date.now=original;}});
test('writer proposal applies once, replays identically and rejects collision, stale revision or stale original',()=>{
 const old=row(),model=build({a:old}),command={id:'fictitious-operation',expectedRevision:1,changes:[{key:'a',beforeHash:digest(old),after:{...old,estado:'convertido'}}]},before=structuredClone(model),next=P.apply(model,command,authority());assert.equal(next.revision,2);assert.equal(P.metrics(next,actor()).counts.converted,1);assert.deepEqual(P.apply(next,command,authority()),next);assert.deepEqual(model,before);
 assert.throws(()=>P.apply(next,{...command,changes:[{...command.changes[0],after:null}]},authority()),{code:'SV_BUDGET_PROPOSAL_CONFLICT'});
 assert.throws(()=>P.apply(next,{...command,id:'other-operation'},authority()),{code:'SV_BUDGET_PROPOSAL_CONFLICT'});
 assert.throws(()=>P.apply(next,{...command,id:'other-operation',expectedRevision:2},authority()),{code:'SV_BUDGET_PROPOSAL_CONFLICT'});
 const changed=authority();changed.permissions.admin={indiceVersion:2,indiceRevision:2,indiceModulos:{presupuesto:true}};assert.throws(()=>P.apply(next,command,changed),{code:'SV_BUDGET_PROPOSAL_POLICY_CHANGED'});
 const reservedName=P.apply(model,{...command,id:'toString'},authority());assert.deepEqual(P.apply(reservedName,{...command,id:'toString'},authority()),reservedName);
});
test('responsibility transfer and removal atomically rebuild scopes without losing administrative total',()=>{
 const old=row(),model=build({a:old}),transfer={...old,responsableUid:'two'},next=P.apply(model,{id:'transfer-operation',expectedRevision:1,changes:[{key:'a',beforeHash:digest(old),after:transfer}]},authority());assert.equal(P.metrics(next,actor('one')).counts.active,0);assert.equal(P.metrics(next,actor('two')).counts.active,1);assert.equal(P.metrics(next,actor()).counts.active,1);
 const removed=P.apply(next,{id:'remove-operation',expectedRevision:2,changes:[{key:'a',beforeHash:digest(transfer),after:null}]},authority());assert.equal(removed.sourceCount,0);assert.equal(P.metrics(removed,actor()).counts.active,0);
});
