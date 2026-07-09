/* v1.35.2 — Columnas ajustables para tablas/listas */
(function () {
  'use strict';

  var STORAGE_PREFIX = 'sisventas.tableWidth.';
  var MIN_WIDTH = 54;
  var MAX_WIDTH = 720;
  var scheduled = false;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function pageId(table) {
    var page = table.closest('.page');
    return (page && page.id) || 'global';
  }

  function tableKey(table) {
    if (table.id) return table.id;
    var headers = Array.from(table.querySelectorAll('thead th')).map(function (th) {
      return (th.textContent || '').trim().replace(/\s+/g, '-').slice(0, 24);
    }).filter(Boolean).join('|');
    var index = Array.from(document.querySelectorAll('.table-wrap table, .sv-auto-grid-wrap table')).indexOf(table);
    return pageId(table) + ':' + index + ':' + headers;
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

  function setColumnWidth(table, index, width) {
    var safeWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width || MIN_WIDTH)));
    var colgroup = ensureColgroup(table, table.querySelectorAll('thead th').length);
    if (colgroup.children[index]) colgroup.children[index].style.width = safeWidth + 'px';
    var widths = loadWidths(table);
    widths[index] = safeWidth;
    saveWidths(table, widths);
  }

  function resetColumn(table, index) {
    var widths = loadWidths(table);
    delete widths[index];
    saveWidths(table, widths);
    var colgroup = table.querySelector('colgroup.sv-resizable-cols');
    if (colgroup && colgroup.children[index]) colgroup.children[index].style.width = '';
  }

  function applySavedWidths(table) {
    var headers = Array.from(table.querySelectorAll('thead th'));
    if (!headers.length) return;
    var colgroup = ensureColgroup(table, headers.length);
    var widths = loadWidths(table);
    headers.forEach(function (th, index) {
      var saved = parseInt(widths[index], 10);
      if (saved > 0 && colgroup.children[index]) colgroup.children[index].style.width = saved + 'px';
      th.style.minWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(th.getBoundingClientRect().width || MIN_WIDTH))) + 'px';
    });
  }

  function initTable(table) {
    if (!table || table.dataset.svResizableReady === '1') return;
    var wrap = table.closest('.table-wrap, .sv-auto-grid-wrap');
    if (!wrap) return;
    var headers = Array.from(table.querySelectorAll('thead th'));
    if (headers.length < 2) return;

    table.dataset.svResizableReady = '1';
    table.classList.add('sv-resizable-table');
    wrap.classList.add('sv-resizable-wrap');
    applySavedWidths(table);

    headers.forEach(function (th, index) {
      th.classList.add('sv-resizable-th');
      if (th.querySelector('.sv-col-resizer')) return;
      var handle = document.createElement('span');
      handle.className = 'sv-col-resizer';
      handle.title = 'Arrastrá para cambiar el ancho. Doble clic para resetear.';
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
        startWidth = th.getBoundingClientRect().width;
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
  }

  function scan() {
    scheduled = false;
    document.querySelectorAll('.table-wrap table, .sv-auto-grid-wrap table').forEach(initTable);
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
