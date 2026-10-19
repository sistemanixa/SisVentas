'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const policy=require('../js/core/domain-read-policy.js');
const {load}=require('./helpers/app-functions.cjs');
function setup(allowed=()=>true){
 const c={URL,window:{addEventListener(){},svPuedeLeerDominio:allowed},document:{addEventListener(){}},requestAnimationFrame(){}};
 vm.runInNewContext(fs.readFileSync('js/core/data-readiness.js','utf8'),c);return c.window.SVDataReadiness;
}
const pages={informes:['informes','clientes','empleados'],equipos:['equipos','clientes','empleados'],garantias:['garantias','equipos','clientes','ventas','productos'],
 soporte:['reclamos','clientes','ordenes_trabajo','ventas','empleados'],remitos:['remitos','clientes'],servicios:['servicios','clientes'],agenda:['agenda','ordenes_trabajo'],caja:['caja'],
 historialcliente:['clientes','ventas','pagos','presupuestos','ordenes_trabajo','equipos','tickets','reclamos']};

test('las pantallas a demanda esperan sus fuentes y un vacío confirmado sí libera su contenido',()=>{
 for(const [page,keys] of Object.entries(pages)){
  const api=setup();assert.deepEqual(Array.from(api.requirementsFor(page)),keys);
  assert.equal(api.statusFor(page).ready,false,page);
  for(const key of keys.slice(0,-1))api.begin('https://fixture.invalid/sisventas/'+key).ready();
  assert.equal(api.statusFor(page).ready,false,page+' todavía debe esperar la última fuente');
  api.begin('https://fixture.invalid/sisventas/'+keys.at(-1)).ready();assert.equal(api.statusFor(page).ready,true,page);
 }
});

test('Historial espera todas las fuentes en cualquier orden, sin exponer un primer resultado parcial',()=>{
 for(const keys of [pages.historialcliente,[...pages.historialcliente].reverse()]){
  const api=setup();
  for(const [index,key] of keys.entries()){
   api.beginSource(key).ready();assert.equal(api.statusFor('historialcliente').ready,index===keys.length-1);
  }
 }
});

test('el rol excluye dependencias no autorizadas del historial sin esperar respuestas imposibles',()=>{
 for(const role of policy.internalRoles){
  const allowed=key=>policy.allows(key,role,page=>(policy.restrictedDefaults[page]||policy.internalRoles).includes(role),()=>false);
  const api=setup(allowed),expected=pages.historialcliente.filter(allowed);
  assert.deepEqual(Array.from(api.requirementsFor('historialcliente')),expected);
  for(const key of expected)api.beginSource(key).ready();
  for(const key of pages.historialcliente.filter(key=>!allowed(key)))api.beginSource(key).error();
  assert.equal(api.statusFor('historialcliente').ready,true,role);assert.equal(api.statusFor('historialcliente').errors.length,0,role);
 }
 const denied=setup(()=>false);for(const page of Object.keys(pages))assert.equal(denied.statusFor(page).ready,!['informes','equipos','soporte'].includes(page),page);
});

test('Caja espera tanto el saldo personal como sus movimientos; una ficha más profunda no reemplaza esa carga',()=>{
 const api=setup(),balance=api.begin('https://fixture.invalid/sisventas/caja/2026-10-18/persona'),
  movements=api.begin('https://fixture.invalid/sisventas/caja/2026-10-18/persona_movs');
 balance.ready();assert.equal(api.statusFor('caja').ready,false);
 api.begin('https://fixture.invalid/sisventas/caja/2026-10-18/persona_movs/M1').ready();assert.equal(api.statusFor('caja').ready,false);
 movements.ready();assert.equal(api.statusFor('caja').ready,true);
 const consolidated=setup();consolidated.begin('https://fixture.invalid/sisventas/caja/2026-10-18').ready();assert.equal(consolidated.statusFor('caja').ready,true);
});

test('cancelar una fuente fallida conserva el error hasta reabrir y completar la carga',()=>{
 const api=setup(),failure=api.beginSource('informes');api.beginSource('clientes').ready();api.beginSource('empleados').ready();
 failure.error();failure.cancel();assert.deepEqual(Array.from(api.statusFor('informes').errors),['informes']);assert.equal(api.statusFor('informes').ready,false);
 const retry=api.beginSource('informes');assert.equal(api.statusFor('informes').errors.length,0);assert.equal(api.statusFor('informes').ready,false);
 retry.ready();assert.equal(api.statusFor('informes').ready,true);
});

