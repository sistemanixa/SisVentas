'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=require('./helpers/active-app').readActiveApp().source;
function wrapper(gated){
 let authCallback,reads=0,deliveries=0;
 const window={SVUserAccess:{gate:async()=>gated},svPrepararRutasSeguridad:async()=>{reads++;return {uid:'worker'};}};
 const script=fs.readFileSync('js/core/firebase.js','utf8');
 const part=script.slice(script.indexOf('window.fbOnAuth = function'),script.indexOf('window.fbCreateUser  ='));
 vm.runInNewContext(part,{window,console,onAuthStateChanged:(auth,cb)=>{authCallback=cb;return ()=>{};}});
 window.fbOnAuth({},()=>deliveries++);
 return {emit:()=>authCallback({uid:'worker'}),read:()=>({reads,deliveries})};
}
test('La restauración con clave temporal no inicia lecturas de roles ni entrega la sesión al sistema',async()=>{
 const f=wrapper(true);await f.emit();assert.deepEqual(f.read(),{reads:0,deliveries:0});
});
test('La restauración normal conserva preparación y callback de sesión',async()=>{
 const f=wrapper(false);await f.emit();assert.deepEqual(f.read(),{reads:1,deliveries:1});
});
test('Resolver rol retorna antes de cargar perfiles si está pendiente el cambio obligatorio',async()=>{
 const start=source.indexOf('async function _resolverRolYCompletarLogin('),end=source.indexOf('\n}\n',start)+2;
 const window={SVUserAccess:{gate:async()=>true}};let reads=0;
 const context={window,setTimeout:()=>{reads++;throw Error('No debe iniciar rol');}};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 await context._resolverRolYCompletarLogin({uid:'worker'});assert.equal(reads,0);
});
test('Guardar perfil no reenvía contraseñas históricas ni permite introducir una nueva copia',async()=>{
 const script=fs.readFileSync('js/modules/chat-access.js','utf8');
 const start=script.indexOf('window.guardarUsuarioConAccesoChat=function'),end=script.indexOf('\n  };',start)+5;
 let changes;const window={usuariosData:[{fbKey:'p',uid:'worker',claveAdmin:'OLD_FAKE_SECRET',nombre:'Anterior'}],fbDB:{},svRutaUsuarios:()=> 'sv_usuarios',fbRef:(_,p)=>p,fbUpdate:async(_,patch)=>{changes=patch;}};
 vm.runInNewContext(script.slice(start,end),{window});
 await window.guardarUsuarioConAccesoChat({nombre:'Nuevo',rol:'tecnico',activo:true,password:'NEW_FAKE_SECRET',claveAdmin:'ANOTHER_FAKE_SECRET'},'p');
 assert.equal(changes['sv_usuarios/p/nombre'],'Nuevo');assert.equal(changes['sv_usuarios/p/uid'],'worker');
 assert.equal(JSON.stringify(changes).includes('SECRET'),false);assert.equal(window.usuariosData[0].claveAdmin,'OLD_FAKE_SECRET');
});
test('El verificador de Functions rechaza sesiones temporales/revocadas/versiones viejas y conserva sesiones normales',async()=>{
 const code=fs.readFileSync('cloud-functions/emitir-factura/index.js','utf8'),start=code.indexOf('async function authenticatedUser('),end=code.indexOf('\n}\n',start)+2;
 for(const scenario of [{token:{uid:'worker'},state:null,allowed:true},{token:{uid:'worker',svPasswordChangeRequired:true},state:null},
  {token:{uid:'worker'},state:{required:true,version:'new'}},{token:{uid:'worker',svAccessVersion:'old'},state:{required:false,version:'new'}},
  {token:{uid:'worker',svAccessVersion:'new',svPasswordChangeRequired:false},state:{required:false,version:'new'},allowed:true},{revoked:true}]){
  let status;const context={admin:{auth:()=>({verifyIdToken:async(token,checkRevoked)=>{assert.equal(checkRevoked,true);if(scenario.revoked)throw Error('revoked');return scenario.token;}})},db:{ref:()=>({once:async()=>({val:()=>scenario.state})})}};
  vm.createContext(context);vm.runInContext(code.slice(start,end),context);
  const res={status(code){status=code;return this;},json(){}};
  const result=await context.authenticatedUser({get:()=> 'Bearer FAKE_TOKEN'},res);
  if(scenario.allowed){assert.equal(result.uid,'worker');assert.equal(status,undefined);}else{assert.equal(result,null);assert.equal(status,401);}
 }
});
