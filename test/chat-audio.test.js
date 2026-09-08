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
 const c={_chatCanal:'admin',notify(){},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++;}}]})}},window:{MediaRecorder:Recorder},MediaRecorder:Recorder,File,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setInterval:()=>1,clearInterval(){},chatEnviarArchivo:f=>sent.push(f),document:{getElementById:id=>nodes[id]||(nodes[id]={pause(){},load(){},removeAttribute(){},setAttribute(){}})}};
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
test('enviar durante grabación detiene y espera el último fragmento antes de enviar una sola vez',async()=>{
 const s=setup();await s.c.chatAudioGrabar();const recorder=s.c._chatAudio.recorder;
 let finish;recorder.stop=function(){this.state='inactive';finish=()=>{this.ondataavailable({data:new Blob(['ultimo fragmento'])});this.onstop();};};
 s.c.chatAudioEnviar();s.c.chatAudioEnviar();assert.equal(s.sent.length,0);finish();
 assert.equal(s.sent.length,1);assert.equal(await s.sent[0].text(),'ultimo fragmento');assert.ok(Number.isFinite(s.sent[0].audioDuracion));
 s.c.chatAudioEnviar();assert.equal(s.sent.length,1);
});
test('duración guardada se muestra antes de reproducir',()=>{
 const c={escapeHTML:x=>x};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function chatMsgContenido('),app.indexOf('function chatRenderMensajes(')),c);
 const html=c.chatMsgContenido({audioUrl:'https://example.com/audio.webm',audioDuracion:75,autor:'Prueba'});
 assert.match(html,/1:15/);assert.match(html,/preload="metadata"/);assert.doesNotMatch(html,/autoplay/);
});
test('mensaje de audio ofrece controles sin reproducción automática',()=>{
 const c={escapeHTML:x=>x};vm.createContext(c);
 vm.runInContext(app.slice(app.indexOf('function chatMsgContenido('),app.indexOf('function chatRenderMensajes(')),c);
 const html=c.chatMsgContenido({audioUrl:'https://example.com/audio.webm',autor:'Prueba'});
 assert.match(html,/class="chat-player-play"/);assert.doesNotMatch(html,/autoplay/);
});

test('soltar envía; deslizar a izquierda cancela; bloquear mantiene grabación',async()=>{
 const e={button:0,pointerId:1,clientX:200,clientY:200,preventDefault(){},currentTarget:{setPointerCapture(){}}};
 const a=setup();a.c.chatAudioPulsar(e);await new Promise(setImmediate);a.c.chatAudioSoltar({...e,type:'pointerup'});assert.equal(a.sent.length,1);
 const b=setup();b.c.chatAudioPulsar(e);await new Promise(setImmediate);b.c.chatAudioMover({...e,clientX:100});b.c.chatAudioSoltar({...e,type:'pointerup'});assert.equal(b.sent.length,0);assert.ok(b.stopped()>0);
 const d=setup();d.c.chatAudioPulsar(e);await new Promise(setImmediate);d.c.chatAudioMover({...e,clientY:120});d.c.chatAudioSoltar({...e,type:'pointerup'});assert.equal(d.sent.length,0);d.c.chatAudioPulsar(e);assert.equal(d.sent.length,1);
});

