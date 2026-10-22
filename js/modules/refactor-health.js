(function(){
  function arr(v){ return Array.isArray(v) ? v : Object.values(v || {}); }
  function norm(v){ return String(v == null ? '' : v).trim(); }
  function keyNorm(v){ return norm(v).toLowerCase(); }
  function money(n){
    return '$' + (parseFloat(n) || 0).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
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
  window.svPrepararAuditoriaRelaciones = function(){
    return Promise.all([
      cargarRutasNormalizadasVerificadas(),
      cargarAvisosArchivados()
    ]).then(function(){ return true; }).catch(function(){ return false; });
  };
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
      if(p.conversionHistoricaSinVenta === true && p.ventaRetiradaId) return;
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
    return { version:'v2.0.15', fecha:new Date().toISOString(), total:issues.length, porTipo:porTipo, porSeveridad:porSev, issues:issues };
  };

  var camposRelacion=['id','numero','codigo','idOriginal','numeroOriginal','ventaIdOriginal','ventaId','idVenta','nro','venta','nroVenta','numeroVenta','ventaNumero','ventaFbKey','ventaKey','ventaGeneradaFbKey','ventaOrigenFbKey','ventaGeneradaId','clienteFbKey','clienteKey','clienteId','idCliente','idClienteOriginal','fbKeyCliente','id_cli','cliente','clienteNombre','nombreCliente','nombre','empresa','razonSocial','apellidos','apellido','categoria','categoriaId','categoriaFbKey','categoriaKey','descripcion','anulado','estado'];
  var camposPermitidosNormalizacion={ventas:['clienteFbKey','clienteKey','clienteId'],presupuestos:['clienteFbKey','clienteKey','ventaFbKey','ventaGeneradaFbKey'],pagos:['ventaFbKey','ventaKey','clienteFbKey','clienteKey'],ordenes_trabajo:['ventaFbKey','ventaKey','clienteFbKey','clienteKey'],reclamos:['clienteFbKey','clienteKey'],productos:['categoriaFbKey','categoriaKey']};
  function claveNormalizacionValida(key){return typeof key==='string' && !!key && key.length<=768 && !/[.#$\[\]\/\x00-\x1f\x7f]/.test(key);}
  function vacioRelacion(value){return value==null || typeof value==='string' && !value.trim();}
  function canonRelacion(value){if(value==null)return 'null';if(Array.isArray(value))return '['+value.map(canonRelacion).join(',')+']';if(typeof value==='object')return '{'+Object.keys(value).sort().map(function(key){return JSON.stringify(key)+':'+canonRelacion(value[key]);}).join(',')+'}';return JSON.stringify(value);}
  function imagenRelacion(record){var image={};camposRelacion.forEach(function(key){image[key]=record[key]==null?null:JSON.parse(JSON.stringify(record[key]));});return image;}
  function construirNormalizacionRelaciones(plan, valores, rutaAuditoria, meta){
    if(!plan || !plan.baselines || !valores || !/^sisventas\/mantenimiento\/normalizaciones\/[^/]+$/.test(rutaAuditoria) || !claveNormalizacionValida(rutaAuditoria.split('/')[3]))throw new Error('El plan requiere una nueva revisión antes de aplicar.');
    var paths=Object.keys(plan.baselines).concat(rutaAuditoria);
    if(paths.length>128)throw new Error('El plan supera 128 registros. Revisalo en un lote menor; no se guardó ningún cambio.');
    Object.keys(plan.baselines).forEach(function(path){
      var p=path.split('/');if(p.length!==3 || p[0]!=='sisventas' || !claveNormalizacionValida(p[2]) || !['ventas','presupuestos','pagos','ordenes_trabajo','reclamos','productos','clientes','categorias'].includes(p[1]))throw new Error('El plan requiere registros y referencias puntuales.');
      var current=valores[path];if(!current || typeof current!=='object' || Array.isArray(current))throw new Error('Un registro del plan ya no existe. Volvé a revisar la normalización.');
      var baseline=plan.baselines[path];
      if(camposRelacion.some(function(key){return canonRelacion(current[key])!==canonRelacion(baseline[key]);}))throw new Error('Un destino o una referencia cambió desde la revisión. Volvé a generar el plan.');
    });
    if(valores[rutaAuditoria]!=null)throw new Error('El comprobante de la normalización ya existe. Revisá el resultado antes de repetir.');
    var patch={};
    Object.keys(plan.updates||{}).forEach(function(path){
      var p=path.split('/'),recordPath=p.slice(0,3).join('/'),field=p[3];
      if(p.length!==4 || p[0]!=='sisventas' || !claveNormalizacionValida(p[2]) || !camposPermitidosNormalizacion[p[1]] || camposPermitidosNormalizacion[p[1]].indexOf(field)<0 || !Object.prototype.hasOwnProperty.call(plan.baselines,recordPath))throw new Error('El plan contiene un destino fuera de la normalización de relaciones.');
      if(!vacioRelacion(valores[recordPath][field]))throw new Error('Un campo del plan ya tiene un valor. Se conserva y requiere una nueva revisión.');
      var value=plan.updates[path];if(value==null || value==='' || !['string','number'].includes(typeof value))throw new Error('Una referencia del plan no es válida.');
      patch[path]=value;
    });
    if(!Object.keys(patch).length)throw new Error('No hay referencias vacías para completar.');
    patch[rutaAuditoria]=Object.assign({},meta,{updatesLista:planBackupSeguro(plan),referenciasVerificadas:Object.keys(plan.baselines),verificacion:{ok:true,metodo:'commit-atomico'}});
    return patch;
  }
  window.svConstruirNormalizacionRelaciones=construirNormalizacionRelaciones;
  window.svGenerarPlanNormalizacionRelaciones = function(){
    var updates = {};
    var baselines = {};
    var notas = [];
    function nota(txt){ notas.push(txt); }
    function capturar(col, rec){
      if(!rec || !claveNormalizacionValida(rec.fbKey)) return false;
      var path='sisventas/'+col+'/'+rec.fbKey;
      if(!baselines[path]) baselines[path]=imagenRelacion(rec);
      return true;
    }
    function proponer(col, rec, campo, valor, fuentes){
      if(!rec || !vacioRelacion(rec[campo]) || !claveNormalizacionValida(rec.fbKey)) return;
      if((fuentes||[]).some(function(fuente){return fuente && fuente[1] && !claveNormalizacionValida(fuente[1].fbKey);}))return;
      var path='sisventas/'+col+'/'+rec.fbKey+'/'+campo;
      put(updates,path,valor);
      if(!Object.prototype.hasOwnProperty.call(updates,path)) return;
      capturar(col,rec);
      (fuentes||[]).forEach(function(fuente){ if(fuente && fuente[1]) capturar(fuente[0],fuente[1]); });
    }
    arr(window.ventasList || window.ventasData).forEach(function(v){
      if(!v || !v.fbKey) return;
      var c = resolverCliente(v);
      if(c && c.fbKey && !hasAny(v,['clienteFbKey','clienteKey'])){
        proponer('ventas',v,'clienteFbKey',c.fbKey,[['clientes',c]]);
        proponer('ventas',v,'clienteKey',c.fbKey,[['clientes',c]]);
        if(!v.clienteId && !v.idCliente && c.id) proponer('ventas',v,'clienteId',c.id,[['clientes',c]]);
      }
    });
    arr(window.pptoData || window.presupuestosData).forEach(function(p){
      if(!p || !p.fbKey) return;
      var c = resolverCliente(p);
      if(c && c.fbKey && !hasAny(p,['clienteFbKey','clienteKey'])){
        proponer('presupuestos',p,'clienteFbKey',c.fbKey,[['clientes',c]]);
        proponer('presupuestos',p,'clienteKey',c.fbKey,[['clientes',c]]);
      }
      var v = resolverVenta({ ventaFbKey:p.ventaFbKey || p.ventaGeneradaFbKey, ventaId:p.ventaId || p.ventaGeneradaId });
      if(v && v.fbKey && (p.ventaId || p.ventaGeneradaId) && !hasAny(p,['ventaFbKey','ventaGeneradaFbKey'])){
        proponer('presupuestos',p,'ventaFbKey',v.fbKey,[['ventas',v]]);
        proponer('presupuestos',p,'ventaGeneradaFbKey',v.fbKey,[['ventas',v]]);
      }
    });
    arr(window._pagosListaActual || window._historialPagosCompleto || window.pagosData || window.pagosList).forEach(function(p){
      if(!p || !p.fbKey || p.anulado) return;
      var v = resolverVenta(p);
      if(v && v.fbKey && !hasAny(p,['ventaFbKey','ventaKey'])){
        proponer('pagos',p,'ventaFbKey',v.fbKey,[['ventas',v]]);
        proponer('pagos',p,'ventaKey',v.fbKey,[['ventas',v]]);
      }
      var c = resolverCliente(p) || (v ? resolverCliente(v) : null);
      if(c && c.fbKey && !hasAny(p,['clienteFbKey','clienteKey'])){
        proponer('pagos',p,'clienteFbKey',c.fbKey,[['clientes',c],['ventas',v]]);
        proponer('pagos',p,'clienteKey',c.fbKey,[['clientes',c],['ventas',v]]);
      }
    });
    arr(window.otData || window.ordenesTrabajoData).forEach(function(o){
      if(!o || !o.fbKey) return;
      var v = resolverVenta(o);
      if(v && v.fbKey && !hasAny(o,['ventaFbKey','ventaKey'])){
        proponer('ordenes_trabajo',o,'ventaFbKey',v.fbKey,[['ventas',v]]);
        proponer('ordenes_trabajo',o,'ventaKey',v.fbKey,[['ventas',v]]);
      }
      var c = resolverCliente(o) || (v ? resolverCliente(v) : null);
      if(c && c.fbKey && !hasAny(o,['clienteFbKey','clienteKey'])){
        proponer('ordenes_trabajo',o,'clienteFbKey',c.fbKey,[['clientes',c],['ventas',v]]);
        proponer('ordenes_trabajo',o,'clienteKey',c.fbKey,[['clientes',c],['ventas',v]]);
      }
      if((o.origen === 'reclamo' || String(o.tipoVisita||'').toLowerCase().indexOf('reclamo') >= 0) && !o.reclamoKey) nota('OT '+(o.id||o.fbKey)+' parece reclamo pero requiere elegir reclamo original manualmente.');
    });
    arr(window.SP_DATA).forEach(function(r){
      if(!r || !r.fbKey) return;
      var c = resolverCliente(r);
      if(c && c.fbKey && !hasAny(r,['clienteFbKey','clienteKey'])){
        proponer('reclamos',r,'clienteFbKey',c.fbKey,[['clientes',c]]);
        proponer('reclamos',r,'clienteKey',c.fbKey,[['clientes',c]]);
      }
    });
    arr(window.prodData || window.productosData).forEach(function(p){
      if(!p || !p.fbKey) return;
      var c = resolverCategoria(p);
      if(c && c.fbKey && (p.categoria || p.categoriaId) && !hasAny(p,['categoriaFbKey','categoriaKey'])){
        proponer('productos',p,'categoriaFbKey',c.fbKey,[['categorias',c]]);
        proponer('productos',p,'categoriaKey',c.fbKey,[['categorias',c]]);
      }
    });
    return {
      version:'v2.0.15',
      fecha:new Date().toISOString(),
      totalCambios:Object.keys(updates).length,
      updates:updates,
      baselines:baselines,
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
  async function copiarTexto(txt, ok){
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ if(typeof notify==='function') notify(ok); });
    else await window.svPrompt('Copiar:', txt, { multilinea:true, filas:8 });
  }
  window.svCopiarAuditoriaRelaciones = function(){ copiarTexto(window.svInformeAuditoriaRelaciones(window._svUltimaAuditoriaRelaciones), 'Informe copiado'); };
  window.svCopiarPlanNormalizacionRelaciones = function(){
    var plan = window.svGenerarPlanNormalizacionRelaciones();
    copiarTexto(JSON.stringify(plan,null,2), 'Plan copiado ('+plan.totalCambios+' cambios)');
  };
  window.svArchivarAvisosHistoricosRelaciones = async function(){
    if(!window.tienePermiso('mantenimiento.normalizar')) { if(typeof notify==='function') notify('Solo el administrador puede archivar avisos'); return false; }
    if(!window.fbDB || !window.fbUpdate || !window.fbRef) { if(typeof notify==='function') notify('Sin conexion Firebase'); return false; }
    var res = window._svUltimaAuditoriaRelaciones || window.svAuditarRelaciones();
    var plan = window.svGenerarPlanNormalizacionRelaciones();
    var cls = clasificarAvisos(res, plan);
    if(!cls.historicos.length) { if(typeof notify==='function') notify('No hay avisos historicos para archivar'); return false; }
    if(!await window.svConfirm('Se archivaran '+cls.historicos.length+' aviso(s) historicos/manuales. No se borran datos ni se crean vinculos. Continuar?')) return false;
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
      ordenes_trabajo: [window.otData, window.ordenesTrabajoData],
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
  window.svAplicarPlanNormalizacionRelaciones = function(){
    if(window._svNormalizacionRelacionesPromesa)return window._svNormalizacionRelacionesPromesa;
    var uid=window.currentUserUid,auth=window.fbAuth && window.fbAuth.currentUser,role=window.currentRole,epoch=window._svOperacionesSesionEpoch||0,revision=window.PERMISOS_ROLES && window.PERMISOS_ROLES[role] && window.PERMISOS_ROLES[role].indiceRevision;
    var contexto=typeof window.svCapturarContextoOperacion==='function'?window.svCapturarContextoOperacion():function(){return true;};
    function vigente(){return !!uid && auth && auth.uid===uid && window.currentUserUid===uid && window.fbAuth && window.fbAuth.currentUser===auth && role==='admin' && window.currentRole===role && !window._impersonacionOriginal && (window._svOperacionesSesionEpoch||0)===epoch && (window.PERMISOS_ROLES && window.PERMISOS_ROLES[role] && window.PERMISOS_ROLES[role].indiceRevision)===revision && contexto() && window.tienePermiso('mantenimiento.normalizar');}
    var promesa=(async function(){
      if(!vigente()){if(typeof notify==='function')notify('Solo el administrador en su cuenta puede aplicar el plan');return false;}
      if(!window.fbDB || !window.SVLaborWrites || typeof window.SVLaborWrites.atomic!=='function'){if(typeof notify==='function')notify('Recargá la aplicación para normalizar con protección de cambios.');return false;}
      var auditoria=window.svAuditarRelaciones();
      if((auditoria.porSeveridad.critico||0)>0){if(typeof notify==='function')notify('No se aplica: hay avisos críticos para resolver primero.');return false;}
      var plan=window.svGenerarPlanNormalizacionRelaciones();
      if(!plan.totalCambios){if(typeof notify==='function')notify('No hay cambios seguros para aplicar');return false;}
      var stamp=Date.now(),key=String(stamp)+(window.crypto && typeof window.crypto.randomUUID==='function'?'_'+window.crypto.randomUUID():''),ruta='sisventas/mantenimiento/normalizaciones/'+key,paths=Object.keys(plan.baselines||{}).concat(ruta);
      if(paths.length>128){if(typeof notify==='function')notify('El plan supera 128 registros. Revisalo en un lote menor; no se guardó ningún cambio.');return false;}
      if(!await window.svConfirm('Se aplicarán '+plan.totalCambios+' cambio(s) de relaciones en una única confirmación. ¿Continuar?') || !vigente())return false;
      if(await window.svPrompt('Para confirmar escribí NORMALIZAR:')!=='NORMALIZAR' || !vigente())return false;
      var meta={version:plan.version,fecha:new Date(stamp).toISOString(),usuario:window.currentUser||'Admin',totalCambios:plan.totalCambios,notas:plan.notas||[]};
      var resultado=await window.SVLaborWrites.atomic({paths:paths,purpose:'relationship-normalization',build:function(values){if(!vigente())throw new Error('La sesión o el permiso cambió. Volvé a revisar el plan.');return construirNormalizacionRelaciones(plan,values,ruta,meta);}});
      if(!resultado || resultado.committed!==true)throw new Error('No se recibió la confirmación del plan. Revisá el estado antes de repetir.');
      if(vigente())try{
        planBackupSeguro(plan).forEach(function(x){marcarRutaVerificada(x.ruta,x.valor);aplicarUpdateEnMemoria(x.ruta,x.valor);});
        if(typeof window.registrarActividad==='function')window.registrarActividad('Normalización relaciones',plan.totalCambios+' cambio(s) aplicados');
        if(typeof notify==='function')notify('Normalización confirmada: '+plan.totalCambios+' cambio(s)');
        if(typeof window.mntLog==='function')window.mntLog('Plan confirmado: '+resumenPlan(plan));
        if(typeof window.svRenderAuditoriaRelaciones==='function')window.svRenderAuditoriaRelaciones();
      }catch(errorVista){if(window.console)console.warn('[Normalización] Guardado confirmado; vista pendiente de actualizar');}
      return true;
    })().catch(function(error){if(vigente() && typeof notify==='function')notify('No se confirmó la normalización: '+error.message);return false;}).finally(function(){if(window._svNormalizacionRelacionesPromesa===promesa)window._svNormalizacionRelacionesPromesa=null;});
    window._svNormalizacionRelacionesPromesa=promesa;return promesa;
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
      '<span class="badge '+(grupos.criticos.length?'b-red':(plan.totalCambios?'b-amber':'b-green'))+'">'+(grupos.criticos.length?'Revisar críticos':(plan.totalCambios?'Plan seguro disponible':'Sin automáticos pendientes'))+'</span>'+
      '<span style="font-size:12px;color:var(--text3);align-self:center">Críticos: '+grupos.criticos.length+' · Automáticos: '+plan.totalCambios+' · Históricos/manuales: '+grupos.historicos.length+(grupos.archivados.length?' · Archivados: '+grupos.archivados.length:'')+'</span>'+
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













