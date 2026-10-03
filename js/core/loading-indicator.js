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
  document.addEventListener('sisventas:page-changed', function() {
    pendientes.forEach(function(operacion, id) { if (!operacion.persistir) pendientes.delete(id); });
    if (cartel) actualizar();
  });
  global.SisVentas = global.SisVentas || {};
  global.SisVentas.carga = { mostrar:mostrar, ejecutar:ejecutar, mantenerPantallaActiva:mantenerPantallaActiva };
})(window);
