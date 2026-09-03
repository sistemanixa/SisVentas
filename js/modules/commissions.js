(function () {
  'use strict';

  var detalleActual = null;
  var movimientosDetalle = {};
  var sincronizacionSolicitada = false;

  function moneda(valor) {
    return '$' + (parseFloat(valor) || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function esc(valor) {
    if (typeof window.escapeHTML === 'function') return window.escapeHTML(String(valor == null ? '' : valor));
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; });
  }

  function esComision(gasto) {
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

  function renderModuloComisiones() {
    var tbody = document.getElementById('comisiones-tbody');
    if (!tbody) return;
    if (!sincronizacionSolicitada && typeof window.sincronizarComisionesLegacyConModulo === 'function') {
      sincronizacionSolicitada = true;
      window.sincronizarComisionesLegacyConModulo().then(function(cantidad) {
        if (cantidad && window.fbCargarGastos) window.fbCargarGastos();
      }).catch(function(error) {
        sincronizacionSolicitada = false;
        console.warn('[Comisiones] No se pudieron incorporar registros históricos', error);
      });
    }
    var buscar = String((document.getElementById('com-f-buscar') || {}).value || '').toLowerCase();
    var filtroEstado = String((document.getElementById('com-f-estado') || {}).value || '');
    var lista = grupos().filter(function (grupo) {
      var texto = [grupo.ventaId, grupo.cliente].concat(grupo.items.map(function (g) { return g.empleadoNombre || g.descripcion || ''; })).join(' ').toLowerCase();
      return (!buscar || texto.indexOf(buscar) >= 0) && coincideEstadoFiltro(grupo, filtroEstado);
    });
    var todos = grupos();
    function contar(est) { return todos.filter(function (g) { return estadoGrupo(g) === est; }).length; }
    actualizarKpi('pendientes', todos.filter(function (g) { return estadoGrupo(g) === 'pendiente_aprobacion'; }), 'requieren decisión');
    actualizarKpi('aprobadas', todos.filter(function (g) { return coincideEstadoFiltro(g, 'aprobadas'); }), 'listas para abonar');
    actualizarKpi('rechazadas', todos.filter(function (g) { return estadoGrupo(g) === 'rechazado'; }), 'se pueden rehabilitar');
    actualizarKpi('total', todos.filter(function (g) { return estadoGrupo(g) !== 'rechazado'; }), 'comisiones vigentes');
    var navBadge = document.getElementById('badge-nav-comisiones');
    if (navBadge) { var cant = contar('pendiente_aprobacion'); navBadge.style.display = cant ? '' : 'none'; navBadge.textContent = cant; }
    tbody.innerHTML = lista.length ? lista.map(function (grupo) {
      var activos = grupo.items.filter(function (g) { return estado(g) !== 'rechazado'; });
      var pct = activos.reduce(function (s,g) { return s + porcentaje(g); }, 0);
      var monto = activos.reduce(function (s,g) { return s + (parseFloat(g.monto) || 0); }, 0);
      var participantes = grupo.items.map(function (g) { return '<span class="badge ' + (estado(g)==='rechazado'?'b-red':'b-blue') + '">' + esc(g.empleadoNombre || 'Sin asignar') + '</span>'; }).join(' ');
      var motivo = estadoGrupo(grupo) === 'rechazado' ? motivoRechazoGrupo(grupo) : '';
      return '<tr onclick="abrirDetalleComision(\'' + esc(grupo.clave) + '\')" style="cursor:pointer">' +
        '<td data-label="Fecha">' + esc(String(grupo.fecha || '').split('-').reverse().join('/')) + '</td>' +
        '<td data-label="Venta / cliente"><strong style="color:var(--blue)">' + esc(grupo.ventaId || 'Sin venta') + '</strong><div style="font-size:11px;color:var(--text3);margin-top:3px">' + esc(grupo.cliente || 'Cliente no informado') + '</div></td>' +
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
    await Promise.all(detalleActual.items.map(async function (g) { movimientosDetalle[g.fbKey] = await cargarMovimiento(g); }));
    pintarDetalle();
    var modal = document.getElementById('modal-comision-gestion'); if (modal) modal.style.display = 'flex';
  }

  function pintarDetalle() {
    if (!detalleActual) return;
    var maxPct = parseFloat((window.APROBACION_CONFIG && window.APROBACION_CONFIG.maxComisionPct) || 10) || 10;
    var titulo = document.getElementById('com-det-titulo'); if (titulo) titulo.textContent = 'Comisión ' + (detalleActual.ventaId || 'sin venta');
    var sub = document.getElementById('com-det-sub'); if (sub) sub.textContent = detalleActual.cliente || 'Cliente no informado';
    var activos = detalleActual.items.filter(function (g) { return estado(g) !== 'rechazado'; });
    var suma = activos.reduce(function (s,g) { return s + porcentaje(g, movimientosDetalle[g.fbKey]); }, 0);
    var base = detalleActual.items.reduce(function (valor,g) { return valor || baseGanancia(g, movimientosDetalle[g.fbKey]); }, 0);
    var info = document.getElementById('com-det-info');
    var venta=ventaDelGrupo(detalleActual); var calculo=venta&&typeof window._calcularBaseComisionVenta==='function'?window._calcularBaseComisionVenta(venta):null;
    var neto=calculo?calculo.baseNeta:0; var costo=calculo?calculo.costoTotal:Math.max(0,neto-base); var descuento=calculo?calculo.descuento:0;
    var margenAntes=neto>0?base/neto*100:0;
    if (info) info.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><strong>Resumen de la venta</strong>'+(detalleActual.ventaId?'<button class="btn btn-sm" onclick="abrirVentaDesdeComisiones()"><i class="ti ti-external-link"></i> Ver venta</button>':'')+'</div><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding-bottom:10px;border-bottom:0.5px solid var(--border)"><div><span style="font-size:10px;color:var(--text3)">VENTA NETA</span><strong style="display:block;margin-top:3px">'+moneda(neto)+'</strong></div><div><span style="font-size:10px;color:var(--text3)">DESCUENTO</span><strong style="display:block;margin-top:3px;color:var(--red)">'+moneda(descuento)+'</strong></div><div><span style="font-size:10px;color:var(--text3)">COSTO</span><strong style="display:block;margin-top:3px">'+moneda(costo)+'</strong></div><div><span style="font-size:10px;color:var(--text3)">MARGEN ORIGINAL</span><strong style="display:block;margin-top:3px">'+margenAntes.toLocaleString('es-AR',{maximumFractionDigits:1})+'%</strong></div></div><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding-top:10px"><div><span style="font-size:10px;color:var(--text3)">GANANCIA BASE</span><strong style="display:block;margin-top:3px">' + moneda(base) + '</strong></div><div><span style="font-size:10px;color:var(--text3)">REPARTO ACTIVO</span><strong id="com-resumen-reparto" style="display:block;margin-top:3px;color:' + (suma>maxPct?'var(--red)':'var(--green)') + '">' + suma.toLocaleString('es-AR') + '% / ' + maxPct + '%</strong></div><div><span style="font-size:10px;color:var(--text3)">COMISIONES</span><strong id="com-resumen-monto" style="display:block;margin-top:3px;color:var(--amber)">'+moneda(base*suma/100)+'</strong></div><div><span style="font-size:10px;color:var(--text3)">MARGEN DESPUÉS</span><strong id="com-resumen-margen" data-neto="'+neto+'" data-ganancia="'+base+'" data-max="'+maxPct+'" style="display:block;margin-top:3px">—</strong></div></div>';
    var cont = document.getElementById('com-det-participantes');
    if (cont) cont.innerHTML = detalleActual.items.map(function (g) {
      var est = estado(g); var pct = porcentaje(g, movimientosDetalle[g.fbKey]); var pagada = est === 'pagado' || est === 'pagado_parcial';
      return '<div class="comision-participante" data-gasto="' + esc(g.fbKey) + '" data-estado="'+esc(est)+'" style="display:grid;grid-template-columns:minmax(150px,1fr) 100px 120px auto;gap:8px;align-items:center;padding:10px 0;border-bottom:0.5px solid var(--border)">' +
        '<div><strong>' + esc(g.empleadoNombre || 'Sin asignar') + '</strong>' + (est==='rechazado'?'<div style="font-size:11px;color:var(--red);margin-top:4px"><strong>Motivo:</strong> '+esc(g.motivoRechazo || 'Sin motivo registrado')+'</div>':'') + '</div>' +
        '<label style="display:flex;align-items:center;gap:5px"><input class="comision-pct-input" data-gasto="' + esc(g.fbKey) + '" type="number" min="0.1" max="' + maxPct + '" step="0.1" value="' + pct + '" ' + (pagada?'disabled':'') + ' oninput="actualizarResumenMargenComision()" style="width:72px">%</label>' +
        '<strong>' + moneda(g.monto) + '</strong><div style="display:flex;gap:5px;justify-content:flex-end">' + badgeEstado(est) +
        (est === 'pendiente_aprobacion' ? '<button class="btn btn-sm" title="Aprobar esta participación" onclick="aprobarComisionGestion(\''+esc(g.fbKey)+'\')" style="color:var(--green);border-color:var(--green)"><i class="ti ti-check"></i> Aprobar</button><button class="btn btn-sm" title="Rechazar esta participación" onclick="rechazarComisionGestion(\''+esc(g.fbKey)+'\')" style="color:var(--red);border-color:var(--red)"><i class="ti ti-x"></i> Rechazar</button>' : '') +
        (est === 'rechazado' ? '<button class="btn btn-sm" onclick="rehabilitarComision(\''+esc(g.fbKey)+'\')"><i class="ti ti-restore"></i> Rehabilitar</button>' : '') + '</div></div>';
    }).join('');
    var existentes = {};
    detalleActual.items.forEach(function (g) { existentes[String(g.empleadoFbKey || g.empleadoId || '')] = true; });
    var empleados = Object.values(window.empData || {}).filter(function (e) { return e && e.activo !== false && !existentes[String(e.fbKey || '')]; });
    var agregar = document.getElementById('com-det-agregar');
    if (agregar) agregar.innerHTML = '<div style="font-size:12px;font-weight:700;margin-bottom:8px">Agregar participante</div><div style="display:grid;grid-template-columns:minmax(180px,1fr) 110px auto;gap:8px"><select id="com-nuevo-empleado" class="search-input"><option value="">Seleccionar persona...</option>' + empleados.map(function(e){return '<option value="'+esc(e.fbKey)+'">'+esc(e.nombre||'Sin nombre')+'</option>';}).join('') + '</select><label style="display:flex;align-items:center;gap:5px"><input id="com-nuevo-pct" type="number" min="0.1" max="'+maxPct+'" step="0.1" placeholder="0" oninput="actualizarResumenMargenComision()" style="width:75px">%</label><button class="btn" onclick="agregarParticipanteComision()"><i class="ti ti-user-plus"></i> Agregar</button></div>';
    actualizarResumenMargenComision();
  }

  function actualizarResumenMargenComision(){
    var margen=document.getElementById('com-resumen-margen');if(!margen)return;
    var suma=Array.from(document.querySelectorAll('#com-det-participantes .comision-participante')).reduce(function(total,fila){if(fila.dataset.estado==='rechazado')return total;var input=fila.querySelector('.comision-pct-input');return total+(parseFloat(input&&input.value)||0);},0);
    suma+=parseFloat((document.getElementById('com-nuevo-pct')||{}).value)||0;
    var neto=parseFloat(margen.dataset.neto)||0;var ganancia=parseFloat(margen.dataset.ganancia)||0;var max=parseFloat(margen.dataset.max)||0;var monto=ganancia*suma/100;var pct=neto>0?(ganancia-monto)/neto*100:0;
    var reparto=document.getElementById('com-resumen-reparto');if(reparto){reparto.textContent=suma.toLocaleString('es-AR',{maximumFractionDigits:2})+'% / '+max+'%';reparto.style.color=suma>max?'var(--red)':'var(--green)';}
    var montoEl=document.getElementById('com-resumen-monto');if(montoEl)montoEl.textContent=moneda(monto);
    margen.textContent=pct.toLocaleString('es-AR',{maximumFractionDigits:1})+'%';margen.style.color=pct<15?'var(--red)':(pct<=20?'var(--amber)':'var(--green)');
  }

  function abrirVentaDesdeComisiones(){if(!detalleActual||!(detalleActual.ventaFbKey||detalleActual.ventaId)){window.notify('La comisión no tiene una venta vinculada');return;}window._ventaDesdeHistorialOrigen='comisiones';window.svNavegarDirecto('detalle',function(){window.verDetalleVenta(detalleActual.ventaFbKey||detalleActual.ventaId);window._ventaDesdeHistorialOrigen='comisiones';},document.querySelector('[onclick*="detalle"]'));}

  function cerrarDetalleComision() { var modal=document.getElementById('modal-comision-gestion'); if(modal) modal.style.display='none'; detalleActual=null; movimientosDetalle={}; }

  async function guardarDistribucionComision() {
    if (!detalleActual || String(window.currentRole || '').toLowerCase() !== 'admin') return;
    var maxPct = parseFloat((window.APROBACION_CONFIG && window.APROBACION_CONFIG.maxComisionPct) || 10) || 10;
    var entradas = Array.from(document.querySelectorAll('#com-det-participantes .comision-pct-input:not(:disabled)'));
    var valores = entradas.map(function (input) { return { fbKey:input.dataset.gasto, pct:parseFloat(input.value)||0 }; });
    var rechazados = detalleActual.items.filter(function(g){return estado(g)==='rechazado';}).map(function(g){return g.fbKey;});
    var suma = valores.filter(function(v){return rechazados.indexOf(v.fbKey)<0;}).reduce(function(s,v){return s+v.pct;},0);
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
    await window.fbUpdate(window.fbRef(window.fbDB),updates); window.notify('✓ Distribución actualizada'); if(window.fbCargarGastos)window.fbCargarGastos(); cerrarDetalleComision(); setTimeout(renderModuloComisiones,200);
  }

  async function agregarParticipanteComision() {
    if (!detalleActual || String(window.currentRole || '').toLowerCase() !== 'admin') return;
    var empKey=String((document.getElementById('com-nuevo-empleado')||{}).value||''); var pct=parseFloat((document.getElementById('com-nuevo-pct')||{}).value)||0;
    var emp=Object.values(window.empData||{}).find(function(e){return String(e.fbKey||'')===empKey;}); if(!emp){window.notify('Seleccioná una persona');return;} if(pct<=0){window.notify('Ingresá el porcentaje');return;}
    var maxPct=parseFloat((window.APROBACION_CONFIG&&window.APROBACION_CONFIG.maxComisionPct)||10)||10;
    var suma=detalleActual.items.filter(function(g){return estado(g)!=='rechazado';}).reduce(function(s,g){return s+porcentaje(g,movimientosDetalle[g.fbKey]);},0);
    if(suma+pct>maxPct+0.001){window.notify('El reparto total superaría el máximo de '+maxPct+'%');return;}
    var base=detalleActual.items.reduce(function(v,g){return v||baseGanancia(g,movimientosDetalle[g.fbKey]);},0); if(!(base>0)){window.notify('No se pudo determinar la ganancia base');return;}
    var claveReabrir=detalleActual.clave;
    await window._generarComisionVentaAtomica(emp,{tipo:'comision',estado:'pendiente',aprobadoPor:'',aprobadoTs:null,monto:Math.round(base*pct)/100,pct:pct,pctOriginal:pct,ajustadoAlTope:false,gananciaBase:base,ventaId:detalleActual.ventaId||'',ventaFbKey:detalleActual.ventaFbKey||'',cliente:detalleActual.cliente||'',descripcion:'Comisión venta '+(detalleActual.ventaId||'')+' · '+pct+'% sobre ganancia $'+Math.round(base).toLocaleString('es-AR')+' · participante agregado',fecha:new Date().toISOString().slice(0,10),ts:Date.now(),empleadoNombre:emp.nombre||'',origenCarga:'gestion_comisiones'});
    window.notify('✓ Participante agregado, pendiente de aprobación'); if(window.fbCargarGastos)window.fbCargarGastos(); cerrarDetalleComision(); setTimeout(function(){renderModuloComisiones();abrirDetalleComision(claveReabrir);},350);
  }

  async function rehabilitarComision(gastoKey) {
    var g=(window.gastosData||[]).find(function(x){return x.fbKey===gastoKey;}); if(!g)return;
    var cambios={estado:'pendiente_aprobacion',requiereAprobacion:true,rehabilitadoPor:window.currentUser||'',rehabilitadoTs:Date.now(),rechazadoPor:null,fechaRechazo:null,motivoRechazo:null}; var updates={}; Object.keys(cambios).forEach(function(k){updates['sisventas/gastos/'+gastoKey+'/'+k]=cambios[k];});
    var mov=movimientosDetalle[gastoKey]||await cargarMovimiento(g); if(mov&&mov.empFbKey&&mov.movFbKey)Object.keys(cambios).forEach(function(k){updates['sisventas/ctaemp/'+mov.empFbKey+'/'+mov.movFbKey+'/'+k]=cambios[k];});
    await window.fbUpdate(window.fbRef(window.fbDB),updates); window.notify('✓ Comisión rehabilitada y pendiente de aprobación'); if(window.fbCargarGastos)window.fbCargarGastos(); cerrarDetalleComision(); setTimeout(renderModuloComisiones,200);
  }

  function abrirComisionDesdeGasto(gastoKey) {
    var gasto=(window.gastosData||[]).find(function(g){return g.fbKey===gastoKey;}); if(!gasto){window.notify('Comisión no encontrada');return;}
    window.showPage('comisiones',document.querySelector('.nav-item[onclick*="comisiones"]')); renderModuloComisiones(); setTimeout(function(){abrirDetalleComision(claveGrupo(gasto));},40);
  }

  async function aprobarComisionGestion(gastoKey){await window.aprobarComisionDesdeGasto(gastoKey);setTimeout(function(){if(window.fbCargarGastos)window.fbCargarGastos();renderModuloComisiones();},250);cerrarDetalleComision();}
  async function rechazarComisionGestion(gastoKey){await window.rechazarComisionDesdeGasto(gastoKey);setTimeout(function(){if(window.fbCargarGastos)window.fbCargarGastos();renderModuloComisiones();},250);cerrarDetalleComision();}

  window.renderModuloComisiones=renderModuloComisiones; window.abrirDetalleComision=abrirDetalleComision; window.cerrarDetalleComision=cerrarDetalleComision;
  window.guardarDistribucionComision=guardarDistribucionComision; window.agregarParticipanteComision=agregarParticipanteComision; window.rehabilitarComision=rehabilitarComision;
  window.abrirComisionDesdeGasto=abrirComisionDesdeGasto; window.aprobarComisionGestion=aprobarComisionGestion; window.rechazarComisionGestion=rechazarComisionGestion;
  window.actualizarResumenMargenComision=actualizarResumenMargenComision; window.abrirVentaDesdeComisiones=abrirVentaDesdeComisiones;
  window.filtrarComisionesPorEstado=filtrarComisionesPorEstado;
  // Si la aplicación entró directamente por #/comisiones, showPage puede
  // ejecutarse antes que este módulo. Renderizar al terminar la carga evita
  // dejar el estado inicial "Cargando..." esperando otra navegación.
  setTimeout(function () {
    var pagina=document.getElementById('page-comisiones');
    if(pagina&&pagina.classList.contains('active')) renderModuloComisiones();
  },0);
})();
