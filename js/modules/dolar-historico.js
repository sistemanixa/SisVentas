/* v1.36.3 — Histórico horario del dólar */
(function(){
  'use strict';

  var INTERVALO_MS = 60 * 60 * 1000;
  var timer = null;
  var cargando = false;
  var historial = [], pagina = 0, pageSize = 25;
  var sesionActiva = true, generacion = 0, cargaPendiente = null, cargaProgramada = null;
  var controladores = new Set();

  function sesionDisponible(){
    return !!(sesionActiva && window.fbAuth && window.fbAuth.currentUser && !document.body.classList.contains('sv-sesion-cerrada'));
  }
  function capturarContexto(){
    var rol = window.currentRole;
    return {generacion:generacion, usuario:window.fbAuth && window.fbAuth.currentUser, uid:window.currentUserUid,
      rol:rol, revision:window.PERMISOS_ROLES?.[rol]?.indiceRevision, vista:window._impersonacionOriginal,
      autenticado:typeof isAuthenticated === 'undefined' ? undefined : isAuthenticated};
  }
  function contextoVigente(contexto){
    return sesionDisponible() && contexto.generacion === generacion && contexto.usuario === window.fbAuth.currentUser &&
      contexto.uid === window.currentUserUid && contexto.rol === window.currentRole &&
      contexto.revision === window.PERMISOS_ROLES?.[contexto.rol]?.indiceRevision && contexto.vista === window._impersonacionOriginal &&
      contexto.autenticado !== false && contexto.autenticado === (typeof isAuthenticated === 'undefined' ? undefined : isAuthenticated) &&
      (!contexto.uid || !contexto.usuario.uid || contexto.uid === contexto.usuario.uid);
  }
  function nuevoControlador(){
    var controlador = typeof AbortController === 'function' ? new AbortController() : null;
    if(controlador) controladores.add(controlador);
    return controlador;
  }
  function errorCancelado(){ return Object.assign(new Error('Carga cancelada'), {name:'AbortError'}); }
  function esperarResultado(promesa, signal){
    if(!signal) return Promise.resolve(promesa);
    return new Promise(function(resolve,reject){
      function limpiar(){signal.removeEventListener('abort', cancelar);}
      function cancelar(){limpiar();reject(errorCancelado());}
      Promise.resolve(promesa).then(function(value){limpiar();resolve(value);},function(error){limpiar();reject(error);});
      if(signal.aborted){cancelar();return;}
      signal.addEventListener('abort', cancelar, {once:true});
    });
  }
  function esperarVisible(signal){
    if(window.SVForegroundSession?.waitVisible) return window.SVForegroundSession.waitVisible({signal:signal});
    if(signal?.aborted) return Promise.reject(errorCancelado());
    if(document.hidden !== true && document.visibilityState !== 'hidden') return Promise.resolve();
    return new Promise(function(resolve,reject){
      function limpiar(){document.removeEventListener('visibilitychange', revisar);signal?.removeEventListener('abort',cancelar);}
      function revisar(){if(document.hidden !== true && document.visibilityState !== 'hidden'){limpiar();resolve();}}
      function cancelar(){limpiar();reject(errorCancelado());}
      document.addEventListener('visibilitychange',revisar);signal?.addEventListener('abort',cancelar,{once:true});
    });
  }
  function invalidarCargas(){
    generacion++;
    if(cargaProgramada !== null) clearTimeout(cargaProgramada); cargaProgramada = null;
    controladores.forEach(function(controlador){controlador.abort();}); controladores.clear();
    cargaPendiente = null; cargando = false;
    estado('');
  }
  function programarCarga(demora){
    if(cargaProgramada !== null) clearTimeout(cargaProgramada);
    var contexto = capturarContexto();
    cargaProgramada = setTimeout(function(){
      cargaProgramada = null;
      if(contextoVigente(contexto)) cargar();
    }, demora);
  }

  function pad(n){ return String(n).padStart(2, '0'); }
  function ahoraPartes(){
    var d = new Date();
    return {
      fecha: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
      hora: pad(d.getHours()),
      horaLabel: pad(d.getHours()) + ':00',
      ts: d.getTime()
    };
  }
  function money(n){ return '$' + Math.round(parseFloat(n) || 0).toLocaleString('es-AR'); }
  function setText(id, value){ var el = document.getElementById(id); if(el) el.textContent = value; }
  function estado(txt){ setText('dh-estado', txt); }
  function cfgActual(){
    return Object.assign({}, window.TIPO_CAMBIO_CONFIG || {}, {
      oficial: parseFloat((document.getElementById('cfg-dolar-oficial') || {}).value) || parseFloat((window.TIPO_CAMBIO_CONFIG || {}).oficial) || 0,
      blue: parseFloat((document.getElementById('cfg-dolar-blue') || {}).value) || parseFloat((window.TIPO_CAMBIO_CONFIG || {}).blue) || 0,
      mep: parseFloat((document.getElementById('cfg-dolar-mep') || {}).value) || parseFloat((window.TIPO_CAMBIO_CONFIG || {}).mep) || 0,
      dolarConversion: (document.getElementById('cfg-dolar-conversion') || {}).value || (window.TIPO_CAMBIO_CONFIG || {}).dolarConversion || 'oficial',
      actualizacionAuto: (document.getElementById('cfg-tc-auto') || {}).value || (window.TIPO_CAMBIO_CONFIG || {}).actualizacionAuto || 'manual'
    });
  }
  function pathPunto(partes){
    return 'sisventas/dolarHistorico/' + partes.fecha + '/' + partes.hora;
  }
  function flatten(obj){
    var rows = [];
    Object.keys(obj || {}).forEach(function(fecha){
      Object.keys(obj[fecha] || {}).forEach(function(hora){
        rows.push(Object.assign({ fecha:fecha, hora:hora }, obj[fecha][hora] || {}));
      });
    });
    return rows.sort(function(a,b){ return (b.ts || 0) - (a.ts || 0); });
  }

  async function guardarPunto(datos, origen){
    if(!window.fbDB || !window.fbRef || !window.fbUpdate) return null;
    var contexto = capturarContexto();
    if(!contextoVigente(contexto)) return null;
    datos = datos || cfgActual();
    var partes = ahoraPartes();
    var punto = {
      fecha: partes.fecha,
      hora: partes.horaLabel,
      ts: partes.ts,
      oficial: Math.round(parseFloat(datos.oficial) || 0),
      blue: Math.round(parseFloat(datos.blue) || 0),
      mep: Math.round(parseFloat(datos.mep) || 0),
      dolarConversion: datos.dolarConversion || 'oficial',
      fuente: origen || 'manual',
      fuenteFecha: datos.fuenteFecha || '',
      usuario: window.currentUser || '',
      version: (window.SISVENTAS_PWA_VERSION || '')
    };
    if(!punto.oficial && !punto.blue && !punto.mep) throw new Error('sin_cotizacion');
    var updates = {};
    updates[pathPunto(partes)] = punto;
    updates['sisventas/config/dolarHistoricoUltimo'] = {
      ts: partes.ts,
      fecha: partes.fecha,
      hora: partes.horaLabel,
      path: pathPunto(partes),
      fuente: punto.fuente
    };
    await window.fbUpdate(window.fbRef(window.fbDB), updates);
    if(!contextoVigente(contexto)) return punto;
    renderResumen([punto]);
    estado('Guardado ' + new Date(partes.ts).toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'}));
    cargar({refrescar:true});
    return punto;
  }

  function renderResumen(rows){
    rows = rows || [];
    var ultimo = rows[0] || {};
    setText('dh-oficial', money(ultimo.oficial));
    setText('dh-blue', money(ultimo.blue));
    setText('dh-mep', money(ultimo.mep));
    setText('dh-count', rows.length);
    if (typeof window.actualizarDolarDashboard === 'function') window.actualizarDolarDashboard();
  }

  function renderTabla(rows){
    var tbody = document.getElementById('dolar-historico-tbody');
    if(!tbody) return;
    historial = rows || [];
    pagina = Math.min(pagina, Math.max(0, Math.ceil(historial.length / pageSize)-1));
    renderResumen(historial);
    var nav = document.getElementById('dh-history-pages');
    if(!nav){
      nav = document.createElement('div'); nav.id='dh-history-pages';
      nav.style.cssText='display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0';
      nav.innerHTML='<label style="display:flex;align-items:center;gap:8px;font-size:12px">Registros por página <select data-page-size aria-label="Registros por página" class="search-input" style="width:auto;min-height:36px"><option value="10">10</option><option value="25" selected>25</option><option value="50">50</option></select></label><button type="button" class="btn btn-sm" data-newer>Más recientes</button><span data-history-range aria-live="polite" style="font-size:12px"></span><button type="button" class="btn btn-sm" data-older>Más antiguos</button>';
      tbody.closest('table').parentElement.after(nav);
      nav.querySelector('[data-page-size]').onchange=function(e){var size=Number(e.target.value);pageSize=[10,25,50].includes(size)?size:25;pagina=0;renderTabla(historial);};
      nav.querySelector('[data-newer]').onclick=function(){pagina=Math.max(0,pagina-1);renderTabla(historial);};
      nav.querySelector('[data-older]').onclick=function(){pagina++;renderTabla(historial);};
    }
    nav.querySelector('[data-page-size]').value=String(pageSize);
    nav.querySelector('[data-newer]').disabled=pagina===0;
    nav.querySelector('[data-older]').disabled=(pagina+1)*pageSize>=historial.length;
    nav.querySelector('[data-history-range]').textContent=historial.length ? 'Registros '+(pagina*pageSize+1)+'–'+Math.min((pagina+1)*pageSize,historial.length)+' de '+historial.length+' · Histórico desde '+historial[historial.length-1].fecha.split('-').reverse().join('/') : 'Sin registros';
    rows = historial.slice(pagina*pageSize,(pagina+1)*pageSize);
    if(!rows.length){
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:18px">Sin histórico cargado</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function(r){
      var guardado = r.ts ? new Date(r.ts).toLocaleString('es-AR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '—';
      return '<tr>' +
        '<td>' + (r.fecha || '—').split('-').reverse().join('/') + '</td>' +
        '<td>' + (r.hora || '—') + '</td>' +
        '<td class="tr">' + money(r.oficial) + '</td>' +
        '<td class="tr">' + money(r.blue) + '</td>' +
        '<td class="tr">' + money(r.mep) + '</td>' +
        '<td>' + (r.fuente || '—') + '</td>' +
        '<td>' + guardado + '</td>' +
      '</tr>';
    }).join('');
    if(window.SisVentas && typeof window.SisVentas.initResizableTables === 'function') {
      setTimeout(window.SisVentas.initResizableTables, 30);
    }
  }

  function cargar(opciones){
    var contexto = capturarContexto();
    if(!contextoVigente(contexto) || !window.fbDB || !window.fbGet || !window.fbRef) return Promise.resolve(false);
    if(cargaProgramada !== null) clearTimeout(cargaProgramada); cargaProgramada = null;
    if(cargaPendiente && contextoVigente(cargaPendiente.contexto)) {
      if(opciones?.refrescar === true) cargaPendiente.refrescar = true;
      return cargaPendiente.promesa;
    }
    var controlador = nuevoControlador(), signal = controlador?.signal;
    var solicitud = {contexto:contexto, controlador:controlador, refrescar:false, promesa:null};
    cargaPendiente = solicitud;
    solicitud.promesa = (async function(){
      try {
        await esperarVisible(signal);
        if(cargaPendiente !== solicitud || !contextoVigente(contexto)) return false;
        estado('Cargando histórico...');
        var snap = await esperarResultado(window.fbGet(window.fbRef(window.fbDB, 'sisventas/dolarHistorico')),signal);
        await esperarVisible(signal);
        if(cargaPendiente !== solicitud || !contextoVigente(contexto)) return false;
        var rows = flatten(snap.val() || {});
        pagina = 0;
        renderTabla(rows);
        if(window.SisVentasDolarMensual) window.SisVentasDolarMensual.update(rows);
        estado(rows.length ? 'Último punto: ' + (rows[0].fecha || '') + ' ' + (rows[0].hora || '') : 'Sin registros');
        return true;
      } catch(e){
        if(cargaPendiente === solicitud && contextoVigente(contexto) && e.name !== 'AbortError') {
          estado('Error al cargar histórico');
          if(typeof notify === 'function') notify('No se pudo cargar histórico del dólar: ' + e.message);
        }
        return false;
      } finally {
        if(controlador) controladores.delete(controlador);
        if(cargaPendiente === solicitud) {
          cargaPendiente = null;
          if(solicitud.refrescar && contextoVigente(contexto)) cargar();
        }
      }
    })();
    return solicitud.promesa;
  }

  async function guardarAhora(){
    var contexto = capturarContexto();
    try {
      var punto = await guardarPunto(cfgActual(), 'manual');
      if(punto && contextoVigente(contexto) && typeof notify === 'function') notify('✓ Punto del dólar guardado');
    } catch(e){
      if(contextoVigente(contexto) && typeof notify === 'function') notify('No se pudo guardar histórico: ' + e.message);
    }
  }

  async function debeActualizarPorHora(){
    if(!sesionDisponible() || !window.fbDB || !window.fbGet || !window.fbRef) return false;
    var cfg = cfgActual();
    if(cfg.actualizacionAuto !== 'hora') return false;
    var contexto = capturarContexto(), controlador = nuevoControlador(), signal = controlador?.signal;
    try {
      await esperarVisible(signal);
      if(!contextoVigente(contexto)) return false;
      var snap = await esperarResultado(window.fbGet(window.fbRef(window.fbDB, 'sisventas/config/dolarHistoricoUltimo')),signal);
      await esperarVisible(signal);
      if(!contextoVigente(contexto)) return false;
      var ultimo = snap.val() || {};
      return !ultimo.ts || (Date.now() - Number(ultimo.ts || 0)) >= INTERVALO_MS;
    } catch(_e){
      return contextoVigente(contexto) && _e.name !== 'AbortError';
    } finally {
      if(controlador) controladores.delete(controlador);
    }
  }

  async function tick(){
    if(cargando || !sesionDisponible()) return;
    var contexto = capturarContexto();
    cargando = true;
    try {
      if(await debeActualizarPorHora() && contextoVigente(contexto)){
        if(typeof window.actualizarDolarAPI === 'function') await window.actualizarDolarAPI(true);
        else await guardarPunto(cfgActual(), 'auto');
      }
    } finally {
      if(contextoVigente(contexto)) cargando = false;
    }
  }

  function iniciar(){
    invalidarCargas(); sesionActiva = true;
    if(timer) clearInterval(timer);
    timer = null;
    if(!sesionDisponible()) return;
    programarCarga(400);
    // La actualización de cotización queda vinculada a una acción explícita.
  }

  function detener(){
    sesionActiva = false; invalidarCargas();
    if(timer) clearInterval(timer);
    timer = null;
    cargando = false;
  }

  window.SisVentasDolarHistorico = {
    guardarPunto: guardarPunto,
    cargar: cargar,
    tick: tick,
    iniciar: iniciar,
    detener: detener
  };
  window.dolarHistoricoCargar = cargar;
  window.dolarHistoricoGuardarAhora = guardarAhora;

  document.addEventListener('sisventas:session-ready', iniciar);
  document.addEventListener('sisventas:session-ended', detener);
  document.addEventListener('sisventas:role-changed', invalidarCargas);
  document.addEventListener('sisventas:page-changed', function(e){
    if(!e.detail || e.detail.page === 'configuracion') programarCarga(250);
  });
})();
