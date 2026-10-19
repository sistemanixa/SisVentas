(function(global){
  'use strict';
  var states={},generation=0,scheduled=false,deadlineTimer=null,sessionActive=false;
  var waitLimit=15000;
  var demandPages=['informes','equipos','garantias','soporte','remitos','servicios','agenda','caja','historialcliente'];
  var dependencies={
    dashboard:['clientes','productos','ventas','pagos'],
    productos:['productos'],catalogo:['productos'],actualizadorprecios:['productos','proveedores'],
    clientes:['clientes'],venta:['clientes','productos','ventas'],presupuesto:['clientes','productos','presupuestos'],
    detalle:['ventas','clientes','pagos'],cobranzas:['ventas','clientes','pagos'],cuentacorriente:['ventas','clientes','pagos'],
    gastos:['gastos','empleados'],comisiones:['gastos','empleados','ventas'],
    ordentrabajo:['ordenes_trabajo','clientes','productos'],
    balancecompra:['ventas','presupuestos','productos','proveedores'],ordenes:['productos','proveedores'],
    proveedores:['proveedores'],empleados:['empleados'],usuarios:['usuarios'],
    informes:['informes','clientes','empleados'],equipos:['equipos','clientes','empleados'],garantias:['garantias','equipos','clientes','ventas','productos'],
    soporte:['reclamos','clientes','ordenes_trabajo','ventas','empleados'],remitos:['remitos','clientes'],servicios:['servicios','clientes'],
    agenda:['agenda','ordenes_trabajo'],caja:['caja'],
    historialcliente:['clientes','ventas','pagos','presupuestos','ordenes_trabajo','equipos','tickets','reclamos']
  };
  var labels={ordenes_trabajo:'órdenes de trabajo',pagos:'cobros',empleados:'directorio de empleados',proveedores:'directorio de proveedores',equipos:'equipos instalados',garantias:'garantías',tickets:'tickets de soporte',caja:'caja del día'};
  function requirements(page){
    var keys=(dependencies[page]||[]).slice();
    if(page==='dashboard') {
      // Una lectura compartida puede estar autorizada por otra pantalla sin
      // que ninguna tarjeta visible del inicio la necesite.
      var can=typeof global.tienePermiso==='function'?global.tienePermiso:function(){return false;};
      keys=[];
      if(can('dashboard.metricasGlobales')||can('dashboard.rentabilidad'))keys.push('clientes','productos','ventas','pagos');
      if(can('ventas.verDashboard'))keys.push('clientes','ventas','pagos');
      if(can('dashboard.grafico')||can('dashboard.miActividad'))keys.push('clientes','ventas');
      keys=Array.from(new Set(keys)).filter(function(key){return typeof global.svPuedeLeerDominio==='function'&&global.svPuedeLeerDominio(key);});
    }
    // El historial combina módulos con permisos distintos. Una fuente que el
    // rol no puede consultar tampoco puede retener su pantalla en "Cargando".
    // Empleados y Proveedores conservan sus directorios reducidos autorizados.
    if(demandPages.includes(page)&&typeof global.svPuedeLeerDominio==='function')keys=keys.filter(function(key){
      return global.svPuedeLeerDominio(key)||(key==='empleados'&&['informes','equipos','soporte'].includes(page)&&(typeof global.permisoModulo!=='function'||global.permisoModulo(page)));
    });
    return keys;
  }
  function ensure(key){
    if(!states[key])states[key]={ready:false,sources:new Set(),since:Date.now(),timeout:false,failure:false};
    return states[key];
  }
  function failed(state){return !!state&&(state.timeout||state.failure||Array.from(state.sources).some(function(source){return source.error;}));}
  function collection(reference){
    try{var path=new URL(String(reference)).pathname;if(/^\/sv_usuarios\/?$/.test(path))return 'usuarios';if(/^\/sisventas\/caja\/\d{4}-\d{2}-\d{2}(?:\/[^/]+)?\/?$/.test(path))return 'caja';var match=path.match(/^\/sisventas\/([^/]+)\/?$/);return match?decodeURIComponent(match[1]):'';}catch(_){return '';}
  }
  function status(keys){
    var missing=keys.filter(function(k){return !states[k]||!states[k].ready;});
    var errors=keys.filter(function(k){return failed(states[k]);});
    return {ready:!missing.length,missing:missing,errors:errors};
  }
  function statusFor(page){return status(requirements(page));}
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;render();});}
  function begin(reference){
    return beginSource(collection(reference),String(reference));
  }
  function beginSource(key,reference){
    var epoch=generation,active=true;
    if(!key)return {ready:function(){},error:function(){},cancel:function(){}};
    var state=ensure(key),source={ready:false,error:false,reference:reference||''};
    state.sources.add(source);state.timeout=false;state.failure=false;state.since=Date.now();schedule();
    function finish(error){
      if(!active||epoch!==generation)return;
      source.error=error;
      if(!error){source.ready=true;state.timeout=false;}
      // Consultas propias combinadas: una respuesta no completa la colección
      // hasta que todas las fuentes registradas entregaron su primer resultado.
      if(Array.from(state.sources).every(function(item){return item.ready;})){state.ready=true;state.failure=false;}
      schedule();
    }
    return {ready:function(){finish(false);},error:function(){finish(true);},cancel:function(){if(!active||epoch!==generation)return;active=false;if(source.error)state.failure=true;state.sources.delete(source);schedule();}};
  }
  function checkDeadlines(){
    deadlineTimer=null;
    var now=Date.now(),next=Infinity,changed=false;
    Object.keys(states).forEach(function(key){
      var state=states[key];
      if(state.ready||failed(state))return;
      var remaining=waitLimit-(now-state.since);
      if(remaining<=0){state.timeout=true;changed=true;}
      else next=Math.min(next,remaining);
    });
    if(next!==Infinity)deadlineTimer=global.setTimeout(function(){checkDeadlines();schedule();},next);
    return changed;
  }
  function armDeadlines(){
    if(typeof global.setTimeout!=='function')return;
    if(deadlineTimer!==null)global.clearTimeout(deadlineTimer);
    if(checkDeadlines())schedule();
  }
  function render(){
    Object.keys(dependencies).forEach(function(name){
      var page=document.getElementById('page-'+name);if(!page)return;
      var allowed=typeof global.permisoModulo!=='function'||global.permisoModulo(name);
      var keys=sessionActive&&allowed?requirements(name):[];
      if(sessionActive&&page.classList.contains('active'))keys.forEach(ensure);
      var state=status(keys),box=page.querySelector('[data-sv-data-status]');
      var show=!state.ready||state.errors.length>0;
      page.classList.toggle('sv-data-pending',!state.ready);
      page.setAttribute('aria-busy',String(!state.ready&&!state.errors.length));
      if(!show){if(box)box.remove();return;}
      if(!box){box=document.createElement('div');box.dataset.svDataStatus='1';box.className='sv-data-status';box.setAttribute('role','status');box.setAttribute('aria-live','polite');page.prepend(box);}
      box.classList.toggle('sv-data-error',!!state.errors.length);
      box.replaceChildren();
      var title=document.createElement('strong'),detail=document.createElement('span');
      title.textContent=state.errors.length?'No se pudieron cargar todos los datos':global.navigator.onLine===false?'Sin conexión. Esperando los datos…':'Cargando datos…';
      detail.textContent=state.errors.length?'No se pudieron completar '+state.errors.map(function(k){return labels[k]||k;}).join(', ')+'. '+(state.ready?'Se conserva la información recibida. Revisá la conexión y volvé a intentar.':'No se puede determinar todavía si hay registros. Revisá la conexión y volvé a intentar.'):'Esperando '+state.missing.map(function(k){return labels[k]||k;}).join(', ')+'. La información aparecerá al completar la carga.';
      box.append(title,detail);
      var retry=document.createElement('button');retry.className='btn btn-sm';retry.textContent='Reintentar carga';retry.onclick=function(){
        if(!sessionActive||!page.classList.contains('active')||(typeof global.permisoModulo==='function'&&!global.permisoModulo(name)))return;
        function report(){global.notify?.('No se pudo reintentar la carga. Revisá la conexión y volvé a intentar.');schedule();}
        try{
          // Una recuperación explícita conserva página, filtros y formulario.
          // Sólo las pantallas a demanda tienen su mapa completo en la app.
          if(demandPages.includes(name)&&typeof global.svReintentarDatosDePagina==='function'){
            var errors=status(requirements(name)).errors;
            var timedOut=errors.filter(function(key){return states[key]?.timeout;});
            var references=[];errors.forEach(function(key){Array.from(states[key]?.sources||[]).forEach(function(source){if(source.reference&&(source.error||(states[key].timeout&&!source.ready)))references.push({key:key,reference:source.reference});});});
            Promise.resolve(global.svReintentarDatosDePagina(name,{errors:errors,timedOut:timedOut,references:references})).catch(report);
          }
          else if(demandPages.includes(name)&&typeof global.svCargarDatosDePaginaActual==='function')Promise.resolve(global.svCargarDatosDePaginaActual(name)).catch(report);
          else if(typeof global.fbSincronizarAhora==='function')Promise.resolve(global.fbSincronizarAhora()).catch(report);
          else global.location.reload();
        }catch(_){report();}
      };box.append(retry);
    });
    armDeadlines();
    document.dispatchEvent(new CustomEvent('sisventas:data-state-changed'));
  }
  function reset(){generation++;states={};sessionActive=false;if(deadlineTimer!==null&&typeof global.clearTimeout==='function')global.clearTimeout(deadlineTimer);deadlineTimer=null;schedule();}
  document.addEventListener('sisventas:session-ended',reset);
  document.addEventListener('sisventas:session-ready',function(){sessionActive=true;schedule();});
  document.addEventListener('sisventas:page-changed',schedule);
  document.addEventListener('sisventas:role-changed',schedule);
  document.addEventListener('visibilitychange',schedule);
  document.addEventListener('DOMContentLoaded',function(){
    var style=document.createElement('style');style.textContent='.sv-data-pending{position:relative;min-height:260px}.sv-data-pending>:not([data-sv-data-status]){visibility:hidden;pointer-events:none}.sv-data-status{display:flex;flex-direction:column;gap:10px;padding:24px;margin-bottom:16px;border:1px solid var(--border2);border-radius:14px;background:var(--bg2);color:var(--text);line-height:1.6}.sv-data-status span{font-size:13px;color:var(--text3)}.sv-data-status button{align-self:flex-start}.sv-data-pending>.sv-data-status{position:absolute;inset:0 0 auto;z-index:2}.sv-data-status strong::before{content:"";display:inline-block;width:14px;height:14px;margin-right:10px;border:2px solid var(--border2);border-top-color:var(--blue);border-radius:50%;animation:spin 1s linear infinite}.sv-data-error strong::before{display:none}';document.head.append(style);schedule();
  });
  global.addEventListener('online',schedule);global.addEventListener('offline',schedule);
  global.SVDataReadiness={begin:begin,beginSource:beginSource,status:status,statusFor:statusFor,requirementsFor:requirements,reset:reset,render:schedule};
})(window);
