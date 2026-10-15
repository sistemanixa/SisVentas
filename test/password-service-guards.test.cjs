'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const modules=['../cloud-functions/emitir-factura/service-auth.cjs','../cloud-functions/asistente/service-auth.cjs'];
function fake(token,state){return {auth:()=>({verifyIdToken:async(t,revoked)=>{assert.equal(revoked,true);return token;}}),database:()=>({ref:path=>({get:async()=>({val:()=>path.startsWith('sv_access_resets/')?state:path.startsWith('sv_chat_roles/')?{rol:'admin',activo:true}:{}})})})};}
for(const name of modules)test(name+': acceso temporal y versiones viejas no autorizan operaciones; sesiones normales conservadas',async()=>{
 const service=require(name);
 for(const testCase of [{token:{uid:'demo'},state:null,allowed:true},{token:{uid:'demo',svPasswordChangeRequired:true},state:null},{token:{uid:'demo'},state:{required:true,version:'v'}},{token:{uid:'demo',svAccessVersion:'old'},state:{required:false,version:'v'}},{token:{uid:'demo',svAccessVersion:'v'},state:{required:false,version:'v'},allowed:true}]){
  const operation=service.authorize({admin:fake(testCase.token,testCase.state),authorization:'Bearer FAKE',service:'fiscal'});
  if(testCase.allowed)assert.equal((await operation).uid,'demo');else await assert.rejects(operation,e=>e.statusCode===403);
 }
});
test('Audio rechaza la sesión temporal antes de solicitar tokens del servidor o usar Speech',async()=>{
 let called=0;const context={module:{exports:{}},require:name=>name==='./admin.cjs'?fake({uid:'demo',svPasswordChangeRequired:true},null):require('../cloud-functions/asistente/service-auth.cjs'),fetch:()=>{called++;throw Error('No external calls');}};
 vm.runInNewContext(fs.readFileSync('cloud-functions/asistente/audio.cjs','utf8'),context);
 await assert.rejects(context.module.exports.transcribe({headers:{authorization:'Bearer FAKE'}},{}),e=>e.statusCode===403);assert.equal(called,0);
});