test('la sesión nueva descarta el snapshot pendiente del formulario anterior',()=>{
 const api=setup(),old=api.beginSource('informes');api.beginSource('clientes').ready();api.reset();old.ready();
 assert.equal(api.statusFor('informes').ready,false);api.beginSource('informes').ready();assert.equal(api.statusFor('informes').ready,false);
 api.beginSource('clientes').ready();api.beginSource('empleados').ready();assert.equal(api.statusFor('informes').ready,true);
});

function renderedEnvironment(pageName='informes',holdEmployees=false){
 let document;
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.tokens=new Set();this.parentNode=null;this.style={};this.classList={contains:name=>this.tokens.has(name),add:name=>this.tokens.add(name),remove:name=>this.tokens.delete(name),toggle:(name,on)=>on?this.tokens.add(name):this.tokens.delete(name)};}
  get className(){return Array.from(this.tokens).join(' ');}
  set className(value){this.tokens=new Set(value.split(/\s+/).filter(Boolean));}
  append(...children){for(const child of children){child.remove();child.parentNode=this;this.children.push(child);}}
  prepend(child){child.remove();child.parentNode=this;this.children.unshift(child);}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  matches(selector){if(selector[0]==='#')return this.id===selector.slice(1);if(selector[0]==='.')return selector.slice(1).split('.').every(name=>this.tokens.has(name));if(selector==='[data-sv-data-status]')return this.dataset.svDataStatus!==undefined;if(selector==='[role="status"]')return this.attributes.role==='status';return this.tagName===selector;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  focus(options){document.activeElement=this;this.lastFocusOptions=options;}
 }
 const handlers={},frames=[],timers=new Map(),body=new Element('body'),page=new Element('main'),calls=[],messages=[];
 let now=0,id=0;page.id='page-'+pageName;page.tokens.add('page');page.tokens.add('active');page.value='Borrador ficticio que se conserva';body.append(page);
 const root={navigator:{onLine:true},addEventListener(){},setTimeout:fn=>{const key=++id;timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key),
  location:{reload:()=>calls.push('reload')},permisoModulo:()=>true,svPuedeLeerDominio:()=>true,notify:message=>messages.push(message)};
 document={body,activeElement:body,addEventListener:(name,fn)=>{(handlers[name]??=[]).push(fn);},dispatchEvent:event=>{for(const fn of handlers[event.type]||[])fn(event);},
  getElementById:name=>body.querySelector('#'+name),querySelector:selector=>body.querySelector(selector),querySelectorAll:selector=>body.querySelectorAll(selector),createElement:tag=>new Element(tag)};
 const c={URL,Promise,Date:{now:()=>now},CustomEvent:class{constructor(type){this.type=type;}},window:root,document,requestAnimationFrame:fn=>frames.push(fn)};
 vm.runInNewContext(fs.readFileSync('js/core/data-readiness.js','utf8'),c);
 function flush(){for(let remaining=30;frames.length&&remaining>0;remaining--)frames.shift()();assert.equal(frames.length,0);}
 const api=root.SVDataReadiness;if(['informes','equipos','soporte'].includes(pageName)&&!holdEmployees)api.beginSource('empleados').ready();document.dispatchEvent({type:'sisventas:session-ready'});flush();
 return {api,root,page,c,body,document,calls,messages,flush,end(){document.dispatchEvent({type:'sisventas:session-ended'});flush();},
  timeout(){now=16000;for(const [key,fn]of [...timers]){timers.delete(key);fn();}flush();},
  box:()=>document.querySelector('[data-sv-data-status]'),retry:()=>document.querySelector('[data-sv-data-status]')?.querySelector('button')};
}

test('el botón real de reintento sólo reinicia la pantalla a demanda y conserva el borrador',async()=>{
 const e=renderedEnvironment();e.api.beginSource('clientes').ready();const failed=e.api.beginSource('informes');failed.error();failed.cancel();e.flush();
 assert.equal(e.page.classList.contains('sv-data-pending'),true);assert.equal(e.box().classList.contains('sv-data-error'),true);
 let retry;e.root.svCargarDatosDePaginaActual=page=>{e.calls.push(page);retry=e.api.beginSource('informes');};
 e.retry().onclick();e.flush();assert.deepEqual(e.calls,['informes']);assert.equal(e.box().classList.contains('sv-data-error'),false);
 assert.equal(e.page.classList.contains('sv-data-pending'),true);retry.ready();e.flush();
 assert.equal(e.box(),null);assert.equal(e.page.classList.contains('sv-data-pending'),false);assert.equal(e.page.value,'Borrador ficticio que se conserva');
});

