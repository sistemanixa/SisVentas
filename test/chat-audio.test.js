const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const app = require('./helpers/active-app').readActiveApp().source;
function setup() {
 const nodes = {}, sent = []; let stopped=0;
 class Recorder {
  static isTypeSupported() {return true;}
  constructor(){this.state='inactive';}
  start(){this.state='recording';}
  stop(){this.state='inactive';this.ondataavailable({data:new Blob(['audio'])});this.onstop();}
 }
 const c={_chatCanal:'admin',notify(){},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++;}}]})}},window:{MediaRecorder:Recorder},MediaRecorder:Recorder,File,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setInterval:()=>1,clearInterval(){},chatEnviarArchivo:f=>sent.push(f),document:{getElementById:id=>nodes[id]||(nodes[id]={pause(){},load(){},removeAttribute(){}})}};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('var _chatAudio ='),app.indexOf('function chatSubirConLimite(')),c);
 return {c,nodes,sent,stopped:()=>stopped};
}
test('audio requiere detener y enviar explícitamente; libera micrófono',async()=>{
 const s=setup();await s.c.chatAudioGrabar();assert.equal(s.sent.length,0);
 s.c.chatAudioDetener();assert.equal(s.sent.length,0);assert.ok(s.stopped()>0);
 assert.equal(s.nodes['chat-audio-preview'].src,'blob:test');
 s.c.chatAudioEnviar();assert.equal(s.sent.length,1);assert.equal(s.sent[0].type,'audio/webm');
 s.c.chatAudioEnviar();assert.equal(s.sent.length,1);
});
test('cancelar mientras espera permiso libera el micrófono al recibirlo',async()=>{
 const s=setup();let resolve;let stopped=false;
 s.c.navigator.mediaDevices.getUserMedia=()=>new Promise(ok=>resolve=ok);
 const pending=s.c.chatAudioGrabar();s.c.chatAudioCancelar();
 resolve({getTracks:()=>[{stop(){stopped=true;}}]});await pending;
 assert.equal(stopped,true);assert.equal(s.sent.length,0);assert.equal(s.c._chatAudio,null);
});
test('audio no se envía a un canal diferente del que lo grabó',async()=>{
 const s=setup();await s.c.chatAudioGrabar();s.c.chatAudioDetener();s.c._chatCanal='general';s.c.chatAudioEnviar();assert.equal(s.sent.length,0);
});
test('mensaje de audio ofrece controles sin reproducción automática',()=>{
 const c={escapeHTML:x=>x};vm.createContext(c);
 vm.runInContext(app.slice(app.indexOf('function chatMsgContenido('),app.indexOf('function chatRenderMensajes(')),c);
 const html=c.chatMsgContenido({audioUrl:'https://example.com/audio.webm',autor:'Prueba'});
 assert.match(html,/<audio controls/);assert.doesNotMatch(html,/autoplay/);
});
