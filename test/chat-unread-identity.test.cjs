const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('usa la identidad del UID desde el directorio aunque el nombre visible sea provisional',()=>{
 const listeners={},counts={},events={};let tick,writes=0;
 const c={currentUserUid:'u1',currentUser:'Admin',_chatNoLeidos:counts,_chatCanal:'general',fbDB:{},
  fbRef:(_,path)=>path,fbOnValue:(path,fn)=>{listeners[path]=fn;return()=>{};},fbUpdate:()=>{writes++;},
  _chatFueLeido:(m,name)=>!!m.leido?.[name],chatActualizarBadges(){},chatAplicarAccesos(){},
  chatDetectarMensajesNuevos:()=>[],chatEstaLeyendo:()=>false,setInterval:fn=>{tick=fn;},document:{addEventListener:(name,fn)=>{events[name]=fn;}}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/chat-access.js','utf8'),c);
 tick=()=>c.chatIniciarDirectosSeguros();
 events['sisventas:session-ready']({detail:{uid:'u1'}});tick();listeners.sv_chat_directorio({val:()=>({u1:{nombre:'Usuario real'},u2:{nombre:'Otro'}})});
 listeners['sv_chat/directo_u1_u2']({val:()=>({a:{autor:'Usuario real'},b:{autor:'Otro',leido:{'Usuario real':true}},c:{autor:'Otro'}})});
 assert.equal(counts.directo_u1_u2,1);
 c._impersonacionOriginal={user:'Usuario real'};c.currentUser='Otro usuario';tick();assert.equal(counts.directo_u1_u2,1);
 delete c._impersonacionOriginal;c.currentUser='Usuario real';tick();assert.equal(counts.directo_u1_u2,1);
 assert.equal(writes,0,'no marca ni borra mensajes para ajustar el contador');
 tick();assert.equal(counts.directo_u1_u2,1);
});
test('al recargar no cuenta antes de resolver la sesión y conserva los pendientes reales',()=>{
 const listeners={},events={},counts={},painted=[];let tick,stopped=0;
 const c={currentUserUid:'u1',currentUser:'',_chatNoLeidos:counts,_chatCanal:'general',fbDB:{},
  fbRef:(_,path)=>path,fbOnValue:(path,fn)=>{listeners[path]=fn;return()=>{stopped++;};},
  _chatFueLeido:(m,name)=>!!m.leido?.[name],chatActualizarBadges(){painted.push(Object.values(counts).reduce((a,b)=>a+b,0));},chatAplicarAccesos(){},
  chatDetectarMensajesNuevos:()=>[],chatEstaLeyendo:()=>false,setInterval:fn=>{tick=fn;},
  document:{addEventListener:(name,fn)=>{events[name]=fn;}}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/chat-access.js','utf8'),c);
 tick=()=>c.chatIniciarDirectosSeguros();
 tick();tick();assert.equal(Object.keys(listeners).length,0,'el UID solo no alcanza');
 c.currentUser='Usuario real';tick();assert.equal(Object.keys(listeners).length,0);
 events['sisventas:session-ready']({detail:{uid:'u1'}});
 listeners.sv_chat_directorio({val:()=>({u1:{nombre:'Usuario real'},u2:{nombre:'Otro'}})});
 const receive=listeners['sv_chat/directo_u1_u2'];
 receive({val:()=>({a:{autor:'Usuario real'},b:{autor:'Otro',leido:{'Usuario real':true}}})});
 assert.deepEqual(painted,[0],'nunca muestra los dos mensajes como pendientes');
 receive({val:()=>({c:{autor:'Otro'}})});assert.equal(counts.directo_u1_u2,1);
 events['sisventas:session-ended']();assert.equal(stopped,3);assert.equal(Object.keys(counts).length,0);
 receive({val:()=>({c:{autor:'Otro'}})});assert.equal(Object.keys(counts).length,0,'ignora callbacks de una sesión cerrada');
});

test('grupos esperan identidad, no duplican listeners y descartan callbacks de sesiones anteriores',async()=>{
 const listeners=new Map(),events={},counts={};let active=0;
 const c={currentUserUid:'u1',currentUser:'Temporal',_chatNoLeidos:counts,_chatCanal:'general',fbDB:{},
 fbRef:(_,p)=>p,fbOnValue:(p,fn)=>{listeners.set(p,fn);active++;return()=>active--;},
 _chatFueLeido:(m,n)=>!!m.leido?.[n],chatActualizarBadges(){},chatAplicarAccesos(){},
 chatPuedeAccederCanal:()=>true,chatDetectarMensajesNuevos:()=>[],chatEstaLeyendo:()=>false,
 setInterval(){},document:{addEventListener:(n,fn)=>events[n]=fn}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/chat-access.js','utf8'),c);
 const start=()=>events['sisventas:session-ready']({detail:{uid:'u1'}});
 start();listeners.get('sv_chat_roles/u1')({val:()=>({rol:'admin',activo:true})});
 assert.equal(listeners.has('sv_chat/general'),false);
 listeners.get('sv_chat_directorio')({val:()=>({u1:{nombre:'Real'}})});
 const old= listeners.get('sv_chat/general');old({val:()=>({a:{autor:'Real'},b:{autor:'Otro',leido:{Real:true}}})});
 assert.equal(counts.general,0);
 c.chatIniciarDirectosSeguros();assert.equal(active,5);
 old({val:()=>({a:{autor:'Otro'}})});assert.equal(counts.general,1);
 assert.deepEqual(Object.keys((await c.chatDirectosSnapshot()).val()),[],'los grupos no aparecen como conversaciones directas');
 events['sisventas:session-ended']();assert.equal(active,0);assert.deepEqual(counts,{});
 start();old({val:()=>({a:{autor:'Otro'}})});assert.deepEqual(counts,{},'mismo UID, otra sesión: callback viejo ignorado');
});

test('chat sin sondeo periódico: los eventos de sesión crean y cancelan conexiones',()=>{
 const events={};let subscriptions=0,stops=0;
 const c={currentUserUid:'u1',currentUser:'Real',_chatNoLeidos:{},fbDB:{},fbRef:(_,p)=>p,fbOnValue:()=>{subscriptions++;return()=>stops++;},chatActualizarBadges(){},setInterval(){throw Error('No debe iniciar polling');},document:{addEventListener:(n,f)=>events[n]=f}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/chat-access.js','utf8'),c);assert.equal(subscriptions,0);
 events['sisventas:chat-ready']({detail:{uid:'u1'}});assert.equal(subscriptions,2);events['sisventas:chat-ready']({detail:{uid:'u1'}});assert.equal(subscriptions,2);events['sisventas:session-ended']();assert.equal(stops,2);
});
