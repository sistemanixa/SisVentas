(function(){
  function arr(v){ return Array.isArray(v) ? v : Object.values(v || {}); }
  function norm(v){ return String(v == null ? '' : v).trim(); }
  function keyNorm(v){ return norm(v).toLowerCase(); }
  function money(n){ return '$' + Math.round(parseFloat(n) || 0).toLocaleString('es-AR'); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function setText(id, value){ var el=document.getElementById(id); if(el) el.textContent=value; }
  function hasAny(obj, keys){ return keys.some(function(k){ return !!norm(obj && obj[k]); }); }
  function baseRef(rec){ return norm((rec && (rec.fbKey || rec.id || rec.numero || rec.codigo || rec.ventaId || rec.clienteId)) || ''); }
  function resolverCliente(reg){
    if(typeof window._svResolverClienteRegistro === 'function') return window._svResolverClienteRegistro(reg, true);
    var id = norm(reg && (reg.clienteFbKey || reg.clienteKey || reg.clienteId || reg.idCliente));
    if(!id) return null;
    return arr(window.clientesData || window.cliData || window.clientesList).find(function(c){
      return [c.fbKey,c.id,c.numero,c.codigo].map(norm).indexOf(id) >= 0;
    }) || null;
  }
  function resolverVenta(reg){
    if(typeof window._svResolverVentaRegistro === 'function') return window._svResolverVentaRegistro(reg, true);
    var id = norm(reg && (reg.ventaFbKey || reg.ventaKey || reg.ventaId || reg.idVenta || reg.venta));
    if(!id) return null;
    return arr(window.ventasList || window.ventasData).find(function(v){
      return [v.fbKey,v.id,v.numero,v.codigo].map(norm).indexOf(id) >= 0;
    }) || null;
  }
  function issue(list, sev, tipo, msg, rec, sugerencia){
    list.push({sev:sev||'medio', tipo:tipo, msg:msg, ref:baseRef(rec), sugerencia:sugerencia||''});
  }
  function sevClass(sev){ return sev==='critico'?'b-red':sev==='alto'?'b-amber':sev==='ok'?'b-green':'b-blue'; }
  function sevPeso(sev){ return {critico:0,alto:1,medio:2,bajo:3,ok:4}[sev] == null ? 2 : {critico:0,alto:1,medio:2,bajo:3,ok:4}[sev]; }

  function auditarDuplicadosOT(issues){
    var mapa = {};
    arr(window.otData || window.ordenesTrabajoData).forEach(function(o){
      var id = keyNorm(o && o.id);
      if(!id) return;
      if(!mapa[id]) mapa[id] = [];
      mapa[id].push(o);
    });
    Object.keys(mapa).forEach(function(id){
      if(mapa[id].length > 1) issue(issues,'critico','ot','Número de OT duplicado: '+id,mapa[id][0],'Ejecutar herramienta de reparación de OT antes de seguir cargando órdenes.');
    });
  }
  function auditarPagosHuerfanos(issues){
    arr(window._pagosListaActual || window._historialPagosCompleto || window.pagosData || window.pagosList).forEach(function(p){
      if(!p || p.anulado) return;
      var tieneRef = hasAny(p,['ventaFbKey','ventaKey','ventaId','idVenta','venta','nroVenta','numeroVenta']);
      if(tieneRef && !resolverVenta(p)) issue(issues,'alto','pago','Pago con referencia de venta que no se pudo resolver',p,'Revisar venta eliminada/anulada o completar ventaFbKey.');
    });
  }
  function auditarVentas(issues){
    arr(window.ventasList || window.ventasData).forEach(function(v){
      if(!v) return;
      if(!hasAny(v,['clienteFbKey','clienteKey']) && resolverCliente(v)) issue(issues,'medio','venta','Venta sin clienteFbKey aunque el cliente se puede resolver',v,'Normalizar clienteFbKey en una migración segura.');
      if(!hasAny(v,['clienteFbKey','clienteKey','clienteId','idCliente']) && v.cliente) issue(issues,'bajo','venta','Venta depende solo del nombre de cliente',v,'Completar clave de cliente cuando se edite o migre.');
    });
  }
  function auditarPresupuestos(issues){
    arr(window.pptoData || window.presupuestosData).forEach(function(p){
      if(!p) return;
      if(!hasAny(p,['clienteFbKey','clienteKey']) && resolverCliente(p)) issue(issues,'medio','presupuesto','Presupuesto sin clienteFbKey aunque el cliente se puede resolver',p,'Normalizar clienteFbKey.');
      if((p.ventaId || p.ventaGeneradaId) && !hasAny(p,['ventaFbKey','ventaGeneradaFbKey'])) issue(issues,'alto','presupuesto','Presupuesto convertido sin ventaFbKey/ventaGeneradaFbKey',p,'Completar vínculo a venta generada.');
    });
  }
  function auditarPagos(issues){
    arr(window._pagosListaActual || window._historialPagosCompleto || window.pagosData || window.pagosList).forEach(function(p){
      if(!p || p.anulado) return;
      if(!hasAny(p,['ventaFbKey','ventaKey']) && resolverVenta(p)) issue(issues,'medio','pago','Pago sin ventaFbKey aunque la venta se puede resolver',p,'Normalizar ventaFbKey.');
      if(!hasAny(p,['clienteFbKey','clienteKey']) && resolverCliente(p)) issue(issues,'bajo','pago','Pago sin clienteFbKey aunque el cliente se puede resolver',p,'Normalizar clienteFbKey.');
    });
  }
  function auditarOT(issues){
    arr(window.otData || window.ordenesTrabajoData).forEach(function(o){
      if(!o) return;
      if(!hasAny(o,['ventaFbKey','ventaKey']) && (o.ventaId || o.venta) && resolverVenta(o)) issue(issues,'medio','ot','OT sin ventaFbKey aunque la venta se puede resolver',o,'Normalizar ventaFbKey.');
      if(!hasAny(o,['clienteFbKey','clienteKey']) && resolverCliente(o)) issue(issues,'medio','ot','OT sin clienteFbKey aunque el cliente se puede resolver',o,'Normalizar clienteFbKey.');
      if((o.origen === 'reclamo' || String(o.tipoVisita||'').toLowerCase().indexOf('reclamo') >= 0) && !o.reclamoKey) issue(issues,'alto','ot','OT de reclamo sin reclamoKey',o,'Vincular con reclamo original si existe.');
    });
  }
  function auditarReclamos(issues){
    arr(window.SP_DATA).forEach(function(r){
      if(!r) return;
      if(!hasAny(r,['clienteFbKey','clienteKey']) && resolverCliente(r)) issue(issues,'medio','reclamo','Reclamo sin clienteFbKey aunque el cliente se puede resolver',r,'Normalizar clienteFbKey.');
      if((r.otKey || r.otId) && !(r.ventaKey || r.ventaFbKey || r.ventaId)) issue(issues,'bajo','reclamo','Reclamo con OT pero sin venta vinculada registrada',r,'Completar ventaKey si el reclamo generó visita facturable.');
    });
  }
  function auditarProductos(issues){
    arr(window.prodData || window.productosData).forEach(function(p){
      if(!p) return;
      if((p.categoria || p.categoriaId) && !hasAny(p,['categoriaFbKey','categoriaKey'])) issue(issues,'bajo','producto','Producto con categoría legacy sin categoriaFbKey',p,'Normalizar categoría cuando se edite o migre productos.');
    });
  }

  window.svAuditarRelaciones = function(){
    var issues = [];
    auditarDuplicadosOT(issues);
    auditarVentas(issues);
    auditarPresupuestos(issues);
    auditarPagos(issues);
    auditarPagosHuerfanos(issues);
    auditarOT(issues);
    auditarReclamos(issues);
    auditarProductos(issues);
    issues.sort(function(a,b){ return sevPeso(a.sev)-sevPeso(b.sev) || String(a.tipo).localeCompare(String(b.tipo)); });
    var porTipo = issues.reduce(function(acc,it){ acc[it.tipo]=(acc[it.tipo]||0)+1; return acc; }, {});
    var porSev = issues.reduce(function(acc,it){ acc[it.sev]=(acc[it.sev]||0)+1; return acc; }, {});
    return { version:'v1.34.1', fecha:new Date().toISOString(), total:issues.length, porTipo:porTipo, porSeveridad:porSev, issues:issues };
  };

  window.svInformeAuditoriaRelaciones = function(res){
    res = res || window.svAuditarRelaciones();
    var lines = [];
    lines.push('SisVentas · Auditoría de relaciones');
    lines.push('Fecha: ' + new Date(res.fecha || Date.now()).toLocaleString('es-AR'));
    lines.push('Total avisos: ' + res.total);
    lines.push('Por severidad: ' + JSON.stringify(res.porSeveridad || {}));
    lines.push('Por tipo: ' + JSON.stringify(res.porTipo || {}));
    lines.push('');
    res.issues.forEach(function(x,i){
      lines.push((i+1)+'. ['+String(x.sev||'medio').toUpperCase()+'] '+x.tipo+' · '+x.msg+' · Ref: '+(x.ref||'—')+(x.sugerencia?' · '+x.sugerencia:''));
    });
    return lines.join('\n');
  };
  window.svCopiarAuditoriaRelaciones = function(){
    var txt = window.svInformeAuditoriaRelaciones(window._svUltimaAuditoriaRelaciones);
    if(navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function(){ if(typeof notify==='function') notify('Informe copiado'); });
    } else {
      window.prompt('Copiá el informe:', txt);
    }
  };
  window.svDescargarAuditoriaRelaciones = function(){
    var res = window._svUltimaAuditoriaRelaciones || window.svAuditarRelaciones();
    var blob = new Blob([JSON.stringify(res,null,2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sisventas-auditoria-relaciones-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  window.svRenderAuditoriaRelaciones = function(){
    var box=document.getElementById('mnt-relaciones-lista');
    var badge=document.getElementById('mnt-relaciones-count');
    var res=window.svAuditarRelaciones();
    window._svUltimaAuditoriaRelaciones = res;
    if(badge){ badge.className='badge '+(res.total?'b-amber':'b-green'); badge.textContent=res.total ? (res.total+' aviso(s)') : 'Relaciones OK'; }
    var acciones = '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:10px;border-bottom:0.5px solid var(--border);background:var(--bg2)">'+
      '<button class="btn btn-sm" onclick="svCopiarAuditoriaRelaciones()"><i class="ti ti-copy"></i> Copiar informe</button>'+
      '<button class="btn btn-sm" onclick="svDescargarAuditoriaRelaciones()"><i class="ti ti-download"></i> Descargar JSON</button>'+
      '<span style="font-size:12px;color:var(--text3);align-self:center">Críticos: '+(res.porSeveridad.critico||0)+' · Altos: '+(res.porSeveridad.alto||0)+' · Medios: '+(res.porSeveridad.medio||0)+' · Bajos: '+(res.porSeveridad.bajo||0)+'</span>'+
    '</div>';
    if(box){
      if(!res.total) box.innerHTML=acciones+'<div style="font-size:13px;color:var(--green);padding:12px;text-align:center">No se detectaron vínculos flojos en memoria.</div>';
      else box.innerHTML=acciones+res.issues.slice(0,120).map(function(x){
        return '<div style="display:grid;grid-template-columns:86px 94px minmax(0,1fr) 120px;gap:8px;align-items:center;padding:8px 10px;border-bottom:0.5px solid var(--border)">'+
          '<span class="badge '+sevClass(x.sev)+'">'+esc(x.sev)+'</span><span class="badge b-blue">'+esc(x.tipo)+'</span><div style="font-size:12px;color:var(--text2);overflow-wrap:anywhere">'+esc(x.msg)+(x.sugerencia?'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(x.sugerencia)+'</div>':'')+'</div><div style="font-size:11px;color:var(--text3);text-align:right;overflow:hidden;text-overflow:ellipsis">'+esc(x.ref||'—')+'</div></div>';
      }).join('') + (res.total>120 ? '<div style="padding:10px;color:var(--text3);font-size:12px;text-align:center">Se muestran 120 de '+res.total+' avisos.</div>' : '');
    }
    if(typeof window.mntLog === 'function') window.mntLog('Auditoría de relaciones: '+res.total+' aviso(s). Críticos: '+(res.porSeveridad.critico||0)+'.');
    return res;
  };

  function aplicarReportesReales(){
    if(typeof window.svResumenVentas !== 'function') return;
    var mes = (typeof window._periodoActualReportes === 'function') ? window._periodoActualReportes() : null;
    var r = window.svResumenVentas({mes:mes});
    setText('rep-total', money(r.totalMes));
    setText('rep-total-sub', r.cantidadMes + (r.cantidadMes===1 ? ' venta' : ' ventas'));
    setText('rep-cant', r.cantidadMes);
    setText('rep-ticket', money(r.ticketPromedioMes));
    setText('rep-iva', money(r.ivaMes));
    setText('est-total', money(r.totalMes));
    setText('est-total-sub', r.cantidadMes + (r.cantidadMes===1 ? ' venta del mes' : ' ventas del mes'));
  }
  ['renderReportes','renderEstadisticas'].forEach(function(nombre){
    var original=window[nombre];
    if(typeof original !== 'function' || original._svHealth) return;
    var wrapped=function(){ var res=original.apply(this,arguments); setTimeout(aplicarReportesReales,0); return res; };
    wrapped._svHealth=true; wrapped._svOriginal=original; window[nombre]=wrapped;
  });
  var prevAnalizar=window.mntAnalizarBase;
  if(typeof prevAnalizar === 'function' && !prevAnalizar._svHealth){
    window.mntAnalizarBase = async function(){ var r=await prevAnalizar.apply(this,arguments); setTimeout(window.svRenderAuditoriaRelaciones,0); return r; };
    window.mntAnalizarBase._svHealth=true;
  }
})();