test('una espera sin respuesta termina en error recuperable y la respuesta nueva libera los controles',()=>{
 const e=renderedEnvironment();e.timeout();assert.equal(e.box().classList.contains('sv-data-error'),true);
 assert.equal(e.page.attributes['aria-busy'],'false');assert.equal(e.retry().textContent,'Reintentar carga');
 e.root.svCargarDatosDePaginaActual=()=>{e.api.beginSource('clientes').ready();e.api.beginSource('informes').ready();};
 e.retry().onclick();e.flush();assert.equal(e.box(),null);assert.equal(e.page.classList.contains('sv-data-pending'),false);
});

test('un botón de otra sesión o de un módulo bloqueado no puede iniciar la recuperación',()=>{
 const e=renderedEnvironment();e.api.beginSource('informes').error();e.flush();const button=e.retry();
 e.root.svCargarDatosDePaginaActual=page=>e.calls.push(page);e.root.permisoModulo=()=>false;button.onclick();assert.deepEqual(e.calls,[]);
 e.root.permisoModulo=()=>true;e.end();button.onclick();assert.deepEqual(e.calls,[]);
});

test('la recuperación general usa Sincronizar ahora y sólo recarga si no existe ninguna vía de la app',()=>{
 const e=renderedEnvironment('productos');e.api.beginSource('productos').error();e.flush();
 e.root.fbSincronizarAhora=()=>e.calls.push('sync');e.retry().onclick();assert.deepEqual(e.calls,['sync']);
 delete e.root.fbSincronizarAhora;e.retry().onclick();assert.deepEqual(e.calls,['sync','reload']);
});

test('un fallo inesperado al recuperar no pierde el borrador ni deja un rechazo sin manejar',async()=>{
 const e=renderedEnvironment();e.api.beginSource('informes').error();e.flush();
 e.root.svCargarDatosDePaginaActual=async()=>{throw Error('Fallo ficticio de recuperación');};
 e.retry().onclick();await Promise.resolve();e.flush();assert.equal(e.messages.length,1);
 assert.equal(e.page.value,'Borrador ficticio que se conserva');assert.equal(e.box().classList.contains('sv-data-error'),true);
});

function controlledFixture(){
 const c={URL,Promise,Response,Date,Set,queueMicrotask,console,addEventListener(){},location:{href:'http://127.0.0.1:8876/',origin:'http://127.0.0.1:8876'},
  document:{addEventListener(){},querySelector:()=>null},requestAnimationFrame(){},fetch:()=>assert.fail('El fixture no debe consultar red al probar sus fuentes')};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/core/data-readiness.js','utf8'),c);
 vm.runInContext(fs.readFileSync('test/fixtures/module-audit-bootstrap.js','utf8'),c);return c;
}
const settled=()=>new Promise(setImmediate);

test('el fixture demora Informes de verdad y completa readiness después de entregar los dos registros ficticios',async()=>{
 const c=controlledFixture(),received=[];c.__moduleAuditSourceControl.hold(['informes']);
 c.fbOnValue(c.fbRef(c.fbDB,'sisventas/informes'),snap=>received.push(Object.keys(snap.val())));await settled();
 assert.equal(received.length,0);assert.equal(c.SVDataReadiness.statusFor('informes').ready,false);
 c.__moduleAuditSourceControl.release('informes');await settled();assert.deepEqual(received,[['i1','i2']]);
 assert.equal(c.SVDataReadiness.status(['informes']).ready,true);assert.equal(c.__moduleAudit.writes.length,0);
});

test('el fixture permite fallar, reabrir y recuperar sin entregar la callback cancelada',async()=>{
 const c=controlledFixture(),received=[],errors=[];c.__moduleAuditSourceControl.hold(['informes']);
 const ref=c.fbRef(c.fbDB,'sisventas/informes');c.fbOnValue(ref,()=>received.push('antigua'),error=>errors.push(error.message));
 await settled();c.__moduleAuditSourceControl.fail('informes');assert.equal(errors.length,1);assert.equal(c.SVDataReadiness.status(['informes']).errors.length,1);
 c.fbOnValue(ref,()=>received.push('nueva'));c.__moduleAuditSourceControl.release('informes');await settled();
 assert.deepEqual(received,['nueva']);assert.equal(c.SVDataReadiness.status(['informes']).errors.length,0);assert.equal(c.__moduleAudit.writes.length,0);
});

