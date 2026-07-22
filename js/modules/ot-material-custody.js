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
    var role = String(window.currentRole || '').toLowerCase();
    return role === 'admin' || role === 'administrativo';
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

  function controllable(material) {
    if (!material || n(material.vendida) <= 0) return false;
    var product = productFor(material);
    if (!product) return true;
    if (product.esManoDeObra) return false;
    var category = String(product.categoria || '').toUpperCase();
    return !category.includes('MANO DE OBRA') && !category.includes('INSTALACION') && !category.includes('CONFIGURACION');
  }

  function normalizeMaterial(material) {
    material = material || {};
    return Object.assign({}, material, {
      custodiaActiva: material.custodiaActiva === true,
      entregada: n(material.entregada),
      instalada: n(material.instalada),
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
    result.conObservaciones = result.devolucionPendiente + result.devueltos + result.enTecnico + result.danados + result.faltantes > 0;
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
    var promise = typeof window.fbGuardarOT === 'function' ? window.fbGuardarOT(ot) : Promise.resolve();
    return Promise.resolve(promise).then(function () {
      updateGlobal();
      if (typeof window.verOT === 'function' && window.otActualId) window.verOT(ot.fbKey || ot.id);
      return ot;
    });
  }

  function stateBadge(material) {
    material = normalizeMaterial(material);
    if (!material.custodiaActiva) return '<span class="badge">No entregado</span>';
    var parts = [];
    var pending = Math.max(0, material.entregada - classified(material));
    if (pending) parts.push('<span class="badge b-amber">Con técnico: ' + pending + '</span>');
    if (material.instalada) parts.push('<span class="badge b-green">Instalado: ' + material.instalada + '</span>');
    if (material.devueltaPendiente) parts.push('<span class="badge b-amber">Devolución pendiente: ' + material.devueltaPendiente + '</span>');
    if (material.devuelta) parts.push('<span class="badge b-blue">Devuelto: ' + material.devuelta + '</span>');
    if (material.enTecnico) parts.push('<span class="badge b-amber">Sigue con técnico: ' + material.enTecnico + '</span>');
    if (material.danada) parts.push('<span class="badge b-red">Dañado: ' + material.danada + '</span>');
    if (material.faltante) parts.push('<span class="badge b-red">Faltante: ' + material.faltante + '</span>');
    return parts.join(' ') || '<span class="badge b-amber">Pendiente de rendición</span>';
  }

  function render(ot, visibleMaterials) {
    var tbody = document.getElementById('ot-materiales');
    if (!tbody) return;
    var materials = visibleMaterials || [];
    tbody.innerHTML = materials.length ? materials.map(function (view) {
      var index = typeof view._indice === 'number' ? view._indice : (ot.materiales || []).indexOf(view);
      var material = normalizeMaterial((ot.materiales || [])[index] || view);
      return '<tr>' +
        '<td style="font-size:12px;color:var(--text3)">' + esc(material.cod || material.codigo || '') + '</td>' +
        '<td>' + esc(material.desc || material.descripcion || '') + '</td>' +
        '<td class="tr">' + n(material.vendida) + '</td>' +
        '<td class="tr">' + (material.custodiaActiva ? material.entregada : '—') + '</td>' +
        '<td><div style="display:flex;gap:5px;flex-wrap:wrap">' + stateBadge(material) + '</div></td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:12px">Sin materiales controlables</td></tr>';

    var totals = summary(ot);
    var isClosed = ['completada','con_observaciones'].indexOf(String(ot.estado || '').toLowerCase()) >= 0;
    var admin = isAdministration();
    var deliver = document.getElementById('ot-btn-entregar-materiales');
    var allInstalled = document.getElementById('ot-btn-todo-instalado');
    var exceptions = document.getElementById('ot-btn-excepciones');
    var receive = document.getElementById('ot-btn-recibir-devolucion');
    if (deliver) deliver.style.display = admin && !isClosed && !ot.custodiaIniciada && materials.length ? '' : 'none';
    if (allInstalled) allInstalled.style.display = !isClosed && ot.custodiaIniciada && !ot.custodiaRendida ? '' : 'none';
    if (exceptions) exceptions.style.display = !isClosed && ot.custodiaIniciada && !ot.custodiaRendida ? '' : 'none';
    if (receive) receive.style.display = admin && totals.devolucionPendiente > 0 ? '' : 'none';

    var status = document.getElementById('ot-custodia-estado');
    if (status) {
      status.textContent = !ot.custodiaIniciada ? 'El administrativo todavía no registró una entrega' :
        (!ot.custodiaRendida ? 'Material bajo responsabilidad de ' + (ot.custodiaTecnico || ot.tecnico || 'técnico') + ' · falta rendición' :
          (totals.devolucionPendiente ? 'Rendición realizada · falta confirmar la devolución en depósito' :
            (totals.enTecnico || totals.danados || totals.faltantes ? 'Rendición realizada con materiales pendientes' : 'Rendición completa')));
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

  function deliver() {
    var ot = currentOT();
    if (!ot || !isAdministration()) return;
    if (!ot.tecnico) { window.notify('Asigná un técnico antes de entregar materiales'); return; }
    var eligible = (ot.materiales || []).filter(controllable);
    if (!eligible.length) { window.notify('Esta OT no tiene equipos o materiales controlables'); return; }
    if (!window.confirm('Se registrarán ' + eligible.length + ' materiales de la OT bajo responsabilidad de ' + ot.tecnico + '. ¿Confirmar entrega?')) return;
    var now = Date.now();
    ot.materiales = (ot.materiales || []).map(function (raw) {
      var material = normalizeMaterial(raw);
      if (!controllable(material)) return material;
      material.custodiaActiva = true;
      material.entregada = n(material.vendida);
      material.custodiaClasificada = false;
      material.entregadoEn = now;
      material.entregadoPor = window.currentUser || 'Administración';
      material.entregadoA = ot.tecnico;
      return material;
    });
    ot.custodiaIniciada = true;
    ot.custodiaRendida = false;
    ot.custodiaTecnico = ot.tecnico;
    ot.custodiaEntregadaEn = now;
    save(ot, 'Materiales entregados a ' + ot.tecnico + ' · ' + eligible.length + ' renglones bajo custodia')
      .then(function () { window.notify('✓ Entrega registrada. Los materiales quedaron a cargo de ' + ot.tecnico); })
      .catch(function (error) { window.notify('No se pudo registrar la entrega: ' + error.message); });
  }

  function syncInstalled(ot, before) {
    if (!window.SisVentasCompras || typeof window.SisVentasCompras.syncOTConsumption !== 'function') return Promise.resolve();
    var jobs = [];
    (ot.materiales || []).forEach(function (material, index) {
      var oldMaterial = before[index] || {};
      if (n(oldMaterial.instalada) !== n(material.instalada)) jobs.push(window.SisVentasCompras.syncOTConsumption(ot, oldMaterial, material));
    });
    return Promise.all(jobs);
  }

  function allInstalled() {
    var ot = currentOT();
    if (!ot || !ot.custodiaIniciada || ot.custodiaRendida) return;
    if (!window.confirm('¿Confirmás que todo el material entregado quedó instalado?')) return;
    var before = (ot.materiales || []).map(function (material) { return Object.assign({}, material); });
    ot.materiales = (ot.materiales || []).map(function (raw) {
      var material = normalizeMaterial(raw);
      if (!material.custodiaActiva) return material;
      material.instalada = material.entregada;
      material.devueltaPendiente = 0;
      material.enTecnico = 0;
      material.danada = 0;
      material.faltante = 0;
      material.custodiaClasificada = true;
      material.estadoCustodia = 'instalado';
      return material;
    });
    ot.custodiaRendida = true;
    ot.custodiaRendidaEn = Date.now();
    ot.custodiaRendidaPor = window.currentUser || ot.tecnico || 'Técnico';
    syncInstalled(ot, before).then(function () {
      return save(ot, 'Rendición de materiales: todo instalado');
    }).then(function () { window.notify('✓ Materiales rendidos como instalados'); })
      .catch(function (error) { window.notify('No se pudo guardar la rendición: ' + error.message); });
  }

  function exceptionRow(material, index) {
    material = normalizeMaterial(material);
    if (!material.custodiaActiva) return '';
    return '<div class="ot-custodia-ex-row" data-index="' + index + '" data-entregada="' + material.entregada + '" style="padding:12px;background:var(--bg3);border:0.5px solid var(--border);border-radius:var(--radius)">' +
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
    var ot = currentOT();
    if (!ot || !ot.custodiaIniciada || ot.custodiaRendida) return;
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
    if (!ot || !modal) return;
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
      if (exceptionTotal > material.entregada) invalid = (material.cod || material.desc || 'Un material') + ': las excepciones superan lo entregado.';
      material.devueltaPendiente = returned;
      material.enTecnico = technician;
      material.danada = damaged;
      material.faltante = missing;
      material.instalada = Math.max(0, material.entregada - exceptionTotal);
      material.custodiaClasificada = exceptionTotal <= material.entregada;
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
    syncInstalled(ot, before).then(function () {
      return save(ot, 'Rendición de materiales registrada con excepciones');
    }).then(function () {
      modal.remove();
      window.notify('✓ Rendición guardada. Las devoluciones esperan recepción administrativa.');
    }).catch(function (error) { window.notify('No se pudo guardar la rendición: ' + error.message); });
  }

  function confirmReception() {
    var ot = currentOT();
    if (!ot || !isAdministration()) return;
    var receptions = [];
    (ot.materiales || []).forEach(function (material) {
      var quantity = n(material.devueltaPendiente);
      if (quantity) receptions.push({ material:Object.assign({}, material), cantidad:quantity });
    });
    if (!receptions.length) { window.notify('No hay devoluciones pendientes en esta OT'); return; }
    var total = receptions.reduce(function (sum, entry) { return sum + entry.cantidad; }, 0);
    if (!window.confirm('¿Confirmás que depósito recibió ' + total + ' unidad(es)?')) return;
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
      return save(ot, 'Depósito confirmó la recepción de ' + total + ' unidad(es) devueltas');
    }).then(function () { window.notify('✓ Devolución recibida y material reincorporado'); })
      .catch(function (error) { window.notify('No se pudo confirmar la devolución: ' + error.message); });
  }

  function validateClose(ot) {
    if (!ot || !ot.custodiaIniciada) return { ok:true, conObservaciones:false };
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
      rows.push('<tr><td><strong>' + esc(ot.id || 'OT') + '</strong><div style="font-size:10px;color:var(--text3)">' + esc(ot.cliente || '') + '</div></td><td>' + esc(ot.custodiaTecnico || ot.tecnico || 'Sin asignar') + '</td><td>' +
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
    overlay.innerHTML = '<div class="modal" style="max-width:900px;width:min(900px,96vw)"><div class="modal-head"><div><strong>Material en custodia</strong><div style="font-size:11px;color:var(--text3);margin-top:2px">Equipos que requieren rendición, recepción o seguimiento</div></div><button class="btn btn-sm btn-icon" onclick="document.getElementById(\'ot-custodia-panel\').remove()"><i class="ti ti-x"></i></button></div><div class="modal-body"><div class="table-wrap"><table><thead><tr><th>OT</th><th>Técnico</th><th>Situación</th><th></th></tr></thead><tbody>' + (rows.join('') || '<tr><td colspan="4" style="padding:28px;text-align:center;color:var(--text3)">No hay materiales pendientes de rendición.</td></tr>') + '</tbody></table></div></div></div>';
    document.body.appendChild(overlay);
  }

  window.otCustodiaNormalizarMaterial = normalizeMaterial;
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
