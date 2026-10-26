'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./helpers/app-functions.cjs');
function fixture(){const c={Promise,JSON,AbortSignal,currentRole:'admin',currentUserUid:'admin',CONFIG_COMISIONES_EMPLEADOS:{},CONFIG_COMISIONES_EMPLEADOS_CARGADA:false,CONFIG_COMISIONES:{},APROBACION_CONFIG:{},PERMISOS_ROLES:{admin:{indiceRevision:1}},fbDB:{},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},document:{getElementById:()=>null},actualizarInputsComisiones(){},rolActualNormalizado:()=>c.currentRole,permisoModulo:()=>true,svCapturarContextoOperacion:()=>{const uid=c.currentUserUid,role=c.currentRole;return()=>uid===c.currentUserUid&&role===c.currentRole;},SVServiceAuth:{headers:async()=>({})}};c.window=c;load(c,['svEsAdministradorFinanciero','limpiarConfigComisionesSesion','cargarConfigComisiones']);return c;}
test('una respuesta administrativa tardía no vuelve a cargar porcentajes al cambiar o cerrar sesión',async()=>{
 const c=fixture();let resolve,decoded=0,migrations=0;c.migrarComisionesEmpleadosDesdeFichas=()=>migrations++;c.fetch=()=>new Promise(r=>resolve=r);
 const pending=c.cargarConfigComisiones();for(let turn=0;turn<10&&typeof resolve!=='function';turn++)await Promise.resolve();assert.equal(typeof resolve,'function','La petición administrativa debe estar en vuelo antes de retirar la sesión');c.limpiarConfigComisionesSesion();c.currentUserUid='tech';resolve({ok:true,json:async()=>{decoded++;return {ok:true,comisionesEmpleados:{ficticio:{pct:10}}};}});await pending;
 assert.equal(Object.keys(c.CONFIG_COMISIONES_EMPLEADOS).length,0);assert.equal(c.CONFIG_COMISIONES_EMPLEADOS_CARGADA,false);assert.equal(migrations,0);assert.equal(decoded,0);assert.equal(c._cargaConfigComisionesPromesa,null);
});
test('un rol sin el dominio no solicita configuración de porcentajes de otros empleados',async()=>{
 const c=fixture();c.currentRole='tecnico';c.CONFIG_COMISIONES_EMPLEADOS={viejo:{}};c.CONFIG_COMISIONES_EMPLEADOS_CARGADA=true;c.fetch=()=>assert.fail('No debe solicitar datos bloqueados');await c.cargarConfigComisiones();assert.equal(Object.keys(c.CONFIG_COMISIONES_EMPLEADOS).length,0);assert.equal(c.CONFIG_COMISIONES_EMPLEADOS_CARGADA,false);
});
test('consultar configuración no restaura una excepción borrada desde un porcentaje antiguo',async()=>{
 const c=fixture(),writes=[];let migration=0;c.empData={e:{fbKey:'e',pctComisionPropio:9}};c.migrarComisionesEmpleadosDesdeFichas=()=>migration++;c.fbSet=(...a)=>writes.push(a);c.fbGet=()=>assert.fail('La configuración no consulta originales por SDK');c.fetch=async()=>({ok:true,json:async()=>({ok:true,comisiones:{},comisionesEmpleados:{},maxComisionPct:10})});
 await c.cargarConfigComisiones();assert.equal(migration,0);assert.equal(writes.length,0);assert.equal(Object.keys(c.CONFIG_COMISIONES_EMPLEADOS).length,0);assert.equal(c.empData.e.pctComisionPropio,9);
});
