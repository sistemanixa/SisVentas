(function () {
  'use strict';

  var detalleActual = null;
  var movimientosDetalle = {};
  var guardandoDetalle = false;
  var formatoMoneda = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  function moneda(valor) {
    return '$' + formatoMoneda.format(parseFloat(valor) || 0);
  }

  function esc(valor) {
    if (typeof window.escapeHTML === 'function') return window.escapeHTML(String(valor == null ? '' : valor));
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; });
  }


  function commissionPresentation(){return window.SVCommissionPresentation;}
  function commissionCaption(record){var api=commissionPresentation();return api&&typeof api.caption==='function'?api.caption(record):'Comisión';}
  function realCommissionAdmin(){return String(window.currentRole||'').toLowerCase()==='admin'&&!window._impersonacionOriginal&&typeof window.permisoModulo==='function'&&window.permisoModulo('comisiones');}

  function ownCommissionItems(items){
    var own=typeof window.svEmpleadoPropio==='function'?window.svEmpleadoPropio():null,key=String(own&&(own.fbKey||own.id)||'');if(!key)return [];
    return items.filter(function(g){
      var first=String(g.empleadoFbKey||''),second=String(g.empleadoId||''),legacy=String(g.legacyKey||'').match(/^ctaemp\/([^/]+)\/[^/]+$/),owner=first||second||(legacy&&legacy[1])||'';
      if(first&&second&&first!==second||owner!==key)return false;
      var state=typeof window._ctaEmpEstadoDesdeGasto==='function'?window._ctaEmpEstadoDesdeGasto(g):String(estado(g)||'').toLowerCase();
      return ['aprobado','pagado','pagado_parcial'].indexOf(state)>=0||state==='pendiente_pago'&&!!(g.aprobadoTs||g.aprobadoPor||g.fechaAprobacion);
    });
  }
  var ultimaListaPersonal=null,ultimoDetallePersonal=null;
  function estadoDatosComisionesPersonales(){
    var own=window.svEmpleadoPropio&&window.svEmpleadoPropio(),role=window.currentRole,view=window._impersonacionOriginal;
    return {ready:window._gastosDataReady,error:window._gastosCargaError,origin:window._ctaEmpGastosOrigen,sourceReady:fuenteComisionesLista(),management:gestionDelegadaComisiones(),approval:!!(window.tienePermiso&&window.tienePermiso('comisiones.aprobar')),payment:!!(window.tienePermiso&&window.tienePermiso('gastos.pagar')),auth:window.fbAuth&&window.fbAuth.currentUser,authUid:window.fbAuth&&window.fbAuth.currentUser&&window.fbAuth.currentUser.uid,uid:window.currentUserUid,role:role,view:view,profile:view&&view.usuarioFbKey,employeeId:String(own&&(own.fbKey||own.id)||''),revision:window.PERMISOS_ROLES&&window.PERMISOS_ROLES[role]&&window.PERMISOS_ROLES[role].indiceRevision,permissions:JSON.stringify(window.PERMISOS_ROLES&&window.PERMISOS_ROLES[role]||null),epoch:window._svOperacionesSesionEpoch||0,dataEpoch:window._svDataEpoch||0,data:window.gastosData};
  }
  function mismosDatosComisionesPersonales(first,second){return !!first&&Object.keys(second).every(function(key){return first[key]===second[key];});}
  function gestionDelegadaComisiones(){
    var role=String(window.currentRole||'').trim(),config=window.PERMISOS_ROLES&&window.PERMISOS_ROLES[role],known=['admin','administrativo','vendedor','tecnico','tecnico_vendedor'].indexOf(role)>=0||!!(config&&typeof config==='object'&&!Array.isArray(config));
    if(!role||!known||typeof window.tienePermiso!=='function'||typeof window.permisoModulo!=='function')return false;
    var page=typeof document.querySelector==='function'&&document.querySelector('.page.active'),name=page&&String(page.id||'').replace(/^page-/,'');if(['gastos','comisiones','ctaemp'].indexOf(name)<0)name='comisiones';
    return window.permisoModulo(name)&&(window.tienePermiso('comisiones.aprobar')||window.tienePermiso('gastos.pagar'));
  }
  function fuenteComisionesLista(){var origin=window._ctaEmpGastosOrigen;return window._gastosDataReady!==false&&!window._gastosCargaError&&(!origin||typeof origin.valid==='function'&&origin.valid());}
  function itemsDetalleSeguro(items){if(!fuenteComisionesLista())return [];return gestionDelegadaComisiones()?items.filter(esComision):ownCommissionItems(items);}
  function accionesGestionComision(g){
    if(!gestionDelegadaComisiones())return '';var state=estado(g),key=esc(g.fbKey),buttons=[];
    if(window.tienePermiso('comisiones.aprobar')){
      if(state==='pendiente_aprobacion')buttons.push('<button class="btn btn-sm" onclick="aprobarComisionGestion(\''+key+'\')">Aprobar</button>');
      if(state==='pendiente_aprobacion'||state==='pendiente_pago')buttons.push('<button class="btn btn-sm" onclick="rechazarComisionGestion(\''+key+'\')">'+(state==='pendiente_pago'?'Revertir aprobación':'Rechazar')+'</button>');
      if(state==='rechazado')buttons.push('<button class="btn btn-sm" onclick="rehabilitarComision(\''+key+'\')">Rehabilitar</button>');
    }
    if(window.tienePermiso('gastos.pagar')&&['pendiente_pago','pagado_parcial','aprobado'].indexOf(state)>=0&&typeof window.abrirPagoGasto==='function')buttons.push('<button class="btn btn-sm" onclick="abonarComisionGestion(\''+key+'\')">Abonar</button>');
    return buttons.join(' ');
  }
  function abonarComisionGestion(key){
    if(!gestionDelegadaComisiones()||!window.tienePermiso('gastos.pagar')||typeof window.abrirPagoGasto!=='function')return;
    var g=(window.gastosData||[]).find(function(item){return item.fbKey===key;});if(!g||!esComision(g)||['pendiente_pago','pagado_parcial','aprobado'].indexOf(estado(g))<0)return;
    cerrarDetalleComision();return window.abrirPagoGasto(key);
  }
  var adminTableHeader=null;
  function commissionTableHeader(personal){
    var table=document.getElementById('comisiones-tbl'),head=table&&typeof table.querySelector==='function'&&table.querySelector('thead');if(!head)return;
    if(adminTableHeader===null)adminTableHeader=head.innerHTML;
    head.innerHTML=personal?'<tr><th>Venta</th><th>Cliente</th><th>Comisión</th>'+(gestionDelegadaComisiones()?'<th>Empleado</th><th>Estado</th><th>Acciones</th>':'')+'</tr>':adminTableHeader;
  }
  function personalCommissionRow(g){
    var api=commissionPresentation(),id=api&&typeof api.saleId==='function'?api.saleId(g):'',client=id&&api&&typeof api.clientName==='function'?api.clientName(g):'',amount=parseFloat(g.monto);
    var manage=gestionDelegadaComisiones();
    return '<tr><td data-label="Venta">'+esc(id?'#'+id:'Comisión')+'</td><td data-label="Cliente">'+esc(client)+'</td><td data-label="Comisión"><strong>'+(Number.isFinite(amount)?moneda(amount):'Importe no disponible')+'</strong></td>'+(manage?'<td data-label="Empleado">'+esc(g.empleadoNombre||'Sin asignar')+'</td><td data-label="Estado">'+badgeEstado(estado(g))+'</td><td data-label="Acciones">'+accionesGestionComision(g)+'</td>':'')+'</tr>';
  }
  function renderPersonalCommissionList(){
    commissionTableHeader(true);var body=document.getElementById('comisiones-tbody'),items=itemsDetalleSeguro((window.gastosData||[]).filter(esComision));
    var own=window.svEmpleadoPropio&&window.svEmpleadoPropio();
    var empty=window._gastosCargaError?'No se pudieron cargar las comisiones.':!fuenteComisionesLista()?'Cargando las comisiones…':own||gestionDelegadaComisiones()?'Sin comisiones confirmadas':'Esperando los datos de tu cuenta…';
    if(body)body.innerHTML=items.length?items.map(personalCommissionRow).join(''):'<tr><td colspan="'+(gestionDelegadaComisiones()?6:3)+'" style="text-align:center;padding:24px;color:var(--text3)">'+empty+'</td></tr>';
    ['pendientes','aprobadas','rechazadas','total'].forEach(function(id){var value=document.getElementById('com-kpi-'+id),sub=document.getElementById('com-kpi-'+id+'-sub');if(value)value.textContent='—';if(sub)sub.textContent='';});
    ultimaListaPersonal=estadoDatosComisionesPersonales();
  }
  var detallePersonalFoco=null,detallePersonalClave='';
  function prepararFocoDetallePersonal(){
    var modal=document.getElementById('modal-comision-gestion');if(!modal||typeof modal.querySelectorAll!=='function')return;
    if(detallePersonalFoco){if(!detallePersonalFoco.employeeId)detallePersonalFoco.employeeId=String((window.svEmpleadoPropio&&window.svEmpleadoPropio()||{}).fbKey||'');return;}
    var opener=document.activeElement,role=window.currentRole,uid=window.currentUserUid,auth=window.fbAuth&&window.fbAuth.currentUser,authUid=auth&&auth.uid,view=window._impersonacionOriginal,epoch=window._svOperacionesSesionEpoch||0,check=typeof window.svCapturarContextoOperacion==='function'?window.svCapturarContextoOperacion():function(){return true;};
    var state={modal:modal,opener:opener,employeeId:String((window.svEmpleadoPropio&&window.svEmpleadoPropio()||{}).fbKey||'')};
    state.valid=function(){var own=window.svEmpleadoPropio&&window.svEmpleadoPropio();return check()&&role===window.currentRole&&uid===window.currentUserUid&&auth===(window.fbAuth&&window.fbAuth.currentUser)&&authUid===(auth&&auth.uid)&&view===window._impersonacionOriginal&&epoch===(window._svOperacionesSesionEpoch||0)&&(!state.employeeId||String(own&&own.fbKey||'')===state.employeeId);};
    function controls(){return Array.from(modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function(el){return el.getClientRects().length&&!el.closest('[inert]');});}
    state.keyboard=function(event){
      if(detallePersonalFoco!==state||event.isComposing||event.defaultPrevented||modal.classList.contains('sv-modal-underlay')||!modal.contains(event.target))return;
      if(!state.valid()){cerrarDetalleComision();return;}
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cerrarDetalleComision();return;}
      if(event.key!=='Tab')return;
      var items=controls(),first=items[0],last=items[items.length-1];
      if(first&&(!modal.contains(document.activeElement)||event.shiftKey&&document.activeElement===first||!event.shiftKey&&document.activeElement===last)){event.preventDefault();(event.shiftKey?last:first).focus({preventScroll:true});}
    };
    detallePersonalFoco=state;document.addEventListener('keydown',state.keyboard,true);
    var close=modal.querySelector('.modal-head button');if(close)close.setAttribute('aria-label','Cerrar comisión');
    if(typeof window.svSincronizarPilaModales==='function')window.svSincronizarPilaModales();
    var items=controls();if(items[0])items[0].focus({preventScroll:true});
  }
  function limpiarComisionesDeSesion(){
    ultimaListaPersonal=null;ultimoDetallePersonal=null;cerrarDetalleComision();var body=document.getElementById('comisiones-tbody');if(body)body.innerHTML='';
    ['pendientes','aprobadas','rechazadas','total'].forEach(function(id){var value=document.getElementById('com-kpi-'+id),sub=document.getElementById('com-kpi-'+id+'-sub');if(value)value.textContent='—';if(sub)sub.textContent='';});
  }
  function repintarComisionesPersonalesTrasDatos(){
    if(detallePersonalFoco&&!detallePersonalFoco.valid()){cerrarDetalleComision();return;}
    if(realCommissionAdmin()||document.hidden)return;
    var state=estadoDatosComisionesPersonales(),page=typeof document.querySelector==='function'&&document.querySelector('.page.active');
    if(page&&page.id==='page-comisiones'&&!mismosDatosComisionesPersonales(ultimaListaPersonal,state))renderPersonalCommissionList();
    if(detallePersonalClave&&!mismosDatosComisionesPersonales(ultimoDetallePersonal,state)){var group=grupos().find(function(item){return item.clave===detallePersonalClave;});if(group)pintarDetallePersonal(group);else cerrarDetalleComision();}
  }
  function pintarDetallePersonal(group){
    group=group||detalleActual;if(!group)return;
    var title=document.getElementById('com-det-titulo'),sub=document.getElementById('com-det-sub'),info=document.getElementById('com-det-info'),items=itemsDetalleSeguro(group.items),api=commissionPresentation();
    if(title)title.textContent='Comisión';if(sub)sub.textContent='';
    if(info)info.innerHTML=items.length?'<table style="width:100%;border-collapse:collapse"><thead><tr><th>Venta</th><th>Cliente</th><th>Comisión</th>'+(gestionDelegadaComisiones()?'<th>Empleado</th><th>Estado</th><th>Acciones</th>':'')+'</tr></thead><tbody>'+items.map(personalCommissionRow).join('')+'</tbody></table>':'No se encontró una comisión confirmada de tu cuenta.';
    ['com-det-participantes','com-det-agregar'].forEach(function(id){var el=document.getElementById(id);if(el)el.innerHTML='';});
    var save=document.getElementById('com-det-guardar');if(save){save.disabled=true;save.style.display='none';}
    prepararFocoDetallePersonal();ultimoDetallePersonal=estadoDatosComisionesPersonales();
  }

  function esComision(gasto) {
    var api=commissionPresentation();if(api&&typeof api.isCommission==='function')return api.isCommission(gasto);
    return String((gasto && (gasto.tipoPagable || gasto.origen || gasto.tipo)) || '').toLowerCase().indexOf('comisi') >= 0;
  }

  function estado(gasto) {
    return typeof window.normalizarEstadoGasto === 'function' ? window.normalizarEstadoGasto(gasto) : String(gasto.estado || 'pendiente_aprobacion');
  }

  function claveGrupo(gasto) {
    return String(gasto.ventaFbKey || gasto.ventaId || ('sinventa:' + gasto.fbKey));
  }

  function porcentaje(gasto, movimiento) {
    var directo = parseFloat((movimiento && movimiento.pct) || gasto.pct || gasto.porcentaje);
    if (directo > 0) return directo;
    var match = String((movimiento && movimiento.descripcion) || gasto.descripcion || '').match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
    return match ? (parseFloat(match[1].replace(',', '.')) || 0) : 0;
  }

  function baseGanancia(gasto, movimiento) {
    var base = parseFloat((movimiento && movimiento.gananciaBase) || gasto.gananciaBase);
    if (base > 0) return base;
    var pct = porcentaje(gasto, movimiento);
    return pct > 0 ? (parseFloat(gasto.monto) || 0) * 100 / pct : 0;
  }

  function ventaDelGrupo(grupo) {
    if (!grupo) return null;
    return (window.ventasList || []).find(function (venta) {
      return (grupo.ventaFbKey && String(venta.fbKey || '') === String(grupo.ventaFbKey)) ||
        (grupo.ventaId && String(venta.id || venta.numero || '') === String(grupo.ventaId));
    }) || null;
  }

  function grupos() {
    var mapa = {};
    (window.gastosData || []).filter(esComision).forEach(function (gasto) {
      var clave = claveGrupo(gasto);
      if (!mapa[clave]) mapa[clave] = { clave:clave, items:[], ventaId:gasto.ventaId || '', ventaFbKey:gasto.ventaFbKey || '', cliente:gasto.cliente || '', fecha:gasto.fecha || '' };
      mapa[clave].items.push(gasto);
      if (!mapa[clave].ventaId) mapa[clave].ventaId = gasto.ventaId || '';
      if (!mapa[clave].ventaFbKey) mapa[clave].ventaFbKey = gasto.ventaFbKey || '';
      if (!mapa[clave].cliente) mapa[clave].cliente = gasto.cliente || '';
    });
    return Object.values(mapa).sort(function (a,b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')); });
  }

  function estadoGrupo(grupo) {
    var estados = grupo.items.map(estado);
    if (estados.indexOf('pendiente_aprobacion') >= 0) return 'pendiente_aprobacion';
    if (estados.indexOf('pendiente_pago') >= 0) return 'pendiente_pago';
    if (estados.indexOf('pagado_parcial') >= 0) return 'pagado_parcial';
    if (estados.indexOf('pagado') >= 0) return 'pagado';
    if (estados.every(function (e) { return e === 'rechazado'; })) return 'rechazado';
    return estados[0] || 'pendiente_aprobacion';
  }

  function badgeEstado(valor) {
    var datos = {
      pendiente_aprobacion:['b-amber','Pendiente de aprobación'], pendiente_pago:['b-blue','Aprobada · falta pagar'],
      pagado_parcial:['b-amber','Pago parcial'], pagado:['b-green','Pagada'], rechazado:['b-red','Rechazada']
    }[valor] || ['b-blue',valor];
    return '<span class="badge ' + datos[0] + '">' + esc(datos[1]) + '</span>';
  }

  function coincideEstadoFiltro(grupo, filtro) {
    var actual = estadoGrupo(grupo);
    if (!filtro) return true;
    if (filtro === 'aprobadas') return actual === 'pendiente_pago' || actual === 'pagado_parcial';
    return actual === filtro;
  }

  function montoGrupo(grupo) {
    return grupo.items.reduce(function (s, item) { return s + (parseFloat(item.monto) || 0); }, 0);
  }

  function motivoRechazoGrupo(grupo) {
    return grupo.items.map(function (item) { return String(item.motivoRechazo || '').trim(); }).filter(Boolean).filter(function (motivo, indice, lista) { return lista.indexOf(motivo) === indice; }).join(' · ');
  }

  function actualizarKpi(id, gruposKpi, leyenda) {
    var valor = document.getElementById('com-kpi-' + id);
    var detalle = document.getElementById('com-kpi-' + id + '-sub');
    if (valor) valor.textContent = moneda(gruposKpi.reduce(function (s, grupo) { return s + montoGrupo(grupo); }, 0));
    if (detalle) detalle.textContent = gruposKpi.length + ' ' + (gruposKpi.length === 1 ? 'comisión' : 'comisiones') + ' · ' + leyenda;
  }

  function filtrarComisionesPorEstado(filtro) {
    var select = document.getElementById('com-f-estado');
    if (select) select.value = filtro || '';
    renderModuloComisiones();
  }

  function actualizarBadgeComisiones(gruposActuales) {
    var badge = document.getElementById('badge-nav-comisiones');
    if (!badge) return;
    var permitido = typeof window.tienePermiso === 'function' && window.tienePermiso('comisiones.aprobar');
    var cantidad = 0;
    if (permitido && Array.isArray(gruposActuales)) {
      cantidad = gruposActuales.filter(function(g) { return estadoGrupo(g) === 'pendiente_aprobacion'; }).length;
    } else if (permitido) {
      // El badge necesita ventas pendientes, no construir y ordenar sus detalles.
      var pendientes = new Set();
      (window.gastosData || []).forEach(function(gasto) {
        if (esComision(gasto) && estado(gasto) === 'pendiente_aprobacion') pendientes.add(claveGrupo(gasto));
      });
      cantidad = pendientes.size;
    }
    badge.textContent = cantidad;
    badge.style.display = cantidad ? '' : 'none';
  }

  function registroComparable(record){
    var copy=Object.assign({},record||{});delete copy.fbKey;delete copy.empFbKey;delete copy.movFbKey;return copy;
  }
  function detalleVigente(raiz,grupo,movimientos){
    var actuales=Object.entries(raiz.gastos||{}).map(function(e){return Object.assign({},e[1],{fbKey:e[0]});}).filter(function(g){return esComision(g)&&claveGrupo(g)===grupo.clave;});
    return actuales.length===grupo.items.length && grupo.items.every(function(g){
      var actual=actuales.find(function(x){return x.fbKey===g.fbKey;});
      if(!actual||!window.SVGuardedWrites.equal(registroComparable(actual),registroComparable(g)))return false;
      var mov=movimientos[g.fbKey];
      return !mov||window.SVGuardedWrites.equal(registroComparable(((raiz.ctaemp||{})[mov.empFbKey]||{})[mov.movFbKey]),registroComparable(mov));
    });
  }
  function comprobarDetalleAbierto(){
    if(!detalleActual||guardandoDetalle||!window.SVGuardedWrites)return;
    var actual=grupos().find(function(g){return g.clave===detalleActual.clave;});
    if(!actual||!window.SVGuardedWrites.equal(actual.items,detalleActual.items)){
      var info=document.getElementById('com-det-info');if(info)info.textContent='Esta comisión cambió. Cerrá y volvé a abrir el detalle para revisar los valores actuales.';
      var guardar=document.getElementById('com-det-guardar');if(guardar)guardar.disabled=true;
    }
  }
  function puedeVerCuentasAnteriores() {
    return typeof window.tienePermiso === 'function' && window.tienePermiso('mantenimiento.normalizar') &&
      window.tienePermiso('empleados.verCuentas') && typeof window.permisoModulo === 'function' && window.permisoModulo('ctaemp');
  }
  function actualizarAvisoCuentasAnteriores() {
    var aviso = document.getElementById('comisiones-cuentas-anteriores');
    var permitido = typeof window.tienePermiso === 'function' && window.tienePermiso('mantenimiento.normalizar');
    if (!permitido) { if (aviso) aviso.remove(); return; }
    if (!aviso) {
      var tabla = document.getElementById('comisiones-tbl');
      var contenedor = tabla && typeof tabla.closest === 'function' && tabla.closest('.table-wrap');
      if (!contenedor || !contenedor.parentNode) return;
      aviso = document.createElement('div');
      aviso.id = 'comisiones-cuentas-anteriores';
      aviso.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:10px 14px;border-bottom:0.5px solid var(--border);color:var(--text3);font-size:11px';
      contenedor.parentNode.insertBefore(aviso, contenedor);
    }
    aviso.innerHTML = '<span>Las comisiones anteriores sin incorporar se consultan en Cuentas de empleados.</span>' +
      (puedeVerCuentasAnteriores() ? '<button type="button" class="btn btn-sm" onclick="verCuentasAnterioresComisiones()"><i class="ti ti-users"></i> Ver cuentas</button>' : '');
  }
  function verCuentasAnterioresComisiones() {
    if (!puedeVerCuentasAnteriores() || typeof window.svNavegarDirecto !== 'function') return false;
    return window.svNavegarDirecto('ctaemp');
  }
  function renderModuloComisiones() {
    if(!realCommissionAdmin()){cerrarDetalleComision();var notice=document.getElementById('comisiones-cuentas-anteriores');if(notice){if(typeof notice.remove==='function')notice.remove();else notice.innerHTML='';}renderPersonalCommissionList();return;}
    commissionTableHeader(false);
    comprobarDetalleAbierto();
    var tbody = document.getElementById('comisiones-tbody');
    if (!tbody) return;
    // Consultar la lista nunca incorpora ni modifica comisiones históricas.
    // Las cuentas conservan esos registros y Mantenimiento su migración explícita.
    actualizarAvisoCuentasAnteriores();
    var buscar = String((document.getElementById('com-f-buscar') || {}).value || '').toLowerCase();
    var filtroEstado = String((document.getElementById('com-f-estado') || {}).value || '');
    var todos = grupos();
    var lista = todos.filter(function (grupo) {
      var texto = [grupo.ventaId, grupo.cliente].concat(grupo.items.map(function (g) { return g.empleadoNombre || g.descripcion || ''; })).join(' ').toLowerCase();
      return (!buscar || texto.indexOf(buscar) >= 0) && coincideEstadoFiltro(grupo, filtroEstado);
    });
    actualizarKpi('pendientes', todos.filter(function (g) { return estadoGrupo(g) === 'pendiente_aprobacion'; }), 'requieren decisión');
    actualizarKpi('aprobadas', todos.filter(function (g) { return coincideEstadoFiltro(g, 'aprobadas'); }), 'listas para abonar');
    actualizarKpi('rechazadas', todos.filter(function (g) { return estadoGrupo(g) === 'rechazado'; }), 'se pueden rehabilitar');
    actualizarKpi('total', todos.filter(function (g) { return estadoGrupo(g) !== 'rechazado'; }), 'comisiones vigentes');
    actualizarBadgeComisiones(todos);
    tbody.innerHTML = lista.length ? lista.map(function (grupo) {
      var activos = grupo.items.filter(function (g) { return estado(g) !== 'rechazado'; });
      var pct = activos.reduce(function (s,g) { return s + porcentaje(g); }, 0);
      var monto = activos.reduce(function (s,g) { return s + (parseFloat(g.monto) || 0); }, 0);
      var participantes = grupo.items.map(function (g) { return '<span class="badge ' + (estado(g)==='rechazado'?'b-red':'b-blue') + '">' + esc(g.empleadoNombre || 'Sin asignar') + '</span>'; }).join(' ');
      var motivo = estadoGrupo(grupo) === 'rechazado' ? motivoRechazoGrupo(grupo) : '';
      return '<tr onclick="abrirDetalleComision(\'' + esc(grupo.clave) + '\')" style="cursor:pointer">' +
        '<td data-label="Fecha">' + esc(String(grupo.fecha || '').split('-').reverse().join('/')) + '</td>' +
        '<td data-label="Venta / cliente"><strong style="color:var(--blue)">' + esc(grupo.ventaId || 'Sin venta') + '</strong><div style="font-size:11px;color:var(--text3);margin-top:3px">' + esc(window.nombreClienteVigente ? window.nombreClienteVigente(grupo, 'Cliente no informado') : grupo.cliente || 'Cliente no informado') + '</div></td>' +
        '<td data-label="Participantes">' + participantes + '</td><td data-label="Reparto">' + pct.toLocaleString('es-AR') + '%</td>' +
        '<td class="tr" data-label="Total"><strong>' + moneda(monto) + '</strong></td><td data-label="Estado">' + badgeEstado(estadoGrupo(grupo)) + (motivo?'<div style="font-size:11px;color:var(--red);margin-top:5px;max-width:240px" title="'+esc(motivo)+'"><strong>Motivo:</strong> '+esc(motivo)+'</div>':'') + '</td>' +
        '<td data-label="Acciones"><button class="btn btn-sm btn-icon" onclick="event.stopPropagation();abrirDetalleComision(\'' + esc(grupo.clave) + '\')" title="Gestionar comisión"><i class="ti ti-adjustments"></i></button></td></tr>';
    }).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3)">No hay comisiones para estos filtros</td></tr>';
    if (window.SisVentas && window.SisVentas.prepareResizablePage) window.SisVentas.prepareResizablePage(document.getElementById('page-comisiones'));
  }

  async function cargarMovimiento(gasto) {
    if (!gasto || !gasto.legacyKey || !window.fbDB) return null;
    var match = String(gasto.legacyKey).match(/^ctaemp\/([^/]+)\/([^/]+)$/);
    if (!match) return null;
    var snap = await window.fbGet(window.fbRef(window.fbDB, 'sisventas/ctaemp/' + match[1] + '/' + match[2]));
    return Object.assign({ empFbKey:match[1], movFbKey:match[2] }, snap.val() || {});
  }

  async function abrirDetalleComision(clave) {
    detalleActual = grupos().find(function (g) { return g.clave === String(clave); }) || null;
    if (!detalleActual) { window.notify('No se encontró la comisión'); return; }
    movimientosDetalle = {};
    var grupoCargando = detalleActual;
    var modal = document.getElementById('modal-comision-gestion');
    var info = document.getElementById('com-det-info');
    if (info) info.textContent = 'Cargando detalle de la comisión…';
    ['com-det-participantes','com-det-agregar'].forEach(function(id) { var el=document.getElementById(id); if(el) el.innerHTML=''; });
    var guardar = document.getElementById('com-det-guardar');
    if (guardar) guardar.disabled = true;
    if (modal) modal.style.display = 'flex';
    if(!realCommissionAdmin()){detallePersonalClave=detalleActual.clave;pintarDetallePersonal();detalleActual=null;movimientosDetalle={};return;}
    if(guardar)guardar.style.display='';
    try {
      var movimientos = await Promise.all(grupoCargando.items.map(cargarMovimiento));
      if (detalleActual !== grupoCargando) return;
      grupoCargando.items.forEach(function(g,i) { movimientosDetalle[g.fbKey] = movimientos[i]; });
      pintarDetalle();
      if (guardar) guardar.disabled = false;
    } catch (error) {
      console.error('No se pudo cargar el detalle de la comisión', error);
      if (detalleActual !== grupoCargando) return;
      if (info) info.textContent = 'No se pudo cargar el detalle. Cerrá esta ventana e intentá nuevamente.';
      window.notify('No se pudo consultar la comisión. Podés seguir en el listado e intentar nuevamente.');
      return;
    }
  }

  function pintarDetalle() {
    if (!detalleActual) return;
    if(!realCommissionAdmin()){detallePersonalClave=detalleActual.clave;pintarDetallePersonal();detalleActual=null;movimientosDetalle={};return;}
    var maxPct = parseFloat((window.APROBACION_CONFIG && window.APROBACION_CONFIG.maxComisionPct) || 10) || 10;
    var titulo = document.getElementById('com-det-titulo'); if (titulo) titulo.textContent = 'Comisión ' + (detalleActual.ventaId || 'sin venta');
    var sub = document.getElementById('com-det-sub'); if (sub) sub.textContent = window.nombreClienteVigente ? window.nombreClienteVigente(detalleActual, 'Cliente no informado') : detalleActual.cliente || 'Cliente no informado';
    var activos = detalleActual.items.filter(function (g) { return estado(g) !== 'rechazado'; });
    var suma = activos.reduce(function (s,g) { return s + porcentaje(g, movimientosDetalle[g.fbKey]); }, 0);
    var base = detalleActual.items.reduce(function (valor,g) { return valor || baseGanancia(g, movimientosDetalle[g.fbKey]); }, 0);
    var info = document.getElementById('com-det-info');
    var venta=ventaDelGrupo(detalleActual); var calculo=venta&&typeof window._calcularBaseComisionVenta==='function'?window._calcularBaseComisionVenta(venta):null;
    var neto=calculo?calculo.baseNeta:0; var costo=calculo?calculo.costoTotal:Math.max(0,neto-base); var descuento=calculo?calculo.descuento:0;
    var margenAntes=neto>0?base/neto*100:0;
    if (info) info.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><strong>Resumen de la venta</strong><span style="font-size:11px;color:var(--text3)">La comisión excluye el ahorro posterior en compras.</span>'+(detalleActual.ventaId?'<button class="btn btn-sm" onclick="abrirVentaDesdeComisiones()"><i class="ti ti-external-link"></i> Ver venta</button>':'')+'</div><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding-bottom:10px;border-bottom:0.5px solid var(--border)"><div><span style="font-size:10px;color:var(--text3)">VENTA NETA</span><strong style="display:block;margin-top:3px">'+moneda(neto)+'</strong></div><div><span style="font-size:10px;color:var(--text3)">DESCUENTO</span><strong style="display:block;margin-top:3px;color:var(--red)">'+moneda(descuento)+'</strong></div><div><span style="font-size:10px;color:var(--text3)">COSTO</span><strong style="display:block;margin-top:3px">'+moneda(costo)+'</strong></div><div><span style="font-size:10px;color:var(--text3)">MARGEN ORIGINAL</span><strong style="display:block;margin-top:3px">'+margenAntes.toLocaleString('es-AR',{maximumFractionDigits:1})+'%</strong></div></div><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding-top:10px"><div><span style="font-size:10px;color:var(--text3)">GANANCIA BASE</span><strong style="display:block;margin-top:3px">' + moneda(base) + '</strong></div><div><span style="font-size:10px;color:var(--text3)">REPARTO ACTIVO</span><strong id="com-resumen-reparto" style="display:block;margin-top:3px;color:' + (suma>maxPct?'var(--red)':'var(--green)') + '">' + suma.toLocaleString('es-AR') + '% / ' + maxPct + '%</strong></div><div><span style="font-size:10px;color:var(--text3)">COMISIONES</span><strong id="com-resumen-monto" style="display:block;margin-top:3px;color:var(--amber)">'+moneda(base*suma/100)+'</strong></div><div><span style="font-size:10px;color:var(--text3)">MARGEN DESPUÉS</span><strong id="com-resumen-margen" data-neto="'+neto+'" data-ganancia="'+base+'" data-max="'+maxPct+'" style="display:block;margin-top:3px">—</strong></div></div>';
    var cont = document.getElementById('com-det-participantes');
    if (cont) cont.innerHTML = detalleActual.items.map(function (g) {
      var est = estado(g); var pct = porcentaje(g, movimientosDetalle[g.fbKey]); var pagada = est === 'pagado' || est === 'pagado_parcial';
      return '<div class="comision-participante" data-gasto="' + esc(g.fbKey) + '" data-estado="'+esc(est)+'" style="display:grid;grid-template-columns:minmax(150px,1fr) 100px 120px auto;gap:8px;align-items:center;padding:10px 0;border-bottom:0.5px solid var(--border)">' +
        '<div><strong>' + esc(g.empleadoNombre || 'Sin asignar') + '</strong>' + (est==='rechazado'?'<div style="font-size:11px;color:var(--red);margin-top:4px"><strong>Motivo:</strong> '+esc(g.motivoRechazo || 'Sin motivo registrado')+'</div>':'') + '</div>' +
        '<label class="comision-porcentaje"><input class="search-input comision-pct-input" aria-label="Porcentaje de ' + esc(g.empleadoNombre || 'participante') + '" data-gasto="' + esc(g.fbKey) + '" type="number" min="0.1" max="' + maxPct + '" step="0.1" value="' + pct + '" ' + (pagada?'disabled':'') + ' oninput="actualizarResumenMargenComision()">%</label>' +
        '<strong class="comision-monto-preview" data-base="'+baseGanancia(g, movimientosDetalle[g.fbKey])+'">' + moneda(g.monto) + '</strong><div style="display:flex;gap:5px;justify-content:flex-end">' + badgeEstado(est) +
        (est === 'pendiente_aprobacion' ? '<button class="btn btn-sm" title="Aprobar esta participación" onclick="aprobarComisionGestion(\''+esc(g.fbKey)+'\')" style="color:var(--green);border-color:var(--green)"><i class="ti ti-check"></i> Aprobar</button>' : '') +
        ((est === 'pendiente_aprobacion' || est === 'pendiente_pago') ? '<button class="btn btn-sm" title="Rechazar esta participación" onclick="rechazarComisionGestion(\''+esc(g.fbKey)+'\')" style="color:var(--red);border-color:var(--red)"><i class="ti ti-x"></i> Rechazar</button>' : '') +
        (est === 'rechazado' ? '<button class="btn btn-sm" onclick="rehabilitarComision(\''+esc(g.fbKey)+'\')"><i class="ti ti-restore"></i> Rehabilitar</button>' : '') + '</div></div>';
    }).join('');
    var existentes = {};
    detalleActual.items.forEach(function (g) { existentes[String(g.empleadoFbKey || g.empleadoId || '')] = true; });
    var empleados = Object.values(window.empData || {}).filter(function (e) { return e && e.activo !== false && !existentes[String(e.fbKey || '')]; });
    var agregar = document.getElementById('com-det-agregar');
    if (agregar) agregar.innerHTML = '<div style="font-size:12px;font-weight:700;margin-bottom:8px">Agregar participante</div><div style="display:grid;grid-template-columns:minmax(180px,1fr) 110px auto;gap:8px"><select id="com-nuevo-empleado" class="search-input"><option value="">Seleccionar persona...</option>' + empleados.map(function(e){return '<option value="'+esc(e.fbKey)+'">'+esc(e.nombre||'Sin nombre')+'</option>';}).join('') + '</select><label class="comision-porcentaje"><input class="search-input" aria-label="Porcentaje del nuevo participante" id="com-nuevo-pct" type="number" min="0.1" max="'+maxPct+'" step="0.1" placeholder="0" oninput="actualizarResumenMargenComision()">%</label><button class="btn" onclick="agregarParticipanteComision()"><i class="ti ti-user-plus"></i> Agregar</button></div>';
    if(info){var costoLabor=calculo&&calculo.costoManoObra;info.innerHTML+='<div class="comision-costo-labor"><span>COSTO DE MANO DE OBRA</span><strong>'+(costoLabor!==null&&costoLabor!==undefined?moneda(costoLabor):'Sin desglose registrado')+'</strong></div>';}
    actualizarResumenMargenComision();
  }

  function actualizarResumenMargenComision(){
    var margen=document.getElementById('com-resumen-margen');if(!margen)return;
    document.querySelectorAll('#com-det-participantes .comision-participante').forEach(function(fila){
      var input=fila.querySelector('.comision-pct-input');var importe=fila.querySelector('.comision-monto-preview');
      if(input && importe && !input.disabled)importe.textContent=moneda(Math.round((parseFloat(importe.dataset.base)||0)*(parseFloat(input.value)||0))/100);
    });
    var suma=Array.from(document.querySelectorAll('#com-det-participantes .comision-participante')).reduce(function(total,fila){if(fila.dataset.estado==='rechazado')return total;var input=fila.querySelector('.comision-pct-input');return total+(parseFloat(input&&input.value)||0);},0);
    suma+=parseFloat((document.getElementById('com-nuevo-pct')||{}).value)||0;
    var neto=parseFloat(margen.dataset.neto)||0;var ganancia=parseFloat(margen.dataset.ganancia)||0;var max=parseFloat(margen.dataset.max)||0;var monto=ganancia*suma/100;var pct=neto>0?(ganancia-monto)/neto*100:0;
    var reparto=document.getElementById('com-resumen-reparto');if(reparto){reparto.textContent=suma.toLocaleString('es-AR',{maximumFractionDigits:2})+'% / '+max+'%';reparto.style.color=suma>max?'var(--red)':'var(--green)';}
    var montoEl=document.getElementById('com-resumen-monto');if(montoEl)montoEl.textContent=moneda(monto);
    margen.textContent=pct.toLocaleString('es-AR',{maximumFractionDigits:1})+'%';margen.style.color=pct<15?'var(--red)':(pct<=20?'var(--amber)':'var(--green)');
  }

  function abrirVentaDesdeComisiones() {
    if (!detalleActual || !(detalleActual.ventaFbKey || detalleActual.ventaId)) { window.notify('La comisión no tiene una venta vinculada'); return; }
    var grupo = detalleActual;
    var pagina = document.querySelector('.page.active');
    var origen = pagina ? pagina.id.replace(/^page-/, '') : 'comisiones';
    cerrarDetalleComision();
    if (origen === 'gastos' && typeof window.irAVentaDesdeGastoComision === 'function') {
      window.irAVentaDesdeGastoComision(grupo.items[0].fbKey);
      return;
    }
    window._ventaDesdeHistorialOrigen = origen;
    window.svNavegarDirecto('detalle', function() {
      window.verDetalleVenta(grupo.ventaFbKey || grupo.ventaId);
      window._ventaDesdeHistorialOrigen = origen;
    }, document.querySelector('[onclick*="detalle"]'));
  }

  function cerrarDetalleComision() {
    var focus=detallePersonalFoco;detallePersonalFoco=null;detallePersonalClave='';
    if(focus&&typeof document.removeEventListener==='function')document.removeEventListener('keydown',focus.keyboard,true);
    var modal=document.getElementById('modal-comision-gestion');if(modal)modal.style.display='none';detalleActual=null;movimientosDetalle={};
    ['com-det-info','com-det-sub','com-det-titulo','com-det-participantes','com-det-agregar'].forEach(function(id){var el=document.getElementById(id);if(el){el.innerHTML='';el.textContent='';}});
    var save=document.getElementById('com-det-guardar');if(save){save.disabled=true;save.style.display='none';}
    if(typeof window.svSincronizarPilaModales==='function')window.svSincronizarPilaModales();
    if(focus&&focus.valid()&&focus.opener&&focus.opener.isConnected!==false&&!focus.opener.closest('[inert]'))focus.opener.focus({preventScroll:true});
  }

  async function guardarDistribucionComision() {
    if (!detalleActual || guardandoDetalle || !window.tienePermiso('comisiones.distribuir')) return;
    var maxPct = parseFloat((window.APROBACION_CONFIG && window.APROBACION_CONFIG.maxComisionPct) || 10) || 10;
    var entradas = Array.from(document.querySelectorAll('#com-det-participantes .comision-pct-input:not(:disabled)'));
    var valores = entradas.map(function (input) { return { fbKey:input.dataset.gasto, pct:parseFloat(input.value)||0 }; });
    var rechazados = detalleActual.items.filter(function(g){return estado(g)==='rechazado';}).map(function(g){return g.fbKey;});
    var sumaPagada = detalleActual.items.filter(function(g){return estado(g)==='pagado'||estado(g)==='pagado_parcial';}).reduce(function(total,g){return total+porcentaje(g,movimientosDetalle[g.fbKey]);},0);
    var suma = sumaPagada + valores.filter(function(v){return rechazados.indexOf(v.fbKey)<0;}).reduce(function(s,v){return s+v.pct;},0);
    if (valores.some(function(v){return v.pct<=0;})) { window.notify('Todos los porcentajes deben ser mayores a cero'); return; }
    if (suma > maxPct + 0.001) { window.notify('La distribución supera el máximo global de ' + maxPct + '%'); return; }
    var updates = {};
    valores.forEach(function (item) {
      var gasto = detalleActual.items.find(function(g){return g.fbKey===item.fbKey;}); var mov=movimientosDetalle[item.fbKey]||{};
      var base=baseGanancia(gasto,mov); var monto=Math.round(base*item.pct)/100;
      var descripcion='Comisión venta '+(detalleActual.ventaId||'')+' · '+item.pct+'% sobre ganancia $'+Math.round(base).toLocaleString('es-AR')+' · distribución administrada';
      updates['sisventas/gastos/'+item.fbKey+'/monto']=monto; updates['sisventas/gastos/'+item.fbKey+'/pct']=item.pct; updates['sisventas/gastos/'+item.fbKey+'/gananciaBase']=base; updates['sisventas/gastos/'+item.fbKey+'/descripcion']=descripcion;
      updates['sisventas/gastos/'+item.fbKey+'/modificadoPor']=window.currentUser||''; updates['sisventas/gastos/'+item.fbKey+'/modificadoTs']=Date.now();
      var cambioPct=Math.abs(porcentaje(gasto,mov)-item.pct)>0.0001;
      if(cambioPct&&estado(gasto)!=='rechazado'){
        updates['sisventas/gastos/'+item.fbKey+'/estado']='pendiente_aprobacion';updates['sisventas/gastos/'+item.fbKey+'/requiereAprobacion']=true;
        updates['sisventas/gastos/'+item.fbKey+'/aprobadoPor']=null;updates['sisventas/gastos/'+item.fbKey+'/aprobadoTs']=null;updates['sisventas/gastos/'+item.fbKey+'/fechaAprobacion']=null;
      }
      if(mov.empFbKey&&mov.movFbKey){var raiz='sisventas/ctaemp/'+mov.empFbKey+'/'+mov.movFbKey;updates[raiz+'/monto']=monto;updates[raiz+'/pct']=item.pct;updates[raiz+'/gananciaBase']=base;updates[raiz+'/descripcion']=descripcion;updates[raiz+'/modificadoPor']=window.currentUser||'';updates[raiz+'/modificadoTs']=Date.now();if(cambioPct&&estado(gasto)!=='rechazado'){updates[raiz+'/estado']='pendiente';updates[raiz+'/aprobadoPor']=null;updates[raiz+'/aprobadoTs']=null;updates[raiz+'/fechaAprobacion']=null;}}
    });
    var grupoGuardado=detalleActual,movimientosGuardados=movimientosDetalle;
    guardandoDetalle=true;
    var botonGuardar=document.getElementById('com-det-guardar');
    var textoGuardar=botonGuardar&&botonGuardar.innerHTML;
    if(botonGuardar){botonGuardar.disabled=true;botonGuardar.textContent='Guardando…';}
    try {
      if(!window.SVGuardedWrites)throw new Error('Recargá la aplicación antes de guardar');
      var relativos={};Object.keys(updates).forEach(function(key){relativos[key.replace(/^sisventas\//,'')]=updates[key];});
      var response=await fetch(SISVENTAS_FUNCTIONS.cotizadorProveedor+'/comisiones/redistribuir',{method:'POST',headers:await window.SVServiceAuth.headers({'Content-Type':'application/json'}),body:JSON.stringify({grupo:grupoGuardado,movimientos:movimientosGuardados,valores:valores})});
      var result=await response.json();if(!response.ok||!result.ok||!result.committed)throw new Error(result.mensaje||'No se pudo confirmar la distribución');
      window.notify('✓ Distribución actualizada');if(detalleActual===grupoGuardado)cerrarDetalleComision();renderModuloComisiones();
    } catch(error){window.notify('No se guardó la distribución: '+error.message);}
    finally{guardandoDetalle=false;if(botonGuardar){botonGuardar.innerHTML=textoGuardar;botonGuardar.disabled=false;}comprobarDetalleAbierto();}
  }

  async function agregarParticipanteComision() {
    if (!detalleActual || !window.tienePermiso('comisiones.distribuir')) return;
    var empKey=String((document.getElementById('com-nuevo-empleado')||{}).value||''); var pct=parseFloat((document.getElementById('com-nuevo-pct')||{}).value)||0;
    var emp=Object.values(window.empData||{}).find(function(e){return String(e.fbKey||'')===empKey;}); if(!emp){window.notify('Seleccioná una persona');return;} if(pct<=0){window.notify('Ingresá el porcentaje');return;}
    var maxPct=parseFloat((window.APROBACION_CONFIG&&window.APROBACION_CONFIG.maxComisionPct)||10)||10;
    var suma=detalleActual.items.filter(function(g){return estado(g)!=='rechazado';}).reduce(function(s,g){return s+porcentaje(g,movimientosDetalle[g.fbKey]);},0);
    if(suma+pct>maxPct+0.001){window.notify('El reparto total superaría el máximo de '+maxPct+'%');return;}
    var ventaBase=ventaDelGrupo(detalleActual);
    if (!ventaBase || ventaBase.comisionHabilitada !== true) {window.notify('Habilitá la comisión en la venta antes de agregar participantes.');return;}
    var base=ventaBase&&typeof window._calcularBaseComisionVenta==='function'?window._calcularBaseComisionVenta(ventaBase).ganancia:detalleActual.items.reduce(function(v,g){return v||baseGanancia(g,movimientosDetalle[g.fbKey]);},0); if(!(base>0)){window.notify('No se pudo determinar la ganancia base');return;}
    var claveReabrir=detalleActual.clave;
    await window._generarComisionVentaAtomica(emp,{tipo:'comision',estado:'pendiente',aprobadoPor:'',aprobadoTs:null,monto:Math.round(base*pct)/100,pct:pct,pctOriginal:pct,ajustadoAlTope:false,gananciaBase:base,ventaId:detalleActual.ventaId||'',ventaFbKey:detalleActual.ventaFbKey||'',cliente:detalleActual.cliente||'',descripcion:'Comisión venta '+(detalleActual.ventaId||'')+' · '+pct+'% sobre ganancia $'+Math.round(base).toLocaleString('es-AR')+' · participante agregado',fecha:new Date().toISOString().slice(0,10),ts:Date.now(),empleadoNombre:emp.nombre||'',origenCarga:'gestion_comisiones'});
    window.notify('✓ Participante agregado, pendiente de aprobación'); if(window.fbCargarGastos)window.fbCargarGastos(); cerrarDetalleComision(); setTimeout(function(){renderModuloComisiones();abrirDetalleComision(claveReabrir);},350);
  }

  async function rehabilitarComision(gastoKey) {
    if(!window.tienePermiso('comisiones.aprobar')){window.notify('No tenés permiso para rehabilitar comisiones');return;}
    var g=(window.gastosData||[]).find(function(x){return x.fbKey===gastoKey;}); if(!g)return;
    try{
      if(typeof window.SVLaborWrites?.atomic!=='function')throw new Error('Recargá la aplicación antes de guardar');
      var mov=movimientosDetalle[gastoKey]||await cargarMovimiento(g),gastoPath='sisventas/gastos/'+gastoKey;
      var movPath=mov&&mov.empFbKey&&mov.movFbKey?'sisventas/ctaemp/'+mov.empFbKey+'/'+mov.movFbKey:'',paths=[gastoPath];if(movPath)paths.push(movPath);
      await window.SVLaborWrites.atomic({paths:paths,build:function(values){
        var actual=values[gastoPath],cuenta=movPath?values[movPath]:null;
        if(!actual||!esComision(actual)||estado(actual)!=='rechazado'||String(actual.legacyKey||'')!==String(g.legacyKey||'')||String(actual.empleadoFbKey||actual.empleadoId||'')!==String(g.empleadoFbKey||g.empleadoId||''))throw new Error('La comisión cambió. Actualizá la pantalla antes de rehabilitarla.');
        if((window.totalPagadoGasto(actual)||0)>0||movPath&&!cuenta||(cuenta&&((parseFloat(cuenta.montoPagado)||0)>0||window.totalPagadoGasto(cuenta)>0||['pagado','pagado_parcial','anulado'].includes(String(cuenta.estado||'').toLowerCase()))))throw new Error('La comisión tiene pagos o cambió su cuenta. Se conservaron sus datos.');
        var cambios={estado:'pendiente_aprobacion',requiereAprobacion:true,rehabilitadoPor:window.currentUser||'',rehabilitadoTs:Date.now(),rechazadoPor:null,fechaRechazo:null,motivoRechazo:null},updates={};
        Object.keys(cambios).forEach(function(k){updates[gastoPath+'/'+k]=cambios[k];if(movPath)updates[movPath+'/'+k]=cambios[k];});
        return updates;
      }});
      window.notify('✓ Comisión rehabilitada y pendiente de aprobación');if(window.fbCargarGastos)window.fbCargarGastos();cerrarDetalleComision();setTimeout(renderModuloComisiones,200);
    }catch(error){window.notify('No se pudo rehabilitar: '+error.message);}
  }

  function abrirComisionDesdeGasto(gastoKey) {
    var gasto=(window.gastosData||[]).find(function(g){return g.fbKey===gastoKey;}); if(!gasto){window.notify('Comisión no encontrada');return;}
    // El detalle es un modal: conservar debajo la página y sus filtros.
    return abrirDetalleComision(claveGrupo(gasto));
  }

  async function aprobarComisionGestion(gastoKey){await window.aprobarComisionDesdeGasto(gastoKey);setTimeout(function(){if(window.fbCargarGastos)window.fbCargarGastos();renderModuloComisiones();},250);cerrarDetalleComision();}
  async function rechazarComisionGestion(gastoKey){await window.rechazarComisionDesdeGasto(gastoKey);setTimeout(function(){if(window.fbCargarGastos)window.fbCargarGastos();renderModuloComisiones();},250);cerrarDetalleComision();}

  window.actualizarBadgeComisiones=actualizarBadgeComisiones;
  document.addEventListener('sisventas:session-ready', actualizarBadgeComisiones);
  document.addEventListener('sisventas:role-changed', limpiarComisionesDeSesion);
  document.addEventListener('sisventas:data-state-changed', repintarComisionesPersonalesTrasDatos);
  document.addEventListener('sisventas:session-ended', function() {
    limpiarComisionesDeSesion();
    var aviso = document.getElementById('comisiones-cuentas-anteriores'); if (aviso) aviso.remove();
    var badge = document.getElementById('badge-nav-comisiones');
    if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
  });
  actualizarBadgeComisiones();
  window.renderModuloComisiones=renderModuloComisiones; window.abrirDetalleComision=abrirDetalleComision; window.cerrarDetalleComision=cerrarDetalleComision;
  window.guardarDistribucionComision=guardarDistribucionComision; window.agregarParticipanteComision=agregarParticipanteComision; window.rehabilitarComision=rehabilitarComision;
  window.abrirComisionDesdeGasto=abrirComisionDesdeGasto; window.aprobarComisionGestion=aprobarComisionGestion; window.rechazarComisionGestion=rechazarComisionGestion;
  window.actualizarResumenMargenComision=actualizarResumenMargenComision; window.abrirVentaDesdeComisiones=abrirVentaDesdeComisiones;
  window.abonarComisionGestion=abonarComisionGestion;
  window.filtrarComisionesPorEstado=filtrarComisionesPorEstado;
  window.verCuentasAnterioresComisiones=verCuentasAnterioresComisiones;
  // Si la aplicación entró directamente por #/comisiones, showPage puede
  // ejecutarse antes que este módulo. Renderizar al terminar la carga evita
  // dejar el estado inicial "Cargando..." esperando otra navegación.
  setTimeout(function () {
    var pagina=document.getElementById('page-comisiones');
    if(pagina&&pagina.classList.contains('active')) renderModuloComisiones();
  },0);
})();
