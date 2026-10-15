'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const policy=require('../js/core/domain-read-policy.js');
function setup(role='tecnico',visible=[]){
 const documentListeners={},frames=[];
 const window={addEventListener(){},tienePermiso:key=>visible.includes(key),
  svPuedeLeerDominio:key=>policy.allows(key,role,module=>(policy.restrictedDefaults[module]||policy.internalRoles).includes(role),key=>visible.includes(key))};
 const c={URL,window,document:{addEventListener:(n,f)=>documentListeners[n]=f},requestAnimationFrame:f=>frames.push(f)};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/core/data-readiness.js','utf8'),c);
 return {c,window,api:window.SVDataReadiness,documentListeners,frames};
}
test('un técnico sin tarjetas comerciales no espera cobros aunque otra pantalla autorice su lectura',()=>{
 const s=setup('tecnico',['dashboard.miCuenta','dashboard.misOT']);
 s.window.svPuedeLeerDominio=()=>true; // Reproduce autorización compartida, no visibilidad del widget.
 s.api.beginSource('pagos').error();
 assert.deepEqual(Array.from(s.api.requirementsFor('dashboard')),[]);
 assert.equal(s.api.statusFor('dashboard').ready,true);assert.equal(s.api.statusFor('dashboard').errors.length,0);
});
test('actividad comercial y gráfico no esperan cobros ni productos de otras pantallas',()=>{
 for(const widget of ['dashboard.miActividad','dashboard.grafico']){
  const s=setup('vendedor',[widget]);s.window.svPuedeLeerDominio=()=>true;
  assert.deepEqual(Array.from(s.api.requirementsFor('dashboard')),['clientes','ventas']);
  for(const k of ['clientes','ventas'])s.api.beginSource(k).ready();
  s.api.beginSource('pagos').error();assert.equal(s.api.statusFor('dashboard').ready,true);
 }
});
test('las tarjetas de cobros autorizadas mantienen la espera y el error auténtico',()=>{
 for(const widget of ['dashboard.metricasGlobales','dashboard.rentabilidad','ventas.verDashboard']){
  const s=setup('admin',[widget]);
  for(const k of s.api.requirementsFor('dashboard').filter(k=>k!=='pagos'))s.api.beginSource(k).ready();
  assert.deepEqual(Array.from(s.api.statusFor('dashboard').missing),['pagos']);
  const p=s.api.beginSource('pagos');p.error();assert.deepEqual(Array.from(s.api.statusFor('dashboard').errors),['pagos']);
  p.ready();assert.equal(s.api.statusFor('dashboard').ready,true);
 }
});
test('cambiar los permisos retira dependencias y errores de tarjetas ya ocultas',()=>{
 const s=setup('admin',['dashboard.metricasGlobales']);s.api.beginSource('pagos').error();
 assert.equal(s.api.statusFor('dashboard').ready,false);
 s.window.tienePermiso=()=>false;
 assert.equal(s.api.statusFor('dashboard').ready,true);assert.equal(s.api.statusFor('dashboard').errors.length,0);
 assert.equal(typeof s.documentListeners['sisventas:role-changed'],'function');
});
test('el progreso inicial del técnico termina sin esperar nodos comerciales no necesarios',async()=>{
 const s=setup('tecnico',['dashboard.miCuenta','dashboard.misOT']);
 s.c.svPuedeLeerDominio=s.window.svPuedeLeerDominio;s.c._svPaginaDesdeRuta=()=> 'dashboard';
 s.c._svCargaInicial={clientes:{listo:false,etiqueta:'clientes'},productos:{listo:false,etiqueta:'productos'},ventas:{listo:false,etiqueta:'ventas'},pagos:{listo:false,etiqueta:'cobros'}};
 s.c.document.getElementById=()=>null;s.c._svCargaInicialEsperas=[];
 s.c.setTimeout=()=>assert.fail('No demorar el inicio esperando una colección no necesaria');
 load(s.c,['svClavesCargaInicial','svEstadoCargaInicial','svPintarCargaInicial','svEsperarCargaInicial']);
 assert.equal(s.c.svEstadoCargaInicial().total,0);assert.equal(await s.c.svEsperarCargaInicial(3200),true);
});
test('en una ruta comercial autorizada el progreso sigue esperando los datos permitidos',()=>{
 const s=setup('admin',['dashboard.metricasGlobales']);s.c.svPuedeLeerDominio=s.window.svPuedeLeerDominio;
 s.c._svPaginaDesdeRuta=()=> 'detalle';s.c._svCargaInicial={ventas:{listo:true},pagos:{listo:false}};
 load(s.c,['svClavesCargaInicial','svEstadoCargaInicial']);
 assert.equal(s.c.svEstadoCargaInicial().total,2);assert.equal(s.c.svEstadoCargaInicial().completo,false);
});
test('el técnico no suscribe colecciones comerciales bloqueadas; conserva dependencias compartidas de OT',()=>{
 const s=setup('tecnico',['dashboard.miCuenta','dashboard.misOT']);
 s.c.svPuedeLeerDominio=s.window.svPuedeLeerDominio;
 s.window.fbDB={};s.window.fbRef=()=>assert.fail('No consultar Firebase para un dominio bloqueado');
 for(const fn of ['fbCargarPagos','fbCargarVentas','fbCargarPresupuestos','fbCargarCaja','cfCargar','fvCargar']){
  load(s.c,[fn]);s.c[fn]();
 }
 assert.equal(s.window.svPuedeLeerDominio('productos'),true);
 assert.equal(s.window.svPuedeLeerDominio('clientes'),true);
 assert.equal(s.window.svPuedeLeerDominio('ordenesTrabajo'),true);
});
test('bloquear Agenda también excluye eventos que quedaron en memoria; las OT siguen disponibles',()=>{
 const c={svPuedeLeerDominio:()=>false,DASH_AGENDA_INTERNA:[{fecha:'2026-10-15',descripcion:'No visible'}],otData:[]};
 load(c,['dashEventosAgenda']);assert.deepEqual(Array.from(c.dashEventosAgenda()),[]);
});
