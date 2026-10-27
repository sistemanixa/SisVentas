'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/chat-presence.v2.js','utf8');
function fixture(options={}){
 let now=1000000;const events=new EventTarget(),listeners=[],writes=[],removes=[],registrations=[],timers=[];
 const label={textContent:''},legacy=options.legacy||[];
 const root={currentUserUid:'self',currentUser:'Ana',currentUserEmail:'ana@example.test',currentRole:'admin',fbAuth:{currentUser:{uid:'self'}},fbDB:{},
  _chatDirectorio:options.directory||{self:{nombre:'Ana',activo:true},peer:{nombre:'Bruno',activo:true}},
  fbRef:(_,path)=>path,fbServerTimestamp:()=>now,obtenerIdSesionPresencia:()=> 'tab',
  fbSet:(path,value)=>{writes.push({path,value});return Promise.resolve();},fbRemove:path=>{removes.push(path);return Promise.resolve();},
  fbOnValue:(path,callback,error)=>{const item={path,callback,error,active:true};listeners.push(item);return()=>{item.active=false;};},
  fbOnDisconnect:path=>{const item={path,cancels:0};registrations.push(item);return{remove:()=>new Promise((resolve,reject)=>{item.resolve=resolve;item.reject=reject;}),cancel:()=>{item.cancels++;return Promise.resolve();}};},
  usuariosPresentesUnicos:include=>legacy.filter(p=>include||p.uid!=='self'),
  normalizarIdentidadPresencia:value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase(),
  presenciaEstaActiva:p=>p?.online===true&&(p.conexionPorEventos===true||now-Number(p.ultimaConexion)<90000)};
 const document={addEventListener:(...args)=>events.addEventListener(...args),removeEventListener:(...args)=>events.removeEventListener(...args),dispatchEvent:event=>events.dispatchEvent(event),getElementById:id=>id==='chat-online-label'?label:null};
 class FakeDate extends Date{static now(){return now;}}
 class CustomEvent extends Event{constructor(name,options){super(name);this.detail=options?.detail;}}
 Object.assign(root,{window:root,document,CustomEvent,Date:FakeDate,setInterval:()=>{timers.push('interval');return 1;},clearInterval:()=>{},setTimeout:()=>{timers.push('timeout');return 1;},clearTimeout:()=>{}});
 vm.createContext(root);vm.runInContext(source,root);
 const emit=(path,value,includeStopped=false)=>{listeners.filter(l=>l.path===path&&(l.active||includeStopped)).forEach(l=>l.callback({val:()=>value}));};
 const dispatch=(name,detail)=>{const event=new Event(name);event.detail=detail;events.dispatchEvent(event);};
 const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
 const connect=async()=>{emit('.info/connected',true);const registration=registrations.at(-1);registration.resolve();await flush();return registration;};
 return{root,label,events,listeners,writes,removes,registrations,timers,emit,dispatch,flush,connect,advance:ms=>{now+=ms;},now:()=>now};
}
const row=(f,uid='peer',name='Bruno')=>({uid,nombre:name,rol:'admin',online:true,ultimaConexion:f.now()});

test('active index loads the foreground presence protocol and new-message selector',()=>{const index=fs.readFileSync('index.html','utf8');assert.match(index,/chat-presence\.v2\.js/);assert.match(index,/chat-direct-contacts\.v1\.js/);assert.doesNotMatch(index,/src="[^\"]*chat-presence\.js/);});
test('legacy and orphan connections cannot be presented as currently online',async()=>{const f=fixture({legacy:[{uid:'peer',nombre:'Bruno',online:true,ultimaConexion:1000000}]});f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx1_old:row(f),session_old:row(f)}});assert.equal(f.root.usuariosPresentesUnicos(false).length,0);f.emit('sv_chat_presencia',{peer:{cx1_old:row(f),cx2_current:row(f)}});assert.equal(f.root.usuariosPresentesUnicos(false).length,1);assert.match(f.writes[0].path,/\/cx2_/);});
test('hidden or locked screen removes own availability and starts no timers',async()=>{const f=fixture();f.root.SVChatPresence.start();await f.connect();const own=f.writes[0].path;f.emit('sv_chat_presencia',{peer:{cx2_other:row(f)}});f.root.document.hidden=true;f.root.document.visibilityState='hidden';f.dispatch('visibilitychange');await f.flush();assert.ok(f.removes.includes(own));assert.equal(f.listeners.filter(x=>x.active).length,0);assert.equal(f.root.usuariosPresentesUnicos(false).length,0);f.root.document.hidden=false;f.root.document.visibilityState='visible';f.dispatch('visibilitychange');await f.connect();assert.notEqual(f.writes[1].path,own);assert.deepEqual(f.timers,[]);});
test('loss of local connection clears cached peers and marks presence unconfirmed',async()=>{const f=fixture();f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx2_other:row(f)}});assert.equal(f.label.textContent,'1 persona conectada');f.emit('.info/connected',false);assert.equal(f.root.usuariosPresentesUnicos(false).length,0);assert.equal(f.root.SVChatPresence.status().ready,false);assert.match(f.label.textContent,/sin confirmar/);});
test('callbacks from an older connection cannot revive stale online users after reconnecting',async()=>{const f=fixture();f.root.SVChatPresence.start();await f.connect();const old=f.listeners.find(x=>x.path==='sv_chat_presencia');f.emit('.info/connected',false);await f.connect();f.emit('sv_chat_presencia',{});old.callback({val:()=>({peer:{cx2_old:row(f)}})});assert.equal(f.root.usuariosPresentesUnicos(false).length,0);assert.equal(f.listeners.filter(x=>x.active&&x.path==='sv_chat_presencia').length,1);});
test('a foreground connection remains visible without heartbeat traffic',async()=>{const f=fixture();f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx2_other:row(f)}});const reads=f.listeners.length;f.advance(600000);for(let i=0;i<20;i++){f.dispatch('pointerdown');f.dispatch('keydown');}assert.equal(f.root.usuariosPresentesUnicos(false).length,1);assert.equal(f.writes.length,1);assert.equal(f.listeners.length,reads);assert.deepEqual(f.timers,[]);});
test('inactive directory users and own multiple tabs are not counted as other people',async()=>{const f=fixture();f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx2_a:row(f),cx2_b:row(f)},self:{cx2_self:row(f,'self','Ana')}});assert.equal(f.root.usuariosPresentesUnicos(false).length,1);f.root._chatDirectorio.peer.activo=false;f.dispatch('sisventas:chat-directory-ready',{uid:'self'});assert.equal(f.root.usuariosPresentesUnicos(false).length,0);});
test('publication still waits for onDisconnect acknowledgement and ignores old-session callbacks',async()=>{const f=fixture();f.root.SVChatPresence.start();f.emit('.info/connected',true);const old=f.registrations[0];assert.equal(f.writes.length,0);f.root.SVChatPresence.stop();old.resolve();await f.flush();assert.equal(f.writes.length,0);assert.equal(f.root.usuariosPresentesUnicos(false).length,0);});
