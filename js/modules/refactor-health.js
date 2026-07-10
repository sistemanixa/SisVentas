(function(){
  function arr(v){ return Array.isArray(v) ? v : Object.values(v || {}); }
  function norm(v){ return String(v == null ? '' : v).trim(); }
  function keyNorm(v){ return norm(v).toLowerCase(); }
  function money(n){ return '$' + Math.round(parseFloat(n) || 0).toLocaleString('es-AR'); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function setText(id, value){ var el=document.getElementById(id); if(el) el.textContent=value; }
  function hasAny(obj, keys){ return keys.some(function(k){ return !!norm(obj && obj[k]); }); }
  function baseRef(rec){
    if(!rec) return '';
    return norm(rec.fbKey || rec.id || rec.numero || rec.codigo || rec.ventaId || rec.venta || rec.nroVenta || rec.numeroVenta || rec.clienteId || rec.cliente || ((rec.fecha||rec.monto) ? ((rec.fecha||'')+' $'+(rec.monto||'')) : ''));
  }
  function rutaYaVerificada(path, value){
    var m = window._svRutasNormalizadasVerificadas || {};
    return !!(path && m[path] && valoresIguales(m[path], value));
  }
  function marcarRutaVerificada(path, value){
    if(!path) return;
    window._svRutasNormalizadasVerificadas = window._svRutasNormalizadasVerificadas || {};
    window._svRutasNormalizadasVerificadas[path] = value;
  }
  function put(updates, path, value){ if(path && value != null && value !== '' && !rutaYaVerificada(path, value)) updates[path] = value; }
  function sevClass(sev){ return sev==='critico'?'b-red':sev==='alto'?'b-amber':sev==='ok'?'b-green':'b-blue'; }
  function sevPeso(sev){ return {critico:0,alto:1,medio:2,bajo:3,ok:4}[sev] == null ? 2 : {critico:0,alto:1,medio:2,bajo:3,ok:4}[sev]; }

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
  function resolverCategoria(reg){
    var id = norm(reg && (reg.categoriaFbKey || reg.categoriaKey || reg.categoriaId || reg.categoria));
    var cats = arr(window.catData || window.categoriasData || window.categoriasList);
    if(!id) return null;
    var byKey = cats.find(function(c){ return [c.fbKey,c.id,c.codigo].map(norm).indexOf(id) >= 0; });
    if(byKey) return byKey;
    var n = keyNorm(id);
    return cats.find(function(c){ return [c.nombre,c.categoria,c.descripcion].map(keyNorm).indexOf(n) >= 0; }) || null;
  }
  function issue(list, sev, tipo, msg, rec, sugerencia){
    list.push({sev:sev||'medio', tipo:tipo, msg:msg, ref:baseRef(rec), sugerencia:sugerencia||''});
  }
  function firmaAviso(x){
    return [x && x.sev, x && x.tipo, x && x.msg, x && x.ref, x && x.sugerencia].map(function(v){ return String(v||'').trim(); }).join('|');
  }
  function esAvisoHistorico(x){
    var t = String((x && x.msg) || '') + ' ' + String((x && x.sugerencia) || '');
    return /inexistente|eliminad|venta eliminada|no se pudo resolver|referencia de venta que no se pudo resolver/i.test(t);
  }
  function avisoArchivado(x){
    var m = window._svAvisosRelacionesArchivados || {};
    return !!m[firmaAviso(x)];
  }
  function clasificarAvisos(res, plan){
    var issues = (res && res.issues) || [];
    var criticos = issues.filter(function(x){ return x.sev === 'critico' && !avisoArchivado(x); });
    var historicos = issues.filter(function(x){ return esAvisoHistorico(x) && !avisoArchivado(x); });
    var activos = issues.filter(function(x){ return !esAvisoHistorico(x) && !avisoArchivado(x); });
    var archivados = issues.filter(avisoArchivado);
    return {
      criticos: criticos,
      historicos: historicos,
      activos: activos,
      archivados: archivados,
      automaticos: plan && plan.totalCambios ? plan.totalCambios : 0
    };
  }
  async function cargarAvisosArchivados(){
    if(window._svAvisosArchivadosCargados || !window.fbDB || !window.fbGet || !window.fbRef) return;
    window._svAvisosArchivadosCargados = true;
    var snap = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/mantenimiento/auditoria_relaciones_archivadas')).catch(function(){ return { val:function(){ return null; } }; });
    var data = snap && typeof snap.val === 'function' ? snap.val() : null;
    window._svAvisosRelacionesArchivados = {};
    Object.values(data || {}).forEach(function(r){
      if(r && r.firma) window._svAvisosRelacionesArchivados[r.firma] = true;
    });
  }
  async function cargarRutasNormalizadasVerificadas(){
    if(window._svNormalizacionesVerificadasCargadas || !window.fbDB || !window.fbGet || !window.fbRef) return;
    window._svNormalizacionesVerificadasCargadas = true;
    var snap = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/mantenimiento/normalizaciones')).catch(function(){ return { val:function(){ return null; } }; });
    var data = snap && typeof snap.val === 'function' ? snap.val() : null;
    Object.values(data || {}).forEach(function(reg){
      if(!reg || reg.verificacion && reg.verificacion.ok === false) return;
      arr(reg.updatesLista).forEach(function(x){
        if(x && x.ruta) marcarRutaVerificada(x.ruta, x.valor);
      });
    });
  }
  function relacionesVerificadasPara(rec, pares){
    if(!rec || !rec.fbKey) return false;
    return pares.every(function(par){
      return rutaYaVerificada('sisventas/'+par.col+'/'+rec.fbKey+'/'+par.campo, par.valor);
    });
  }

  function auditarDuplicadosOT(issues){
    var mapa = {};
    arr(window.otData || window.ordenesTrabajoData).forEach(function(o){
      var id = keyNorm(o && o.id);
      if(!id) return;
      if(!mapa[id]) mapa[id] = [];
      mapa[id].push(o);
    });
    Object.keys(mapa).forEach(function(id){
      if(mapa[id].length > 1) issue(issues,'critico','ot','Numero de OT duplicado: '+id,mapa[id][0],'Ejecutar herramienta de reparacion de OT antes de seguir cargando ordenes.');
    });
  }
  function auditarVentas(issues){
    arr(window.ventasList || window.ventasData).forEach(function(v){
      if(!v) return;
      var c = resolverCliente(v);
      if(!hasAny(v,['clienteFbKey','clienteKey']) && c && c.fbKey && !relacionesVerificadasPara(v,[{col:'ventas',campo:'clienteFbKey',valor:c.fbKey},{col:'ventas',campo:'clienteKey',valor:c.fbKey}])) issue(issues,'medio','venta','Venta sin clienteFbKey aunque el cliente se puede resolver',v,'Normalizar clienteFbKey en una migracion segura.');
      if(!hasAny(v,['clienteFbKey','clienteKey','clienteId','idCliente']) && v.cliente) issue(issues,'bajo','venta','Venta depende solo del nombre de cliente',v,'Completar clave de cliente cuando se edite o migre.');
    });
  }
  function auditarPresupuestos(issues){
    arr(window.pptoData || window.presupuestosData).forEach(function(p){
      if(!p) return;
      var c = resolverCliente(p);
      if(!hasAny(p,['clienteFbKey','clienteKey']) && c && c.fbKey && !relacionesVerificadasPara(p,[{col:'presupuestos',campo:'clienteFbKey',valor:c.fbKey},{col:'presupuestos',campo:'clienteKey',valor:c.fbKey}])) issue(issues,'medio','presupuesto','Presupuesto sin clienteFbKey aunque el cliente se puede resolver',p,'Normalizar clienteFbKey.');
      if((p.ventaId || p.ventaGeneradaId) && !hasAny(p,['ventaFbKey','ventaGeneradaFbKey'])){
        var v = resolverVenta({ ventaFbKey:p.ventaFbKey || p.ventaGeneradaFbKey, ventaId:p.ventaId || p.ventaGeneradaId });
        if(v && v.fbKey && relacionesVerificadasPara(p,[{col:'presupuestos',campo:'ventaFbKey',valor:v.fbKey},{col:'presupuestos',campo:'ventaGeneradaFbKey',valor:v.fbKey}])) return;
        issue(issues, v && v.fbKey ? 'medio' : 'alto', 'presupuesto', 'Presupuesto convertido sin ventaFbKey/ventaGeneradaFbKey' + (v && v.fbKey ? ' aunque la venta se puede resolver' : ''), p, v && v.fbKey ? 'Normalizar vinculo a venta generada.' : 'Revisar venta generada inexistente/eliminada: '+(p.ventaId || p.ventaGeneradaId));
      }
    });
  }
  function auditarPagos(issues){
    arr(window._pagosListaActual || window._historialPagosCompleto || window.pagosData || window.pagosList).forEach(function(p){
      if(!p || p.anulado) return;
      var tieneRef = hasAny(p,['ventaFbKey','ventaKey','ventaId','idVenta','venta','nroVenta','numeroVenta']);
      var venta = resolverVenta(p);
      if(tieneRef && !venta) issue(issues,'alto','pago','Pago con referencia de venta que no se pudo resolver',p,'Revisar venta eliminada/anulada o completar ventaFbKey.');
      if(!hasAny(p,['ventaFbKey','ventaKey']) && venta && venta.fbKey && !relacionesVerificadasPara(p,[{col:'pagos',campo:'ventaFbKey',valor:venta.fbKey},{col:'pagos',campo:'ventaKey',valor:venta.fbKey}])) issue(issues,'medio','pago','Pago sin ventaFbKey aunque la venta se puede resolver',p,'Normalizar ventaFbKey.');
      var c = resolverCliente(p) || (venta && resolverCliente(venta));
      if(!p.fbKey) return; // pagos embebidos legacy dentro de ventas: heredan cliente/venta y no viven en /sisventas/pagos
      if(!hasAny(p,['clienteFbKey','clienteKey']) && c && c.fbKey && !relacionesVerificadasPara(p,[{col:'pagos',campo:'clienteFbKey',valor:c.fbKey},{col:'pagos',campo:'clienteKey',valor:c.fbKey}])) issue(issues,'bajo','pago','Pago sin clienteFbKey aunque el cliente se puede resolver',p,'Normalizar clienteFbKey.');
    });
  }
  function auditarOT(issues){
    arr(window.otData || window.ordenesTrabajoData).forEach(function(o){
      if(!o) return;
      var v = resolverVenta(o);
      if(!hasAny(o,['ventaFbKey','ventaKey']) && (o.ventaId || o.venta) && v && v.fbKey && !relacionesVerificadasPara(o,[{col:'ordenesTrabajo',campo:'ventaFbKey',valor:v.fbKey},{col:'ordenesTrabajo',campo:'ventaKey',valor:v.fbKey}])) issue(issues,'medio','ot','OT sin ventaFbKey aunque la venta se puede resolver',o,'Normalizar ventaFbKey.');
      var c = resolverCliente(o) || (v && resolverCliente(v));
      if(!hasAny(o,['clienteFbKey','clienteKey']) && c && c.fbKey && !relacionesVerificadasPara(o,[{col:'ordenesTrabajo',campo:'clienteFbKey',valor:c.fbKey},{col:'ordenesTrabajo',campo:'clienteKey',valor:c.fbKey}])) issue(issues,'medio','ot','OT sin clienteFbKey aunque el cliente se puede resolver',o,'Normalizar clienteFbKey.');
      if((o.origen === 'reclamo' || String(o.tipoVisita||'').toLowerCase().indexOf('reclamo') >= 0) && !o.reclamoKey) issue(issues,'alto','ot','OT de reclamo sin reclamoKey',o,'Vincular con reclamo original si existe.');
    });
  }
  function auditarReclamos(issues){
    arr(window.SP_DATA).forEach(function(r){
      if(!r) return;
      var c = resolverCliente(r);
      if(!hasAny(r,['clienteFbKey','clienteKey']) && c && c.fbKey && !relacionesVerificadasPara(r,[{col:'reclamos',campo:'clienteFbKey',valor:c.fbKey},{col:'reclamos',campo:'clienteKey',valor:c.fbKey}])) issue(issues,'medio','reclamo','Reclamo sin clienteFbKey aunque el cliente se puede resolver',r,'Normalizar clienteFbKey.');
      if((r.otKey || r.otId) && !(r.ventaKey || r.ventaFbKey || r.ventaId)) issue(issues,'bajo','reclamo','Reclamo con OT pero sin venta vinculada registrada',r,'Completar ventaKey si el reclamo genero visita facturable.');
    });
  }
  function auditarProductos(issues){
    arr(window.prodData || window.productosData).forEach(function(p){
      if(!p) return;
      var c = resolverCategoria(p);
      if((p.categoria || p.categoriaId) && !hasAny(p,['categoriaFbKey','categoriaKey']) && !(c && c.fbKey && relacionesVerificadasPara(p,[{col:'productos',campo:'categoriaFbKey',valor:c.fbKey},{col:'productos',campo:'categoriaKey',valor:c.fbKey}]))) issue(issues,'bajo','producto','Producto con categoria legacy sin categoriaFbKey',p,'Normalizar categoria cuando se edite o migre productos.');
    });
  }

  window.svAuditarRelaciones = function(){
    var issues = [];
    auditarDuplicadosOT(issues);
    auditarVentas(issues);
    auditarPresupuestos(issues);
    auditarPagos(issues);
    auditarOT(issues);
    auditarReclamos(issues);
    auditarProductos(issues);
    issues.sort(function(a,b){ return sevPeso(a.sev)-sevPeso(b.sev) || String(a.tipo).localeCompare(String(b.tipo)); });
    var porTipo = issues.reduce(function(acc,it){ acc[it.tipo]=(acc[it.tipo]||0)+1; return acc; }, {});
    var porSev = issues.reduce(function(acc,it){ acc[it.sev]=(acc[it.sev]||0)+1; return acc; }, {});
    return { version:'v1.36.21', fecha:new Date().toISOString(), total:issues.length, porTipo:porTipo, porSeveridad:porSev, issues:issues };
  };

  window.svGenerarPlanNormalizacionRelaciones = function(){
    var updates = {};
    var notas = [];
    function nota(txt){ notas.push(txt); }
    arr(window.ventasList || window.ventasData).forEach(function(v){
      if(!v || !v.fbKey) return;
      var c = resolverCliente(v);
      if(c && c.fbKey && !hasAny(v,['clienteFbKey','clienteKey'])){
        put(updates,'sisventas/ventas/'+v.fbKey+'/clienteFbKey',c.fbKey);
        put(updates,'sisventas/ventas/'+v.fbKey+'/clienteKey',c.fbKey);
        if(!v.clienteId && !v.idCliente && c.id) put(updates,'sisventas/ventas/'+v.fbKey+'/clienteId',c.id);
      }
    });
    arr(window.pptoData || window.presupuestosData).forEach(function(p){
      if(!p || !p.fbKey) return;
      var c = resolverCliente(p);
      if(c && c.fbKey && !hasAny(p,['clienteFbKey','clienteKey'])){
        put(updates,'sisventas/presupuestos/'+p.fbKey+'/clienteFbKey',c.fbKey);
        put(updates,'sisventas/presupuestos/'+p.fbKey+'/clienteKey',c.fbKey);
      }
      var v = resolverVenta({ ventaFbKey:p.ventaFbKey || p.ventaGeneradaFbKey, ventaId:p.ventaId || p.ventaGeneradaId });
      if(v && v.fbKey && (p.ventaId || p.ventaGeneradaId) && !hasAny(p,['ventaFbKey','ventaGeneradaFbKey'])){
        put(updates,'sisventas/presupuestos/'+p.fbKey+'/ventaFbKey',v.fbKey);
        put(updates,'sisventas/presupuestos/'+p.fbKey+'/ventaGeneradaFbKey',v.fbKey);
      }
    });
    arr(window._pagosListaActual || window._historialPagosCompleto || window.pagosData || window.pagosList).forEach(function(p){
      if(!p || !p.fbKey || p.anulado) return;
      var v = resolverVenta(p);
      if(v && v.fbKey && !hasAny(p,['ventaFbKey','ventaKey'])){
        put(updates,'sisventas/pagos/'+p.fbKey+'/ventaFbKey',v.fbKey);
        put(updates,'sisventas/pagos/'+p.fbKey+'/ventaKey',v.fbKey);
      }
      var c = resolverCliente(p) || (v ? resolverCliente(v) : null);
      if(c && c.fbKey && !hasAny(p,['clienteFbKey','clienteKey'])){
        put(updates,'sisventas/pagos/'+p.fbKey+'/clienteFbKey',c.fbKey);
        put(updates,'sisventas/pagos/'+p.fbKey+'/clienteKey',c.fbKey);
      }
    });
    arr(window.otData || window.ordenesTrabajoData).forEach(function(o){
      if(!o || !o.fbKey) return;
      var v = resolverVenta(o);
      if(v && v.fbKey && !hasAny(o,['ventaFbKey','ventaKey'])){
        put(updates,'sisventas/ordenesTrabajo/'+o.fbKey+'/ventaFbKey',v.fbKey);
        put(updates,'sisventas/ordenesTrabajo/'+o.fbKey+'/ventaKey',v.fbKey);
      }
      var c = resolverCliente(o) || (v ? resolverCliente(v) : null);
      if(c && c.fbKey && !hasAny(o,['clienteFbKey','clienteKey'])){
        put(updates,'sisventas/ordenesTrabajo/'+o.fbKey+'/clienteFbKey',c.fbKey);
        put(updates,'sisventas/ordenesTrabajo/'+o.fbKey+'/clienteKey',c.fbKey);
      }
      if((o.origen === 'reclamo' || String(o.tipoVisita||'').toLowerCase().indexOf('reclamo') >= 0) && !o.reclamoKey) nota('OT '+(o.id||o.fbKey)+' parece reclamo pero requiere elegir reclamo original manualmente.');
    });
    arr(window.SP_DATA).forEach(function(r){
      if(!r || !r.fbKey) return;
      var c = resolverCliente(r);
      if(c && c.fbKey && !hasAny(r,['clienteFbKey','clienteKey'])){
        put(updates,'sisventas/reclamos/'+r.fbKey+'/clienteFbKey',c.fbKey);
        put(updates,'sisventas/reclamos/'+r.fbKey+'/clienteKey',c.fbKey);
      }
    });
    arr(window.prodData || window.productosData).forEach(function(p){
      if(!p || !p.fbKey) return;
      var c = resolverCategoria(p);
      if(c && c.fbKey && (p.categoria || p.categoriaId) && !hasAny(p,['categoriaFbKey','categoriaKey'])){
        put(updates,'sisventas/productos/'+p.fbKey+'/categoriaFbKey',c.fbKey);
        put(updates,'sisventas/productos/'+p.fbKey+'/categoriaKey',c.fbKey);
      }
    });
    return {
      version:'v1.36.21',
      fecha:new Date().toISOString(),
      totalCambios:Object.keys(updates).length,
      updates:updates,
      notas:notas,
      instrucciones:'Plan seguro de normalizacion. Revisar antes de aplicar. No incluye casos ambiguos ni reclamoKey sin certeza.'
    };
  };

  window.svInformeAuditoriaRelaciones = function(res){
    res = res || window.svAuditarRelaciones();
    var lines = [];
    lines.push('SisVentas - Auditoria de relaciones');
    lines.push('Fecha: ' + new Date(res.fecha || Date.now()).toLocaleString('es-AR'));
    lines.push('Total avisos: ' + res.total);
    lines.push('Por severidad: ' + JSON.stringify(res.porSeveridad || {}));
    lines.push('Por tipo: ' + JSON.stringify(res.porTipo || {}));
    lines.push('');
    res.issues.forEach(function(x,i){
      lines.push((i+1)+'. ['+String(x.sev||'medio').toUpperCase()+'] '+x.tipo+' - '+x.msg+' - Ref: '+(x.ref||'-')+(x.sugerencia?' - '+x.sugerencia:''));
    });
    return lines.join('\n');
  };
  function copiarTexto(txt, ok){
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ if(typeof notify==='function') notify(ok); });
    else window.prompt('Copiar:', txt);
  }
  window.svCopiarAuditoriaRelaciones = function(){ copiarTexto(window.svInformeAuditoriaRelaciones(window._svUltimaAuditoriaRelaciones), 'Informe copiado'); };
  window.svCopiarPlanNormalizacionRelaciones = function(){
    var plan = window.svGenerarPlanNormalizacionRelaciones();
    copiarTexto(JSON.stringify(plan,null,2), 'Plan copiado ('+plan.totalCambios+' cambios)');
  };
  window.svArchivarAvisosHistoricosRelaciones = async function(){
    if(String(window.currentRole || '').toLowerCase() !== 'admin') { if(typeof notify==='function') notify('Solo el administrador puede archivar avisos'); return false; }
    if(!window.fbDB || !window.fbUpdate || !window.fbRef) { if(typeof notify==='function') notify('Sin conexion Firebase'); return false; }
    var res = window._svUltimaAuditoriaRelaciones || window.svAuditarRelaciones();
    var plan = window.svGenerarPlanNormalizacionRelaciones();
    var cls = clasificarAvisos(res, plan);
    if(!cls.historicos.length) { if(typeof notify==='function') notify('No hay avisos historicos para archivar'); return false; }
    if(!confirm('Se archivaran '+cls.historicos.length+' aviso(s) historicos/manuales. No se borran datos ni se crean vinculos. Continuar?')) return false;
    var now = Date.now(), usuario = window.currentUser || (window.currentUserData && window.currentUserData.nombre) || 'Admin';
    var updates = {};
    cls.historicos.forEach(function(x, i){
      var firma = firmaAviso(x);
      updates['sisventas/mantenimiento/auditoria_relaciones_archivadas/'+now+'_'+i] = {
        firma: firma,
        sev: x.sev || '',
        tipo: x.tipo || '',
        msg: x.msg || '',
        ref: x.ref || '',
        sugerencia: x.sugerencia || '',
        fecha: new Date().toISOString(),
        usuario: usuario,
        version: (window.APP_CONFIG && APP_CONFIG.VERSION) || window.SISVENTAS_PWA_VERSION || ''
      };
      window._svAvisosRelacionesArchivados = window._svAvisosRelacionesArchivados || {};
      window._svAvisosRelacionesArchivados[firma] = true;
    });
    await window.fbUpdate(window.fbRef(window.fbDB), updates);
    if(typeof window.registrarActividad === 'function') window.registrarActividad('Auditoria relaciones', cls.historicos.length+' aviso(s) historicos archivados');
    if(typeof notify==='function') notify('Avisos historicos archivados: '+cls.historicos.length);
    if(typeof window.svRenderAuditoriaRelaciones === 'function') window.svRenderAuditoriaRelaciones();
    return true;
  };
  function descargarJSON(nombre, obj){
    var blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre + '-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function planBackupSeguro(plan){
    var updates = plan && plan.updates ? plan.updates : {};
    return Object.keys(updates).sort().map(function(ruta){
      return { ruta: ruta, valor: updates[ruta] };
    });
  }
  function resumenPlan(plan){
    var porColeccion = {};
    Object.keys((plan && plan.updates) || {}).forEach(function(ruta){
      var p = ruta.split('/').filter(Boolean);
      var col = p[1] || 'otros';
      porColeccion[col] = (porColeccion[col] || 0) + 1;
    });
    return Object.keys(porColeccion).sort().map(function(k){ return k+': '+porColeccion[k]; }).join(', ') || 'sin cambios';
  }
  function setByPath(obj, parts, value){
    if(!obj || !parts || !parts.length) return false;
    var cur = obj;
    for(var i=0;i<parts.length-1;i++){
      var p = parts[i];
      if(!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length-1]] = value;
    return true;
  }
  function aplicarUpdateEnMemoria(ruta, valor){
    var p = String(ruta||'').split('/').filter(Boolean);
    if(p[0] !== 'sisventas' || p.length < 4) return false;
    var col = p[1], key = p[2], campo = p.slice(3);
    var listas = {
      ventas: [window.ventasList, window.ventasData],
      presupuestos: [window.pptoData, window.presupuestosData],
      pagos: [window._pagosListaActual, window._historialPagosCompleto, window.pagosData, window.pagosList],
      ordenesTrabajo: [window.otData, window.ordenesTrabajoData],
      reclamos: [window.SP_DATA],
      productos: [window.prodData, window.productosData]
    }[col] || [];
    var ok = false;
    listas.forEach(function(lista){
      arr(lista).forEach(function(rec){
        if(rec && norm(rec.fbKey) === key) ok = setByPath(rec, campo, valor) || ok;
      });
    });
    return ok;
  }
  function valoresIguales(a,b){
    return String(a == null ? '' : a) === String(b == null ? '' : b);
  }
  async function verificarPlanAplicado(plan){
    if(!window.fbGet || !window.fbRef || !window.fbDB) return { ok:false, pendientes:['Firebase get no disponible'] };
    var pendientes = [];
    var entries = Object.entries((plan && plan.updates) || {});
    for(var i=0;i<entries.length;i++){
      var ruta = entries[i][0], esperado = entries[i][1];
      var snap = await window.fbGet(window.fbRef(window.fbDB, ruta)).catch(function(e){ return { _error:e, val:function(){ return undefined; } }; });
      var actual = snap && typeof snap.val === 'function' ? snap.val() : undefined;
      if(!valoresIguales(actual, esperado)) pendientes.push({ ruta:ruta, esperado:esperado, actual:actual == null ? null : actual });
    }
    return { ok: pendientes.length === 0, pendientes: pendientes };
  }
  window.svDescargarAuditoriaRelaciones = function(){ descargarJSON('sisventas-auditoria-relaciones', window._svUltimaAuditoriaRelaciones || window.svAuditarRelaciones()); };
  window.svDescargarPlanNormalizacionRelaciones = function(){
    var plan = window.svGenerarPlanNormalizacionRelaciones();
    descargarJSON('sisventas-plan-normalizacion', plan);
    if(typeof notify==='function') notify('Plan descargado: '+plan.totalCambios+' cambio(s)');
  };
  window.svAplicarPlanNormalizacionRelaciones = async function(){
    if(String(window.currentRole || '').toLowerCase() !== 'admin') { if(typeof notify==='function') notify('Solo el administrador puede aplicar el plan'); return false; }
    if(!window.fbDB || typeof window.fbUpdate !== 'function' || typeof window.fbRef !== 'function') { if(typeof notify==='function') notify('Sin conexion Firebase'); return false; }
    var auditoria = window.svAuditarRelaciones();
    if((auditoria.porSeveridad.critico || 0) > 0) {
      if(typeof notify==='function') notify('No se aplica: hay avisos criticos para resolver primero');
      return false;
    }
    var plan = window.svGenerarPlanNormalizacionRelaciones();
    if(!plan.totalCambios) { if(typeof notify==='function') notify('No hay cambios seguros para aplicar'); return false; }
    if(!window.confirm('Se aplicaran '+plan.totalCambios+' cambio(s) seguros de normalizacion. No se borran datos. Continuar?')) return false;
    var clave = window.prompt('Para confirmar escribi NORMALIZAR:');
    if(clave !== 'NORMALIZAR') { if(typeof notify==='function') notify('Normalizacion cancelada'); return false; }
    var usuario = window.currentUser || (window.currentUserData && window.currentUserData.nombre) || 'Admin';
    var stamp = Date.now();
    var meta = {
      version: plan.version,
      fecha: new Date().toISOString(),
      usuario: usuario,
      totalCambios: plan.totalCambios,
      notas: plan.notas || []
    };
    try {
      var backupLista = planBackupSeguro(plan);
      await window.fbSet(window.fbRef(window.fbDB, 'sisventas/mantenimiento/normalizaciones/'+stamp), Object.assign({}, meta, { updatesLista: backupLista }));
      await window.fbUpdate(window.fbRef(window.fbDB), plan.updates);
      var verificacion = await verificarPlanAplicado(plan);
      if(!verificacion.ok) {
        await window.fbSet(window.fbRef(window.fbDB, 'sisventas/mantenimiento/normalizaciones/'+stamp+'/verificacion'), verificacion).catch(function(){});
        if(typeof notify==='function') notify('Plan escrito parcialmente: '+verificacion.pendientes.length+' ruta(s) no verificadas');
        if(typeof window.mntLog === 'function') window.mntLog('Plan seguro con pendientes de verificacion: '+verificacion.pendientes.length);
        return false;
      }
      backupLista.forEach(function(x){
        marcarRutaVerificada(x.ruta, x.valor);
        aplicarUpdateEnMemoria(x.ruta, x.valor);
      });
      if(typeof window.registrarActividad === 'function') window.registrarActividad('Normalizacion relaciones', plan.totalCambios+' cambio(s) aplicados');
      if(typeof notify==='function') notify('Normalizacion verificada: '+plan.totalCambios+' cambio(s)');
      if(typeof window.mntLog === 'function') window.mntLog('Plan seguro verificado: '+plan.totalCambios+' cambio(s) - '+resumenPlan(plan));
      setTimeout(function(){
        if(typeof window.fbCargarTodo === 'function') window.fbCargarTodo();
        if(typeof window.svRenderAuditoriaRelaciones === 'function') window.svRenderAuditoriaRelaciones();
      }, 1200);
      return true;
    } catch(e) {
      if(typeof notify==='function') notify('Error aplicando plan: '+e.message);
      return false;
    }
  };

  window.svRenderAuditoriaRelaciones = function(){
    if(!window._svNormalizacionesVerificadasCargadas && window.fbDB && window.fbGet && window.fbRef) {
      cargarRutasNormalizadasVerificadas().then(function(){
        if(typeof window.svRenderAuditoriaRelaciones === 'function') window.svRenderAuditoriaRelaciones();
      });
    }
    if(!window._svAvisosArchivadosCargados && window.fbDB && window.fbGet && window.fbRef) {
      cargarAvisosArchivados().then(function(){
        if(typeof window.svRenderAuditoriaRelaciones === 'function') window.svRenderAuditoriaRelaciones();
      });
    }
    var box=document.getElementById('mnt-relaciones-lista');
    var badge=document.getElementById('mnt-relaciones-count');
    var res=window.svAuditarRelaciones();
    var plan=window.svGenerarPlanNormalizacionRelaciones();
    var grupos = clasificarAvisos(res, plan);
    window._svUltimaAuditoriaRelaciones = res;
    if(badge){
      var visibles = grupos.criticos.length + grupos.activos.length + grupos.historicos.length;
      badge.className='badge '+(grupos.criticos.length?'b-red':(visibles || grupos.automaticos?'b-amber':'b-green'));
      badge.textContent=grupos.criticos.length ? (grupos.criticos.length+' critico(s)') : (visibles ? (visibles+' aviso(s)') : 'Relaciones OK');
    }
    var acciones = '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:10px;border-bottom:0.5px solid var(--border);background:var(--bg2)">'+
      '<button class="btn btn-sm" onclick="svCopiarAuditoriaRelaciones()"><i class="ti ti-copy"></i> Copiar informe</button>'+
      '<button class="btn btn-sm" onclick="svDescargarAuditoriaRelaciones()"><i class="ti ti-download"></i> Descargar JSON</button>'+
      '<button class="btn btn-sm" onclick="svCopiarPlanNormalizacionRelaciones()"><i class="ti ti-clipboard-check"></i> Copiar plan seguro</button>'+
      '<button class="btn btn-sm" onclick="svDescargarPlanNormalizacionRelaciones()"><i class="ti ti-file-download"></i> Descargar plan</button>'+
      '<button class="btn btn-sm btn-primary" '+(plan.totalCambios?'':'disabled')+' onclick="svAplicarPlanNormalizacionRelaciones()"><i class="ti ti-database-check"></i> Aplicar plan seguro</button>'+
      '<button class="btn btn-sm" '+(grupos.historicos.length?'':'disabled')+' onclick="svArchivarAvisosHistoricosRelaciones()"><i class="ti ti-archive"></i> Archivar historicos</button>'+
      '<span style="font-size:12px;color:var(--text3);align-self:center">Criticos: '+grupos.criticos.length+' - Automaticos: '+plan.totalCambios+' - Historicos: '+grupos.historicos.length+(grupos.archivados.length?' - Archivados: '+grupos.archivados.length:'')+'</span>'+
    '</div>';
    function renderGrupo(titulo, lista, vacio, color){
      if(!lista.length) return vacio ? '<div style="font-size:13px;color:'+color+';padding:12px;text-align:center">'+vacio+'</div>' : '';
      return '<div style="padding:8px 10px;background:var(--bg);border-bottom:0.5px solid var(--border);font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">'+esc(titulo)+'</div>'+
        lista.slice(0,120).map(function(x){
          return '<div style="display:grid;grid-template-columns:86px 94px minmax(0,1fr) 120px;gap:8px;align-items:center;padding:8px 10px;border-bottom:0.5px solid var(--border)">'+
            '<span class="badge '+sevClass(x.sev)+'">'+esc(x.sev)+'</span><span class="badge b-blue">'+esc(x.tipo)+'</span><div style="font-size:12px;color:var(--text2);overflow-wrap:anywhere">'+esc(x.msg)+(x.sugerencia?'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(x.sugerencia)+'</div>':'')+'</div><div style="font-size:11px;color:var(--text3);text-align:right;overflow:hidden;text-overflow:ellipsis">'+esc(x.ref||'-')+'</div></div>';
        }).join('') + (lista.length>120 ? '<div style="padding:10px;color:var(--text3);font-size:12px;text-align:center">Se muestran 120 de '+lista.length+' avisos.</div>' : '');
    }
    if(box){
      var html = acciones;
      html += renderGrupo('Criticos', grupos.criticos, '', 'var(--red)');
      html += renderGrupo('Activos / revisables', grupos.activos.filter(function(x){ return x.sev !== 'critico'; }), '', 'var(--amber)');
      html += renderGrupo('Historicos / manuales', grupos.historicos, '', 'var(--amber)');
      if(!grupos.criticos.length && !grupos.activos.length && !grupos.historicos.length) {
        html += '<div style="font-size:13px;color:var(--green);padding:12px;text-align:center">No hay vinculos automaticos pendientes. '+(grupos.archivados.length?grupos.archivados.length+' aviso(s) historicos archivados.':'Relaciones OK.')+'</div>';
      }
      box.innerHTML = html;
    }
    if(typeof window.mntLog === 'function') window.mntLog('Auditoria de relaciones: criticos '+grupos.criticos.length+', automaticos '+plan.totalCambios+', historicos '+grupos.historicos.length+'.');
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