test('el fixture sigue bloqueando servicios externos durante el control de cargas',async()=>{
 const c=controlledFixture();await assert.rejects(c.fetch('https://example.invalid/servicio'),/bloqueado por fixture/);
 assert.equal(c.__moduleAudit.blocked.length,1);assert.equal(c.__moduleAudit.writes.length,0);
});

function appRetry(e){
 Object.assign(e.c,{isAuthenticated:true,permisoModulo:()=>true,svPuedeLeerDominio:()=>true});
 load(e.c,['svReintentarDatosDePagina']);e.root.svReintentarDatosDePagina=e.c.svReintentarDatosDePagina;
}

test('reintentar un timeout real cancela el listener retenido e inicia otro antes de liberar el snapshot',()=>{
 const e=renderedEnvironment();appRetry(e);e.api.beginSource('clientes').ready();
 const old=e.api.begin('https://fixture.invalid/sisventas/informes');let stopped=0,started=1,next;
 e.root._svModuleListeners={informes:()=>{stopped++;old.cancel();delete e.root._svModuleListeners.informes;}};
 e.c.svCargarDatosDePaginaActual=page=>{assert.equal(page,'informes');started++;next=e.api.begin('https://fixture.invalid/sisventas/informes');};
 e.flush();e.timeout();e.retry().onclick();e.flush();
 assert.equal(stopped,1);assert.equal(started,2);assert.equal(e.page.classList.contains('sv-data-pending'),true);assert.equal(e.box().classList.contains('sv-data-error'),false);
 old.ready();e.flush();assert.equal(e.page.classList.contains('sv-data-pending'),true,'La callback anterior no puede liberar la fuente nueva');
 next.ready();e.flush();assert.equal(e.box(),null);assert.deepEqual(e.calls,[]);
});

test('Caja reintenta sólo los movimientos vencidos y conserva el saldo que ya respondió',()=>{
 const e=renderedEnvironment('caja');appRetry(e);
 const balance=e.api.begin('https://fixture.invalid/sisventas/caja/2026-10-18/persona'),movements=e.api.begin('https://fixture.invalid/sisventas/caja/2026-10-18/persona_movs');
 balance.ready();let balanceStops=0,movementStops=0,next;
 e.root._svModuleListeners={cajaPersonal:()=>{balanceStops++;balance.cancel();},cajaMovimientos:()=>{movementStops++;movements.cancel();delete e.root._svModuleListeners.cajaMovimientos;}};
 e.c.svCargarDatosDePaginaActual=page=>{assert.equal(page,'caja');next=e.api.begin('https://fixture.invalid/sisventas/caja/2026-10-18/persona_movs');};
 e.flush();e.timeout();e.retry().onclick();e.flush();assert.equal(balanceStops,0);assert.equal(movementStops,1);
 next.ready();e.flush();assert.equal(e.box(),null);assert.deepEqual(e.calls,[]);
});

test('una fuente global vencida sin baja individual usa la recarga segura sin duplicar su escucha',()=>{
 const e=renderedEnvironment();appRetry(e);e.api.begin('https://fixture.invalid/sisventas/clientes');e.api.beginSource('informes').ready();
 e.c.svCargarDatosDePaginaActual=()=>assert.fail('No reiniciar una bandera de fuente global todavía activa');
 e.flush();e.timeout();e.retry().onclick();assert.deepEqual(e.calls,['reload']);
});

test('Informes, Equipos y Soporte esperan el directorio reducido del técnico antes de habilitar formularios',()=>{
 for(const page of ['informes','equipos','soporte']){
  const e=renderedEnvironment(page,true);e.root.svPuedeLeerDominio=key=>key!=='empleados';
  for(const key of pages[page].filter(key=>key!=='empleados'))e.api.beginSource(key).ready();e.flush();
  assert.deepEqual(Array.from(e.api.statusFor(page).missing),['empleados']);assert.equal(e.page.classList.contains('sv-data-pending'),true);
  e.api.beginSource('empleados').ready();e.flush();assert.equal(e.box(),null);
 }
});

