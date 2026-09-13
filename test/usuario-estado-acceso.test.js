const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(user,fail=false){
 const calls=[];
 const window={usuariosData:user?[user]:[],_chatDirectorio:{},fbDB:{},fbRef:(_,p)=>p||'/',fbUpdate:async(ref,value)=>{calls.push({ref,value});if(fail)throw Error('denegado');}};
 vm.runInNewContext(fs.readFileSync('js/modules/security-storage.js','utf8'),{window});
 vm.runInNewContext(fs.readFileSync('js/modules/chat-access.js','utf8'),{window,setInterval:()=>{}});
 return {window,calls};
}
for(const activo of [true,false])test('estado '+activo+' se guarda atómicamente en ficha y accesos',async()=>{
 const {window,calls}=setup({fbKey:'u1',uid:'auth1',rol:'administrativo'});
 await window.cambiarEstadoUsuarioConAccesoChat('u1',activo);
 assert.equal(calls.length,1);
 assert.equal(calls[0].ref,'/');
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].value)),{'sisventas/usuarios/u1/activo':activo,'sv_chat_roles/auth1/activo':activo,'sv_chat_directorio/auth1/activo':activo});
});
test('sin identidad no escribe parcialmente',async()=>{
 const {window,calls}=setup({fbKey:'u1'});
 await assert.rejects(window.cambiarEstadoUsuarioConAccesoChat('u1',false),/identidad/);
 assert.equal(calls.length,0);
});
test('rechazo del servidor se propaga sin segundo guardado',async()=>{
 const {window,calls}=setup({fbKey:'u1',uid:'auth1'},true);
 await assert.rejects(window.cambiarEstadoUsuarioConAccesoChat('u1',false),/denegado/);
 assert.equal(calls.length,1);
});
test('identidad histórica se resuelve por directorio',async()=>{
 const {window,calls}=setup({fbKey:'u1'});
 window._chatDirectorio={auth1:{usuarioKey:'u1'}};
 await window.cambiarEstadoUsuarioConAccesoChat('u1',false);
 assert.equal(calls[0].value['sv_chat_roles/auth1/activo'],false);
});
