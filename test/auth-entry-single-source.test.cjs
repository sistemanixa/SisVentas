'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(profile=async()=>({uid:'example',fbKey:'p',rol:'tecnico',activo:true})){
 const counts={sdk:0,profile:0};
 const root={SV_SECURITY_STORAGE_V2:true,SVUserDirectory:{enabled:true,profile:async user=>{counts.profile++;return profile(user);}},fbRef:(_,p)=>p,fbGet:()=>{counts.sdk++;return new Promise(()=>{});}};
 vm.runInNewContext(fs.readFileSync('js/modules/security-storage.js','utf8'),{window:root});return {root,counts,user:{uid:'example'}};
}
test('perfil autorizado completa ingreso aunque el transporte RTDB no responda',async()=>{
 const f=fixture(),result=await Promise.race([f.root.svPrepararRutasSeguridad(f.user),new Promise(resolve=>setTimeout(()=>resolve(null),40))]);
 assert.ok(result,'El SDK RTDB no debe bloquear un perfil ya validado en servidor');assert.equal(f.counts.sdk,0);assert.equal(f.counts.profile,1);assert.equal(result.identitySnapshot.val().rol,'tecnico');assert.equal(result.identitySnapshot.val().activo,true);assert.equal(f.root.svRutaUsuarios(),'sv_usuarios');
});
test('perfil rechazado no usa caché ni otra ruta para conceder acceso',async()=>{
 for(const status of [401,403,503]){const f=fixture(async()=>{throw Object.assign(Error('Rechazado'),{status});});await assert.rejects(f.root.svPrepararRutasSeguridad(f.user),e=>e.status===status);assert.equal(f.root.svRutaUsuarios(),'sisventas/usuarios');assert.equal(f.counts.sdk,0);}
});
test('identidad diferente, perfil incompleto o inactivo no abre las rutas',async()=>{
 for(const change of [{uid:'other'},{fbKey:''},{rol:'inventado'},{activo:false}]){const f=fixture(async()=>({uid:'example',fbKey:'p',rol:'tecnico',activo:true,...change}));await assert.rejects(f.root.svPrepararRutasSeguridad(f.user));assert.equal(f.root.svRutaUsuarios(),'sisventas/usuarios');}
});
test('invalidar sesión descarta perfil tardío y la preparación simultánea comparte solicitud',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>resolve=r));const a=f.root.svPrepararRutasSeguridad(f.user),b=f.root.svPrepararRutasSeguridad(f.user);assert.equal(f.counts.profile,1);f.root.svInvalidarPreparacionSeguridad();resolve({uid:'example',fbKey:'p',rol:'tecnico',activo:true});await assert.rejects(a);await assert.rejects(b);assert.equal(f.root.svRutaUsuarios(),'sisventas/usuarios');
});
