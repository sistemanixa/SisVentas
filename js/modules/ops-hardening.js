/* v1.36.23 — Cierre operativo: auditor?a final no destructiva */
(function(){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : Object.values(v || {}); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function norm(v){ return String(v == null ? '' : v).trim(); }
  function key(v){ return norm(v).toLowerCase(); }
  function badgeClass(n){ return n > 0 ? 'b-amber' : 'b-green'; }
  function setText(id, txt){ var el=document.getElementById(id); if(el) el.textContent=txt; }

  var FUNCIONES_PROTEGIDAS = [
    'registrarPago','anularPago','elimPago','eliminarVenta','moverVentaAPresupuesto','toggleCSF',
    'eliminarPptoDesdeTabla','eliminarPpto','anularPptoDesdeTabla','crearOT','eliminarOT',
    'eliminarCliente','eliminarProducto','eliminarEmpleado','aprobarComision','rechazarComision',
    'aprobarMovEmp','eliminarMovEmp','abrirPagoGasto','abrirPagoMultipleGastos','confirmarPagoGasto',
    'mntMigrarLegacy','mntLimpiarLegacy','mntEliminarDuplicadosGastosFijos',
    'svAplicarPlanNormalizacionRelaciones','limpiarLogActividad','fbSeedDatos','eliminarRegistro',
    'guardarConfigTFApp','guardarTipoCambio','guardarPreferenciasSistema','guardarAlicuotaIVA',
    'guardarImpuestosGenerales','guardarLogoEmpresa','eliminarLogoEmpresa','guardarDatosEmpresa',
    'guardarPermisosRoles','restaurarPermisosDefault'
  ];

  async function auditarRelaciones(){
    if(typeof window.svPrepararAuditoriaRelaciones === 'function') {
      await window.svPrepararAuditoriaRelaciones();
    }
    var res = typeof window.svAuditarRelaciones === 'function' ? window.svAuditarRelaciones() : { total:0, porSeveridad:{}, issues:[] };
    var plan = typeof window.svGenerarPlanNormalizacionRelaciones === 'function' ? window.svGenerarPlanNormalizacionRelaciones() : { totalCambios:0 };
    return {
      total: res.total || 0,
      criticos: (res.porSeveridad && (res.porSeveridad.critico || 0)) || 0,
      altos: (res.porSeveridad && (res.porSeveridad.alto || 0)) || 0,
      automaticos: plan.totalCambios || 0
    };
  }

  function auditarPermisos(){
    if(window.SisVentas && window.SisVentas.Security && typeof window.SisVentas.Security.aplicarProtecciones === 'function'){
      window.SisVentas.Security.aplicarProtecciones();
    }
    var faltan = FUNCIONES_PROTEGIDAS.filter(function(nombre){
      return typeof window[nombre] === 'function' && !window[nombre]._svPermisoProtegido;
    });
    var apiOk = typeof window.tienePermiso === 'function'
      && typeof window.esAdminSV === 'function'
      && typeof window.esAdminOAdministrativoSV === 'function';
    return { apiOk: apiOk, faltan:faltan, total:FUNCIONES_PROTEGIDAS.length };
  }

  function auditarGrids(){
    var tables = Array.from(document.querySelectorAll('table'));
    var ajustables = tables.filter(function(t){ return t.classList.contains('sv-resizable-table') || t.closest('.table-wrap,.sv-auto-grid-wrap,.sv-resizable-wrap'); });
    var inestables = tables.filter(function(t){
      var th = t.querySelectorAll('th').length;
      if(th < 2) return false;
      if(t.classList.contains('sv-resizable-table') || t.closest('.table-wrap,.sv-auto-grid-wrap,.sv-resizable-wrap')) return false;
      return !t.id && !t.querySelector('tbody[id]') && !t.querySelector('thead[id]');
    });
    var sinScroll = tables.filter(function(t){
      if(t.querySelectorAll('th').length < 4) return false;
      return !t.closest('.table-wrap,.sv-auto-grid-wrap,.sv-resizable-wrap,.sv-scroll-panel');
    });
    return { total:tables.length, ajustables:ajustables.length, inestables:inestables.length, sinScroll:sinScroll.length };
  }

  async function auditarCredenciales(){
    var clientes = arr(window.clientesData || window.cliData || window.clientesList);
    var fbKeys = {}, legacyIds = {};
    clientes.forEach(function(c){
      if(c && c.fbKey) fbKeys[key(c.fbKey)] = true;
      [c && c.id, c && c.codigo, c && c.numero].forEach(function(v){ if(norm(v)) legacyIds[key(v)] = true; });
    });
    var out = { totalNueva:0, totalLegacy:0, huerfanasNueva:0, huerfanasLegacy:0, sinLeer:false };
    if(!window.fbDB || !window.fbGet || !window.fbRef) { out.sinLeer = true; return out; }
    var nueva = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/credencialesPorCliente')).then(function(s){ return s.val() || {}; }).catch(function(){ out.sinLeer = true; return {}; });
    var legacy = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/credenciales')).then(function(s){ return s.val() || {}; }).catch(function(){ out.sinLeer = true; return {}; });
    Object.keys(nueva || {}).forEach(function(k){
      var items = nueva[k] || {};
      out.totalNueva += Object.keys(items).length;
      if(!fbKeys[key(k)]) out.huerfanasNueva += Object.keys(items).length || 1;
    });
    Object.keys(legacy || {}).forEach(function(k){
      var items = legacy[k] || {};
      out.totalLegacy += Object.keys(items).length;
      if(!legacyIds[key(k)] && !fbKeys[key(k)]) out.huerfanasLegacy += Object.keys(items).length || 1;
    });
    return out;
  }

  async function auditarDolar(){
    var out = { puntos:0, ultimo:'?', ok:true };
    if(!window.fbDB || !window.fbGet || !window.fbRef) return out;
    var ultimo = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/config/dolarHistoricoUltimo')).then(function(s){ return s.val() || {}; }).catch(function(){ out.ok=false; return {}; });
    if(ultimo && ultimo.ts) out.ultimo = new Date(ultimo.ts).toLocaleString('es-AR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
    var hist = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/dolarHistorico')).then(function(s){ return s.val() || {}; }).catch(function(){ out.ok=false; return {}; });
    Object.keys(hist || {}).forEach(function(fecha){ out.puntos += Object.keys(hist[fecha] || {}).length; });
    return out;
  }

  function row(estado, titulo, detalle){
    var cls = estado === 'ok' ? 'b-green' : estado === 'alto' ? 'b-red' : 'b-amber';
    var label = estado === 'ok' ? 'OK' : estado === 'alto' ? 'Atenci?n' : 'Revisar';
    return '<div style="display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px;align-items:start;padding:10px 12px;border-bottom:0.5px solid var(--border)">'+
      '<span class="badge '+cls+'">'+label+'</span>'+
      '<div><div style="font-size:13px;color:var(--text);font-weight:600">'+esc(titulo)+'</div><div style="font-size:12px;color:var(--text3);margin-top:2px;line-height:1.35">'+esc(detalle)+'</div></div>'+
    '</div>';
  }

  async function auditarTodo(){
    var relaciones = await auditarRelaciones();
    var permisos = auditarPermisos();
    var grids = auditarGrids();
    var cred = await auditarCredenciales();
    var dolar = await auditarDolar();
    return {
      fecha: new Date().toISOString(),
      relaciones: relaciones,
      permisos: permisos,
      grids: grids,
      credenciales: cred,
      dolar: dolar
    };
  }

  window.svAuditoriaOperativa = auditarTodo;

  window.svCopiarAuditoriaOperativa = async function(){
    var data = window._svUltimaAuditoriaOperativa || await auditarTodo();
    var txt = JSON.stringify(data, null, 2);
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ if(window.notify) notify('Resumen operativo copiado'); });
    else window.prompt('Copiar resumen operativo:', txt);
  };

  window.svRenderResumenOperativo = async function(){
    var box = document.getElementById('mnt-operativo-lista');
    var badge = document.getElementById('mnt-operativo-count');
    if(box) box.innerHTML = '<div style="padding:14px;color:var(--text3);font-size:13px;text-align:center">Auditando cierre operativo...</div>';
    var data = await auditarTodo();
    window._svUltimaAuditoriaOperativa = data;
    var problemas = 0;
    problemas += data.relaciones.criticos + data.relaciones.altos;
    problemas += data.permisos.faltan.length;
    problemas += data.grids.inestables + data.grids.sinScroll;
    problemas += data.credenciales.huerfanasNueva + data.credenciales.huerfanasLegacy;
    if(!data.dolar.ok) problemas++;
    if(badge){
      badge.className = 'badge ' + badgeClass(problemas);
      badge.textContent = problemas ? (problemas + ' punto(s)') : 'Cierre OK';
    }
    setText('mnt-op-rel', data.relaciones.criticos ? data.relaciones.criticos+' cr?ticos' : data.relaciones.total+' avisos');
    setText('mnt-op-sec', data.permisos.faltan.length ? data.permisos.faltan.length+' sin wrapper' : 'OK');
    setText('mnt-op-grid', (data.grids.inestables + data.grids.sinScroll) ? ((data.grids.inestables + data.grids.sinScroll)+' revisar') : 'OK');
    setText('mnt-op-dolar', data.dolar.puntos + ' puntos');
    if(box){
      var html = '';
      html += row(data.relaciones.criticos ? 'alto' : (data.relaciones.altos || data.relaciones.automaticos ? 'medio' : 'ok'), 'Relaciones por ID', 'Avisos: '+data.relaciones.total+' ? cr?ticos: '+data.relaciones.criticos+' ? autom?ticos seguros: '+data.relaciones.automaticos+'.');
      html += row(data.permisos.faltan.length ? 'alto' : 'ok', 'Permisos peligrosos', data.permisos.faltan.length ? ('Faltan wrappers: '+data.permisos.faltan.join(', ')) : 'Acciones cr?ticas conocidas protegidas por el m?dulo de permisos.');
      html += row((data.grids.inestables || data.grids.sinScroll) ? 'medio' : 'ok', 'Tablas y grids', 'Tablas: '+data.grids.total+' ? ajustables/scroll: '+data.grids.ajustables+' ? sin clave estable: '+data.grids.inestables+' ? sin contenedor scroll: '+data.grids.sinScroll+'.');
      html += row((data.credenciales.huerfanasNueva || data.credenciales.huerfanasLegacy) ? 'medio' : 'ok', 'Credenciales ? clientes', 'Nueva ruta: '+data.credenciales.totalNueva+' ? legacy: '+data.credenciales.totalLegacy+' ? hu?rfanas: '+(data.credenciales.huerfanasNueva + data.credenciales.huerfanasLegacy)+(data.credenciales.sinLeer?' ? no se pudo leer completo':'')+'.');
      html += row(data.dolar.ok ? 'ok' : 'medio', 'Hist?rico del d?lar', 'Puntos guardados: '+data.dolar.puntos+' ? ?ltimo: '+data.dolar.ultimo+'.');
      box.innerHTML = html;
    }
    if(typeof window.mntLog === 'function') window.mntLog('Resumen operativo: '+(problemas || 0)+' punto(s) para revisar.');
    return data;
  };

  document.addEventListener('sisventas:page-changed', function(e){
    if(e.detail && e.detail.page === 'configuracion') setTimeout(function(){
      if(document.getElementById('cfg-mantenimiento') && document.getElementById('cfg-mantenimiento').style.display !== 'none') window.svRenderResumenOperativo();
    }, 400);
  });
})();
