'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./helpers/app-functions.cjs');
test('una respuesta administrativa tardía no vuelve a cargar porcentajes al cambiar o cerrar sesión',async()=>{
 const waits=[];let migrations=0;const c=load({currentUserUid:'admin',CONFIG_COMISIONES_EMPLEADOS:{},CONFIG_COMISIONES_EMPLEADOS_CARGADA:false,CONFIG_COMISIONES:{},APROBACION_CONFIG:{},svPuedeLeerDominio:()=>true,document:{getElementById:()=>null},actualizarInputsComisiones:()=>{},migrarComisionesEmpleadosDesdeFichas:()=>migrations++,window:{fbDB:{},fbRef:(_,p)=>p,fbGet:()=>new Promise(r=>waits.push(r))}},['limpiarConfigComisionesSesion','cargarConfigComisiones']);
 const pending=c.cargarConfigComisiones();c.limpiarConfigComisionesSesion();c.currentUserUid='tech';waits.forEach(r=>r({val:()=>({ficticio:{pct:10}})}));await pending;
 assert.equal(Object.keys(c.CONFIG_COMISIONES_EMPLEADOS).length,0);assert.equal(c.CONFIG_COMISIONES_EMPLEADOS_CARGADA,false);assert.equal(migrations,0);assert.equal(c.window._cargaConfigComisionesPromesa,null);
});
test('un rol sin el dominio no solicita configuración de porcentajes de otros empleados',async()=>{
 const c=load({CONFIG_COMISIONES_EMPLEADOS:{viejo:{}},CONFIG_COMISIONES_EMPLEADOS_CARGADA:true,svPuedeLeerDominio:()=>false,window:{fbDB:{},fbGet:()=>assert.fail('No debe solicitar datos bloqueados')}},['cargarConfigComisiones']);await c.cargarConfigComisiones();assert.equal(Object.keys(c.CONFIG_COMISIONES_EMPLEADOS).length,0);assert.equal(c.CONFIG_COMISIONES_EMPLEADOS_CARGADA,false);
});
