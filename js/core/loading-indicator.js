(function(global) {
  'use strict';
  var pendientes = new Map();
  var secuencia = 0;
  var cartel;
  var solicitudesPantalla = new Set(), bloqueoPantalla = null, solicitandoPantalla = false;
  function liberarBloqueo() {
    var bloqueo = bloqueoPantalla; bloqueoPantalla = null;
    if (bloqueo) Promise.resolve(bloqueo.release()).catch(function() {});
  }
  async function asegurarPantalla() {
    if (!solicitudesPantalla.size || document.visibilityState !== 'visible' || bloqueoPantalla || solicitandoPantalla || !global.navigator?.wakeLock) return;
    solicitandoPantalla = true;
    try {
      var bloqueo = await global.navigator.wakeLock.request('screen');
      if (!solicitudesPantalla.size || document.visibilityState !== 'visible') { await bloqueo.release(); return; }
      bloqueoPantalla = bloqueo;
      bloqueo.addEventListener('release', function() { if (bloqueoPantalla === bloqueo) bloqueoPantalla = null; });
    } catch (_) { /* Unsupported or denied: the operation must keep running. */ }
    finally { solicitandoPantalla = false; }
  }
  function mantenerPantallaActiva() {
    var id = {}; solicitudesPantalla.add(id); asegurarPantalla();
    return function() { solicitudesPantalla.delete(id); if (!solicitudesPantalla.size) liberarBloqueo(); };
  }
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') asegurarPantalla(); else liberarBloqueo();
  });
  document.addEventListener('sisventas:session-ended', function() {
    solicitudesPantalla.clear(); liberarBloqueo(); pendientes.clear(); if (cartel) actualizar();
  });

  function actualizar() {
    if (!cartel) {
      cartel = document.createElement('div');
      cartel.id = 'sv-cargando';
      cartel.className = 'sv-cargando';
      cartel.setAttribute('role', 'status');
      cartel.setAttribute('aria-live', 'polite');
      cartel.setAttribute('aria-atomic', 'true');
      cartel.innerHTML = '<div class="sv-cargando-cartel"><i class="ti ti-loader-2" aria-hidden="true"></i><span></span></div>';
      document.body.appendChild(cartel);
    }
    cartel.hidden = pendientes.size === 0;
    var mensajes = Array.from(pendientes.values());
    cartel.querySelector('span').textContent = mensajes.length ? mensajes[mensajes.length - 1].mensaje : '';
  }
  function mostrar(mensaje, opciones) {
    var id = ++secuencia;
    pendientes.set(id, {mensaje:String(mensaje || 'Cargando…'), persistir:!!(opciones && opciones.persistirAlNavegar)});
    actualizar();
    // Cada operación cierra únicamente su aviso, incluso si hay otras en curso.
    var cerrar = function() { pendientes.delete(id); actualizar(); };
    cerrar.actualizar = function(texto) {
      var operacion = pendientes.get(id);
      if (operacion) { operacion.mensaje = String(texto || 'Cargando…'); actualizar(); }
    };
    return cerrar;
  }
  function antesDeProcesar() {
    return new Promise(function(resolve) { requestAnimationFrame(function() { setTimeout(resolve, 0); }); });
  }
  async function ejecutar(mensaje, tarea) {
    var cerrar = mostrar(mensaje);
    try { await antesDeProcesar(); return await tarea(); }
    finally { cerrar(); }
  }
  var acciones = new Set(), tareas = new Map(), regiones = new Map();
  var textos = {cargar:'Cargando…',buscar:'Buscando…',guardar:'Guardando…',eliminar:'Eliminando…',procesar:'Procesando…'};
  function escapar(texto) { return String(texto).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function estado(texto) {
    return '<span class="sv-operation-status" role="status" aria-live="polite"><span class="sv-operation-spinner" aria-hidden="true"></span><span>'+escapar(texto||textos.cargar)+'</span></span>';
  }
  function contexto() { return {uid:global.currentUserUid,user:global.fbAuth?.currentUser,role:global.currentRole,epoch:global._svOperacionesSesionEpoch||0}; }
  function mismoContexto(c) { return c.uid===global.currentUserUid&&c.user===global.fbAuth?.currentUser&&c.role===global.currentRole&&c.epoch===(global._svOperacionesSesionEpoch||0); }
  function iniciar(opciones) {
    opciones=opciones||{};var c=contexto(),activo=true,boton=opciones.boton,region=opciones.region;
    var texto=String(opciones.texto||textos[opciones.tipo]||textos.cargar),aviso=null,original=null,etiqueta=null,contenido=null,estilos=null,inputValue=null,htmlOriginal=null,htmlPropio=null,marca=null,checkboxActivo=false;
    var disabled=opciones.deshabilitadoInicial??boton?.disabled,aria=boton?.getAttribute?.('aria-busy'),label=boton?.getAttribute?.('aria-label');
    var restaurarDisabled=boton?.disabled===disabled;
    if(region?.setAttribute){var r=regiones.get(region);if(!r){r={anterior:region.getAttribute('aria-busy'),operaciones:new Set()};regiones.set(region,r);}r.operaciones.add(cerrar);region.setAttribute('aria-busy','true');}
    if(boton?.appendChild&&opciones.conservarIndicador!==true){
      var rect=boton.getBoundingClientRect?.();estilos={};
      if(rect?.width>0&&rect?.height>0){for(var k of ['width','height','boxSizing','maxWidth','position'])estilos[k]={antes:boton.style[k],durante:boton.style[k]};
        for(var [k,v]of Object.entries({width:rect.width+'px',height:rect.height+'px',boxSizing:'border-box',maxWidth:'100%'})){boton.style[k]=v;estilos[k].durante=boton.style[k];}
        if(global.getComputedStyle?.(boton).position==='static'){boton.style.position='relative';estilos.position.durante='relative';}}
      if(boton.tagName==='INPUT'&&boton.type==='checkbox'){checkboxActivo=true;aviso=mostrar(texto,{persistirAlNavegar:opciones.persistirAlNavegar===true});}else if(boton.tagName==='INPUT'){inputValue=boton.value;boton.value=texto;}else{
        htmlOriginal=boton.innerHTML;marca='sv-action-'+(++secuencia);
        original=Array.from(boton.childNodes);contenido=document.createElement('span');contenido.className='sv-operation-original';contenido.setAttribute('aria-hidden','true');contenido.setAttribute('data-sv-operation-owner',marca);
        original.forEach(function(n){contenido.appendChild(n);});etiqueta=document.createElement('span');etiqueta.className='sv-operation-button-status';etiqueta.setAttribute('data-sv-operation-owner',marca);
        var spinner=document.createElement('span');spinner.className='sv-operation-spinner';spinner.setAttribute('aria-hidden','true');var mensaje=document.createElement('span');mensaje.className='sv-operation-text';mensaje.textContent=texto;etiqueta.append(spinner,mensaje);
        boton.append(contenido,etiqueta);htmlPropio=boton.innerHTML;if((rect?.width||0)<72)boton.classList.add('sv-operation-compact');}
      boton.classList.add('sv-operation-busy');
      boton.disabled=true;boton.setAttribute('aria-busy','true');boton.setAttribute('aria-label',texto);
    }else if(!boton&&opciones.conservarIndicador!==true)aviso=mostrar(texto,{persistirAlNavegar:opciones.persistirAlNavegar===true});
    function cerrar() {
      if(!activo)return;activo=false;acciones.delete(cerrar);aviso?.();
      if(region){var r=regiones.get(region);r?.operaciones.delete(cerrar);if(r&&!r.operaciones.size){if(r.anterior===null)region.removeAttribute('aria-busy');else region.setAttribute('aria-busy',r.anterior);regiones.delete(region);}}
      if(boton&&(contenido||inputValue!==null||checkboxActivo)){
        // Respect a caller that replaced the button after an error or a new view.
        var contenidoActual=contenido,etiquetaActual=etiqueta;
        // Legacy progress handlers may restore an exact serialized copy of our nodes.
        // A unique owner plus exact markup prevents overwriting a caller's new content.
        if(htmlPropio!==null&&boton.innerHTML===htmlPropio){
          contenidoActual=Array.from(boton.children).find(function(n){return n.classList.contains('sv-operation-original')&&n.getAttribute('data-sv-operation-owner')===marca;});
          etiquetaActual=Array.from(boton.children).find(function(n){return n.classList.contains('sv-operation-button-status')&&n.getAttribute('data-sv-operation-owner')===marca;});
        }
        if(contenidoActual?.parentNode===boton&&etiquetaActual?.parentNode===boton){etiquetaActual.remove();for(var n of original)boton.insertBefore(n,contenidoActual);contenidoActual.remove();if(restaurarDisabled&&mismoContexto(c))boton.disabled=!!disabled;}
        if(htmlPropio!==null)for(var campo of ['textoOriginal','textoOriginalProceso'])if(boton.dataset[campo]===htmlPropio)boton.dataset[campo]=htmlOriginal;
        if(checkboxActivo&&restaurarDisabled&&mismoContexto(c))boton.disabled=!!disabled;
        if(inputValue!==null&&boton.value===texto){boton.value=inputValue;if(restaurarDisabled&&mismoContexto(c))boton.disabled=!!disabled;}
        for(var [k,v]of Object.entries(estilos||{}))if(boton.style[k]===v.durante)boton.style[k]=v.antes;
        boton.classList.remove('sv-operation-busy','sv-operation-compact');
        if(boton.getAttribute('aria-busy')==='true'){if(aria===null)boton.removeAttribute('aria-busy');else boton.setAttribute('aria-busy',aria);}
        if(boton.getAttribute('aria-label')===texto){if(label===null)boton.removeAttribute('aria-label');else boton.setAttribute('aria-label',label);}
      }
    }
    cerrar.actualizar=function(nuevo){if(!activo)return;texto=String(nuevo||textos.cargar);aviso?.actualizar(texto);if(checkboxActivo)boton.setAttribute('aria-label',texto);if(inputValue!==null){boton.value=texto;boton.setAttribute('aria-label',texto);}if(etiqueta?.parentNode===boton){etiqueta.querySelector('.sv-operation-text').textContent=texto;boton.setAttribute('aria-label',texto);}};
    cerrar.vigente=function(){return activo&&mismoContexto(c);};acciones.add(cerrar);return cerrar;
  }
  function ejecutarAccion(opciones,tarea) {
    opciones=opciones||{};var c=contexto(),clave=opciones.clave,previa=clave&&tareas.get(clave);
    if(previa&&mismoContexto(previa.contexto))return previa.tarea;
    var cerrar=iniciar(opciones),resultado;
    try{resultado=tarea();}catch(error){cerrar();throw error;}
    var entrada={contexto:c,tarea:null};entrada.tarea=Promise.resolve(resultado).finally(function(){cerrar();if(clave&&tareas.get(clave)===entrada)tareas.delete(clave);});if(clave)tareas.set(clave,entrada);return entrada.tarea;
  }
  ['sisventas:session-ended','sisventas:role-changed'].forEach(function(nombre){document.addEventListener(nombre,function(){Array.from(acciones).forEach(function(cerrar){cerrar();});tareas.clear();});});
  document.addEventListener('sisventas:page-changed', function() {
    pendientes.forEach(function(operacion, id) { if (!operacion.persistir) pendientes.delete(id); });
    if (cartel) actualizar();
  });
  global.SisVentas = global.SisVentas || {};
  global.SisVentas.carga = { mostrar:mostrar, ejecutar:ejecutar, mantenerPantallaActiva:mantenerPantallaActiva,estado:estado,iniciar:iniciar,ejecutarAccion:ejecutarAccion };
})(window);
