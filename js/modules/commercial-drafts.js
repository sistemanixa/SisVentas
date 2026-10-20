/* Borradores por usuario, con respaldo local y sincronización independiente de ventas. */
(function () {
  'use strict';
  var TTL = 30 * 86400000;
  function valid(d, now) { return d && d.schema === 1 && typeof d.updated === 'number' && now - d.updated < TTL && d.updated <= now && (d.kind === 'venta' || d.kind === 'presupuesto'); }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') { var out={}; Object.keys(value).sort().forEach(function(k){out[k]=stable(value[k]);}); return out; }
    return value;
  }
  function same(a,b) { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }
  function mergeForm(base,draft,current) {
    var result=JSON.parse(JSON.stringify(current)),conflicts=[];
    function choose(old,proposed,latest,label) {
      if (same(proposed,old)) return latest;
      if (same(latest,old) || same(proposed,latest)) return proposed;
      conflicts.push(label); return latest;
    }
    function key(f){return f.id || '@'+f.index;}
    var before={},proposed={};
    (base.fields||[]).forEach(function(f){before[key(f)]=f;});
    (draft.fields||[]).forEach(function(f){proposed[key(f)]=f;});
    result.fields=(current.fields||[]).map(function(f){var k=key(f);if(f.id==='vf-numero-preview')return f;return proposed[k] ? choose(before[k],proposed[k],f,f.id||'Campo '+f.index) : f;});
    // Los precios y su moneda son una unidad: jamás interpretar renglones
    // actuales en una moneda distinta tomada del borrador.
    function prices(data){return {rows:data.rows,currency:data.currency};}
    var selected=choose(prices(base),prices(draft),prices(current),'Productos e importes');
    result.rows=selected.rows;result.currency=selected.currency;
    ['iva','detail','creadoConIA'].forEach(function(k){result[k]=choose(base[k],draft[k],current[k],k);});
    return {data:result,conflicts:conflicts};
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { valid: valid, TTL: TTL, same:same, mergeForm:mergeForm }; return; }
  var sessions = {}, restoring = false, owner = user(), failed = false;
  var cloudOwner = '', unsubscribe = null, cloudReady = false, pending = {}, cloudTimer = null, cloudEpoch = 0, cloudSending = null, suspended = false, cloudWriteBlocked = false;
  var observers = new Set(), deliveringObservers = false, observersPending = false;
  function canSync() {
    return !suspended && typeof currentRole !== 'undefined' && !!currentRole && currentRole !== 'distribuidora' && currentRole !== 'compras_paraguay';
  }
  function observerRole() { return typeof currentRole === 'undefined' ? '' : currentRole; }
  function observerContext(observer) { return !suspended && observer.uid === user() && observer.role === observerRole(); }
  function observerSnapshot() {
    var uid = user(), available = !!uid && owner === uid && canSync(), deletedIds = [], now = Date.now();
    if (available) {
      var p = prefix();
      try {
        Object.keys(localStorage).filter(function(k) { return k.indexOf(p) === 0; }).forEach(function(k) {
          var d; try { d = JSON.parse(localStorage.getItem(k)); } catch (_) { return; }
          if (d && d.deleted === true && d.id === k.slice(p.length) && typeof d.updated === 'number' && d.updated <= now && now - d.updated < TTL) deletedIds.push(d.id);
        });
      } catch (_) {}
    }
    return { ownerUid: uid, ready: available && cloudReady && cloudOwner === uid, records: available ? records() : [], deletedIds: deletedIds.sort() };
  }
  function freezeSnapshot(value) {
    if (value && typeof value === 'object') { Object.keys(value).forEach(function(k) { freezeSnapshot(value[k]); }); Object.freeze(value); }
    return value;
  }
  function deliverObserver(observer, snapshot) {
    var signature = JSON.stringify(stable(snapshot));
    if (!observers.has(observer) || observer.last === signature) return;
    observer.last = signature;
    // Cada observador recibe su propia copia; ni una mutación ni un error suyo
    // puede alterar el borrador, otros observadores o el guardado existente.
    try { observer.callback(freezeSnapshot(JSON.parse(JSON.stringify(snapshot)))); } catch (_) {}
  }
  function notifyObservers() {
    if (!observers.size) return;
    if (deliveringObservers) { observersPending = true; return; }
    deliveringObservers = true;
    try {
      do {
        observersPending = false;
        var snapshot = observerSnapshot();
        for (var observer of Array.from(observers)) {
          if (!observerContext(observer)) {
            deliverObserver(observer, { ownerUid: user(), ready: false, records: [], deletedIds: [] });
            observers.delete(observer);
          } else deliverObserver(observer, snapshot);
          // Un observador puede completar/descartar el borrador en su callback.
          // No entregar después a otro observador la instantánea ya obsoleta.
          if (observersPending) break;
        }
      } while (observersPending && observers.size);
    } finally { deliveringObservers = false; }
  }
  function notifyObserverContext() {
    if (Array.from(observers).some(function(observer) { return !observerContext(observer); })) notifyObservers();
  }
  function subscribe(callback) {
    if (typeof callback !== 'function') throw new TypeError('El observador de borradores debe ser una función');
    var observer = { callback: callback, uid: user(), role: observerRole(), last: null };
    observers.add(observer); notifyObservers();
    return function() { observers.delete(observer); };
  }
  function publish(d) {
    if (d.deleted) localStorage.setItem(prefix()+d.id,JSON.stringify(d));
    pending[d.id] = d;
    cloudWriteBlocked = false;
    connect();
    if (cloudTimer) clearTimeout(cloudTimer);
    if (typeof setTimeout === 'function') cloudTimer = setTimeout(sendPending, 500);
    notifyObservers();
  }
  function sendPending() {
    if (cloudWriteBlocked || cloudSending || window.navigator?.onLine === false || !canSync() || !cloudReady || cloudOwner !== user() || !window.fbUpdate) return;
    var batch = pending; pending = {};
    if (!Object.keys(batch).length) return;
    var uid = cloudOwner, flight = {uid:uid,epoch:cloudEpoch,ids:Object.keys(batch)}, success = false, task;
    cloudSending = flight;
    try { task = window.fbUpdate(window.fbRef(window.fbDB, 'sv_borradores/' + uid), batch); } catch (error) { task = Promise.reject(error); }
    Promise.resolve(task).then(function() { success = true; }, function() {
      if (user() !== uid || flight.epoch !== cloudEpoch) return;
      cloudWriteBlocked = true;
      Object.keys(batch).forEach(function(id) { if (!pending[id] || pending[id].updated < batch[id].updated) pending[id] = batch[id]; });
      if (!failed) { failed = true; notify('Borrador guardado en este navegador. La sincronización está pendiente.'); }
    }).finally(function() {
      if (cloudSending !== flight) return;
      cloudSending = null;
      if (success && user() === uid && flight.epoch === cloudEpoch && Object.keys(pending).length) {
        if (cloudTimer) clearTimeout(cloudTimer);
        cloudTimer = setTimeout(sendPending, 500);
      }
    });
  }
  function stopCloud() {
    cloudEpoch++; if (cloudTimer) clearTimeout(cloudTimer); cloudTimer = null;
    if (unsubscribe) unsubscribe(); unsubscribe = null;
    cloudOwner = ''; cloudReady = false; cloudSending = null; pending = {}; cloudWriteBlocked = false;
    notifyObservers();
  }
  function tombstone(id) { return {id:id,deleted:true,updated:Date.now()}; }
  function connect() {
    var uid = user();
    if (!canSync()) {
      if (unsubscribe || cloudOwner) stopCloud();
      return;
    }
    if (cloudOwner === uid || !uid || !window.fbDB || !window.fbOnValue || !window.fbUpdate) return;
    if (unsubscribe) unsubscribe();
    var epoch = ++cloudEpoch;
    cloudOwner = uid; cloudReady = false;
    var stop = window.fbOnValue(window.fbRef(window.fbDB, 'sv_borradores/' + uid), function(snapshot) {
      if (epoch !== cloudEpoch || user() !== uid || !canSync()) return;
      var remote = snapshot.val() || {};
      Object.keys(remote).forEach(function(id) {
        var d=remote[id], local; try { local=JSON.parse(localStorage.getItem(prefix()+id)); } catch (_) {}
        if (d.deleted) {
          localStorage.setItem(prefix()+id,JSON.stringify(d));
          delete pending[id];
          Object.keys(sessions).forEach(function(k){ if (sessions[k].id === id) delete sessions[k]; });
        } else if (local && local.deleted) pending[id]=local;
        else if (valid(d,Date.now()) && (!local || d.updated > local.updated || same(d,local))) localStorage.setItem(prefix()+id,JSON.stringify(d));
      });
      records().forEach(function(d) { if (!remote[d.id] || (!remote[d.id].deleted && d.updated > remote[d.id].updated)) pending[d.id]=d; });
      Object.keys(localStorage).filter(function(k){return k.indexOf(prefix())===0;}).forEach(function(k){var d;try{d=JSON.parse(localStorage.getItem(k));}catch(_){}if(d&&d.deleted&&(!remote[d.id]||!remote[d.id].deleted))pending[d.id]=d;});
      cloudReady = true; failed = false; badges(); sendPending(); notifyObservers();
    }, function() { if (epoch !== cloudEpoch || user() !== uid || !canSync()) return; stopCloud(); if (!failed) {failed=true;notify('No se pudieron sincronizar los borradores. Se conserva la copia local.');} });
    if (epoch === cloudEpoch) unsubscribe = stop; else stop?.();
  }
  function resumeCloud() {
    if (owner !== user()) { stopCloud(); owner = user(); sessions = {}; }
    cloudWriteBlocked = false;
    connect(); flush(); sendPending(); if (!document.hidden) { installButtons(); badges(); }
  }
  function user() { return typeof currentUserUid !== 'undefined' && currentUserUid ? String(currentUserUid) : ''; }
  function prefix() { return 'sv:commercial-draft:v1:' + encodeURIComponent(user()) + ':'; }
  function root(kind) { return document.getElementById(kind === 'venta' ? 'page-venta' : 'ppto-form-view'); }
  function visible(kind) { var el = root(kind); return el && el.closest('.page')?.classList.contains('active') && el.getClientRects().length > 0; }
  function records() {
    if (!user()) return [];
    var out = [], p = prefix();
    try {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(p) === 0; }).forEach(function (k) {
        var d; try { d = JSON.parse(localStorage.getItem(k)); } catch (_) { return; }
        if (d && d.deleted) return;
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
    return { creadoConIA: kind === 'presupuesto' && window._pptoCreadoConIA === true, fields: fields(scope), rows: rows, edit: kind === 'venta' ? window._ventaEditandoFbKey || '' : window._pptoEditandoFbKey || '', editId: kind === 'presupuesto' ? window._pptoEditandoId || '' : '', iva: kind === 'venta' ? _ventaConIva : _pptoConIva, detail: kind === 'venta' ? _ventaImpConDetalle : _pptoConDetalle, currency: kind === 'venta' ? _ventaMonedaActual : _pptoMonedaActual };
  }
  function original(kind, data) { return kind === 'venta' ? window._ventaEditandoOriginal || null : data.edit ? buscarPptoPorRef(data.edit) : null; }
  function begin(kind) {
    if (restoring || !user()) return;
    var data = capture(kind);
    sessions[kind] = { id: Date.now() + '-' + Math.random().toString(36).slice(2), base: JSON.stringify(data), baseData:data, last: JSON.stringify(data), original: original(kind, data) ? JSON.parse(JSON.stringify(original(kind, data))) : null };
  }
  function save(kind) {
    if (restoring || !user() || owner !== user()) return;
    var s = sessions[kind]; if (!s) { if (visible(kind)) begin(kind); return; }
    var data = capture(kind), json = JSON.stringify(data); if (json === s.last) return;
    var meaningful = data.edit || data.rows.some(function (r) { return r.cod.trim() || r.price || (r.desc.trim() && r.desc.trim() !== 'Seleccioná un producto'); }) || data.fields.some(function (f) { return ['cli-inp', 'venta-obs', 'desc-general', 'pp-cli', 'pp-descuento','pp-obs','pp-titulo-solucion'].indexOf(f.id) >= 0 && f.value.trim() && f.value !== '0'; }) || data.fields.some(function (f) { return !f.id && f.value.trim(); });
    var d = { schema: 1, id: s.id, kind: kind, updated: Date.now(), data: data, original: s.original };
    if (s.baseData) d.baseData=s.baseData;
    try {
      if (json === s.base || !meaningful) {
        var previous; try { previous = JSON.parse(localStorage.getItem(prefix() + s.id)); } catch (_) {}
        // No publicar eliminaciones de un borrador vacío que nunca existió.
        // Conservar la marca previa evita revivirlo desde otra pestaña.
        if (previous && !previous.deleted) publish(tombstone(s.id));
      }
      else { localStorage.setItem(prefix() + s.id, JSON.stringify(d)); publish(d); }
      s.last = json; failed = false; badges();
    } catch (_) { warn(); }
  }
  function flush() { ['venta', 'presupuesto'].forEach(function (k) { if (visible(k)) save(k); }); }
  function complete(kind) {
    var s = sessions[kind];
    if (s && owner === user()) { try {
      var saved = JSON.parse(localStorage.getItem(prefix() + s.id));
      if ((saved && !saved.deleted) || (pending[s.id] && !pending[s.id].deleted) || cloudSending?.ids.includes(s.id)) publish(tombstone(s.id));
    } catch (_) { warn(); } }
    delete sessions[kind]; badges(); notifyObservers();
  }
  function badges() {
    var counts = {venta:0,presupuesto:0};
    records().forEach(function(d){ counts[d.kind]++; });
    document.querySelectorAll('[data-draft-count]').forEach(function (el) { var kind = el.closest('#vtab-borradores') ? 'venta' : 'presupuesto'; var count = counts[kind]; if(el.textContent!==String(count))el.textContent=count;if(el.hidden!==!count)el.hidden=!count; });
    if (window._svDraftGrid) renderGrid();
    if (window._svSalesDraftGrid) renderGrid('venta');
  }
  function discard(d) {
    localStorage.removeItem(prefix() + d.id);
    publish(tombstone(d.id));
    Object.keys(sessions).forEach(function (k) { if (sessions[k].id === d.id) delete sessions[k]; });
    badges(); notifyObservers();
  }
  function renderGrid(kind) {
    kind = kind || 'presupuesto';
    var sale = kind === 'venta';
    var body = document.getElementById(sale ? 'ventas-tbody' : 'ppto-tbody-main'); if (!body) return;
    var query = String((document.getElementById(sale ? 'ventas-search' : 'ppto-buscar') || {}).value || '').toLocaleLowerCase('es-AR');
    var list = records().filter(function(d) { return d.kind === kind && JSON.stringify(d.data.fields).toLocaleLowerCase('es-AR').includes(query); });
    var signature = JSON.stringify([query,list]);
    if (body.dataset.draftSignature === signature && body.querySelector('[data-draft-row]')) return;
    body.dataset.draftSignature = signature;
    body.replaceChildren();
    list.forEach(function(d) {
      var row = document.createElement('tr');
      var customer = d.data.fields.find(function(f) { return f.id === 'cli-inp' || f.id === 'pp-cli'; });
      var values = [((d.original || {}).id || (d.kind === 'venta' ? 'Nueva venta' : 'Nuevo presupuesto')),new Date(d.updated).toLocaleString('es-AR'),customer && customer.value || 'CONSUMIDOR FINAL','—','—',new Date(d.updated + TTL).toLocaleDateString('es-AR'),'Borrador · ' + (d.data.edit ? 'Edición' : 'Nuevo'),typeof currentUser !== 'undefined' ? currentUser : 'Mi usuario'];
      if (sale) values = [values[0],values[2],'Borrador · '+(d.data.edit ? 'Edición' : 'Nuevo'),values[1],'—','—','—',values[7],'—'];
      values.forEach(function(text) { var cell=document.createElement('td'); cell.textContent=text; row.appendChild(cell); });
      var actions=document.createElement('td');
      var resume=document.createElement('button');resume.className='btn btn-sm btn-primary';resume.textContent='Continuar';resume.onclick=function(){restore(d);};actions.appendChild(resume);
      var remove=document.createElement('button');remove.className='btn btn-sm';remove.textContent='Descartar';remove.onclick=async function(){if(await svConfirm('¿Descartar este borrador? La operación original no se modifica.')) discard(d);};actions.appendChild(remove);
      row.appendChild(actions);body.appendChild(row);
    });
    if (!list.length) { var row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=sale ? 10 : 9;cell.textContent='No hay borradores pendientes.';row.appendChild(cell);body.appendChild(row); }
    Array.from(body.rows).forEach(function(row){row.setAttribute('data-draft-row','1');});
  }
  function installButtons() {
    ['ventas-list-view'].forEach(function (id) {
      var host = document.getElementById(id); if (!host || host.querySelector('.sv-drafts-access')) return;
      var reference = document.getElementById('tab-borradores');
      var tabs = document.getElementById('vtab-anuladas');
      if (!reference || !tabs || !tabs.parentElement) return;
      var btn = reference.cloneNode(true);
      btn.id = 'vtab-borradores';
      btn.className = 'btn btn-sm sv-drafts-access';
      btn.removeAttribute('onclick');
      btn.onclick = function(){flush();tabVentas('borradores',btn);};
      tabs.parentElement.appendChild(btn);
    });
  }
  function open() {
    flush(); var old = document.getElementById('sv-drafts-dialog'); if (old) old.remove();
    var dialog = document.createElement('dialog'); dialog.id = 'sv-drafts-dialog'; dialog.style.cssText = 'background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:14px;width:min(640px,90vw);max-height:85vh;padding:20px';
    var title = document.createElement('h3'); title.textContent = 'Borradores'; dialog.appendChild(title);
    var info = document.createElement('p'); info.textContent = 'Borradores de tu usuario, sincronizados entre equipos cuando hay conexión. Se descartan a los 30 días del último cambio.'; dialog.appendChild(info);
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
        discard(d); dialog.close(); dialog.remove(); badges(); open();
      }; row.appendChild(remove); dialog.appendChild(row);
    });
    var close = document.createElement('button'); close.className = 'btn'; close.textContent = 'Cerrar'; close.onclick = function () { dialog.close(); dialog.remove(); }; dialog.appendChild(close); document.body.appendChild(dialog); dialog.showModal();
  }
  function restore(d, dialog) {
    if (!permisoModulo(d.kind === 'venta' ? 'venta' : 'presupuesto')) { notify('Acceso restringido para tu rol.'); return; }
    if (!valid(d, Date.now())) { notify('El borrador venció.'); return; }
    var current = d.data.edit ? (d.kind === 'venta' ? (ventasList || []).find(function (v) { return v.fbKey === d.data.edit; }) : buscarPptoPorRef(d.data.edit)) : null;
    if (d.data.edit && (!current || !(d.kind === 'venta' ? puedeEditarVentaPermiso(current) : puedeEditarPresupuestoPermiso(current)))) { notify('La operación ya no está disponible para edición.'); return; }
    var changed = current && !same(current,d.original);
    if (changed && (d.kind !== 'venta' || !d.original || typeof cargarRegistroVentaEnEditor !== 'function')) { notify('La operación original cambió. Revisala antes de recuperar este borrador para no sobrescribir cambios posteriores.'); return; }
    flush(); restoring = true; if (dialog) { dialog.close(); dialog.remove(); }
    svNavegarDirecto(d.kind === 'venta' ? 'venta' : 'presupuesto', function () {
      try {
        var conflicts=[],baseData=d.baseData;
        if (changed) {
          // Solo preparar formularios; no escribir ventas ni descartar el respaldo.
          iniciarNuevaVenta(); cargarRegistroVentaEnEditor(d.original);
          baseData=baseData || capture('venta');
          iniciarNuevaVenta(); cargarRegistroVentaEnEditor(current);
          var latest=capture('venta'),merged=mergeForm(baseData,d.data,latest);
          conflicts=merged.conflicts;
          d=Object.assign({},d,{data:merged.data});
          baseData=latest;
        }
        if (d.kind === 'venta') iniciarNuevaVenta(); else abrirNuevoPresupuesto();
        var scope = root(d.kind), elements = Array.from(scope.querySelectorAll('input,select,textarea')).filter(function (el) { return !el.closest('tbody') && el.type !== 'file' && el.type !== 'password'; });
        d.data.fields.forEach(function (f) { if (f.id === 'vf-numero-preview') return; var el = f.id ? document.getElementById(f.id) : elements[f.index]; if (el && scope.contains(el)) { el.value = f.value; if (el.type === 'checkbox' || el.type === 'radio') el.checked = f.checked; Object.assign(el.dataset, f.data); } });
        var body = document.getElementById(d.kind === 'venta' ? 'det-body' : 'pp-body'); body.replaceChildren();
        d.data.rows.forEach(function (r) {
          var tr = crearFilaProducto(r.cod, r.desc, r.price, r.qty, r.disc); Object.assign(tr.dataset, r.data); body.appendChild(tr);
          var p = tr.querySelector('.price'); if (p) { p.value = r.priceText; Object.assign(p.dataset, r.priceData || {}, { raw: r.price }); }
          if (r.data.creditoHistorico === '1') tr.querySelectorAll('.qty,.price,.disc').forEach(function (el) { el.readOnly = true; });
          if (d.kind === 'presupuesto') tr.querySelectorAll('.qty,.price,.disc').forEach(function (el) { el.addEventListener('input', calcPpTotales); });
        });
        if (d.kind === 'venta') { window._ventaEditandoFbKey = d.data.edit || null; window._ventaEditandoOriginal = current; var preview=document.getElementById('vf-numero-preview'); if(current && preview)preview.value=current.id || ''; _ventaMonedaActual = d.data.currency; _ventaImpConDetalle = d.data.detail; aplicarEstadoIvaVenta(d.data.iva, false); actualizarVisualMonedaVenta(); calcTotals(); }
        else { window._pptoEditandoFbKey = d.data.edit || null; window._pptoEditandoId = d.data.editId || null; _pptoMonedaActual = d.data.currency; _pptoConDetalle = d.data.detail; _pptoConIva = d.data.iva; calcPpTotales(); }
        var ivaButton = document.getElementById(d.kind === 'venta' ? 'btn-toggle-iva-venta' : 'btn-toggle-iva-ppto');
        if (ivaButton) ivaButton.innerHTML = '<i class="ti ti-receipt-tax"></i> ' + (d.data.iva ? 'Con IVA' : 'Sin IVA');
        var detailLabel = document.getElementById(d.kind === 'venta' ? 'label-detalle-venta' : 'ppto-detalle-label');
        if (detailLabel) detailLabel.textContent = d.data.detail ? 'Con detalle' : 'Sin detalle';
        if (d.kind === 'presupuesto') {
          if (typeof iaMarcarPresupuesto === 'function') iaMarcarPresupuesto(d.data.creadoConIA === true);
          var label = document.getElementById('pmt-label'); if (label) label.textContent = d.data.currency;
          var thumb = document.getElementById('pmt-thumb'); if (thumb) thumb.style.transform = d.data.currency === 'USD' ? 'translateX(16px)' : 'translateX(0)';
        }
        sessions[d.kind] = { id: conflicts.length ? Date.now()+'-'+Math.random().toString(36).slice(2) : d.id, base: '', baseData:baseData, last: JSON.stringify(capture(d.kind)), original: current ? JSON.parse(JSON.stringify(current)) : d.original };
        notify(conflicts.length ? 'Borrador recuperado conservando los valores actuales en: '+conflicts.join(', ')+'. El borrador original queda disponible para revisar esas diferencias.' : 'Borrador recuperado. Se conservaron los cambios posteriores de la venta. Revisá y guardá para confirmar.');
      } finally { restoring = false; }
    });
  }
  window.svDrafts = { begin: begin, flush: flush, complete: complete, renderGrid:renderGrid, subscribe: subscribe, leave: function (kind) { flush(); delete sessions[kind]; } };
  document.addEventListener('input', function () { flush(); });
  document.addEventListener('change', function () { flush(); });
  document.addEventListener('click', flush, true);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
  window.addEventListener('storage', function(e) {
    if (e.key && e.key.indexOf(prefix()) === 0 && !e.newValue) {
      Object.keys(sessions).forEach(function(k) { if (prefix() + sessions[k].id === e.key) delete sessions[k]; });
    }
    badges();
    if (!e.key || e.key.indexOf(prefix()) === 0) notifyObservers();
  });
  window.addEventListener('focus', resumeCloud);
  window.addEventListener('online', resumeCloud);
  document.addEventListener('sisventas:session-ready', function() { suspended = false; resumeCloud(); });
  document.addEventListener('sisventas:session-ended', function() { suspended = true; stopCloud(); owner = ''; sessions = {}; });
  document.addEventListener('sisventas:role-changed', function() { notifyObserverContext(); resumeCloud(); });
  document.addEventListener('sisventas:page-changed', resumeCloud);
  document.addEventListener('visibilitychange', function() { if (!document.hidden) resumeCloud(); });
  setInterval(function () {
    if (owner !== user()) { stopCloud(); owner = user(); sessions = {}; }
    // Sólo captura local: sin reconexión ni reenvío por reloj. La publicación
    // debounced existe únicamente cuando el contenido del borrador cambió.
    if (!canSync()) { if (unsubscribe || cloudOwner) stopCloud(); }
    flush();
    if(!document.hidden){ installButtons(); badges(); }
  }, 1000);
})();