test('la recuperación del directorio reducido funciona sin permiso de lectura de Empleados completo',async()=>{
 for(const page of ['informes','equipos','soporte']){
  const e=renderedEnvironment(page,true);appRetry(e);let requests=0,release,received;
  const allowed=key=>key!=='empleados';e.root.svPuedeLeerDominio=e.c.svPuedeLeerDominio=allowed;
  Object.assign(e.c,{navigator:e.root.navigator,SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},
   AbortController,AbortSignal,CARGOS_DATA:{},console:{error(){}},svCapturarContextoOperacion:()=>()=>true,
   fetch:async()=>{requests++;if(requests===1)throw Error('Error ficticio del directorio reducido');return new Promise(resolve=>release=resolve);},
   _suscribirModuloUnaVez:()=>assert.fail('No leer el nodo completo de Empleados sin permiso')});
  e.root.SVServiceAuth={headers:async()=>({})};
  load(e.c,['svEscucharDirectorioEmpleados','svIniciarLecturaReducida']);
  const start=()=>e.c.svEscucharDirectorioEmpleados(snap=>received=snap.val());
  e.c.svCargarDatosDePaginaActual=target=>{assert.equal(target,page);return start();};
  for(const key of pages[page].filter(key=>key!=='empleados'))e.api.beginSource(key).ready();
  start();await settled();e.flush();assert.equal(e.box().classList.contains('sv-data-error'),true);
  e.retry().onclick();await settled();e.flush();assert.equal(requests,2);assert.equal(e.page.classList.contains('sv-data-pending'),true);
  release({ok:true,json:async()=>({ok:true,empleados:{e:{nombre:'Técnico ficticio'}},cargos:{}})});await settled();e.flush();
  assert.equal(received.e.nombre,'Técnico ficticio');assert.equal(e.box(),null);assert.deepEqual(e.calls,[]);
 }
});

test('Nueva garantía espera clientes, ventas y catálogo aunque ya llegaron las garantías y equipos',()=>{
 const e=renderedEnvironment('garantias');e.api.beginSource('garantias').ready();e.api.beginSource('equipos').ready();e.flush();
 assert.deepEqual(Array.from(e.api.statusFor('garantias').missing),['clientes','ventas','productos']);
 for(const key of ['clientes','ventas'])e.api.beginSource(key).ready();e.flush();assert.equal(e.page.classList.contains('sv-data-pending'),true);
 e.api.beginSource('productos').ready();e.flush();assert.equal(e.box(),null);
});

test('Soporte espera Reclamos, no se libera con Tickets y recupera la escucha real vencida',()=>{
 const e=renderedEnvironment('soporte');appRetry(e);const listeners=[];let renders=0;
 Object.assign(e.c,{SP_DATA:{},SP_MODAL_KEY:null,spRenderLista:()=>renders++,spActualizarMetricas(){},refrescarHistorialClienteLectura(){}});
 e.root.fbDB={};e.root.fbRef=(_,path)=>'https://fixture.invalid/'+path;
 e.root.fbOnValue=(ref,callback)=>{const row={callback,loading:e.api.begin(ref),active:true};listeners.push(row);return()=>{row.active=false;row.loading.cancel();};};
 load(e.c,['_suscribirModuloUnaVez','spCargar']);e.c.svCargarDatosDePaginaActual=page=>{assert.equal(page,'soporte');e.c.spCargar();};
 for(const key of ['clientes','ordenes_trabajo','ventas'])e.api.beginSource(key).ready();e.c.spCargar();e.api.beginSource('tickets').ready();e.flush();
 assert.deepEqual(Array.from(e.api.statusFor('soporte').missing),['reclamos']);assert.equal(e.page.classList.contains('sv-data-pending'),true);
 e.timeout();e.retry().onclick();e.flush();assert.equal(listeners.length,2);assert.equal(listeners[0].active,false);assert.equal(listeners[1].active,true);
 const snapshot={val:()=>({r:{descripcion:'Reclamo ficticio',estado:'nuevo'}})};
 listeners[0].callback(snapshot);listeners[0].loading.ready();e.flush();assert.equal(renders,0);assert.equal(e.page.classList.contains('sv-data-pending'),true);
 listeners[1].callback(snapshot);listeners[1].loading.ready();e.flush();assert.equal(renders,1);assert.equal(e.c.SP_DATA.r.descripcion,'Reclamo ficticio');assert.equal(e.box(),null);
});

