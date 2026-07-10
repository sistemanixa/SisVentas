/* v1.36.21 — Columnas ajustables para tablas/listas */
(function () {
  'use strict';

  var STORAGE_PREFIX = 'sisventas.tableWidth.v2.';
  var MIN_WIDTH = 54;
  var MAX_WIDTH = 720;
  var scheduled = false;
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
    var wrap = table.closest('.table-wrap, .sv-auto-grid-wrap, .card');
    if (!wrap) return;
    var headers = tableHeaders(table);
    if (headers.length < 2) return;

    table.classList.add('sv-resizable-table');
    table.dataset.svResizableKey = tableKey(table);
    wrap.classList.add('sv-resizable-wrap');
    applySavedWidths(table);

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
    document.querySelectorAll('.table-wrap table, .sv-auto-grid-wrap table, .card table').forEach(initTable);
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(scan);
  }

  ready(function () {
    scan();
    var observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleScan);
    window.SisVentas = window.SisVentas || {};
    window.SisVentas.initResizableTables = scan;
  });
})();

