(function () {
  'use strict';

  function n(value) {
    var number = parseFloat(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function esc(value) {
    if (typeof window.escapeHTML === 'function') return window.escapeHTML(String(value == null ? '' : value));
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char];
    });
  }

  function isAdministration() {
    return typeof window.tienePermiso === 'function' && window.tienePermiso('ot.entregarMateriales');
  }

  function correcting(ot) {
    return window.currentRole === 'admin' && typeof window.tienePermiso === 'function' && window.tienePermiso('ot.corregirMateriales') && window.tienePermiso('ot.rendirMateriales') && correctionKey === String(ot.fbKey || ot.id);
  }
  function mayRend(ot) {
    if (!ot || window._impersonacionOriginal || !window.tienePermiso?.('ot.rendirMateriales')) return false;
    var closed = typeof window.otEstaCerrada === 'function' ? window.otEstaCerrada(ot) : ['completada','con_observaciones'].includes(String(ot.estado || '').toLowerCase());
    return (!closed || correcting(ot)) && !(ot.materiales || []).some(function(m){return m.stockPendiente === true;});
  }
  var renditionBusy = false;
  async function persistRendition(draft, before, action) {
    if (renditionBusy || deliveryBusy) return;
    var original = currentOT();
    if (!original || !mayRend(original)) throw Error('No tenés permiso para corregir esta OT.');
    renditionBusy = true;
    var finish = window.SisVentas?.carga?.mostrar?.('Guardando materiales y stock…', {persistirAlNavegar:true});
    try {
      await syncInstalled(draft, before);
      await save(draft, action);
      Object.assign(original, draft);
      updateGlobal();
      if (typeof window.actualizarPanelIntegridadOT === 'function') window.actualizarPanelIntegridadOT();
      return draft;
    } finally { renditionBusy = false; if (typeof finish === 'function') finish(); }
  }

  function currentOT() {
    return (window.otData || []).find(function (ot) {
      return ot && (ot.fbKey === window.otActualId || ot.id === window.otActualId);
    }) || null;
  }

  function productFor(material) {
    var products = window.prodData || window.productosData || {};
    var list = Array.isArray(products) ? products : Object.values(products);
    var code = String((material && (material.cod || material.codigo)) || '').trim().toLowerCase();
    return list.find(function (product) {
      return String((product && (product.codigo || product.cod)) || '').trim().toLowerCase() === code;
    }) || null;
  }

  function serviceMaterial(material, product) {
    material = material || {};
    product = product || {};
    if (material.esManoDeObra === true || product.esManoDeObra === true) return true;
    var type = String(material.tipo || material.clase || product.tipo || product.clase || '').toUpperCase();
    if (type === 'SERVICIO' || type === 'MANO DE OBRA') return true;
    var category = String(material.categoria || product.categoria || '').toUpperCase();
    if (category.includes('MANO DE OBRA') || category.includes('SERVICIO')) return true;
    var description = String(material.desc || material.descripcion || product.nombre || product.descripcion || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    return /^(?:\d+\s*-\s*)?(?:INSTALACION|CONFIGURACION|MANTENIMIENTO|VISITA TECNICA)\b/.test(description);
  }

  function materialRows(ot) {
    return window.SVOTMaterialRows ? window.SVOTMaterialRows.view(ot) : (ot.materiales || []).map(function(m,i){return Object.assign({_indice:i},normalizeMaterial(m));});
  }
  function persistedRows(rows) {
    return window.SVOTMaterialRows ? window.SVOTMaterialRows.persisted(rows) : rows.map(function(m){var copy=Object.assign({},m);delete copy._indice;delete copy._recuperado;return copy;});
  }
  function needsRendition(ot) {return materialRows(ot).filter(controllable).some(function(m){return m._recuperado || !m.custodiaActiva || n(m.entregada) < quantity(m) || n(m.instalada) < installationTarget(m);});}
  function isAdditional(material) {return material.adicionalOT === true || material.origen === 'adicional_ot';}
  function quantity(material) {return window.SVOTMaterialRows ? window.SVOTMaterialRows.quantity(material) : n(material.vendida ?? material.qty ?? material.cantidad ?? material.cant);}
  function installationTarget(material) {return Math.max(0,n(material.entregada) - n(material.devuelta) - n(material.devueltaPendiente) - n(material.danada) - n(material.faltante));}
  function controllable(material) {
    if (!material || quantity(material) <= 0) return false;
    var product = productFor(material);
    if (serviceMaterial(material, product)) return false;
    if (!product) return true;
    var category = String(product.categoria || '').toUpperCase();
    return !category.includes('INSTALACION') && !category.includes('CONFIGURACION');
  }

  function controllableMaterials(ot) {
    return (ot && ot.materiales || []).filter(controllable);
  }

  function pendingDelivery(ot) {
    return controllableMaterials(ot).filter(function (material) {
      return quantity(material) > n(material.entregada);
    });
  }

  function deliveryDescription(materials) {
    var groups = {};
    materials.forEach(function(material) {
      var product = productFor(material) || {};
      var unit = String(material.unidad || product.unidad || 'unidades').trim().toLowerCase();
      if (/^(u|un|uni|unidad|unidades|uds|ud)$/.test(unit)) unit = 'unidades';
      if (/^(m|mt|mts|metro|metros)$/.test(unit)) unit = 'metros';
      groups[unit] = (groups[unit] || 0) + n(material.vendida);
    });
    return Object.keys(groups).map(function(unit) {
      return Number(groups[unit].toFixed(6)).toLocaleString('es-AR', {maximumFractionDigits:6}) + ' ' + unit;
    }).join(' + ') + ' en ' + materials.length + (materials.length === 1 ? ' renglón' : ' renglones');
  }

  function normalizeMaterial(material) {
    material = material || {};
    return Object.assign({}, material, {
      cod:material.cod || material.codigo || material.sku || '',
      desc:material.desc || material.nombre || material.descripcion || material.producto || '',
      vendida:quantity(material),
      custodiaActiva: material.custodiaActiva === true,
      entregada: n(material.entregada),
      instalada: n(material.instalada ?? material.cantidadInstalada),
      devueltaPendiente: n(material.devueltaPendiente),
      devuelta: n(material.devuelta),
      enTecnico: n(material.enTecnico),
      danada: n(material.danada),
      faltante: n(material.faltante),
      custodiaClasificada: material.custodiaClasificada === true
    });
  }

  function classified(material) {
    material = normalizeMaterial(material);
    return material.instalada + material.devueltaPendiente + material.devuelta + material.enTecnico + material.danada + material.faltante;
  }

  function summary(ot) {
    var result = { controlados:0, entregados:0, instalados:0, sinClasificar:0, devolucionPendiente:0, devueltos:0, enTecnico:0, danados:0, faltantes:0 };
    (ot && ot.materiales || []).forEach(function (raw) {
      var material = normalizeMaterial(raw);
      if (!material.custodiaActiva) return;
      result.controlados += 1;
      result.entregados += material.entregada;
      result.instalados += material.instalada;
      result.devolucionPendiente += material.devueltaPendiente;
      result.devueltos += material.devuelta;
      result.enTecnico += material.enTecnico;
      result.danados += material.danada;
      result.faltantes += material.faltante;
      result.sinClasificar += Math.max(0, material.entregada - classified(material));
    });
    result.conObservaciones = result.sinClasificar + result.devolucionPendiente + result.enTecnico + result.danados + result.faltantes > 0;
    return result;
  }

  function audit(ot, action) {
    var now = new Date();
    ot.audit = Array.isArray(ot.audit) ? ot.audit : [];
    ot.audit.push({
      fecha: now.toLocaleDateString('es-AR') + ' ' + now.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' }),
      usuario: window.currentUser || 'Sistema',
      accion: action
    });
  }

  function save(ot, action) {
    if (!ot) return Promise.reject(new Error('OT no encontrada'));
    if (action) audit(ot, action);
    window._otGuardandoLocalHasta = Date.now() + 3000;
    var promise = typeof window.fbGuardarOT === 'function'
      ? window.fbGuardarOT(ot)
      : Promise.reject(new Error('Firebase no está disponible'));
    var materialCard = document.getElementById('ot-materiales-card');
    var scrollContainer = materialCard;
    while (scrollContainer && scrollContainer !== document.body) {
      var style = window.getComputedStyle(scrollContainer);
      if (/(auto|scroll)/.test(style.overflowY || '') && scrollContainer.scrollHeight > scrollContainer.clientHeight) break;
      scrollContainer = scrollContainer.parentElement;
    }
    var usesWindow = !scrollContainer || scrollContainer === document.body;
    var scrollTop = usesWindow ? (window.scrollY || document.documentElement.scrollTop || 0) : scrollContainer.scrollTop;
    var cardTop = materialCard ? materialCard.getBoundingClientRect().top : 0;
    return Promise.resolve(promise).then(function () {
      updateGlobal();
      // Actualizar solamente Materiales evita que el detalle completo vuelva
      // fugazmente a su vista inicial antes de regresar a esta sección.
      render(ot, controllableMaterials(ot));
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var refreshedCard = document.getElementById('ot-materiales-card');
          var correction = refreshedCard ? refreshedCard.getBoundingClientRect().top - cardTop : 0;
          if (usesWindow) window.scrollTo(0, Math.max(0, scrollTop + correction));
          else if (scrollContainer && scrollContainer.isConnected) scrollContainer.scrollTop = Math.max(0, scrollTop + correction);
        });
      });
      return ot;
    });
  }

  function stateBadge(material) {
    material = normalizeMaterial(material);
    if (!material.custodiaActiva) return '<span class="badge">No entregado</span>';
    var parts = [];
    var pending = Math.max(0, material.entregada - classified(material));
    if (pending) parts.push('<span class="badge b-amber">Con técnico: ' + pending + '</span>');
    if (material.stockPendiente) parts.push('<span class="badge b-amber">Stock pendiente · completar registro</span>');
    if (material.instalada && !material.stockPendiente) parts.push('<span class="badge b-green">Instalado: ' + material.instalada + '</span>');
    if (material.devueltaPendiente) parts.push('<span class="badge b-amber">Devolución pendiente: ' + material.devueltaPendiente + '</span>');
    if (material.devuelta) parts.push('<span class="badge b-blue">Devuelto: ' + material.devuelta + '</span>');
    if (material.enTecnico) parts.push('<span class="badge b-amber">Sigue con técnico: ' + material.enTecnico + '</span>');
    if (material.danada) parts.push('<span class="badge b-red">Dañado: ' + material.danada + '</span>');
    if (material.faltante) parts.push('<span class="badge b-red">Faltante: ' + material.faltante + '</span>');
    return parts.join(' ') || '<span class="badge b-amber">Pendiente de rendición</span>';
  }

  function itemAction(ot, material, view, index) {
    if (!mayRend(ot) || !controllable(material) || (ot.custodiaRendida && !correcting(ot) && !needsRendition(ot))) return '';
    var available = Math.max(0,Math.max(n(material.entregada),quantity(material)) - n(material.devuelta) - n(material.devueltaPendiente) - n(material.danada) - n(material.faltante));
    var done = material.instalada >= available && !view._recuperado;
    var label = available === 0 ? 'Sin unidades por instalar' : (done ? 'Instalado' : 'Marcar instalado');
    return '<button type="button" class="btn btn-sm" data-material-index="' + index + '" onclick="otCustodiaInstalarItem(' + index + ')" ' + ((done || available === 0) ? 'disabled' : '') + '>' + label + '</button>';
  }

  function render(ot, visibleMaterials) {
    renderDeliveryReceipts(ot);
    var tbody = document.getElementById('ot-materiales');
    if (!tbody) return;
    var effective = materialRows(ot);
    var materials = effective.length ? effective.filter(controllable) : (visibleMaterials || []);
    tbody.innerHTML = materials.length ? materials.map(function (view) {
      var index = typeof view._indice === 'number' ? view._indice : (ot.materiales || []).indexOf(view);
      var material = normalizeMaterial(view);
      return '<tr>' +
        '<td style="font-size:12px;color:var(--text3)">' + esc(material.cod || material.codigo || '') + '</td>' +
        '<td>' + esc(material.desc || material.descripcion || '') + '<div style="font-size:10px;color:var(--text3)">' + (isAdditional(material) ? 'Adicional' : 'Original') + (view._recuperado ? ' · registro anterior' : '') + '</div></td>' +
        '<td class="tr">' + n(material.vendida) + '</td>' +
        '<td class="tr">' + (material.custodiaActiva ? material.entregada : '—') + '</td>' +
        '<td><div style="display:flex;gap:5px;flex-wrap:wrap">' + stateBadge(material) + '</div></td><td class="tr"><div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">' +
        itemAction(ot, material, view, index) + (window.SVOTOfficeCount?.button(ot, material, index) || '') +
        (!view._recuperado && typeof window.otPuedeCorregirProductos === 'function' && window.otPuedeCorregirProductos() ? '<button type="button" class="btn btn-sm btn-icon" title="Quitar producto y actualizar venta" aria-label="Quitar producto" onclick="otEliminarProductoMaterial(' + index + ')" style="color:var(--red)">×</button>' : '') + '</div></td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:12px">Sin materiales controlables</td></tr>';

    var retry = document.getElementById('ot-stock-pendiente');
    if (retry) retry.remove();
    if ((ot.materiales || []).some(function(m){return m.stockPendiente === true;}) && window.tienePermiso?.('ot.corregirMateriales')) {
      retry = document.createElement('button');retry.id = 'ot-stock-pendiente';retry.type = 'button';retry.className = 'btn btn-sm';retry.textContent = 'Completar stock del adicional';
      retry.onclick = function(){ completeAdditionalStock(ot).then(function(){render(ot, controllableMaterials(ot));window.notify('Stock del adicional registrado');}).catch(function(e){window.notify(e.message);}); };
      var host = document.getElementById('ot-custodia-estado');if(host)host.parentNode.insertBefore(retry,host.nextSibling);
    }
    var totals = summary(ot);
    var closedRecord = typeof window.otEstaCerrada === 'function' ? window.otEstaCerrada(ot) : ['completada','con_observaciones'].indexOf(String(ot.estado || '').toLowerCase()) >= 0;
    var isClosed = closedRecord && !correcting(ot);
    var eligible = materialRows(ot).filter(controllable);
    var admin = isAdministration();
    var deliver = document.getElementById('ot-btn-entregar-materiales');
    var allInstalled = document.getElementById('ot-btn-todo-instalado');
    var exceptions = document.getElementById('ot-btn-excepciones');
    var receive = document.getElementById('ot-btn-recibir-devolucion');
    var pending = pendingDelivery(ot);
    var canDeliver = pending.some(function (material) { return !isClosed || material.adicionalOT === true; });
    if (deliver) {
      deliver.style.display = admin && canDeliver ? '' : 'none';
      deliver.textContent = ot.custodiaIniciada ? 'Entregar materiales pendientes' : 'Entregar materiales al técnico';
    }
    if (allInstalled) allInstalled.style.display = !isClosed && mayRend(ot) && ot.custodiaIniciada && (!ot.custodiaRendida || correcting(ot) || needsRendition(ot)) ? '' : 'none';
    if (exceptions) exceptions.style.display = !isClosed && mayRend(ot) && ot.custodiaIniciada && (!ot.custodiaRendida || correcting(ot) || needsRendition(ot)) ? '' : 'none';
    if (receive) receive.style.display = admin && totals.devolucionPendiente > 0 ? '' : 'none';

    var status = document.getElementById('ot-custodia-estado');
    var correction = document.getElementById('ot-corregir-materiales');
    if (correction) correction.remove();
    if (status && closedRecord && window.currentRole === 'admin' && window.tienePermiso?.('ot.corregirMateriales') && window.tienePermiso?.('ot.rendirMateriales') && eligible.length && isClosed) {
      correction = document.createElement('button');
      correction.id = 'ot-corregir-materiales';
      correction.className = 'btn btn-sm';
      correction.textContent = 'Corregir materiales';
      correction.onclick = async function () {
        if (!await window.svConfirm('Se habilitará la corrección de entrega y rendición de esta OT cerrada. Cada operación quedará en el historial. No se modificarán los cobros.')) return;
        correctionKey = String(ot.fbKey || ot.id);
        render(ot, visibleMaterials);
      };
      status.parentNode.insertBefore(correction, status.nextSibling);
    }
    if (status) {
      status.textContent = isClosed && eligible.length && !ot.custodiaIniciada
        ? 'Atención histórica: esta OT se completó con ' + eligible.length + ' producto' + (eligible.length === 1 ? '' : 's') + ' sin entrega ni rendición registradas'
        : !ot.custodiaIniciada ? 'El administrativo todavía no registró una entrega' :
        (!ot.custodiaRendida ? 'Material bajo responsabilidad de ' + (ot.custodiaTecnico || ot.tecnico || 'técnico') + ' · falta rendición' :
          (totals.devolucionPendiente ? 'Rendición realizada · falta confirmar la devolución en depósito' :
            (totals.enTecnico || totals.danados || totals.faltantes ? 'Rendición realizada con materiales pendientes' : 'Rendición completa')));
      status.style.color = isClosed && eligible.length && !ot.custodiaIniciada ? 'var(--red)' : '';
      status.style.fontWeight = isClosed && eligible.length && !ot.custodiaIniciada ? '700' : '';
    }
    var box = document.getElementById('ot-custodia-resumen');
    if (box) {
      box.style.display = ot.custodiaIniciada ? '' : 'none';
      box.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px;background:var(--bg3);border:0.5px solid var(--border);border-radius:var(--radius);font-size:12px">' +
        '<span><strong>' + totals.entregados + '</strong> entregados</span><span style="color:var(--green)"><strong>' + totals.instalados + '</strong> instalados</span>' +
        (totals.sinClasificar ? '<span style="color:var(--amber)"><strong>' + totals.sinClasificar + '</strong> sin clasificar</span>' : '') +
        (totals.devolucionPendiente ? '<span style="color:var(--amber)"><strong>' + totals.devolucionPendiente + '</strong> esperando recepción</span>' : '') +
        (totals.enTecnico ? '<span style="color:var(--amber)"><strong>' + totals.enTecnico + '</strong> continúan con técnico</span>' : '') +
        (totals.danados ? '<span style="color:var(--red)"><strong>' + totals.danados + '</strong> dañados</span>' : '') +
        (totals.faltantes ? '<span style="color:var(--red)"><strong>' + totals.faltantes + '</strong> faltantes</span>' : '') +
      '</div>';
    }
  }

  // Delivery and its receipt are one OT transaction. Neither operation consumes stock.
  var deliveryBusy = false;
  function deliveryFingerprint(ot) {
    return JSON.stringify({id:ot.id || '',venta:ot.ventaFbKey || ot.ventaId || '',tecnico:ot.tecnico || '',estado:ot.estado || '',materiales:(ot.materiales || []).map(function(raw) {
      var m = normalizeMaterial(raw);
      return [m.cod,m.desc,m.vendida,m.entregada,m.instalada,m.devuelta,m.devueltaPendiente,m.enTecnico,m.danada,m.faltante,
        m.custodiaActiva,m.custodiaClasificada,isAdditional(m),m.productoKey || '',m.destinoVenta || '',m.ventaDestinoFbKey || '',m.stockRegistro || '',m.stockRevision || 0];
    })});
  }
  function deliveryAllowed(ot) {
    if (!ot || window._impersonacionOriginal || !isAdministration()) return false;
    var closed = typeof window.otEstaCerrada === 'function' ? window.otEstaCerrada(ot) : ['completada','con_observaciones'].includes(String(ot.estado || '').toLowerCase());
    return !closed || correcting(ot) || pendingDelivery(ot).some(isAdditional);
  }
  function prepareDelivery(current, baseline, command) {
    if (!current) throw Error('La OT ya no existe. Volvé al listado.');
    if (current.remitosEntrega && current.remitosEntrega[command.id]) return current;
    if (deliveryFingerprint(current) !== deliveryFingerprint(baseline)) throw Error('Los materiales o el técnico cambiaron. Volvé a abrir la OT antes de entregar.');
    var next = JSON.parse(JSON.stringify(current)), rows = [];
    next.materiales = (current.materiales || []).map(function(raw) {
      var m = normalizeMaterial(raw), delta = m.vendida - m.entregada;
      if (!controllable(m) || delta <= 0 || (command.onlyAdditional && !isAdditional(m))) return raw;
      var product = productFor(m) || {};
      rows.push({codigo:m.cod,descripcion:m.desc,cantidad:delta,unidad:String(m.unidad || product.unidad || 'unidades'),adicional:isAdditional(m)});
      m.custodiaActiva = true;m.entregada = m.vendida;m.custodiaClasificada = false;
      m.entregadoEn = command.ts;m.entregadoPor = command.usuario;m.entregadoA = current.tecnico;
      return m;
    });
    if (!rows.length) throw Error('No hay materiales pendientes de entregar.');
    var documents = next.remitosEntrega || {};
    var receipt = {id:command.id,numero:'RE-' + String(current.id || 'OT') + '-' + (Object.keys(documents).length + 1),
      otId:current.id || '',tecnico:current.tecnico,cliente:current.cliente || '',fecha:command.ts,
      entregadoPor:command.usuario,entregadoPorUid:command.uid,items:rows};
    documents[command.id] = receipt;next.remitosEntrega = documents;
    next.custodiaIniciada = true;next.custodiaRendida = false;next.custodiaTecnico = current.tecnico;next.custodiaEntregadaEn = command.ts;
    // Append to the current audit, never replace a concurrent note/photo/signature.
    if (next.audit && !Array.isArray(next.audit)) next.audit = Object.values(next.audit);
    audit(next, 'Entrega ' + receipt.numero + ' a ' + current.tecnico + ' · ' + deliveryDescription(rows.map(function(r){return {vendida:r.cantidad,unidad:r.unidad};})));
    return next;
  }
  async function deliver() {
    var ot = currentOT();
    if (deliveryBusy || renditionBusy || additionalBusy || !ot || window._impersonacionOriginal || !isAdministration()) return;
    if (!ot.tecnico) { window.notify('Asigná un técnico antes de entregar materiales'); return; }
    var closed = typeof window.otEstaCerrada === 'function' ? window.otEstaCerrada(ot) : ['completada','con_observaciones'].includes(String(ot.estado || '').toLowerCase());
    var onlyAdditional = closed && !correcting(ot);
    var eligible = pendingDelivery(ot).filter(function(m){return !onlyAdditional || isAdditional(m);});
    if (!eligible.length) { window.notify('No hay materiales pendientes de entregar.'); return; }
    var baseline = JSON.parse(JSON.stringify(ot)), user = window.fbAuth?.currentUser, uid = window.currentUserUid, role = window.currentRole;
    if (!ot.fbKey || /[.#$\[\]\/]/.test(ot.fbKey) || !user || user.uid !== uid || !window.crypto?.randomUUID || !window.SVGuardedWrites?.restTransaction || !window.fbRef || !window.fbDB) {
      window.notify('No está disponible el guardado seguro de la entrega. Actualizá SisVentas.');return;
    }
    var command = {id:window.crypto.randomUUID(),ts:Date.now(),usuario:window.currentUser || 'Administración',uid:uid,onlyAdditional:onlyAdditional};
    var valid = function(){return user === window.fbAuth?.currentUser && uid === window.currentUserUid && role === window.currentRole && deliveryAllowed(ot);};
    var deliveryText = deliveryDescription(eligible.map(function(m){return Object.assign({},m,{vendida:quantity(m)-n(m.entregada)});}));
    deliveryBusy = true;
    var finish;
    try {
      if (!await window.svConfirm('Se entregarán ' + deliveryText + ' a ' + ot.tecnico + ' y se generará su remito. ¿Confirmar entrega?')) return;
      if (!valid()) throw Error('La sesión o los permisos cambiaron. Volvé a abrir la OT.');
      finish = window.SisVentas?.carga?.mostrar?.('Registrando entrega y remito…',{persistirAlNavegar:true});
      var ref = window.fbRef(window.fbDB,'sisventas/ordenes_trabajo/' + ot.fbKey), saved;
      var result = await window.SVGuardedWrites.restTransaction(ref,function(current) {
        if (!valid()) throw Error('La sesión o los permisos cambiaron. Volvé a abrir la OT.');
        saved = prepareDelivery(current,baseline,command);return saved;
      });
      if (!result.committed) throw Error('No se confirmó la entrega. Volvé a abrir la OT para verificarla.');
      Object.assign(ot,result.value || saved);
      window._otGuardandoLocalHasta = Date.now() + 3000;
      updateGlobal();if (currentOT() === ot) render(ot,controllableMaterials(ot));
      window.notify('✓ Entrega registrada y remito generado.');
    } catch(error) { window.notify('No se pudo confirmar la entrega: ' + error.message + ' Verificá la OT antes de reintentar.'); }
    finally { deliveryBusy = false;if (typeof finish === 'function') finish(); }
  }
  function receiptHTML(receipt) {
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(receipt.numero) + '</title><style>' +
      '*{box-sizing:border-box}body{margin:0;background:#edf1f7;color:#172238;font:14px Arial,sans-serif}main{max-width:800px;margin:24px auto;padding:32px;background:white}h1{font-size:22px}header{border-bottom:2px solid #172238;padding-bottom:16px}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{text-align:left;padding:10px 6px;border-bottom:1px solid #dce2eb;overflow-wrap:anywhere}.qty{text-align:right;white-space:nowrap}footer{margin-top:48px;display:flex;justify-content:space-between;gap:24px}button{display:block;margin:20px auto;padding:12px 24px}tr,header,footer{break-inside:avoid}@media(max-width:600px){main{padding:16px;margin:0}table{font-size:12px}}@media print{@page{size:A4;margin:12mm}body{background:white}main{max-width:none;margin:0;padding:0}button{display:none}thead{display:table-header-group}}</style></head><body><main><header><h1>Remito de entrega al técnico</h1><strong>' + esc(receipt.numero) + '</strong><p>OT: ' + esc(receipt.otId) + ' · ' + esc(new Date(receipt.fecha).toLocaleString('es-AR')) + '</p><p>Técnico: <strong>' + esc(receipt.tecnico) + '</strong></p><p>Cliente: ' + esc(receipt.cliente) + '</p></header><table><thead><tr><th>Código</th><th>Material</th><th class="qty">Cantidad</th></tr></thead><tbody>' +
      receipt.items.map(function(r){return '<tr><td>' + esc(r.codigo) + '</td><td>' + esc(r.descripcion) + (r.adicional ? ' · Adicional' : '') + '</td><td class="qty">' + esc(r.cantidad) + ' ' + esc(r.unidad) + '</td></tr>';}).join('') +
      '</tbody></table><p>Materiales entregados bajo custodia. Este remito no acredita su instalación.</p><footer><span>Entregó: ' + esc(receipt.entregadoPor) + '</span><span>Recibió: ____________________</span></footer></main><button onclick="window.print()">Imprimir / guardar PDF</button></body></html>';
  }
  function openDeliveryReceipt(id) {
    var ot = currentOT(), receipt = ot && ot.remitosEntrega && ot.remitosEntrega[id];
    if (!receipt || window._impersonacionOriginal || !window.fbAuth?.currentUser || window.fbAuth.currentUser.uid !== window.currentUserUid) return;
    var popup = window.open('','_blank');
    if (!popup) {window.notify('Permití abrir la ventana del remito.');return;}
    popup.opener = null;popup.document.open();popup.document.write(receiptHTML(receipt));popup.document.close();
  }
  function renderDeliveryReceipts(ot) {
    var anchor = document.getElementById('ot-custodia-resumen');
    if (!anchor || !anchor.parentNode) return;
    var box = document.getElementById('ot-remitos-entrega');
    if (!box) {box = document.createElement('div');box.id = 'ot-remitos-entrega';anchor.parentNode.insertBefore(box,anchor.nextSibling);}
    var receipts = Object.values(ot.remitosEntrega || {}).sort(function(a,b){return b.fecha-a.fecha;});
    box.innerHTML = receipts.length ? '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0"><strong style="font-size:12px">Remitos de entrega</strong>' + receipts.map(function(r){return '<button type="button" class="btn btn-sm" data-delivery-receipt="' + esc(r.id) + '">' + esc(r.numero) + '</button>';}).join('') + '</div>' : '';
    box.querySelectorAll('[data-delivery-receipt]').forEach(function(button){button.onclick=function(){openDeliveryReceipt(button.dataset.deliveryReceipt);};});
  }

  function syncInstalled(ot, before) {
    if (!window.SisVentasCompras || typeof window.SisVentasCompras.syncOTConsumption !== 'function') return Promise.reject(new Error('No está listo el registro de stock. Actualizá SisVentas.'));
    var jobs = [];
    (ot.materiales || []).forEach(function (material, index) {
      var oldMaterial = before[index] || {};
      if (n(oldMaterial.instalada) !== n(material.instalada)) {
        oldMaterial = Object.assign({}, oldMaterial, {_stockLegacyTotal:before.filter(function(m){return String(m.cod||m.codigo)===String(material.cod||material.codigo) && String(m.destinoVenta||'original')===String(material.destinoVenta||'original') && String(m.ventaDestinoFbKey||'')===String(material.ventaDestinoFbKey||'');}).reduce(function(sum,m){return sum+n(m.instalada);},0)});
        jobs.push(function(){return window.SisVentasCompras.syncOTConsumption(ot, oldMaterial, material);});
      }
    });
    return jobs.reduce(function(chain, job) { return chain.then(job); }, Promise.resolve());
  }

  async function installOne(index) {
    var original = currentOT();
    if (!original || !mayRend(original) || renditionBusy || additionalBusy || deliveryBusy) return;
    var rows = materialRows(original), selected = rows[index];
    if (!selected || !controllable(selected)) { window.notify('No se encontró el material. Volvé a abrir la OT.'); return; }
    var material = normalizeMaterial(selected);
    var needsDelivery = !material.custodiaActiva || n(material.entregada) < quantity(material);
    if (needsDelivery && !(isAdditional(material) ? window.tienePermiso?.('ot.corregirMateriales') : isAdministration())) { window.notify('Administración debe confirmar la entrega de este material.'); return; }
    if (material.stockPendiente) { window.notify('Completá primero el stock pendiente.'); return; }
    if (!needsDelivery && material.instalada >= installationTarget(material) && !selected._recuperado) return;
    var stamp = JSON.stringify(original.materiales || []), id = original.fbKey || original.id;
    var prompt = '¿Confirmás instalado ' + (material.desc || material.cod) + '? Sólo se actualizará este ítem.';
    if (needsDelivery) prompt += ' Se dejará registrada también su entrega al técnico.';
    if (selected._recuperado) prompt += ' Se conservará el renglón anterior, sin crear productos ni ventas.';
    if (!await window.svConfirm(prompt)) return;
    if (!currentOT() || (currentOT().fbKey || currentOT().id) !== id || JSON.stringify(currentOT().materiales || []) !== stamp) {window.notify('La OT cambió. Volvé a abrirla.');return;}
    var draft = JSON.parse(JSON.stringify(original));
    draft.materiales = persistedRows(rows);
    var before = draft.materiales.map(function(m){return Object.assign({},m);});
    material = normalizeMaterial(draft.materiales[index]);
    if (needsDelivery) {material.custodiaActiva = true;material.entregada = quantity(material);material.entregadoPor = window.currentUser || 'Administración';material.entregadoA = original.tecnico || '';material.entregadoEn = Date.now();}
    material.instalada = installationTarget(material);
    material.enTecnico = 0;material.custodiaClasificada = true;material.estadoCustodia = material.devueltaPendiente ? 'devolucion_pendiente' : ((material.danada || material.faltante) ? 'incidencia' : 'instalado');
    draft.materiales[index] = material;draft.custodiaIniciada = true;
    draft.custodiaRendida = draft.materiales.filter(controllable).every(function(m){return m.custodiaActiva === true && n(m.entregada) >= quantity(m) && classified(m) >= n(m.entregada);});
    draft.custodiaRendidaPor = window.currentUser || original.tecnico || 'Técnico';draft.custodiaRendidaEn = Date.now();
    try {await persistRendition(draft,before,'Instalación individual: ' + (isAdditional(material) ? 'adicional ' : 'original ') + (material.cod || material.desc));window.notify('Instalación del ítem registrada');}
    catch(error) {window.notify('No se pudo registrar la instalación: ' + error.message);}
  }
  window.otCustodiaInstalarItem = installOne;

  async function allInstalled() {
    if (typeof window.tienePermiso !== 'function' || !window.tienePermiso('ot.rendirMateriales')) { window.notify('No tenés permiso para rendir materiales.'); return; }
    var ot = currentOT();
    if (!ot || !ot.custodiaIniciada || !mayRend(ot) || (ot.custodiaRendida && !correcting(ot) && !needsRendition(ot)) || renditionBusy || deliveryBusy) return;
    if (!await window.svConfirm('¿Confirmás que todo el material entregado quedó instalado?')) return;
    var effectiveRows = materialRows(ot);
    ot = JSON.parse(JSON.stringify(ot));
    ot.materiales = persistedRows(effectiveRows);
    var before = (ot.materiales || []).map(function (material) { return Object.assign({}, material); });
    ot.materiales = (ot.materiales || []).map(function (raw) {
      var material = normalizeMaterial(raw);
      if (!material.custodiaActiva && isAdditional(material) && window.tienePermiso?.('ot.corregirMateriales')) {material.custodiaActiva=true;material.entregada=quantity(material);material.entregadoPor=window.currentUser||'Administración';material.entregadoA=ot.tecnico||'';material.entregadoEn=Date.now();}
      if (!material.custodiaActiva) return material;
      material.instalada = Math.max(0, material.entregada - material.devuelta);
      material.devueltaPendiente = 0;
      material.enTecnico = 0;
      material.danada = 0;
      material.faltante = 0;
      material.custodiaClasificada = true;
      material.estadoCustodia = 'instalado';
      return material;
    });
    ot.custodiaRendida = ot.materiales.filter(controllable).every(function(m){return m.custodiaActiva === true && n(m.entregada) >= quantity(m) && classified(m) >= n(m.entregada);});
    ot.custodiaRendidaEn = Date.now();
    ot.custodiaRendidaPor = window.currentUser || ot.tecnico || 'Técnico';
    return persistRendition(ot, before, 'Rendición de materiales: todo instalado').then(function () { window.notify('✓ Materiales rendidos como instalados'); })
      .catch(function (error) { window.notify('No se pudo guardar la rendición: ' + error.message); });
  }

  function exceptionRow(material, index) {
    material = normalizeMaterial(material);
    if (!material.custodiaActiva) return '';
    return '<div class="ot-custodia-ex-row" data-index="' + index + '" data-entregada="' + Math.max(0, material.entregada - material.devuelta) + '" style="padding:12px;background:var(--bg3);border:0.5px solid var(--border);border-radius:var(--radius)">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:9px"><div><strong>' + esc(material.cod || '') + '</strong> · ' + esc(material.desc || '') + '</div><span class="badge b-blue">Entregado: ' + material.entregada + '</span></div>' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:7px">Indicá solamente las excepciones. El resto se calculará automáticamente como instalado.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:7px">' +
        '<label style="font-size:10px;color:var(--text3)">Vuelve al depósito<input class="search-input ot-ex-return" type="number" min="0" step="1" value="' + material.devueltaPendiente + '" oninput="otCustodiaRecalcularFila(this)" style="margin-top:3px;width:100%"></label>' +
        '<label style="font-size:10px;color:var(--text3)">Sigue con técnico<input class="search-input ot-ex-tech" type="number" min="0" step="1" value="' + material.enTecnico + '" oninput="otCustodiaRecalcularFila(this)" style="margin-top:3px;width:100%"></label>' +
        '<label style="font-size:10px;color:var(--text3)">Dañado<input class="search-input ot-ex-damaged" type="number" min="0" step="1" value="' + material.danada + '" oninput="otCustodiaRecalcularFila(this)" style="margin-top:3px;width:100%"></label>' +
        '<label style="font-size:10px;color:var(--text3)">Faltante<input class="search-input ot-ex-missing" type="number" min="0" step="1" value="' + material.faltante + '" oninput="otCustodiaRecalcularFila(this)" style="margin-top:3px;width:100%"></label>' +
      '</div><div class="ot-ex-installed" style="font-size:11px;color:var(--green);margin-top:8px;font-weight:700">Se instalaron: ' + material.entregada + '</div>' +
    '</div>';
  }

  function openExceptions() {
    if (typeof window.tienePermiso !== 'function' || !window.tienePermiso('ot.rendirMateriales')) { window.notify('No tenés permiso para rendir materiales.'); return; }
    var ot = currentOT();
    if (!ot || !ot.custodiaIniciada || !mayRend(ot) || (ot.custodiaRendida && !correcting(ot) && !needsRendition(ot)) || renditionBusy || deliveryBusy) return;
    var previous = document.getElementById('ot-custodia-modal');
    if (previous) previous.remove();
    var overlay = document.createElement('div');
    overlay.id = 'ot-custodia-modal';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = '<div class="modal" style="max-width:820px;width:min(820px,96vw)">' +
      '<div class="modal-head"><div><strong>Rendición de materiales</strong><div style="font-size:11px;color:var(--text3);margin-top:2px">Sólo completá lo que no quedó instalado</div></div><button class="btn btn-sm btn-icon" onclick="document.getElementById(\'ot-custodia-modal\').remove()"><i class="ti ti-x"></i></button></div>' +
      '<div class="modal-body"><div style="display:flex;flex-direction:column;gap:9px;max-height:60vh;overflow:auto">' + (ot.materiales || []).map(exceptionRow).join('') + '</div>' +
      '<div id="ot-custodia-error" style="display:none;color:var(--red);font-size:12px;margin-top:10px"></div>' +
      '<div class="flex-end" style="margin-top:14px"><button class="btn" onclick="document.getElementById(\'ot-custodia-modal\').remove()">Cancelar</button><button class="btn btn-primary" onclick="otCustodiaGuardarExcepciones()"><i class="ti ti-device-floppy"></i> Guardar rendición</button></div></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.ot-custodia-ex-row').forEach(function (row) { recalcRow(row); });
  }

  function recalcRow(element) {
    var row = element && element.closest ? element.closest('.ot-custodia-ex-row') : element;
    if (!row) return;
    var delivered = n(row.dataset.entregada);
    var exceptions = n((row.querySelector('.ot-ex-return') || {}).value) + n((row.querySelector('.ot-ex-tech') || {}).value) + n((row.querySelector('.ot-ex-damaged') || {}).value) + n((row.querySelector('.ot-ex-missing') || {}).value);
    var installed = delivered - exceptions;
    var label = row.querySelector('.ot-ex-installed');
    if (label) {
      label.textContent = installed >= 0 ? 'Se instalaron: ' + installed : 'Las excepciones superan lo entregado';
      label.style.color = installed >= 0 ? 'var(--green)' : 'var(--red)';
    }
  }

  function saveExceptions() {
    var ot = currentOT();
    var modal = document.getElementById('ot-custodia-modal');
    if (!ot || !modal || !mayRend(ot) || renditionBusy || deliveryBusy) return;
    ot = JSON.parse(JSON.stringify(ot));
    var before = (ot.materiales || []).map(function (material) { return Object.assign({}, material); });
    var invalid = '';
    modal.querySelectorAll('.ot-custodia-ex-row').forEach(function (row) {
      var index = parseInt(row.dataset.index, 10);
      var material = normalizeMaterial(ot.materiales[index]);
      var returned = n((row.querySelector('.ot-ex-return') || {}).value);
      var technician = n((row.querySelector('.ot-ex-tech') || {}).value);
      var damaged = n((row.querySelector('.ot-ex-damaged') || {}).value);
      var missing = n((row.querySelector('.ot-ex-missing') || {}).value);
      var exceptionTotal = returned + technician + damaged + missing;
      if (exceptionTotal > Math.max(0, material.entregada - material.devuelta)) invalid = (material.cod || material.desc || 'Un material') + ': las excepciones superan lo entregado.';
      material.devueltaPendiente = returned;
      material.enTecnico = technician;
      material.danada = damaged;
      material.faltante = missing;
      material.instalada = Math.max(0, material.entregada - material.devuelta - exceptionTotal);
      material.custodiaClasificada = exceptionTotal <= Math.max(0, material.entregada - material.devuelta);
      material.estadoCustodia = technician ? 'en_tecnico' : (returned ? 'devolucion_pendiente' : (damaged || missing ? 'incidencia' : 'instalado'));
      ot.materiales[index] = material;
    });
    if (invalid) {
      var error = document.getElementById('ot-custodia-error');
      if (error) { error.style.display = ''; error.textContent = invalid; }
      return;
    }
    ot.custodiaRendida = true;
    ot.custodiaRendidaEn = Date.now();
    ot.custodiaRendidaPor = window.currentUser || ot.tecnico || 'Técnico';
    return persistRendition(ot, before, 'Rendición de materiales registrada con excepciones').then(function () {
      modal.remove();
      window.notify('✓ Rendición guardada. Las devoluciones esperan recepción administrativa.');
    }).catch(function (error) { window.notify('No se pudo guardar la rendición: ' + error.message); });
  }

  async function confirmReception() {
    var ot = currentOT();
    if (!ot || !isAdministration()) return;
    var receptions = [];
    (ot.materiales || []).forEach(function (material) {
      var quantity = n(material.devueltaPendiente);
      if (quantity) receptions.push({ material:Object.assign({}, material), cantidad:quantity });
    });
    if (!receptions.length) { window.notify('No hay devoluciones pendientes en esta OT'); return; }
    var total = receptions.reduce(function (sum, entry) { return sum + entry.cantidad; }, 0);
    if (!await window.svConfirm('¿Confirmás que depósito recibió ' + total + ' unidad(es)?')) return;
    var inventoryJob = window.SisVentasCompras && typeof window.SisVentasCompras.receiveOTReturns === 'function'
      ? window.SisVentasCompras.receiveOTReturns(ot, receptions) : Promise.resolve();
    Promise.resolve(inventoryJob).then(function () {
      ot.materiales = (ot.materiales || []).map(function (raw) {
        var material = normalizeMaterial(raw);
        if (!material.devueltaPendiente) return material;
        material.devuelta += material.devueltaPendiente;
        material.devueltaPendiente = 0;
        material.recibidoEn = Date.now();
        material.recibidoPor = window.currentUser || 'Administración';
        material.estadoCustodia = material.enTecnico ? 'en_tecnico' : (material.danada || material.faltante ? 'incidencia' : (material.instalada ? 'rendido' : 'devuelto'));
        return material;
      });
      if (ot.estado === 'con_observaciones' && ot.cierreConObservaciones && ot.custodiaRendida && !summary(ot).conObservaciones) {
        ot.estado = 'completada';
        ot.cierreConObservaciones = false;
      }
      return save(ot, 'Depósito confirmó la recepción de ' + total + ' unidad(es) devueltas');
    }).then(function () { window.notify('✓ Devolución recibida y material reincorporado'); })
      .catch(function (error) { window.notify('No se pudo confirmar la devolución: ' + error.message); });
  }

  var additionalBusy = false;
  async function completeAdditionalStock(ot) {
    if (additionalBusy || deliveryBusy) throw Error('Ya se está registrando el stock.');
    if (!window.tienePermiso?.('ot.corregirMateriales')) throw Error('No tenés permiso para corregir materiales.');
    ot = ot || currentOT();if (!ot) throw Error('OT no encontrada');
    if (!window.SisVentasCompras?.syncOTConsumption || typeof window.otPersistirActualizar !== 'function') throw Error('No está listo el registro de stock');
    additionalBusy = true;
    var finish = window.SisVentas?.carga?.mostrar?.('Registrando stock del adicional…', {persistirAlNavegar:true});
    try {
      var draft = JSON.parse(JSON.stringify(ot));
      for (var i=0;i<draft.materiales.length;i++) {
        var material = draft.materiales[i];if (!material.stockPendiente) continue;
        if (material.adicionalOT !== true || material.stockBaseInstalada == null) throw Error('El adicional requiere revisar su registro de instalación.');
        var before = Object.assign({}, material, {instalada:material.stockBaseInstalada});
        await window.SisVentasCompras.syncOTConsumption(draft, before, material);
        material.stockPendiente = false;delete material.stockBaseInstalada;
      }
      draft.custodiaIniciada = true;
      var totals = summary(draft);
      draft.custodiaRendida = totals.sinClasificar === 0;
      var auditRows = (draft.audit || []).concat([{fecha:new Date().toLocaleString('es-AR'),usuario:window.currentUser||'Sistema',accion:'Stock de adicionales instalados registrado sin duplicar consumos'}]);
      await window.otPersistirActualizar(ot.fbKey, {materiales:draft.materiales,custodiaIniciada:true,custodiaRendida:draft.custodiaRendida,audit:auditRows});
      Object.assign(ot,{materiales:draft.materiales,custodiaIniciada:true,custodiaRendida:draft.custodiaRendida,audit:auditRows});
      updateGlobal();return ot;
    } finally {additionalBusy=false;if(typeof finish==='function')finish();}
  }
  window.otCustodiaCompletarStock = completeAdditionalStock;

  var correctionKey = '';
  function validateClose(ot) {
    if (!ot) return { ok:true, conObservaciones:false };
    if ((ot.materiales || []).some(function(m){return m.stockPendiente === true;})) return {ok:false,message:'Hay un adicional instalado con stock pendiente. Completá su registro en Materiales.'};
    var recovered = materialRows(ot).filter(function(m){return m._recuperado && controllable(m);});
    if (recovered.length) return {ok:false,message:'Hay materiales anteriores pendientes de confirmar. Revisalos en Repuestos.'};
    var eligible = controllableMaterials(ot);
    if (!eligible.length) return { ok:true, conObservaciones:false };
    if (!ot.custodiaIniciada) {
      return {
        ok:false,
        requiereEntrega:true,
        materiales:eligible.length,
        message:'Hay ' + eligible.length + ' producto' + (eligible.length === 1 ? '' : 's') + ' sin entrega registrada. Administración debe registrar la entrega en Materiales antes de finalizar.'
      };
    }
    var totals = summary(ot);
    if (!ot.custodiaRendida || totals.sinClasificar > 0) {
      return { ok:false, message:'Falta rendir ' + (totals.sinClasificar || totals.entregados) + ' unidad(es) entregadas. Confirmá “Todo instalado” o informá las excepciones.' };
    }
    return { ok:true, conObservaciones:totals.conObservaciones, resumen:totals };
  }

  function updateGlobal() {
    var custodyUnits = 0;
    var returns = 0;
    var incidents = 0;
    (window.otData || []).forEach(function (ot) {
      var totals = summary(ot);
      custodyUnits += totals.sinClasificar + totals.enTecnico;
      returns += totals.devolucionPendiente;
      incidents += totals.danados + totals.faltantes;
    });
    var metric = document.getElementById('ot-met-custodia');
    var sub = document.getElementById('ot-met-custodia-sub');
    if (metric) metric.textContent = custodyUnits + returns + incidents;
    if (sub) sub.textContent = returns ? returns + ' esperando recepción' : (incidents ? incidents + ' con incidencia' : (custodyUnits ? custodyUnits + ' en técnicos' : 'sin pendientes'));
  }

  function openOT(key) {
    var modal = document.getElementById('ot-custodia-panel');
    if (modal) modal.remove();
    if (typeof window.verOT === 'function') window.verOT(key);
  }

  function openPanel() {
    if (!isAdministration()) return;
    var rows = [];
    (window.otData || []).forEach(function (ot) {
      var totals = summary(ot);
      var pending = totals.sinClasificar + totals.devolucionPendiente + totals.enTecnico + totals.danados + totals.faltantes;
      if (!pending) return;
      var materiales = controllableMaterials(ot).map(function (raw) {
        var material = normalizeMaterial(raw);
        if (!material.custodiaActiva) return '';
        var sinClasificar = Math.max(0, material.entregada - classified(material));
        var estados = [];
        if (sinClasificar) estados.push('sin rendir: ' + sinClasificar);
        if (material.devueltaPendiente) estados.push('por recibir: ' + material.devueltaPendiente);
        if (material.enTecnico) estados.push('con técnico: ' + material.enTecnico);
        if (material.danada) estados.push('dañado: ' + material.danada);
        if (material.faltante) estados.push('faltante: ' + material.faltante);
        if (!estados.length) return '';
        var codigo = material.cod || material.codigo || '';
        var descripcion = material.desc || material.descripcion || (productFor(material) || {}).nombre || 'Producto sin descripción';
        return '<div style="margin-bottom:5px"><strong>' + esc(descripcion) + '</strong>' +
          (codigo ? '<div style="font-size:10px;color:var(--text3)">' + esc(codigo) + '</div>' : '') +
          '<div style="font-size:11px;color:var(--text2)">' + esc(estados.join(' · ')) + '</div></div>';
      }).filter(Boolean).join('');
      rows.push('<tr><td><strong>' + esc(ot.id || 'OT') + '</strong><div style="font-size:10px;color:var(--text3)">' + esc(ot.cliente || '') + '</div></td><td>' + esc(ot.custodiaTecnico || ot.tecnico || 'Sin asignar') + '</td><td>' + (materiales || '<span style="color:var(--text3)">Sin detalle disponible</span>') + '</td><td>' +
        (totals.sinClasificar ? '<span class="badge b-amber">Sin rendir ' + totals.sinClasificar + '</span> ' : '') +
        (totals.devolucionPendiente ? '<span class="badge b-amber">Por recibir ' + totals.devolucionPendiente + '</span> ' : '') +
        (totals.enTecnico ? '<span class="badge b-blue">Con técnico ' + totals.enTecnico + '</span> ' : '') +
        (totals.danados ? '<span class="badge b-red">Dañado ' + totals.danados + '</span> ' : '') +
        (totals.faltantes ? '<span class="badge b-red">Faltante ' + totals.faltantes + '</span>' : '') +
        '</td><td class="tr"><button class="btn btn-sm" onclick="otCustodiaAbrirOT(\'' + esc(ot.fbKey || ot.id || '') + '\')">Ver OT</button></td></tr>');
    });
    var previous = document.getElementById('ot-custodia-panel');
    if (previous) previous.remove();
    var overlay = document.createElement('div');
    overlay.id = 'ot-custodia-panel';
    overlay.className = 'modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = '<div class="modal" style="max-width:1080px;width:min(1080px,96vw)"><div class="modal-head"><div><strong>Material en custodia</strong><div style="font-size:11px;color:var(--text3);margin-top:2px">Equipos que requieren rendición, recepción o seguimiento</div></div><button class="btn btn-sm btn-icon" onclick="document.getElementById(\'ot-custodia-panel\').remove()"><i class="ti ti-x"></i></button></div><div class="modal-body"><div class="table-wrap"><table><thead><tr><th>OT</th><th>Técnico</th><th>Material y cantidad</th><th>Situación</th><th></th></tr></thead><tbody>' + (rows.join('') || '<tr><td colspan="5" style="padding:28px;text-align:center;color:var(--text3)">No hay materiales pendientes de rendición.</td></tr>') + '</tbody></table></div></div></div>';
    document.body.appendChild(overlay);
  }

  window.SVOTDeliveryReceipt = Object.freeze({prepare:prepareDelivery,html:receiptHTML});
  window.otCustodiaVerRemito = openDeliveryReceipt;
  window.otCustodiaEsMaterialControlable = controllable;
  window.otCustodiaNormalizarMaterial = normalizeMaterial;
  window.otCustodiaDescripcionEntrega = deliveryDescription;
  window.otCustodiaRenderMateriales = render;
  window.otCustodiaEntregar = deliver;
  window.otCustodiaTodoInstalado = allInstalled;
  window.otCustodiaAbrirExcepciones = openExceptions;
  window.otCustodiaRecalcularFila = recalcRow;
  window.otCustodiaGuardarExcepciones = saveExceptions;
  window.otCustodiaConfirmarRecepcion = confirmReception;
  window.otCustodiaValidarCierre = validateClose;
  window.otCustodiaResumen = summary;
  window.otCustodiaActualizarResumenGlobal = updateGlobal;
  window.otCustodiaAbrirPanel = openPanel;
  window.otCustodiaAbrirOT = openOT;
})();
