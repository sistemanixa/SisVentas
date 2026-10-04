const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Distribuidora solo habilita el botón de chat entre las acciones generales',()=>{
 const document={addEventListener(){},querySelectorAll(){return []}};
 const window={currentRole:'distribuidora',PERMISOS_ROLES:{distribuidora:{bloqueados:[],acciones:{'usuarios.impersonar':true}}}};
 vm.runInNewContext(fs.readFileSync('js/modules/action-permissions.js','utf8'),{window,document,console,setTimeout(){},MutationObserver:class{observe(){}}});
 assert.equal(window.tienePermiso('dashboard.chat'),true);
 for(const key of ['chat.limpiar','usuarios.impersonar','dashboard.rentabilidad','productos.agregarProveedor'])assert.equal(window.tienePermiso(key),false);
});
test('Distribuidora no usa el fallback de módulos sin restricciones',()=>{
 const window={currentRole:'distribuidora'},document={};
 vm.runInNewContext(fs.readFileSync('js/core/access-control.js','utf8'),{window,document});
 for(const page of ['usuarios','ventas','dashboard','productos'])assert.equal(window.SisVentas.Access.canAccess(page),false);
});
test('Distribuidora consulta solo su identidad protegida al iniciar',async()=>{
 const paths=[];const window={SV_SECURITY_STORAGE_V2:true,fbRef:(_,p)=>p,fbGet:async p=>{paths.push(p);return{val:()=>({rol:'distribuidora'})}}};
 vm.runInNewContext(fs.readFileSync('js/modules/security-storage.js','utf8'),{window});
 await window.svPrepararRutasSeguridad({uid:'prueba'});assert.deepEqual(paths,['sv_chat_roles/prueba']);assert.equal(window.svRutaUsuarios(),'sv_usuarios');
});
