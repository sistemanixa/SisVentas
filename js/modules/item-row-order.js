// Reordenamiento compartido de productos en Presupuestos y Ventas.
(function () {
  'use strict';

  var BODY_IDS = ['det-body', 'pp-body'];
  var draggingRow = null;

  function isMeaningfulRow(row) {
    if (!row) return false;
    var code = String(((row.querySelector('.prod-sel-cod') || {}).textContent) || '').trim();
    var description = row.querySelector('.desc-txt-clean, .desc-txt');
    var price = row.querySelector('.price, .ppprice');
    var amount = price ? (price.dataset.moneyInit && typeof window.getMontoRaw === 'function'
      ? window.getMontoRaw(price)
      : parseFloat(price.value || 0)) : 0;
    return !!code || !!String((description && description.textContent) || '').trim() || amount > 0;
  }

  function meaningfulRows(body) {
    return Array.from(body.querySelectorAll(':scope > tr')).filter(isMeaningfulRow);
  }

  function recalculate(body) {
    if (!body) return;
    if (body.id === 'pp-body' && typeof window.calcPpTotales === 'function') window.calcPpTotales();
    if (body.id === 'det-body') {
      if (typeof window.calcTotals === 'function') window.calcTotals();
      if (typeof window.actualizarResumenStock === 'function') window.actualizarResumenStock();
    }
  }

  function refresh(body) {
    if (!body) return;
    var ordered = meaningfulRows(body);
    Array.from(body.querySelectorAll(':scope > tr')).forEach(function (row) {
      var controls = row.querySelector('.sv-item-order-controls');
      var handle = row.querySelector('.sv-item-drag-handle');
      var meaningful = isMeaningfulRow(row);
      if (controls) controls.hidden = !meaningful;
      if (handle) handle.hidden = !meaningful;
      if (!meaningful) {
        row.removeAttribute('data-item-order');
        return;
      }
      var index = ordered.indexOf(row);
      row.dataset.itemOrder = String(index + 1);
      var up = row.querySelector('[data-item-move="up"]');
      var down = row.querySelector('[data-item-move="down"]');
      if (up) up.disabled = index <= 0;
      if (down) down.disabled = index < 0 || index >= ordered.length - 1;
    });
  }

  function finishMove(body) {
    refresh(body);
    recalculate(body);
  }

  function moveRow(row, direction) {
    var body = row && row.parentElement;
    if (!body || BODY_IDS.indexOf(body.id) < 0 || !isMeaningfulRow(row)) return;
    var rows = meaningfulRows(body);
    var index = rows.indexOf(row);
    var target = rows[index + direction];
    if (!target) return;
    if (direction < 0) body.insertBefore(row, target);
    else body.insertBefore(target, row);
    finishMove(body);
    row.classList.add('sv-item-row-moved');
    setTimeout(function () { row.classList.remove('sv-item-row-moved'); }, 420);
  }

  function installRow(row) {
    if (!row || row.dataset.svItemOrderReady === '1') return;
    row.dataset.svItemOrderReady = '1';

    var productCell = row.querySelector('.item-prod-cell');
    if (productCell && !productCell.querySelector('.sv-item-drag-handle')) {
      var handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'sv-item-drag-handle';
      handle.draggable = true;
      handle.title = 'Arrastrá para cambiar el orden';
      handle.setAttribute('aria-label', 'Arrastrar ítem para cambiar el orden');
      handle.innerHTML = '<i class="ti ti-grip-vertical"></i>';
      handle.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); });
      handle.addEventListener('dragstart', function (event) {
        draggingRow = row;
        row.classList.add('sv-item-row-dragging');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', row.dataset.itemOrder || '');
        }
      });
      handle.addEventListener('dragend', function () {
        var body = row.parentElement;
        row.classList.remove('sv-item-row-dragging');
        draggingRow = null;
        finishMove(body);
      });
      productCell.insertBefore(handle, productCell.firstChild);
    }

    var actionCell = row.lastElementChild;
    if (actionCell && !actionCell.querySelector('.sv-item-order-controls')) {
      actionCell.classList.add('sv-item-actions-cell');
      var controls = document.createElement('span');
      controls.className = 'sv-item-order-controls';
      controls.innerHTML =
        '<button type="button" data-item-move="up" title="Subir ítem" aria-label="Subir ítem"><i class="ti ti-chevron-up"></i></button>' +
        '<button type="button" data-item-move="down" title="Bajar ítem" aria-label="Bajar ítem"><i class="ti ti-chevron-down"></i></button>';
      controls.addEventListener('click', function (event) {
        var button = event.target.closest('[data-item-move]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        moveRow(row, button.dataset.itemMove === 'up' ? -1 : 1);
      });
      actionCell.insertBefore(controls, actionCell.firstChild);
    }
  }

  function installBody(body) {
    if (!body) return;
    Array.from(body.querySelectorAll(':scope > tr')).forEach(installRow);
    if (body.dataset.svItemOrderReady !== '1') {
      body.dataset.svItemOrderReady = '1';
      body.addEventListener('dragover', function (event) {
        if (!draggingRow || draggingRow.parentElement !== body) return;
        event.preventDefault();
        var candidates = meaningfulRows(body).filter(function (row) { return row !== draggingRow; });
        var before = candidates.find(function (row) {
          var rect = row.getBoundingClientRect();
          return event.clientY < rect.top + rect.height / 2;
        });
        var empty = Array.from(body.querySelectorAll(':scope > tr')).find(function (row) { return !isMeaningfulRow(row); });
        if (before) body.insertBefore(draggingRow, before);
        else if (empty) body.insertBefore(draggingRow, empty);
        else body.appendChild(draggingRow);
        refresh(body);
      });
      body.addEventListener('drop', function (event) {
        if (!draggingRow || draggingRow.parentElement !== body) return;
        event.preventDefault();
        var row = draggingRow;
        row.classList.remove('sv-item-row-dragging');
        draggingRow = null;
        finishMove(body);
      });
    }
    refresh(body);
  }

  function scan() {
    BODY_IDS.forEach(function (id) { installBody(document.getElementById(id)); });
  }

  function ready() {
    scan();
    var observer = new MutationObserver(function (mutations) {
      var touched = false;
      mutations.forEach(function (mutation) {
        var body = mutation.target && mutation.target.closest ? mutation.target.closest('#det-body,#pp-body') : null;
        if (!body && mutation.target && BODY_IDS.indexOf(mutation.target.id) >= 0) body = mutation.target;
        if (!body) return;
        touched = true;
        Array.from(mutation.addedNodes || []).forEach(function (node) {
          if (node && node.nodeType === 1 && node.tagName === 'TR') installRow(node);
        });
        refresh(body);
      });
      if (touched) window.requestAnimationFrame(scan);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('sisventas:page-changed', scan);
    window.SisVentas = window.SisVentas || {};
    window.SisVentas.refreshItemRowOrder = scan;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
