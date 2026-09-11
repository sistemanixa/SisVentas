/* Recuperación local por usuario. Nunca persiste operaciones comerciales. */
(function () {
  'use strict';
  var TTL = 30 * 86400000;
  function valid(d, now) { return d && d.schema === 1 && typeof d.updated === 'number' && now - d.updated < TTL && d.updated <= now && (d.kind === 'venta' || d.kind === 'presupuesto'); }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { valid: valid, TTL: TTL }; return; }
  var sessions = {}, restoring = false, owner = user(), failed = false;
  function user() { return typeof currentUserUid !== 'undefined' && currentUserUid ? String(currentUserUid) : ''; }
  function prefix() { return 'sv:commercial-draft:v1:' + encodeURIComponent(user()) + ':'; }
  function root(kind) { return document.getElementById(kind === 'venta' ? 'page-venta' : 'ppto-form-view'); }
  function visible(kind) { var el = root(kind); return el && el.getClientRects().length > 0; }
  function records() {
    if (!user()) return [];
    var out = [], p = prefix();
    try {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(p) === 0; }).forEach(function (k) {
        var d; try { d = JSON.parse(localStorage.getItem(k)); } catch (_) { return; }
        if (valid(d, Date.now())) out.push(d); else localStorage.removeItem(k);
      });
    } catch (_) { warn(); }
    return out.sort(function (a, b) { return b.updated - a.updated; });
  }
  function warn() { if (!failed) { failed = true; notify('No se pudo guardar el borrador en este navegador. No cierres el formulario hasta guardar la operación.'); } }
  function fields(scope) {
    return Array.from(scope.querySelectorAll('input,select,textarea')).filter(function (el) { return !el.closest('tbody') && el.type !== 'file' && el.type !== 'password'; }).map(function (el, index) {
      return { id: el.id, index: index, value: el.value, checked: el.checked, data: Object.assign({}, el.dataset) };
    });
  }
  function capture(kind) {
    var scope = root(kind); if (!scope) return null;
    var rows = Array.from(document.querySelectorAll(kind === 'venta' ? '#det-body tr' : '#pp-body tr')).map(function (tr) {
      var price = tr.querySelector('.price');
      return { cod: (tr.querySelector('.prod-sel-cod') || {}).textContent || '', desc: (tr.querySelector('.desc-txt-clean,.desc-txt') || {}).textContent || '', qty: (tr.querySelector('.qty') || {}).value || '', price: price ? getMontoRaw(price) : 0, priceText: price ? price.value : '', priceData: price ? Object.assign({}, price.dataset) : {}, disc: (tr.querySelector('.disc') || {}).value || '', data: Object.assign({}, tr.dataset) };
    });
    return { fields: fields(scope), rows: rows, edit: kind === 'venta' ? window._ventaEditandoFbKey || '' : window._pptoEditandoFbKey || '', editId: kind === 'presupuesto' ? window._pptoEditandoId || '' : '', iva: kind === 'venta' ? _ventaConIva : _pptoConIva, detail: kind === 'venta' ? _ventaImpConDetalle : _pptoConDetalle, currency: kind === 'venta' ? _ventaMonedaActual : _pptoMonedaActual };
  }
  function original(kind, data) { return kind === 'venta' ? window._ventaEditandoOriginal || null : data.edit ? buscarPptoPorRef(data.edit) : null; }
  function begin(kind) {
    if (restoring || !user()) return;
    var data = capture(kind);
    sessions[kind] = { id: Date.now() + '-' + Math.random().toString(36).slice(2), base: JSON.stringify(data), last: JSON.stringify(data), original: original(kind, data) ? JSON.parse(JSON.stringify(original(kind, data))) : null };
  }
  function save(kind) {
    if (restoring || !user() || owner !== user()) return;
    var s = sessions[kind]; if (!s) { if (visible(kind)) begin(kind); return; }
    var data = capture(kind), json = JSON.stringify(data); if (json === s.last) return;
    var meaningful = data.edit || data.rows.some(function (r) { return r.cod.trim() || r.price || (r.desc.trim() && r.desc.trim() !== 'Seleccioná un producto'); }) || data.fields.some(function (f) { return ['cli-inp', 'venta-obs', 'desc-general', 'pp-cli', 'pp-descuento'].indexOf(f.id) >= 0 && f.value.trim() && f.value !== '0'; }) || data.fields.some(function (f) { return !f.id && f.value.trim(); });
    var d = { schema: 1, id: s.id, kind: kind, updated: Date.now(), data: data, original: s.original };
    try {
      if (json === s.base || !meaningful) localStorage.removeItem(prefix() + s.id);
      else localStorage.setItem(prefix() + s.id, JSON.stringify(d));
      s.last = json; failed = false; badges();
    } catch (_) { warn(); }
  }
  function flush() { ['venta', 'presupuesto'].forEach(function (k) { if (visible(k)) save(k); }); }
  function complete(kind) {
    var s = sessions[kind];
    if (s && owner === user()) { try { localStorage.removeItem(prefix() + s.id); } catch (_) { warn(); } }
    delete sessions[kind]; badges();
  }
  function badges() {
    var n = records().length;
    document.querySelectorAll('[data-draft-count]').forEach(function (el) { el.textContent = n; el.hidden = !n; });
  }
  function installButtons() {
    ['page-dashboard', 'ventas-list-view', 'ppto-list-view'].forEach(function (id) {
      var host = document.getElementById(id); if (!host || host.querySelector('.sv-drafts-access')) return;
      var bar = document.createElement('div'); bar.className = 'sv-drafts-access'; bar.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:12px';
      var btn = document.createElement('button'); btn.className = 'btn btn-sm'; btn.innerHTML = '<i class="ti ti-files"></i> Borradores <span data-draft-count hidden style="background:var(--blue);color:white;border-radius:20px;padding:2px 7px"></span>'; btn.onclick = open;
      bar.appendChild(btn); host.prepend(bar);
    });
  }
  function open() {
    flush(); var old = document.getElementById('sv-drafts-dialog'); if (old) old.remove();
    var dialog = document.createElement('dialog'); dialog.id = 'sv-drafts-dialog'; dialog.style.cssText = 'background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:14px;width:min(640px,90vw);max-height:85vh;padding:20px';
    var title = document.createElement('h3'); title.textContent = 'Borradores'; dialog.appendChild(title);
    var info = document.createElement('p'); info.textContent = 'Guardados en este navegador para tu usuario. Se descartan a los 30 días del último cambio.'; dialog.appendChild(info);
    var list = records(); if (!list.length) { var empty = document.createElement('p'); empty.textContent = 'No hay borradores pendientes.'; dialog.appendChild(empty); }
    list.forEach(function (d) {
      var row = document.createElement('div'); row.style.cssText = 'padding:12px 0;border-top:1px solid var(--border);display:flex;gap:8px;align-items:center;flex-wrap:wrap';
      var label = document.createElement('span'); label.style.flex = '1';
      var customer = d.data.fields.find(function (f) { return f.id === 'cli-inp' || f.id === 'pp-cli'; });
      label.textContent = (d.kind === 'venta' ? 'Venta' : 'Presupuesto') + (d.data.edit ? ' · Edición ' + ((d.original || {}).id || d.data.editId) : ' · Nuevo') + ' · ' + (customer && customer.value || 'CONSUMIDOR FINAL') + ' · ' + new Date(d.updated).toLocaleString('es-AR'); row.appendChild(label);
      var resume = document.createElement('button'); resume.className = 'btn btn-sm btn-primary'; resume.textContent = 'Continuar'; resume.onclick = function () { restore(d, dialog); }; row.appendChild(resume);
      var remove = document.createElement('button'); remove.className = 'btn btn-sm'; remove.textContent = 'Descartar'; remove.onclick = async function () {
        dialog.close();
        if (!await svConfirm('¿Descartar este borrador? La operación original no se modifica.')) { dialog.showModal(); return; }
        localStorage.removeItem(prefix() + d.id); Object.keys(sessions).forEach(function (k) { if (sessions[k].id === d.id) delete sessions[k]; }); dialog.close(); dialog.remove(); badges(); open();
      }; row.appendChild(remove); dialog.appendChild(row);
    });
    var close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Cerrar'; close.onclick = function () { dialog.close(); dialog.remove(); }; dialog.appendChild(close); document.body.appendChild(dialog); dialog.showModal();
  }
  function restore(d, dialog) {
    if (!permisoModulo(d.kind === 'venta' ? 'venta' : 'presupuesto')) { notify('Acceso restringido para tu rol.'); return; }
    if (!valid(d, Date.now())) { notify('El borrador venció.'); return; }
    var current = d.data.edit ? (d.kind === 'venta' ? (ventasList || []).find(function (v) { return v.fbKey === d.data.edit; }) : buscarPptoPorRef(d.data.edit)) : null;
    if (d.data.edit && (!current || !(d.kind === 'venta' ? puedeEditarVentaPermiso(current) : puedeEditarPresupuestoPermiso(current)))) { notify('La operación ya no está disponible para edición.'); return; }
    if (current && JSON.stringify(current) !== JSON.stringify(d.original)) { notify('La operación original cambió. Revisala antes de recuperar este borrador para no sobrescribir cambios posteriores.'); return; }
    flush(); restoring = true; dialog.close(); dialog.remove();
    svNavegarDirecto(d.kind === 'venta' ? 'venta' : 'presupuesto', function () {
      try {
        if (d.kind === 'venta') iniciarNuevaVenta(); else abrirNuevoPresupuesto();
        var scope = root(d.kind), elements = Array.from(scope.querySelectorAll('input,select,textarea')).filter(function (el) { return !el.closest('tbody') && el.type !== 'file' && el.type !== 'password'; });
        d.data.fields.forEach(function (f) { var el = f.id ? document.getElementById(f.id) : elements[f.index]; if (el && scope.contains(el)) { el.value = f.value; if (el.type === 'checkbox' || el.type === 'radio') el.checked = f.checked; Object.assign(el.dataset, f.data); } });
        var body = document.getElementById(d.kind === 'venta' ? 'det-body' : 'pp-body'); body.replaceChildren();
        d.data.rows.forEach(function (r) {
          var tr = crearFilaProducto(r.cod, r.desc, r.price, r.qty, r.disc); Object.assign(tr.dataset, r.data); body.appendChild(tr);
          var p = tr.querySelector('.price'); if (p) { p.value = r.priceText; Object.assign(p.dataset, r.priceData || {}, { raw: r.price }); }
          if (r.data.creditoHistorico === '1') tr.querySelectorAll('.qty,.price,.disc').forEach(function (el) { el.readOnly = true; });
          if (d.kind === 'presupuesto') tr.querySelectorAll('.qty,.price,.disc').forEach(function (el) { el.addEventListener('input', calcPpTotales); });
        });
        if (d.kind === 'venta') { window._ventaEditandoFbKey = d.data.edit || null; window._ventaEditandoOriginal = current; _ventaMonedaActual = d.data.currency; _ventaImpConDetalle = d.data.detail; aplicarEstadoIvaVenta(d.data.iva, false); actualizarVisualMonedaVenta(); calcTotals(); }
        else { window._pptoEditandoFbKey = d.data.edit || null; window._pptoEditandoId = d.data.editId || null; _pptoMonedaActual = d.data.currency; _pptoConDetalle = d.data.detail; _pptoConIva = d.data.iva; calcPpTotales(); }
        var ivaButton = document.getElementById(d.kind === 'venta' ? 'btn-toggle-iva-venta' : 'btn-toggle-iva-ppto');
        if (ivaButton) ivaButton.innerHTML = '<i class="ti ti-receipt-tax"></i> ' + (d.data.iva ? 'Con IVA' : 'Sin IVA');
        var detailLabel = document.getElementById(d.kind === 'venta' ? 'label-detalle-venta' : 'ppto-detalle-label');
        if (detailLabel) detailLabel.textContent = d.data.detail ? 'Con detalle' : 'Sin detalle';
        if (d.kind === 'presupuesto') {
          var label = document.getElementById('pmt-label'); if (label) label.textContent = d.data.currency;
          var thumb = document.getElementById('pmt-thumb'); if (thumb) thumb.style.transform = d.data.currency === 'USD' ? 'translateX(16px)' : 'translateX(0)';
        }
        sessions[d.kind] = { id: d.id, base: '', last: JSON.stringify(capture(d.kind)), original: d.original };
        notify('Borrador recuperado. Revisá y guardá para confirmar los cambios.');
      } finally { restoring = false; }
    });
  }
  window.svDrafts = { begin: begin, flush: flush, complete: complete, leave: function (kind) { flush(); delete sessions[kind]; } };
  document.addEventListener('input', function () { flush(); });
  document.addEventListener('change', function () { flush(); });
  document.addEventListener('click', flush, true);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
  window.addEventListener('storage', badges);
  setInterval(function () {
    if (owner !== user()) { owner = user(); sessions = {}; }
    installButtons(); flush(); badges();
  }, 1000);
})();
