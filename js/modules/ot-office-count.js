(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const keyOK = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  const allowed = () => !root._impersonacionOriginal && root.permisoModulo?.('ordentrabajo') && root.tienePermiso?.('ot.ajustarStockOficina');
  const canonical = value => value == null ? 'null' : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : typeof value === 'object' ? '{' + Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}' : JSON.stringify(value);
  async function hash(value) {
    return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value))))).map(b => b.toString(16).padStart(2,'0')).join('');
  }
  function button(ot, material, index) {
    return allowed() && material?.stockPendiente === true && material.adicionalOT === true
      ? '<button type="button" class="btn btn-sm" onclick="SVOTOfficeCount.open(' + Number(index) + ')">Contar stock de oficina</button>' : '';
  }
  async function open(index) {
    if (!allowed() || document.getElementById('sv-ot-office-count')) return;
    const current = (root.otData || []).find(ot => ot.fbKey === root.otActualId || ot.id === root.otActualId);
    const material = current?.materiales?.[index];
    const product = Object.values(root.prodData || root.productosData || {}).find(p => material?.productoKey ? p.fbKey === material.productoKey : String(p.codigo || p.cod) === String(material?.cod || material?.codigo));
    const otKey = current?.fbKey, productKey = material?.productoKey || product?.fbKey;
    if (!keyOK(otKey) || !keyOK(productKey)) { root.notify?.('No se encontró el producto o la OT.'); return; }
    const uid = root.currentUserUid, user = root.fbAuth?.currentUser, captured = root.svCapturarContextoOperacion?.();
    const live = () => allowed() && uid === root.currentUserUid && user === root.fbAuth?.currentUser && (!captured || captured());
    const focus = document.activeElement, overflow = document.body.style.overflow, dialog = document.createElement('dialog');
    let busy = false, closed = false, originalOT, inventory, command;
    dialog.id = 'sv-ot-office-count';
    dialog.style.cssText = 'width:min(560px,94vw);max-height:92dvh;margin:auto;padding:0;border:1px solid var(--border2,#34435d);border-radius:16px;background:var(--bg2,#101b2d);color:var(--text,#edf3fc);overflow:auto';
    dialog.innerHTML = '<style>#sv-ot-office-count::backdrop{background:#020812b8}#sv-ot-office-count .oc-head{position:sticky;top:0;background:var(--bg2,#101b2d);padding:16px 20px;border-bottom:1px solid var(--border,#34435d);display:flex;align-items:center;justify-content:space-between;gap:12px}#sv-ot-office-count .oc-body{padding:20px}#sv-ot-office-count label{display:block;margin:18px 0 6px}#sv-ot-office-count input,#sv-ot-office-count textarea{box-sizing:border-box;width:100%;min-height:44px}#sv-ot-office-count .oc-foot{padding:14px 20px;border-top:1px solid var(--border,#34435d);display:flex;justify-content:flex-end;gap:8px;background:var(--bg2,#101b2d)}#sv-ot-office-count .oc-spinner{display:inline-block;width:13px;height:13px;margin-right:6px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:oc-spin .8s linear infinite}@keyframes oc-spin{to{transform:rotate(360deg)}}</style>' +
      '<div class="oc-head"><strong>Stock de oficina</strong><button type="button" class="btn btn-sm" data-close aria-label="Cerrar">×</button></div>' +
      '<div class="oc-body"><div data-product></div><p data-used style="color:var(--text2,#aabbd0)"></p><label for="oc-physical">Cantidad que queda en oficina</label><input id="oc-physical" class="search-input" type="number" min="0" max="1000000000" placeholder="Cantidad contada" disabled>' +
      '<p style="font-size:12px;color:var(--text2,#aabbd0)">Contá lo que queda después de lo usado en esta OT. No incluyas materiales reservados ni los que tiene el técnico.</p><label for="oc-reason">Motivo</label><textarea id="oc-reason" class="search-input" maxlength="240" rows="2" placeholder="Por qué se ajusta la existencia" disabled></textarea><p data-status role="status" aria-live="polite"></p></div>' +
      '<div class="oc-foot"><button type="button" class="btn" data-cancel>Cancelar</button><button type="button" class="btn btn-primary" data-save disabled>Guardar conteo y registrar uso</button></div>';
    const count = dialog.querySelector('#oc-physical'), reason = dialog.querySelector('#oc-reason'), save = dialog.querySelector('[data-save]'), status = dialog.querySelector('[data-status]');
    dialog.querySelector('[data-product]').textContent = (material.cod || material.codigo || '') + ' · ' + (material.desc || material.descripcion || product?.nombre || 'Producto');
    status.innerHTML = '<span class="oc-spinner" aria-hidden="true"></span>Cargando stock…';
    function close() { if (!busy) dialog.close(); }
    dialog.querySelector('[data-close]').onclick = close;
    dialog.querySelector('[data-cancel]').onclick = close;
    dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); close(); });
    dialog.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const elements = [...dialog.querySelectorAll('button,input,textarea')].filter(el => !el.disabled), first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    const endSession = () => dialog.close();
    for (const event of ['sisventas:session-ended','sisventas:role-changed']) document.addEventListener(event,endSession);
    dialog.addEventListener('close', () => {
      closed = true; for (const event of ['sisventas:session-ended','sisventas:role-changed']) document.removeEventListener(event,endSession);
      document.body.style.overflow = overflow; dialog.remove(); if (focus?.isConnected) focus.focus({preventScroll:true});
    },{once:true});
    document.body.appendChild(dialog); document.body.style.overflow = 'hidden'; dialog.showModal();
    function check() { if (closed || !live()) throw Error('La sesión cambió. Volvé a abrir la OT.'); }
    try {
      const otPath = 'sisventas/ordenes_trabajo/' + otKey, invPath = 'sisventas/inventario_operativo/' + productKey;
      const snapshots = await Promise.all([otPath,invPath].map(path => root.fbGet(root.fbRef(root.fbDB,path)))); check();
      originalOT = snapshots[0].val(); inventory = snapshots[1].val();
      const rows = (originalOT?.materiales || []).filter(m => (m.productoKey ? m.productoKey === productKey : String(m.cod || m.codigo) === String(material.cod || material.codigo)) && m.stockPendiente === true);
      if (!rows.length) throw Error('Este producto ya no tiene stock pendiente. Volvé a abrir la OT para ver su estado.');
      const used = rows.reduce((n,m) => n + Number(m.instalada || 0) - Number(m.stockBaseInstalada || 0),0);
      dialog.querySelector('[data-used]').textContent = 'Usado en esta OT: ' + used.toLocaleString('es-AR') + ' · Stock libre registrado: ' + Number(inventory?.general || 0).toLocaleString('es-AR');
      count.step = /^(unidad|unidades|u|un|uni|ud|uds)$/i.test(product?.unidad || 'Unidad') ? '1' : '0.000001';
      count.disabled = reason.disabled = save.disabled = false; status.textContent = ''; count.focus();
    } catch (error) { if (!closed) status.textContent = error.message; }
    save.onclick = async () => {
      if (busy) return;
      busy = true; save.disabled = true;
      try {
        check();
        if (!command) {
          if (count.value.trim() === '' || !Number.isFinite(Number(count.value)) || Number(count.value) < 0 || Number(count.value) > 1e9 || count.step === '1' && !Number.isInteger(Number(count.value))) throw Error('Ingresá una cantidad física válida.');
          if (!reason.value.trim()) { reason.focus(); throw Error('Indicá el motivo del ajuste.'); }
          command = {id:root.crypto.randomUUID(),otKey,productKey,count:Number(count.value),reason:reason.value.trim(),expectedOTHash:await hash(originalOT),expectedInventoryHash:await hash(inventory)};
        }
        check(); count.disabled = reason.disabled = save.disabled = true;
        save.innerHTML = '<span class="oc-spinner" aria-hidden="true"></span>Guardando…'; status.textContent = 'Guardando conteo y registrando el uso…';
        const base = (root.SISVENTAS_FUNCTIONS?.cotizadorProveedor || '').replace(/\/$/,'');
        if (!base) throw Error('No está disponible el guardado.');
        const headers = await root.SVServiceAuth.headers({'Content-Type':'application/json'}); check();
        const response = await root.fetch(base + '/inventario/contar-desde-ot',{method:'POST',headers,body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(90000)});
        const data = await response.json(); check();
        if (!response.ok || data.ok !== true || data.committed !== true || data.operationId !== command.id || !data.ot || !data.inventory) throw Object.assign(Error(data.mensaje || 'No se pudo confirmar el ajuste. Reintentá para comprobar la misma operación.'),{statusCode:response.status});
        Object.assign(current,data.ot,{fbKey:otKey});
        if (root.SisVentasCompras?.state?.inventory) root.SisVentasCompras.state.inventory[productKey] = data.inventory;
        root.otCustodiaRenderMateriales?.(current); root.otCustodiaActualizarResumenGlobal?.(); root.actualizarPanelIntegridadOT?.();
        busy = false; dialog.close(); root.notify?.('Stock de oficina y uso registrados.');
      } catch (error) {
        if (!closed) {
          status.textContent = error.message; save.disabled = false;
          if ([401,403,409].includes(error.statusCode)) {
            status.textContent += ' Cerrá y volvé a abrir el conteo para revisar el estado actual.';
            save.textContent = 'Cerrar y volver a revisar'; save.onclick = close;
          } else {
            if (error.statusCode === 400) command = null;
            if (!command) count.disabled = reason.disabled = false;
            save.textContent = command ? 'Comprobar / reintentar guardado' : 'Guardar conteo y registrar uso';
          }
        }
      } finally { busy = false; }
    };
  }
  root.SVOTOfficeCount = Object.freeze({allowed,button,open});
})(window);
