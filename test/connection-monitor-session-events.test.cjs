'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const document=new EventTarget(),browser=new EventTarget();document.hidden=false;
 const calls=[],user={uid:'ficticio'};
 const root={document,navigator:{onLine:true},fbAuth:{currentUser:user},currentUserUid:user.uid,
  SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},
  addEventListener:browser.addEventListener.bind(browser),dispatchEvent:browser.dispatchEvent.bind(browser),
  fetch:async(url,options)=>{const u=new URL(url);assert.equal(u.origin,'https://ventas.sistemanixa.com');assert.equal(u.pathname,'/manifest.webmanifest');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.equal(options.headers,undefined);calls.push(url);return {status:200};}};
 vm.runInNewContext(fs.readFileSync('js/core/connection-monitor.js','utf8'),{window:root,Event,AbortSignal});
 return {root,document,calls,user,session:name=>document.dispatchEvent(new Event(name)),event:name=>browser.dispatchEvent(new Event(name)),visible(){document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));}};
}
test('Auth persistente no consulta antes de confirmar la sesión de SisVentas',async()=>{
 const f=fixture();f.session('firebase-ready');f.visible();f.event('online');await settle();assert.equal(f.calls.length,0);
 f.session('sisventas:session-ready');await settle();assert.equal(f.calls.length,1);
});
test('cerrar SisVentas bloquea sondas aunque Firebase aún conserve su usuario',async()=>{
 const f=fixture();f.session('sisventas:session-ready');await settle();f.session('sisventas:session-ended');
 f.event('online');f.visible();f.session('firebase-ready');await settle();assert.equal(f.calls.length,1);
 f.session('sisventas:session-ready');await settle();assert.equal(f.calls.length,2);
});
test('cambio de cuenta no reutiliza la confirmación anterior y Ver como conserva la conexión propia',async()=>{
 const f=fixture();f.session('sisventas:session-ready');await settle();
 f.root.currentUserUid='vista-autorizada';f.visible();await settle();assert.equal(f.calls.length,2);
 f.root.fbAuth.currentUser={uid:'otra-identidad'};f.event('online');f.visible();await settle();assert.equal(f.calls.length,2);
 f.root.currentUserUid='otra-identidad';f.session('sisventas:session-ready');await settle();assert.equal(f.calls.length,3);
});
test('online y fallos de lecturas no sondéan un documento oculto; volver visible comprueba una vez',async()=>{
 const f=fixture();f.session('sisventas:session-ready');await settle();f.document.hidden=true;
 f.event('online');await f.root.SVConnectionMonitor.check();f.root.SVConnectionMonitor.failure('ventas',TypeError('Fallo previo'));await settle();
 assert.equal(f.calls.length,1);f.visible();await settle();assert.equal(f.calls.length,2);
});
