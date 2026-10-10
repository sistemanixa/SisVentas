/* v1.36.3 — Histórico horario del dólar */
(function(){
  'use strict';

  var INTERVALO_MS = 60 * 60 * 1000;
  var timer = null;
  var cargando = false;
  var historial = [], pagina = 0, pageSize = 25;

  function sesionDisponible(){
    return !!(window.fbAuth && window.fbAuth.currentUser && !document.body.classList.contains('sv-sesion-cerrada'));
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
    renderResumen([punto]);
    estado('Guardado ' + new Date(partes.ts).toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'}));
    if(typeof window.dolarHistoricoCargar === 'function') setTimeout(window.dolarHistoricoCargar, 250);
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

  async function cargar(){
    if(!sesionDisponible() || !window.fbDB || !window.fbGet || !window.fbRef) return;
    try {
      estado('Cargando histórico...');
      var snap = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/dolarHistorico'));
      var rows = flatten(snap.val() || {});
      pagina = 0;
      renderTabla(rows);
      if(window.SisVentasDolarMensual) window.SisVentasDolarMensual.update(rows);
      estado(rows.length ? 'Último punto: ' + (rows[0].fecha || '') + ' ' + (rows[0].hora || '') : 'Sin registros');
    } catch(e){
      estado('Error al cargar histórico');
      if(typeof notify === 'function') notify('No se pudo cargar histórico del dólar: ' + e.message);
    }
  }

  async function guardarAhora(){
    try {
      await guardarPunto(cfgActual(), 'manual');
      if(typeof notify === 'function') notify('✓ Punto del dólar guardado');
    } catch(e){
      if(typeof notify === 'function') notify('No se pudo guardar histórico: ' + e.message);
    }
  }

  async function debeActualizarPorHora(){
    if(!sesionDisponible() || !window.fbDB || !window.fbGet || !window.fbRef) return false;
    var cfg = cfgActual();
    if(cfg.actualizacionAuto !== 'hora') return false;
    try {
      var snap = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/config/dolarHistoricoUltimo'));
      var ultimo = snap.val() || {};
      return !ultimo.ts || (Date.now() - Number(ultimo.ts || 0)) >= INTERVALO_MS;
    } catch(_e){
      return true;
    }
  }

  async function tick(){
    if(cargando || !sesionDisponible()) return;
    cargando = true;
    try {
      if(await debeActualizarPorHora()){
        if(typeof window.actualizarDolarAPI === 'function') await window.actualizarDolarAPI(true);
        else await guardarPunto(cfgActual(), 'auto');
      }
    } finally {
      cargando = false;
    }
  }

  function iniciar(){
    if(timer) clearInterval(timer);
    timer = null;
    if(!sesionDisponible()) return;
    setTimeout(cargar, 400);
    setTimeout(tick, 1600);
    timer = setInterval(tick, INTERVALO_MS);
  }

  function detener(){
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
  document.addEventListener('sisventas:page-changed', function(e){
    if(!e.detail || e.detail.page === 'configuracion') setTimeout(cargar, 250);
  });
})();