test('el estado pendiente vive una sola vez en body y no altera scroll, foco ni bloqueo del documento',()=>{
 const e=renderedEnvironment(),navigation=e.document.createElement('button');e.body.prepend(navigation);navigation.focus();
 e.body.style.overflow='auto';e.page.style.transform='translateY(4px)';e.page.scrollTop=420;
 const box=e.box(),layer=e.document.getElementById('sv-data-status-layer');
 assert.equal(layer.parentNode,e.body);assert.equal(box.parentNode,layer);assert.equal(e.page.querySelector('[data-sv-data-status]'),null);
 assert.equal(e.document.querySelectorAll('[data-sv-data-status]').length,1);assert.equal(e.document.querySelectorAll('[role="status"]').length,1);
 e.api.render();e.flush();assert.equal(e.box(),box);assert.equal(e.document.activeElement,navigation);
 assert.equal(e.body.style.overflow,'auto');assert.equal(e.page.scrollTop,420);assert.equal(e.page.style.transform,'translateY(4px)');
});

test('navegar retira el estado anterior inmediatamente y las respuestas tardías no lo duplican ni lo reabren',()=>{
 const e=renderedEnvironment(),previous=e.retry(),late=e.api.beginSource('informes');
 const other=e.document.createElement('main');other.id='page-productos';other.className='page';e.body.append(other);
 e.api.beginSource('productos').error();e.flush();assert.equal(e.box().dataset.svDataPage,'informes');
 e.page.classList.remove('active');other.classList.add('active');e.document.dispatchEvent({type:'sisventas:page-changed'});
 assert.equal(e.box(),null);assert.equal(e.document.getElementById('sv-data-status-layer'),null);
 e.root.svCargarDatosDePaginaActual=()=>assert.fail('El botón de la página anterior no inicia cargas');previous.onclick();e.flush();
 assert.equal(e.box().dataset.svDataPage,'productos');assert.equal(e.document.querySelectorAll('[role="status"]').length,1);
 late.ready();e.flush();assert.equal(e.box().dataset.svDataPage,'productos');assert.equal(e.document.querySelectorAll('[data-sv-data-status]').length,1);
});

test('un error con datos recibidos mueve la tarjeta real al módulo y deja disponibles sus datos',()=>{
 const e=renderedEnvironment(),box=e.box(),button=e.retry();button.focus();
 e.api.beginSource('clientes').ready();const source=e.api.beginSource('informes');source.ready();source.error();e.flush();
 assert.equal(e.box(),box);assert.equal(box.parentNode,e.page);assert.equal(e.document.getElementById('sv-data-status-layer'),null);
 assert.equal(e.page.classList.contains('sv-data-pending'),false);assert.equal(box.classList.contains('sv-data-error'),true);
 assert.equal(e.retry(),button);assert.equal(e.document.activeElement,button);assert.equal(e.document.querySelectorAll('[role="status"]').length,1);
 source.ready();e.flush();assert.equal(e.box(),null);assert.equal(e.document.querySelectorAll('[role="status"]').length,0);
});

test('el reintento enfocado sobrevive a renderizados del mismo estado sin recrear su tarjeta ni botón',()=>{
 const e=renderedEnvironment();e.api.beginSource('informes').error();e.flush();const box=e.box(),button=e.retry();button.focus();
 for(let index=0;index<3;index++){e.api.render();e.flush();}
 assert.equal(e.box(),box);assert.equal(e.retry(),button);assert.equal(e.document.activeElement,button);
 assert.equal(e.document.querySelectorAll('[role="status"]').length,1);
});

test('cerrar la sesión elimina el portal antes del siguiente frame y la callback pendiente no lo restaura',()=>{
 const e=renderedEnvironment(),source=e.api.beginSource('informes'),old=e.retry();
 e.document.dispatchEvent({type:'sisventas:session-ended'});assert.equal(e.box(),null);assert.equal(e.document.getElementById('sv-data-status-layer'),null);
 e.root.svCargarDatosDePaginaActual=()=>assert.fail('El botón de sesión cerrada no puede reintentar');old.onclick();source.ready();e.flush();
 assert.equal(e.box(),null);assert.equal(e.page.classList.contains('sv-data-pending'),false);
});

test('revocar acceso o terminar la carga retira la capa sin borrar un portal de otra operación',()=>{
 const e=renderedEnvironment(),maintenance=e.document.createElement('div');maintenance.id='maintenance-layer';maintenance.className='sv-load-status-layer';e.body.append(maintenance);
 e.root.permisoModulo=()=>false;e.document.dispatchEvent({type:'sisventas:role-changed'});assert.equal(e.box(),null);e.flush();
 assert.equal(e.document.getElementById('sv-data-status-layer'),null);assert.equal(maintenance.parentNode,e.body);
 assert.equal(e.page.classList.contains('sv-data-pending'),false);
});
