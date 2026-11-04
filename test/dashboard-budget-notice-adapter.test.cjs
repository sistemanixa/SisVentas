'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Adapter=require('../js/core/dashboard-budget-notice-adapter-proposal'),Legacy=require('../js/core/dashboard-budget-notice-legacy-proposal');
const contractRoot=path.resolve(process.env.SV_BUDGET_CONTRACT_ROOT||path.join(__dirname,'..'));
const Model=require(path.join(contractRoot,'cotizador/dashboard-budget-projection-proposal'));
const source=process.env.SV_BUDGET_NOTICE_APP_SOURCE?fs.readFileSync(process.env.SV_BUDGET_NOTICE_APP_SOURCE,'utf8').replace(/\r\n/g,'\n'):require('./helpers/active-app').readActiveApp().source;
process.env.TZ='America/Argentina/Buenos_Aires';
function actual(name){
 const start=source.search(new RegExp('^function '+name+'\\(','m'));assert(start>=0,'Missing actual app function '+name);
 const ends=/^\}/gm;ends.lastIndex=start;for(let m;(m=ends.exec(source));){const code=source.slice(start,m.index+1);try{new vm.Script(code);return code;}catch(_){}}
 throw Error('Incomplete actual function '+name);
}
const original=(extra={})=>({id:'PP-0001',responsableUid:'one',empleado:'Uno',cliente:'Cliente ficticio',estado:'enviado',fecha:'2026-11-01',vence:'2026-11-05',total:123.456,enviadoEn:'2026-10-29',ts:10,...extra});
const context=()=>({uid:'one',role:'vendedor',permissionRevision:7,sessionEpoch:1,auth:{currentUser:{uid:'one'}},db:{},connected:true,connectionEpoch:1});
function envelope(records,{role='vendedor',scope='own'}={}){
 return {schema:1,uid:'one',role,permissionRevision:7,scope,generation:'notice-fiction',revision:5,complete:true,rows:Object.entries(records).map(([key,original])=>{const {sourceHash,...row}=Model.projectRecord({key,original,ownerUid:original.responsableUid||'',offsetMinutes:-180});return {...row,noticeLegacy:row.admits?Legacy.capture(original):null};}).filter(r=>r.admits)};
}
function run(records,{adapted=false,canApprove=false,canApproveWithinLimit=false,expiry=true,noResponse=true,horizon=1,candidateEdit}={}){
 class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-11-04T12:00:00-03:00']));}static now(){return new Clock().getTime();}}
 const badge={style:{},textContent:''},storage=new Map(),errors=[];
 const c={Date:Clock,console:{error(...args){errors.push(args);}},currentUserUid:'one',currentUser:'Uno',currentUserEmail:'uno@fiction.invalid',isAuthenticated:true,pptoData:[],todasNotifs:[],otData:[],gastosData:[],renderNotificaciones(){},actualizarBadgeNotif(){},pptoEstadoLabel:s=>s,escapeHTML:s=>s,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:{getElementById:id=>id==='ppto-vence-badge'?badge:id==='screen-login'?{style:{display:'none'}}:id==='screen-app'?{classList:{contains:()=>true}}:null,dispatchEvent(){}},NOTIF_CONFIG:{ppto_vence_2:{activo:expiry},ppto_sin_resp:{activo:noResponse},deuda_30:{activo:false},deuda_15:{activo:false}},_pptoDatosActualizados(){},svPuedeLeerDominio:()=>true};
 c.window=c;c.fbDB={};c.fbAuth={currentUser:{uid:'one'}};c._diasAvisoVencimientoPresupuesto=horizon;
 c.tienePermiso=p=>p==='presupuestos.aprobar'?canApprove:p==='presupuestos.aprobarDentroLimite'?canApproveWithinLimit:p==='presupuestos.revisarVencidos';
 c.SVCommercialOwnership={belongs:r=>(r.responsableUid||r._svOwnerUid)===c.currentUserUid,onValue(domain,callback){callback({val:()=>records});}};
 vm.createContext(c);for(const name of ['svFechaLocalISO','_pptoNormalizarIdentidad','_pptoPerteneceAlUsuarioActual','_pptoFechaEnvioNotificacion','_diasAvisoVencimientoPresupuestoConfig','_pptoAdmiteAvisosNotificacion','_svSesionActivaParaVencimientos','_svClaveAvisoVencimiento','_svAvisoVencimientoYaMostrado','_svMarcarAvisoVencimientoMostrado','generarNotificaciones','verificarVencimientosPptos','fbCargarPresupuestos'])vm.runInContext(actual(name),c);
 if(adapted){const ctx={...context(),role:'admin'},e=envelope(records,{role:'admin',scope:'all'});if(candidateEdit)candidateEdit(e);c.pptoData=Adapter.rowsFor(Adapter.adapt(e,ctx),ctx);}else c.fbCargarPresupuestos();
 c.verificarVencimientosPptos();assert.deepEqual(errors,[],'Actual generator swallowed an exception');
 const result={notices:JSON.parse(JSON.stringify(c.todasNotifs)),badge:{display:badge.style.display,count:badge.textContent},marks:[...storage.keys()]};
 c.verificarVencimientosPptos();assert.deepEqual([...storage.keys()],result.marks,'Repeat must not add duplicate marks');return result;
}
const parity=(records,options)=>{const before=structuredClone(records),legacy=run(records,options),adapted=run(records,{...options,adapted:true});assert.deepEqual(adapted,legacy);assert.deepEqual(records,before);return adapted;};

