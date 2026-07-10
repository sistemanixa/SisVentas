/* v1.36.17 — Preparaci?n para versi?n mayor 2.0 */
(function(){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : Object.values(v || {}); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function setText(id, txt){ var el=document.getElementById(id); if(el) el.textContent = txt; }
  function badgeClass(status){ return status === 'ok' ? 'b-green' : status === 'blocker' ? 'b-red' : 'b-amber'; }
  function hasFn(name){ return typeof window[name] === 'function'; }
  function hasFeature(def){
    if(def.fn && hasFn(def.fn)) return true;
    if(def.anyFn && def.anyFn.some(hasFn)) return true;
    if(def.object && def.method && window[def.object] && typeof window[def.object][def.method] === 'function') return true;
    return false;
  }
  function hasEl(id){ return !!document.getElementById(id); }
  function scriptLoaded(src){ return !!document.querySelector('script[src*="'+src+'"]'); }

  var REQUIRED_MODULES = [
    'action-permissions.js',
    'sales-metrics.js',
    'relation-compatibility.js',
    'metrics-cache.js',
    'dashboard-filters.js',
    'activity-history.js',
    'dashboard-polish.js',
    'print-layout.js',
    'maintenance.js',
    'refactor-health.js',
    'resizable-tables.js',
    'dolar-historico.js',
    'ops-hardening.js',
    'v2-readiness.js',
    'v2-audit.js',
    'role-guard.js'
  ];

  var REQUIRED_FUNCTIONS = [
    { id:'relations-audit', label:'Auditoría de relaciones por ID', fn:'svAuditarRelaciones', weight:12, critical:true },
    { id:'relations-plan', label:'Plan seguro de normalización', fn:'svGenerarPlanNormalizacionRelaciones', weight:8, critical:true },
    { id:'ops-summary', label:'Resumen operativo final', fn:'svAuditoriaOperativa', weight:10, critical:true },
    { id:'permissions', label:'Permisos finos por acción', fn:'tienePermiso', weight:9, critical:true },
    { id:'admin-check', label:'Control de rol administrativo', fn:'esAdminSV', weight:7, critical:true },
    { id:'metrics', label:'Métricas centralizadas de ventas', fn:'svResumenVentas', weight:8, critical:false },
    { id:'print', label:'Impresión desacoplada', anyFn:['imprimirVentaActual','imprimirPresupuesto','imprimirRecibo','imprimirRemito'], weight:5, critical:false },
    { id:'dolar', label:'Histórico horario del dólar', object:'SisVentasDolarHistorico', method:'guardarPunto', weight:5, critical:false }
    ,{ id:'v2-audit', label:'Auditoría V2 de datos y módulos', fn:'svAuditoriaV2', weight:8, critical:false }
  ];

  var REQUIRED_UI = [
    { id:'maintenance-panel', label:'Panel de mantenimiento', el:'cfg-mantenimiento', weight:8, critical:true },
    { id:'ops-panel', label:'Resumen operativo visible', el:'mnt-operativo-lista', weight:6, critical:true },
    { id:'relations-panel', label:'Auditoría de relaciones visible', el:'mnt-relaciones-lista', weight:6, critical:true },
    { id:'v2-panel', label:'Checklist 2.0 visible', el:'mnt-v2-lista', weight:6, critical:true },
    { id:'version-label', label:'Versión visible al usuario', el:'up-version', weight:4, critical:false }
  ];

  function relationSnapshot(){
    var out = { total:0, criticos:0, altos:0, seguros:0, ok:true };
    try{
      var audit = hasFn('svAuditarRelaciones') ? window.svAuditarRelaciones() : null;
      var plan = hasFn('svGenerarPlanNormalizacionRelaciones') ? window.svGenerarPlanNormalizacionRelaciones() : null;
      out.total = audit && audit.total || 0;
      out.criticos = audit && audit.porSeveridad && audit.porSeveridad.critico || 0;
      out.altos = audit && audit.porSeveridad && audit.porSeveridad.alto || 0;
      out.seguros = plan && plan.totalCambios || 0;
      out.ok = out.criticos === 0 && out.seguros === 0;
    }catch(e){
      out.ok = false;
      out.error = e && e.message || String(e);
    }
    return out;
  }

  function dataSnapshot(){
    var ventas = arr(window.ventasData);
    var pagos = arr(window.pagosData);
    var ots = arr(window.otData);
    var clientes = arr(window.clientesData || window.cliData);
    var productos = arr(window.productosData || window.prodData);
    var otNumeros = {};
    var otDuplicadas = 0;
    ots.forEach(function(o){
      var n = String(o && (o.id || o.numero || o.numeroOT) || '').trim();
      if(!n) return;
      otNumeros[n] = (otNumeros[n] || 0) + 1;
      if(otNumeros[n] === 2) otDuplicadas++;
    });
    var ventasSinKey = ventas.filter(function(v){ return !v || !v.fbKey; }).length;
    var clientesSinKey = clientes.filter(function(c){ return !c || !c.fbKey; }).length;
    return {
      ventas: ventas.length,
      pagos: pagos.length,
      ots: ots.length,
      clientes: clientes.length,
      productos: productos.length,
      otDuplicadas: otDuplicadas,
      ventasSinKey: ventasSinKey,
      clientesSinKey: clientesSinKey,
      loaded: ventas.length + pagos.length + ots.length + clientes.length + productos.length
    };
  }

  function evaluar(){
    var max = 0, score = 0, blockers = [];
    var items = [];
    function add(group, id, label, ok, weight, critical, detail){
      max += weight;
      if(ok) score += weight;
      if(!ok && critical) blockers.push(label);
      items.push({ group:group, id:id, label:label, ok:!!ok, weight:weight, critical:!!critical, detail:detail || '' });
    }

    REQUIRED_MODULES.forEach(function(mod){
      add('Módulos', mod, mod, scriptLoaded(mod), 3, mod === 'action-permissions.js' || mod === 'refactor-health.js' || mod === 'v2-readiness.js', scriptLoaded(mod) ? 'Cargado en la app' : 'No aparece cargado en index.html');
    });

    REQUIRED_FUNCTIONS.forEach(function(def){
      add('Funciones críticas', def.id, def.label, hasFeature(def), def.weight, def.critical, hasFeature(def) ? 'Disponible en runtime' : 'No disponible en runtime');
    });

    REQUIRED_UI.forEach(function(def){
      add('Mantenimiento', def.id, def.label, hasEl(def.el), def.weight, def.critical, hasEl(def.el) ? 'Visible' : 'No encontrado');
    });

    var rel = relationSnapshot();
    add('Datos', 'relations-critical-clean', 'Relaciones sin críticos', rel.criticos === 0, 12, true, 'Avisos: '+rel.total+' · críticos: '+rel.criticos+' · plan seguro disponible: '+rel.seguros);
    add('Datos', 'relations-safe-plan', 'Plan seguro de relaciones aplicado', rel.seguros === 0, 6, false, rel.seguros ? ('Hay '+rel.seguros+' cambio(s) seguros disponibles. Aplicalos desde Auditoría de relaciones y volvé a evaluar.') : 'Sin cambios automáticos pendientes');
    add('Datos', 'relations-high', 'Sin relaciones altas sin decisión', rel.altos === 0, 5, false, 'Altos: '+rel.altos+' (pueden requerir decisión humana)');

    var ds = dataSnapshot();
    add('Runtime', 'data-loaded', 'Datos principales cargados en memoria', ds.loaded > 0, 5, false, ds.loaded ? ('Ventas '+ds.ventas+' · pagos '+ds.pagos+' · OT '+ds.ots+' · clientes '+ds.clientes+' · productos '+ds.productos) : 'Todavía no hay datos cargados en memoria');
    add('Datos', 'ot-unique-number', 'Números de OT sin duplicados', ds.otDuplicadas === 0, 10, true, ds.ots ? ('OT cargadas: '+ds.ots+' · números duplicados: '+ds.otDuplicadas) : 'Sin OT cargadas en memoria');
    add('Datos', 'primary-fbkeys', 'Registros principales con clave Firebase', ds.ventasSinKey === 0 && ds.clientesSinKey === 0, 6, false, 'Ventas sin fbKey: '+ds.ventasSinKey+' · clientes sin fbKey: '+ds.clientesSinKey);

    var version = window.SISVENTAS_PWA_VERSION || (window.APP_CONFIG && window.APP_CONFIG.VERSION) || '';
    add('Publicación', 'version-present', 'Versión PWA declarada', !!version, 4, true, version || 'No detectada');

    var pct = max ? Math.round(score / max * 100) : 0;
    return {
      fecha: new Date().toISOString(),
      objetivo: 'SisVentas 2.0.0',
      versionActual: version,
      score: pct,
      puntaje: score,
      maximo: max,
      bloqueantes: blockers,
      relaciones: rel,
      datos: ds,
      modulosCargados: REQUIRED_MODULES.filter(scriptLoaded).length,
      modulosEsperados: REQUIRED_MODULES.length,
      pruebasRelease: 62,
      items: items
    };
  }

  function row(item){
    var status = item.ok ? 'ok' : (item.critical ? 'blocker' : 'warn');
    var icon = item.ok ? 'ti-circle-check' : (item.critical ? 'ti-alert-triangle' : 'ti-info-circle');
    var label = item.ok ? 'OK' : (item.critical ? 'Bloqueante' : 'Revisar');
    return '<div style="display:grid;grid-template-columns:110px 120px minmax(0,1fr);gap:10px;align-items:start;padding:10px 12px;border-bottom:0.5px solid var(--border)">'+
      '<span class="badge '+badgeClass(status)+'"><i class="ti '+icon+'"></i> '+label+'</span>'+
      '<div style="font-size:12px;color:var(--text3);font-weight:600">'+esc(item.group)+'</div>'+
      '<div><div style="font-size:13px;color:var(--text);font-weight:650">'+esc(item.label)+'</div><div style="font-size:12px;color:var(--text3);line-height:1.35;margin-top:2px">'+esc(item.detail)+'</div></div>'+
    '</div>';
  }

  window.svEvaluarPreparacionV2 = evaluar;

  window.svCopiarPreparacionV2 = function(){
    var data = window._svUltimaPreparacionV2 || evaluar();
    var txt = JSON.stringify(data, null, 2);
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ if(window.notify) notify('Informe 2.0 copiado'); });
    else window.prompt('Copiar informe 2.0:', txt);
  };

  window.svRenderPreparacionV2 = function(){
    var data = evaluar();
    window._svUltimaPreparacionV2 = data;
    var badge = document.getElementById('mnt-v2-count');
    var list = document.getElementById('mnt-v2-lista');
    var blockers = data.bloqueantes.length;
    setText('mnt-v2-score', data.score + '%');
    setText('mnt-v2-blockers', String(blockers));
    setText('mnt-v2-modulos', data.modulosCargados + '/' + data.modulosEsperados);
    setText('mnt-v2-tests', data.pruebasRelease + ' checks');
    if(badge){
      badge.className = 'badge ' + (blockers ? 'b-red' : data.score >= 90 ? 'b-green' : 'b-amber');
      badge.textContent = blockers ? (blockers + ' bloqueante(s)') : (data.score >= 90 ? 'Listo para RC' : data.score + '% listo');
    }
    if(list){
      var blockersHtml = blockers
        ? '<div style="padding:12px;border-bottom:0.5px solid var(--border);background:rgba(248,113,113,.08);color:var(--red);font-size:13px;line-height:1.45"><strong>Antes de 2.0:</strong> '+esc(data.bloqueantes.join(' · '))+'</div>'
        : '<div style="padding:12px;border-bottom:0.5px solid var(--border);background:rgba(74,222,128,.08);color:var(--green);font-size:13px;line-height:1.45"><strong>Sin bloqueantes críticos.</strong> El sistema puede pasar a una release candidate cuando la prueba manual cierre bien.</div>';
      list.innerHTML = blockersHtml + data.items.map(row).join('');
    }
    if(typeof window.mntLog === 'function') window.mntLog('Preparación 2.0: '+data.score+'% · bloqueantes: '+blockers+'.');
    return data;
  };

  document.addEventListener('sisventas:page-changed', function(e){
    if(e.detail && e.detail.page === 'configuracion') setTimeout(function(){
      var panel = document.getElementById('cfg-mantenimiento');
      if(panel && panel.style.display !== 'none' && document.getElementById('mnt-v2-lista')) window.svRenderPreparacionV2();
    }, 700);
  });
})();

