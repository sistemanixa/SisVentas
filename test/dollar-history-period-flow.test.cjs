const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/dolar-historico.js','utf8'),model=require('../js/core/dollar-history-scope.v1');
const flush=async()=>{for(let i=0;i<18;i++)await Promise.resolve();};
function fixture(kind='period'){
 const listeners={},reads=[],writes=[],paints=[],states=[],notices=[],controls={'[data-page-size]':{},'[data-newer]':{},'[data-older]':{},'[data-history-range]':{}},timers=[];
 let chartRequest=null,visible=true,allowed=true;const selection={anchor:'2026-10-24',mode:'month'},page={id:'page-configuracion'};
 const card={attrs:{},setAttribute(k,v){this.attrs[k]=v;},getClientRects:()=>visible?[{}]:[]};
 const nodes={'dh-history-scope':{value:kind},'cfg-dolar-historico-card':card};
 ['dh-estado','dh-scope-note','dh-oficial','dh-blue','dh-mep','dh-count'].forEach(k=>nodes[k]={textContent:''});
 const tbody={innerHTML:'',closest:()=>({parentElement:{after(nav){nodes[nav.id]=nav;}}})};nodes['dolar-historico-tbody']=tbody;
 const document={hidden:false,visibilityState:'visible',body:{classList:{contains:()=>false}},querySelector:()=>page,
  getElementById:id=>nodes[id]||null,createElement:()=>({style:{},querySelector:s=>controls[s]}),
  addEventListener(name,callback){(listeners[name]??=[]).push(callback);}};
 const window={location:{hash:'#/configuracion'},currentUserUid:'user-a',currentRole:'admin',fbAuth:{currentUser:{uid:'user-a'}},fbDB:{},_svDataEpoch:1,_svOperacionesSesionEpoch:1,PERMISOS_ROLES:{admin:{indiceRevision:1}},
  permisoModulo:()=>allowed,SVForegroundSession:{isVisible:()=>visible},SVDollarHistoryScope:model,
  fbRef:(_,path)=>({type:'ref',path}),fbQuery:(ref,...constraints)=>({type:'query',ref,constraints}),fbOrderByKey:()=>({kind:'key'}),fbStartAt:value=>({kind:'start',value}),fbEndAt:value=>({kind:'end',value}),
  fbGet(ref){return new Promise((resolve,reject)=>reads.push({ref,resolve,reject}));},fbUpdate(ref,data){writes.push({ref,data});return Promise.resolve();},
  SisVentasDolarMensual:{getSelection:()=>({...selection}),bindSource(fn){chartRequest=fn;},sourceState(status){states.push(status);},update(rows){paints.push(rows);}}};
 const c={window,document,Date,console,AbortController,notify:m=>notices.push(m),setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},clearInterval(){}};
 vm.createContext(c);vm.runInContext('let isAuthenticated=true;\n'+source,c);
 return {window,document,c,reads,writes,paints,states,notices,nodes,tbody,controls,page,card,selection,
  emit(name,detail={}){for(const fn of listeners[name]||[])fn({detail});},
  visible(value,event=true){visible=value;document.hidden=!value;document.visibilityState=value?'visible':'hidden';if(event)this.emit('visibilitychange');},
  allow(value){allowed=value;},auth(value){c.nextAuth=value;vm.runInContext('isAuthenticated=nextAuth',c);delete c.nextAuth;},runTimers(){timers.splice(0).forEach(fn=>fn());},
  chart(anchor,mode){selection.anchor=anchor;selection.mode=mode;return chartRequest();},
  deliver(raw,index=reads.length-1){let vals=0;reads[index].resolve({val(){vals++;return raw;}});return()=>vals;}
 };
}
const sample={old:{a:{ts:10,oficial:1400.01}},'2026-09-30':{a:{ts:20,oficial:1400.02}},'2026-10-01':{a:{ts:30,oficial:1500.03}},'2026-10-31':{a:{ts:40,oficial:1500.04}},'2026-11-01':{a:{ts:50,oficial:1600.05}},'2026-10-99':{a:{ts:60,oficial:9999.99}}};
test('la autenticación lexical real no requiere una propiedad isAuthenticated en window',async()=>{
 const f=fixture();assert.equal(f.c.isAuthenticated,undefined);assert.equal(f.window.isAuthenticated,undefined);const task=f.window.dolarHistoricoCargar();await flush();assert.equal(f.reads.length,1);f.deliver({});assert.equal(await task,true);
});
for(const [name,mutate] of [['API permiso ausente',f=>delete f.window.permisoModulo],['API permiso no función',f=>f.window.permisoModulo=true],['permiso false',f=>f.allow(false)],['auth false',f=>f.auth(false)],['auth undefined',f=>f.auth(undefined)],['auth truthy no boolean',f=>f.auth(1)],['UID ausente',f=>delete f.window.currentUserUid],['UID vacío',f=>f.window.currentUserUid=''],['Auth UID ausente',f=>delete f.window.fbAuth.currentUser.uid],['Auth UID vacío',f=>f.window.fbAuth.currentUser.uid=''],['UID distinto',f=>f.window.currentUserUid='user-b']])test(name+' no permite consultar ni reutilizar historial',async()=>{
 const f=fixture();mutate(f);assert.equal(await f.window.dolarHistoricoCargar(),false);assert.equal(f.reads.length,0);assert.equal(f.paints.length,0);assert.equal(f.nodes['dh-count'].textContent,'—');
});
test('apertura usa solamente orderByKey y límites inclusivos del mes, sin límite local arbitrario',async()=>{
 const f=fixture(),task=f.window.dolarHistoricoCargar();await flush();assert.equal(f.reads.length,1);
 const q=f.reads[0].ref;assert.equal(q.type,'query');assert.equal(q.ref.path,'sisventas/dolarHistorico');assert.deepEqual(JSON.parse(JSON.stringify(q.constraints)),[{kind:'key'},{kind:'start',value:'2026-10-01'},{kind:'end',value:'2026-10-31'}]);
 assert.match(f.nodes['dh-scope-note'].textContent,/01\/10\/2026.*31\/10\/2026/);assert.match(f.nodes['dh-scope-note'].textContent,/Todo el historial/);assert.equal(f.card.attrs['aria-busy'],'true');
 f.deliver(sample);assert.equal(await task,true);assert.deepEqual(Array.from(f.paints[0],r=>r.oficial),[1500.04,1500.03]);assert.equal(f.nodes['dh-count'].textContent,2);assert.equal(f.card.attrs['aria-busy'],'false');assert.equal(f.writes.length,0);
});
test('tres consumidores pendientes comparten una sola query y ACK siguiente es fresco',async()=>{
 const f=fixture(),tasks=[f.window.dolarHistoricoCargar(),f.window.dolarHistoricoCargar(),f.window.dolarHistoricoCargar()];await flush();assert.equal(f.reads.length,1);f.deliver(sample);assert.deepEqual(await Promise.all(tasks),[true,true,true]);
 const next=f.window.dolarHistoricoCargar();await flush();assert.equal(f.reads.length,2);f.deliver({});assert.equal(await next,true);
});
for(const absent of ['fbQuery','fbOrderByKey','fbStartAt','fbEndAt'])test('sin '+absent+' falla sin consulta raíz de respaldo',async()=>{
 const f=fixture();delete f.window[absent];assert.equal(await f.window.dolarHistoricoCargar(),false);assert.equal(f.reads.length,0);assert.equal(f.states.at(-1),'error');assert.equal(f.notices.length,1);
});
test('fallo query conserva error separado de vacío y sólo reintenta por acción',async()=>{
 const f=fixture(),task=f.window.dolarHistoricoCargar();await flush();f.reads[0].reject(Error('Permission denied'));assert.equal(await task,false);assert.equal(f.reads.length,1);assert.equal(f.paints.length,0);assert.equal(f.nodes['dh-count'].textContent,'—');assert.equal(f.states.at(-1),'error');assert.match(f.tbody.innerHTML,/No se pudo cargar/);
 const retry=f.window.dolarHistoricoCargar();await flush();assert.equal(f.reads.length,2);f.deliver({});assert.equal(await retry,true);assert.equal(f.nodes['dh-count'].textContent,0);assert.equal(f.states.at(-1),'loading');assert.equal(f.paints.length,1);
});
test('Todo conserva raíz, formatos antiguos, valores y orden por ts, incluso más de 300 puntos',async()=>{
 const f=fixture('all'),raw=structuredClone(sample);for(let i=0;i<350;i++)raw.old['x'+i]={ts:10,oficial:0.1+i/1000};
 const task=f.window.dolarHistoricoCargar();await flush();assert.equal(f.reads[0].ref.type,'ref');assert.match(f.nodes['dh-scope-note'].textContent,/Todo el historial/);f.deliver(raw);assert.equal(await task,true);
 const expected=[];Object.keys(raw).forEach(fecha=>Object.keys(raw[fecha]).forEach(hora=>expected.push(Object.assign({fecha,hora},raw[fecha][hora]))));expected.sort((a,b)=>(b.ts||0)-(a.ts||0));
 assert.deepEqual(JSON.parse(JSON.stringify(f.paints[0])),expected);assert.equal(f.paints[0].length,356);assert.equal(f.nodes['dh-count'].textContent,356);assert.equal(f.writes.length,0);
});
test('navegar el gráfico con Todo listo (también vacío) usa memoria autorizada sin nuevo GET',async()=>{
 for(const raw of [{},sample]){const f=fixture('all'),task=f.window.dolarHistoricoCargar();await flush();f.deliver(raw);await task;const before=f.paints.length;
  assert.equal(await f.chart('2026-09-24','year'),true);assert.equal(f.reads.length,1);assert.equal(f.paints.length,before+1);}
});
test('cambiar período sólo consulta rango nuevo y rechaza respuesta anterior antes de val',async()=>{
 const f=fixture(),old=f.window.dolarHistoricoCargar();await flush();const current=f.chart('2025-12-31','week');await flush();assert.equal(f.reads.length,2);
 assert.deepEqual(JSON.parse(JSON.stringify(f.reads[1].ref.constraints)),[{kind:'key'},{kind:'start',value:'2025-12-29'},{kind:'end',value:'2026-01-04'}]);
 const oldVals=f.deliver(sample,0);await old;assert.equal(oldVals(),0);assert.equal(f.paints.length,0);f.deliver({'2025-12-29':{a:{ts:1,oficial:1234.567}}},1);assert.equal(await current,true);assert.equal(f.paints[0][0].oficial,1234.567);
});
for(const [name,mutate] of [
 ['UID',f=>f.window.currentUserUid='user-b'],['Auth',f=>f.window.fbAuth.currentUser={uid:'user-a'}],['rol',f=>f.window.currentRole='otro'],['revisión',f=>f.window.PERMISOS_ROLES.admin.indiceRevision=2],
 ['vista',f=>f.window._impersonacionOriginal={}],['época',f=>f.window._svDataEpoch=2],['época de operación',f=>f.window._svOperacionesSesionEpoch=2],['hash',f=>f.window.location.hash='#/dashboard'],['página',f=>f.page.id='page-dashboard'],['permiso',f=>f.allow(false)],['autenticación',f=>f.auth(false)],
 ['selector',f=>f.nodes['dh-history-scope']={value:'period'}],['modelo',f=>f.window.SVDollarHistoryScope={...model}],['gráfico',f=>f.window.SisVentasDolarMensual={...f.window.SisVentasDolarMensual}],['modo',f=>f.nodes['dh-history-scope'].value='all'],
 ['base',f=>f.window.fbDB={}],['get',f=>f.window.fbGet=()=>{}],['ref',f=>f.window.fbRef=()=>{}],['query',f=>f.window.fbQuery=()=>{}],['order',f=>f.window.fbOrderByKey=()=>{}],['start',f=>f.window.fbStartAt=()=>{}],['end',f=>f.window.fbEndAt=()=>{}]
])test('cambio de '+name+' retira snapshot antes de val y limpia carga',async()=>{
 const f=fixture(),task=f.window.dolarHistoricoCargar();await flush();mutate(f);const vals=f.deliver(sample);assert.equal(await task,false);assert.equal(vals(),0);assert.equal(f.paints.length,0);assert.equal(f.notices.length,0);assert.equal(f.card.attrs['aria-busy'],'false');assert.equal(f.writes.length,0);
});
for(const [name,detail] of [['sisventas:session-ended',{}],['sisventas:role-changed',{}],['sisventas:page-changed',{page:'dashboard'}],['sisventas:configuration-tab-changed',{tab:'actividad'}],['sisventas:foreground-paused',{}]])test(name+' retira pendiente y no agrega consultas al regresar',async()=>{
 const f=fixture(),task=f.window.dolarHistoricoCargar();await flush();f.emit(name,detail);const vals=f.deliver(sample);assert.equal(await task,false);f.emit('sisventas:foreground-restored');f.runTimers();await flush();assert.equal(vals(),0);assert.equal(f.paints.length,0);assert.equal(f.reads.length,1);
});
test('sesión, Configuración y retorno visible no consultan sin abrir Dólar o acción explícita',async()=>{
 const f=fixture();f.emit('sisventas:session-ready');f.emit('sisventas:page-changed',{page:'configuracion'});f.emit('sisventas:configuration-tab-changed',{tab:'general'});f.runTimers();await flush();assert.equal(f.reads.length,0);
 f.visible(false);assert.equal(await f.window.dolarHistoricoCargar(),false);f.visible(true);await flush();assert.equal(f.reads.length,0);
 const task=f.window.dolarHistoricoCargar();await flush();assert.equal(f.reads.length,1);f.deliver({});await task;
});
test('ocultar una operación emitida la retira sin pintar ni reiniciar al volver',async()=>{
 const f=fixture(),task=f.window.dolarHistoricoCargar();await flush();f.visible(false);const vals=f.deliver(sample);assert.equal(await task,false);f.visible(true);await flush();assert.equal(vals(),0);assert.equal(f.reads.length,1);assert.equal(f.nodes['dh-count'].textContent,'—');
});
test('volver a General retira Dólar inmediatamente cuando su tarjeta ya está oculta',async()=>{
 const f=fixture(),task=f.window.dolarHistoricoCargar();await flush();f.card.getClientRects=()=>[];f.emit('sisventas:configuration-tab-changed',{tab:'general'});
 assert.equal(f.card.attrs['aria-busy'],'false');const vals=f.deliver(sample);assert.equal(await task,false);assert.equal(vals(),0);assert.equal(f.reads.length,1);
});
test('de período a Todo siempre hace la lectura completa, sin usar subconjunto como historial',async()=>{
 const f=fixture(),first=f.window.dolarHistoricoCargar();await flush();f.deliver(sample);await first;
 f.nodes['dh-history-scope'].value='all';const next=f.window.dolarHistoricoCargar();await flush();assert.equal(f.reads.length,2);assert.equal(f.reads[1].ref.type,'ref');f.deliver(sample);assert.equal(await next,true);assert.equal(f.paints.at(-1).length,6);
});
test('el ahorro de cuerpo es lógico ficticio y no elimina historia de Todo',async()=>{
 const raw={};for(let y=2010;y<2026;y++)for(let d=1;d<=28;d++)raw[y+'-01-'+String(d).padStart(2,'0')]={a:{ts:1,oficial:1000.123456}};
 raw['2026-10-24']={a:{ts:2,oficial:1540.123456}};const scoped=model.filter(raw,model.create('period','2026-10-24','month'));
 assert.ok(JSON.stringify(scoped).length<JSON.stringify(raw).length/100);assert.equal(model.filter(raw,model.create('all')),raw);
});
