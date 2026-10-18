'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Ver como no publica identidad simulada ni permite un envío de presencia pendiente',async()=>{
 let disconnectThen,writes=0;const intervals=[],events=new EventTarget();
 const root={currentUserUid:'admin',currentUser:'Admin',currentRole:'admin',fbAuth:{currentUser:{uid:'admin'}},fbDB:{},fbRef:(_,p)=>p,fbSet:async()=>writes++,fbRemove:async()=>{},fbServerTimestamp:()=>1,fbOnDisconnect:()=>({remove:()=>({then:f=>{disconnectThen=f;return {catch:()=>{}};}})}),fbOnValue:(path,f)=>{if(path==='.info/connected')f({val:()=>true});return()=>{};},obtenerIdSesionPresencia:()=> 'fixture',usuariosPresentesUnicos:()=>[],presenciaEstaActiva:()=>true};
 const document={addEventListener:(...v)=>events.addEventListener(...v),removeEventListener:(...v)=>events.removeEventListener(...v),getElementById:()=>null};vm.runInNewContext(fs.readFileSync('js/modules/chat-presence.js','utf8'),{window:root,document,setInterval:f=>{intervals.push(f);return 1;},clearInterval:()=>{}});
 root.SVChatPresence.start();root._impersonacionOriginal={uid:'admin'};root.currentUser='Técnico';root.currentRole='tecnico';disconnectThen();assert.equal(writes,0);assert.equal(intervals.length,0);events.dispatchEvent(new Event('pointerdown'));assert.equal(writes,0);
 root._impersonacionOriginal=null;root.currentUser='Admin';root.currentRole='admin';root.SVChatPresence.start();disconnectThen();assert.equal(writes,1);root.SVChatPresence.stop();
});
