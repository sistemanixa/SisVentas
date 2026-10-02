const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('recalcula pendientes al resolver el nombre del mismo usuario sin escribir lecturas',()=>{
 const listeners={},counts={};let tick,writes=0;
 const c={currentUserUid:'u1',currentUser:'Admin',_chatNoLeidos:counts,_chatCanal:'general',fbDB:{},
  fbRef:(_,path)=>path,fbOnValue:(path,fn)=>{listeners[path]=fn;return()=>{};},fbUpdate:()=>{writes++;},
  _chatFueLeido:(m,name)=>!!m.leido?.[name],chatActualizarBadges(){},chatAplicarAccesos(){},
  chatDetectarMensajesNuevos:()=>[],chatEstaLeyendo:()=>false,setInterval:fn=>{tick=fn;},document:{}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/chat-access.js','utf8'),c);
 tick();listeners.sv_chat_directorio({val:()=>({u1:{nombre:'Usuario real'},u2:{nombre:'Otro'}})});
 listeners['sv_chat/directo_u1_u2']({val:()=>({a:{autor:'Usuario real'},b:{autor:'Otro',leido:{'Usuario real':true}},c:{autor:'Otro'}})});
 assert.equal(counts.directo_u1_u2,3);
 c.currentUser='Usuario real';tick();assert.equal(counts.directo_u1_u2,1);
 assert.equal(writes,0,'no marca ni borra mensajes para ajustar el contador');
 tick();assert.equal(counts.directo_u1_u2,1);
});
