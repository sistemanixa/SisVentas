'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('sin activación conserva rutas publicadas; copia verificada cambia ambas rutas',async()=>{
 for(const enabled of [false,true]){
  const window={SV_SECURITY_STORAGE_V2:enabled,fbRef:()=> 'sv_usuarios',fbGet:async()=>({exists:()=>true}),fbOnValue:()=>()=>{}};
  vm.runInNewContext(fs.readFileSync('js/modules/security-storage.js','utf8'),{window});
  await window.svPrepararRutasSeguridad({uid:'ficticio'});
  assert.equal(window.svRutaUsuarios(),enabled?'sv_usuarios':'sisventas/usuarios');
  assert.equal(window.svRutaPermisos(),enabled?'sv_permisos':'sisventas/config/permisos');
 }
});
test('antes de migrar usa legacy; al aparecer la copia pasa a protegido y recarga datos',async()=>{
 let listener,refresh=0;
 const window={SV_SECURITY_STORAGE_V2:true,fbRef:()=> 'sv_usuarios',fbGet:async()=>({exists:()=>false}),fbOnValue:(_,cb)=>{listener=cb;return()=>{};},fbCargarUsuarios:()=>refresh++,cargarPermisosRoles:()=>refresh++};
 vm.runInNewContext(fs.readFileSync('js/modules/security-storage.js','utf8'),{window});
 await window.svPrepararRutasSeguridad({uid:'ficticio'});
 assert.equal(window.svRutaUsuarios(),'sisventas/usuarios');
 listener({exists:()=>true});
 assert.equal(window.svRutaUsuarios(),'sv_usuarios');assert.equal(refresh,2);
 listener({exists:()=>false});assert.equal(window.svRutaUsuarios(),'sv_usuarios');
});
const index=fs.readFileSync('index.html','utf8');
const active=index.match(/src="\.\/(js\/app\.v[\d.]+\.js)/)[1];
const source=fs.readFileSync(active,'utf8');
function fn(name){const start=source.indexOf('function '+name+'(');const end=source.indexOf('\n}',start)+2;return (source.slice(start-6,start)==='async '?'async ':'')+source.slice(start,end);}
test('un rechazo al guardar Roles conserva configuración local y no anuncia éxito',async()=>{
 let notifications=[],applied=0;
 const sandbox={document:{querySelectorAll:()=>[]},PERMISOS_VERSION_ACTUAL:1,PERMISOS_ROLES:{anterior:true},aplicarPermisosRolesGuardados:()=>applied++,notify:m=>notifications.push(m),window:{fbDB:{},svRutaPermisos:()=> 'sv_permisos',fbRef:(_,p)=>p,fbSet:async()=>{throw Error('denegado');}}};
 vm.runInNewContext(fn('guardarPermisosRoles'),sandbox);
 await sandbox.guardarPermisosRoles();
 assert.equal(applied,0);assert.equal(sandbox.PERMISOS_ROLES.anterior,true);
 assert.equal(notifications.length,1);assert.match(notifications[0],/No se pudieron/);
});
test('un rechazo al restaurar Roles conserva configuración anterior',async()=>{
 let applied=0;
 const sandbox={svConfirm:async()=>true,PERMISOS_VERSION_ACTUAL:1,PERMISOS_DEFAULT:{nuevo:true},PERMISOS_ROLES:{anterior:true},aplicarPermisosRolesGuardados:()=>applied++,notify:()=>{},renderTablaRoles:()=>{throw Error('No debe renderizar como guardado');},window:{fbDB:{},svRutaPermisos:()=> 'sv_permisos',fbRef:(_,p)=>p,fbSet:async()=>{throw Error('denegado');}}};
 vm.runInNewContext(fn('restaurarPermisosDefault'),sandbox);
 await sandbox.restaurarPermisosDefault();
 assert.equal(applied,0);assert.equal(sandbox.PERMISOS_ROLES.anterior,true);
});
test('archivo activo usa resolutor para todas las rutas de control',()=>{
 assert.doesNotMatch(source,/fbRef\([^\n]*['"]sisventas\/(usuarios|config\/permisos)/);
 assert.ok(index.indexOf('security-storage.js')<index.indexOf(active));
});
