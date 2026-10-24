'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {functionSource}=require('./helpers/app-functions.cjs');
const source=fs.readFileSync(path.join(__dirname,'../js/core/data-query.js'),'utf8').replace(/\r\n/g,'\n');
const plain=value=>JSON.parse(JSON.stringify(value));
const tick=async()=>{await Promise.resolve();await Promise.resolve();};
function fixture(){
 const listeners=[],refs=[],events=new Map(),windowEvents=new Map(),errors=[],frames=[];let moduleAccess=true,dashboardAccess=true,domainAccess=true,visible=true;
 let page={id:'page-agenda',isConnected:true,classList:{contains:()=>true}};
 function emitter(target,registry){target.addEventListener=(name,callback)=>{if(!registry.has(name))registry.set(name,new Set());registry.get(name).add(callback);};target.removeEventListener=(name,callback)=>registry.get(name)?.delete(callback);target.emit=(name,event={})=>{for(const callback of [...(registry.get(name)||[])])callback(event);};return target;}
 const nodes=Object.fromEntries(['ag-calendario','ag-hoy','ag-semana','ag-inst','ag-recl','ag-titulo','page-agenda'].map(id=>[id,{id,innerHTML:'',textContent:'',dataset:{},attributes:{},setAttribute(name,value){this.attributes[name]=value;},classList:{toggle(){}}}]));
 const document=emitter({hidden:false,visibilityState:'visible',querySelector:selector=>{assert.equal(selector,'.page.active');return page;},querySelectorAll:()=>[],getElementById:id=>nodes[id]||null},events);
 const c=emitter({window:null,document,console:{error:(...args)=>errors.push(args)},isAuthenticated:true,currentUserUid:'fictional-user',currentRole:'admin',
  fbAuth:{currentUser:{uid:'fictional-user'}},PERMISOS_ROLES:{admin:{indiceRevision:3}},_svOperacionesSesionEpoch:1,_svDataEpoch:5,_impersonacionOriginal:null,
  location:{hash:'#/agenda'},fbDB:{name:'fictional-database'},SVForegroundSession:{isVisible:()=>visible},
  permisoModulo:name=>{assert.ok(['agenda','dashboard'].includes(name));return name==='dashboard'?dashboardAccess:moduleAccess;},svPuedeLeerDominio:name=>{assert.equal(name,'agenda');return domainAccess;},
  fbRef(db,key){assert.equal(db,c.fbDB);const ref={db,key};refs.push(ref);return ref;},
  fbOnValue(ref,rows,error){const listener={ref,rows,error,stops:0};listeners.push(listener);return ()=>listener.stops++;},
  fetch:()=>assert.fail('No network'),fbGet:()=>assert.fail('No GET'),fbSet:()=>assert.fail('No writes'),fbUpdate:()=>assert.fail('No writes'),
  setTimeout:()=>assert.fail('No timer'),setInterval:()=>assert.fail('No clock'),requestAnimationFrame:fn=>frames.push(fn)
 },windowEvents);
 c.window=c;vm.createContext(c);vm.runInContext(source,c);const api=c.SisVentas.DataQuery;
 const start='2026-10-01',end='2026-10-31',range={start,end};
 const received=[],failures=[];
 function subscribe(bounds=range){const receivedHere=[],errorsHere=[];const unsubscribe=api.subscribeDateRange('sisventas/agenda',bounds,(rows,returnedBounds)=>{receivedHere.push({rows,bounds:returnedBounds});received.push({rows,bounds:returnedBounds});},error=>{errorsHere.push(error);failures.push(error);});return {unsubscribe,received:receivedHere,errors:errorsHere};}
 function all(){const receivedHere=[],errorsHere=[];const unsubscribe=api.subscribeAll('sisventas/agenda',(rows,returnedBounds)=>{receivedHere.push({rows,bounds:returnedBounds});},error=>errorsHere.push(error));return {unsubscribe,received:receivedHere,errors:errorsHere};}
 return {c,api,get page(){return page;},nodes,events,windowEvents,listeners,refs,errors,range,received,failures,subscribe,all,navigate(name,emit=true){page={id:'page-'+name,isConnected:true,classList:{contains:()=>true}};c.location.hash='#/'+name;if(emit)document.emit('sisventas:page-changed');},module(value,name='agenda'){if(name==='dashboard')dashboardAccess=value;else moduleAccess=value;},domain(value){domainAccess=value;},visible(value){visible=value;document.hidden=!value;},deliver(data,i=listeners.length-1){listeners[i].rows({val:()=>data});},sdkError(error=Error('Fictitious denied subscription'),i=listeners.length-1){listeners[i].error(error);},countEvents:()=>[...events.values(),...windowEvents.values()].reduce((sum,list)=>sum+list.size,0)};
}
const data={2:{fecha:'2026-10-04',descripcion:'Segundo'},10:{fecha:'2026-10-08T12:00:00Z',descripcion:'Décimo'},old:{fecha:'2020-01-01',descripcion:'Anterior'},future:{fecha:'2030-01-01',descripcion:'Futuro'},missing:{descripcion:'Sin fecha'}};

