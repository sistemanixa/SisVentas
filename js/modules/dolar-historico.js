/* v1.36.3 — Histórico horario del dólar */
(function(){
  'use strict';

  var INTERVALO_MS = 60 * 60 * 1000;
  var timer = null;
  var cargando = false;

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
  }

  function renderTabla(rows){
    var tbody = document.getElementById('dolar-historico-tbody');
    if(!tbody) return;
    rows = (rows || []).slice(0, 72);
    renderResumen(rows);
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
    if(!window.fbDB || !window.fbGet || !window.fbRef) return;
    try {
      estado('Cargando histórico...');
      var snap = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/dolarHistorico'));
      var rows = flatten(snap.val() || {});
      renderTabla(rows);
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
    if(!window.fbDB || !window.fbGet || !window.fbRef) return false;
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
    if(cargando) return;
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
    setTimeout(cargar, 400);
    setTimeout(tick, 1600);
    timer = setInterval(tick, INTERVALO_MS);
  }

  window.SisVentasDolarHistorico = {
    guardarPunto: guardarPunto,
    cargar: cargar,
    tick: tick,
    iniciar: iniciar
  };
  window.dolarHistoricoCargar = cargar;
  window.dolarHistoricoGuardarAhora = guardarAhora;

  document.addEventListener('firebase-ready', iniciar);
  document.addEventListener('sisventas:page-changed', function(e){
    if(!e.detail || e.detail.page === 'configuracion') setTimeout(cargar, 250);
  });
  if(document.readyState !== 'loading') setTimeout(iniciar, 800);
  else document.addEventListener('DOMContentLoaded', function(){ setTimeout(iniciar, 800); });
})();
