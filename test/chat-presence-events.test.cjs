'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/chat-presence.js','utf8');
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
test('conexión sin actividad sigue visible después de 90 segundos y no produce tráfico por reloj o actividad',async()=>{
 const f=fixture();f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx1_other:row(f)}});f.advance(600000);
 assert.equal(f.root.usuariosPresentesUnicos(false).length,1);assert.equal(f.root.presenciaEstaActiva(f.root.usuariosPresentesUnicos(false)[0]),true);
 for(let i=0;i<10;i++){f.dispatch('pointerdown');f.dispatch('keydown');f.advance(31000);}
 assert.equal(f.writes.length,1);assert.deepEqual(f.timers,[]);
});
test('publica después de armar onDisconnect y lo rearma al reconectar',async()=>{
 const f=fixture();f.root.SVChatPresence.start();f.emit('.info/connected',true);assert.equal(f.writes.length,0);
 f.registrations[0].resolve();await f.flush();assert.equal(f.writes.length,1);f.emit('.info/connected',false);await f.connect();
 assert.equal(f.writes.length,2);assert.equal(f.registrations.length,2);assert.notEqual(f.writes[0].path,f.writes[1].path);
 assert.deepEqual(Object.keys(f.writes[0].value).sort(),['nombre','online','rol','uid','ultimaConexion']);
 assert.match(f.writes[0].path,/\/cx1_/);
});
test('fallo de onDisconnect no publica ni inicia reintentos automáticos',async()=>{
 const f=fixture();f.root.SVChatPresence.start();f.emit('.info/connected',true);f.registrations[0].reject(Error('denied'));await f.flush();
 f.advance(300000);f.dispatch('pointerdown');assert.equal(f.writes.length,0);assert.equal(f.registrations.length,1);assert.deepEqual(f.timers,[]);
});
test('una finalización antigua del mismo UID no borra ni publica la sesión nueva',async()=>{
 const f=fixture();f.root.SVChatPresence.start();f.emit('.info/connected',true);const old=f.registrations[0];f.root.SVChatPresence.stop();
 f.root.SVChatPresence.start();await f.connect();const next=f.writes[0].path;old.resolve();await f.flush();
 assert.equal(f.writes.length,1);assert.notEqual(old.path,next);assert.ok(!f.removes.includes(next));assert.equal(old.cancels,1);
});
test('cambio de autenticación con mismo UID invalida escrituras y callbacks anteriores',async()=>{
 const f=fixture();f.root.SVChatPresence.start();f.emit('.info/connected',true);const old=f.registrations[0];f.root.fbAuth.currentUser={uid:'self'};old.resolve();await f.flush();
 f.emit('sv_chat_presencia',{peer:{cx1_other:row(f)}},true);assert.equal(f.writes.length,0);assert.equal(f.root.usuariosPresentesUnicos(false).length,0);
 f.root.SVChatPresence.start();await f.connect();assert.equal(f.writes.length,1);
});
test('sesión propia se excluye y las fuentes de la misma persona no duplican personas',async()=>{
 const f=fixture({legacy:[{uid:'peer',email:'bruno@example.test',nombre:'Bruno',rol:'admin',online:true,ultimaConexion:1000000},{email:'ana@example.test',nombre:'Ana',online:true,ultimaConexion:1000000}]});
 f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx1_a:row(f),cx1_b:row(f)},self:{a:row(f,'self','Ana')}});
 assert.equal(f.root.usuariosPresentesUnicos(false).length,1);assert.equal(f.root.usuariosPresentesUnicos(true).length,2);
});
test('retirar una sesión conserva otra pestaña de la misma persona y retirar ambas la desconecta',async()=>{
 const f=fixture();f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx1_a:row(f),cx1_b:row(f)}});assert.equal(f.root.usuariosPresentesUnicos(false).length,1);
 f.emit('sv_chat_presencia',{peer:{cx1_b:row(f)}});assert.equal(f.root.usuariosPresentesUnicos(false).length,1);f.emit('sv_chat_presencia',{});assert.equal(f.root.usuariosPresentesUnicos(false).length,0);
});
test('el directorio invalida cuentas inactivas sin esperar otro evento de presencia',async()=>{
 const f=fixture();f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx1_a:row(f)}});assert.equal(f.label.textContent,'1 persona conectada');
 f.root._chatDirectorio.peer.activo=false;f.dispatch('sisventas:chat-directory-ready',{uid:'self'});assert.equal(f.label.textContent,'Nadie más conectado');
 assert.equal(f.root.usuariosPresentesUnicos(false).length,0);f.root._chatDirectorio.self.activo=false;f.dispatch('sisventas:chat-directory-ready',{uid:'self'});
 assert.ok(f.removes.includes(f.writes[0].path));assert.equal(f.listeners.filter(l=>l.active).length,0);
});
test('perder rol o permiso y Ver como no dejan publicar identidad simulada',async()=>{
 const f=fixture();f.root.SVChatPresence.start();f.emit('.info/connected',true);f.root._impersonacionOriginal={uid:'self'};f.registrations[0].resolve();await f.flush();assert.equal(f.writes.length,0);
 f.dispatch('sisventas:chat-access-changed',{uid:'self',activo:false,rol:'admin'});assert.equal(f.root.usuariosPresentesUnicos(true).length,0);
});
test('registros legados viejos no se vuelven permanentes por tener sesionId',async()=>{
 const f=fixture({legacy:[{nombre:'Viejo',online:true,sesionId:'legacy',ultimaConexion:1}]});f.root.SVChatPresence.start();await f.connect();
 assert.equal(f.root.usuariosPresentesUnicos(false).length,0);f.emit('sv_chat_presencia',{fake:{a:{uid:'peer',nombre:'Bruno',online:true,ultimaConexion:f.now()}}});
 assert.equal(f.root.usuariosPresentesUnicos(false).length,0);
});
test('ACK posterior a desconexión no publica y no interfiere con la conexión siguiente',async()=>{
 const f=fixture();f.root.SVChatPresence.start();f.emit('.info/connected',true);const old=f.registrations[0];f.emit('.info/connected',false);
 await f.connect();old.resolve();await f.flush();assert.equal(f.writes.length,1);assert.notEqual(f.writes[0].path,old.path);assert.ok(!f.removes.includes(f.writes[0].path));
});
test('un fallo de publicación se limpia sin latidos ni reintentos por actividad',async()=>{
 const f=fixture();f.root.fbSet=(path,value)=>{f.writes.push({path,value});return Promise.reject(Error('denied'));};f.root.SVChatPresence.start();await f.connect();await f.flush();
 assert.deepEqual(f.removes,[f.writes[0].path]);assert.equal(f.registrations[0].cancels,1);for(let i=0;i<5;i++){f.advance(60000);f.dispatch('pointerdown');}
 assert.equal(f.writes.length,1);assert.equal(f.registrations.length,1);
});
test('Ver como pausa presencia y regresar al actor original abre una conexión propia nueva',async()=>{
 const f=fixture();f.root.SVChatPresence.start();await f.connect();const old=f.writes[0].path;
 f.root._impersonacionOriginal={uid:'self'};f.root.currentRole='tecnico';f.root.currentUser='Vista simulada';f.dispatch('sisventas:role-changed');await f.flush();
 assert.deepEqual(f.removes,[old]);assert.equal(f.listeners.filter(l=>l.active).length,0);
 f.root._impersonacionOriginal=null;f.root.currentRole='admin';f.root.currentUser='Ana';f.dispatch('sisventas:role-changed');await f.connect();
 assert.equal(f.writes.length,2);assert.equal(f.writes[1].value.nombre,'Ana');assert.notEqual(f.writes[1].path,old);
});
test('las señales existentes de chat actualizan directorio y rol sin una escucha extra de presencia',async()=>{
 const f=fixture();Object.assign(f.root,{_chatNoLeidos:{},_chatCanal:'general',chatActualizarBadges(){},chatAplicarAccesos(){},chatPuedeAccederCanal:()=>false});
 vm.runInContext(fs.readFileSync('js/core/chat-read-model.js','utf8'),f.root);vm.runInContext(fs.readFileSync('js/modules/chat-access.js','utf8'),f.root);f.dispatch('sisventas:session-ready',{uid:'self'});await f.connect();
 f.emit('sv_chat_roles/self',{activo:true,rol:'admin'});f.emit('sv_chat_directorio',{self:{nombre:'Ana',activo:true},peer:{nombre:'Bruno',activo:true}});
 f.emit('sv_chat_presencia',{peer:{cx1_other:row(f)}});assert.equal(f.label.textContent,'1 persona conectada');const reads=f.listeners.length;
 f.emit('sv_chat_directorio',{self:{nombre:'Ana',activo:true},peer:{nombre:'Bruno',activo:false}});assert.equal(f.label.textContent,'Nadie más conectado');assert.equal(f.listeners.length,reads);
 f.emit('sv_chat_roles/self',{activo:false,rol:'admin'});assert.equal(f.root.usuariosPresentesUnicos(true).length,0);assert.ok(f.removes.includes(f.writes[0].path));
});
test('sólo una fila derivada del snapshot vigente acredita conexión, incluso si el legado guarda un booleano',async()=>{
 const f=fixture();f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx1_a:row(f)}});
 const derived=f.root.SVChatPresence.sesionesActivas()[0];assert.equal(f.root.SVChatPresence.esConexionVigente(derived),true);
 assert.equal(f.root.SVChatPresence.esConexionVigente({...derived}),false);assert.equal(f.root.SVChatPresence.esConexionVigente({...row(f),conexionPorEventos:true}),false);
 f.emit('sv_chat_presencia',{});assert.equal(f.root.SVChatPresence.esConexionVigente(derived),false);
});
test('deshabilitar la interfaz del chat no corta la conexión global autorizada de un usuario normal',async()=>{
 const f=fixture();f.root.SVChatPresence.start();await f.connect();f.dispatch('sisventas:chat-disabled');
 assert.equal(f.listeners.filter(l=>l.active).length,2);assert.equal(f.removes.length,0);assert.equal(f.writes.length,1);
});
test('Distribuidora pierde el canal de presencia al retirar el permiso chat que exigen sus reglas',async()=>{
 const f=fixture();let enabled=true;f.root.currentRole='distribuidora';f.root.SVDistribuidora={allowed:()=>enabled};f.root.SVChatPresence.start();await f.connect();
 enabled=false;f.dispatch('sisventas:chat-disabled');await f.flush();assert.equal(f.listeners.filter(l=>l.active).length,0);assert.deepEqual(f.removes,[f.writes[0].path]);
});
test('el snapshot moderno sólo redibuja Usuarios cuando está visible y cambia su contenido',async()=>{
 const f=fixture();let visible=false,draws=0;const prior=f.root.document.getElementById;
 f.root.document.getElementById=id=>id==='page-usuarios'?{classList:{contains:()=>visible}}:prior(id);f.root.renderTablaUsuarios=()=>draws++;
 f.root.SVChatPresence.start();await f.connect();const rows={peer:{cx1_a:row(f)}};f.emit('sv_chat_presencia',rows);assert.equal(draws,0);
 visible=true;f.emit('sv_chat_presencia',rows);assert.equal(draws,0);f.emit('sv_chat_presencia',{});assert.equal(draws,1);f.emit('sv_chat_presencia',{});assert.equal(draws,1);
});
test('cambiar el nombre en directorio actualiza la presentación y la próxima conexión sin escrituras incidentales',async()=>{
 const f=fixture();f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx1_a:row(f)}});
 f.root._chatDirectorio.peer.nombre='Bruno actual';f.root._chatDirectorio.self.nombre='Ana actual';f.dispatch('sisventas:chat-directory-ready',{uid:'self'});
 assert.equal(f.root.usuariosPresentesUnicos(false)[0].nombre,'Bruno actual');assert.equal(f.writes.length,1);
 f.emit('.info/connected',false);await f.connect();assert.equal(f.writes[1].value.nombre,'Ana actual');
});
test('app activa combina Usuarios con conexión moderna, mantiene TTL legado y no confía una marca persistida',async()=>{
 const f=fixture(),app=require('./helpers/active-app').readActiveApp().source;
 Object.assign(f.root,{PRESENCIA_DATA:{old:{uid:'peer',email:'bruno@example.test',online:true,inicioSesion:100,ultimaConexion:100,conexionPorEventos:true}},PRESENCIA_VIGENCIA_MS:90000,usuariosData:[{uid:'peer',nombre:'Bruno',mail:'bruno@example.test',activo:true}]});
 for(const name of ['presenciaEstaActiva','resumenSesionUsuario','estaUsuarioOnline']){const begin=app.indexOf('function '+name+'('),end=app.indexOf('\nfunction ',begin+10);assert.notEqual(begin,-1);vm.runInContext(app.slice(begin,end<0?app.length:end),f.root);}
 f.root.SVChatPresence.start();await f.connect();f.emit('sv_chat_presencia',{peer:{cx1_a:row(f)}});f.advance(600000);
 assert.equal(f.root.presenciaEstaActiva(f.root.PRESENCIA_DATA.old),false);assert.equal(f.root.estaUsuarioOnline('bruno@example.test'),true);
 const summary=f.root.resumenSesionUsuario(f.root.usuariosData[0],f.now());assert.equal(summary.activa,true);assert.equal(summary.duracion,600000);assert.equal(summary.fin,0);
 f.emit('sv_chat_presencia',{});assert.equal(f.root.estaUsuarioOnline('bruno@example.test'),false);assert.equal(f.root.resumenSesionUsuario(f.root.usuariosData[0],f.now()).activa,false);
});
test('key vieja huérfana vence aunque el directorio siga activo; sólo cx1 acredita el nuevo protocolo',async()=>{
 const f=fixture();f.root.SVChatPresence.start();await f.connect();const old=row(f);f.emit('sv_chat_presencia',{peer:{session_legacy:old}});
 assert.equal(f.root.usuariosPresentesUnicos(false).length,1);assert.equal(f.root.SVChatPresence.esConexionVigente(f.root.SVChatPresence.sesionesActivas()[0]),false);
 f.advance(180000);assert.equal(f.root._chatDirectorio.peer.activo,true);assert.equal(f.root.usuariosPresentesUnicos(false).length,0);assert.equal(f.root.SVChatPresence.sesionesActivas().length,0);
 f.emit('sv_chat_presencia',{peer:{session_legacy:old,cx1_new:old}});assert.equal(f.root.usuariosPresentesUnicos(false).length,1);assert.equal(f.root.SVChatPresence.esConexionVigente(f.root.SVChatPresence.sesionesActivas()[0]),true);
 assert.equal(f.writes.length,1);assert.equal(f.removes.length,0,'No migra ni borra registros históricos');
});
