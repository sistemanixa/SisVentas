const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = require('./helpers/active-app').readActiveApp().source;

for (const falla of [false,true]) {
  test('Directos no pisa otra conversación al terminar tarde: '+(falla?'error':'éxito'), async () => {
    let resolve, reject;
    const messages = {innerHTML:''};
    const context = {_chatCargaId:0,_chatListaVisible:[],_chatListener:null,
      document:{getElementById:id=>id==='chat-messages'?messages:null},
      chatAudioCancelar(){},chatCancelReply(){},chatCerrarAdjuntos(){},chatEscucharEscribiendo(){},chatMarcarCanalActivo(){},
      window:{fbDB:{},fbRef(){},fbGet:()=>new Promise((ok,no)=>{resolve=ok;reject=no;})}};
    vm.createContext(context);
    vm.runInContext(app.slice(app.indexOf('function chatAbrirDirectos('),app.indexOf('function chatCerrarAdjuntos(')),context);
    context.chatAbrirDirectos();
    context._chatCargaId++;
    messages.innerHTML='Mensajes del canal nuevo';
    if (falla) reject(new Error('offline')); else resolve({val:()=>({})});
    await new Promise(ok=>setImmediate(ok));
    assert.equal(messages.innerHTML,'Mensajes del canal nuevo');
  });
}

test('buscar sin coincidencias conserva la lista original', () => {
  const messages = {scrollTop:0,scrollHeight:200,clientHeight:100,innerHTML:''};
  const search = {value:'inexistente'};
  const context = {_chatPrimeraCarga:true,_chatListaVisible:[],document:{getElementById:id=>id==='chat-messages'?messages:search}};
  vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf('function chatRenderMensajes('),app.indexOf('function chatEnviar()')),context);
  const list = [{texto:'Hola',autor:'Prueba'}];
  context.chatRenderMensajes(list);
  assert.match(messages.innerHTML,/No hay mensajes que coincidan/);
  assert.equal(context._chatListaVisible,list);
});
