'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 isAuthenticated=true;currentRole=__QA_SEED__.sv_chat_roles.u.rol;currentUserUid='u';currentUser='Persona ficticia';currentUserEmail='qa@example.invalid';
 window.PERMISOS_ROLES=__QA_SEED__.sv_permisos;window.SISVENTAS_FUNCTIONS.cotizadorProveedor=location.origin;
 clientesData=Object.entries(__QA_SEED__.sisventas.clientes).map(([fbKey,r])=>({...r,fbKey}));prodData=Object.fromEntries(Object.entries(__QA_SEED__.sisventas.productos).map(([fbKey,r])=>[fbKey,{...r,fbKey}]));empData=__QA_SEED__.sisventas.empleados;
 window.SVLaborWrites.install();
 APROBACION_CONFIG.montoLimite=99999999;APROBACION_CONFIG.descuentoLimite=100;
 document.body.classList.add('dark-mode');document.documentElement.classList.add('dark-mode','sv-v3-preview');document.body.classList.remove('sv-sesion-cerrada');
 for(const id of ['screen-login','screen-loading'])document.getElementById(id).style.display='none';const app=document.getElementById('screen-app');app.style.display='flex';app.classList.add('visible');app.inert=false;
 const banner=document.createElement('div');banner.textContent='SIMULACIÓN · DATOS FICTICIOS · BASE AISLADA EN MEMORIA';banner.style.cssText='position:fixed;bottom:0;left:0;right:0;padding:7px;background:#7c3900;color:white;z-index:2147483647;text-align:center;font:12px system-ui;pointer-events:none';document.body.append(banner);
 for(const key of ['productos','clientes','ventas','presupuestos','pagos','gastos','empleados','proveedores','usuarios','ordenes_trabajo'])window.SVDataReadiness?.beginSource(key).ready();
 document.dispatchEvent(new CustomEvent('sisventas:session-ready'));showPage('dashboard');fbCargarPresupuestos();
});
