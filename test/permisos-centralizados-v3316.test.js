const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const w={currentRole:'admin',PERMISOS_ROLES:{},PERMISOS_DEFAULT:{}};
 const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico'];roles.forEach(r=>w.PERMISOS_ROLES[r]={bloqueados:[],acciones:{}});
 const source=fs.readFileSync('js/modules/action-permissions.js','utf8');
 vm.runInNewContext(source.slice(0,source.indexOf('  function proteger('))+'})();',{window:w});
 return {w,roles};
}
test('cada acción permite y deniega por configuración para los cinco roles',()=>{
 const {w,roles}=setup();
 for(const [key,rule] of Object.entries(w.SISVENTAS_PERMISOS_ACCION)){
  // Las validaciones del registro siguen aplicando aunque el permiso sea afirmativo.
  if(rule.validar)continue;
  const [group,...parts]=key.split('.'),action=parts.join('_');
  for(const role of roles){w.currentRole=role;const cfg=w.PERMISOS_ROLES[role];cfg.bloqueados=[];cfg.acciones[group]={[action]:true};assert.equal(w.tienePermiso(key),true,key+' '+role+' habilitado');cfg.acciones[group][action]=false;assert.equal(w.tienePermiso(key),false,key+' '+role+' denegado');cfg.acciones[group][action]=true;cfg.bloqueados=[rule.modulo];assert.equal(w.tienePermiso(key),false,key+' módulo bloqueado');cfg.bloqueados=[];cfg.acciones={};}
 }
});
test('widgets conservan configuración anterior hasta tener casilla explícita en Roles',()=>{
 const {w}=setup();w.currentRole='vendedor';w.DASH_WIDGETS_CONFIG={btn_ia:{vendedor:false},ots_pendientes:{vendedor:true}};
 assert.equal(w.tienePermiso('dashboard.asistente'),false);assert.equal(w.tienePermiso('dashboard.otsPendientes'),true);
 w.PERMISOS_ROLES.vendedor.acciones.dashboard={asistente:true,otsPendientes:false};assert.equal(w.tienePermiso('dashboard.asistente'),true);assert.equal(w.tienePermiso('dashboard.otsPendientes'),false);
});
test('permisos nuevos conservan los valores iniciales de las restricciones migradas',()=>{
 const {w,roles}=setup();
 for(const role of roles){w.currentRole=role;assert.equal(w.tienePermiso('ot.corregirMateriales'),['admin','administrativo','vendedor'].includes(role));assert.equal(w.tienePermiso('ventas.autorizarDescuento'),role==='admin');assert.equal(w.tienePermiso('ventas.configurarComision'),role==='admin');}
});
