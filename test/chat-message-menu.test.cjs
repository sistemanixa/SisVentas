const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function setup(message){
 const nodes={},events={};let modified;
 function element(){return {style:{},children:[],offsetWidth:150,offsetHeight:90,setAttribute(k,v){this[k]=v;},appendChild(n){this.children.push(n);},remove(){delete nodes[this.id];},querySelector(){return this.children.find(n=>!n.disabled);},focus(){this.focused=true;}};}
 const btn=element();btn.dataset={key:'message'};btn.getAttribute=k=>btn[k];btn.getBoundingClientRect=()=>({right:400,top:200,bottom:225});btn.closest=()=>({querySelector:()=>({dataset:{fk:'message'}})});
 const document={getElementById:id=>nodes[id],querySelectorAll:()=>[],querySelector:()=>btn,createElement:element,body:{appendChild:n=>{nodes[n.id]=n;}},addEventListener:(k,f)=>events[k]=f};
 const c=load({document,window:{innerWidth:800,innerHeight:600,addEventListener(){}},_chatListaVisible:[{fbKey:'message',...message}],currentUser:'owner',_chatUsuarioKey:x=>x,chatModificarMensaje:(...a)=>modified=a},['chatCerrarMenuMensaje','chatMensajeEditable','chatMensajeModificable','chatAbrirMenuMensaje']);
 return {c,btn,nodes,events,get modified(){return modified;}};
}
test('menú empieza con Responder, seguido de Editar y Eliminar',()=>{
 const s=setup({autor:'owner',texto:'Hola'});s.c.chatAbrirMenuMensaje(s.btn);
 const m=s.nodes['chat-menu-mensaje'];assert.deepEqual(m.children.map(n=>n.textContent),['Responder','Editar','Eliminar']);assert.ok(m.children.every(n=>!n.disabled));
 m.children[1].onclick();assert.deepEqual(s.modified,['message','editar']);assert.equal(s.nodes['chat-menu-mensaje'],undefined);
});
test('Responder del menú usa el mismo mensaje que el acceso existente',()=>{
 const s=setup({autor:'other',texto:'Hola'});let reply;s.c.chatSetReply=btn=>{reply=btn.dataset.fk;};
 s.c.chatAbrirMenuMensaje(s.btn);s.nodes['chat-menu-mensaje'].children[0].onclick();assert.equal(reply,'message');assert.equal(s.nodes['chat-menu-mensaje'],undefined);
});
test('mensaje propio leído permite editar, pero no eliminar; mensaje ajeno bloquea ambas acciones',()=>{
 const propio=setup({autor:'owner',texto:'Hola',leido:{other:true}});propio.c.chatAbrirMenuMensaje(propio.btn);
 assert.equal(propio.nodes['chat-menu-mensaje'].children[1].disabled,false);assert.equal(propio.nodes['chat-menu-mensaje'].children[2].disabled,true);
 for(const message of [{autor:'other',texto:'Hola'}]){
  const s=setup(message);s.c.chatAbrirMenuMensaje(s.btn);assert.ok(s.nodes['chat-menu-mensaje'].children.slice(1).every(n=>n.disabled));assert.equal(s.modified,undefined);
 }
});
test('adjunto sin texto permite eliminar y no editar; Escape cierra y devuelve foco',()=>{
 const s=setup({autor:'owner',fotoUrl:'foto'});s.c.chatAbrirMenuMensaje(s.btn);const m=s.nodes['chat-menu-mensaje'];assert.equal(m.children[1].disabled,true);assert.equal(m.children[2].disabled,false);
 s.events.keydown({key:'Escape'});assert.equal(s.nodes['chat-menu-mensaje'],undefined);assert.equal(s.btn.focused,true);
});
test('reacciones reemplazan solo la propia y repetir el emoji la quita',async()=>{
 let stored={texto:'Hola',reacciones:{otro:{emoji:'❤️',nombre:'Otro'}}};
 const c=load({_chatCanal:'general',currentUser:'Yo',chatPuedeAccederCanal:()=>true,notify:()=>assert.fail('falló'),window:{fbAuth:{currentUser:{uid:'yo'}},fbDB:{},fbRef:(_,path)=>path,fbRunTransaction:async(_,fn)=>{const next=fn(stored);if(next)stored=next;}}},['chatReaccionarMensaje']);
 await c.chatReaccionarMensaje('m','👍');assert.equal(stored.reacciones.yo.emoji,'👍');
 await c.chatReaccionarMensaje('m','😂');assert.equal(stored.reacciones.yo.emoji,'😂');assert.equal(stored.reacciones.otro.emoji,'❤️');
 await c.chatReaccionarMensaje('m','😂');assert.equal(stored.reacciones.yo,undefined);
 stored={eliminado:true};await c.chatReaccionarMensaje('m','👍');assert.equal(stored.reacciones,undefined);
});
test('carita abre solo las seis reacciones, separadas de editar y eliminar',()=>{
 const s=setup({autor:'owner',texto:'Hola'});s.c.chatAbrirMenuMensaje(s.btn,true);
 const m=s.nodes['chat-menu-mensaje'];assert.equal(m.children.length,1);assert.equal(m.children[0].children.length,6);
});
test('editar propio leído conserva lecturas y reacciones; bloquea mensaje ajeno',async()=>{
 let stored={autor:'Yo',texto:'Antes',leido:{otro:true},reacciones:{otro:{emoji:'👍'}}};
 const c=load({currentUser:'Yo',_chatCanal:'general',_chatListaVisible:[{fbKey:'m',...stored}],chatPuedeAccederCanal:()=>true,_chatUsuarioKey:x=>x,svPrompt:async()=> 'Después',notify:()=>{},window:{fbDB:{},fbRef:()=>'',fbRunTransaction:async(_,fn)=>{const next=fn(stored);if(next)stored=next;return {committed:!!next};}}},['chatMensajeEditable','chatMensajeModificable','chatModificarMensaje']);
 await c.chatModificarMensaje('m','editar');assert.equal(stored.texto,'Después');assert.equal(stored.leido.otro,true);assert.equal(stored.reacciones.otro.emoji,'👍');
 c._chatListaVisible=[{fbKey:'m',autor:'Otro',texto:'Ajeno'}];await c.chatModificarMensaje('m','editar');assert.equal(stored.texto,'Después');
});
