'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const app=require('./helpers/active-app').readActiveApp().source;
const source=app.slice(app.indexOf('function chatAbrirDirectos('),app.indexOf('function chatCerrarAdjuntos('));
function fixture(data,online=[]) {
 const area={innerHTML:''},calls={presence:0,writes:0,reads:0};
 const c={_chatCargaId:0,_chatListaVisible:[],_chatListener:null,currentUserUid:'self',currentUser:'Yo',
 document:{getElementById:id=>id==='chat-messages'?area:null},
 chatAudioCancelar(){},chatCancelReply(){},chatCerrarAdjuntos(){},chatEscucharEscribiendo(){},chatMarcarCanalActivo(){},
 chatPuedeAccederCanal:id=>id.startsWith('directo_self_'),chatNombreSesion:()=> 'Yo',_chatFueLeido:m=>!!m.leido,
 usuariosPresentesUnicos:()=>{calls.presence++;return online;},buscarPresenciaPorNombre:n=>online.find(p=>p.nombre===n),presenciaEstaActiva:p=>!!p,
 escapeHTML:value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
 fbDB:{},_chatDirectorio:{self:{nombre:'Yo'},a:{nombre:'Persona con chat'},b:{nombre:'Contacto conectado'},c:{nombre:'Contacto ausente'}},
 chatDirectoId:uid=>'directo_self_'+uid,chatDirectosSnapshot:()=>{calls.reads++;return Promise.resolve({val:()=>data});},
 fbPush(){calls.writes++;},fbUpdate(){calls.writes++;},fbRemove(){calls.writes++;}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);
 return {c,area,calls,async render(){c.chatAbrirDirectos();await new Promise(resolve=>setImmediate(resolve));return area.innerHTML;}};
}
test('online contacts without messages are not fabricated as conversations',async()=>{
 const f=fixture({directo_self_a:{m:{autor:'Persona con chat',texto:'Hola',ts:1}}},[{nombre:'Contacto conectado'}]);
 const html=await f.render();assert.match(html,/Persona con chat/);assert.doesNotMatch(html,/Contacto conectado|Nueva conversación/);
 assert.equal(f.calls.presence,0);assert.equal(f.calls.writes,0);assert.equal(f.calls.reads,1);
});
test('presence alone shows the genuine empty conversation state without writes',async()=>{
 const f=fixture({},[{nombre:'Contacto conectado'}]);assert.match(await f.render(),/No hay conversaciones directas aún/);assert.equal(f.calls.writes,0);
});
test('empty channels stay absent after deletion even while the contact remains online',async()=>{
 const data={directo_self_a:{m:{autor:'Persona con chat',texto:'Hola',ts:1}}},f=fixture(data,[{nombre:'Persona con chat'}]);
 assert.match(await f.render(),/Persona con chat/);data.directo_self_a={};
 assert.match(await f.render(),/No hay conversaciones directas aún/);assert.equal(f.calls.writes,0);
});
test('offline conversations with real photo or audio messages remain visible',async()=>{
 for(const attachment of [{fotoUrl:'fixture-image'},{audioUrl:'fixture-audio'}]){
  const f=fixture({directo_self_a:{m:{autor:'Persona con chat',ts:1,...attachment}}});assert.match(await f.render(),/Persona con chat/);assert.equal(f.calls.writes,0);
 }
});
test('channels without membership stay hidden and actual unread sorting is retained',async()=>{
 const f=fixture({directo_other_b:{m:{autor:'Contacto conectado',texto:'PRIVATE',ts:99}},directo_self_a:{m:{autor:'Persona con chat',texto:'Pendiente',ts:1}},directo_self_c:{m:{autor:'Contacto ausente',texto:'Leído',ts:2,leido:true}}});
 const html=await f.render();assert.doesNotMatch(html,/PRIVATE|Contacto conectado/);assert.ok(html.indexOf('Persona con chat')<html.indexOf('Contacto ausente'));assert.match(html,/>1<\/span>/);assert.equal(f.calls.writes,0);
});
