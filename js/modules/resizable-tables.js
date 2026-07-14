/* v1.36.23 — Columnas ajustables optimizadas para página activa */
(function () {
  'use strict';

  var STORAGE_PREFIX = 'sisventas.tableWidth.v2.';
  var STORAGE_PERCENT_PREFIX = 'sisventas.tablePercent.v1.';
  var MIN_WIDTH = 54;
  var MAX_WIDTH = 720;
  var scheduled = false;
  var scheduleTimer = 0;
  var DEFAULT_WIDTH_BY_HEADER = {
    'fecha': 76,
    'descripcion': 170,
    'descripci?n': 170,
    'concepto': 170,
    'cliente': 150,
    'categoria': 98,
    'categor?a': 98,
    'tipo': 86,
    'monto': 96,
    'pagado': 96,
    'vencimiento': 104,
    'estado': 82,
    'pag?': 74,
    'pago': 74,
    'comprobante': 92,
    'usuario': 116
  };

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function pageId(table) {
    var page = table.closest('.page');
    return (page && page.id) || 'global';
  }

  function tableHeaders(table) {
    var headers = Array.from(table.querySelectorAll('thead th')).filter(function (th) {
      return !isHidden(th);
    });
    if (headers.length) return headers;
    var firstRow = table.querySelector('tr');
    return firstRow ? Array.from(firstRow.querySelectorAll('th')).filter(function (th) {
      return !isHidden(th);
    }) : [];
  }

  function tableKey(table) {
    if (table.id) return table.id;
    var tbody = table.querySelector('tbody[id]');
    if (tbody && tbody.id) return pageId(table) + ':tbody:' + tbody.id;
    var thead = table.querySelector('thead[id]');
    if (thead && thead.id) return pageId(table) + ':thead:' + thead.id;
    var headers = tableHeaders(table).map(function (th) {
      return (th.textContent || '').trim().replace(/\s+/g, '-').slice(0, 24);
    }).filter(Boolean).join('|');
    return pageId(table) + ':headers:' + headers;
  }

  function storageKey(table) {
    return STORAGE_PREFIX + tableKey(table);
  }

  function percentStorageKey(table) {
    return STORAGE_PERCENT_PREFIX + tableKey(table);
  }

  function loadWidths(table) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(table)) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveWidths(table, widths) {
    try {
      localStorage.setItem(storageKey(table), JSON.stringify(widths || {}));
    } catch (_) {}
  }

  function loadPercentages(table) {
    try {
      return JSON.parse(localStorage.getItem(percentStorageKey(table)) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function savePercentages(table, percentages) {
    try {
      localStorage.setItem(percentStorageKey(table), JSON.stringify(percentages || {}));
    } catch (_) {}
  }

  function hasSavedPercentages(table) {
    var data = loadPercentages(table);
    return Object.keys(data).some(function (key) {
      return parseFloat(data[key]) > 0;
    });
  }

  function ensureColgroup(table, count) {
    var colgroup = table.querySelector('colgroup.sv-resizable-cols');
    if (!colgroup) {
      colgroup = document.createElement('colgroup');
      colgroup.className = 'sv-resizable-cols';
      table.insertBefore(colgroup, table.firstChild);
    }
    while (colgroup.children.length < count) colgroup.appendChild(document.createElement('col'));
    while (colgroup.children.length > count) colgroup.removeChild(colgroup.lastElementChild);
    return colgroup;
  }

  function isHidden(el) {
    if (!el) return true;
    if (el.hidden) return true;
    if (el.style && el.style.display === 'none') return true;
    try {
      return window.getComputedStyle(el).display === 'none';
    } catch (_) {
      return false;
    }
  }

  function normalizeWidth(width) {
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width || MIN_WIDTH)));
  }

  function totalColumnCount(table) {
    return Array.from(table.querySelectorAll('tr')).reduce(function (max, row) {
      return Math.max(max, row.children ? row.children.length : 0);
    }, 0);
  }

  function physicalIndexForHeader(th) {
    if (!th || !th.parentNode) return -1;
    return Array.prototype.indexOf.call(th.parentNode.children, th);
  }

  function physicalIndexForVisibleIndex(table, index) {
    var headers = tableHeaders(table);
    var headerIndex = physicalIndexForHeader(headers[index]);
    if (headerIndex >= 0) return headerIndex;
    var firstRow = table.querySelector('tr');
    if (!firstRow) return index;
    var visible = Array.from(firstRow.children).filter(function (cell) {
      return !isHidden(cell);
    });
    var cell = visible[index];
    return cell ? Array.prototype.indexOf.call(firstRow.children, cell) : index;
  }

  function columnCells(table, index) {
    var physicalIndex = physicalIndexForVisibleIndex(table, index);
    return Array.from(table.querySelectorAll('tr')).map(function (row) {
      return row.children[physicalIndex] || null;
    }).filter(Boolean);
  }

  function defaultWidthForHeader(th) {
    var text = ((th && th.textContent) || '').trim().toLowerCase();
    text = text.replace(/\s+/g, ' ');
    if (!text) return 58;
    if (DEFAULT_WIDTH_BY_HEADER[text]) return DEFAULT_WIDTH_BY_HEADER[text];
    if (text.indexOf('descrip') >= 0) return DEFAULT_WIDTH_BY_HEADER.descripcion;
    if (text.indexOf('venc') >= 0) return DEFAULT_WIDTH_BY_HEADER.vencimiento;
    if (text.indexOf('monto') >= 0 || text.indexOf('total') >= 0) return DEFAULT_WIDTH_BY_HEADER.monto;
    return 110;
  }

  function updateOverflowTitles(table) {
    Array.from(table.querySelectorAll('th,td')).forEach(function (cell) {
      if (cell.querySelector && cell.querySelector('.sv-col-resizer')) return;
      var text = (cell.textContent || '').trim().replace(/\s+/g, ' ');
      if (!text) return;
      var clipped = cell.scrollWidth > cell.clientWidth + 2;
      if (clipped) {
        if (!cell.title || cell.dataset.svAutoTitle === '1') {
          cell.title = text;
          cell.dataset.svAutoTitle = '1';
        }
      } else if (cell.dataset.svAutoTitle === '1') {
        cell.removeAttribute('title');
        delete cell.dataset.svAutoTitle;
      }
    });
  }

  function normalizePercent(value) {
    var n = parseFloat(String(value || '').replace(',', '.'));
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(n * 10) / 10;
  }

  function defaultPercentages(table) {
    var headers = tableHeaders(table);
    if (table && table.id === 'prod-tbl') {
      return {
        0: 5,
        1: 4,
        2: 30,
        3: 50,
        4: 3,
        5: 8,
        6: 8,
        7: 6,
        8: 3
      };
    }
    if (table && table.id === 'gas-tbl') {
      return {
        0: 6,
        1: 38,
        2: 9,
        3: 7,
        4: 9,
        5: 9,
        6: 9,
        7: 7,
        8: 7,
        9: 4
      };
    }
    if (table && table.id === 'ppto-tabla') {
      return {
        0: 17,
        1: 23,
        2: 15,
        3: 16,
        4: 16,
        5: 13
      };
    }
    var pesos = headers.map(function (th) {
      return defaultWidthForHeader(th);
    });
    var total = pesos.reduce(function (s, n) { return s + n; }, 0) || 1;
    var data = {};
    headers.forEach(function (_th, index) {
      data[index] = Math.round((pesos[index] / total) * 1000) / 10;
    });
    return data;
  }

  function shouldApplyDefaultPercentProfile(table) {
    return !!(table && (table.id === 'prod-tbl' || table.id === 'gas-tbl' || table.id === 'ppto-tabla'));
  }

  function currentPercentages(table) {
    var saved = loadPercentages(table);
    if (Object.keys(saved).length) return saved;
    return defaultPercentages(table);
  }

  function clearPixelWidths(table) {
    var colgroup = table.querySelector('colgroup.sv-resizable-cols');
    if (colgroup) colgroup.remove();
    Array.from(table.querySelectorAll('th,td')).forEach(function (cell) {
      cell.style.width = '';
      cell.style.maxWidth = '';
      cell.style.minWidth = '';
    });
  }

  function applyPercentProfile(table, percentages) {
    var headers = tableHeaders(table);
    if (!table || !headers.length) return;
    clearPixelWidths(table);
    var colgroup = ensureColgroup(table, totalColumnCount(table));
    var totalPct = Object.keys(percentages || {}).reduce(function (sum, key) {
      return sum + normalizePercent(percentages[key]);
    }, 0);
    table.classList.add('sv-percent-table');
    table.style.setProperty('--sv-percent-total-width', Math.max(100, Math.round(totalPct * 10) / 10) + '%');
    table.style.width = 'var(--sv-percent-total-width, 100%)';
    table.style.tableLayout = 'fixed';
    headers.forEach(function (_th, index) {
      var pct = normalizePercent(percentages[index]);
      var physicalIndex = physicalIndexForVisibleIndex(table, index);
      if (colgroup.children[physicalIndex]) {
        colgroup.children[physicalIndex].style.width = (pct > 0 ? pct : 1) + '%';
      }
      columnCells(table, index).forEach(function (cell) {
        cell.style.width = '';
        cell.style.maxWidth = '';
        cell.style.minWidth = '0';
        cell.style.overflow = 'hidden';
        cell.style.textOverflow = 'ellipsis';
      });
    });
    updateOverflowTitles(table);
  }

  function applySavedPercentProfile(table) {
    if (hasSavedPercentages(table)) {
      applyPercentProfile(table, loadPercentages(table));
      return true;
    }
    if (!shouldApplyDefaultPercentProfile(table)) return false;
    applyPercentProfile(table, defaultPercentages(table));
    return true;
  }

  function applyColumnWidth(table, index, width) {
    var safeWidth = normalizeWidth(width);
    var physicalIndex = physicalIndexForVisibleIndex(table, index);
    var colgroup = ensureColgroup(table, totalColumnCount(table));
    if (colgroup.children[physicalIndex]) colgroup.children[physicalIndex].style.width = safeWidth + 'px';
    columnCells(table, index).forEach(function (cell) {
      cell.style.width = safeWidth + 'px';
      cell.style.maxWidth = safeWidth + 'px';
      cell.style.minWidth = MIN_WIDTH + 'px';
    });
    updateOverflowTitles(table);
    return safeWidth;
  }

  function clearColumnWidth(table, index) {
    var physicalIndex = physicalIndexForVisibleIndex(table, index);
    var colgroup = table.querySelector('colgroup.sv-resizable-cols');
    if (colgroup && colgroup.children[physicalIndex]) colgroup.children[physicalIndex].style.width = '';
    columnCells(table, index).forEach(function (cell) {
      cell.style.width = '';
      cell.style.maxWidth = '';
      cell.style.minWidth = MIN_WIDTH + 'px';
    });
    updateOverflowTitles(table);
  }

  function setColumnWidth(table, index, width) {
    var safeWidth = applyColumnWidth(table, index, width);
    var widths = loadWidths(table);
    widths[index] = safeWidth;
    saveWidths(table, widths);
  }

  function resetColumn(table, index) {
    var widths = loadWidths(table);
    delete widths[index];
    saveWidths(table, widths);
    var headers = tableHeaders(table);
    applyColumnWidth(table, index, defaultWidthForHeader(headers[index]));
  }

  function applySavedWidths(table) {
    var headers = tableHeaders(table);
    if (!headers.length) return;
    ensureColgroup(table, totalColumnCount(table));
    var widths = loadWidths(table);
    headers.forEach(function (th, index) {
      var saved = parseInt(widths[index], 10);
      if (saved > 0) applyColumnWidth(table, index, saved);
      else applyColumnWidth(table, index, defaultWidthForHeader(th));
    });
    updateOverflowTitles(table);
  }

  function initTable(table) {
    if (!table) return;
    ensurePercentButton(table);
    if (table.dataset && table.dataset.svNoResize === '1') {
      applySavedPercentProfile(table);
      return;
    }
    var wrap = table.closest('.table-wrap, .sv-auto-grid-wrap, .card');
    if (!wrap) return;
    var headers = tableHeaders(table);
    if (headers.length < 2) return;
    var key = tableKey(table);
    var rowCount = table.rows ? table.rows.length : table.querySelectorAll('tr').length;
    if (table.dataset.svResizableReady === '1' &&
        table.dataset.svResizableKey === key &&
        table.dataset.svResizableRows === String(rowCount)) {
      return;
    }

    table.classList.add('sv-resizable-table');
    table.dataset.svResizableKey = key;
    table.dataset.svResizableRows = String(rowCount);
    wrap.classList.add('sv-resizable-wrap');
    if (!applySavedPercentProfile(table)) applySavedWidths(table);

    headers.forEach(function (th, index) {
      if (th.dataset.svResizableIndex !== String(index)) {
        var oldHandle = th.querySelector('.sv-col-resizer');
        if (oldHandle) oldHandle.remove();
      }
      th.dataset.svResizableIndex = String(index);
      th.classList.add('sv-resizable-th');
      if (th.querySelector('.sv-col-resizer')) return;
      var handle = document.createElement('span');
      handle.className = 'sv-col-resizer';
      handle.title = 'Arrastr? para cambiar el ancho. Doble clic para resetear.';
      th.appendChild(handle);

      var startX = 0;
      var startWidth = 0;
      var dragging = false;

      function move(clientX) {
        if (!dragging) return;
        setColumnWidth(table, index, startWidth + (clientX - startX));
      }

      function stop() {
        if (!dragging) return;
        dragging = false;
        document.body.classList.remove('sv-resizing-columns');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', stop);
      }

      function onMouseMove(event) {
        move(event.clientX);
      }

      function onTouchMove(event) {
        if (!event.touches || !event.touches[0]) return;
        move(event.touches[0].clientX);
        event.preventDefault();
      }

      function start(clientX, event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        dragging = true;
        startX = clientX;
        startWidth = normalizeWidth(th.getBoundingClientRect().width);
        document.body.classList.add('sv-resizing-columns');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stop);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', stop);
      }

      handle.addEventListener('mousedown', function (event) {
        start(event.clientX, event);
      });
      handle.addEventListener('touchstart', function (event) {
        if (!event.touches || !event.touches[0]) return;
        start(event.touches[0].clientX, event);
      }, { passive: false });
      handle.addEventListener('dblclick', function (event) {
        event.preventDefault();
        event.stopPropagation();
        resetColumn(table, index);
      });
    });
    table.dataset.svResizableReady = '1';
  }

  function scan() {
    scheduled = false;
    scheduleTimer = 0;
    var active = document.querySelector('.page.active');
    var root = active || document.body;
    root.querySelectorAll('.table-wrap table, .sv-auto-grid-wrap table, .card table').forEach(initTable);
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
    });
  }

  function tableLabel(table) {
    var card = table && table.closest ? table.closest('.card') : null;
    var title = card && card.querySelector('.card-title');
    if (title && title.textContent) return title.textContent.trim();
    if (table && table.id) return table.id;
    return 'tabla';
  }

  function ensurePercentButton(table) {
    if (!table || !tableHeaders(table).length) return;
    if (window.currentRole && window.currentRole !== 'admin') return;
    var card = table.closest('.card');
    if (!card) return;
    if (card.querySelector('.sv-column-percent-btn,[onclick*="openColumnPercentEditor"]')) return;
    var head = card.querySelector('.card-head');
    if (!head) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm admin-only sv-column-percent-btn';
    btn.title = 'Configurar ancho porcentual de columnas de ' + tableLabel(table);
    btn.innerHTML = '<i class="ti ti-columns"></i> Columnas %';
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openPercentEditor(table);
    });
    var actions = head.querySelector('.sv-card-head-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'sv-card-head-actions';
      while (head.children.length > 1) actions.appendChild(head.children[1]);
      head.appendChild(actions);
    }
    actions.appendChild(btn);
  }

  function openPercentEditor(tableOrId) {
    var table = typeof tableOrId === 'string' ? document.getElementById(tableOrId) : tableOrId;
    if (!table) {
      if (window.notify) window.notify('Tabla no encontrada');
      return;
    }
    if (window.currentRole && window.currentRole !== 'admin') {
      if (window.notify) window.notify('Solo el administrador puede configurar columnas');
      return;
    }
    var old = document.getElementById('sv-column-percent-modal');
    if (old) old.remove();
    var headers = tableHeaders(table);
    if (!headers.length) {
      if (window.notify) window.notify('Esta tabla no tiene columnas configurables');
      return;
    }
    var values = currentPercentages(table);
    var overlay = document.createElement('div');
    overlay.id = 'sv-column-percent-modal';
    overlay.className = 'sv-column-percent-overlay';
    overlay.innerHTML =
      '<div class="sv-column-percent-panel">' +
        '<div class="sv-column-percent-head">' +
          '<div><strong>Anchos de columnas</strong><span>Modificá los porcentajes y la tabla cambia en vivo.</span></div>' +
          '<button class="btn btn-sm btn-icon" type="button" data-sv-close><i class="ti ti-x"></i></button>' +
        '</div>' +
        '<div class="sv-column-percent-list">' +
          headers.map(function (th, index) {
            var label = (th.textContent || ('Columna ' + (index + 1))).replace(/\s+/g, ' ').trim();
            return '<label class="sv-column-percent-row">' +
              '<span>'+escapeHTML(label || ('Columna ' + (index + 1)))+'</span>' +
              '<input type="number" min="0" max="100" step="0.5" data-col-index="'+index+'" value="'+escapeHTML(values[index] || 0)+'">' +
              '<em>%</em>' +
            '</label>';
          }).join('') +
        '</div>' +
        '<div class="sv-column-percent-total">Total: <strong id="sv-column-percent-total">0%</strong><span id="sv-column-percent-hint"></span></div>' +
        '<div class="sv-column-percent-actions">' +
          '<button class="btn btn-sm" type="button" data-sv-default>Usar base sugerida</button>' +
          '<button class="btn btn-sm" type="button" data-sv-reset>Quitar perfil</button>' +
          '<button class="btn btn-sm btn-primary" type="button" data-sv-save>Guardar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    function readInputs() {
      var data = {};
      overlay.querySelectorAll('input[data-col-index]').forEach(function (input) {
        data[input.dataset.colIndex] = normalizePercent(input.value);
      });
      return data;
    }

    function refreshTotal(data) {
      var total = Object.keys(data).reduce(function (s, key) { return s + normalizePercent(data[key]); }, 0);
      var el = document.getElementById('sv-column-percent-total');
      var hint = document.getElementById('sv-column-percent-hint');
      if (el) {
        el.textContent = (Math.round(total * 10) / 10) + '%';
        el.style.color = Math.abs(total - 100) <= 0.5 ? 'var(--green)' : (total > 100 ? 'var(--blue)' : 'var(--amber)');
      }
      if (hint) {
        hint.textContent = total > 100 ? ' · queda más ancho y se desplaza horizontalmente' : (total < 99.5 ? ' · queda espacio libre' : '');
      }
    }

    function applyLive() {
      var data = readInputs();
      applyPercentProfile(table, data);
      refreshTotal(data);
    }

    overlay.addEventListener('input', function (ev) {
      if (ev.target && ev.target.matches('input[data-col-index]')) applyLive();
    });
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay || ev.target.closest('[data-sv-close]')) {
        overlay.remove();
        return;
      }
      if (ev.target.closest('[data-sv-default]')) {
        var defs = defaultPercentages(table);
        overlay.querySelectorAll('input[data-col-index]').forEach(function (input) {
          input.value = defs[input.dataset.colIndex] || 0;
        });
        applyLive();
        return;
      }
      if (ev.target.closest('[data-sv-reset]')) {
        try { localStorage.removeItem(percentStorageKey(table)); } catch (_) {}
        clearPixelWidths(table);
        table.classList.remove('sv-percent-table');
        table.style.removeProperty('--sv-percent-total-width');
        table.style.width = '';
        table.style.tableLayout = '';
        overlay.remove();
        scan();
        if (window.notify) window.notify('Perfil de columnas quitado');
        return;
      }
      if (ev.target.closest('[data-sv-save]')) {
        var data = readInputs();
        savePercentages(table, data);
        applyPercentProfile(table, data);
        overlay.remove();
        if (window.notify) window.notify('✓ Anchos de columnas guardados');
      }
    });
    applyLive();
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(function () {
      if (window.requestIdleCallback) window.requestIdleCallback(scan, { timeout: 500 });
      else window.requestAnimationFrame(scan);
    }, 180);
  }

  function mutationTouchesActivePage(mutations) {
    var active = document.querySelector('.page.active');
    if (!active) return true;
    return Array.from(mutations || []).some(function (mutation) {
      if (active.contains(mutation.target)) return true;
      return Array.from(mutation.addedNodes || []).some(function (node) {
        return node && node.nodeType === 1 && (
          active.contains(node) ||
          (node.matches && (node.matches('table,.table-wrap,.sv-auto-grid-wrap,.card') || !!node.querySelector('table,.table-wrap,.sv-auto-grid-wrap,.card')))
        );
      });
    });
  }

  ready(function () {
    scan();
    var observer = new MutationObserver(function (mutations) {
      if (mutationTouchesActivePage(mutations)) scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleScan);
    document.addEventListener('sisventas:page-changed', scheduleScan);
    window.SisVentas = window.SisVentas || {};
    window.SisVentas.initResizableTables = scan;
    window.SisVentas.openColumnPercentEditor = openPercentEditor;
    window.SisVentas.applyColumnPercentProfiles = scan;
  });
})();