test('three synchronous range handoffs share one source and release only after the last microtask',async()=>{
 const f=fixture(),a=f.subscribe();f.deliver(data);assert.equal(f.listeners.length,1);a.unsubscribe();const b=f.subscribe({start:'2026-10-08',end:'2026-10-31'});b.unsubscribe();const d=f.subscribe({start:'2020-01-01',end:'2030-01-01'});
 await tick();assert.equal(f.listeners.length,1);assert.equal(f.listeners[0].stops,0);assert.equal(a.received.length,1);assert.equal(b.received.length,0);assert.deepEqual(plain(d.received[0].rows).map(row=>row.fbKey),['2','10','old','future']);assert.equal(d.unsubscribe.valid(),true);
 d.unsubscribe();assert.equal(d.unsubscribe.valid(),false);assert.equal(f.listeners[0].stops,0);await tick();assert.equal(f.listeners[0].stops,1);assert.equal(f.countEvents(),0);
 const next=f.subscribe();assert.equal(f.listeners.length,2);assert.equal(next.received.length,0);next.unsubscribe();await tick();
});
test('multiple active consumers have independent inclusive bounds and share pushed updates',async()=>{
 const f=fixture(),a=f.subscribe({start:'2026-10-01',end:'2026-10-04'}),b=f.subscribe({start:'2026-10-08',end:'2026-10-08'});assert.equal(f.listeners.length,1);f.deliver(data);
 assert.deepEqual(plain(a.received[0].rows).map(row=>row.fbKey),['2']);assert.deepEqual(plain(b.received[0].rows).map(row=>row.fbKey),['10']);assert.equal(a.received[0].bounds.start,'2026-10-01');
 f.deliver({...data,last:{fecha:'2026-10-04T23:59:59.999Z'}});assert.equal(a.received[1].rows.length,2);assert.equal(b.received[1].rows.length,1);a.unsubscribe();await tick();assert.equal(f.listeners[0].stops,0);b.unsubscribe();await tick();assert.equal(f.listeners[0].stops,1);
});
test('numeric arrays, alias fbKey and String(fecha).slice filters retain the previous exact semantics',async()=>{
 const f=fixture(),s=f.subscribe({start:'2026-10-04',end:'2026-10-08'}),rows=[];rows[2]={fecha:'2026-10-04',fbKey:'legacy-alias'};rows[10]={fecha:'2026-10-08T12:00:00Z'};rows[15]=null;rows[20]={fecha:20261008};f.deliver(rows);
 const expected=Object.entries(rows||{}).map(entry=>Object.assign({fbKey:entry[0]},entry[1]||{})).filter(row=>String(row.fecha||'').slice(0,10)>='2026-10-04'&&String(row.fecha||'').slice(0,10)<='2026-10-08');assert.deepEqual(plain(s.received[0].rows),expected);assert.equal(s.received[0].rows[0].fbKey,'legacy-alias');s.unsubscribe();await tick();
});
test('a confirmed empty push is reusable but an error is never rendered as empty data',async()=>{
 const f=fixture(),a=f.subscribe();f.deliver(null);assert.equal(a.received.length,1);assert.deepEqual(plain(a.received[0].rows),[]);a.unsubscribe();const b=f.subscribe();await tick();assert.equal(f.listeners.length,1);assert.deepEqual(plain(b.received[0].rows),[]);
 const denied=Object.assign(Error('Fictitious denied'),{code:'permission-denied'});f.sdkError(denied);await tick();assert.equal(b.errors.length,1);assert.equal(b.errors[0],denied);assert.equal(b.received.length,1);assert.equal(b.unsubscribe.valid(),false);assert.equal(f.listeners[0].stops,1);assert.equal(f.countEvents(),0);
});
test('an in-flight source is shared before its first push without inventing ready empty',async()=>{const f=fixture(),a=f.subscribe();a.unsubscribe();const b=f.subscribe();await tick();assert.equal(f.listeners.length,1);assert.equal(b.received.length,0);f.deliver(data);assert.equal(b.received.length,1);assert.equal(a.received.length,0);b.unsubscribe();await tick();});
test('a newer SDK push supersedes a queued ready replay',async()=>{const f=fixture(),a=f.subscribe();f.deliver(data);a.unsubscribe();const b=f.subscribe();f.deliver({fresh:{fecha:'2026-10-10'}});await tick();assert.equal(b.received.length,1);assert.equal(b.received[0].rows[0].fbKey,'fresh');b.unsubscribe();await tick();});
for(const [label,change]of [
 ['UID',f=>f.c.currentUserUid='other'],['Auth object',f=>f.c.fbAuth.currentUser={uid:'fictional-user'}],['Auth UID',f=>f.c.fbAuth.currentUser.uid='other'],['authenticated',f=>f.c.isAuthenticated=false],
 ['role',f=>f.c.currentRole='tecnico'],['revision',f=>f.c.PERMISOS_ROLES.admin.indiceRevision++],['epoch',f=>f.c._svOperacionesSesionEpoch++],['view',f=>f.c._impersonacionOriginal={}],
 ['module permission',f=>f.module(false)],['domain permission',f=>f.domain(false)],['database',f=>f.c.fbDB={}],['ref SDK',f=>f.c.fbRef=()=>assert.fail('A retired callback must not call the new SDK')],
 ['onValue SDK',f=>f.c.fbOnValue=()=>assert.fail('A retired callback must not rewatch')],['route hash',f=>f.c.location.hash='#/dashboard'],['page',f=>f.page.id='page-dashboard'],
 ['page active',f=>f.page.classList.contains=()=>false],['page disconnected',f=>f.page.isConnected=false],['hidden',f=>f.visible(false)]
])test(label+' retirement is checked before snapshot.val and notifies the consumer without empty rows',async()=>{
 const f=fixture(),a=f.subscribe();change(f);f.listeners[0].rows({val:()=>assert.fail('A retired snapshot must not be decoded')});assert.equal(a.unsubscribe.valid(),false);await tick();assert.equal(a.received.length,0);assert.equal(a.errors.length,1);assert.equal(a.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');assert.equal(f.listeners[0].stops,1);assert.equal(f.countEvents(),0);
});
test('in-place view-profile changes are also rejected before decoding',async()=>{const f=fixture();f.c._impersonacionOriginal={usuarioFbKey:'first'};const a=f.subscribe();f.c._impersonacionOriginal.usuarioFbKey='second';f.listeners[0].rows({val:()=>assert.fail('Old view')});await tick();assert.equal(a.errors.length,1);assert.equal(a.received.length,0);});
for(const event of ['visibilitychange','sisventas:foreground-paused','sisventas:session-ended','sisventas:role-changed','sisventas:page-changed','hashchange','pagehide'])test(event+' stops the source; restoration does not create a listener',async()=>{
 const f=fixture(),a=f.subscribe();f.deliver(data);
 if(event==='visibilitychange'||event==='sisventas:foreground-paused')f.visible(false);if(event==='sisventas:page-changed')f.page.id='page-dashboard';if(event==='hashchange')f.c.location.hash='#/dashboard';
 (event==='hashchange'||event==='pagehide'?f.c:f.c.document).emit(event);await tick();assert.equal(f.listeners[0].stops,1);assert.equal(a.errors.length,1);assert.equal(f.countEvents(),0);
 f.visible(true);f.page.id='page-agenda';f.c.location.hash='#/agenda';f.c.document.emit('sisventas:foreground-restored');f.c.document.emit('visibilitychange');f.c.emit('pageshow');f.c.emit('focus');await tick();assert.equal(f.listeners.length,1);assert.equal(a.received.length,1);
});
test('queued retirement of the old client cannot clear or stop an explicitly opened replacement',async()=>{
 const f=fixture(),a=f.subscribe();f.c._svOperacionesSesionEpoch++;f.listeners[0].rows({val:()=>assert.fail('Old callback')});const b=f.subscribe();await tick();assert.equal(a.errors.length,0);assert.equal(b.errors.length,0);assert.equal(f.listeners.length,2);assert.equal(f.listeners[0].stops,1);assert.equal(f.listeners[1].stops,0);
 f.deliver(data,1);f.listeners[0].error(Error('Late old error'));f.listeners[0].rows({val:()=>assert.fail('Late old snapshot')});await tick();assert.equal(b.received.length,1);assert.equal(b.errors.length,0);assert.equal(f.listeners[1].stops,0);a.unsubscribe();b.unsubscribe();await tick();assert.equal(f.listeners[1].stops,1);
});
test('leaving during ready replay cancels delivery and retires without a background rewatch',async()=>{const f=fixture(),a=f.subscribe();f.deliver(data);a.unsubscribe();const b=f.subscribe();f.visible(false);f.c.document.emit('visibilitychange');await tick();assert.equal(b.received.length,0);assert.equal(b.errors.length,1);assert.equal(f.listeners.length,1);assert.equal(f.listeners[0].stops,1);});
for(const missing of ['fbDB','fbRef','fbOnValue','fbAuth','permisoModulo','svPuedeLeerDominio'])test('missing '+missing+' returns an invalid cancelable consumer and does not start IO',async()=>{
 const f=fixture();delete f.c[missing];const a=f.subscribe();assert.equal(a.unsubscribe.valid(),false);assert.equal(a.errors.length,0);await tick();assert.equal(a.errors.length,1);assert.equal(f.listeners.length,0);assert.equal(f.countEvents(),0);
});
test('synchronous SDK failure is reported after assignment and without a hanging source',async()=>{
 const f=fixture();f.c.fbOnValue=()=>{throw Error('Fictitious synchronous SDK error');};let unsubscribe,noticed;
 unsubscribe=f.api.subscribeDateRange('sisventas/agenda',f.range,()=>assert.fail('No empty rows'),()=>{noticed=unsubscribe;});assert.equal(unsubscribe.valid(),false);assert.equal(noticed,undefined);await tick();assert.equal(noticed,unsubscribe);assert.equal(f.countEvents(),0);
});
test('synchronous SDK cancellation still disposes the unsubscribe returned afterward',async()=>{
 const f=fixture();let stops=0;f.c.fbOnValue=(_ref,_rows,error)=>{error(Error('Fictitious synchronous denial'));return()=>stops++;};const a=f.subscribe();await tick();assert.equal(stops,1);assert.equal(a.errors.length,1);assert.equal(a.unsubscribe.valid(),false);assert.equal(f.countEvents(),0);
});
test('the real application global let bindings are used instead of absent window aliases',async()=>{
 const f=fixture();delete f.c.currentUserUid;delete f.c.currentRole;delete f.c.isAuthenticated;
 vm.runInContext('let currentUserUid="fictional-user",currentRole="admin",isAuthenticated=true;',f.c);
 const a=f.subscribe();assert.equal(f.listeners.length,1);assert.equal(a.unsubscribe.valid(),true);f.deliver(data);assert.equal(a.received.length,1);
 vm.runInContext('currentUserUid="other";',f.c);f.listeners[0].rows({val:()=>assert.fail('The retired lexical user must be checked before decoding')});await tick();assert.equal(a.errors.length,1);assert.equal(f.listeners[0].stops,1);
});
test('a manually cancelled consumer never receives its already queued error',async()=>{const f=fixture(),a=f.subscribe();f.sdkError();a.unsubscribe();await tick();assert.equal(a.errors.length,0);assert.equal(f.listeners[0].stops,1);});
test('the actual Agenda loader changes three ranges with one root subscription and receives new pushes',async()=>{
 const f=fixture();Object.assign(f.c,{AG_DATA:[],AG_VISTA:'semana',AG_CURSOR:new Date(2026,9,1),AG_UNSUBSCRIBE:null,AG_LISTENER_FIRMA:'',fbCargarOTs(){},agRenderCalendario(){},agActualizarMetricas(){}});vm.runInContext(functionSource('agPintarEstadoLectura')+'\n'+functionSource('fbCargarAgenda'),f.c);
 f.c.fbCargarAgenda();f.deliver(data);f.c.AG_CURSOR=new Date(2026,9,8);f.c.fbCargarAgenda();f.c.AG_CURSOR=new Date(2026,9,15);f.c.fbCargarAgenda();await tick();assert.equal(f.listeners.length,1);assert.equal(f.listeners[0].stops,0);assert.equal(f.c.AG_UNSUBSCRIBE.valid(),true);
 f.deliver({match:{fecha:'2026-10-15',descripcion:'Actualización ficticia'}});assert.equal(f.c.AG_DATA.length,1);assert.equal(f.c.AG_DATA[0].fbKey,'match');f.visible(false);f.c.document.emit('visibilitychange');await tick();assert.equal(f.c.AG_UNSUBSCRIBE,null);assert.equal(f.c.AG_LISTENER_FIRMA,'');assert.equal(f.listeners[0].stops,1);
 f.visible(true);f.c.document.emit('sisventas:foreground-restored');await tick();assert.equal(f.listeners.length,1);f.c.fbCargarAgenda();assert.equal(f.listeners.length,2);f.c.AG_UNSUBSCRIBE();await tick();
});
function realAgendaFixture(){
 const f=fixture();Object.assign(f.c,{AG_DATA:[],AG_VISTA:'semana',AG_CURSOR:new Date(2026,9,19),AG_UNSUBSCRIBE:null,AG_LISTENER_FIRMA:'',otData:[],
  fbCargarOTs(){},svFechaLocalISO:()=> '2026-10-24',escapeHTML:value=>String(value),agCoincideFiltro:()=>true,agPendientesHTML:()=>'',agEsPantallaMovil:()=>false,
  agInicioSemana:date=>date,agRenderSemana:()=>'<div>Vista ficticia lista</div>'});
 for(const name of ['agPintarEstadoLectura','fbCargarAgenda','agGetTodosEventos','agActualizarMetricas','agRenderCalendario'])vm.runInContext(functionSource(name),f.c);
 f.metrics=()=>['ag-hoy','ag-semana','ag-inst','ag-recl'].map(id=>f.nodes[id].textContent);return f;
}
test('real same-signature loading guards keep KPI unknown instead of painting empty events',async()=>{
 const f=realAgendaFixture();f.c.fbCargarAgenda();assert.equal(f.c._agEstadoLectura,'loading');assert.deepEqual(f.metrics(),['—','—','—','—']);assert.match(f.nodes['ag-calendario'].innerHTML,/Cargando agenda/);assert.equal(f.nodes['ag-calendario'].attributes['aria-busy'],'true');
 f.c.fbCargarAgenda();assert.equal(f.listeners.length,1);assert.equal(f.c._agEstadoLectura,'loading');assert.deepEqual(f.metrics(),['—','—','—','—']);assert.match(f.nodes['ag-calendario'].innerHTML,/Cargando agenda/);f.c.AG_UNSUBSCRIBE();await tick();
});
test('real source error retires AG memory and KPI and offers retry without inventing zero',async()=>{
 const f=realAgendaFixture();f.c.fbCargarAgenda();f.deliver({one:{fecha:'2026-10-24',descripcion:'Ficticio'}});assert.equal(f.c._agEstadoLectura,'ready');assert.equal(f.c.AG_DATA.length,1);assert.equal(f.nodes['ag-hoy'].textContent,1);assert.equal(f.nodes['ag-calendario'].attributes['aria-busy'],'false');
 f.sdkError();await tick();assert.equal(f.c._agEstadoLectura,'error');assert.equal(f.c.AG_DATA.length,0);assert.deepEqual(f.metrics(),['—','—','—','—']);assert.match(f.nodes['ag-calendario'].innerHTML,/role="alert"/);assert.match(f.nodes['ag-calendario'].innerHTML,/Reintentar/);assert.equal(f.nodes['ag-calendario'].attributes['aria-busy'],'false');assert.equal(f.c.AG_UNSUBSCRIBE,null);assert.equal(f.c.AG_LISTENER_FIRMA,'');assert.equal(f.errors.length,1);assert.equal(f.errors[0][0],'[Agenda]');
 f.c.fbCargarAgenda();assert.equal(f.listeners.length,2);assert.deepEqual(f.metrics(),['—','—','—','—']);f.deliver(null);assert.equal(f.c._agEstadoLectura,'ready');assert.equal(f.c.AG_DATA.length,0);assert.deepEqual(f.metrics(),[0,0,0,0]);assert.doesNotMatch(f.nodes['ag-calendario'].innerHTML,/role="alert"/);f.c.AG_UNSUBSCRIBE();await tick();
});
for(const event of ['sisventas:foreground-paused','sisventas:page-changed'])test('real '+event+' retires loaded memory and needs an explicit action to read again',async()=>{
 const f=realAgendaFixture();f.c.fbCargarAgenda();f.deliver({one:{fecha:'2026-10-24'}});if(event==='sisventas:foreground-paused')f.visible(false);else f.page.id='page-dashboard';f.c.document.emit(event);await tick();assert.equal(f.c.AG_DATA.length,0);assert.equal(f.c._agEstadoLectura,'idle');assert.deepEqual(f.metrics(),['—','—','—','—']);assert.equal(f.c.AG_UNSUBSCRIBE,null);assert.equal(f.errors.length,0);assert.doesNotMatch(f.nodes['ag-calendario'].innerHTML,/role="alert"|No se pudo cargar/);
 f.visible(true);f.page.id='page-agenda';f.c.document.emit('sisventas:foreground-restored');f.c.document.emit('sisventas:page-changed');await tick();assert.equal(f.listeners.length,1);f.c.fbCargarAgenda();assert.equal(f.listeners.length,2);assert.equal(f.c._agEstadoLectura,'loading');assert.deepEqual(f.metrics(),['—','—','—','—']);f.c.AG_UNSUBSCRIBE();await tick();
});
for(const event of ['visibilitychange','sisventas:foreground-paused','sisventas:session-ended','sisventas:role-changed','sisventas:page-changed','hashchange'])test('normal '+event+' produces neutral idle without false alert, console error or automatic read',async()=>{
 const f=realAgendaFixture();f.c.fbCargarAgenda();f.deliver({one:{fecha:'2026-10-24',descripcion:'Dato ficticio'}});
 if(event==='visibilitychange'||event==='sisventas:foreground-paused')f.visible(false);if(event==='sisventas:page-changed')f.page.id='page-dashboard';if(event==='hashchange')f.c.location.hash='#/dashboard';
 (event==='hashchange'?f.c:f.c.document).emit(event);await tick();assert.equal(f.c._agEstadoLectura,'idle');assert.equal(f.c.AG_DATA.length,0);assert.deepEqual(f.metrics(),['—','—','—','—']);assert.equal(f.c.AG_UNSUBSCRIBE,null);assert.equal(f.c.AG_LISTENER_FIRMA,'');assert.equal(f.nodes['ag-calendario'].attributes['aria-busy'],'false');assert.equal(f.errors.length,0);assert.equal(f.listeners[0].stops,1);assert.equal(f.countEvents(),0);assert.match(f.nodes['ag-calendario'].innerHTML,/role="status"/);assert.doesNotMatch(f.nodes['ag-calendario'].innerHTML,/role="alert"|No se pudo cargar|Reintentar/);
 f.visible(true);f.page.id='page-agenda';f.c.location.hash='#/agenda';f.c.document.emit('sisventas:foreground-restored');f.c.document.emit('visibilitychange');await tick();assert.equal(f.listeners.length,1);assert.equal(f.c._agEstadoLectura,'idle');
});
test('range, iso and row projection stay byte-identical to the previous helper',()=>{
 const previous=require('node:child_process').execFileSync('git',['show','HEAD:js/core/data-query.js'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).replace(/\r\n/g,'\n');
 function fn(text,name){const start=text.indexOf('  function '+name+'('),end=text.indexOf('\n  }',start)+4;assert.ok(start>=0&&end>start);return text.slice(start,end);}
 for(const name of ['iso','range','toRows'])assert.equal(fn(source,name),fn(previous,name));assert.doesNotMatch(source,/setTimeout\(|setInterval\(|fbGet\(|fbQuery\(|fbSet\(|fbUpdate\(/);
});

test('Dashboard All shares one pending transport and decodes each push exactly once for three consumers',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all(),b=f.all(),c=f.all();assert.equal(f.listeners.length,1);assert.equal(a.received.length,0);let decoded=0;f.listeners[0].rows({val(){decoded++;return data;}});assert.equal(decoded,1);
 const expected=Object.entries(data).map(([fbKey,row])=>Object.assign({fbKey},row));for(const consumer of [a,b,c]){assert.deepEqual(plain(consumer.received[0].rows),expected);assert.equal(consumer.received[0].bounds,undefined);assert.equal(consumer.unsubscribe.valid(),true);}
 a.received[0].rows.splice(0);assert.equal(b.received[0].rows.length,expected.length);a.unsubscribe();b.unsubscribe();c.unsubscribe();await tick();assert.equal(f.listeners[0].stops,1);assert.equal(f.countEvents(),0);
});
test('All retains all future/history rows, alias fields, legacy dates and numeric root enumeration',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all(),rows=[];rows[2]={fecha:2026,descripcion:'Número'};rows[10]={fecha:['2026-10-24'],fbKey:'alias'};rows[12]={fecha:' 2026-10-24 '};rows[25]={fecha:'24/10/2026'};rows[35]={fecha:'2039-01-01'};f.deliver(rows);assert.deepEqual(plain(a.received[0].rows),Object.entries(rows).map(([fbKey,row])=>Object.assign({fbKey},row)));assert.equal(a.received[0].rows.length,5);a.unsubscribe();await tick();
});
test('a ready Dashboard to Agenda to Dashboard synchronous handoff retains one root transport and latest pushes',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all();f.deliver(data);a.unsubscribe();f.navigate('agenda');const b=f.subscribe({start:'2026-10-08',end:'2026-10-08'});await tick();assert.equal(f.listeners.length,1);assert.equal(f.listeners[0].stops,0);assert.deepEqual(plain(b.received[0].rows).map(row=>row.fbKey),['10']);assert.equal(a.unsubscribe.valid(),false);assert.equal(b.unsubscribe.valid(),true);
 let decoded=0;const next={old:{fecha:'2016-01-01'},fresh:{fecha:'2026-10-08'},later:{fecha:'2040-01-01'}};f.listeners[0].rows({val(){decoded++;return next;}});assert.equal(decoded,1);assert.deepEqual(plain(b.received.at(-1).rows).map(row=>row.fbKey),['fresh']);assert.equal(a.received.length,1);
 b.unsubscribe();f.navigate('dashboard');const c=f.all();await tick();assert.equal(f.listeners.length,1);assert.deepEqual(plain(c.received[0].rows).map(row=>row.fbKey),['old','fresh','later']);assert.equal(c.unsubscribe.valid(),true);a.unsubscribe();b.unsubscribe();assert.equal(f.listeners[0].stops,0);c.unsubscribe();await tick();assert.equal(f.listeners[0].stops,1);
});
test('an in-flight page handoff waits for the original push instead of starting a second source or inventing empty',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all();a.unsubscribe();f.navigate('agenda');const b=f.subscribe();await tick();assert.equal(f.listeners.length,1);assert.equal(b.received.length,0);f.deliver(data);assert.equal(b.received.length,1);assert.equal(a.received.length,0);b.unsubscribe();await tick();
});
test('page retirement can precede a same-turn replacement without stopping its source or delivering to the old page',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all();f.deliver(data);f.navigate('agenda');assert.equal(a.unsubscribe.valid(),false);const b=f.subscribe();await tick();assert.equal(f.listeners.length,1);assert.equal(f.listeners[0].stops,0);assert.equal(a.errors.length,1);assert.equal(a.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');assert.equal(b.received.length,1);assert.equal(a.received.length,1);b.unsubscribe();await tick();
});
test('an actual page exit stops after one microtask; a later entry creates a new source without keepalive',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all();f.deliver(data);f.navigate('agenda');await tick();assert.equal(f.listeners[0].stops,1);assert.equal(a.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');const b=f.subscribe();assert.equal(f.listeners.length,2);assert.equal(b.received.length,0);b.unsubscribe();await tick();
});
test('a pushed snapshot during a zero-consumer handoff is not decoded or cached as a stale ready result',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all();f.deliver(data);a.unsubscribe();f.navigate('agenda');f.listeners[0].rows({val:()=>assert.fail('No valid consumer may decode the handoff gap')});assert.equal(f.listeners[0].stops,1);const b=f.subscribe();assert.equal(f.listeners.length,2);await tick();assert.equal(b.received.length,0);f.deliver({fresh:{fecha:'2026-10-09'}});assert.deepEqual(plain(b.received[0].rows).map(row=>row.fbKey),['fresh']);b.unsubscribe();await tick();
});
for(const [name,change]of [
 ['UID',f=>f.c.currentUserUid='other'],['Auth object',f=>f.c.fbAuth.currentUser={uid:'fictional-user'}],['role',f=>f.c.currentRole='tecnico'],['permission revision',f=>f.c.PERMISOS_ROLES.admin.indiceRevision++],['epoch',f=>f.c._svOperacionesSesionEpoch++],['view',f=>f.c._impersonacionOriginal={}],['domain permission',f=>f.domain(false)],['Dashboard module permission',f=>f.module(false,'dashboard')],['database',f=>f.c.fbDB={}],['onValue SDK',f=>f.c.fbOnValue=()=>assert.fail('No replacement SDK')],['route hash',f=>f.c.location.hash='#/other'],['page node',f=>f.navigate('dashboard',false)],['hidden',f=>f.visible(false)]
])test('All rejects stale '+name+' before snapshot.val and never reopens automatically',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all();change(f);f.listeners[0].rows({val:()=>assert.fail('Retired All snapshot')});await tick();assert.equal(a.received.length,0);assert.equal(a.errors.length,1);assert.equal(a.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');assert.equal(a.unsubscribe.valid(),false);assert.equal(f.listeners[0].stops,1);f.visible(true);f.c.document.emit('sisventas:foreground-restored');f.c.document.emit('visibilitychange');assert.equal(f.listeners.length,1);
});
for(const event of ['visibilitychange','sisventas:foreground-paused','sisventas:session-ended','sisventas:role-changed','sisventas:page-changed','hashchange','pagehide'])test('All '+event+' retires normally and does not create background reads',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all();f.deliver(data);if(event==='visibilitychange'||event==='sisventas:foreground-paused')f.visible(false);if(event==='sisventas:page-changed')f.navigate('other',false);if(event==='hashchange')f.c.location.hash='#/other';(event==='hashchange'||event==='pagehide'?f.c:f.c.document).emit(event);await tick();assert.equal(a.errors.length,1);assert.equal(a.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');assert.equal(f.listeners[0].stops,1);assert.equal(f.countEvents(),0);assert.equal(f.errors.length,0);f.visible(true);f.navigate('dashboard');f.c.emit('focus');f.c.document.emit('visibilitychange');await tick();assert.equal(f.listeners.length,1);
});
test('an invalid All caller cannot stop an authorized Agenda range consumer or start another transport',async()=>{
 const f=fixture(),a=f.subscribe(),invalid=f.all();await tick();assert.equal(invalid.unsubscribe.valid(),false);assert.equal(invalid.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');assert.equal(a.unsubscribe.valid(),true);assert.equal(f.listeners.length,1);assert.equal(f.listeners[0].stops,0);f.deliver(data);assert.equal(a.received.length,1);assert.equal(invalid.received.length,0);a.unsubscribe();await tick();
});
test('an invalid range caller cannot stop an authorized Dashboard All consumer',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all(),invalid=f.subscribe();await tick();assert.equal(invalid.unsubscribe.valid(),false);assert.equal(invalid.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');assert.equal(a.unsubscribe.valid(),true);assert.equal(f.listeners.length,1);assert.equal(f.listeners[0].stops,0);f.deliver(data);assert.equal(a.received.length,1);assert.equal(invalid.received.length,0);a.unsubscribe();await tick();
});
test('Dashboard module denial never starts IO and Agenda access does not authorize the Dashboard consumer',async()=>{
 const f=fixture();f.navigate('dashboard');f.module(false,'dashboard');const a=f.all();assert.equal(f.listeners.length,0);await tick();assert.equal(a.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');assert.equal(a.unsubscribe.valid(),false);assert.equal(f.countEvents(),0);
});
test('an Agenda module denial does not remove separately authorized Dashboard agenda access',async()=>{
 const f=fixture();f.navigate('dashboard');f.module(false);const a=f.all();assert.equal(f.listeners.length,1);f.deliver(data);assert.equal(a.received.length,1);a.unsubscribe();await tick();
});
test('a real All source failure differs from empty or retirement and retry is explicit',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all();f.deliver(data);const denied=Object.assign(Error('Fictitious denied'),{code:'permission-denied'});f.sdkError(denied);await tick();assert.equal(a.errors[0],denied);assert.equal(a.received.length,1);assert.equal(a.unsubscribe.valid(),false);assert.equal(f.listeners[0].stops,1);assert.equal(f.listeners.length,1);const b=f.all();assert.equal(f.listeners.length,2);assert.equal(b.received.length,0);f.deliver(null);assert.deepEqual(plain(b.received[0].rows),[]);assert.equal(b.errors.length,0);b.unsubscribe();await tick();
});
test('a late SDK error after page retirement cannot be reported as a live-page failure',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all();f.navigate('agenda',false);f.sdkError(Error('Late old page error'));await tick();assert.equal(a.errors.length,1);assert.equal(a.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');assert.equal(a.received.length,0);assert.equal(f.listeners[0].stops,1);
});
test('All permission loss during snapshot decoding discards rows instead of delivering after the context changed',async()=>{
 const f=fixture();f.navigate('dashboard');const a=f.all();f.listeners[0].rows({val(){f.module(false,'dashboard');return data;}});await tick();assert.equal(a.received.length,0);assert.equal(a.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');assert.equal(f.listeners[0].stops,1);
});
for(const mode of ['range','all'])for(const field of ['_svOperacionesSesionEpoch','_svDataEpoch'])test(mode+' rejects changed '+field+' before decoding a snapshot',async()=>{
 const f=fixture();if(mode==='all')f.navigate('dashboard');const a=mode==='all'?f.all():f.subscribe();f.c[field]++;f.listeners[0].rows({val:()=>assert.fail('Changed '+field+' must fence before decode')});await tick();assert.equal(a.received.length,0);assert.equal(a.errors[0].code,'SV_AGENDA_SOURCE_RETIRED');assert.equal(f.listeners[0].stops,1);assert.equal(f.countEvents(),0);
});
