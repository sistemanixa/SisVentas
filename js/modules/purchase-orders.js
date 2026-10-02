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
    editingOrderKey: null,
    groupMaterialsByProvider: true
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

  function safeProviderUrl(value) {
    var url = String(value || '').trim();
    return /^https?:\/\//i.test(url) ? url : '';
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

  function productThumbnail(item, product) {
    item = item || {};
    product = product || findProduct(item);
    if (typeof window.imagenProductoItemHTML === 'function') {
      var resolved = window.imagenProductoItemHTML({
        pid: (product && (product.fbKey || product.id)) || item.productoKey || item.productoId || '',
        productoFbKey: (product && product.fbKey) || item.productoKey || item.productoFbKey || '',
        cod: (product && (product.codigo || product.cod)) || item.codigo || item.cod || '',
        codigo: (product && (product.codigo || product.cod)) || item.codigo || item.cod || '',
        imagenUrl: (product && product.imagenUrl) || item.imagenUrl || item.productoImagenUrl || ''
      }, 'oc-product-thumb-image');
      return '<span class="oc-product-thumb" style="width:48px;height:48px;flex:0 0 48px;border-radius:9px;overflow:hidden;background:#fff;border:0.5px solid var(--border2);display:grid;place-items:center">' + resolved + '</span>';
    }
    var imageUrl = (product && (product.imagenUrl || product.imagen || product.imageUrl || product.foto)) || item.imagenUrl || item.imagen || item.imageUrl || item.foto || '';
    var fallback = '<span class="oc-product-thumb-fallback" style="display:' + (imageUrl ? 'none' : 'grid') + ';width:100%;height:100%;place-items:center;color:var(--text3)"><i class="ti ti-photo"></i></span>';
    return '<span class="oc-product-thumb" style="width:48px;height:48px;flex:0 0 48px;border-radius:9px;overflow:hidden;background:var(--bg3);border:0.5px solid var(--border2);display:grid;place-items:center">' +
      (imageUrl ? '<img src="' + attr(imageUrl) + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain;background:#fff" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'">' : '') + fallback + '</span>';
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

  function providerSelectOptions(selectedKey, selectedName) {
    var selectedText = String(selectedName || '').trim().toLowerCase();
    return (window.proveedoresData || []).filter(function (p) {
      return p && p.nombre && p.activo !== false;
    }).sort(function (a, b) {
      return String(a.nombre).localeCompare(String(b.nombre));
    }).map(function (p) {
      var key = String(p.fbKey || p.id || p.nombre);
      var selected = String(selectedKey || '') === key || (!selectedKey && String(p.nombre).trim().toLowerCase() === selectedText);
      return '<option value="' + attr(key) + '" data-name="' + attr(p.nombre) + '" ' + (selected ? 'selected' : '') + '>' + esc(p.nombre) + '</option>';
    }).join('');
  }

  function selectedProviderForItem(item) {
    item = item || {};
    var key = String(item.proveedorKey || '');
    var name = String(item.proveedor || '').trim().toLowerCase();
    return (item.proveedores || []).find(function (provider) {
      return (key && String(provider.proveedorKey || provider.nombre) === key) ||
        (!key && name && String(provider.nombre || '').trim().toLowerCase() === name);
    }) || null;
  }

  function providerUrlForItem(item) {
    var selected = selectedProviderForItem(item);
    return safeProviderUrl((selected && selected.url) || (item && item.proveedorUrl) || '');
  }

  function providerGroupKey(item) {
    item = item || {};
    return String(item.proveedorKey || item.proveedor || '').trim().toLowerCase();
  }

  function orderProviderSummary(order) {
    order = order || {};
    var finals = Array.from(new Set((order.items || []).map(function(item) {
      return String(item.proveedorFinal || '').trim();
    }).filter(Boolean)));
    if (!finals.length && Array.isArray(order.proveedoresFinales)) {
      finals = Array.from(new Set(order.proveedoresFinales.map(function(name){ return String(name || '').trim(); }).filter(Boolean)));
    }
    if (finals.length === 1) return finals[0];
    if (finals.length > 1) return 'Varios proveedores';
    return String(order.proveedorFinalResumen || order.proveedor || 'Sin proveedor');
  }

  function purchaseDifferenceLabel(estimated, actual) {
    estimated = parseFloat(estimated) || 0;
    actual = parseFloat(actual) || 0;
    if (!estimated || !actual) return '<span style="color:var(--text3)">—</span>';
    var difference = estimated - actual;
    if (Math.abs(difference) < 0.01) return '<span style="color:var(--text3)">Sin diferencia</span>';
    return '<span style="color:var(--' + (difference > 0 ? 'green' : 'red') + ');font-weight:600">' + (difference > 0 ? 'Mejoró ' : 'Empeoró ') + money(Math.abs(difference)) + '</span>';
  }

  function updatePurchaseDifference(input) {
    var row = input && input.closest ? input.closest('tr[data-order-index]') : null;
    if (!row) return;
    var target = row.querySelector('.oc-purchase-difference');
    if (target) target.innerHTML = purchaseDifferenceLabel(parseFloat(row.dataset.budgetUnit) || 0, parseFloat(input.value) || 0);
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

  function recommendedProviderForItem(item) {
    var currentProviders = providersFor(findProduct(item));
    if (currentProviders.length) item.proveedores = currentProviders;
    var providers = item.proveedores || [];
    return providers.find(function (provider) { return provider.disponible && provider.costo > 0; }) ||
      providers.find(function (provider) { return provider.costo > 0; }) || null;
  }

  function applyRecommendedProviders(list) {
    var result = { reviewed: 0, applied: 0, changed: 0, unavailable: 0 };
    ((list && list.items) || []).forEach(function (item) {
      if (!isPurchasableMaterialItem(item)) return;
      result.reviewed++;
      var recommended = recommendedProviderForItem(item);
      if (!recommended) {
        result.unavailable++;
        return;
      }
      var previousKey = String(item.proveedorKey || item.proveedor || '');
      var nextKey = String(recommended.proveedorKey || recommended.nombre || '');
      item.proveedor = recommended.nombre;
      item.proveedorKey = recommended.proveedorKey;
      item.proveedorUrl = safeProviderUrl(recommended.url);
      item.costoUnitario = recommended.costo;
      result.applied++;
      if (previousKey !== nextKey) result.changed++;
    });
    return result;
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
      proveedorUrl: recommended ? safeProviderUrl(recommended.url) : '',
      costoUnitario: recommended ? recommended.costo : 0,
      proveedores: providers,
      origenVentaItem: item
    };
  }

  function isPurchasableMaterialItem(item) {
    return !!item && !item.esManoDeObra && !isLabor(findProduct(item), item);
  }

  function materialRowsForDisplay(list) {
    var rows = ((list && list.items) || []).map(function (item, index) {
      return { item: item, index: index };
    }).filter(function (display) {
      return isPurchasableMaterialItem(display.item);
    });
    if (state.groupMaterialsByProvider) {
      rows.sort(function (a, b) {
        var providerA = String(a.item.proveedor || 'ZZZ Sin proveedor');
        var providerB = String(b.item.proveedor || 'ZZZ Sin proveedor');
        return providerA.localeCompare(providerB) || a.index - b.index;
      });
    }
    return rows;
  }

  function purchaseSummaryForProvider(list, providerKey) {
    var key = String(providerKey || '').trim().toLowerCase();
    var items = ((list && list.items) || []).filter(function (item) {
      return isPurchasableMaterialItem(item) && item.incluir && (parseFloat(item.cantidadComprar) || 0) > 0 && providerGroupKey(item) === key;
    });
    return {
      items: items.length,
      units: items.reduce(function (sum, item) { return sum + (parseFloat(item.cantidadComprar) || 0); }, 0),
      total: items.reduce(function (sum, item) { return sum + (parseFloat(item.cantidadComprar) || 0) * (parseFloat(item.costoUnitario) || 0); }, 0)
    };
  }

  // Los extras pertenecen al pedido, pero no se mezclan con list.items:
  // esas filas conservan la asignación y los costos propios de cada venta.
  function extraMaterialItems(list) {
    var sim = (list && list.simuladorParaguay) || {};
    var parameters = sim.parameters || {};
    var extras = sim.extras || [];
    var goods = extras.reduce(function(sum, row) { return sum + (Number(row.qty) || 0) * (Number(row.usd) || 0); }, 0);
    var rate = Number(sim.chosen === 'remote' ? parameters.usdt : parameters.usd) || 0;
    var logistics = (Number(parameters.extraLogisticsUSD) || 0) * (Number(parameters.usd) || 0);
    return extras.map(function(row) {
      var item = {
        productoKey: row.productKey || '', codigo: row.code || '', descripcion: row.description || '',
        cantidadNecesaria: Number(row.qty) || 0, usarExistente: 0, cantidadComprar: Number(row.qty) || 0,
        incluir: true, esExtra: true, destino: 'stock',
        proveedor: row.provider || '', proveedorKey: row.providerKey || '',
        proveedorUrl: safeProviderUrl(row.providerUrl), precioOrigenUSD: Number(row.usd) || 0,
        costoUnitario: (Number(row.usd) || 0) * rate + (goods ? logistics * (Number(row.usd) || 0) / goods : 0)
      };
      // Compatibilidad con simulaciones anteriores que no guardaban el enlace.
      if (!item.proveedorUrl) item.proveedores = providersFor(findProduct(item));
      return item;
    });
  }

  function extraMaterialRowsHTML(list) {
    var extras = extraMaterialItems(list);
    if (!extras.length) return '';
    var total = extras.reduce(function(sum, item) { return sum + item.cantidadComprar * item.costoUnitario; }, 0);
    return '<tr class="oc-provider-group"><td colspan="10"><div class="oc-provider-group-head"><strong>Extras · stock general</strong><span>' + extras.length + ' productos · Total ' + money(total) + '</span></div><small>Incluidos en el pedido. El stock ingresa al registrar la recepción.</small></td></tr>' + extras.map(function(item, index) {
      var url = providerUrlForItem(item), amount = item.cantidadComprar * item.costoUnitario;
      return '<tr data-index="extra-' + index + '"><td class="oc-material-check"><span class="badge b-green">Extra</span></td>' +
        '<td class="oc-material-product" data-label="Material"><div class="oc-material-product-content">' + productThumbnail(item) + '<div class="oc-material-product-copy"><strong>' + esc(item.codigo) + '</strong><div class="oc-material-description">' + esc(item.descripcion) + '</div></div></div></td>' +
        '<td data-label="Necesario">' + formatOrderQuantity(item.cantidadNecesaria) + '</td><td data-label="Ya tenemos">—</td><td data-label="A comprar">' + formatOrderQuantity(item.cantidadComprar) + '</td>' +
        '<td class="oc-material-provider" data-label="Proveedor">' + esc(item.proveedor) + (url ? '<div><a href="' + attr(url) + '" target="_blank" rel="noopener">Abrir link de compra</a></div>' : '') + '</td>' +
        '<td data-label="Costo estimado">' + money(amount) + '</td><td data-label="USD equivalente">' + materialEquivalent(amount, 'USD') + '</td><td data-label="USDT equivalente">' + materialEquivalent(amount, 'USDT') + '</td><td class="oc-material-reference">Stock general · USD ' + item.precioOrigenUSD.toLocaleString('es-AR') + ' por unidad</td></tr>';
    }).join('');
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

  function materialListLocked(list) {
    return !!(list && (list.compraConjuntaId || list.desagrupada || list.compraConfirmacion || (Array.isArray(list.ordenesIds) && list.ordenesIds.length) || ['reservada', 'recibida', 'cerrada'].indexOf(list.estado) >= 0));
  }

  function itemMaterialKey(item) {
    item = item || {};
    var productKey = String(item.productoKey || item.productoId || item.pid || '').trim();
    var code = String(item.codigo || item.cod || '').trim().toUpperCase();
    return productKey ? 'P:' + productKey : 'C:' + code;
  }

  function syncListItemsWithSale(list, sale) {
    if (!list || !sale || materialListLocked(list) || !Array.isArray(sale.items)) return false;
    var previous = Array.isArray(list.items) ? list.items : [];
    var used = {};
    var refreshed = sale.items.map(buildMaterialItem).filter(function (item) { return item.descripcion && isPurchasableMaterialItem(item); }).map(function (base) {
      var key = itemMaterialKey(base);
      var matchIndex = -1;
      for (var index = 0; index < previous.length; index++) {
        if (!used[index] && itemMaterialKey(previous[index]) === key) { matchIndex = index; break; }
      }
      if (matchIndex < 0) return base;
      used[matchIndex] = true;
      var saved = previous[matchIndex] || {};
      base.incluir = saved.incluir !== false && !base.esManoDeObra;
      base.usarExistente = Math.max(0, Math.min(base.cantidadNecesaria, parseFloat(saved.usarExistente) || 0));
      base.cantidadComprar = base.incluir ? Math.max(0, base.cantidadNecesaria - base.usarExistente) : 0;
      base.proveedorKey = saved.proveedorKey || base.proveedorKey;
      base.proveedor = saved.proveedor || base.proveedor;
      if (saved.costoUnitario !== undefined && saved.costoUnitario !== null && saved.costoUnitario !== '') {
        base.costoUnitario = Math.max(0, parseFloat(saved.costoUnitario) || 0);
      }
      var currentProvider = selectedProviderForItem(base);
      if (currentProvider) {
        base.proveedor = currentProvider.nombre;
        base.proveedorKey = currentProvider.proveedorKey;
        base.proveedorUrl = safeProviderUrl(currentProvider.url);
      } else {
        base.proveedorUrl = safeProviderUrl(saved.proveedorUrl);
      }
      return base;
    });
    var before = previous.map(function (item) { return [itemMaterialKey(item), parseFloat(item.cantidadNecesaria) || 0].join('|'); }).join('>');
    var after = refreshed.map(function (item) { return [itemMaterialKey(item), parseFloat(item.cantidadNecesaria) || 0].join('|'); }).join('>');
    list.items = refreshed;
    return before !== after;
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
      if (syncListItemsWithSale(existing, sale) && existing.fbKey && window.fbDB) {
        update(PATH_LISTS + '/' + existing.fbKey, { items: existing.items, actualizadoEn: Date.now(), actualizadoPor: window.currentUser || 'Sistema' }).catch(function () {});
      }
      if (!options.silent) openMaterialList(existing.fbKey);
      return Promise.resolve(existing);
    }
    if (!window.fbDB) return Promise.reject(new Error('Sin conexión'));
    var items = sale.items.map(buildMaterialItem).filter(function (item) { return item.descripcion && isPurchasableMaterialItem(item); });
    if (!items.length) {
      if (!options.silent && typeof window.notify === 'function') window.notify('La venta sólo contiene servicios o mano de obra; no hay materiales para comprar');
      return Promise.reject(new Error('Venta sin materiales comprables'));
    }
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
    if(list.compraConjuntaId)return openMaterialList(list.compraConjuntaId);
    var sourceSale = saleRef(list.ventaFbKey || list.ventaId);
    if (sourceSale && syncListItemsWithSale(list, sourceSale) && list.fbKey && window.fbDB) {
      update(PATH_LISTS + '/' + list.fbKey, { items: list.items, actualizadoEn: Date.now(), actualizadoPor: window.currentUser || 'Sistema' }).catch(function () {});
    }
    state.groupMaterialsByProvider = true;
    state.activeList = JSON.parse(JSON.stringify(list));
    if (window.permisoModulo && window.permisoModulo('balancecompra')) { var prior=document.getElementById('oc-material-list-modal');if(prior)prior.style.display='none';return window.ocAbrirSimuladorParaguay(); }
    var modal = ensureModal('oc-material-list-modal', '1120px');
    document.getElementById('oc-material-list-modal-title').innerHTML = '<i class="ti ti-list-check" style="margin-right:7px"></i>' + esc(list.numero || 'Lista de materiales') + ' · ' + esc(list.cliente || '');
    renderMaterialListBody();
    modal.style.display = 'flex';
    setTimeout(function () {
      if (window.SisVentas && typeof window.SisVentas.prepareResizablePage === 'function') window.SisVentas.prepareResizablePage(modal);
    }, 0);
  }

  var materialUsdtQuote=null,materialQuoteLoading=false;
  function materialRates(){var list=state.activeList||{},p=(list.simuladorParaguay||{}).parameters||{},closed=balanceFinalizado(list),d=typeof window.obtenerDolarReferenciaProducto==='function'?window.obtenerDolarReferenciaProducto():{};return {usd:Number(closed||p.usdMode==='manual'?p.usd:d.valor)||0,usdt:Number(closed||p.usdtExchange==='manual'?p.usdt:materialUsdtQuote&&materialUsdtQuote.exchange===(p.usdtExchange||'belo')?materialUsdtQuote.value:p.usdt)||0};}
  function materialEquivalent(value,currency){var rates=materialRates(),rate=currency==='USD'?rates.usd:rates.usdt;return rate>0?currency+' '+(value/rate).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';}
  function loadMaterialQuote(){var list=state.activeList,p=list&&(list.simuladorParaguay||{}).parameters||{},exchange=p.usdtExchange||'belo';if(!list||balanceFinalizado(list)||exchange==='manual'||materialQuoteLoading||materialUsdtQuote&&materialUsdtQuote.exchange===exchange&&Date.now()-materialUsdtQuote.loaded<300000)return;materialQuoteLoading=true;var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},10000);fetch('https://criptoya.com/api/usdt/ars/1',{signal:controller.signal}).then(function(r){if(!r.ok)throw new Error('Cotización no disponible');return r.json();}).then(function(data){var q=data[exchange];if(!q||!(Number(q.totalAsk)>0)||Math.abs(Date.now()/1000-Number(q.time))>1800)return;materialUsdtQuote={exchange:exchange,value:Number(q.totalAsk),loaded:Date.now()};if(state.activeList&&state.activeList.fbKey===list.fbKey)renderMaterialListBody();}).catch(function(){}).finally(function(){clearTimeout(timer);materialQuoteLoading=false;});}
  function providerCurrencyLabel(item,pv){var product=findProduct(item)||{},raw=typeof window.proveedoresVinculadosProducto==='function'?window.proveedoresVinculadosProducto(product):(product.proveedores||[]);var source=raw.find(function(v){return pv.proveedorKey&&v.proveedorKey===pv.proveedorKey||String(v.nombre||v.proveedor||'')===pv.nombre;})||pv;var foreign=String(source.monedaOriginal||'').toUpperCase()==='USD'||/paraguay|flytec|nissei/i.test(pv.nombre)||/\.com\.py/i.test(pv.url||'');var dollars=String(source.monedaOriginal||'').toUpperCase()==='USD'&&Number(source.precioOriginal)>0?'USD '+Number(source.precioOriginal).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})+' origen':materialEquivalent(pv.costo,'USD')+' equiv.';var ars=money(pv.costo)+' ARS';return foreign?dollars+' · '+ars:ars+' · '+dollars;}

  function providerOptions(item) {
    var options = (item.proveedores || []).map(function (pv, index) {
      var selected = (item.proveedorKey && item.proveedorKey === pv.proveedorKey) || (!item.proveedorKey && item.proveedor === pv.nombre);
      var label = pv.nombre + (pv.costo ? ' · ' + providerCurrencyLabel(item,pv) : ' · sin precio') + (!pv.disponible ? ' · SIN STOCK' : '') + (index === 0 && pv.costo ? ' · recomendado' : '');
      return '<option value="' + attr(pv.proveedorKey || pv.nombre) + '" data-name="' + attr(pv.nombre) + '" data-cost="' + pv.costo + '" data-url="' + attr(safeProviderUrl(pv.url)) + '" ' + (selected ? 'selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    return '<option value="">— Elegir proveedor —</option>' + options;
  }

  function renderMaterialListBody() {
    var list = state.activeList;
    if (!list) return;
    var body = document.getElementById('oc-material-list-modal-body');
    var generated = Array.isArray(list.ordenesIds) && list.ordenesIds.length;
    var locked = !!generated || list.estado === 'reservada' || list.estado === 'recibida' || list.estado === 'cerrada';
    var displayItems = materialRowsForDisplay(list);
    var lastProviderGroup = '';
    body.innerHTML =
      '<style>#oc-material-list-modal>.modal{width:98vw!important;max-width:1800px!important}#oc-material-list-modal .oc-material-table-wrap{overflow-x:auto}#oc-material-list-modal .oc-material-table{width:100%!important;min-width:0!important;table-layout:fixed!important}#oc-material-list-modal .oc-material-table th,#oc-material-list-modal .oc-material-table td{padding:10px 6px!important;min-width:0!important;max-width:none!important;font-size:11px;vertical-align:middle}#oc-material-list-modal .oc-material-table th{white-space:normal!important}#oc-material-list-modal .oc-material-product-content{gap:8px!important}#oc-material-list-modal .oc-material-product-copy{min-width:0;flex:1}#oc-material-list-modal .oc-material-description{white-space:normal!important;overflow-wrap:break-word;line-height:1.4;max-width:none!important}#oc-material-list-modal .oc-material-product img{width:38px!important;height:38px!important;object-fit:contain}#oc-material-list-modal .oc-li-provider{width:100%!important;min-width:0!important;font-size:11px;padding:7px 5px}#oc-material-list-modal .oc-li-existing{width:100%!important;min-width:0!important;padding:6px 3px}#oc-material-list-modal .oc-material-reference{font-size:10px!important;overflow-wrap:anywhere}#oc-material-list-modal .oc-li-usd,#oc-material-list-modal .oc-li-usdt,#oc-material-list-modal .oc-li-cost{white-space:normal!important;font-variant-numeric:tabular-nums}#oc-material-list-modal .oc-provider-group-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}#oc-material-list-modal .oc-provider-group>td{padding:9px!important}#oc-material-list-modal .oc-material-table col:nth-child(1),#oc-material-list-modal .oc-material-table th:nth-child(1){width:3%!important}#oc-material-list-modal .oc-material-table col:nth-child(2),#oc-material-list-modal .oc-material-table th:nth-child(2){width:23%!important}#oc-material-list-modal .oc-material-table col:nth-child(3),#oc-material-list-modal .oc-material-table th:nth-child(3){width:5%!important}#oc-material-list-modal .oc-material-table col:nth-child(4),#oc-material-list-modal .oc-material-table th:nth-child(4){width:6%!important}#oc-material-list-modal .oc-material-table col:nth-child(5),#oc-material-list-modal .oc-material-table th:nth-child(5){width:5%!important}#oc-material-list-modal .oc-material-table col:nth-child(6),#oc-material-list-modal .oc-material-table th:nth-child(6){width:25%!important}#oc-material-list-modal .oc-material-table col:nth-child(7),#oc-material-list-modal .oc-material-table th:nth-child(7){width:9%!important}#oc-material-list-modal .oc-material-table col:nth-child(8),#oc-material-list-modal .oc-material-table th:nth-child(8){width:8%!important}#oc-material-list-modal .oc-material-table col:nth-child(9),#oc-material-list-modal .oc-material-table th:nth-child(9){width:8%!important}#oc-material-list-modal .oc-material-table col:nth-child(10),#oc-material-list-modal .oc-material-table th:nth-child(10){width:8%!important}@media(max-width:760px){#oc-material-list-modal .oc-material-table-wrap{overflow-x:hidden}#oc-material-list-modal .oc-material-table{display:block;width:100%!important;min-width:0!important;table-layout:auto!important}#oc-material-list-modal .oc-material-table colgroup,#oc-material-list-modal .oc-material-table thead{display:none!important}#oc-material-list-modal .oc-material-table tbody{display:block;width:100%}#oc-material-list-modal .oc-material-table tr[data-index]{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;padding:16px;margin:10px 0;border:1px solid var(--border2);border-radius:12px;background:var(--bg3)}#oc-material-list-modal .oc-material-table tr[data-index]>td{display:block!important;width:auto!important;min-width:0!important;max-width:none!important;padding:0!important;border:0!important;overflow:visible!important;text-align:left!important;white-space:normal;grid-column:span 2}#oc-material-list-modal .oc-material-table .oc-material-check{grid-column:span 1!important}#oc-material-list-modal .oc-material-table .oc-material-product{grid-column:span 5!important}#oc-material-list-modal .oc-material-table .oc-material-provider,#oc-material-list-modal .oc-material-table .oc-material-reference{grid-column:1/-1!important}#oc-material-list-modal .oc-material-description{white-space:normal!important;overflow:visible!important;max-width:none!important}#oc-material-list-modal .oc-material-product-copy{min-width:0;flex:1}#oc-material-list-modal .oc-li-provider{min-width:0!important;width:100%!important;max-width:100%!important}#oc-material-list-modal .oc-material-table tr[data-index]>td[data-label]:not(.oc-material-product):before{content:attr(data-label);display:block;font-size:11px;color:var(--text3);margin-bottom:5px}#oc-material-list-modal .oc-material-existing input{max-width:100%}#oc-material-list-modal .oc-provider-group{display:block;margin-top:18px}#oc-material-list-modal .oc-provider-group>td{display:block;width:100%!important;box-sizing:border-box}#oc-material-list-modal .oc-provider-group-head{flex-wrap:wrap;gap:10px}#oc-material-list-modal .oc-material-cost,#oc-material-list-modal .oc-li-usd,#oc-material-list-modal .oc-li-usdt{font-weight:600;font-size:13px}}</style>'+
      '<div class="oc-material-toolbar"><div class="oc-material-context">' +
        '<span class="badge b-blue">Venta ' + esc(list.ventaId || 'manual') + '</span>' +
        '<span class="badge ' + (generated ? 'b-green' : 'b-amber') + '">' + (generated ? 'Órdenes generadas' : 'En preparación') + '</span>' +
        '<span style="font-size:12px;color:var(--text3);align-self:center">El stock anterior es sólo informativo. Indicá manualmente qué cantidad ya tienen.</span></div>' +
        '<div class="oc-material-actions"><button class="btn btn-sm ' + (state.groupMaterialsByProvider ? 'btn-primary' : '') + '" onclick="ocAlternarAgrupacionProveedores()"><i class="ti ti-category-2"></i> ' + (state.groupMaterialsByProvider ? 'Desagrupar' : 'Agrupar por proveedor') + '</button><button class="btn btn-sm" onclick="ocCopiarPedidoWhatsApp()"><i class="ti ti-brand-whatsapp"></i> Copiar pedido para WhatsApp</button>' + (!locked ? '<button class="btn btn-sm" id="oc-apply-recommended-btn" onclick="ocAplicarProveedoresRecomendados()" title="Elegir y guardar el proveedor conveniente actual para todos los materiales"><i class="ti ti-sparkles"></i> Poner todos en recomendado</button>' : '') + '<button class="btn btn-sm" onclick="ocExportarListaExcel()"><i class="ti ti-file-spreadsheet"></i> Exportar Excel</button></div>' +
      '</div>' +
      '<div class="table-wrap oc-material-table-wrap"><table class="oc-material-table" data-sv-mobile-cards="off"><thead><tr><th style="width:34px">Comprar</th><th>Material</th><th class="tr">Necesario</th><th class="tr">Ya tenemos</th><th class="tr">A comprar</th><th>Proveedor conveniente</th><th class="tr">Costo ARS</th><th class="tr">USD equivalente</th><th class="tr">USDT equivalente</th><th>Referencia</th></tr></thead><tbody>' +
      displayItems.map(function (display) {
        var item = display.item;
        var index = display.index;
        var product = findProduct(item);
        var thumbnail = productThumbnail(item, product);
        var op = operationalFor(product, item);
        var legacy = product ? parseFloat(product.stockReal || product.stock || 0) || 0 : 0;
        var disabled = (item.esManoDeObra || locked) ? 'disabled' : '';
        var estimated = (parseFloat(item.cantidadComprar) || 0) * (parseFloat(item.costoUnitario) || 0);
        var providerUrl = providerUrlForItem(item);
        var providerGroup = item.proveedor || 'Sin proveedor';
        var groupHeader = '';
        if (state.groupMaterialsByProvider && providerGroup !== lastProviderGroup) {
          lastProviderGroup = providerGroup;
          var groupSummary = purchaseSummaryForProvider(list, providerGroupKey(item));
          groupHeader = '<tr class="oc-provider-group"><td colspan="10"><div class="oc-provider-group-head"><div class="oc-provider-group-info"><strong><i class="ti ti-building-store"></i> ' + esc(providerGroup) + '</strong><span>' + groupSummary.items + ' productos · ' + formatOrderQuantity(groupSummary.units) + ' unidades · Total ' + money(groupSummary.total) + ' · '+materialEquivalent(groupSummary.total,'USD')+' · '+materialEquivalent(groupSummary.total,'USDT')+'</span></div>' + (item.proveedor ? '<button class="btn btn-sm" type="button" onclick="event.stopPropagation();ocCopiarPedidoWhatsAppProveedor(' + index + ')"><i class="ti ti-brand-whatsapp"></i> Copiar para WhatsApp</button>' : '') + '</div></td></tr>';
        }
        return groupHeader + '<tr data-index="' + index + '">' +
          '<td class="oc-material-check" data-label="Comprar"><input type="checkbox" class="oc-li-include" ' + (item.incluir ? 'checked' : '') + ' ' + disabled + ' onchange="ocMaterialChanged(' + index + ')"></td>' +
          '<td class="oc-material-product" data-label="Material"><div class="oc-material-product-content">' + thumbnail + '<div class="oc-material-product-copy"><div class="oc-material-code">' + esc(item.codigo || '') + '</div><div class="oc-material-description">' + esc(item.descripcion || '') + '</div>' + (item.esManoDeObra ? '<span class="badge b-blue">Servicio: no se compra</span>' : '') + '</div></div></td>' +
          '<td class="tr oc-material-qty" data-label="Necesario">' + (parseFloat(item.cantidadNecesaria) || 0) + '</td>' +
          '<td class="tr oc-material-existing" data-label="Ya tenemos"><input class="search-input oc-li-existing" type="number" min="0" max="' + (parseFloat(item.cantidadNecesaria) || 0) + '" step="1" value="' + (parseFloat(item.usarExistente) || 0) + '" ' + disabled + ' oninput="ocMaterialChanged(' + index + ')"></td>' +
          '<td class="tr oc-material-buy" data-label="A comprar"><strong class="oc-li-buy">' + (parseFloat(item.cantidadComprar) || 0) + '</strong></td>' +
          '<td class="oc-material-provider" data-label="Proveedor"><select class="search-input oc-li-provider" ' + disabled + ' onchange="ocMaterialChanged(' + index + ')">' + providerOptions(item) + '</select><div class="oc-li-provider-link">' + (providerUrl ? '<a href="' + attr(providerUrl) + '" target="_blank" rel="noopener"><i class="ti ti-external-link"></i> Abrir link de compra</a>' : '<span>Proveedor sin link cargado</span>') + '</div>' + (!(item.proveedores || []).length && !item.esManoDeObra ? '<button class="btn btn-sm" style="margin-top:5px" onclick="ocIrAProveedores()"><i class="ti ti-building-store"></i> Cargar proveedor</button>' : '') + '</td>' +
          '<td class="tr oc-li-cost oc-material-cost" data-label="Costo estimado">' + money(estimated) + '</td>' +
          '<td class="tr oc-li-usd" data-label="USD equivalente">'+materialEquivalent(estimated,'USD')+'</td><td class="tr oc-li-usdt" data-label="USDT equivalente">'+materialEquivalent(estimated,'USDT')+'</td>' +
          '<td class="oc-material-reference" data-label="Referencia">Operativo: ' + (parseFloat(op.general) || 0) + ' general · ' + (parseFloat(op.reservado) || 0) + ' reservado<br>Catálogo viejo: ' + legacy + ' (no verificado)' + (product ? '<br><button class="btn btn-sm" onclick="navegarAProducto(\'' + attr(product.fbKey || product.codigo) + '\')">Ver producto</button>' : '') + '</td>' +
        '</tr>';
      }).join('') +
      extraMaterialRowsHTML(list) + '</tbody></table></div>' +
      (list.compraConfirmacion && list.compraConfirmacion.estado==='pendiente' ? '<button class="btn btn-primary" onclick="ocGenerarOrdenesDesdeLista()">Reanudar confirmación de compra</button>' : '') +
      (window.permisoModulo && window.permisoModulo('balancecompra') ? '<button class="btn" onclick="ocAbrirSimuladorParaguay()">Simular compra Paraguay</button>' : '') +
      '<p style="font-size:12px;color:var(--text3)">Columnas USD y USDT: equivalentes del costo en pesos. Dólar: '+money(materialRates().usd)+' · USDT: '+(materialRates().usdt?money(materialRates().usdt):'sin cotización disponible')+'. El selector muestra el USD de origen cuando está informado; el costo en pesos conserva el valor registrado.</p>' +
      '<div id="oc-material-summary" style="margin-top:12px"></div>' +
      '<div class="oc-material-footer-actions">' +
        (!locked ? '<button class="btn" onclick="ocGuardarListaActual()"><i class="ti ti-device-floppy"></i> Guardar decisiones</button><button class="btn btn-primary" onclick="ocGenerarOrdenesDesdeLista()"><i class="ti ti-shopping-cart"></i> Generar órdenes por proveedor</button>' : (generated ? '<button class="btn btn-primary" onclick="document.getElementById(\'oc-material-list-modal\').style.display=\'none\';ocShowTab(\'orders\')"><i class="ti ti-shopping-cart"></i> Ver órdenes generadas</button>' : '<span class="badge b-green">Lista cerrada sin compras</span>')) +
      '</div>';
    updateMaterialSummary();
    setTimeout(function () {
      if (window.SisVentas && typeof window.SisVentas.prepareResizablePage === 'function') window.SisVentas.prepareResizablePage(body);
    }, 0);
  }

  window.ocAbrirSimuladorParaguay = async function () {
    if (!window.permisoModulo || !window.permisoModulo('balancecompra')) return;
    if (!state.activeList) return;
    if (!window.SVParaguayPlanner) {
      try { await new Promise(function(resolve,reject){var script=document.createElement('script');script.src='./js/modules/paraguay-planner.js?v=3.7.19';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);}); }
      catch(e) { if(window.notify) window.notify('No se pudo cargar el simulador'); return; }
    }
    var list=state.activeList;
    var sale=saleRef(list.ventaFbKey||list.ventaId)||{};
    var rows=(list.items||[]).filter(function(i){return isPurchasableMaterialItem(i)&&i.incluir&&i.cantidadNecesaria>0;}).map(function(i){
      var product=findProduct(i)||{};
      var raw=typeof window.proveedoresVinculadosProducto==='function'?window.proveedoresVinculadosProducto(product):(product.proveedores||[]);
      var pv=raw.find(function(p){return (i.proveedorKey&&p.proveedorKey===i.proveedorKey)||String(p.nombre||p.proveedor||'')===i.proveedor;})||{};
      var py=/paraguay|flytec|nissei/i.test(i.proveedor||'')||/\.com\.py/i.test(i.proveedorUrl||'');
      var original=i.origenVentaItem||{}; var originalQty=Number(original.qty||original.cantidad||original.cant)||1;
      var baselinePart=typeof window.obtenerCostoItemVenta==='function'?window.obtenerCostoItemVenta(original)/originalQty*Number(i.cantidadNecesaria):null;
      return {sourceListId:i.sourceListId||'',saleLabel:i.saleLabel||'',expenseExcluded:!!i.expenseExcluded,needed:Number(i.cantidadNecesaria)||0,existing:Number(i.usarExistente)||0,sourceQty:Number(i.cantidadComprar)||0,productKey:String(i.productoKey||i.codigo),providerKey:i.proveedorKey||'',baselinePart:baselinePart,key:[i.productoKey||i.codigo,i.linea,i.proveedorKey||i.proveedor].join('|'),code:i.codigo,description:i.descripcion,provider:i.proveedor,qty:Number(i.cantidadComprar),include:py,usd:String(pv.monedaOriginal||'').toUpperCase()==='USD'?Number(pv.precioOriginal)||'':'',weight:1};
    });
    if(!window.SVPurchasePDF){try{await new Promise(function(resolve,reject){var script=document.createElement('script');script.src='./js/modules/purchase-pdf-import.js?v=3.7.18';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);});}catch(e){if(window.notify)window.notify('No se pudo cargar la importación PDF. Reintentá.');return;}}
    window.SVParaguayPlanner.open({saleId:list.ventaId||list.numero,stockOnly:list.origen==='stock_paraguay',rows:rows,saved:list.simuladorParaguay,closed:materialListLocked(list)||!!list.compraConfirmacion,isClosed:function(){return materialListLocked(state.lists.find(function(x){return x.fbKey===list.fbKey;})||list);},
      catalog:productList().filter(function(p){return !isLabor(p);}).map(function(p){return {key:String(p.fbKey||p.codigo),code:p.codigo||'',description:p.nombre||'',providers:providersFor(p).map(function(v){var raw=(typeof window.proveedoresVinculadosProducto==='function'?window.proveedoresVinculadosProducto(p):p.proveedores||[]).find(function(x){return x.proveedorKey===v.proveedorKey||String(x.nombre||x.proveedor)===v.nombre;})||{};return Object.assign({},v,{usd:String(raw.monedaOriginal||'').toUpperCase()==='USD'?Number(raw.precioOriginal)||0:0});})};}),
      confirm:function(snapshot){return confirmPlannedPurchase(list,snapshot);},
      closePurchase:function(){return reconcilePlannedPurchase(list);},
      thumbnail:function(row){if(row.destination==='stock')return productThumbnail({productoKey:row.productKey,codigo:row.code});var item=(list.items||[]).find(function(i){return [i.productoKey||i.codigo,i.linea,i.proveedorKey||i.proveedor].join('|')===row.key;});return productThumbnail(item||{});},
      documents:list.comprobantesCompra||{},
      sources:list.sources||[],ungroup:list.origen==='conjunta'?function(){return ungroupJointPurchase(list);}:null,
      initial:{revenue:list.origen==='conjunta'?list.sources.reduce(function(a,x){return a+x.revenue;},0):list.origen==='stock_paraguay'?0:typeof window._rentIngresoNetoVenta==='function'?window._rentIngresoNetoVenta(sale):'',baseline:list.origen==='conjunta'?list.sources.reduce(function(a,x){return a+x.baseline;},0):list.origen==='stock_paraguay'?0:typeof window._rentCostoVenta==='function'?window._rentCostoVenta(sale):''},
      save:async function(data){if(materialListLocked(state.lists.find(function(x){return x.fbKey===list.fbKey;})||list))throw new Error('Compra finalizada: valores congelados');if(!window.permisoModulo('balancecompra'))throw new Error('Sin permiso');var imported=data.pdfImport;var clean=Object.assign({},data);delete clean.pdfImport;var changes={simuladorParaguay:clean};if(imported){if(!/^[a-f0-9]{64}$/.test(imported.id)||!/^data:(application\/pdf|image\/(jpeg|png|webp));base64,/.test(imported.data)||imported.size>2*1024*1024)throw new Error('PDF inválido');changes['comprobantesCompra/'+imported.id]=imported;}await update(PATH_LISTS+'/'+list.fbKey,changes);if(imported){list.comprobantesCompra=list.comprobantesCompra||{};list.comprobantesCompra[imported.id]=imported;}list.simuladorParaguay=JSON.parse(JSON.stringify(clean));var stored=state.lists.find(function(x){return x.fbKey===list.fbKey;});if(stored)stored.simuladorParaguay=list.simuladorParaguay;renderBalanceCompra();}
    });
  };

  function materialChanged(index) {
    var list = state.activeList;
    var row = document.querySelector('#oc-material-list-modal-body tr[data-index="' + index + '"]');
    if (!list || !row || !list.items[index]) return;
    var item = list.items[index];
    var previousProviderKey = String(item.proveedorKey || '');
    item.incluir = !!row.querySelector('.oc-li-include').checked;
    item.usarExistente = Math.max(0, Math.min(parseFloat(item.cantidadNecesaria) || 0, parseFloat(row.querySelector('.oc-li-existing').value) || 0));
    item.cantidadComprar = item.incluir ? Math.max(0, (parseFloat(item.cantidadNecesaria) || 0) - item.usarExistente) : 0;
    var select = row.querySelector('.oc-li-provider');
    var option = select && select.options[select.selectedIndex];
    item.proveedorKey = select ? select.value : '';
    item.proveedor = option ? option.dataset.name || option.textContent : '';
    item.costoUnitario = option ? parseFloat(option.dataset.cost) || 0 : 0;
    item.proveedorUrl = option ? safeProviderUrl(option.dataset.url) : '';
    row.querySelector('.oc-li-buy').textContent = item.cantidadComprar;
    row.querySelector('.oc-li-cost').textContent = money(item.cantidadComprar * item.costoUnitario);row.querySelector('.oc-li-usd').textContent=materialEquivalent(item.cantidadComprar*item.costoUnitario,'USD');row.querySelector('.oc-li-usdt').textContent=materialEquivalent(item.cantidadComprar*item.costoUnitario,'USDT');
    var linkBox = row.querySelector('.oc-li-provider-link');
    if (linkBox) linkBox.innerHTML = item.proveedorUrl ? '<a href="' + attr(item.proveedorUrl) + '" target="_blank" rel="noopener" style="font-size:11px;color:var(--blue)"><i class="ti ti-external-link"></i> Abrir link de compra</a>' : '<span style="font-size:11px;color:var(--text3)">Proveedor sin link cargado</span>';
    updateMaterialSummary();
    if (state.groupMaterialsByProvider && previousProviderKey !== String(item.proveedorKey || '')) renderMaterialListBody();
  }

  function updateMaterialSummary() {
    var el = document.getElementById('oc-material-summary');
    var list = state.activeList;
    if (!el || !list) return;
    var purchase = (list.items || []).filter(function (i) { return isPurchasableMaterialItem(i) && i.incluir && i.cantidadComprar > 0; }).concat(extraMaterialItems(list));
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

  function toggleProviderGrouping() {
    state.groupMaterialsByProvider = !state.groupMaterialsByProvider;
    renderMaterialListBody();
  }

  function applyRecommendedProvidersToCurrentList() {
    var list = state.activeList;
    if (!list || materialListLocked(list)) return Promise.resolve(null);
    var result = applyRecommendedProviders(list);
    renderMaterialListBody();
    if (!result.reviewed) {
      if (typeof window.notify === 'function') window.notify('No hay materiales para revisar');
      return Promise.resolve(result);
    }
    if (!result.applied) {
      if (typeof window.notify === 'function') window.notify('Ningún material tiene un proveedor recomendado disponible');
      return Promise.resolve(result);
    }
    var button = document.getElementById('oc-apply-recommended-btn');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="ti ti-loader-2 spin"></i> Guardando recomendados...';
    }
    return saveCurrentList(true).then(function () {
      var message = 'Proveedor recomendado aplicado y guardado en ' + result.applied + ' material' + (result.applied === 1 ? '' : 'es');
      if (result.changed) message += ' · ' + result.changed + ' cambiaron de proveedor';
      if (result.unavailable) message += ' · ' + result.unavailable + ' sin recomendación';
      if (typeof window.notify === 'function') window.notify(message);
      renderMaterialListBody();
      return result;
    }).catch(function (error) {
      renderMaterialListBody();
      if (typeof window.notify === 'function') window.notify('Se aplicaron los recomendados, pero no se pudieron guardar: ' + error.message);
      throw error;
    });
  }

  function buildMaterialExportRows(list) {
    var rows = [['Orden venta', 'Comprar', 'Código', 'Material', 'Necesario', 'Ya tenemos', 'A comprar', 'Proveedor seleccionado', 'Costo unitario', 'Costo estimado', 'Link de compra']];
    var groupRows = [];
    var lastProvider = '';
    materialRowsForDisplay(list).forEach(function (display) {
      var item = display.item;
      var provider = item.proveedor || 'Sin proveedor';
      if (state.groupMaterialsByProvider && provider !== lastProvider) {
        lastProvider = provider;
        rows.push(['Proveedor: ' + provider, '', '', '', '', '', '', '', '', '', '']);
        groupRows.push(rows.length);
      }
      var buy = parseFloat(item.cantidadComprar) || 0;
      var unitCost = parseFloat(item.costoUnitario) || 0;
      rows.push([
        parseFloat(item.linea) >= 0 ? parseFloat(item.linea) + 1 : '', item.incluir ? 'Sí' : 'No', item.codigo || '', item.descripcion || '',
        parseFloat(item.cantidadNecesaria) || 0, parseFloat(item.usarExistente) || 0, buy, provider, unitCost,
        Math.round(buy * unitCost * 100) / 100, providerUrlForItem(item)
      ]);
    });
    var extras = extraMaterialItems(list);
    if (extras.length) {
      rows.push(['Extras · stock general', '', '', '', '', '', '', '', '', '', '']);
      groupRows.push(rows.length);
      extras.forEach(function(item) {
        rows.push(['Extra', 'Sí', item.codigo, item.descripcion, item.cantidadNecesaria, 0, item.cantidadComprar, item.proveedor,
          item.costoUnitario, Math.round(item.cantidadComprar * item.costoUnitario * 100) / 100, providerUrlForItem(item)]);
      });
    }
    return { rows: rows, groupRows: groupRows };
  }

  function formatOrderQuantity(value) {
    var quantity = parseFloat(value) || 0;
    return Number.isInteger(quantity) ? String(quantity) : String(quantity).replace('.', ',');
  }

  function buildWhatsAppOrderText(list, providerFilter) {
    var filterKey = String(providerFilter || '').trim().toLowerCase();
    var items = ((list && list.items) || []).concat(extraMaterialItems(list)).filter(function (item) {
      return isPurchasableMaterialItem(item) && item.incluir && (parseFloat(item.cantidadComprar) || 0) > 0 && (!filterKey || providerGroupKey(item) === filterKey);
    });
    if (!items.length) throw new Error('No hay materiales seleccionados para copiar');
    var missingProvider = items.find(function (item) { return !String(item.proveedor || '').trim(); });
    if (missingProvider) throw new Error('Elegí un proveedor para todos los materiales antes de copiar el pedido');
    var missingUrl = items.find(function (item) { return !providerUrlForItem(item); });
    if (missingUrl) throw new Error('Falta el link de compra de ' + (missingUrl.codigo || missingUrl.descripcion || 'un material'));
    var groups = [];
    var groupByProvider = {};
    items.forEach(function (item) {
      var provider = String(item.proveedor || '').trim();
      var key = providerGroupKey(item);
      if (!groupByProvider[key]) {
        groupByProvider[key] = { provider: provider, items: [] };
        groups.push(groupByProvider[key]);
      }
      groupByProvider[key].items.push(item);
    });
    return groups.map(function (group) {
      var productText = function (item) {
        return '*' + formatOrderQuantity(item.cantidadComprar) + ' x ' + String(item.codigo || '').trim() + '*\n' +
          String(item.descripcion || '').trim() + '\n' + providerUrlForItem(item);
      };
      var products = group.items.filter(function(item) { return !item.esExtra; }).map(productText).join('\n\n');
      var extras = group.items.filter(function(item) { return item.esExtra; });
      if (extras.length) products += (products ? '\n\n' : '') + '*Extras · stock general*\n\n' + extras.map(productText).join('\n\n');
      return '*PEDIDO – ' + group.provider.toLocaleUpperCase('es') + '*\n\n' + products;
    }).join('\n\n\n');
  }

  function writeClipboardText(text) {
    if (window.navigator && window.navigator.clipboard && typeof window.navigator.clipboard.writeText === 'function') {
      return window.navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        if (!document.execCommand('copy')) throw new Error('El navegador no permitió copiar');
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        textarea.remove();
      }
    });
  }

  function copyWhatsAppOrder(providerFilter) {
    try {
      var text = buildWhatsAppOrderText(state.activeList, providerFilter);
      return writeClipboardText(text).then(function () {
        if (typeof window.notify === 'function') window.notify('Pedido para WhatsApp copiado');
        return text;
      }).catch(function (error) {
        if (typeof window.notify === 'function') window.notify('No se pudo copiar el pedido: ' + (error.message || error));
        return '';
      });
    } catch (error) {
      if (typeof window.notify === 'function') window.notify(error.message || 'No se pudo preparar el pedido');
      return Promise.resolve('');
    }
  }

  function copyWhatsAppOrderForItem(index) {
    var item = state.activeList && state.activeList.items && state.activeList.items[index];
    if (!item || !item.proveedor) {
      if (typeof window.notify === 'function') window.notify('Elegí un proveedor antes de copiar el pedido');
      return Promise.resolve('');
    }
    return copyWhatsAppOrder(providerGroupKey(item));
  }

  function exportMaterialListExcel() {
    var list = state.activeList;
    if (!list) return;
    materialRowsForDisplay(list).forEach(function (display) { materialChanged(display.index); });
    var loader = window.cargarSheetJS;
    if (typeof loader !== 'function') {
      if (typeof window.notify === 'function') window.notify('No se pudo iniciar la exportación a Excel');
      return;
    }
    loader(function () {
      try {
        var exportData = buildMaterialExportRows(list);
        var rows = exportData.rows;
        var workbook = window.XLSX.utils.book_new();
        var sheet = window.XLSX.utils.aoa_to_sheet(rows);
        sheet['!cols'] = [{wch:12},{wch:10},{wch:15},{wch:48},{wch:12},{wch:14},{wch:12},{wch:28},{wch:16},{wch:17},{wch:55}];
        if (exportData.groupRows.length) {
          sheet['!merges'] = exportData.groupRows.map(function (rowNumber) {
            return { s: { r: rowNumber - 1, c: 0 }, e: { r: rowNumber - 1, c: 10 } };
          });
        }
        for (var rowIndex = 2; rowIndex <= rows.length; rowIndex++) {
          ['I', 'J'].forEach(function (column) { if (sheet[column + rowIndex]) sheet[column + rowIndex].z = '$ #,##0.00'; });
          var linkCell = sheet['K' + rowIndex];
          if (linkCell && safeProviderUrl(linkCell.v)) linkCell.l = { Target: linkCell.v, Tooltip: 'Abrir producto en el proveedor seleccionado' };
        }
        sheet['!autofilter'] = { ref: 'A1:K' + rows.length };
        window.XLSX.utils.book_append_sheet(workbook, sheet, 'Lista de compras');
        var filename = String(list.numero || list.ventaId || 'lista-compras').replace(/[^a-zA-Z0-9_-]+/g, '-') + '.xlsx';
        window.XLSX.writeFile(workbook, filename);
        if (typeof window.notify === 'function') window.notify('Lista exportada a Excel');
      } catch (error) {
        if (typeof window.notify === 'function') window.notify('No se pudo exportar: ' + error.message);
      }
    }, function () {
      if (typeof window.notify === 'function') window.notify('No se pudo cargar el exportador de Excel');
    });
  }

  function saveCurrentList(silent) {
    var list = state.activeList;
    if (!list || !list.fbKey || !window.fbDB) return Promise.reject(new Error('Lista no disponible'));
    materialRowsForDisplay(list).forEach(function (display) { materialChanged(display.index); });
    list.items = (list.items || []).filter(isPurchasableMaterialItem);
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
    var declared = (list.items || []).filter(function (item) { return isPurchasableMaterialItem(item) && item.incluir && (parseFloat(item.usarExistente) || 0) > 0; });
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

  function buildPlannedOrders(list,sim) {
    if(list.origen==='conjunta'){
      var combined=[],active=(sim.rows||[]).filter(function(r){return r.include&&Number(r.qty)>0;});
      (list.sources||[]).forEach(function(source){var rows=(sim.rows||[]).filter(function(r){return r.sourceListId===source.listId;}),result=Object.assign({},sim.result);['remoteAllocation','onsiteAllocation'].forEach(function(k){result[k]=rows.filter(function(r){return r.include&&Number(r.qty)>0;}).map(function(r){return Number((sim.result[k]||[])[active.indexOf(r)])||0;});});
        var child=Object.assign({},source,{fbKey:list.fbKey+'_'+safeKey(source.listId),numero:list.numero,items:(list.items||[]).filter(function(i){return i.sourceListId===source.listId;})});
        if(rows.some(function(r){return Number(r.qty)>0;}))combined=combined.concat(buildPlannedOrders(child,Object.assign({},sim,{rows:rows,result:result,extras:[]})).map(function(order){order.listaMaterialesId=list.fbKey;order.listaOrigenId=source.listId;return order;}));
      });
      if((sim.extras||[]).length)combined=combined.concat(buildPlannedOrders({fbKey:list.fbKey,numero:list.numero,items:[]},Object.assign({},sim,{rows:[]})));
      if(!combined.length)throw Error('No hay productos pendientes de compra.');return combined;
    }
    if(!sim||!sim.chosen||!sim.complete)throw new Error('Guardá una simulación completa y elegí envío o viaje antes de confirmar.');
    var p=sim.parameters||{},r=sim.result||{},selected=(sim.rows||[]).filter(function(x){return x.include&&Number(x.qty)>0;}),groups={};
    function add(row,destination,unit){if(!(Number(row.qty)>0)||!(unit>0)||!row.providerKey)throw new Error('Faltan proveedor registrado, cantidad o precio: '+row.code);var key=safeKey(row.providerKey)+'_'+destination;if(!groups[key])groups[key]={provider:row.provider,providerKey:row.providerKey,destination:destination,items:[]};groups[key].items.push({productoKey:row.productKey||'',codigo:row.code,descripcion:row.description,unidad:'Unidad',cantidadOrdenada:Number(row.qty),cantidadRecibida:0,costoUnitario:unit,costoUnitarioPresupuestado:unit,precioOrigenUSD:Number(row.usd),destino:destination,subtotal:Number(row.qty)*unit});}
    selected.forEach(function(row,i){var item=(list.items||[]).find(function(x){return [x.productoKey||x.codigo,x.linea,x.proveedorKey||x.proveedor].join('|')===row.key;});if(!item||Number(row.qty)+Number(row.existing||0)>Number(item.cantidadNecesaria)||!item.incluir)throw new Error('La selección cambió. Reabrí y guardá la simulación antes de confirmar.');var alloc=(sim.chosen==='remote'?r.remoteAllocation:r.onsiteAllocation)||[];add(Object.assign({},row,{productKey:item.productoKey,providerKey:row.providerKey||item.proveedorKey}), 'venta',Number(row.usd)*Number(p.usd)+(Number(alloc[i])||0)/Number(row.qty));});
    (sim.rows||[]).filter(function(row){return !row.include&&Number(row.qty)>0;}).forEach(function(row){var item=(list.items||[]).find(function(x){return [x.productoKey||x.codigo,x.linea,x.proveedorKey||x.proveedor].join('|')===row.key;});if(!item||Number(row.qty)+Number(row.existing||0)>Number(item.cantidadNecesaria))throw new Error('Las cantidades de la venta cambiaron. Reabrí la compra.');add(Object.assign({},row,{productKey:item.productoKey,providerKey:row.providerKey||item.proveedorKey}),'venta',row.providerOverride?Number(row.localUnitARS):Number(row.baselineUnit));});
    var extras=sim.extras||[],goods=extras.reduce(function(a,x){return a+Number(x.qty)*Number(x.usd);},0),extraCost=Number(p.extraLogisticsUSD||0)*Number(p.usd);
    extras.forEach(function(row){add(row,'stock',Number(row.usd)*Number(sim.chosen==='remote'?p.usdt:p.usd)+(goods?extraCost*Number(row.usd)/goods:0));});
    if(!Object.keys(groups).length)throw new Error('No hay productos pendientes de compra.');
    return Object.keys(groups).sort().map(function(key,index){var g=groups[key],total=g.items.reduce(function(a,x){return a+x.subtotal;},0);return {fbKey:'plan_'+safeKey(list.fbKey)+'_'+key,generacionPendiente:true,numero:'OC-'+safeKey(list.numero||list.fbKey)+'-'+(index+1),origen:g.destination==='stock'?'extra_stock':'venta',listaMaterialesId:list.fbKey,ventaId:g.destination==='venta'?list.ventaId||'':'',ventaFbKey:g.destination==='venta'?list.ventaFbKey||'':'',cliente:g.destination==='venta'?list.cliente||'':'',compraVentaReferencia:list.ventaId||'',proveedor:g.provider,proveedorKey:g.providerKey,fecha:today(),estado:'borrador',items:g.items,total:total,monto:total,moneda:'ARS',recepciones:[],ts:Date.now(),usuario:window.currentUser||'Sistema'};});
  }

  async function confirmPlannedPurchase(list,sim) {
    if(!window.permisoModulo||!window.permisoModulo('balancecompra')||!window.permisoModulo('ordenes'))throw new Error('Sin permiso para confirmar compras.');
    if(list.compraConjuntaId)throw Error('Esta venta pertenece a una compra conjunta.');
    if(list.origen==='conjunta'&&(list.sources||[]).some(function(source){return jointSaleFingerprint(saleRef(source.ventaFbKey))!==source.saleFingerprint;}))throw Error('Cambió una venta de esta compra. Separá las ventas y volvé a reunirlas para revisar las cantidades.');
    var planned=buildPlannedOrders(list,sim);
    if(!await window.svConfirm('Confirmar compra: '+planned.length+' órdenes separadas por proveedor y destino. Se congelan precios y cotizaciones. El stock ingresa recién al registrar la recepción.'))throw new Error('Compra sin confirmar.');
    var claim=await window.fbRunTransaction(window.fbRef(window.fbDB,PATH_LISTS+'/'+list.fbKey),function(current){if(!current||current.compraConjuntaId||current.desagrupada||balanceFinalizado(current))return;if(current.compraConfirmacion)return current;if(current.ordenesIds&&current.ordenesIds.length)return;current.compraConfirmacion={estado:'pendiente',ordenes:planned,fecha:Date.now()};current.simuladorParaguay=sim;return current;});
    if(!claim.committed)throw new Error('Esta lista ya tiene órdenes o no está disponible.');
    var stored=claim.snapshot.val();if(!stored.compraConfirmacion)throw new Error('No se pudo confirmar la compra.');
    list.simuladorParaguay=stored.simuladorParaguay;await finishPlannedPurchase(list,stored.compraConfirmacion);
  }

  async function reconcilePlannedPurchase(list){
    if(!window.permisoModulo||!window.permisoModulo('balancecompra')||!window.permisoModulo('ordenes'))throw new Error('Sin permiso para cerrar la compra.');
    if(!list.compraConfirmacion)throw new Error('Esta lista todavía no tiene una compra confirmada.');
    var ids=list.ordenesIds||[];if(!ids.length)throw new Error('Terminá la confirmación pendiente antes de cerrar.');
    var orders=await Promise.all(ids.map(async function(id){var read=await window.fbRunTransaction(window.fbRef(window.fbDB,PATH_ORDERS+'/'+id),function(current){return current;});return read.snapshot.val();}));
    if(orders.some(function(o){return !o||o.recepcionPendiente||o.cancelacionPendiente||!['recibida','cancelada'].includes(o.estado);}))throw new Error('Hay órdenes o recepciones pendientes. Registrá lo recibido o cancelá las cantidades que no llegarán.');
    for(var source of list.sources||[]) {await update('sisventas/ventas/'+source.ventaFbKey,{compraEstado:'cerrada'});await update(PATH_LISTS+'/'+source.listId,{estado:'cerrada'});}
    if(list.ventaFbKey)await update('sisventas/ventas/'+list.ventaFbKey,{compraEstado:'cerrada'});
    await update(PATH_LISTS+'/'+list.fbKey,{estado:'cerrada',cerradaEn:Date.now(),cerradaPor:window.currentUser||'Sistema'});list.estado='cerrada';renderBalanceCompra();return 'Compra cerrada: recepción terminada y valores congelados.';
  }

  async function finishPlannedPurchase(list,confirmation){
    if(confirmation.estado==='completa'){if(typeof window.notify==='function')window.notify('Esta compra ya tiene órdenes generadas.');return;}
    var planned=confirmation.ordenes||[];
    if(list.origen==='conjunta'){
      for(var source of list.sources||[]){var sourceRows=(list.simuladorParaguay&&list.simuladorParaguay.rows||[]).filter(function(r){return r.sourceListId===source.listId;});
        await finishPlannedPurchase(Object.assign({},source,{fbKey:list.fbKey+'_'+safeKey(source.listId),stockExistenteReservado:false,simuladorParaguay:{rows:sourceRows}}),{estado:'pendiente',ordenes:planned.filter(function(o){return o.listaOrigenId===source.listId;})});
      }
    }
    var existingRows=(list.origen==='conjunta'||list.stockExistenteReservado?[]:list.simuladorParaguay&&list.simuladorParaguay.rows||[]).filter(function(row){return Number(row.existing)>0;}),existingByProduct={};existingRows.forEach(function(row){var key=row.productKey||row.code;existingByProduct[key]=(existingByProduct[key]||0)+Number(row.existing);});
    for(var productKey of Object.keys(existingByProduct)){var quantity=existingByProduct[productKey];await transactionInventory(productKey,function(inv){inv.operaciones=inv.operaciones||{};var operation='existente_plan_'+safeKey(list.fbKey);if(inv.operaciones[operation])return;var available=Math.min(quantity,Number(inv.general)||0);inv.general=(Number(inv.general)||0)-available;inv.reservado=(Number(inv.reservado)||0)+quantity;inv.asignaciones=inv.asignaciones||{};var allocation=safeKey(list.ventaFbKey||list.ventaId||list.fbKey);var assignment=inv.asignaciones[allocation]||(inv.asignaciones[allocation]={reservado:0,consumido:0,liberado:0});assignment.reservado=(Number(assignment.reservado)||0)+quantity;assignment.ventaId=list.ventaId||'';assignment.origen=available===quantity?'stock_general':'declarado_manualmente';inv.operaciones[operation]=Date.now();});}

    for(var order of planned){await window.fbRunTransaction(window.fbRef(window.fbDB,PATH_ORDERS+'/'+order.fbKey),function(current){return current||order;});
      var byProduct={};order.items.forEach(function(item){var key=item.productoKey||item.codigo;if(!byProduct[key])byProduct[key]={qty:0,item:item};byProduct[key].qty+=Number(item.cantidadOrdenada);});
      for(var key of Object.keys(byProduct)){var entry=byProduct[key];await transactionInventory(key,function(inv){inv.operaciones=inv.operaciones||{};var op='compra_'+order.fbKey;if(inv.operaciones[op])return;inv.enCompra=(Number(inv.enCompra)||0)+entry.qty;inv.codigo=entry.item.codigo;inv.descripcion=entry.item.descripcion;inv.operaciones[op]=Date.now();});}
    }
    for(var readyOrder of planned)await update(PATH_ORDERS+'/'+readyOrder.fbKey,{generacionPendiente:false});
    var keys=planned.map(function(o){return o.fbKey;});await update(PATH_LISTS+'/'+(list.listId||list.fbKey),{estado:'ordenada',ordenesIds:keys,ordenadaEn:Date.now()});list.estado='ordenada';list.ordenesIds=keys;list.compraConfirmacion=confirmation;
    if(list.ventaFbKey)await update('sisventas/ventas/'+list.ventaFbKey,{ordenesCompraIds:keys.filter(function(k){return planned.find(function(o){return o.fbKey===k;}).origen==='venta';}),compraEstado:'ordenada'});
    if(!list.listId)await update(PATH_LISTS+'/'+list.fbKey,{'compraConfirmacion/estado':'completa'});confirmation.estado='completa';
    if(typeof window.notify==='function')window.notify('Compra confirmada. Órdenes creadas; el stock se registra al recibir.');renderBalanceCompra();
  }

  function generateOrdersFromList() {
    var list = state.activeList;
    if (!list) return;
    var latest=state.lists.find(function(l){return l.fbKey===list.fbKey;})||list;if(latest.compraConjuntaId){openMaterialList(latest.compraConjuntaId);return;}
    if(list.compraConfirmacion){finishPlannedPurchase(list,list.compraConfirmacion).catch(function(e){window.notify(e.message);});return;}
    if(list.simuladorParaguay){confirmPlannedPurchase(list,list.simuladorParaguay).catch(function(e){window.notify(e.message);});return;}
    saveCurrentList(true).then(async function () {
      var purchase = list.items.filter(function (i) { return isPurchasableMaterialItem(i) && i.incluir && parseFloat(i.cantidadComprar) > 0; });
      var missing = purchase.filter(function (i) { return !i.proveedor; });
      if (missing.length) throw new Error('Elegí un proveedor para todos los materiales');
      if (list.ordenesIds && list.ordenesIds.length && !await window.svConfirm('Esta lista ya generó órdenes. ¿Generar un nuevo grupo con las decisiones actuales?')) return null;
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
            proveedorUrl: providerUrlForItem(item),
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
    target.innerHTML = '<div class="table-wrap"><table id="oc2-orders-table" data-sv-column-key="ordenes-compra-principal" style="min-width:880px"><thead><tr><th>N°</th><th>Proveedor</th><th>Destino</th><th>Materiales</th><th class="tr">Total</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>' +
      (list.length ? list.map(function (o) {
        var qty = Array.isArray(o.items) ? o.items.reduce(function (s, i) { return s + (parseFloat(i.cantidadOrdenada || i.cantidad) || 0); }, 0) : (parseFloat(o.cantidad) || 0);
        var itemCount = (o.items && o.items.length) || 1;
        return '<tr onclick="ocAbrirOrden(\'' + attr(o.fbKey) + '\')" style="cursor:pointer"><td><strong>' + esc(o.numero || '—') + '</strong></td><td>' + esc(orderProviderSummary(o)) + '</td><td>' + (o.ventaId ? '<span class="badge b-blue">' + esc(o.ventaId) + '</span><div style="font-size:11px;color:var(--text3)">' + esc(o.cliente || '') + '</div>' : 'Stock general') + '</td><td>' + qty + ' un. · ' + itemCount + ' ' + (itemCount === 1 ? 'ítem' : 'ítems') + '</td><td class="tr"><strong>' + money(o.total || o.monto) + '</strong></td><td>' + fmtDate(o.fecha) + '</td><td>' + statusBadge(o.estado) + '</td><td><button type="button" class="btn btn-sm btn-icon" title="Ver detalle" aria-label="Ver detalle"><i class="ti ti-eye"></i><span class="sv-mobile-action-label">Ver detalle</span></button></td></tr>';
      }).join('') : '<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text3)">Todavía no hay órdenes en este estado</td></tr>') +
      '</tbody></table></div>';
  }

  function renderLists() {
    renderBalanceCompra();
    renderPageShell();
    var target = document.getElementById('oc2-lists');
    if (!target) return;
    target.innerHTML = '<div class="table-wrap"><table id="oc2-lists-table" data-sv-column-key="ordenes-compra-listas"><thead><tr><th>Lista</th><th>Venta</th><th>Cliente</th><th>Materiales</th><th>Órdenes</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>' +
      (state.lists.length ? state.lists.map(function (list) {
        var pending = (list.items || []).filter(function (i) { return i.incluir && i.cantidadComprar > 0; }).length;
        return '<tr onclick="ocAbrirListaMateriales(\'' + attr(list.fbKey) + '\')" style="cursor:pointer"><td><strong>' + esc(list.numero || '—') + '</strong></td><td>' + esc(list.ventaId || 'Manual') + '</td><td>' + esc(list.cliente || '—') + '</td><td>' + pending + ' a comprar</td><td>' + ((list.ordenesIds || []).length) + '</td><td>' + statusBadge(list.estado) + '</td><td><button type="button" class="btn btn-sm btn-icon" title="Ver detalle" aria-label="Ver detalle"><i class="ti ti-eye"></i><span class="sv-mobile-action-label">Ver detalle</span></button></td></tr>';
      }).join('') : '<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--text3)">Las listas se crean desde el detalle de una venta</td></tr>') +
      '</tbody></table></div>';
  }

  function balanceFinalizado(list) {
    return ['recibida','cerrada','cancelada','anulada'].includes(String(list.estado || '').toLowerCase());
  }

  function balanceIndicadores(list) {
    var sim = list.simuladorParaguay;
    if (!sim || !sim.result || !sim.parameters) return null;
    var p = sim.parameters, r = sim.result;
    var current = (list.items || []).filter(function(i){return !i.esManoDeObra && i.incluir && Number(i.cantidadNecesaria)>0;});
    var stale = current.length !== (sim.rows || []).length || current.some(function(i){
      var key=[i.productoKey||i.codigo,i.linea,i.proveedorKey||i.proveedor].join('|');
      return !(sim.rows||[]).some(function(row){return row.key===key && Number(row.sourceQty===undefined?(row.maxQty===undefined?row.qty:row.maxQty):row.sourceQty)===Number(i.cantidadComprar);});
    });
    var selected = (sim.rows || []).filter(function(row){return row.include;});
    var retained = p.retained === '' ? Math.max(0,Number(p.baseline||0)-selected.reduce(function(sum,row){return sum+Number(row.baselinePart||0);},0)) : Number(p.retained||0);
    retained += Number(r.localCostAdjustment||0);
    var chosen = sim.previewChoice || sim.chosen || (Number(r.remote)<=Number(r.onsite)?'remote':'onsite');
    var total = Number(r[chosen]);
    var saving = Number(p.baseline||0)-retained-total;
    var originCost = Number(p.baseline||0)-retained;
    return { revenue:Number(p.revenue)||0, baseline:Number(p.baseline)||0, retained:retained, products:Number(r.goods||0)*Number(p.usd||0), operating:total-Number(r.goods||0)*Number(p.usd||0), currentProfit:Number(p.revenue||0)-Number(p.baseline||0), projectedProfit:Number(p.revenue||0)-retained-total, currentMargin:Number(p.revenue)>0?(Number(p.revenue)-Number(p.baseline||0))/Number(p.revenue)*100:null, usdt:Number(p.usdt)||0, chosen:chosen, applied:!!sim.chosen, total:total, saving:saving,
      percent:originCost>0?saving/originCost*100:null,
      points:Number(p.revenue)>0?saving/Number(p.revenue)*100:null,
      margin:Number(p.revenue)>0?(Number(p.revenue)-retained-total)/Number(p.revenue)*100:null,
      incomplete:sim.complete!==true, stale:stale,
      usd:Number(p.usd)||0 };
  }

  function balanceTieneCompraExterior(list) {
    if(list.origen==='conjunta'||list.origen==='stock_paraguay'||list.simuladorParaguay)return true;
    function exterior(record){return !!(record&&Array.isArray(record.items)&&record.items.some(function(item){var origin=String(item&&item.origenCompra||'').trim();return Number(item&&item.costoUnitarioCompra)>0&&origin&&!/^(argentina|local|nacional)$/i.test(origin);}));}
    var sale=saleRef(list.ventaFbKey||list.ventaId);
    if(sale&&Array.isArray(sale.items)&&sale.items.some(function(i){return String(i.origenCompra||'').trim();}))return exterior(sale);
    if(exterior(sale))return true;
    if(sale&&typeof window.buscarPptoPorRef==='function'){var ref=sale.presupuestoFbKey||sale.pptoFbKey||sale.presupuestoId||sale.pptoOrigen||sale.presupuestoOrigen||sale.pptoId;if(ref&&exterior(window.buscarPptoPorRef(ref)))return true;}
    return exterior({items:(list.items||[]).map(function(i){return i.origenVentaItem||{};})});
  }

  function balancePurchaseTitle(list) {
    if(list.origen==='stock_paraguay')return 'Stock general';
    var sources=list.origen==='conjunta'?(list.sources||[]):[list];
    var names=sources.map(function(source){
      var sale=saleRef(source.ventaFbKey)||{};
      return String(sale.cliente||source.cliente||'Cliente sin nombre').trim();
    });
    return Array.from(new Set(names)).join(' · ')||'Compra conjunta';
  }

  function collapseExteriorSections(target, opened, active, finished) {
    function fold(key, title, extraClass) {
      var details=document.createElement('details');details.className='card bc-fold '+(extraClass||'');details.dataset.bcFold=key;details.open=opened.has(key);
      var summary=document.createElement('summary');summary.textContent=title;details.appendChild(summary);return details;
    }
    var style=document.createElement('style');style.textContent='#balance-compra-content .bc-fold{padding:14px 18px;margin:12px 0;border-left:3px solid var(--blue)}#balance-compra-content .bc-fold>summary{cursor:pointer;font-weight:700;font-size:15px;overflow-wrap:anywhere}#balance-compra-content .bc-fold[open]>summary{margin-bottom:14px}#balance-compra-content .bc-fold-active{border-left-color:var(--amber)}#balance-compra-content .bc-fold-finished{border-left-color:var(--green)}#balance-compra-content .bc-fold .bc-card{margin:10px 0}#balance-compra-content .bc-card>summary{cursor:pointer;font-weight:700;font-size:14px;overflow-wrap:anywhere}#balance-compra-content .bc-card[open]>summary{margin-bottom:12px}';target.appendChild(style);
    var toolbar=target.querySelector('.bc-toolbar'), actions=toolbar.querySelector('.bc-toolbar-actions');
    var grid=toolbar.nextElementSibling, group;
    if(!grid)return;
    Array.from(grid.children).forEach(function(child){
      if(child.tagName==='H3'){
        var isActive=child.textContent==='Activas sin finalizar';group=fold(isActive?'active':'finished',child.textContent+' · '+(isActive?active:finished),isActive?'bc-fold-active':'bc-fold-finished');grid.insertBefore(group,child);child.remove();
      } else if(group){
        var card=document.createElement('details');card.className=child.className;
        var head=child.querySelector('.bc-head'), button=head&&head.querySelector('button');
        var key=button&&button.getAttribute('onclick')||child.textContent.slice(0,100);card.dataset.bcFold=key;card.open=opened.has(key);
        var summary=document.createElement('summary');summary.textContent=head?head.querySelector('h2').textContent+' · '+head.querySelector('span').textContent.split(' · ').pop():child.textContent;card.appendChild(summary);
        while(child.firstChild)card.appendChild(child.firstChild);group.appendChild(card);child.remove();
      }
    });
    var activeGroup=grid.querySelector('.bc-fold-active');
    if(!activeGroup){
      activeGroup=fold('active','Activas sin finalizar · '+active,'bc-fold-active');
      grid.prepend(activeGroup);
      var empty=document.createElement('p');empty.textContent='No hay compras activas sin finalizar.';activeGroup.appendChild(empty);
    }
    activeGroup.querySelector('summary').after(actions);
    toolbar.remove();
  }

  function renderBalanceCompra() {
    if(window.SVExteriorLists)window.SVExteriorLists.mount();
    var target=document.getElementById('balance-compra-content');
    if(!target)return;
    if(!window.permisoModulo || !window.permisoModulo('balancecompra')){target.innerHTML='';return;}
    var lists=state.lists.filter(function(l){return !l.compraConjuntaId&&!l.desagrupada&&balanceTieneCompraExterior(l);}).sort(function(a,b){return Number(balanceFinalizado(a))-Number(balanceFinalizado(b)) || Number(b.ts||0)-Number(a.ts||0);});
    var active=lists.filter(function(l){return !balanceFinalizado(l);}).length;
    var lastSection='';
    var opened=new Set(Array.from(target.querySelectorAll('details[data-bc-fold][open]')).map(function(el){return el.dataset.bcFold;}));
    target.innerHTML='<style>#balance-compra-content .bc-card{padding:24px;margin:0}#balance-compra-content .bc-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}#balance-compra-content .bc-head h2{font-size:20px;margin:0 0 8px}#balance-compra-content .bc-alert{padding:12px 16px;background:#e5b83b18;border-left:3px solid #e5b83b;color:var(--amber,#e5b83b);margin:18px 0;border-radius:6px}#balance-compra-content .bc-meta{margin:16px 0;color:var(--text2)}#balance-compra-content .bc-comparison{display:grid;grid-template-columns:1fr 1fr;gap:18px}#balance-compra-content .bc-comparison section{padding:22px;border-radius:14px;border:1px solid var(--border2);background:var(--bg3)}#balance-compra-content .bc-comparison .bc-after{border-color:#46b78c;background:#46b78c10}#balance-compra-content .bc-comparison h3{margin:0;font-size:18px}#balance-compra-content .bc-comparison p{color:var(--text3);margin:7px 0 22px}#balance-compra-content .bc-amount{display:flex;flex-direction:column;gap:7px;min-width:0}#balance-compra-content .bc-amount>span{color:var(--text2);font-size:13px}#balance-compra-content .bc-amount>strong{font-size:clamp(21px,2.5vw,32px);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}#balance-compra-content .bc-amount>small{color:var(--text3);line-height:1.5}#balance-compra-content .bc-margin{display:flex;justify-content:space-between;align-items:center;margin:20px 0;font-size:16px}#balance-compra-content .bc-margin strong{font-size:28px}#balance-compra-content .bc-improvement{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:22px;background:#36b87818;border:1px solid #36b87866;border-radius:14px;margin-top:18px;color:#64dba1}#balance-compra-content .bc-improvement>div:last-child{display:flex;flex-direction:column;gap:6px;justify-content:center}#balance-compra-content .bc-improvement>div:last-child>strong{font-size:30px}#balance-compra-content .bc-loss{background:#df565618;color:#ff9292;border-color:#df5656}#balance-compra-content .bc-cost-title{margin:26px 0 14px}#balance-compra-content .bc-costs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}#balance-compra-content .bc-costs .bc-amount{padding:18px;background:var(--bg3);border-radius:12px;border-top:3px solid var(--blue,#6f9fea)}#balance-compra-content .bc-costs .bc-amount>strong{font-size:23px}#balance-compra-content .bc-footnote{font-size:12px;line-height:1.6;color:var(--text3);margin-bottom:0}@media(max-width:650px){#balance-compra-content .bc-comparison,#balance-compra-content .bc-costs,#balance-compra-content .bc-improvement{grid-template-columns:1fr}#balance-compra-content .bc-card{padding:16px}}#page-balancecompra .btn-primary{background:var(--green-bg);color:var(--green);border:1px solid var(--green);box-shadow:none}#page-balancecompra .btn-primary:hover{filter:brightness(1.15)}#page-balancecompra .btn:focus-visible{outline:2px solid var(--blue);outline-offset:3px}#balance-compra-content .bc-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 18px;border-left:3px solid var(--blue)}#balance-compra-content .bc-toolbar h2{font-size:17px;margin:0 0 6px}#balance-compra-content .bc-toolbar p{margin:4px 0;font-size:12px;color:var(--text3)}#balance-compra-content .bc-toolbar-actions{display:flex;gap:8px;flex-wrap:wrap}#balance-compra-content .bc-toolbar-actions .btn{font-size:12px;padding:8px 12px}#balance-compra-content .bc-toolbar-actions .bc-joint{background:var(--blue-bg,var(--bg3));color:var(--blue);border-color:var(--blue)}#balance-compra-content .bc-card{padding:14px}#balance-compra-content .bc-head{gap:8px}#balance-compra-content .bc-head h2{font-size:16px;margin:0 0 3px;overflow-wrap:anywhere}#balance-compra-content .bc-head span{font-size:11px;color:var(--text3)}#balance-compra-content .bc-head .btn{padding:7px 11px;font-size:12px}#balance-compra-content .bc-alert{padding:6px 10px;margin:9px 0;font-size:11px}#balance-compra-content .bc-meta{margin:7px 0;font-size:11px}#balance-compra-content .bc-comparison{gap:10px}#balance-compra-content .bc-comparison section{padding:10px 12px;border-radius:9px}#balance-compra-content .bc-comparison h3{font-size:13px}#balance-compra-content .bc-comparison p{font-size:11px;margin:3px 0 8px}#balance-compra-content .bc-amount{gap:2px}#balance-compra-content .bc-amount>span{font-size:11px}#balance-compra-content .bc-amount>strong{font-size:20px}#balance-compra-content .bc-amount>small,#balance-compra-content .bc-comparison section>small{font-size:10px}#balance-compra-content .bc-margin{margin:7px 0;font-size:11px}#balance-compra-content .bc-margin strong{font-size:16px}#balance-compra-content .bc-improvement{padding:9px 12px;gap:10px;margin-top:9px;border-radius:9px}#balance-compra-content .bc-improvement>div:last-child{gap:2px;font-size:11px}#balance-compra-content .bc-improvement>div:last-child>strong{font-size:18px}#balance-compra-content .bc-cost-title{margin:11px 0 7px;font-size:13px}#balance-compra-content .bc-costs{gap:8px}#balance-compra-content .bc-costs .bc-amount{padding:8px 10px;border-radius:8px;border-top-width:2px}#balance-compra-content .bc-costs .bc-amount>strong{font-size:16px}#balance-compra-content .bc-footnote{font-size:10px;line-height:1.4;margin:8px 0 0}#exterior-user-lists{padding:16px 18px;border-left:3px solid var(--green)}#exterior-user-lists .card-head{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px}#exterior-user-lists .card-title{font-size:15px;text-transform:none;letter-spacing:0;font-weight:700;color:var(--text);margin-right:auto}#exterior-user-lists>p{margin:5px 0 10px;line-height:1.4}@media(max-width:650px){#balance-compra-content .bc-toolbar-actions{width:100%}#balance-compra-content .bc-toolbar-actions .btn{flex:1}#balance-compra-content .bc-amount>strong{font-size:18px}}</style><div class="card bc-toolbar"><div><h2>Compras · preparar y seguir</h2><p>'+active+' activas · '+(lists.length-active)+' finalizadas · '+lists.filter(function(l){return !!l.simuladorParaguay;}).length+' con simulación</p><p>Cada pedido reúne productos y gastos, conservando su destino.</p></div><div class="bc-toolbar-actions"><button class="btn btn-primary bc-joint" onclick="ocNuevaCompraConjunta()"><i class="ti ti-files" aria-hidden="true"></i> Reunir ventas</button><button class="btn btn-primary" onclick="ocNuevaCompraStock()"><i class="ti ti-plus" aria-hidden="true"></i> Compra para stock</button></div></div><div style="display:grid;grid-template-columns:minmax(0,1fr);gap:18px">'+(lists.length?lists.map(function(list){
      var section=balanceFinalizado(list)?'Finalizadas':'Activas sin finalizar';
      var header=section!==lastSection?'<h3 style="grid-column:1/-1;margin:10px 0 0">'+section+'</h3>':'';lastSection=section;
      var m=balanceIndicadores(list), pct=function(v){return v===null?'—':v.toLocaleString('es-AR',{maximumFractionDigits:2})+'%';};
      var equivalent=function(value){return (m.usd?'USD '+(value/m.usd).toLocaleString('es-AR',{maximumFractionDigits:2}):'USD —')+' · '+(m.usdt?(value/m.usdt).toLocaleString('es-AR',{maximumFractionDigits:2})+' USDT':'USDT —');};
      var amount=function(label,value){return '<div class="bc-amount"><span>'+label+'</span><strong>'+money(value)+'</strong><small>'+equivalent(value)+'</small></div>';};
      var content=m?'<div class="bc-alert">'+(m.stale?'Selección modificada: recalculá para actualizar esta comparación.':m.incomplete?'Estimación incompleta: faltan gastos. La mejora es provisional.':'Simulación guardada · importes estimados')+'</div><div class="bc-meta">Venta sin IVA: <strong>'+money(m.revenue)+'</strong> · '+(m.applied?'Modalidad elegida: ':'Alternativa comparada: ')+(m.chosen==='remote'?'Envío':'Viaje')+'</div><div class="bc-comparison"><section class="bc-before"><h3>Situación actual</h3><p>Base guardada de la venta / presupuesto</p>'+amount('Ganancia actual estimada',m.currentProfit)+'<div class="bc-margin">Margen <strong>'+pct(m.currentMargin)+'</strong></div><small>Costo total actual: '+money(m.baseline)+'</small></section><section class="bc-after"><h3>Con compra en exterior</h3><p>Mismo importe de venta</p>'+amount('Ganancia proyectada',m.projectedProfit)+'<div class="bc-margin">Margen <strong>'+pct(m.margin)+'</strong></div><small>Costo total proyectado: '+money(m.retained+m.total)+'</small></section></div><div class="bc-improvement '+(m.saving<0?'bc-loss':'')+'">'+amount(m.saving>=0?'Mejora de ganancia estimada':'Disminución de ganancia estimada',m.saving)+'<div><strong>'+pct(m.points)+'</strong><span>del importe de venta sin IVA</span><small>Variación de margen: '+(m.points===null?'—':m.points.toLocaleString('es-AR',{maximumFractionDigits:2}))+' puntos porcentuales</small></div></div><h3 class="bc-cost-title">Cómo se compone el costo proyectado</h3><div class="bc-costs">'+amount('Productos del exterior¹',m.products)+amount('Gastos operativos y cambio¹',m.operating)+amount('Otros costos que se conservan',m.retained)+'</div><p class="bc-footnote">¹ Productos valuados al dólar de referencia. Operativos incluye logística, seguro, traslado y diferencia cambiaria / valoración USDT. Los costos conservados corresponden al resto de la venta. Ganancia antes de comisiones y gastos no incluidos.</p>':'<p>Sin simulación guardada. Completá los costos para comparar ganancia y margen.</p>';
      return header+'<article class="card bc-card"><div class="bc-head"><div><h2>'+esc(balancePurchaseTitle(list))+'</h2><span>'+esc(list.numero)+' · '+esc(list.estado||'preparacion')+'</span></div><button class="btn btn-primary" onclick="abrirBalanceCompra(\''+attr(list.fbKey)+'\')">Abrir balance →</button></div>'+content+'</article>';

    }).join(''):'<p>No hay listas de compra con origen exterior aplicado. Las compras locales quedan fuera de este balance por ahora.</p>')+'</div>';
    collapseExteriorSections(target,opened,active,lists.length-active);
  }

  function jointEligible(list){return list&&!list.compraConjuntaId&&list.origen!=='conjunta'&&!list.stockExistenteReservado&&list.ventaFbKey&&!materialListLocked(list)&&!balanceFinalizado(list);}
  function jointSaleFingerprint(sale){return JSON.stringify({items:sale&&sale.items||[],total:sale&&sale.total||0,descuento:sale&&sale.descuento||0});}
  window.ocNuevaCompraConjunta=function(){
    if(!window.permisoModulo||!window.permisoModulo('balancecompra'))return;
    var candidates=state.lists.filter(function(l){return jointEligible(l)&&balanceTieneCompraExterior(l);}),modal=ensureModal('oc-joint','900px'),body=document.getElementById('oc-joint-body');
    document.getElementById('oc-joint-title').textContent='Una compra · varias ventas';
    body.innerHTML='<p>Elegí qué ventas vas a comprar juntas. Podés sumar extras para stock dentro de la compra.</p><p>Los precios negociados se conservan. Los gastos del viaje o envío se cargan una sola vez en la compra conjunta.</p>'+candidates.map(function(l,i){return '<label style="display:flex;align-items:center;gap:14px;padding:16px;border-bottom:1px solid var(--border)"><input type="checkbox" data-joint="'+i+'"><span><strong>'+esc(l.ventaId)+' · '+esc(l.cliente)+'</strong><br><small>'+esc(l.numero)+' · '+(l.items||[]).filter(function(x){return x.incluir&&x.cantidadComprar>0;}).length+' productos pendientes</small></span></label>';}).join('')+'<p role="status" data-joint-status></p><button class="btn btn-primary" data-joint-create>Preparar compra conjunta</button>';
    modal.style.display='flex';
    body.querySelector('[data-joint-create]').onclick=async function(){var button=this;button.disabled=true;try{var ids=Array.from(body.querySelectorAll('[data-joint]:checked')).map(function(el){return candidates[Number(el.dataset.joint)].fbKey;});if(ids.length<2)throw Error('Elegí al menos dos ventas para reunir.');var key='CJ_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),error='';
      var claim=await window.fbRunTransaction(window.fbRef(window.fbDB,PATH_LISTS),function(all){if(!all)return;var selected=ids.map(function(id){return all[id];});if(selected.some(function(l){return !jointEligible(l);})||new Set(selected.map(function(l){return l&&l.ventaFbKey;})).size!==selected.length){error='Una venta ya fue agrupada o tiene órdenes. Reabrí la selección.';return;}
        var sources=[],items=[],savedRows=[],extras=[],documents={};selected.forEach(function(l,index){var id=ids[index],sale=saleRef(l.ventaFbKey)||{};syncListItemsWithSale(l,sale);var source={listId:id,ventaId:l.ventaId||'',ventaFbKey:l.ventaFbKey,cliente:l.cliente||'',revenue:Number(window._rentIngresoNetoVenta(sale))||0,baseline:Number(window._rentCostoVenta(sale))||0,saleFingerprint:jointSaleFingerprint(sale)};sources.push(source);
          (l.items||[]).forEach(function(item){var copy=JSON.parse(JSON.stringify(item)),oldKey=[item.productoKey||item.codigo,item.linea,item.proveedorKey||item.proveedor].join('|');copy.linea=id+':'+item.linea;copy.sourceListId=id;copy.saleLabel=source.ventaId+' · '+source.cliente;items.push(copy);var saved=(l.simuladorParaguay&&l.simuladorParaguay.rows||[]).find(function(r){return r.key===oldKey;});if(saved)savedRows.push(Object.assign({},saved,{key:[copy.productoKey||copy.codigo,copy.linea,copy.proveedorKey||copy.proveedor].join('|'),sourceListId:id,saleLabel:copy.saleLabel}));});
          extras=extras.concat(l.simuladorParaguay&&l.simuladorParaguay.extras||[]);Object.assign(documents,l.comprobantesCompra||{});
        });
        all[key]={numero:key,origen:'conjunta',cliente:sources.length+' ventas',estado:'preparacion',sources:sources,items:items,ordenesIds:[],fecha:today(),ts:Date.now(),usuario:window.currentUser||'Sistema',comprobantesCompra:documents,simuladorParaguay:{version:5,rows:savedRows,extras:extras,parameters:{revenue:sources.reduce(function(a,x){return a+x.revenue;},0),baseline:sources.reduce(function(a,x){return a+x.baseline;},0),retained:''},complete:false}};
        ids.forEach(function(id){all[id].compraConjuntaId=key;});return all;
      });if(!claim.committed)throw Error(error||'No se pudo reunir las ventas.');var all=claim.snapshot.val();ids.forEach(function(id){var l=state.lists.find(function(x){return x.fbKey===id;});if(l)l.compraConjuntaId=key;});var joint=Object.assign({fbKey:key},all[key]);if(!state.lists.some(function(l){return l.fbKey===key;}))state.lists.push(joint);modal.style.display='none';renderBalanceCompra();await openMaterialList(joint);
    }catch(e){body.querySelector('[data-joint-status]').textContent=e.message;}finally{button.disabled=false;}};
  };
  async function ungroupJointPurchase(list){
    if(!window.permisoModulo('balancecompra'))throw Error('Sin permiso');
    var claim=await window.fbRunTransaction(window.fbRef(window.fbDB,PATH_LISTS),function(all){var joint=all&&all[list.fbKey];if(!joint||materialListLocked(joint)||joint.desagrupada)return;(joint.sources||[]).forEach(function(source){var child=all[source.listId];if(child&&child.compraConjuntaId===list.fbKey){delete child.compraConjuntaId;var rows=joint.simuladorParaguay&&joint.simuladorParaguay.rows||[];child.simuladorParaguay=child.simuladorParaguay||{};child.simuladorParaguay.rows=rows.filter(function(r){return r.sourceListId===source.listId;}).map(function(r){var copy=Object.assign({},r);copy.key=copy.key.replace('|'+source.listId+':','|');delete copy.sourceListId;delete copy.saleLabel;delete copy.expenseExcluded;return copy;});delete child.simuladorParaguay.result;child.simuladorParaguay.complete=false;child.simuladorParaguay.extras=[];}});var extras=joint.simuladorParaguay&&joint.simuladorParaguay.extras||[];if(extras.length)all[list.fbKey+'_stock']={numero:joint.numero+'-ST',origen:'stock_paraguay',cliente:'Stock general',estado:'preparacion',items:[],ordenesIds:[],fecha:today(),ts:Date.now(),simuladorParaguay:{extras:extras,rows:[],complete:false}};joint.estado='cancelada';joint.desagrupada=true;return all;});
    if(!claim.committed)throw Error('Ya tiene órdenes: no se puede separar.');var all=claim.snapshot.val();if(all[list.fbKey+'_stock']&&!state.lists.some(function(l){return l.fbKey===list.fbKey+'_stock';}))state.lists.push(Object.assign({fbKey:list.fbKey+'_stock'},all[list.fbKey+'_stock']));state.lists.forEach(function(l){if(all[l.fbKey])Object.assign(l,all[l.fbKey]);if((list.sources||[]).some(function(x){return x.listId===l.fbKey;}))delete l.compraConjuntaId;});renderBalanceCompra();
  }

  window.ocNuevaCompraStock=async function(){if(!window.permisoModulo||!window.permisoModulo('balancecompra'))return;var list={numero:'ST-'+Date.now().toString().slice(-8),origen:'stock_paraguay',cliente:'Stock general',estado:'preparacion',items:[],ordenesIds:[],fecha:today(),ts:Date.now(),usuario:window.currentUser||'Sistema'};var ref=await push(PATH_LISTS,list);list.fbKey=ref.key;if(!state.lists.some(x=>x.fbKey===list.fbKey))state.lists.push(list);renderBalanceCompra();await openMaterialList(list);};
  window.renderBalanceCompra=renderBalanceCompra;
  window.abrirBalanceCompra=async function(key){
    if(!window.permisoModulo || !window.permisoModulo('balancecompra'))return;
    await openMaterialList(key);
    if(state.activeList && state.activeList.fbKey===key && !document.getElementById('py-planner')) await window.ocAbrirSimuladorParaguay();
  };

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
    document.getElementById('oc-order-modal-title').innerHTML = '<i class="ti ti-shopping-cart" style="margin-right:7px"></i>' + esc(order.numero || 'Orden') + ' · ' + esc(orderProviderSummary(order));
    var body = document.getElementById('oc-order-modal-body');
    var editableReceipt = order.estado !== 'recibida' && order.estado !== 'cancelada';
    var hasReceipts = (order.items || []).some(function (item) { return (parseFloat(item.cantidadRecibida) || 0) > 0; });
    var editableReconciliation = hasReceipts && order.estado !== 'cancelada';
    var editableOrder = !hasReceipts && order.estado !== 'recibida' && order.estado !== 'cancelada';
    body.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + statusBadge(order.estado) + (order.ventaId ? '<span class="badge b-blue">Destino: ' + esc(order.ventaId) + ' · ' + esc(order.cliente || '') + '</span>' : '<span class="badge b-green">Destino: stock general</span>') + '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:10px">En cada material indicá el proveedor efectivo, el costo real y la cantidad recibida. La diferencia se calcula mientras escribís.</div>' +
      '<div class="table-wrap"><table id="oc-order-items-table" data-sv-column-key="ordenes:detalle-conciliacion"><thead><tr><th>Material</th><th class="tr">Ordenado</th><th class="tr">Recibido</th><th class="tr">Pendiente</th><th>Proveedor real</th><th class="tr">Compra presup.</th><th class="tr">Compra real</th><th class="tr">Resultado</th>' + (editableReceipt ? '<th class="tr">Recibir ahora</th>' : '') + '</tr></thead><tbody>' +
      (order.items || []).map(function (item, index) {
        var product = findProduct(item);
        var thumbnail = productThumbnail(item, product);
        var ordered = parseFloat(item.cantidadOrdenada || item.cantidad) || 0;
        var received = parseFloat(item.cantidadRecibida) || 0;
        var pending = Math.max(0, ordered - received);
        var budgetUnit = parseFloat(item.costoUnitarioPresupuestado || item.costoUnitario) || 0;
        var actualUnit = parseFloat(item.ultimoCostoReal || item.costoUnitarioReal) || 0;
        var itemProviderKey = item.proveedorFinalKey || order.proveedorFinalKey || order.proveedorKey || '';
        var itemProviderName = item.proveedorFinal || order.proveedorFinal || order.proveedor || '';
        var providerCell = (editableReceipt || editableReconciliation) ? '<select class="search-input oc-item-provider" style="min-width:170px"><option value="">— Elegir proveedor —</option>' + providerSelectOptions(itemProviderKey, itemProviderName) + '</select>' : esc(itemProviderName || 'Sin informar');
        var purchaseUrl = safeProviderUrl(item.proveedorUrl);
        return '<tr data-order-index="' + index + '" data-budget-unit="' + budgetUnit + '"><td><div style="display:flex;align-items:center;gap:10px;min-width:0">' + thumbnail + '<div style="min-width:0"><strong>' + esc(item.codigo || '') + '</strong><div style="font-size:12px">' + esc(item.descripcion || '') + '</div>' + (purchaseUrl ? '<a href="' + attr(purchaseUrl) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:4px;font-size:11px;color:var(--blue)"><i class="ti ti-external-link"></i> Abrir link de compra</a>' : '') + '</div></div></td><td class="tr">' + ordered + '</td><td class="tr" style="color:var(--green)">' + received + '</td><td class="tr" style="color:var(--amber)">' + pending + '</td><td>' + providerCell + '</td><td class="tr">' + money(budgetUnit) + '<small style="display:block;color:var(--text3)">por unidad</small></td><td class="tr">' + ((editableReceipt || editableReconciliation) ? '<input class="search-input oc-real-cost" type="number" min="0" step="0.01" value="' + (actualUnit || budgetUnit) + '" oninput="ocActualizarResultadoCompra(this)" style="width:110px;text-align:right">' : (actualUnit ? money(actualUnit) : '—')) + '</td><td class="tr oc-purchase-difference">' + purchaseDifferenceLabel(budgetUnit, actualUnit) + '</td>' + (editableReceipt ? '<td class="tr"><input class="search-input oc-receive-now" type="number" min="0" max="' + pending + '" value="0" style="width:82px;text-align:right"></td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:14px;flex-wrap:wrap"><div><strong>Total: ' + money(order.total || order.monto) + '</strong><div style="font-size:11px;color:var(--text3)">Los materiales recibidos para una venta quedan reservados; los manuales ingresan al stock general operativo.</div></div><div style="display:flex;gap:7px;flex-wrap:wrap">' +
        (hasReceipts ? '<button class="btn" onclick="ocImprimirOrdenActual()"><i class="ti ti-file-description"></i> Ver comprobante</button>' : '') +
        (editableReconciliation ? '<button class="btn btn-primary" onclick="ocGuardarConciliacionActual()"><i class="ti ti-device-floppy"></i> Guardar cambios</button>' : '') +
        (editableOrder ? '<button class="btn" onclick="ocEditarOrdenActual()"><i class="ti ti-edit"></i> Editar</button>' : '') +
        (order.cancelacionPendiente ? '<button class="btn" onclick="ocCambiarEstadoOrden(\'cancelada\')">Reintentar cancelación pendiente</button>' : '') +
        (order.estado === 'borrador' ? '<button class="btn" onclick="ocCambiarEstadoOrden(\'enviada\')"><i class="ti ti-send"></i> Marcar enviada</button>' : '') +
        (editableReceipt ? '<button class="btn btn-primary" onclick="ocRegistrarRecepcion()"><i class="ti ti-package-import"></i> Registrar recepción</button>' : '') +
        (order.estado !== 'cancelada' && order.estado !== 'recibida' ? '<button class="btn" style="color:var(--red)" onclick="ocCambiarEstadoOrden(\'cancelada\')">Cancelar</button>' : '') +
        '<button class="btn" style="color:var(--red)" onclick="ocEliminarOrdenActual()"><i class="ti ti-trash"></i> Eliminar</button>' +
      '</div></div>';
    modal.style.display = 'flex';
    setTimeout(function () {
      if (window.SisVentas && typeof window.SisVentas.prepareResizablePage === 'function') window.SisVentas.prepareResizablePage(modal);
    }, 0);
  }

  async function changeOrderStatus(status) {
    var order=state.activeOrder;if(!order||!order.fbKey)return;
    if(status==='cancelada'&&!await window.svConfirm('¿Cancelar cantidades pendientes? Lo ya recibido conserva su destino.'))return;
    var claim=await window.fbRunTransaction(window.fbRef(window.fbDB,PATH_ORDERS+'/'+order.fbKey),function(current){if(!current||current.generacionPendiente||current.recepcionPendiente)return;if(current.estado==='recibida')return;if(current.estado==='cancelada'&&status!=='cancelada')return;current.estado=status;if(status==='cancelada')current.cancelacionPendiente=true;current.actualizadoEn=Date.now();return current;});
    if(!claim.committed){window.notify('La orden cambió o tiene una recepción pendiente. Reabrila para continuar.');return;}
    var current=claim.snapshot.val();if(status==='cancelada'){var grouped={};(current.items||[]).forEach(function(item){var key=item.productoKey||item.codigo;grouped[key]=(grouped[key]||0)+Math.max(0,Number(item.cantidadOrdenada||item.cantidad)-Number(item.cantidadRecibida||0));});for(var key of Object.keys(grouped)){await transactionInventory(key,function(inv){inv.operaciones=inv.operaciones||{};var op='cancel_'+order.fbKey;if(inv.operaciones[op])return;inv.enCompra=Math.max(0,Number(inv.enCompra||0)-grouped[key]);inv.operaciones[op]=Date.now();});}}
    if(status==='cancelada')await update(PATH_ORDERS+'/'+order.fbKey,{cancelacionPendiente:null});
    document.getElementById('oc-order-modal').style.display='none';window.notify('Orden actualizada');
  }

  function syncSalePurchaseCosts(order, movements, complete) {
    if (!order.ventaFbKey || !window.fbDB || typeof window.fbRunTransaction !== 'function') return Promise.resolve();
    return window.fbRunTransaction(window.fbRef(window.fbDB, 'sisventas/ventas/' + order.ventaFbKey), function (sale) {
      if (!sale) return sale;
      if(order.receiptOperation){sale.recepcionesAplicadas=sale.recepcionesAplicadas||{};if(sale.recepcionesAplicadas[order.receiptOperation])return sale;sale.recepcionesAplicadas[order.receiptOperation]=Date.now();}
      var items = Array.isArray(sale.items) ? sale.items : [];
      movements.forEach(function (movement) {
        var orderItem = movement.item || {};
        var code = String(orderItem.codigo || '').trim().toUpperCase();
        var saleItem = items.find(function (item) {
          var sameKey = orderItem.productoKey && [item.productoKey, item.productoId, item.pid, item.fbKeyProducto].some(function (key) { return String(key || '') === String(orderItem.productoKey); });
          return sameKey || (code && String(item.cod || item.codigo || '').trim().toUpperCase() === code);
        });
        if (!saleItem) return;
        var saleQty = Math.max(1, parseFloat(saleItem.qty || saleItem.cantidad) || 1);
        var budgetUnit = parseFloat(saleItem.costoUnitarioPresupuestado || saleItem.costoUnitarioCompra || saleItem.costoUnitario || saleItem.costoCompra) || parseFloat(orderItem.costoUnitarioPresupuestado || orderItem.costoUnitario) || 0;
        var priorRealQty = parseFloat(saleItem.cantidadCompraReal) || 0;
        var priorRealTotal = parseFloat(saleItem.costoRealCompraAcumulado) || 0;
        var realQty = Math.min(saleQty, priorRealQty + movement.qty);
        var acceptedQty = Math.max(0, realQty - priorRealQty);
        var realTotal = priorRealTotal + acceptedQty * movement.costoUnitarioReal;
        var effectiveTotal = realTotal + Math.max(0, saleQty - realQty) * budgetUnit;
        saleItem.costoUnitarioPresupuestado = budgetUnit;
        saleItem.costoTotalPresupuestado = saleQty * budgetUnit;
        saleItem.cantidadCompraReal = realQty;
        saleItem.costoRealCompraAcumulado = realTotal;
        saleItem.costoTotalCompra = Math.round(effectiveTotal * 100) / 100;
        saleItem.costoUnitarioCompra = Math.round((effectiveTotal / saleQty) * 100) / 100;
        saleItem.ultimoCostoCompraReal = movement.costoUnitarioReal;
        saleItem.proveedorCompraReal = movement.proveedor;
        saleItem.proveedorCompraRealKey = movement.proveedorKey;
      });
      sale.items = items;
      sale.costoTotal = items.reduce(function (sum, item) {
        var qty = parseFloat(item.qty || item.cantidad) || 1;
        return sum + (parseFloat(item.costoTotalCompra) || (parseFloat(item.costoUnitarioCompra) || 0) * qty);
      }, 0);
      var base = parseFloat(sale.subtotal) || parseFloat(sale.total) || 0;
      sale.margenPct = base > 0 ? ((base - sale.costoTotal) / base) * 100 : 0;
      sale.compraEstado = complete ? 'recibida_parcial_o_total' : 'recepcion_parcial';
      sale.conciliacionCompraActualizadaEn = Date.now();
      sale.conciliacionCompraActualizadaPor = window.currentUser || 'Sistema';
      return sale;
    });
  }

  function saveActiveReconciliation() {
    var order = state.activeOrder;
    if (!order || !order.fbKey) return;
    if(order.recepcionPendiente){finishReceipt(order,[]).catch(function(e){window.notify(e.message);});return;}
    var rows = Array.from(document.querySelectorAll('#oc-order-modal-body tr[data-order-index]'));
    var items = JSON.parse(JSON.stringify(order.items || []));
    var invalid = false;
    rows.forEach(function (row) {
      var index = parseInt(row.dataset.orderIndex, 10);
      var item = items[index];
      if (!item || !(parseFloat(item.cantidadRecibida) > 0)) return;
      var provider = row.querySelector('.oc-item-provider');
      var option = provider && provider.options[provider.selectedIndex];
      var cost = parseFloat((row.querySelector('.oc-real-cost') || {}).value) || 0;
      if (!provider || !provider.value || !(cost > 0)) { invalid = true; return; }
      var qty = parseFloat(item.cantidadCostoReal || item.cantidadRecibida) || 0;
      item.proveedorFinalKey = provider.value;
      item.proveedorFinal = String((option && (option.dataset.name || option.textContent)) || '').trim();
      item.ultimoCostoReal = cost;
      item.costoUnitarioReal = cost;
      item.costoRealAcumulado = Math.round(qty * cost * 100) / 100;
    });
    if (invalid) { if (typeof window.notify === 'function') window.notify('Completá proveedor y costo real en todos los materiales recibidos'); return; }
    var totalReal = items.reduce(function (sum, item) { return sum + (parseFloat(item.costoRealAcumulado) || 0); }, 0);
    var totalBudget = items.reduce(function (sum, item) { return sum + (parseFloat(item.cantidadCostoReal || item.cantidadRecibida) || 0) * (parseFloat(item.costoUnitarioPresupuestado || item.costoUnitario) || 0); }, 0);
    var providers = Array.from(new Set(items.map(function (item) { return item.proveedorFinal; }).filter(Boolean)));
    var providerSummary = providers.length === 1 ? providers[0] : (providers.length > 1 ? 'Varios proveedores' : String(order.proveedor || 'Sin proveedor'));
    update(PATH_ORDERS + '/' + order.fbKey, {
      items: items,
      proveedoresFinales: providers,
      proveedorFinalResumen: providerSummary,
      totalRealRecibido: totalReal,
      totalPresupuestadoRecibido: totalBudget,
      diferenciaCompra: totalBudget - totalReal,
      conciliacionEditadaEn: Date.now(),
      conciliacionEditadaPor: window.currentUser || 'Sistema'
    }).then(function () {
      if (!order.ventaFbKey || !window.fbRunTransaction) return null;
      return window.fbRunTransaction(window.fbRef(window.fbDB, 'sisventas/ventas/' + order.ventaFbKey), function (sale) {
        if (!sale) return sale;
        (sale.items || []).forEach(function (saleItem) {
          var code = String(saleItem.cod || saleItem.codigo || '').trim().toUpperCase();
          var source = items.find(function (item) { return (item.productoKey && [saleItem.productoKey, saleItem.productoId, saleItem.pid, saleItem.fbKeyProducto].some(function (key) { return String(key || '') === String(item.productoKey); })) || (code && code === String(item.codigo || '').trim().toUpperCase()); });
          if (!source || !(parseFloat(source.cantidadRecibida) > 0)) return;
          var qty = Math.max(1, parseFloat(saleItem.qty || saleItem.cantidad) || 1);
          var received = Math.min(qty, parseFloat(source.cantidadCostoReal || source.cantidadRecibida) || 0);
          var budget = parseFloat(source.costoUnitarioPresupuestado || source.costoUnitario) || 0;
          var actual = parseFloat(source.costoUnitarioReal || source.ultimoCostoReal) || budget;
          saleItem.cantidadCompraReal = received;
          saleItem.costoRealCompraAcumulado = received * actual;
          saleItem.costoTotalCompra = received * actual + Math.max(0, qty - received) * budget;
          saleItem.costoUnitarioCompra = saleItem.costoTotalCompra / qty;
          saleItem.ultimoCostoCompraReal = actual;
          saleItem.proveedorCompraReal = source.proveedorFinal || '';
          saleItem.proveedorCompraRealKey = source.proveedorFinalKey || '';
        });
        sale.costoTotal = (sale.items || []).reduce(function (sum, item) { var qty = parseFloat(item.qty || item.cantidad) || 1; return sum + (parseFloat(item.costoTotalCompra) || (parseFloat(item.costoUnitarioCompra) || 0) * qty); }, 0);
        var base = parseFloat(sale.subtotal) || parseFloat(sale.total) || 0;
        sale.margenPct = base > 0 ? ((base - sale.costoTotal) / base) * 100 : 0;
        sale.conciliacionCompraActualizadaEn = Date.now();
        sale.conciliacionCompraActualizadaPor = window.currentUser || 'Sistema';
        return sale;
      });
    }).then(function () {
      if (typeof window.notify === 'function') window.notify('Conciliación actualizada');
      var detail = document.getElementById('oc-order-modal');
      if (detail) detail.style.display = 'none';
    }).catch(function (error) {
      if (typeof window.notify === 'function') window.notify('No se pudo actualizar la conciliación: ' + error.message);
    });
  }

  function printActiveOrder() {
    var order = state.activeOrder;
    if (!order) return;
    var hasReconciliation = (order.items || []).some(function (item) { return (parseFloat(item.cantidadCostoReal) || 0) > 0; });
    if (!hasReconciliation) { if (typeof window.notify === 'function') window.notify('Primero registrá la conciliación de la compra'); return; }
    var rows = (order.items || []).map(function (item) {
      var qty = parseFloat(item.cantidadCostoReal || item.cantidadRecibida) || 0;
      var budgetUnit = parseFloat(item.costoUnitarioPresupuestado || item.costoUnitario) || 0;
      var realUnit = parseFloat(item.costoUnitarioReal || item.ultimoCostoReal) || 0;
      return '<tr><td><strong>' + esc(item.codigo || '—') + '</strong></td><td>' + esc(item.descripcion || '') + '</td><td>' + esc(item.proveedorFinal || 'Sin informar') + '</td><td class="num">' + qty + '</td><td class="num">' + money(budgetUnit) + '</td><td class="num">' + money(realUnit) + '</td><td class="num"><strong>' + money(qty * realUnit) + '</strong></td><td class="num">' + purchaseDifferenceLabel(budgetUnit * qty, realUnit * qty) + '</td></tr>';
    }).join('');
    var logoUrl = typeof window.logoImpresionActualUrl === 'function' ? window.logoImpresionActualUrl() : '';
    var logo = logoUrl ? '<img src="' + attr(logoUrl) + '" alt="Nixa">' : '<strong class="brand">NIXA</strong>';
    var fileName = String(order.numero || 'orden-compra').replace(/[^a-z0-9_-]+/gi, '-') + '-conciliacion.pdf';
    var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(order.numero || 'Orden de compra') + '</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#202938;margin:0;background:#eef2f7}.sheet{width:794px;min-height:1123px;margin:24px auto;padding:32px;background:#fff;box-shadow:0 8px 28px rgba(15,23,42,.14)}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #202938;padding-bottom:18px;margin-bottom:24px}header img{max-width:150px;max-height:70px;object-fit:contain}.brand{font-size:26px}.doc{text-align:right}.doc h1{font-size:22px;margin:0 0 5px}.meta{display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:22px}.box{border:1px solid #d7dde7;border-radius:8px;padding:12px}.box small{display:block;color:#708097;text-transform:uppercase;font-size:10px;margin-bottom:5px}table{width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed}th{background:#202938;color:#fff;text-align:left;padding:8px 6px}td{padding:9px 6px;border-bottom:1px solid #e3e7ee;overflow-wrap:anywhere}.num{text-align:right}.total{text-align:right;margin-top:16px;font-size:14px}.foot{margin-top:44px;border-top:1px solid #d7dde7;padding-top:10px;color:#708097;font-size:10px}.actions{position:sticky;bottom:0;display:flex;justify-content:center;gap:8px;padding:14px;background:rgba(238,242,247,.96)}button{border:0;border-radius:7px;padding:9px 16px;color:#fff;font-weight:600;cursor:pointer}.print{background:#1e293b}.download{background:#2563eb}.share{background:#16a34a}@media(max-width:840px){.sheet{margin:0;box-shadow:none;transform-origin:top left}}@media print{@page{size:A4 portrait;margin:8mm}body{background:#fff}.sheet{width:100%;min-height:0;margin:0;padding:0;box-shadow:none}.actions{display:none}}</style><script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script></head><body><main class="sheet" id="oc-comprobante"><header>' + logo + '<div class="doc"><h1>CONCILIACIÓN DE COMPRA</h1><strong>' + esc(order.numero || '—') + '</strong><div>' + fmtDate(order.fecha) + '</div></div></header><div class="meta"><div class="box"><small>Destino</small><strong>' + esc(order.ventaId ? (order.ventaId + ' · ' + (order.cliente || '')) : 'Stock general') + '</strong></div></div><table><thead><tr><th>Código</th><th style="width:29%">Producto / material</th><th>Proveedor final</th><th class="num">Cantidad</th><th class="num">Presup.</th><th class="num">Real</th><th class="num">Subtotal real</th><th class="num">Resultado</th></tr></thead><tbody>' + rows + '</tbody></table><div class="total">Presupuestado recibido: <strong>' + money(order.totalPresupuestadoRecibido) + '</strong> · Compra real: <strong>' + money(order.totalRealRecibido) + '</strong></div><div class="foot">Comprobante interno de conciliación · Generado por SisVentas</div></main><div class="actions"><button class="print" onclick="window.print()">Imprimir</button><button class="download" onclick="crearPdf(false,this)">Descargar PDF</button><button class="share" onclick="crearPdf(true,this)">Compartir PDF</button></div><script>async function crearPdf(compartir,boton){var original=boton.textContent;try{boton.disabled=true;boton.textContent="Generando PDF...";if(typeof html2pdf!=="function")throw new Error("No se pudo cargar el generador de PDF");var blob=await html2pdf().set({margin:[6,6,6,6],filename:' + JSON.stringify(fileName) + ',image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:"#fff",windowWidth:794},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}}).from(document.getElementById("oc-comprobante")).outputPdf("blob");if(compartir&&navigator.share){var archivo=new File([blob],' + JSON.stringify(fileName) + ',{type:"application/pdf"});if(!navigator.canShare||navigator.canShare({files:[archivo]})){await navigator.share({files:[archivo],title:"Conciliación de compra"});return}}var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=' + JSON.stringify(fileName) + ';a.click();setTimeout(function(){URL.revokeObjectURL(url)},60000)}catch(e){if(e&&e.name!=="AbortError")alert(e.message||e)}finally{boton.disabled=false;boton.textContent=original}}<\/script></body></html>';
    var printWindow = window.open('', '_blank');
    if (!printWindow) { if (typeof window.notify === 'function') window.notify('El navegador bloqueó la ventana de impresión'); return; }
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
  }

  function registerReceipt() {
    var order = state.activeOrder;
    if (!order || !order.fbKey) return;
    if(order.recepcionPendiente){finishReceipt(order,[]).catch(function(e){window.notify(e.message);});return;}
    var rows = Array.from(document.querySelectorAll('#oc-order-modal-body tr[data-order-index]'));
    var movements = [];
    rows.forEach(function (row) {
      var index = parseInt(row.dataset.orderIndex, 10);
      var input = row.querySelector('.oc-receive-now');
      var costInput = row.querySelector('.oc-real-cost');
      var providerSelect = row.querySelector('.oc-item-provider');
      var providerOption = providerSelect && providerSelect.options[providerSelect.selectedIndex];
      var qty = input ? parseFloat(input.value) || 0 : 0;
      var realUnitCost = costInput ? parseFloat(costInput.value) || 0 : 0;
      var providerName = providerOption ? (providerOption.dataset.name || providerOption.textContent || '').trim() : '';
      var providerKey = providerSelect ? providerSelect.value : '';
      var item = order.items[index];
      var ordered = parseFloat(item.cantidadOrdenada || item.cantidad) || 0;
      var pending = Math.max(0, ordered - (parseFloat(item.cantidadRecibida) || 0));
      qty = Math.max(0, Math.min(qty, pending));
      if (qty > 0) movements.push({ index: index, item: item, qty: qty, costoUnitarioReal: realUnitCost, proveedor: providerName, proveedorKey: providerKey });
    });
    if (!movements.length) { if (typeof window.notify === 'function') window.notify('Indicá qué cantidades llegaron'); return; }
    if (movements.some(function (m) { return !m.proveedorKey; })) { if (typeof window.notify === 'function') window.notify('Elegí el proveedor real de cada material recibido'); return; }
    if (movements.some(function (m) { return !(m.costoUnitarioReal > 0); })) { if (typeof window.notify === 'function') window.notify('Indicá el costo unitario real de cada material recibido'); return; }
    finishReceipt(order,movements).catch(function(error){if(typeof window.notify==='function')window.notify('Recepción pendiente: '+error.message+'. Reabrí la orden y presioná Registrar recepción para reintentar sin duplicar stock.');});
  }

  async function finishReceipt(order,movements){
    if(state.receiptBusy)return;state.receiptBusy=true;
    try{
      var token='r_'+Date.now()+'_'+Math.random().toString(36).slice(2),expected=(order.recepciones||[]).length;
      var claim=await window.fbRunTransaction(window.fbRef(window.fbDB,PATH_ORDERS+'/'+order.fbKey),function(current){
        if(!current||current.generacionPendiente||current.estado==='cancelada')return;
        if(current.recepcionPendiente)return current;
        if(current.estado==='recibida'||(current.recepciones||[]).length!==expected||!movements.length)return;
        if(movements.some(function(m){var item=current.items[m.index];return !item||m.qty>Number(item.cantidadOrdenada||item.cantidad)-Number(item.cantidadRecibida||0);}))return;
        current.recepcionPendiente={id:token,fecha:today(),ts:Date.now(),usuario:window.currentUser||'Sistema',movements:movements};return current;
      });
      if(!claim.committed)throw new Error('La orden cambió o su confirmación está pendiente; actualizá el detalle');
      var current=claim.snapshot.val(),pending=current.recepcionPendiente;if(!pending)throw new Error('No hay recepción pendiente');
      var batch=pending.movements,op=pending.id,items=JSON.parse(JSON.stringify(current.items));
      batch.forEach(function(m){var item=items[m.index],prior=Number(item.cantidadCostoReal||item.cantidadRecibida)||0;item.costoUnitarioPresupuestado=Number(item.costoUnitarioPresupuestado||item.costoUnitario)||0;item.cantidadRecibida=Number(item.cantidadRecibida||0)+m.qty;item.cantidadCostoReal=prior+m.qty;item.costoRealAcumulado=Number(item.costoRealAcumulado||0)+m.qty*m.costoUnitarioReal;item.ultimoCostoReal=m.costoUnitarioReal;item.costoUnitarioReal=item.costoRealAcumulado/item.cantidadCostoReal;item.proveedorFinal=m.proveedor;item.proveedorFinalKey=m.proveedorKey;});
      var grouped={};batch.forEach(function(m){var key=m.item.productoKey||m.item.codigo;if(!grouped[key])grouped[key]={qty:0,item:m.item};grouped[key].qty+=m.qty;});
      for(var key of Object.keys(grouped)){var group=grouped[key];await transactionInventory(key,function(inv){inv.operaciones=inv.operaciones||{};if(inv.operaciones[op])return;inv.enCompra=Math.max(0,Number(inv.enCompra||0)-group.qty);inv.codigo=group.item.codigo;inv.descripcion=group.item.descripcion;if(current.ventaId||current.ventaFbKey){inv.reservado=Number(inv.reservado||0)+group.qty;inv.asignaciones=inv.asignaciones||{};var destination=safeKey(current.ventaFbKey||current.ventaId);inv.asignaciones[destination]=inv.asignaciones[destination]||{reservado:0,consumido:0,liberado:0};inv.asignaciones[destination].reservado+=group.qty;inv.asignaciones[destination].ventaId=current.ventaId||'';}else inv.general=Number(inv.general||0)+group.qty;inv.operaciones[op]=pending.ts;});}
      var complete=items.every(function(item){return Number(item.cantidadRecibida)>=Number(item.cantidadOrdenada||item.cantidad);});
      if(current.ventaFbKey)await syncSalePurchaseCosts(Object.assign({},current,{fbKey:order.fbKey,receiptOperation:op}),batch,complete);
      var totalReal=items.reduce(function(a,x){return a+Number(x.costoRealAcumulado||0);},0),budget=items.reduce(function(a,x){return a+Number(x.cantidadCostoReal||0)*Number(x.costoUnitarioPresupuestado||x.costoUnitario||0);},0);
      await window.fbRunTransaction(window.fbRef(window.fbDB,PATH_ORDERS+'/'+order.fbKey),function(latest){if(!latest||!latest.recepcionPendiente||latest.recepcionPendiente.id!==op)return latest;latest.items=items;latest.recepciones=(latest.recepciones||[]).concat([{id:op,fecha:pending.fecha,ts:pending.ts,usuario:pending.usuario,items:batch.map(function(m){return {codigo:m.item.codigo,cantidad:m.qty,proveedor:m.proveedor,proveedorKey:m.proveedorKey,costoUnitarioReal:m.costoUnitarioReal,costoUnitarioPresupuestado:Number(m.item.costoUnitarioPresupuestado||m.item.costoUnitario)||0};})}]);latest.totalRealRecibido=totalReal;latest.totalPresupuestadoRecibido=budget;latest.diferenciaCompra=budget-totalReal;latest.estado=complete?'recibida':'recepcion_parcial';latest.recibidoEn=Date.now();latest.recepcionPendiente=null;return latest;});
      if(complete&&current.listaMaterialesId){var related=state.orders.filter(function(o){return o.listaMaterialesId===current.listaMaterialesId&&o.estado!=='cancelada';});if(related.length&&related.every(function(o){return o.fbKey===order.fbKey||o.estado==='recibida';})){await update(PATH_LISTS+'/'+current.listaMaterialesId,{estado:'recibida',recibidaEn:Date.now()});}}
      document.getElementById('oc-order-modal').style.display='none';if(typeof window.notify==='function')window.notify('Recepción registrada. '+(current.ventaId?'Material reservado para la venta.':'Productos ingresados al stock general.'));
    }finally{state.receiptBusy=false;}
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
      var product = productList().find(function (entry) {
        return String(entry.fbKey || entry.codigo || '') === String(item.productoKey || item.codigo || '') ||
          (!!item.codigo && entry.codigo === item.codigo);
      });
      var imageUrl = (product && product.imagenUrl) || item.imagenUrl || '';
      var imageHtml = imageUrl
        ? '<span style="width:44px;height:44px;flex:0 0 44px;border-radius:9px;overflow:hidden;background:var(--bg3);border:0.5px solid var(--border2);display:grid;place-items:center"><img src="' + attr(imageUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'"><span style="display:none;width:100%;height:100%;place-items:center;color:var(--text3)"><i class="ti ti-photo"></i></span></span>'
        : '<span style="width:44px;height:44px;flex:0 0 44px;border-radius:9px;background:var(--bg3);border:0.5px solid var(--border2);display:grid;place-items:center;color:var(--text3)"><i class="ti ti-photo"></i></span>';
      return '<div style="display:grid;grid-template-columns:minmax(180px,1fr) 82px 126px 36px;gap:9px;align-items:center;padding:10px 4px;border-bottom:0.5px solid var(--border)">' +
        '<div style="min-width:0;display:flex;align-items:center;gap:10px">' + imageHtml + '<span style="min-width:0"><strong style="font-size:12px;color:var(--blue)">' + esc(item.codigo) + '</strong><span style="display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + attr(item.descripcion) + '">' + esc(item.descripcion) + '</span></span></div>' +
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
      var imageHtml = product.imagenUrl
        ? '<span style="width:46px;height:46px;flex:0 0 46px;border-radius:9px;overflow:hidden;background:var(--bg3);border:0.5px solid var(--border2);display:grid;place-items:center"><img src="' + attr(product.imagenUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'"><span style="display:none;width:100%;height:100%;place-items:center;color:var(--text3)"><i class="ti ti-photo"></i></span></span>'
        : '<span style="width:46px;height:46px;flex:0 0 46px;border-radius:9px;background:var(--bg3);border:0.5px solid var(--border2);display:grid;place-items:center;color:var(--text3)"><i class="ti ti-photo"></i></span>';
      return '<button type="button" data-product-key="' + attr(key) + '" onclick="ocSeleccionarProductoManual(\'' + attr(key) + '\')" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:0;border-bottom:0.5px solid var(--border);background:transparent;color:var(--text);text-align:left;cursor:pointer;font-family:inherit">' +
        '<span style="min-width:0;display:flex;align-items:center;gap:10px">' + imageHtml + '<span style="min-width:0"><strong style="font-size:12px;color:var(--blue)">' + esc(product.codigo || 'Sin código') + '</strong><span style="font-size:13px;margin-left:8px">' + esc(product.nombre || product.descripcion || 'Sin nombre') + '</span><small style="display:block;color:var(--text3);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(product.categoria || 'Sin categoría') + (candidate ? ' · ' + esc(candidate.nombre) : '') + '</small></span></span>' +
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
    else state.manualItems.push({ productoKey: product.fbKey || '', codigo: product.codigo || '', descripcion: product.nombre || '', imagenUrl: product.imagenUrl || '', unidad: product.unidad || 'Unidad', cantidadOrdenada: 1, cantidadRecibida: 0, costoUnitario: candidate ? candidate.costo : 0 });
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

  async function deleteActiveOrder() {
    var order = state.activeOrder;
    if (!order || !order.fbKey) return;
    if(order.recepcionPendiente||String(order.fbKey).startsWith('plan_')){window.notify('Esta compra conserva su trazabilidad. Completá la recepción pendiente o cancelá la orden; no se elimina definitivamente.');return;}
    var hasReceipts = (order.items || []).some(function (item) { return (parseFloat(item.cantidadRecibida) || 0) > 0; });
    var warning = hasReceipts
      ? '¿Eliminar definitivamente ' + (order.numero || 'esta orden') + '? Se revertirán sus materiales recibidos, la reserva y la conciliación de costos de la venta.'
      : '¿Eliminar definitivamente ' + (order.numero || 'esta orden') + '? Esta acción no elimina la venta ni los productos.';
    if (!await window.svConfirm(warning)) return;
    var tasks = [];
    if (order.estado !== 'cancelada') {
      (order.items || []).forEach(function (item) {
        var pending = Math.max(0, (parseFloat(item.cantidadOrdenada || item.cantidad) || 0) - (parseFloat(item.cantidadRecibida) || 0));
        var received = parseFloat(item.cantidadRecibida) || 0;
        if (pending || received) tasks.push(transactionInventory(item.productoKey || item.codigo, function (inv) {
          if (pending) inv.enCompra = Math.max(0, (parseFloat(inv.enCompra) || 0) - pending);
          if (received && (order.ventaId || order.ventaFbKey)) {
            inv.reservado = Math.max(0, (parseFloat(inv.reservado) || 0) - received);
            var allocationKey = safeKey(order.ventaFbKey || order.ventaId);
            if (inv.asignaciones && inv.asignaciones[allocationKey]) inv.asignaciones[allocationKey].reservado = Math.max(0, (parseFloat(inv.asignaciones[allocationKey].reservado) || 0) - received);
          } else if (received) inv.general = Math.max(0, (parseFloat(inv.general) || 0) - received);
        }));
      });
    }
    if (hasReceipts && order.ventaFbKey && window.fbRunTransaction) {
      tasks.push(window.fbRunTransaction(window.fbRef(window.fbDB, 'sisventas/ventas/' + order.ventaFbKey), function (sale) {
        if (!sale) return sale;
        (sale.items || []).forEach(function (saleItem) {
          var code = String(saleItem.cod || saleItem.codigo || '').trim().toUpperCase();
          var source = (order.items || []).find(function (item) { return (item.productoKey && [saleItem.productoKey, saleItem.productoId, saleItem.pid, saleItem.fbKeyProducto].some(function (key) { return String(key || '') === String(item.productoKey); })) || (code && code === String(item.codigo || '').trim().toUpperCase()); });
          if (!source) return;
          var qty = Math.max(1, parseFloat(saleItem.qty || saleItem.cantidad) || 1);
          var budget = parseFloat(source.costoUnitarioPresupuestado || source.costoUnitario) || 0;
          saleItem.cantidadCompraReal = 0;
          saleItem.costoRealCompraAcumulado = 0;
          saleItem.costoTotalCompra = qty * budget;
          saleItem.costoUnitarioCompra = budget;
          delete saleItem.ultimoCostoCompraReal;
          delete saleItem.proveedorCompraReal;
          delete saleItem.proveedorCompraRealKey;
        });
        sale.costoTotal = (sale.items || []).reduce(function (sum, item) { var qty = parseFloat(item.qty || item.cantidad) || 1; return sum + (parseFloat(item.costoTotalCompra) || (parseFloat(item.costoUnitarioCompra) || 0) * qty); }, 0);
        var base = parseFloat(sale.subtotal) || parseFloat(sale.total) || 0;
        sale.margenPct = base > 0 ? ((base - sale.costoTotal) / base) * 100 : 0;
        return sale;
      }));
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

  async function migrateLegacy() {
    var pending = state.legacy.filter(function (o) { return !o.migradaA; });
    if (!pending.length || !await window.svConfirm('Se incorporarán ' + pending.length + ' órdenes anteriores al historial unificado. No se duplicarán en el futuro. ¿Continuar?')) return;
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
    state.groupMaterialsByProvider = true;
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
    syncListItemsWithSale: syncListItemsWithSale,
    isPurchasableMaterialItem: isPurchasableMaterialItem,
    materialRowsForDisplay: materialRowsForDisplay,
    purchaseSummaryForProvider: purchaseSummaryForProvider,
    applyRecommendedProviders: applyRecommendedProviders,
    buildMaterialExportRows: buildMaterialExportRows,
    extraMaterialItems: extraMaterialItems,
    buildWhatsAppOrderText: buildWhatsAppOrderText,
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
  window.ocAlternarAgrupacionProveedores = toggleProviderGrouping;
  window.ocExportarListaExcel = exportMaterialListExcel;
  window.ocCopiarPedidoWhatsApp = copyWhatsAppOrder;
  window.ocCopiarPedidoWhatsAppProveedor = copyWhatsAppOrderForItem;
  window.ocAplicarProveedoresRecomendados = applyRecommendedProvidersToCurrentList;
  window.ocGenerarOrdenesDesdeLista = generateOrdersFromList;
  window.ocShowTab = showOrdersTab;
  window.ocAbrirOrden = openOrder;
  window.ocCambiarEstadoOrden = changeOrderStatus;
  window.ocRegistrarRecepcion = registerReceipt;
  window.ocActualizarResultadoCompra = updatePurchaseDifference;
  window.ocImprimirOrdenActual = printActiveOrder;
  window.ocGuardarConciliacionActual = saveActiveReconciliation;
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

  document.addEventListener('sisventas:session-ready', function () {
    if (typeof window.svProgramarTrabajoFondo === 'function') window.svProgramarTrabajoFondo(start, 1800);
    else setTimeout(start, 600);
  });
  document.addEventListener('sisventas:page-changed', function (event) {
    if (event.detail && event.detail.page === 'ordenes') start();
  });
  document.addEventListener('sisventas:session-ended', reset);
})();
