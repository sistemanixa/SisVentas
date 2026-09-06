const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('adjunto conserva conversación y espera confirmación del mensaje', async () => {
  const source = require('./helpers/active-app').readActiveApp().source;
  const fn = source.slice(source.indexOf('function chatSubirConLimite('), source.indexOf('function chatInicializarArrastreImagenes('));
  const notices = [], paths = [];
  let finish;
  const context = { _chatCanal:'admin', currentUser:'Test', currentRole:'admin', notify:x=>notices.push(x), document:{getElementById:()=>null}, window:{fbStorage:{},fbDB:{},fbStorageRef:()=>({}),fbUploadBytes:async()=>({ref:{}}),fbGetDownloadURL:async()=> 'https://example.com/test.pdf',fbRef:(_,path)=>path,fbPush:(path)=>{paths.push(path);return new Promise(resolve=>{finish=resolve;});} } };
  context.setTimeout = setTimeout; context.clearTimeout = clearTimeout;
  context.window.fbAuth = {currentUser:{uid:'test-owner'}};
  vm.createContext(context); vm.runInContext(fn, context);
  const pending = context.chatEnviarArchivo({name:'test.pdf',type:'application/pdf',size:12});
  context._chatCanal = 'general';
  context.currentUser = 'Otra persona';
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(paths,['sisventas/chat/admin']);
  assert.equal(notices.includes('✓ Adjunto enviado'),false);
  finish(); await pending;
  assert.equal(notices.includes('✓ Adjunto enviado'),true);
});

function escenarioAdjunto() {
  const source = require('./helpers/active-app').readActiveApp().source;
  const fn = source.slice(source.indexOf('function chatSubirConLimite('), source.indexOf('function chatInicializarArrastreImagenes('));
  const timers = new Map(), notices = [], messages = [], estado = {};
  let id = 0;
  const context = {_chatCanal:'admin', currentUser:'Test', currentRole:'admin',
    notify: x => notices.push(x), document:{getElementById:()=>estado},
    setTimeout: fn => {timers.set(++id, fn); return id;}, clearTimeout: id => timers.delete(id),
    window:{fbAuth:{currentUser:{uid:'owner'}}, fbDB:{}, fbStorage:{},
      fbStorageRef:()=>({}), fbUploadBytes:async()=>({ref:{}}),
      fbGetDownloadURL:async()=> 'https://example.com/test.pdf',
      fbRef:(_,path)=>path, fbPush:(path,msg)=>{messages.push({path,msg});return Promise.resolve();}}};
  vm.createContext(context); vm.runInContext(fn,context);
  return {context,timers,notices,messages,estado};
}
const flush = () => new Promise(resolve=>setImmediate(resolve));
test('enlace que llega después del límite no publica el mensaje', async () => {
  const s = escenarioAdjunto(); let resolveUrl;
  s.context.window.fbGetDownloadURL = () => new Promise(resolve=>{resolveUrl=resolve;});
  const pending = s.context.chatEnviarArchivo({name:'test.pdf',type:'application/pdf',size:12});
  await flush();
  for (const callback of [...s.timers.values()]) callback();
  await pending;
  resolveUrl('https://example.com/late.pdf'); await flush();
  assert.equal(s.messages.length,0);
  assert.match(s.estado.textContent,/No se envió al chat/);
  assert.equal(s.notices.includes('✓ Adjunto enviado'),false);
});
test('confirmación demorada conserva autor y destino y no declara fracaso', async () => {
  const s = escenarioAdjunto(); let confirm;
  s.context.window.fbPush = (path,msg) => {s.messages.push({path,msg});return new Promise(resolve=>{confirm=resolve;});};
  const pending = s.context.chatEnviarArchivo({name:'test.pdf',type:'application/pdf',size:12});
  s.context.currentUser = 'Otra persona'; s.context._chatCanal = 'general';
  await flush();
  for (const callback of [...s.timers.values()]) callback();
  assert.match(s.estado.textContent,/aún no confirmó/);
  assert.equal(s.notices.includes('✓ Adjunto enviado'),false);
  assert.equal(s.messages.length,1);
  assert.equal(s.messages[0].msg.autor,'Test');
  assert.equal(s.messages[0].path,'sisventas/chat/admin');
  confirm(); await pending;
  assert.equal(s.notices.includes('✓ Adjunto enviado'),true);
  assert.equal(s.timers.size,0);
});