test('actual expiry generator and lexical 48h badge agree, including historical raw dates and rollover',()=>{
 const records=Object.fromEntries(['2026-11-04','2026-11-05','2026-11-06','2026-10-01','05/11/26','05/11/2026','2026-10-35','invalid','2026-11-05T10:00:00',''].map((vence,i)=>['k'+i,original({id:'PP-'+String(i+1).padStart(4,'0'),vence})]));
 const result=parity(records,{noResponse:false,horizon:2});assert(result.notices.length>0);assert(result.marks.length>0);
});
test('actual approval and approved-own notifications preserve IDs, labels, amounts and exact order',()=>{
 const result=parity({a:original({id:'PP-0001',estado:'revision',motivo:'Revisar',vence:''}),b:original({id:'PP-0002',estado:'aprobado_int',aprobadoEn:123,aprobadoPor:'Admin',vence:'2026-11-04'}),c:original({id:'PP-0003',estado:'aprobado_int',responsableUid:'other',vence:''})},{canApprove:true,canApproveWithinLimit:true});
 assert(result.notices.some(n=>n.id==='ppto_aprobado_int_PP-0002_123'));assert(!result.notices.some(n=>n.id.startsWith('ppto_aprobado_int_PP-0003')));
});
test('actual no-response handles numeric timestamps, direct historical dates and latest sent audit',()=>{
 const variants=[{enviadoTs:new Date('2026-10-29T23:00:00-03:00').getTime()},{enviadoEn:'29/10/2026'},{enviadoEn:'2026-10-29T18:00:00'},{enviadoEn:0,fechaEnvio:'2026-10-29'},{enviadoEn:'bad',audit:[{accion:'Enviado al cliente',fecha:'20/10/2026'},{accion:'Enviado al cliente',fecha:'29/10/2026'}]},{enviadoEn:'2026-10-31'},{enviadoEn:'2026-10-29',vence:''},{enviadoEn:'2026-10-29',vence:'bad'}];
 const records=Object.fromEntries(variants.map((v,i)=>['k'+i,original({id:'PP-'+String(i+1).padStart(4,'0'),...v})]));const result=parity(records,{expiry:false});assert.equal(result.notices.length,5);
});
test('actual exclusions, uppercase active statuses and notification switches remain unchanged',()=>{
 const records=Object.fromEntries(['anulado','convertido','rechazado','vencido','ENVIADO','aceptado','revision'].map((estado,i)=>['s'+i,original({id:'PP-'+i,estado})]));records.deleted=original({eliminado:true});
 parity(records,{canApprove:true});assert.equal(parity(records,{expiry:false,noResponse:false}).notices.length,0);
});
test('101 candidates are consumed completely rather than as a first-page budget list',()=>{
 const records=Object.fromEntries(Array.from({length:101},(_,i)=>['k'+i,original({id:'PP-'+String(i+1).padStart(4,'0'),estado:'revision',vence:''})]));assert.equal(parity(records,{canApprove:true}).notices.length,101);
});
test('snapshot pins UID, permissions, session User, connection, generation and revision; rows are detached',()=>{
 const ctx=context(),e=envelope({p:original()}),snapshot=Adapter.adapt(e,ctx,{expectedGeneration:e.generation,expectedRevision:e.revision});assert(snapshot.complete);assert.equal(snapshot.completeForBudgetList,false);assert(Object.isFrozen(snapshot.rows[0]));
 Adapter.rowsFor(snapshot,ctx)[0]._alertado48h=true;assert(!Object.hasOwn(snapshot.rows[0],'_alertado48h'));
 for(const patch of [{uid:'other'},{role:'admin'},{permissionRevision:8},{sessionEpoch:2},{db:{}},{auth:{currentUser:{uid:'one'}}},{connected:false},{connectionEpoch:2},{grants:{presupuestos:null}},{timeZone:'UTC'}])assert.throws(()=>Adapter.rowsFor(snapshot,{...ctx,...patch}));
 assert.throws(()=>Adapter.adapt(e,ctx,{expectedRevision:4}));assert.throws(()=>Adapter.adapt(e,ctx,{expectedGeneration:'old'}));
 const oldUser=ctx.auth.currentUser;ctx.auth.currentUser={uid:'one'};assert.throws(()=>Adapter.rowsFor(snapshot,ctx));ctx.auth.currentUser=oldUser;
 assert.deepEqual(Adapter.rowsFor(Adapter.adapt(envelope({}),ctx,{}),ctx),[]);
});
test('partial, duplicate, foreign and unexpectedly rich candidates fail instead of manufacturing zero',()=>{
 const ctx=context(),good=envelope({p:original()});for(const edit of [e=>{e.complete=false;},e=>{e.rows.push(e.rows[0]);},e=>{e.rows[0].ownerUid='other';},e=>{e.rows[0].items=[];},e=>{delete e.rows[0].sentDay;},e=>{e.rows[0].amount=Infinity;},e=>{e.rows[0].admits=false;},e=>{e.rows[0].dueDay='2026-02-31';},e=>{e.uid='other';},e=>{e.permissionRevision++;}]){const bad=structuredClone(good);edit(bad);assert.throws(()=>Adapter.adapt(bad,ctx),{code:'SV_BUDGET_NOTICE_SNAPSHOT'});}
});
test('old minimal candidates without legacy evidence fail even if a caller passes the removed override',()=>{
 const ctx=context(),e=envelope({p:original()});delete e.rows[0].noticeLegacy;assert.throws(()=>Adapter.adapt(e,ctx,{legacyCodecCertified:true}),{code:'SV_BUDGET_NOTICE_SNAPSHOT'});
});
test('fresh direct result.notices consumes the same candidates without adding DTO fields or loading another consumer',()=>{
 const ctx=context(),e=envelope({p:original()}),{rows,complete,...metadata}=e,direct={...metadata,schema:2,notices:{complete,rows},notificationCenterComplete:false};
 const options={},expected=Adapter.adapt(e,ctx,options),actual=Adapter.adapt(direct,ctx,options);assert.deepEqual(Adapter.rowsFor(actual,ctx),Adapter.rowsFor(expected,ctx));
 for(const notices of [undefined,{complete:false,rows},{complete:true,rows:rows.slice().concat(rows)}])assert.throws(()=>Adapter.adapt({...direct,notices},ctx,options));
 assert.throws(()=>Adapter.adapt({...direct,notices:{complete:true,rows:[]},uid:'other'},ctx,options));
});
test('reconciled evidence preserves rollover and two-digit historical years with the actual parser',()=>{
 for(const enviadoEn of ['31/09/2026','29/10/26']){const records={p:original({enviadoEn})};assert.deepEqual(run(records,{expiry:false}),run(records,{expiry:false,adapted:true}),'Legacy parser parity: '+enviadoEn);}
});
test('reconciled evidence preserves absent id despite numero fallback in ordering',()=>{
 const p=original({estado:'revision',vence:'',numero:'PP-0042'});delete p.id;const records={p};assert.deepEqual(run(records,{canApprove:true}),run(records,{canApprove:true,adapted:true}));
});
test('legacy id presence and primitive values preserve actual titles, actions, fallback ordering and marks',()=>{
 const records=Object.fromEntries(['',0,false,null,42,'PP-0007'].map((id,i)=>['k'+i,original({id,numero:'PP-000'+i,estado:'revision'})]));const absent=original({numero:'PP-0042',estado:'revision'});delete absent.id;records.absent=absent;parity(records,{canApprove:true});
 const ctx=context(),snapshot=Adapter.adapt(envelope({absent}),ctx);assert(!Object.hasOwn(snapshot.rows[0],'id'));
});
test('positive numeric direct dates, invalid numeric instants and sent timestamp priority preserve real helper behavior',()=>{
 const records={direct:original({id:'PP-0001',enviadoEn:new Date('2026-10-29T23:00:00-03:00').getTime()}),fallback:original({id:'PP-0002',enviadoEn:0,fechaEnvio:new Date('2026-10-29T01:00:00-03:00').getTime()}),invalidDirect:original({id:'PP-0003',enviadoEn:1e20,audit:[{accion:'Enviado al cliente',fecha:'29/10/2026'}]}),invalidPriority:original({id:'PP-0004',enviadoTs:1e20,audit:[{accion:'Enviado al cliente',fecha:'29/10/2026'}]})};
 const result=parity(records,{expiry:false});assert.equal(result.notices.length,3);
});
test('bounded original prefixes preserve whitespace, numeric overflow and audit fallback without using sentDay',()=>{
 for(const enviadoEn of [' '.repeat(500)+'31/09/2026'+' trailing'.repeat(100),'2026-10-35suffix','29/10/26','2026-13-00','unparseable']){
  const records={p:original({enviadoEn,audit:[{accion:'Enviado al cliente',fecha:'20/10/2026'},{accion:'Editado',fecha:'2026-11-04',private:'NEVER_TRANSPORT'},{accion:'Enviado al cliente',fecha:'  29/10/2026 trailing'}]})};
  parity(records,{expiry:false,candidateEdit:e=>{e.rows[0].sentDay='2099-01-01';}});
 }
});
test('legacy evidence is minimal, handles pruned null timestamps, and does not expand the 17-field source row',()=>{
 const p=original({audit:[{accion:'Enviado al cliente',fecha:'29/10/2026',private:'NEVER_TRANSPORT'},{accion:'Editado',fecha:'2026-11-04',private:'NEVER_TRANSPORT'}],items:[{costo:987.654}]}),before=structuredClone(p),row=Model.projectRecord({key:'p',original:p,ownerUid:'one',offsetMinutes:-180}),legacy=Legacy.capture(p);
 assert.equal(Object.keys(row).length,17);assert(!Object.hasOwn(row,'noticeLegacy'));assert(!JSON.stringify(legacy).includes('NEVER_TRANSPORT'));assert(!JSON.stringify(legacy).includes('987.654'));assert.equal(legacy.auditSentRaw,'29/10/2026');assert.deepEqual(p,before);
 const pruned={...legacy};delete pruned.sentTs;assert.deepEqual(Legacy.validate(pruned),legacy);
 const ctx=context(),snapshot=Adapter.adapt(envelope({p}),ctx),copy=Adapter.rowsFor(snapshot,ctx);copy[0].audit[0].fecha='bad';assert.equal(snapshot.rows[0].audit[0].fecha,'29/10/2026');
});
test('nonfinite values and invalid injected evidence fail preparation without changing valid historical types',()=>{
 for(const p of [original({id:'x'.repeat(129)}),original({enviadoTs:Infinity}),original({enviadoEn:Infinity}),original({audit:[{accion:'Enviado al cliente',fecha:NaN}]})])assert.throws(()=>Legacy.capture(p),{code:'SV_BUDGET_NOTICE_LEGACY_RECONCILE'});
 const good=Legacy.capture(original());for(const change of [v=>{v.extra=[];},v=>{v.auditSentRaw={private:'x'};},v=>{v.idPresent=false;},v=>{v.sentRaw='x'.repeat(33);},v=>{v.sentTs=-1;},v=>{v.sentRaw=Infinity;},v=>{v.auditSentRaw=NaN;},v=>{delete v.schema;}]){const bad=structuredClone(good);change(bad);assert.throws(()=>Legacy.validate(bad),{code:'SV_BUDGET_NOTICE_LEGACY_RECONCILE'});}
});
test('negative and positive numeric direct history retains its type without promotion to enviadoTs',()=>{
 for(const enviadoEn of [-1,1,new Date('2026-10-29T23:00:00-03:00').getTime()]){const p=original({enviadoEn}),e=Legacy.capture(p),restored=Legacy.restore(e);assert.equal(e.sentTs,null);assert.equal(e.sentRaw,enviadoEn);assert.equal(restored.enviadoEn,enviadoEn);assert.equal(typeof restored.enviadoEn,'number');parity({p},{expiry:false});}
});
test('numeric audit negative, positive and zero preserve the selected event and actual parser behavior',()=>{
 for(const fecha of [-1,1,0,new Date('2026-10-29T23:00:00-03:00').getTime()]){const p=original({enviadoEn:'invalid',audit:[{accion:'Enviado al cliente',fecha:'2026-10-01'},{accion:'Enviado al cliente',fecha},{accion:'Editado',fecha:'2026-11-04'}]}),e=Legacy.capture(p),restored=Legacy.restore(e);assert.equal(e.auditSentRaw,fecha);assert.equal(e.sentTs,null);assert.equal(restored.audit[0].fecha,fecha);parity({p},{expiry:false});}
});
test('invalid direct numeric date falls back to latest numeric audit while original enviadoTs keeps precedence',()=>{
 const records={fallback:original({id:'PP-0001',enviadoEn:1e20,audit:[{accion:'Enviado al cliente',fecha:'2026-11-04'},{accion:'Enviado al cliente',fecha:-1}]}),validDirect:original({id:'PP-0002',enviadoEn:new Date('2026-11-03T12:00:00-03:00').getTime(),audit:[{accion:'Enviado al cliente',fecha:-1}]}),priority:original({id:'PP-0003',enviadoTs:1e20,enviadoEn:-1,audit:[{accion:'Enviado al cliente',fecha:-1}]}),zero:original({id:'PP-0004',enviadoEn:0,fechaEnvio:0,audit:[{accion:'Enviado al cliente',fecha:0}]})};assert.equal(parity(records,{expiry:false}).notices.length,1);
});
test('UMD modules share the same restoration in a browser context without transport or active app imports',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/core/dashboard-budget-notice-legacy-proposal.js'),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/core/dashboard-budget-notice-adapter-proposal.js'),'utf8'),c);
 assert.equal(typeof c.SVBudgetNoticeAdapterProposal.adapt,'function');assert.equal(JSON.stringify(c.SVBudgetNoticeLegacyProposal.restore(Legacy.capture(original()))),JSON.stringify(Legacy.restore(Legacy.capture(original()))));assert.equal(c.pptoData,undefined);
});

test('technical seller uses the same verified own snapshot without admitting an external role',()=>{
 const ctx=context();ctx.role='tecnico_vendedor';const snapshot=Adapter.adapt(envelope({p:original()},{role:ctx.role}),ctx);assert.equal(Adapter.rowsFor(snapshot,ctx)[0].id,'PP-0001');
 const denied=context();denied.role='distribuidora';assert.throws(()=>Adapter.adapt(envelope({p:original()},{role:denied.role}),denied));
});
