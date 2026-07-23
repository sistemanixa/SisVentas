(function () {
  'use strict';

  var PATH_ORDERS = 'sisventas/ordenes';
  var PATH_LISTS = 'sisventas/listas_materiales';
  var PATH_INVENTORY = 'sisventas/inventario_operativo';
  var PATH_LEGACY = 'sisventas/ordenes_compra';
  var state = {
    orders: [],
    lists: [],
    inventory: {},
    legacy: [],
    started: false,
    activeList: null,
    activeOrder: null,
    manualItems: [],
    editingOrderKey: null
  };

  function esc(value) {
    if (typeof window.escapeHTML === 'function') return window.escapeHTML(String(value == null ? '' : value));
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function attr(value) {
    return esc(value).replace(/`/g, '&#96;');
  }

  function money(value) {
    return '$' + (Math.round((parseFloat(value) || 0) * 100) / 100).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fmtDate(value) {
    var text = String(value || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.split('-').reverse().join('/');
    return text || '—';
  }

  function safeKey(value) {
    return String(value || 'sin_referencia').replace(/[.#$\[\]\/]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  }

  function productList() {
    return Object.values(window.prodData || {});
  }

  function salesList() {
    if (typeof window.obtenerVentasSisVentas === 'function') return window.obtenerVentasSisVentas() || [];
    return window.ventasList || [];
  }

  function findProduct(item) {
    item = item || {};
    if (typeof window.obtenerProductoPorCodigoVenta === 'function') {
      var found = window.obtenerProductoPorCodigoVenta(item.cod || item.codigo, item);
      if (found) return found;
    }
    var key = item.productoKey || item.productoId || item.pid || item.fbKeyProducto;
    var code = String(item.cod || item.codigo || '').trim().toUpperCase();
    return productList().find(function (p) {
      return (key && (p.fbKey === key || p.id === key)) || String(p.codigo || p.cod || '').trim().toUpperCase() === code;
    }) || null;
  }

  function isLabor(product, item) {
    if (product && typeof window.esProductoManoDeObra === 'function' && window.esProductoManoDeObra(product)) return true;
    var text = String((product && (product.categoria || product.nombre)) || (item && (item.desc || item.nombre || item.descripcion)) || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return text.indexOf('mano de obra') >= 0 || text.indexOf('instalacion') >= 0 || text.indexOf('configuracion') >= 0 || text.indexOf('mantenimiento tecnico') >= 0;
  }

  function providerMaster(name, key) {
    var list = window.proveedoresData || [];
    return list.find(function (p) {
      return (key && (p.fbKey === key || p.id === key)) || String(p.nombre || '').trim().toLowerCase() === String(name || '').trim().toLowerCase();
    }) || null;
  }

  function providersFor(product) {
    if (!product) return [];
    var raw = typeof window.proveedoresVinculadosProducto === 'function'
      ? window.proveedoresVinculadosProducto(product)
      : (Array.isArray(product.proveedores) ? product.proveedores : []);
    var seen = {};
    return raw.map(function (pv) {
      pv = Object.assign({}, pv || {});
      var name = String(pv.nombre || pv.proveedor || '').trim();
      var master = providerMaster(name, pv.proveedorKey);
      var cost = parseFloat(pv.costoRealArs) || ((parseFloat(pv.precioArsPublicado || pv.precio) || 0) * (pv.sinIva ? 1.21 : 1));
      var status = String(pv.disponibilidadProveedor || pv.disponibilidad || pv.estadoStock || '').toLowerCase();
      var statusText = String(pv.disponibilidadProveedorTexto || pv.disponibilidadTexto || 'No verificado');
      var unavailable = status === 'sin_stock' || status === 'no_disponible' || /sin stock|agotado|no disponible/i.test(statusText);
      return {
        nombre: (master && master.nombre) || name,
        proveedorKey: (master && (master.fbKey || master.id)) || pv.proveedorKey || '',
        proveedorRegistrado: !!master,
        costo: Math.round(cost * 100) / 100,
        disponible: !unavailable,
        estado: statusText,
        url: pv.url || '',
        actualizado: pv.actualizado || ''
      };
    }).filter(function (pv) {
      var k = String(pv.proveedorKey || pv.nombre).toLowerCase();
      if (!pv.nombre || !pv.proveedorRegistrado || seen[k]) return false;
      seen[k] = true;
      return true;
    }).sort(function (a, b) {
      if (a.disponible !== b.disponible) return a.disponible ? -1 : 1;
      if (!a.costo) return 1;
      if (!b.costo) return -1;
      return a.costo - b.costo;
    });
  }

  function operationalFor(product, item) {
    var key = (product && product.fbKey) || (item && item.productoKey) || safeKey((item && (item.codigo || item.cod)) || '');
    return state.inventory[key] || {};
  }

  function buildMaterialItem(item, index) {
    var product = findProduct(item);
    var providers = providersFor(product);
    var recommended = providers.find(function (p) { return p.disponible && p.costo > 0; }) || providers.find(function (p) { return p.costo > 0; }) || null;
    var qty = parseFloat(item.qty || item.cantidad || item.cant || 1) || 1;
    var labor = isLabor(product, item);
    var code = item.cod || item.codigo || (product && product.codigo) || '';
    return {
      linea: index,
      productoKey: (product && product.fbKey) || item.productoKey || item.pid || '',
      codigo: code,
      descripcion: item.desc || item.nombre || item.descripcion || (product && product.nombre) || '',
      unidad: item.unidad || (product && product.unidad) || 'Unidad',
      cantidadNecesaria: qty,
      usarExistente: 0,
      cantidadComprar: labor ? 0 : qty,
      incluir: !labor,
      esManoDeObra: labor,
      proveedor: recommended ? recommended.nombre : '',
      proveedorKey: recommended ? recommended.proveedorKey : '',
      costoUnitario: recommended ? recommended.costo : 0,
      proveedores: providers,
      origenVentaItem: item
    };
  }

  function saleRef(value) {
    if (value && typeof value === 'object') return value;
    var ref = String(value || '');
    return salesList().find(function (v) { return String(v.fbKey) === ref || String(v.id) === ref || String(v.numero) === ref; }) || null;
  }

  function existingListForSale(sale) {
    if (!sale) return null;
    var ids = [sale.fbKey, sale.id, sale.numero].filter(Boolean).map(String);
    return state.lists.find(function (list) {
      return ids.indexOf(String(list.ventaFbKey || '')) >= 0 || ids.indexOf(String(list.ventaId || '')) >= 0;
    }) || null;
  }

  function push(path, value) {
    return window.fbPush(window.fbRef(window.fbDB, path), value);
  }

  function update(path, value) {
    return window.fbUpdate(window.fbRef(window.fbDB, path), value);
  }

  function remove(path) {
    return window.fbRemove(window.fbRef(window.fbDB, path));
  }

  function createListFromSale(saleValue, options) {
    options = options || {};
    var sale = saleRef(saleValue);
    if (!sale || !Array.isArray(sale.items) || !sale.items.length) {
      if (!options.silent && typeof window.notify === 'function') window.notify('La venta no tiene materiales para preparar');
      return Promise.reject(new Error('Venta sin materiales'));
    }
    var existing = existingListForSale(sale);
    if (existing) {
      if (!options.silent) openMaterialList(existing.fbKey);
      return Promise.resolve(existing);
    }
    if (!window.fbDB) return Promise.reject(new Error('Sin conexión'));
    var items = sale.items.map(buildMaterialItem).filter(function (item) { return item.descripcion; });
    var list = {
      numero: 'LM-' + String(Date.now()).slice(-7),
      origen: 'venta',
      ventaId: sale.id || sale.numero || '',
      ventaFbKey: sale.fbKey || '',
      cliente: sale.cliente || '',
      estado: 'preparacion',
      items: items,
      ordenesIds: [],
      fecha: today(),
      ts: Date.now(),
      usuario: window.currentUser || 'Sistema',
      audit: [{ ts: Date.now(), usuario: window.currentUser || 'Sistema', accion: 'Lista creada desde la venta' }]
    };
    return push(PATH_LISTS, list).then(function (ref) {
      list.fbKey = ref.key;
      if (sale.fbKey) update('sisventas/ventas/' + sale.fbKey, { listaMaterialesId: ref.key, compraEstado: 'preparacion' });
      if (typeof window.notify === 'function') window.notify('Lista de materiales preparada para ' + (sale.id || sale.cliente));
      if (!options.silent) setTimeout(function () { openMaterialList(ref.key); }, 120);
      return list;
    });
  }

  function ensureModal(id, maxWidth) {
    var current = document.getElementById(id);
    if (current) return current;
    var modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = '<div class="modal" style="max-width:' + (maxWidth || '980px') + ';width:min(96vw,' + (maxWidth || '980px') + ');max-height:92vh;overflow:auto"><div class="modal-head"><span id="' + id + '-title"></span><button class="btn btn-sm btn-icon" onclick="document.getElementById(\'' + id + '\').style.display=\'none\'"><i class="ti ti-x"></i></button></div><div class="modal-body" id="' + id + '-body"></div></div>';
    document.body.appendChild(modal);
    return modal;
  }

  function openMaterialList(key) {
    var list = typeof key === 'object' ? key : state.lists.find(function (x) { return x.fbKey === key || x.numero === key; });
    if (!list) {
      var sale = saleRef(key);
      if (sale) return createListFromSale(sale);
      if (typeof window.notify === 'function') window.notify('Lista de materiales no encontrada');
      return;
    }
    state.activeList = JSON.parse(JSON.stringify(list));
    var modal = ensureModal('oc-material-list-modal', '1120px');
    document.getElementById('oc-material-list-modal-title').innerHTML = '<i class="ti ti-list-check" style="margin-right:7px"></i>' + esc(list.numero || 'Lista de materiales') + ' · ' + esc(list.cliente || '');
    renderMaterialListBody();
    modal.style.display = 'flex';
  }

  function providerOptions(item) {
    var options = (item.proveedores || []).map(function (pv, index) {
      var selected = (item.proveedorKey && item.proveedorKey === pv.proveedorKey) || (!item.proveedorKey && item.proveedor === pv.nombre);
      var label = pv.nombre + (pv.costo ? ' · ' + money(pv.costo) : ' · sin precio') + (!pv.disponible ? ' · SIN STOCK' : '') + (index === 0 && pv.costo ? ' · recomendado' : '');
      return '<option value="' + attr(pv.proveedorKey || pv.nombre) + '" data-name="' + attr(pv.nombre) + '" data-cost="' + pv.costo + '" ' + (selected ? 'selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    return '<option value="">— Elegir proveedor —</option>' + options;
  }

  function renderMaterialListBody() {
    var list = state.activeList;
    if (!list) return;
    var body = document.getElementById('oc-material-list-modal-body');
    var generated = Array.isArray(list.ordenesIds) && list.ordenesIds.length;
    var locked = !!generated || list.estado === 'reservada' || list.estado === 'recibida' || list.estado === 'cerrada';
    body.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
        '<span class="badge b-blue">Venta ' + esc(list.ventaId || 'manual') + '</span>' +
        '<span class="badge ' + (generated ? 'b-green' : 'b-amber') + '">' + (generated ? 'Órdenes generadas' : 'En preparación') + '</span>' +
        '<span style="font-size:12px;color:var(--text3);align-self:center">El stock anterior es sólo informativo. Indicá manualmente qué cantidad ya tienen.</span>' +
      '</div>' +
      '<div class="table-wrap"><table style="min-width:930px"><thead><tr><th style="width:34px">Comprar</th><th>Material</th><th class="tr">Necesario</th><th class="tr">Ya tenemos</th><th class="tr">A comprar</th><th>Proveedor conveniente</th><th class="tr">Costo estimado</th><th>Referencia</th></tr></thead><tbody>' +
      (list.items || []).map(function (item, index) {
        var product = findProduct(item);
        var op = operationalFor(product, item);
        var legacy = product ? parseFloat(product.stockReal || product.stock || 0) || 0 : 0;
        var disabled = (item.esManoDeObra || locked) ? 'disabled' : '';
        var estimated = (parseFloat(item.cantidadComprar) || 0) * (parseFloat(item.costoUnitario) || 0);
        return '<tr data-index="' + index + '">' +
          '<td><input type="checkbox" class="oc-li-include" ' + (item.incluir ? 'checked' : '') + ' ' + disabled + ' onchange="ocMaterialChanged(' + index + ')"></td>' +
          '<td><div style="font-weight:600">' + esc(item.codigo || '') + '</div><div style="font-size:12px">' + esc(item.descripcion || '') + '</div>' + (item.esManoDeObra ? '<span class="badge b-blue">Servicio: no se compra</span>' : '') + '</td>' +
          '<td class="tr">' + (parseFloat(item.cantidadNecesaria) || 0) + '</td>' +
          '<td class="tr"><input class="search-input oc-li-existing" type="number" min="0" max="' + (parseFloat(item.cantidadNecesaria) || 0) + '" step="1" value="' + (parseFloat(item.usarExistente) || 0) + '" style="width:78px;text-align:right" ' + disabled + ' oninput="ocMaterialChanged(' + index + ')"></td>' +
          '<td class="tr"><strong class="oc-li-buy" style="color:var(--amber)">' + (parseFloat(item.cantidadComprar) || 0) + '</strong></td>' +
          '<td><select class="search-input oc-li-provider" style="min-width:230px" ' + disabled + ' onchange="ocMaterialChanged(' + index + ')">' + providerOptions(item) + '</select>' + (!(item.proveedores || []).length && !item.esManoDeObra ? '<button class="btn btn-sm" style="margin-top:5px" onclick="ocIrAProveedores()"><i class="ti ti-building-store"></i> Cargar proveedor</button>' : '') + '</td>' +
          '<td class="tr oc-li-cost">' + money(estimated) + '</td>' +
          '<td style="font-size:11px;color:var(--text3)">Operativo: ' + (parseFloat(op.general) || 0) + ' general · ' + (parseFloat(op.reservado) || 0) + ' reservado<br>Catálogo viejo: ' + legacy + ' (no verificado)' + (product ? '<br><button class="btn btn-sm" onclick="navegarAProducto(\'' + attr(product.fbKey || product.codigo) + '\')">Ver producto</button>' : '') + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<div id="oc-material-summary" style="margin-top:12px"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap">' +
        (!locked ? '<button class="btn" onclick="ocGuardarListaActual()"><i class="ti ti-device-floppy"></i> Guardar decisiones</button><button class="btn btn-primary" onclick="ocGenerarOrdenesDesdeLista()"><i class="ti ti-shopping-cart"></i> Generar órdenes por proveedor</button>' : (generated ? '<button class="btn btn-primary" onclick="document.getElementById(\'oc-material-list-modal\').style.display=\'none\';ocShowTab(\'orders\')"><i class="ti ti-shopping-cart"></i> Ver órdenes generadas</button>' : '<span class="badge b-green">Lista cerrada sin compras</span>')) +
      '</div>';
    updateMaterialSummary();
  }

  function materialChanged(index) {
    var list = state.activeList;
    var row = document.querySelector('#oc-material-list-modal-body tr[data-index="' + index + '"]');
    if (!list || !row || !list.items[index]) return;
    var item = list.items[index];
    item.incluir = !!row.querySelector('.oc-li-include').checked;
    item.usarExistente = Math.max(0, Math.min(parseFloat(item.cantidadNecesaria) || 0, parseFloat(row.querySelector('.oc-li-existing').value) || 0));
    item.cantidadComprar = item.incluir ? Math.max(0, (parseFloat(item.cantidadNecesaria) || 0) - item.usarExistente) : 0;
    var select = row.querySelector('.oc-li-provider');
    var option = select && select.options[select.selectedIndex];
    item.proveedorKey = select ? select.value : '';
    item.proveedor = option ? option.dataset.name || option.textContent : '';
    item.costoUnitario = option ? parseFloat(option.dataset.cost) || 0 : 0;
    row.querySelector('.oc-li-buy').textContent = item.cantidadComprar;
    row.querySelector('.oc-li-cost').textContent = money(item.cantidadComprar * item.costoUnitario);
    updateMaterialSummary();
  }

  function updateMaterialSummary() {
    var el = document.getElementById('oc-material-summary');
    var list = state.activeList;
    if (!el || !list) return;
    var purchase = (list.items || []).filter(function (i) { return i.incluir && i.cantidadComprar > 0; });
    var groups = {};
    var missing = 0;
    purchase.forEach(function (i) {
      if (!i.proveedor) missing++;
      var key = i.proveedor || 'Sin proveedor';
      groups[key] = (groups[key] || 0) + i.cantidadComprar * i.costoUnitario;
    });
    var total = Object.values(groups).reduce(function (sum, value) { return sum + value; }, 0);
    el.innerHTML = '<div class="card" style="margin:0;background:var(--bg3)"><strong>' + purchase.length + ' materiales a comprar</strong> · ' + Object.keys(groups).length + ' proveedores · estimado ' + money(total) + (missing ? '<div style="color:var(--red);margin-top:5px">Falta elegir proveedor en ' + missing + ' material(es).</div>' : '') + '</div>';
  }

  function saveCurrentList(silent) {
    var list = state.activeList;
    if (!list || !list.fbKey || !window.fbDB) return Promise.reject(new Error('Lista no disponible'));
    (list.items || []).forEach(function (_, index) { materialChanged(index); });
    return update(PATH_LISTS + '/' + list.fbKey, {
      items: list.items,
      actualizadoEn: Date.now(),
      actualizadoPor: window.currentUser || 'Sistema'
    }).then(function () {
      if (!silent && typeof window.notify === 'function') window.notify('Decisiones de compra guardadas');
      return list;
    });
  }

  function transactionInventory(productKey, mutate) {
    if (!productKey || !window.fbDB || typeof window.fbRunTransaction !== 'function') return Promise.resolve();
    var ref = window.fbRef(window.fbDB, PATH_INVENTORY + '/' + safeKey(productKey));
    return window.fbRunTransaction(ref, function (current) {
      current = current || { general: 0, reservado: 0, enCompra: 0, consumido: 0, asignaciones: {} };
      mutate(current);
      current.general = Math.max(0, parseFloat(current.general) || 0);
      current.reservado = Math.max(0, parseFloat(current.reservado) || 0);
      current.enCompra = Math.max(0, parseFloat(current.enCompra) || 0);
      current.consumido = Math.max(0, parseFloat(current.consumido) || 0);
      current.actualizadoEn = Date.now();
      return current;
    });
  }

  function nextOrderNumber(offset) {
    var max = state.orders.reduce(function (value, order) {
      var match = String(order.numero || '').match(/(\d+)$/);
      return Math.max(value, match ? parseInt(match[1], 10) : 0);
    }, 0);
    return 'OC-' + String(max + 1 + (offset || 0)).padStart(4, '0');
  }

  function reserveDeclaredExisting(list) {
    if (!list || list.stockExistenteReservado) return Promise.resolve();
    var allocationKey = safeKey(list.ventaFbKey || list.ventaId || list.fbKey);
    var declared = (list.items || []).filter(function (item) { return item.incluir && (parseFloat(item.usarExistente) || 0) > 0; });
    return Promise.all(declared.map(function (item) {
      var qty = parseFloat(item.usarExistente) || 0;
      return transactionInventory(item.productoKey || item.codigo, function (inv) {
        var fromGeneral = Math.min(qty, parseFloat(inv.general) || 0);
        inv.general = (parseFloat(inv.general) || 0) - fromGeneral;
        inv.reservado = (parseFloat(inv.reservado) || 0) + qty;
        inv.codigo = item.codigo; inv.descripcion = item.descripcion;
        inv.asignaciones = inv.asignaciones || {};
        inv.asignaciones[allocationKey] = inv.asignaciones[allocationKey] || { reservado: 0, consumido: 0, liberado: 0 };
        inv.asignaciones[allocationKey].reservado = (parseFloat(inv.asignaciones[allocationKey].reservado) || 0) + qty;
        inv.asignaciones[allocationKey].ventaId = list.ventaId || '';
        inv.asignaciones[allocationKey].origen = fromGeneral >= qty ? 'stock_general' : 'declarado_manualmente';
      });
    })).then(function () {
      list.stockExistenteReservado = true;
      return update(PATH_LISTS + '/' + list.fbKey, { stockExistenteReservado: true, stockExistenteReservadoEn: Date.now() });
    });
  }

  function generateOrdersFromList() {
    var list = state.activeList;
    if (!list) return;
    saveCurrentList(true).then(function () {
      var purchase = list.items.filter(function (i) { return i.incluir && parseFloat(i.cantidadComprar) > 0; });
      var missing = purchase.filter(function (i) { return !i.proveedor; });
      if (missing.length) throw new Error('Elegí un proveedor para todos los materiales');
      if (list.ordenesIds && list.ordenesIds.length && !confirm('Esta lista ya generó órdenes. ¿Generar un nuevo grupo con las decisiones actuales?')) return null;
      return reserveDeclaredExisting(list).then(function () { return purchase; });
    }).then(function (purchase) {
      if (!purchase) return null;
      if (!purchase.length) {
        return update(PATH_LISTS + '/' + list.fbKey, { estado: 'reservada', ordenadaEn: Date.now() }).then(function () {
          if (list.ventaFbKey) update('sisventas/ventas/' + list.ventaFbKey, { compraEstado: 'material_reservado_sin_compra' });
          if (typeof window.notify === 'function') window.notify('Lista cerrada: todos los materiales fueron marcados como disponibles.');
          document.getElementById('oc-material-list-modal').style.display = 'none';
          showOrdersTab('lists');
          return null;
        });
      }
      var groups = {};
      purchase.forEach(function (item) {
        var key = item.proveedorKey || item.proveedor;
        if (!groups[key]) groups[key] = { proveedor: item.proveedor, proveedorKey: item.proveedorKey, items: [] };
        groups[key].items.push(item);
      });
      var entries = Object.values(groups);
      return Promise.all(entries.map(function (group, groupIndex) {
        var orderItems = group.items.map(function (item) {
          return {
            productoKey: item.productoKey || '', codigo: item.codigo || '', descripcion: item.descripcion || '', unidad: item.unidad || 'Unidad',
            cantidadOrdenada: parseFloat(item.cantidadComprar) || 0, cantidadRecibida: 0,
            costoUnitario: parseFloat(item.costoUnitario) || 0,
            subtotal: (parseFloat(item.cantidadComprar) || 0) * (parseFloat(item.costoUnitario) || 0)
          };
        });
        var total = orderItems.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
        var order = {
          numero: nextOrderNumber(groupIndex), origen: 'venta', listaMaterialesId: list.fbKey,
          ventaId: list.ventaId || '', ventaFbKey: list.ventaFbKey || '', cliente: list.cliente || '',
          proveedor: group.proveedor, proveedorKey: group.proveedorKey || '', fecha: today(), estado: 'borrador',
          items: orderItems, monto: total, total: total, moneda: 'ARS',
          descripcion: orderItems.length + ' materiales para ' + (list.ventaId || list.cliente || 'venta'),
          recepciones: [], ts: Date.now(), usuario: window.currentUser || 'Sistema'
        };
        return push(PATH_ORDERS, order).then(function (ref) {
          order.fbKey = ref.key;
          return Promise.all(orderItems.map(function (item) {
            return transactionInventory(item.productoKey || item.codigo, function (inv) {
              inv.enCompra = (parseFloat(inv.enCompra) || 0) + item.cantidadOrdenada;
              inv.codigo = item.codigo; inv.descripcion = item.descripcion;
            });
          })).then(function () { return ref.key; });
        });
      })).then(function (keys) {
        if (!keys) return;
        var allKeys = (list.ordenesIds || []).concat(keys);
        return update(PATH_LISTS + '/' + list.fbKey, { estado: 'ordenada', ordenesIds: allKeys, ordenadaEn: Date.now() }).then(function () {
          if (list.ventaFbKey) update('sisventas/ventas/' + list.ventaFbKey, { ordenesCompraIds: allKeys, compraEstado: 'ordenada' });
          list.estado = 'ordenada'; list.ordenesIds = allKeys;
          if (typeof window.notify === 'function') window.notify(keys.length + ' orden(es) creadas y agrupadas por proveedor');
          document.getElementById('oc-material-list-modal').style.display = 'none';
          showOrdersTab('orders');
        });
      });
    }).catch(function (error) {
      if (typeof window.notify === 'function') window.notify(error.message || 'No se pudieron generar las órdenes');
    });
  }

  function statusBadge(status) {
    var map = {
      borrador: ['b-blue', 'Borrador'], enviada: ['b-amber', 'Enviada'], recepcion_parcial: ['b-amber', 'Recepción parcial'],
      recibida: ['b-green', 'Recibida'], cancelada: ['b-red', 'Cancelada'], preparacion: ['b-blue', 'Preparación'], ordenada: ['b-amber', 'Ordenada'], reservada: ['b-green', 'Reservada sin compra'], cerrada: ['b-green', 'Cerrada']
    };
    var data = map[status] || ['b-blue', status || '—'];
    return '<span class="badge ' + data[0] + '">' + esc(data[1]) + '</span>';
  }

  function renderPageShell() {
    var page = document.getElementById('page-ordenes');
    if (!page || page.dataset.purchaseV2 === '1') return;
    page.dataset.purchaseV2 = '1';
    page.innerHTML =
      '<div class="metrics" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:12px"><div class="metric"><div class="m-label">Compras del mes</div><div class="m-value" id="oc2-total">$0</div><div class="m-sub">órdenes no canceladas</div></div><div class="metric"><div class="m-label">En compra</div><div class="m-value" id="oc2-buy" style="color:var(--amber)">0</div><div class="m-sub">unidades pendientes</div></div><div class="metric"><div class="m-label">Reservado para obras</div><div class="m-value" id="oc2-reserved" style="color:var(--blue)">0</div><div class="m-sub">recibido con destino</div></div><div class="metric"><div class="m-label">Stock general operativo</div><div class="m-value" id="oc2-general" style="color:var(--green)">0</div><div class="m-sub">controlado desde ahora</div></div></div>' +
      '<div class="card"><div class="card-head"><div style="display:flex;gap:7px"><button class="btn btn-sm oc2-tab active" data-tab="orders" onclick="ocShowTab(\'orders\')"><i class="ti ti-shopping-cart"></i> Órdenes por proveedor</button><button class="btn btn-sm oc2-tab" data-tab="lists" onclick="ocShowTab(\'lists\')"><i class="ti ti-list-check"></i> Listas de materiales</button></div><div style="display:flex;gap:7px;flex-wrap:wrap"><select id="oc2-filter" class="search-input btn-sm" onchange="renderOrdenesFiltradas()"><option value="">Todos los estados</option><option value="borrador">Borrador</option><option value="enviada">Enviada</option><option value="recepcion_parcial">Recepción parcial</option><option value="recibida">Recibida</option><option value="cancelada">Cancelada</option></select><button class="btn btn-sm" onclick="iniciarRecorridoNovedad(\'compras\')" title="Conocer el circuito de compras"><i class="ti ti-route"></i> Recorrido</button><button class="btn btn-sm btn-primary" data-tour="orden-manual" onclick="abrirNuevaOrden()"><i class="ti ti-plus"></i> Orden manual</button></div></div><div id="oc2-orders"></div><div id="oc2-lists" style="display:none"></div></div>';
  }

  function renderOrders() {
    renderPageShell();
    var target = document.getElementById('oc2-orders');
    if (!target) return;
    var filter = (document.getElementById('oc2-filter') || {}).value || '';
    var list = filter ? state.orders.filter(function (o) { return o.estado === filter; }) : state.orders;
    target.innerHTML = '<div class="table-wrap"><table style="min-width:880px"><thead><tr><th>N°</th><th>Proveedor</th><th>Destino</th><th>Materiales</th><th class="tr">Total</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(function (o) {
        var qty = Array.isArray(o.items) ? o.items.reduce(function (s, i) { return s + (parseFloat(i.cantidadOrdenada || i.cantidad) || 0); }, 0) : (parseFloat(o.cantidad) || 0);
        return '<tr onclick="ocAbrirOrden(\'' + attr(o.fbKey) + '\')" style="cursor:pointer"><td><strong>' + esc(o.numero || '—') + '</strong></td><td>' + esc(o.proveedor || 'Sin proveedor') + '</td><td>' + (o.ventaId ? '<span class="badge b-blue">' + esc(o.ventaId) + '</span><div style="font-size:11px;color:var(--text3)">' + esc(o.cliente || '') + '</div>' : 'Stock general') + '</td><td>' + qty + ' un. · ' + ((o.items && o.items.length) || 1) + ' renglón(es)</td><td class="tr"><strong>' + money(o.total || o.monto) + '</strong></td><td>' + fmtDate(o.fecha) + '</td><td>' + statusBadge(o.estado) + '</td><td><i class="ti ti-chevron-right"></i></td></tr>';
      }).join('') : '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text3)">Todavía no hay órdenes en este estado</td></tr>') +
      '</tbody></table></div>';
  }

  function renderLists() {
    renderPageShell();
    var target = document.getElementById('oc2-lists');
    if (!target) return;
    target.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Lista</th><th>Venta</th><th>Cliente</th><th>Materiales</th><th>Órdenes</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (state.lists.length ? state.lists.map(function (list) {
        var pending = (list.items || []).filter(function (i) { return i.incluir && i.cantidadComprar > 0; }).length;
        return '<tr onclick="ocAbrirListaMateriales(\'' + attr(list.fbKey) + '\')" style="cursor:pointer"><td><strong>' + esc(list.numero || '—') + '</strong></td><td>' + esc(list.ventaId || 'Manual') + '</td><td>' + esc(list.cliente || '—') + '</td><td>' + pending + ' a comprar</td><td>' + ((list.ordenesIds || []).length) + '</td><td>' + statusBadge(list.estado) + '</td><td><i class="ti ti-chevron-right"></i></td></tr>';
      }).join('') : '<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--text3)">Las listas se crean desde el detalle de una venta</td></tr>') +
      '</tbody></table></div>';
  }

  function renderMetrics() {
    renderPageShell();
    var month = today().slice(0, 7);
    var orders = state.orders.filter(function (o) { return o.estado !== 'cancelada' && String(o.fecha || '').slice(0, 7) === month; });
    var total = orders.reduce(function (s, o) { return s + (parseFloat(o.total || o.monto) || 0); }, 0);
    var inv = Object.values(state.inventory || {});
    var set = function (id, value) { var el = document.getElementById(id); if (el) el.textContent = value; };
    set('oc2-total', money(total));
    set('oc2-buy', inv.reduce(function (s, i) { return s + (parseFloat(i.enCompra) || 0); }, 0));
    set('oc2-reserved', inv.reduce(function (s, i) { return s + (parseFloat(i.reservado) || 0); }, 0));
    set('oc2-general', inv.reduce(function (s, i) { return s + (parseFloat(i.general) || 0); }, 0));
    // El procedimiento anterior se conserva solamente como respaldo de datos.
    // Ya no aparece ni interviene en las métricas del circuito operativo.
  }

  function showOrdersTab(tab) {
    renderPageShell();
    document.querySelectorAll('.oc2-tab').forEach(function (button) { button.classList.toggle('active', button.dataset.tab === tab); });
    var orders = document.getElementById('oc2-orders');
    var lists = document.getElementById('oc2-lists');
    if (orders) orders.style.display = tab === 'orders' ? '' : 'none';
    if (lists) lists.style.display = tab === 'lists' ? '' : 'none';
    if (tab === 'lists') renderLists(); else renderOrders();
  }

  function renderAll() {
    renderPageShell();
    renderMetrics();
    renderOrders();
    renderLists();
  }

  function openOrder(key) {
    var order = state.orders.find(function (o) { return o.fbKey === key || o.numero === key; });
    if (!order) return;
    state.activeOrder = JSON.parse(JSON.stringify(order));
    var modal = ensureModal('oc-order-modal', '980px');
    document.getElementById('oc-order-modal-title').innerHTML = '<i class="ti ti-shopping-cart" style="margin-right:7px"></i>' + esc(order.numero || 'Orden') + ' · ' + esc(order.proveedor || '');
    var body = document.getElementById('oc-order-modal-body');
    var editableReceipt = order.estado !== 'recibida' && order.estado !== 'cancelada';
    var hasReceipts = (order.items || []).some(function (item) { return (parseFloat(item.cantidadRecibida) || 0) > 0; });
    var editableOrder = !hasReceipts && order.estado !== 'recibida' && order.estado !== 'cancelada';
    body.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + statusBadge(order.estado) + (order.ventaId ? '<span class="badge b-blue">Destino: ' + esc(order.ventaId) + ' · ' + esc(order.cliente || '') + '</span>' : '<span class="badge b-green">Destino: stock general</span>') + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Material</th><th class="tr">Ordenado</th><th class="tr">Recibido</th><th class="tr">Pendiente</th><th class="tr">Costo</th>' + (editableReceipt ? '<th class="tr">Recibir ahora</th>' : '') + '</tr></thead><tbody>' +
      (order.items || []).map(function (item, index) {
        var ordered = parseFloat(item.cantidadOrdenada || item.cantidad) || 0;
        var received = parseFloat(item.cantidadRecibida) || 0;
        var pending = Math.max(0, ordered - received);
        return '<tr data-order-index="' + index + '"><td><strong>' + esc(item.codigo || '') + '</strong><div style="font-size:12px">' + esc(item.descripcion || '') + '</div></td><td class="tr">' + ordered + '</td><td class="tr" style="color:var(--green)">' + received + '</td><td class="tr" style="color:var(--amber)">' + pending + '</td><td class="tr">' + money(item.subtotal || ordered * item.costoUnitario) + '</td>' + (editableReceipt ? '<td class="tr"><input class="search-input oc-receive-now" type="number" min="0" max="' + pending + '" value="0" style="width:82px;text-align:right"></td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:14px;flex-wrap:wrap"><div><strong>Total: ' + money(order.total || order.monto) + '</strong><div style="font-size:11px;color:var(--text3)">Los materiales recibidos para una venta quedan reservados; los manuales ingresan al stock general operativo.</div></div><div style="display:flex;gap:7px;flex-wrap:wrap">' +
        (editableOrder ? '<button class="btn" onclick="ocEditarOrdenActual()"><i class="ti ti-edit"></i> Editar</button>' : '') +
        (order.estado === 'borrador' ? '<button class="btn" onclick="ocCambiarEstadoOrden(\'enviada\')"><i class="ti ti-send"></i> Marcar enviada</button>' : '') +
        (editableReceipt ? '<button class="btn btn-primary" onclick="ocRegistrarRecepcion()"><i class="ti ti-package-import"></i> Registrar recepción</button>' : '') +
        (order.estado !== 'cancelada' && order.estado !== 'recibida' ? '<button class="btn" style="color:var(--red)" onclick="ocCambiarEstadoOrden(\'cancelada\')">Cancelar</button>' : '') +
        (!hasReceipts ? '<button class="btn" style="color:var(--red)" onclick="ocEliminarOrdenActual()"><i class="ti ti-trash"></i> Eliminar</button>' : '') +
      '</div></div>';
    modal.style.display = 'flex';
  }

  function changeOrderStatus(status) {
    var order = state.activeOrder;
    if (!order || !order.fbKey) return;
    if (status === 'cancelada' && !confirm('¿Cancelar esta orden? Las cantidades pendientes dejarán de figurar “en compra”.')) return;
    var tasks = [];
    if (status === 'cancelada') {
      (order.items || []).forEach(function (item) {
        var pending = Math.max(0, (parseFloat(item.cantidadOrdenada || item.cantidad) || 0) - (parseFloat(item.cantidadRecibida) || 0));
        if (pending) tasks.push(transactionInventory(item.productoKey || item.codigo, function (inv) { inv.enCompra = (parseFloat(inv.enCompra) || 0) - pending; }));
      });
    }
    Promise.all(tasks).then(function () {
      return update(PATH_ORDERS + '/' + order.fbKey, { estado: status, actualizadoEn: Date.now() });
    }).then(function () {
      document.getElementById('oc-order-modal').style.display = 'none';
      if (typeof window.notify === 'function') window.notify('Orden actualizada');
    });
  }

  function registerReceipt() {
    var order = state.activeOrder;
    if (!order || !order.fbKey) return;
    var rows = Array.from(document.querySelectorAll('#oc-order-modal-body tr[data-order-index]'));
    var movements = [];
    rows.forEach(function (row) {
      var index = parseInt(row.dataset.orderIndex, 10);
      var input = row.querySelector('.oc-receive-now');
      var qty = input ? parseFloat(input.value) || 0 : 0;
      var item = order.items[index];
      var ordered = parseFloat(item.cantidadOrdenada || item.cantidad) || 0;
      var pending = Math.max(0, ordered - (parseFloat(item.cantidadRecibida) || 0));
      qty = Math.max(0, Math.min(qty, pending));
      if (qty > 0) movements.push({ index: index, item: item, qty: qty });
    });
    if (!movements.length) { if (typeof window.notify === 'function') window.notify('Indicá qué cantidades llegaron'); return; }
    movements.forEach(function (m) { order.items[m.index].cantidadRecibida = (parseFloat(order.items[m.index].cantidadRecibida) || 0) + m.qty; });
    var complete = order.items.every(function (item) { return (parseFloat(item.cantidadRecibida) || 0) >= (parseFloat(item.cantidadOrdenada || item.cantidad) || 0); });
    var receipt = { fecha: today(), ts: Date.now(), usuario: window.currentUser || 'Sistema', items: movements.map(function (m) { return { codigo: m.item.codigo, cantidad: m.qty }; }) };
    var receipts = (order.recepciones || []).concat([receipt]);
    Promise.all(movements.map(function (m) {
      return transactionInventory(m.item.productoKey || m.item.codigo, function (inv) {
        inv.enCompra = (parseFloat(inv.enCompra) || 0) - m.qty;
        inv.codigo = m.item.codigo; inv.descripcion = m.item.descripcion;
        if (order.ventaId || order.ventaFbKey) {
          inv.reservado = (parseFloat(inv.reservado) || 0) + m.qty;
          inv.asignaciones = inv.asignaciones || {};
          var allocationKey = safeKey(order.ventaFbKey || order.ventaId);
          inv.asignaciones[allocationKey] = inv.asignaciones[allocationKey] || { reservado: 0, consumido: 0, liberado: 0 };
          inv.asignaciones[allocationKey].reservado = (parseFloat(inv.asignaciones[allocationKey].reservado) || 0) + m.qty;
          inv.asignaciones[allocationKey].ventaId = order.ventaId || '';
        } else {
          inv.general = (parseFloat(inv.general) || 0) + m.qty;
        }
      });
    })).then(function () {
      return update(PATH_ORDERS + '/' + order.fbKey, { items: order.items, recepciones: receipts, estado: complete ? 'recibida' : 'recepcion_parcial', recibidoEn: Date.now() });
    }).then(function () {
      var syncTasks = [];
      if (order.ventaFbKey) syncTasks.push(update('sisventas/ventas/' + order.ventaFbKey, { compraEstado: complete ? 'recibida_parcial_o_total' : 'recepcion_parcial' }));
      if (complete && order.listaMaterialesId) {
        var related = state.orders.filter(function (candidate) { return candidate.listaMaterialesId === order.listaMaterialesId && candidate.estado !== 'cancelada'; });
        var allReceived = related.length > 0 && related.every(function (candidate) { return candidate.fbKey === order.fbKey ? true : candidate.estado === 'recibida'; });
        if (allReceived) {
          syncTasks.push(update(PATH_LISTS + '/' + order.listaMaterialesId, { estado: 'recibida', recibidaEn: Date.now() }));
          if (order.ventaFbKey) syncTasks.push(update('sisventas/ventas/' + order.ventaFbKey, { compraEstado: 'recibida' }));
        }
      }
      return Promise.all(syncTasks);
    }).then(function () {
      document.getElementById('oc-order-modal').style.display = 'none';
      if (typeof window.notify === 'function') window.notify('Recepción registrada. ' + (order.ventaId ? 'Material reservado para la obra.' : 'Ingresó al stock general operativo.'));
    }).catch(function (error) { if (typeof window.notify === 'function') window.notify('No se pudo registrar: ' + error.message); });
  }

  function openManualOrder() {
    state.manualItems = [];
    var modal = ensureModal('oc-manual-modal', '900px');
    document.getElementById('oc-manual-modal-title').innerHTML = '<i class="ti ti-plus" style="margin-right:7px"></i>Nueva orden manual';
    renderManualOrder();
    modal.style.display = 'flex';
  }

  function renderManualOrder() {
    var body = document.getElementById('oc-manual-modal-body');
    if (!body) return;
    var providerOptionsHtml = (window.proveedoresData || []).filter(function (p) { return p && p.nombre && p.activo !== false; }).sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre)); }).map(function (p) { return '<option value="' + attr(p.fbKey || p.id || p.nombre) + '" data-name="' + attr(p.nombre) + '">' + esc(p.nombre) + '</option>'; }).join('');
    var productsHtml = productList().filter(function (p) { return !isLabor(p); }).sort(function (a, b) { return String(a.nombre || '').localeCompare(String(b.nombre || '')); }).map(function (p) { return '<option value="' + attr(p.fbKey || p.codigo) + '">' + esc((p.codigo || '') + ' · ' + (p.nombre || '')) + '</option>'; }).join('');
    body.innerHTML = '<div class="form-grid"><div class="fg"><label>Proveedor</label><select class="search-input" id="oc-manual-provider"><option value="">— Seleccionar proveedor cargado —</option>' + providerOptionsHtml + '</select></div><div class="fg"><label>Fecha</label><input class="search-input" type="date" id="oc-manual-date" value="' + today() + '"></div></div>' +
      '<div style="display:flex;gap:7px;margin:12px 0"><select class="search-input" id="oc-manual-product" style="flex:1"><option value="">— Agregar producto —</option>' + productsHtml + '</select><button class="btn" onclick="ocAgregarItemManual()"><i class="ti ti-plus"></i> Agregar</button></div>' +
      '<div id="oc-manual-items"></div><div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" onclick="ocGuardarOrdenManual()"><i class="ti ti-device-floppy"></i> Guardar borrador</button></div>';
    renderManualItems();
  }

  function renderManualItems() {
    var target = document.getElementById('oc-manual-items');
    if (!target) return;
    target.innerHTML = state.manualItems.length ? '<table><thead><tr><th>Material</th><th class="tr">Cantidad</th><th class="tr">Costo unit.</th><th></th></tr></thead><tbody>' + state.manualItems.map(function (item, index) { return '<tr><td><strong>' + esc(item.codigo) + '</strong> · ' + esc(item.descripcion) + '</td><td class="tr"><input class="search-input oc-manual-qty" data-index="' + index + '" type="number" min="1" value="' + item.cantidadOrdenada + '" style="width:75px;text-align:right"></td><td class="tr"><input class="search-input oc-manual-cost" data-index="' + index + '" type="number" min="0" step="0.01" value="' + item.costoUnitario + '" style="width:115px;text-align:right"></td><td><button class="btn btn-sm btn-icon" onclick="ocQuitarItemManual(' + index + ')"><i class="ti ti-trash"></i></button></td></tr>'; }).join('') + '</tbody></table>' : '<div style="padding:24px;text-align:center;color:var(--text3)">Agregá los materiales que necesitás comprar.</div>';
  }

  function addManualItem() {
    var select = document.getElementById('oc-manual-product');
    var product = productList().find(function (p) { return String(p.fbKey || p.codigo) === String(select && select.value); });
    if (!product) return;
    var providerSelect = document.getElementById('oc-manual-provider');
    var providerKey = providerSelect ? providerSelect.value : '';
    var candidate = providersFor(product).find(function (p) { return String(p.proveedorKey || p.nombre) === String(providerKey); }) || null;
    state.manualItems.push({ productoKey: product.fbKey || '', codigo: product.codigo || '', descripcion: product.nombre || '', unidad: product.unidad || 'Unidad', cantidadOrdenada: 1, cantidadRecibida: 0, costoUnitario: candidate ? candidate.costo : 0 });
    renderManualItems();
  }

  function removeManualItem(index) { state.manualItems.splice(index, 1); renderManualItems(); }

  function saveManualOrder() {
    var providerSelect = document.getElementById('oc-manual-provider');
    var selected = providerSelect && providerSelect.options[providerSelect.selectedIndex];
    if (!providerSelect || !providerSelect.value) { if (typeof window.notify === 'function') window.notify('Seleccioná un proveedor cargado'); return; }
    if (!state.manualItems.length) { if (typeof window.notify === 'function') window.notify('Agregá al menos un material'); return; }
    document.querySelectorAll('.oc-manual-qty').forEach(function (input) { state.manualItems[parseInt(input.dataset.index, 10)].cantidadOrdenada = Math.max(1, parseFloat(input.value) || 1); });
    document.querySelectorAll('.oc-manual-cost').forEach(function (input) { state.manualItems[parseInt(input.dataset.index, 10)].costoUnitario = Math.max(0, parseFloat(input.value) || 0); });
    state.manualItems.forEach(function (item) { item.subtotal = item.cantidadOrdenada * item.costoUnitario; });
    var total = state.manualItems.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
    var order = { numero: nextOrderNumber(), origen: 'manual', proveedor: selected.dataset.name || selected.textContent, proveedorKey: providerSelect.value, fecha: (document.getElementById('oc-manual-date') || {}).value || today(), estado: 'borrador', items: state.manualItems, monto: total, total: total, moneda: 'ARS', descripcion: state.manualItems.length + ' materiales', recepciones: [], ts: Date.now(), usuario: window.currentUser || 'Sistema' };
    push(PATH_ORDERS, order).then(function (ref) {
      return Promise.all(order.items.map(function (item) { return transactionInventory(item.productoKey || item.codigo, function (inv) { inv.enCompra = (parseFloat(inv.enCompra) || 0) + item.cantidadOrdenada; inv.codigo = item.codigo; inv.descripcion = item.descripcion; }); }));
    }).then(function () { document.getElementById('oc-manual-modal').style.display = 'none'; if (typeof window.notify === 'function') window.notify('Orden manual creada como borrador'); });
  }

  function manualSearchText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function syncManualInputsV2() {
    document.querySelectorAll('.oc-manual-qty').forEach(function (input) {
      var item = state.manualItems[parseInt(input.dataset.index, 10)];
      if (item) item.cantidadOrdenada = Math.max(1, parseFloat(input.value) || 1);
    });
    document.querySelectorAll('.oc-manual-cost').forEach(function (input) {
      var item = state.manualItems[parseInt(input.dataset.index, 10)];
      if (item) item.costoUnitario = Math.max(0, parseFloat(input.value) || 0);
    });
  }

  function renderManualItemsV2() {
    var target = document.getElementById('oc-manual-items');
    if (!target) return;
    target.innerHTML = state.manualItems.length ? state.manualItems.map(function (item, index) {
      return '<div style="display:grid;grid-template-columns:minmax(180px,1fr) 82px 126px 36px;gap:9px;align-items:center;padding:10px 4px;border-bottom:0.5px solid var(--border)">' +
        '<div style="min-width:0"><strong style="font-size:12px;color:var(--blue)">' + esc(item.codigo) + '</strong><div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + attr(item.descripcion) + '">' + esc(item.descripcion) + '</div></div>' +
        '<div><label style="font-size:9px;color:var(--text3)">CANT.</label><input class="search-input oc-manual-qty" data-index="' + index + '" type="number" min="1" value="' + item.cantidadOrdenada + '" style="width:100%;text-align:right"></div>' +
        '<div><label style="font-size:9px;color:var(--text3)">COSTO UNIT.</label><input class="search-input oc-manual-cost" data-index="' + index + '" type="number" min="0" step="0.01" value="' + item.costoUnitario + '" style="width:100%;text-align:right"></div>' +
        '<button class="btn btn-sm btn-icon" onclick="ocQuitarItemManualV2(' + index + ')" title="Quitar"><i class="ti ti-trash"></i></button></div>';
    }).join('') : '<div style="padding:28px;text-align:center;color:var(--text3)"><i class="ti ti-package" style="display:block;font-size:26px;margin-bottom:7px"></i>Buscá arriba los materiales que necesitás comprar.</div>';
    var count = document.getElementById('oc-manual-items-count');
    if (count) count.textContent = state.manualItems.length + ' material' + (state.manualItems.length === 1 ? '' : 'es');
  }

  function searchManualProductsV2(query) {
    var results = document.getElementById('oc-manual-product-results');
    if (!results) return;
    var q = manualSearchText(query).trim();
    var providerSelect = document.getElementById('oc-manual-provider');
    var providerKey = providerSelect ? providerSelect.value : '';
    var products = productList().filter(function (product) {
      if (!product || isLabor(product)) return false;
      if (!q) return true;
      var providerNames = providersFor(product).map(function (pv) { return pv.nombre; }).join(' ');
      return manualSearchText([product.codigo, product.nombre, product.descripcion, product.categoria, product.marca, providerNames].join(' ')).indexOf(q) >= 0;
    }).sort(function (a, b) { return String(a.nombre || '').localeCompare(String(b.nombre || '')); }).slice(0, 50);
    results.innerHTML = products.length ? products.map(function (product) {
      var providers = providersFor(product);
      var candidate = providers.find(function (pv) { return providerKey && String(pv.proveedorKey || pv.nombre) === String(providerKey); }) || providers[0] || null;
      var key = product.fbKey || product.codigo || '';
      var already = state.manualItems.some(function (item) { return String(item.productoKey || item.codigo) === String(key) || (item.codigo && item.codigo === product.codigo); });
      return '<button type="button" data-product-key="' + attr(key) + '" onclick="ocSeleccionarProductoManual(\'' + attr(key) + '\')" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:0;border-bottom:0.5px solid var(--border);background:transparent;color:var(--text);text-align:left;cursor:pointer;font-family:inherit">' +
        '<span style="min-width:0"><strong style="font-size:12px;color:var(--blue)">' + esc(product.codigo || 'Sin código') + '</strong><span style="font-size:13px;margin-left:8px">' + esc(product.nombre || product.descripcion || 'Sin nombre') + '</span><small style="display:block;color:var(--text3);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(product.categoria || 'Sin categoría') + (candidate ? ' · ' + esc(candidate.nombre) : '') + '</small></span>' +
        '<span style="flex-shrink:0;text-align:right;font-size:12px"><strong>' + (candidate && candidate.costo ? money(candidate.costo) : 'Sin costo') + '</strong><small style="display:block;color:' + (already ? 'var(--green)' : 'var(--blue)') + ';margin-top:3px">' + (already ? 'Sumar otra unidad' : 'Agregar') + '</small></span></button>';
    }).join('') : '<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">No se encontraron productos.</div>';
    results.style.display = '';
  }

  function hideManualProductResultsV2() {
    var results = document.getElementById('oc-manual-product-results');
    if (results) results.style.display = 'none';
  }

  function addManualItemV2(productKey) {
    syncManualInputsV2();
    var product = productList().find(function (p) { return String(p.fbKey || p.codigo) === String(productKey || ''); });
    if (!product) return;
    var providerSelect = document.getElementById('oc-manual-provider');
    var providerKey = providerSelect ? providerSelect.value : '';
    var candidate = providersFor(product).find(function (p) { return String(p.proveedorKey || p.nombre) === String(providerKey); }) || null;
    var existing = state.manualItems.find(function (item) { return String(item.productoKey || item.codigo) === String(product.fbKey || product.codigo) || (item.codigo && item.codigo === product.codigo); });
    if (existing) existing.cantidadOrdenada = (parseFloat(existing.cantidadOrdenada) || 0) + 1;
    else state.manualItems.push({ productoKey: product.fbKey || '', codigo: product.codigo || '', descripcion: product.nombre || '', unidad: product.unidad || 'Unidad', cantidadOrdenada: 1, cantidadRecibida: 0, costoUnitario: candidate ? candidate.costo : 0 });
    renderManualItemsV2();
    var input = document.getElementById('oc-manual-product-search');
    if (input) { input.value = ''; input.focus(); }
    hideManualProductResultsV2();
  }

  function removeManualItemV2(index) {
    syncManualInputsV2();
    state.manualItems.splice(index, 1);
    renderManualItemsV2();
  }

  function openManualOrderV2() {
    state.editingOrderKey = null;
    state.manualItems = [];
    var modal = ensureModal('oc-manual-modal', '900px');
    var shell = modal.querySelector('.modal');
    if (shell) shell.style.cssText += ';overflow:hidden;display:flex;flex-direction:column';
    var body = document.getElementById('oc-manual-modal-body');
    if (body) body.style.cssText = 'display:flex;flex-direction:column;min-height:0;height:min(68vh,620px);overflow:hidden';
    document.getElementById('oc-manual-modal-title').innerHTML = '<i class="ti ti-plus" style="margin-right:7px"></i>Nueva orden manual';
    var providerOptionsHtml = (window.proveedoresData || []).filter(function (p) { return p && p.nombre && p.activo !== false; }).sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre)); }).map(function (p) { return '<option value="' + attr(p.fbKey || p.id || p.nombre) + '" data-name="' + attr(p.nombre) + '">' + esc(p.nombre) + '</option>'; }).join('');
    body.innerHTML = '<div style="flex:0 0 auto"><div class="form-grid"><div class="fg"><label>Proveedor</label><select class="search-input" id="oc-manual-provider" onchange="ocBuscarProductoManual((document.getElementById(\'oc-manual-product-search\')||{}).value||\'\')"><option value="">— Seleccionar proveedor cargado —</option>' + providerOptionsHtml + '</select></div><div class="fg"><label>Fecha</label><input class="search-input" type="date" id="oc-manual-date" value="' + today() + '"></div></div>' +
      '<div style="position:relative;margin:12px 0"><label style="display:block;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Agregar producto</label><div style="position:relative"><i class="ti ti-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text3)"></i><input class="search-input" id="oc-manual-product-search" placeholder="Buscar por código, nombre, categoría o proveedor…" autocomplete="off" onfocus="ocBuscarProductoManual(this.value)" oninput="ocBuscarProductoManual(this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();var b=document.querySelector(\'#oc-manual-product-results [data-product-key]\');if(b)b.click()}" style="width:100%;padding-left:34px"></div><div id="oc-manual-product-results" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:20;max-height:270px;overflow:auto;background:var(--bg2);border:0.5px solid var(--border2);border-radius:var(--radius);box-shadow:0 10px 28px rgba(0,0,0,.28)"></div></div></div>' +
      '<div id="oc-manual-items" style="flex:1 1 auto;min-height:0;overflow:auto;padding-right:3px"></div>' +
      '<div style="flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:12px;margin-top:10px;border-top:0.5px solid var(--border);background:var(--bg2)"><span id="oc-manual-items-count" style="font-size:12px;color:var(--text3)">0 materiales</span><button class="btn btn-primary" id="oc-manual-save" onclick="ocGuardarOrdenManualV2()"><i class="ti ti-device-floppy"></i> Guardar borrador</button></div>';
    renderManualItemsV2();
    modal.style.display = 'flex';
    setTimeout(function () { var input = document.getElementById('oc-manual-product-search'); if (input) input.focus(); }, 120);
  }

  function saveManualOrderV2() {
    syncManualInputsV2();
    if (!state.editingOrderKey) return saveManualOrder();
    var original = state.orders.find(function (order) { return order.fbKey === state.editingOrderKey; });
    var providerSelect = document.getElementById('oc-manual-provider');
    var selected = providerSelect && providerSelect.options[providerSelect.selectedIndex];
    if (!original) { if (typeof window.notify === 'function') window.notify('La orden ya no existe'); return; }
    if (!providerSelect || !providerSelect.value) { if (typeof window.notify === 'function') window.notify('Seleccioná un proveedor cargado'); return; }
    if (!state.manualItems.length) { if (typeof window.notify === 'function') window.notify('Agregá al menos un material'); return; }
    if ((original.items || []).some(function (item) { return (parseFloat(item.cantidadRecibida) || 0) > 0; })) {
      if (typeof window.notify === 'function') window.notify('No se puede editar una orden que ya tiene recepciones');
      return;
    }
    state.manualItems.forEach(function (item) {
      item.cantidadOrdenada = Math.max(1, parseFloat(item.cantidadOrdenada) || 1);
      item.cantidadRecibida = 0;
      item.costoUnitario = Math.max(0, parseFloat(item.costoUnitario) || 0);
      item.subtotal = item.cantidadOrdenada * item.costoUnitario;
    });
    var total = state.manualItems.reduce(function (sum, item) { return sum + item.subtotal; }, 0);
    var oldPending = {};
    var newPending = {};
    (original.items || []).forEach(function (item) {
      var key = item.productoKey || item.codigo;
      if (key) oldPending[key] = (oldPending[key] || 0) + (parseFloat(item.cantidadOrdenada || item.cantidad) || 0);
    });
    state.manualItems.forEach(function (item) {
      var key = item.productoKey || item.codigo;
      if (key) newPending[key] = (newPending[key] || 0) + (parseFloat(item.cantidadOrdenada) || 0);
    });
    var inventoryKeys = Object.keys(Object.assign({}, oldPending, newPending));
    var itemsToSave = JSON.parse(JSON.stringify(state.manualItems));
    Promise.all(inventoryKeys.map(function (key) {
      var delta = (newPending[key] || 0) - (oldPending[key] || 0);
      if (!delta || original.estado === 'cancelada') return Promise.resolve();
      return transactionInventory(key, function (inv) { inv.enCompra = Math.max(0, (parseFloat(inv.enCompra) || 0) + delta); });
    })).then(function () {
      return update(PATH_ORDERS + '/' + original.fbKey, {
        proveedor: selected.dataset.name || selected.textContent,
        proveedorKey: providerSelect.value,
        fecha: (document.getElementById('oc-manual-date') || {}).value || today(),
        items: itemsToSave,
        monto: total,
        total: total,
        descripcion: itemsToSave.length + ' materiales',
        actualizadoEn: Date.now(),
        actualizadoPor: window.currentUser || 'Sistema'
      });
    }).then(function () {
      state.editingOrderKey = null;
      document.getElementById('oc-manual-modal').style.display = 'none';
      var detail = document.getElementById('oc-order-modal');
      if (detail) detail.style.display = 'none';
      if (typeof window.notify === 'function') window.notify('Orden de compra actualizada');
    }).catch(function (error) {
      if (typeof window.notify === 'function') window.notify('No se pudo editar la orden: ' + error.message);
    });
  }

  function editActiveOrder() {
    var order = state.activeOrder;
    if (!order || !order.fbKey) return;
    if ((order.items || []).some(function (item) { return (parseFloat(item.cantidadRecibida) || 0) > 0; })) {
      if (typeof window.notify === 'function') window.notify('No se puede editar una orden que ya tiene recepciones');
      return;
    }
    openManualOrderV2();
    state.editingOrderKey = order.fbKey;
    state.manualItems = JSON.parse(JSON.stringify(order.items || []));
    document.getElementById('oc-manual-modal-title').innerHTML = '<i class="ti ti-edit" style="margin-right:7px"></i>Editar ' + esc(order.numero || 'orden de compra');
    var providerSelect = document.getElementById('oc-manual-provider');
    if (providerSelect) {
      providerSelect.value = order.proveedorKey || '';
      if (!providerSelect.value && order.proveedor) {
        var matchingOption = Array.prototype.find.call(providerSelect.options, function (option) {
          return String(option.dataset.name || option.textContent || '').trim().toLowerCase() === String(order.proveedor).trim().toLowerCase();
        });
        if (matchingOption) providerSelect.value = matchingOption.value;
      }
    }
    var dateInput = document.getElementById('oc-manual-date');
    if (dateInput) dateInput.value = order.fecha || today();
    var saveButton = document.getElementById('oc-manual-save');
    if (saveButton) saveButton.innerHTML = '<i class="ti ti-device-floppy"></i> Guardar cambios';
    renderManualItemsV2();
  }

  function unlinkDeletedOrder(order) {
    var tasks = [];
    if (order.listaMaterialesId) {
      var list = state.lists.find(function (entry) { return entry.fbKey === order.listaMaterialesId; });
      if (list) {
        var remaining = (list.ordenesIds || []).filter(function (key) { return key !== order.fbKey; });
        tasks.push(update(PATH_LISTS + '/' + list.fbKey, {
          ordenesIds: remaining,
          estado: remaining.length ? list.estado : 'preparacion',
          actualizadoEn: Date.now()
        }));
      }
    }
    if (order.ventaFbKey) {
      var sale = salesList().find(function (entry) { return entry.fbKey === order.ventaFbKey; });
      var saleOrders = ((sale && sale.ordenesCompraIds) || []).filter(function (key) { return key !== order.fbKey; });
      tasks.push(update('sisventas/ventas/' + order.ventaFbKey, {
        ordenesCompraIds: saleOrders,
        compraEstado: saleOrders.length ? 'ordenada' : 'preparacion'
      }));
    }
    return Promise.all(tasks);
  }

  function deleteActiveOrder() {
    var order = state.activeOrder;
    if (!order || !order.fbKey) return;
    if ((order.items || []).some(function (item) { return (parseFloat(item.cantidadRecibida) || 0) > 0; })) {
      if (typeof window.notify === 'function') window.notify('No se puede eliminar una orden con materiales recibidos');
      return;
    }
    if (!confirm('¿Eliminar definitivamente ' + (order.numero || 'esta orden') + '? Esta acción no elimina la venta ni los productos.')) return;
    var tasks = [];
    if (order.estado !== 'cancelada') {
      (order.items || []).forEach(function (item) {
        var pending = Math.max(0, (parseFloat(item.cantidadOrdenada || item.cantidad) || 0) - (parseFloat(item.cantidadRecibida) || 0));
        if (pending) tasks.push(transactionInventory(item.productoKey || item.codigo, function (inv) { inv.enCompra = Math.max(0, (parseFloat(inv.enCompra) || 0) - pending); }));
      });
    }
    Promise.all(tasks).then(function () { return unlinkDeletedOrder(order); }).then(function () {
      return remove(PATH_ORDERS + '/' + order.fbKey);
    }).then(function () {
      state.activeOrder = null;
      var modal = document.getElementById('oc-order-modal');
      if (modal) modal.style.display = 'none';
      if (typeof window.notify === 'function') window.notify('Orden de compra eliminada');
    }).catch(function (error) {
      if (typeof window.notify === 'function') window.notify('No se pudo eliminar la orden: ' + error.message);
    });
  }

  function migrateLegacy() {
    var pending = state.legacy.filter(function (o) { return !o.migradaA; });
    if (!pending.length || !confirm('Se incorporarán ' + pending.length + ' órdenes anteriores al historial unificado. No se duplicarán en el futuro. ¿Continuar?')) return;
    Promise.all(pending.map(function (old, index) {
      var items = (old.items || []).map(function (item) { var qty = parseFloat(item.cantidad || item.qty) || 1; var cost = parseFloat(item.precioRef || item.costoUnitario) || 0; return { codigo: item.codigo || item.cod || '', descripcion: item.descripcion || item.desc || '', cantidadOrdenada: qty, cantidadRecibida: item.recibido ? qty : 0, costoUnitario: cost, subtotal: qty * cost }; });
      var total = items.reduce(function (s, i) { return s + i.subtotal; }, 0);
      var order = { numero: nextOrderNumber(index), origen: 'legacy', legacyKey: old.fbKey, ventaId: old.ventaId || '', cliente: old.cliente || '', proveedor: old.proveedor || 'Sin proveedor', fecha: old.fecha || today(), estado: old.estado === 'pendiente' ? 'borrador' : (old.estado || 'borrador'), items: items, monto: total, total: total, moneda: 'ARS', descripcion: old.obs || 'Migrada del procedimiento anterior', ts: old.ts || Date.now(), usuario: old.usuario || 'Sistema' };
      return push(PATH_ORDERS, order).then(function (ref) { return update(PATH_LEGACY + '/' + old.fbKey, { migradaA: ref.key, migradaEn: Date.now() }); });
    })).then(function () { if (typeof window.notify === 'function') window.notify('Historial anterior migrado correctamente'); });
  }

  function syncOTConsumption(ot, oldMaterial, newMaterial) {
    if (!ot || !newMaterial) return Promise.resolve();
    var product = findProduct(newMaterial);
    var productKey = (product && product.fbKey) || newMaterial.productoKey || newMaterial.cod || newMaterial.codigo;
    var delta = (parseFloat(newMaterial.instalada) || 0) - (parseFloat(oldMaterial && oldMaterial.instalada) || 0);
    if (!productKey || !delta) return Promise.resolve();
    var allocationKey = safeKey(ot.ventaFbKey || ot.ventaId || ot.id || ot.fbKey);
    return transactionInventory(productKey, function (inv) {
      inv.asignaciones = inv.asignaciones || {};
      var allocation = inv.asignaciones[allocationKey] || { reservado: 0, consumido: 0, liberado: 0 };
      if (delta > 0) {
        var available = Math.min(delta, parseFloat(allocation.reservado) || parseFloat(inv.reservado) || 0);
        inv.reservado = (parseFloat(inv.reservado) || 0) - available;
        inv.consumido = (parseFloat(inv.consumido) || 0) + available;
        allocation.reservado = Math.max(0, (parseFloat(allocation.reservado) || 0) - available);
        allocation.consumido = (parseFloat(allocation.consumido) || 0) + available;
      } else {
        var reverse = Math.min(Math.abs(delta), parseFloat(allocation.consumido) || 0);
        inv.reservado = (parseFloat(inv.reservado) || 0) + reverse;
        inv.consumido = Math.max(0, (parseFloat(inv.consumido) || 0) - reverse);
        allocation.reservado = (parseFloat(allocation.reservado) || 0) + reverse;
        allocation.consumido = Math.max(0, (parseFloat(allocation.consumido) || 0) - reverse);
      }
      allocation.ventaId = ot.ventaId || '';
      inv.asignaciones[allocationKey] = allocation;
    });
  }

  function releaseOTLeftovers(ot) {
    if (!ot) return Promise.resolve();
    var allocationKey = safeKey(ot.ventaFbKey || ot.ventaId || ot.id || ot.fbKey);
    return Promise.all((ot.materiales || []).map(function (material) {
      var product = findProduct(material);
      var productKey = (product && product.fbKey) || material.productoKey || material.cod || material.codigo;
      if (!productKey) return Promise.resolve();
      return transactionInventory(productKey, function (inv) {
        inv.asignaciones = inv.asignaciones || {};
        var allocation = inv.asignaciones[allocationKey];
        if (!allocation) return;
        var leftover = Math.max(0, parseFloat(allocation.reservado) || 0);
        if (leftover) {
          inv.reservado = (parseFloat(inv.reservado) || 0) - leftover;
          inv.general = (parseFloat(inv.general) || 0) + leftover;
          allocation.reservado = 0;
          allocation.liberado = (parseFloat(allocation.liberado) || 0) + leftover;
          allocation.cerradoEn = Date.now();
        }
      });
    }));
  }

  // Una devolución sólo vuelve al stock general cuando administración confirma
  // que depósito la recibió. La rendición del técnico por sí sola no libera stock.
  function receiveOTReturns(ot, receptions) {
    if (!ot || !Array.isArray(receptions) || !receptions.length) return Promise.resolve();
    var allocationKey = safeKey(ot.ventaFbKey || ot.ventaId || ot.id || ot.fbKey);
    return Promise.all(receptions.map(function (entry) {
      var material = entry.material || {};
      var quantity = Math.max(0, parseFloat(entry.cantidad) || 0);
      var product = findProduct(material);
      var productKey = (product && product.fbKey) || material.productoKey || material.cod || material.codigo;
      if (!productKey || !quantity) return Promise.resolve();
      return transactionInventory(productKey, function (inv) {
        inv.asignaciones = inv.asignaciones || {};
        var allocation = inv.asignaciones[allocationKey];
        if (!allocation) return;
        var available = Math.min(quantity, parseFloat(allocation.reservado) || 0);
        inv.reservado = Math.max(0, (parseFloat(inv.reservado) || 0) - available);
        inv.general = (parseFloat(inv.general) || 0) + available;
        allocation.reservado = Math.max(0, (parseFloat(allocation.reservado) || 0) - available);
        allocation.liberado = (parseFloat(allocation.liberado) || 0) + available;
        allocation.ultimaDevolucionEn = Date.now();
        allocation.ventaId = ot.ventaId || allocation.ventaId || '';
        inv.asignaciones[allocationKey] = allocation;
      });
    }));
  }

  function start() {
    if (state.started || !window.fbDB) return;
    state.started = true;
    window.fbOnValue(window.fbRef(window.fbDB, PATH_ORDERS), function (snap) {
      var data = snap.val() || {};
      state.orders = Object.entries(data).map(function (entry) { return Object.assign({ fbKey: entry[0] }, entry[1] || {}); }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      window.ordenesData = state.orders;
      renderAll();
    });
    window.fbOnValue(window.fbRef(window.fbDB, PATH_LISTS), function (snap) {
      var data = snap.val() || {};
      state.lists = Object.entries(data).map(function (entry) { return Object.assign({ fbKey: entry[0] }, entry[1] || {}); }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      renderLists();
    });
    window.fbOnValue(window.fbRef(window.fbDB, PATH_INVENTORY), function (snap) {
      state.inventory = snap.val() || {};
      renderMetrics();
      if (typeof window.refrescarStockOperativoCatalogo === 'function') window.refrescarStockOperativoCatalogo();
      if (typeof window.actualizarStatProductos === 'function') window.actualizarStatProductos();
    });
    window.fbOnValue(window.fbRef(window.fbDB, PATH_LEGACY), function (snap) {
      var data = snap.val() || {};
      state.legacy = Object.entries(data).map(function (entry) { return Object.assign({ fbKey: entry[0] }, entry[1] || {}); });
      renderMetrics();
    });
  }

  function reset() {
    state.started = false;
    state.orders = [];
    state.lists = [];
    state.inventory = {};
    state.legacy = [];
    state.activeList = null;
    state.activeOrder = null;
    state.manualItems = [];
    state.editingOrderKey = null;
  }

  window.SisVentasCompras = {
    start: start,
    reset: reset,
    renderAll: renderAll,
    renderOrders: renderOrders,
    createListFromSale: createListFromSale,
    openMaterialList: openMaterialList,
    openOrder: openOrder,
    openManualOrder: openManualOrder,
    syncOTConsumption: syncOTConsumption,
    releaseOTLeftovers: releaseOTLeftovers,
    receiveOTReturns: receiveOTReturns,
    state: state
  };
  window.fbCargarOrdenes = start;
  window.renderDashOrdenes = renderAll;
  window.renderOrdenesFiltradas = renderOrders;
  window.abrirNuevaOrden = openManualOrderV2;
  window.editarOrden = openOrder;
  window.crearListaMaterialesDesdeVenta = createListFromSale;
  window.abrirListaMaterialesDesdeVenta = function (sale) { return createListFromSale(sale || window.ventaDetalleActual || window._ventaDetalleActual || '', { silent: false }); };
  window.ocAbrirListaMateriales = openMaterialList;
  window.ocMaterialChanged = materialChanged;
  window.ocGuardarListaActual = function () { return saveCurrentList(false); };
  window.ocGenerarOrdenesDesdeLista = generateOrdersFromList;
  window.ocShowTab = showOrdersTab;
  window.ocAbrirOrden = openOrder;
  window.ocCambiarEstadoOrden = changeOrderStatus;
  window.ocRegistrarRecepcion = registerReceipt;
  window.ocEditarOrdenActual = editActiveOrder;
  window.ocEliminarOrdenActual = deleteActiveOrder;
  window.ocAgregarItemManual = addManualItemV2;
  window.ocBuscarProductoManual = searchManualProductsV2;
  window.ocSeleccionarProductoManual = addManualItemV2;
  window.ocQuitarItemManualV2 = removeManualItemV2;
  window.ocGuardarOrdenManualV2 = saveManualOrderV2;
  window.ocMigrarLegacy = migrateLegacy;
  window.ocIrAProveedores = function () {
    saveCurrentList(true).catch(function () {}).then(function () {
      var modal = document.getElementById('oc-material-list-modal');
      if (modal) modal.style.display = 'none';
      if (typeof window.showPage === 'function') window.showPage('proveedores', document.querySelector('[onclick*="proveedores"]'));
    });
  };

  document.addEventListener('sisventas:session-ready', start);
  document.addEventListener('sisventas:session-ended', reset);
})();
