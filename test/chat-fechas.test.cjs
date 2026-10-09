const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const app=require('./helpers/active-app').readActiveApp().source;
const source=app.slice(app.indexOf('function chatFechaMensaje('),app.indexOf('function chatEnviar()'));
function setup(){
 const messages={innerHTML:'',scrollTop:0,scrollHeight:600,clientHeight:200};
 const search={value:''};
 const ctx={document:{getElementById:id=>id==='chat-messages'?messages:search},_chatPrimeraCarga:true,currentUser:'yo',escapeHTML:s=>s,chatMensajeModificable:()=>false,chatMsgContenido:m=>m.texto,chatTicks:()=>'',chatInitSwipe:()=>{}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,messages,search};
}
test('fechas por día calendario, incluso cambio de año y fecha inválida',()=>{
 const {ctx}=setup();const now=new Date(2026,0,1,12).getTime();
 assert.equal(ctx.chatFechaMensaje(new Date(2026,0,1,0).getTime(),now).etiqueta,'Hoy');
 assert.equal(ctx.chatFechaMensaje(new Date(2025,11,31,23).getTime(),now).etiqueta,'Ayer');
 assert.match(ctx.chatFechaMensaje(new Date(2025,11,30,12).getTime(),now).etiqueta,/30.*diciembre.*2025/);
 assert.equal(ctx.chatFechaMensaje('invalido',now).etiqueta,'Sin fecha registrada');
 assert.equal(ctx.chatFechaMensaje(null,now).hora,'');
});
test('agrupa días, conserva mensajes y vuelve a agrupar resultados de búsqueda',()=>{
 const {ctx,messages,search}=setup();const today=new Date();today.setHours(12,0,0,0);const yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
 const list=[{fbKey:'a',autor:'otro',texto:'anterior',ts:+yesterday},{fbKey:'b',autor:'yo',texto:'actual',ts:+today},{fbKey:'c',autor:'otro',texto:'actual dos',ts:+today+60000}];
 ctx.chatRenderMensajes(list);
 assert.equal((messages.innerHTML.match(/class="chat-day"/g)||[]).length,2);
 assert.match(messages.innerHTML,/>Hoy</);assert.match(messages.innerHTML,/>Ayer</);
 assert.equal((messages.innerHTML.match(/class="chat-msg-hora"/g)||[]).length,3);
 assert.equal(messages.scrollTop,600);
 search.value='actual';ctx.chatRenderMensajes(list);
 assert.equal((messages.innerHTML.match(/class="chat-day"/g)||[]).length,1);
 assert.doesNotMatch(messages.innerHTML,/>Ayer</);
});
