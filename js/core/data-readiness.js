(function(global){
  'use strict';
  function ensureLoadingStatusStyle(){
    if(!document.head||typeof document.head.appendChild!=='function'||typeof document.createElement!=='function')return;
    try{
      // Un índice anterior puede recibir este JS actualizado sin el nuevo link.
      // Resolver sólo el activo estático conocido, también bajo un subdirectorio.
      var base=document.baseURI||global.location?.href,script=document.currentScript?.src;
      var scriptUrl=script?new URL(script,base):null;
      var fromScript=scriptUrl&&/^https?:$/.test(scriptUrl.protocol)&&/\/js\/core\/data-readiness\.js$/.test(scriptUrl.pathname)&&(!base||scriptUrl.origin===new URL(base).origin);
      var url=new URL(fromScript?'../../css/loading-status.css?v=3.13.1':'./css/loading-status.css?v=3.13.1',fromScript?scriptUrl:base);
      if(!/^https?:$/.test(url.protocol))return;
      var links=document.querySelectorAll?.('link[rel~="stylesheet"][href]')||[];
      for(var link of links){
        try{var existing=new URL(link.href||link.getAttribute('href'),base||new URL('../',url));if(existing.origin===url.origin&&existing.pathname===url.pathname)return;}catch(_){}
      }
      if(document.getElementById?.('sv-loading-status-style'))return;
      var style=document.createElement('link');style.id='sv-loading-status-style';style.rel='stylesheet';style.href=url.href;document.head.appendChild(style);
    }catch(_){/* Un DOM parcial sin URL/base no debe impedir la carga de datos. */}
  }
  ensureLoadingStatusStyle();
  function createScreenLoading(){
    var owners=new Map(),observer=null,sequence=0;
    function visible(node){
      if(!node||node.isConnected===false)return false;
      for(var current=node;current;current=current.parentElement||current.parentNode){
        if(current.hidden||current.style?.display==='none'||(current.classList?.contains('page')&&!current.classList.contains('active')))return false;
      }
      return true;
    }
    function prune(){Array.from(owners.values()).forEach(function(entry){if(!visible(entry.host)||!visible(entry.container)||entry.layer.isConnected===false)entry.close();});}
    function watch(){
      if(observer||!global.MutationObserver||!document.body)return;
      observer=new global.MutationObserver(prune);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','style']});
    }
    function reset(){Array.from(owners.values()).forEach(function(entry){entry.close();});}
    function start(host,title,options){
      options=options||{};var container=options.container||document.body;
      if(!visible(host)||!visible(container)||typeof container.appendChild!=='function'||typeof document.createElement!=='function')return function(){};
      owners.get(host)?.close();
      var layer=document.createElement('div'),card=document.createElement('div'),heading=document.createElement('strong');
      layer.id='sv-screen-loading-'+(++sequence);layer.className='sv-load-status-layer';card.className='sv-data-status';
      card.setAttribute('role','status');card.setAttribute('aria-live','polite');card.setAttribute('aria-atomic','true');heading.textContent=String(title||'Cargando…');
      card.appendChild(heading);layer.appendChild(card);container.appendChild(layer);
      var entry={host:host,container:container,layer:layer,closed:false,close:null};
      entry.close=function(){
        if(entry.closed)return;entry.closed=true;
        if(owners.get(entry.host)===entry)owners.delete(entry.host);entry.layer.remove();
        entry.host=entry.container=entry.layer=null;
        if(!owners.size&&observer){observer.disconnect();observer=null;}
      };
      owners.set(host,entry);watch();return entry.close;
    }
    ['sisventas:page-changed','sisventas:role-changed','sisventas:session-ready','sisventas:session-ended'].forEach(function(name){document.addEventListener(name,reset);});
    return {start:start,reset:reset};
  }
  var screenLoading=global.SVScreenLoading=global.SVScreenLoading||createScreenLoading();
  var states={},generation=0,scheduled=false,deadlineTimer=null,sessionActive=false,startupHolds=new Set();
  var statusLayer=null,statusBox=null,statusTitle=null,statusDetail=null,statusRetry=null;
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
      if(can('dashboard.rentabilidad'))keys.push('gastos');
      keys=Array.from(new Set(keys)).filter(function(key){return typeof global.svPuedeLeerDominio==='function'&&global.svPuedeLeerDominio(key);});
    }
    if (page === 'dashboard' && typeof global.svPlanInicioDashboard === 'function') {
      var demand = global.svPlanInicioDashboard();
      if (demand) {
        var canonical = demand.sources.map(function(source){ return source === 'ordenesTrabajo' ? 'ordenes_trabajo' : source; });
        keys = keys.filter(function(key){ return canonical.includes(key); });
      }
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
  function holdStartup(){
    var token={},epoch=generation,released=false;startupHolds.add(token);clearStatus();schedule();
    return function(){
      if(released)return;released=true;
      if(epoch!==generation||!startupHolds.delete(token))return;
      // Los nodos aún no solicitados no consumen su plazo durante permisos.
      Object.keys(states).forEach(function(key){var state=states[key];if(!state.ready&&!state.sources.size&&!state.failure){state.since=Date.now();state.timeout=false;}});
      schedule();
    };
  }
  function presentation(state){
    var title=state.errors.length?'No se pudieron cargar todos los datos':state.ready?'Datos listos':global.navigator.onLine===false?'Sin conexión. Esperando los datos…':'Cargando datos…';
    var detail=state.errors.length?'No se pudieron completar '+state.errors.map(function(k){return labels[k]||k;}).join(', ')+'. '+(state.ready?'Se conserva la información recibida. Revisá la conexión y volvé a intentar.':'Revisá la conexión y volvé a intentar.'):state.ready?'': 'Esperando '+state.missing.map(function(k){return labels[k]||k;}).join(', ')+'.';
    return {title:title,detail:detail};
  }
  // El arranque y la pantalla visible observan el mismo estado. No hay otro
  // reloj que declare un ingreso completo mientras las fuentes siguen pendientes.
  function waitForPage(page,options){
    options=options||{};
    var epoch=generation,events=['sisventas:data-state-changed','sisventas:page-changed','sisventas:role-changed','sisventas:session-ended'];
    return new Promise(function(resolve){
      var settled=false,last='';
      function finish(result){
        if(settled)return;settled=true;
        events.forEach(function(name){document.removeEventListener?.(name,check);});
        options.signal?.removeEventListener?.('abort',cancel);
        resolve(result);
      }
      function cancel(){finish({ready:false,missing:[],errors:[],cancelled:true});}
      function check(){
        if(settled)return;
        var name,current;
        try{current=!options.isCurrent||options.isCurrent()===true;name=typeof page==='function'?page():page;}catch(_){cancel();return;}
        if(epoch!==generation||!sessionActive||options.signal?.aborted||!current){cancel();return;}
        if(!name||(typeof global.permisoModulo==='function'&&!global.permisoModulo(name))){cancel();return;}
        var keys=requirements(name);keys.forEach(ensure);
        var state=status(keys),copy={page:name,ready:state.ready,missing:state.missing.slice(),errors:state.errors.slice(),total:keys.length,received:keys.length-state.missing.length};
        Object.assign(copy,presentation(state));
        var signature=JSON.stringify(copy);
        if(signature!==last){
          last=signature;
          // Un fallo al pintar el progreso no debe alterar el resultado de la lectura.
          try{options.onState?.(copy);}catch(_){global.console?.warn?.('[Carga inicial] No se pudo actualizar el progreso');}
        }
        if(state.ready||state.errors.length)finish(copy);
      }
      events.forEach(function(name){document.addEventListener(name,check);});
      options.signal?.addEventListener?.('abort',cancel,{once:true});
      check();if(!settled)schedule();
    });
  }
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
  function clearStatus(){
    if(statusBox)statusBox.remove();
    if(statusLayer)statusLayer.remove();
    statusLayer=statusBox=statusTitle=statusDetail=statusRetry=null;
  }
  function mountStatus(page,name,state){
    if(!document.body)return;
    if(!statusBox){
      statusBox=document.createElement('div');statusBox.dataset.svDataStatus='1';statusBox.className='sv-data-status';
      statusBox.setAttribute('role','status');statusBox.setAttribute('aria-live','polite');statusBox.setAttribute('aria-atomic','true');
      statusTitle=document.createElement('strong');statusDetail=document.createElement('span');statusRetry=document.createElement('button');
      statusRetry.className='btn btn-sm';statusRetry.textContent='Reintentar carga';statusBox.append(statusTitle,statusDetail,statusRetry);
    }
    statusBox.dataset.svDataPage=name;
    statusBox.classList.toggle('sv-data-error',!!state.errors.length);
    var text=presentation(state);
    if(statusTitle.textContent!==text.title)statusTitle.textContent=text.title;
    if(statusDetail.textContent!==text.detail)statusDetail.textContent=text.detail;
    statusRetry.onclick=function(){
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
    };
    var focused=statusBox.contains(document.activeElement)?document.activeElement:null;
    if(!state.ready){
      // Fuera de .page: sus animaciones/transformaciones no pueden cambiar
      // el centro del viewport. La tarjeta es la misma, nunca una copia.
      if(!statusLayer){statusLayer=document.createElement('div');statusLayer.id='sv-data-status-layer';statusLayer.className='sv-load-status-layer';document.body.append(statusLayer);}
      if(statusBox.parentNode!==statusLayer)statusLayer.append(statusBox);
    }else{
      // Con datos previos el aviso de error convive con el contenido disponible.
      if(statusBox.parentNode!==page)page.prepend(statusBox);
      if(statusLayer){statusLayer.remove();statusLayer=null;}
    }
    if(focused&&document.activeElement!==focused)focused.focus({preventScroll:true});
  }
  function render(){
    var visible=null,held=startupHolds.size>0;
    Object.keys(dependencies).forEach(function(name){
      var page=document.getElementById('page-'+name);if(!page)return;
      var allowed=typeof global.permisoModulo!=='function'||global.permisoModulo(name);
      var keys=sessionActive&&allowed&&!held?requirements(name):[];
      if(sessionActive&&page.classList.contains('active'))keys.forEach(ensure);
      var state=status(keys);
      var show=!state.ready||state.errors.length>0;
      page.classList.toggle('sv-data-pending',!state.ready);
      page.setAttribute('aria-busy',String(!state.ready&&!state.errors.length));
      if(show&&sessionActive&&allowed&&page.classList.contains('active'))visible={page:page,name:name,state:state};
    });
    if(visible)mountStatus(visible.page,visible.name,visible.state);else clearStatus();
    if(held){if(deadlineTimer!==null)global.clearTimeout(deadlineTimer);deadlineTimer=null;}else armDeadlines();
    document.dispatchEvent(new CustomEvent('sisventas:data-state-changed'));
  }
  function reset(){generation++;states={};startupHolds.clear();sessionActive=false;clearStatus();screenLoading.reset();if(deadlineTimer!==null&&typeof global.clearTimeout==='function')global.clearTimeout(deadlineTimer);deadlineTimer=null;schedule();}
  document.addEventListener('sisventas:session-ended',reset);
  document.addEventListener('sisventas:session-ready',function(){sessionActive=true;schedule();});
  document.addEventListener('sisventas:page-changed',function(){clearStatus();schedule();});
  document.addEventListener('sisventas:role-changed',function(){clearStatus();schedule();});
  document.addEventListener('visibilitychange',schedule);
  document.addEventListener('DOMContentLoaded',schedule);
  global.addEventListener('online',schedule);global.addEventListener('offline',schedule);
  global.SVDataReadiness={begin:begin,beginSource:beginSource,status:status,statusFor:statusFor,requirementsFor:requirements,holdStartup:holdStartup,waitForPage:waitForPage,reset:reset,render:schedule};
})(window);
