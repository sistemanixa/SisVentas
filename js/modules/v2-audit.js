/* v1.36.23 — Auditor?a V2 de datos y m?dulos */
(function(){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : Object.values(v || {}); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function setText(id, txt){ var el=document.getElementById(id); if(el) el.textContent = txt; }
  function norm(v){ return String(v == null ? '' : v).trim(); }

  function dataset(){
    return {
      ventas: arr(window.ventasList || window.ventasData),
      pagos: arr(window._pagosListaActual || window._historialPagosCompleto || window.pagosData),
      ots: arr(window.otData),
      clientes: arr(window.clientesData || window.cliData),
      productos: arr(window.productosData || window.prodData),
      presupuestos: arr(window.pptoData || window.pptosData || window.presupuestosData),
      reclamos: arr(window.SP_DATA || window.reclamosData),
      gastos: arr(window.gastosData),
      empleados: arr(window.empleadosData || window.empData),
      comprobantesVenta: arr(window.comprobantesVentaData || window.facturasData),
      ctaemp: Object.keys(window.ctaEmpData || {}).reduce(function(lista, empKey){
        return lista.concat(arr(window.ctaEmpData[empKey]).map(function(m){ return Object.assign({ empleadoContenedorFbKey:empKey }, m); }));
      }, [])
    };
  }

  function countDuplicados(lista, campos){
    var seen = {};
    var dups = {};
    lista.forEach(function(item){
      var valor = '';
      campos.some(function(campo){
        valor = norm(item && item[campo]);
        return !!valor;
      });
      if(!valor) return;
      seen[valor] = (seen[valor] || 0) + 1;
      if(seen[valor] === 2) dups[valor] = 2;
      else if(seen[valor] > 2) dups[valor] = seen[valor];
    });
    return { total:Object.keys(dups).length, detalles:dups };
  }

  function countSinKey(lista){
    return lista.filter(function(x){ return !x || !norm(x.fbKey); }).length;
  }

  function moduleMap(){
    var scripts = Array.from(document.querySelectorAll('script[src]')).map(function(s){ return s.getAttribute('src') || ''; });
    var local = scripts.filter(function(src){ return src.indexOf('./js/') === 0; });
    var modules = local.filter(function(src){ return src.indexOf('./js/modules/') === 0; });
    var core = local.filter(function(src){ return src.indexOf('./js/core/') === 0; });
    var app = local.filter(function(src){ return src.indexOf('./js/app.js') === 0; });
    var duplicates = {};
    local.forEach(function(src){
      var clean = src.split('?')[0];
      duplicates[clean] = (duplicates[clean] || 0) + 1;
    });
    var duplicated = Object.keys(duplicates).filter(function(k){ return duplicates[k] > 1; });
    return { total:local.length, modules:modules.length, core:core.length, app:app.length, duplicated:duplicated };
  }

  function weakRelations(d){
    var clientKeys = {};
    d.clientes.forEach(function(c){ if(c && c.fbKey) clientKeys[norm(c.fbKey)] = true; });
    var ventasSinClienteKey = d.ventas.filter(function(v){ return v && !norm(v.clienteFbKey) && norm(v.cliente); }).length;
    var pagosSinVentaKey = d.pagos.filter(function(p){ return p && !norm(p.ventaFbKey) && (norm(p.ventaId) || norm(p.venta) || norm(p.ventaNumero)); }).length;
    var otsSinOrigenKey = d.ots.filter(function(o){ return o && !norm(o.ventaFbKey) && !norm(o.reclamoFbKey) && (norm(o.ventaId) || norm(o.reclamoId)); }).length;
    var ventasClienteInexistente = d.ventas.filter(function(v){ return v && norm(v.clienteFbKey) && !clientKeys[norm(v.clienteFbKey)]; }).length;
    var saleKeys = {}; d.ventas.forEach(function(v){ if(v && v.fbKey) saleKeys[norm(v.fbKey)] = true; });
    var employeeKeys = {}; d.empleados.forEach(function(e){ if(e && e.fbKey) employeeKeys[norm(e.fbKey)] = true; });
    var expenseKeys = {}; d.gastos.forEach(function(g){ if(g && g.fbKey) expenseKeys[norm(g.fbKey)] = true; });
    var pagosVentaInexistente = d.pagos.filter(function(p){ return p && norm(p.ventaFbKey) && !saleKeys[norm(p.ventaFbKey)]; }).length;
    var gastosEmpleadoInexistente = d.gastos.filter(function(g){ var key=norm(g && (g.empleadoFbKey || g.empleadoId)); return key && !employeeKeys[key]; }).length;
    var cuentaGastoInexistente = d.ctaemp.filter(function(m){ var key=norm(m && (m.gastoFbKey || m.gastoKey)); return key && !expenseKeys[key]; }).length;
    var cuentaEmpleadoInexistente = d.ctaemp.filter(function(m){ var key=norm(m && m.empleadoContenedorFbKey); return key && !employeeKeys[key]; }).length;
    return { ventasSinClienteKey:ventasSinClienteKey, pagosSinVentaKey:pagosSinVentaKey, otsSinOrigenKey:otsSinOrigenKey, ventasClienteInexistente:ventasClienteInexistente, pagosVentaInexistente:pagosVentaInexistente, gastosEmpleadoInexistente:gastosEmpleadoInexistente, cuentaGastoInexistente:cuentaGastoInexistente, cuentaEmpleadoInexistente:cuentaEmpleadoInexistente };
  }

  function fiscalIssues(d){
    var ventaKeys={}; d.ventas.forEach(function(v){ if(v&&v.fbKey) ventaKeys[norm(v.fbKey)]=v; });
    var comprobanteDuplicado=countDuplicados(d.comprobantesVenta,['cae','CAE','numero','comprobante']);
    var comprobanteVentaInexistente=d.comprobantesVenta.filter(function(c){ var k=norm(c&&(c.ventaFbKey||c.ventaKey)); return k&&!ventaKeys[k]; }).length;
    var ventaEstadoContradictorio=d.ventas.filter(function(v){
      var estado=norm(v&&(v.estadoPago||v.estado)).toLowerCase();
      return v && v.anulada===true && v.notaCredito && estado!=='anulada';
    }).length;
    return { comprobantesDuplicados:comprobanteDuplicado.total, comprobanteVentaInexistente:comprobanteVentaInexistente, ventaEstadoContradictorio:ventaEstadoContradictorio };
  }

  function evaluar(){
    var d = dataset();
    var duplicates = {
      ventas: countDuplicados(d.ventas, ['id','numero','numeroVenta']),
      ots: countDuplicados(d.ots, ['id','numero','numeroOT']),
      clientes: countDuplicados(d.clientes, ['id','dni','cuit']),
      productos: countDuplicados(d.productos, ['id','codigo','sku'])
    };
    var missingKeys = {
      ventas: countSinKey(d.ventas),
      pagos: countSinKey(d.pagos),
      ots: countSinKey(d.ots),
      clientes: countSinKey(d.clientes),
      productos: countSinKey(d.productos)
    };
    var rel = weakRelations(d);
    var mods = moduleMap();
    var totalReg = Object.keys(d).reduce(function(sum,k){ return sum + d[k].length; }, 0);
    var dupTotal = Object.keys(duplicates).reduce(function(sum,k){ return sum + duplicates[k].total; }, 0);
    var keyTotal = Object.keys(missingKeys).reduce(function(sum,k){ return sum + missingKeys[k]; }, 0);
    var relTotal = Object.keys(rel).reduce(function(sum,k){ return sum+(parseInt(rel[k],10)||0); },0);
    var fiscal=fiscalIssues(d);
    var fiscalTotal=Object.keys(fiscal).reduce(function(sum,k){ return sum+(parseInt(fiscal[k],10)||0); },0);
    var cargadas={ ventas:d.ventas.length>0, clientes:d.clientes.length>0, empleados:d.empleados.length>0, gastos:d.gastos.length>0 };
    var incompletas=Object.keys(cargadas).filter(function(k){return !cargadas[k];});
    var warnings = dupTotal + keyTotal + relTotal + fiscalTotal + mods.duplicated.length;
    return {
      fecha:new Date().toISOString(),
      totalRegistros:totalReg,
      duplicados:duplicates,
      duplicadosTotal:dupTotal,
      clavesFaltantes:missingKeys,
      clavesFaltantesTotal:keyTotal,
      relacionesDebiles:rel,
      relacionesDebilesTotal:relTotal,
      integridadFiscal:fiscal,
      integridadFiscalTotal:fiscalTotal,
      coleccionesCargadas:cargadas,
      coleccionesNoEvaluadas:incompletas,
      completa:incompletas.length===0,
      modulos:mods,
      advertencias:warnings
    };
  }

  function row(status, title, detail){
    var cls = status === 'ok' ? 'b-green' : status === 'alto' ? 'b-red' : 'b-amber';
    var label = status === 'ok' ? 'OK' : status === 'alto' ? 'Alto' : 'Revisar';
    return '<div style="display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px;align-items:start;padding:10px 12px;border-bottom:0.5px solid var(--border)">'+
      '<span class="badge '+cls+'">'+label+'</span>'+
      '<div><div style="font-size:13px;color:var(--text);font-weight:650">'+esc(title)+'</div><div style="font-size:12px;color:var(--text3);line-height:1.35;margin-top:2px">'+esc(detail)+'</div></div>'+
    '</div>';
  }

  window.svAuditoriaV2 = evaluar;

  window.svCopiarAuditoriaV2 = async function(){
    var data = window._svUltimaAuditoriaV2 || evaluar();
    var txt = JSON.stringify(data, null, 2);
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ if(window.notify) notify('Auditoría V2 copiada'); });
    else await window.svPrompt('Copiar auditoría V2:', txt, { multilinea:true, filas:8 });
  };

  window.svRenderAuditoriaV2 = function(){
    var data = evaluar();
    window._svUltimaAuditoriaV2 = data;
    var badge = document.getElementById('mnt-v2-audit-count');
    var list = document.getElementById('mnt-v2-audit-lista');
    setText('mnt-v2-audit-reg', String(data.totalRegistros));
    setText('mnt-v2-audit-dup', String(data.duplicadosTotal));
    setText('mnt-v2-audit-keys', String(data.clavesFaltantesTotal));
    setText('mnt-v2-audit-mod', data.modulos.modules + '/' + data.modulos.total);
    if(badge){
      badge.className = 'badge ' + (data.duplicados.ots.total ? 'b-red' : data.advertencias ? 'b-amber' : 'b-green');
      badge.textContent = data.advertencias ? (data.advertencias + ' aviso(s)') : 'V2 OK';
    }
    if(list){
      var html = '';
      html += row(data.duplicadosTotal ? (data.duplicados.ots.total ? 'alto' : 'medio') : 'ok', 'Duplicados comerciales', 'Ventas: '+data.duplicados.ventas.total+' · OT: '+data.duplicados.ots.total+' · clientes: '+data.duplicados.clientes.total+' · productos: '+data.duplicados.productos.total+'.');
      html += row(data.clavesFaltantesTotal ? 'medio' : 'ok', 'Claves Firebase faltantes', 'Ventas: '+data.clavesFaltantes.ventas+' · pagos: '+data.clavesFaltantes.pagos+' · OT: '+data.clavesFaltantes.ots+' · clientes: '+data.clavesFaltantes.clientes+' · productos: '+data.clavesFaltantes.productos+'.');
      html += row(data.relacionesDebilesTotal ? 'medio' : 'ok', 'Relaciones débiles', 'Ventas sin clienteFbKey: '+data.relacionesDebiles.ventasSinClienteKey+' · pagos sin ventaFbKey: '+data.relacionesDebiles.pagosSinVentaKey+' · referencias inexistentes: '+(data.relacionesDebiles.ventasClienteInexistente+data.relacionesDebiles.pagosVentaInexistente+data.relacionesDebiles.gastosEmpleadoInexistente+data.relacionesDebiles.cuentaGastoInexistente+data.relacionesDebiles.cuentaEmpleadoInexistente)+'.');
      html += row(data.integridadFiscalTotal ? 'alto' : 'ok', 'Integridad fiscal y estados', 'Comprobantes duplicados: '+data.integridadFiscal.comprobantesDuplicados+' · comprobantes sin venta: '+data.integridadFiscal.comprobanteVentaInexistente+' · ventas con estado contradictorio: '+data.integridadFiscal.ventaEstadoContradictorio+'.');
      html += row(data.completa ? 'ok' : 'medio', 'Cobertura del diagnóstico', data.completa ? 'Las colecciones esenciales estaban cargadas al auditar.' : 'No evaluadas todavía: '+data.coleccionesNoEvaluadas.join(', ')+'. No se informa un OK hasta cargarlas.');
      html += row(data.modulos.duplicated.length ? 'medio' : 'ok', 'Mapa de módulos publicados', 'Scripts locales: '+data.modulos.total+' · módulos: '+data.modulos.modules+' · core: '+data.modulos.core+' · app.js: '+data.modulos.app+' · duplicados cargados: '+data.modulos.duplicated.length+'.');
      list.innerHTML = html;
    }
    if(typeof window.mntLog === 'function') window.mntLog('Auditoría V2: '+data.advertencias+' aviso(s).');
    return data;
  };

  document.addEventListener('sisventas:page-changed', function(e){
    if(e.detail && e.detail.page === 'configuracion') setTimeout(function(){
      var panel = document.getElementById('cfg-mantenimiento');
      if(panel && panel.style.display !== 'none' && document.getElementById('mnt-v2-audit-lista')) window.svRenderAuditoriaV2();
    }, 900);
  });
})();

