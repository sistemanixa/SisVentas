(function(root) {
  'use strict';
  const CATEGORY = 'COMPRAS PARAGUAY';
  const eligible = p => !!p && p.categoria === CATEGORY && p.estado !== 'Inactivo' && p.activo !== false && !p.esManoDeObra;
  const quote = p => {
    const row = (p.proveedores || []).find(r => { try { return /^(?:www\.|mobile\.)?comprasparaguai\.com\.br$/.test(new URL(r.url).hostname); } catch (_) { return false; } });
    return {usd: row && row.monedaOriginal === 'USD' ? Number(row.precioOriginal) || 0 : 0, ars: Number(row && (row.costoRealArs || row.precio) || p.compraARS || p.compra) || 0, url: row && row.url || p.codWeb || ''};
  };
  const csvCell = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
  const csv = (items, products) => '\uFEFF' + [['Código','Producto','Cantidad','USD unitario','Costo ARS unitario con envío','URL'], ...Object.entries(items).map(([key, qty]) => {
    const p = products[key]; if (!eligible(p)) return null;
    const q = quote(p); return [p.codigo || '', p.nombre || p.descripcion || '', qty, q.usd || '', q.ars || '', q.url];
  }).filter(Boolean)].map(row => row.map(csvCell).join(';')).join('\r\n');
  if (typeof module !== 'undefined') module.exports = {eligible, quote, csv};
  if (!root.document) return;
  let panel, stops = [], products = {}, lists = {}, selected = {}, listKey = '', busy = false, generation = 0;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amount = n => Number(n).toLocaleString('es-AR', {minimumFractionDigits:2,maximumFractionDigits:2});
  function close() {
    generation++;
    stops.forEach(stop => stop()); stops = [];
    panel?.remove(); panel = null; products = {}; lists = {}; selected = {}; listKey = ''; busy = false;
  }
  function renderProducts() {
    const search = panel.querySelector('[data-search]').value.toLowerCase();
    const rows = Object.entries(products).filter(([,p]) => eligible(p) && [p.nombre,p.descripcion,p.codigo,p.marca].join(' ').toLowerCase().includes(search));
    panel.querySelector('[data-count]').textContent = rows.length + (rows.length === 1 ? ' producto' : ' productos') + ' · COMPRAS PARAGUAY';
    panel.querySelector('[data-products]').innerHTML = rows.map(([key,p]) => {
      const q = quote(p);
      let url = ''; try { if (/^https?:$/.test(new URL(q.url).protocol)) url = q.url; } catch (_) {}
      return '<article class="catalogo-card" data-detail="'+esc(key)+'" tabindex="0" aria-label="Ver '+esc(p.nombre || p.descripcion)+'"><div class="catalogo-card-imagen">'+root.imagenCatalogoHTML(p, 'catalogo-card-img')+'</div><div class="catalogo-card-body"><span class="catalogo-card-cat">COMPRAS PARAGUAY</span><h3>'+esc(p.nombre || p.descripcion)+'</h3><div class="catalogo-card-marca">'+esc(p.marca)+' · '+esc(p.codigo)+'</div><p>'+esc(p.catalogoDescripcion || p.descripcion || '')+'</p><div class="catalogo-card-footer"><strong class="catalogo-precio">'+(q.usd?'US$ '+amount(q.usd):'Sin precio USD')+'</strong><span style="font-size:12px;color:var(--text3)">'+(q.ars?'$ '+amount(q.ars)+' con envío':'Sin costo ARS')+'</span></div><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:16px"><label style="font-size:12px" hidden>Cantidad <input class="search-input" type="number" min="0" max="9999" step="1" aria-label="Cantidad '+esc(p.codigo || p.nombre)+'" data-product="'+esc(key)+'" value="'+(selected[key] || 0)+'" style="width:85px;margin-top:6px"></label><span class="catalogo-ver">Ver producto →</span><button class="catalogo-restar" data-subtract="'+esc(key)+'" aria-label="Quitar una unidad"'+((selected[key] || 0)?'':' hidden')+'><i class="ti ti-minus" aria-hidden="true"></i></button><button class="catalogo-agregar-carrito" data-add="'+esc(key)+'" aria-label="Agregar '+esc(p.nombre || p.codigo)+' al carrito"><i class="ti ti-shopping-cart-plus" aria-hidden="true"></i><span class="catalogo-producto-contador" data-card-count="'+esc(key)+'" '+((selected[key] || 0)?'':'hidden')+'>'+(selected[key] || 0)+'</span></button>'+'</div></div></article>';

    }).join('') || '<div class="catalogo-vacio" style="display:flex;grid-column:1/-1"><strong>No hay productos para mostrar</strong><span>Probá otra búsqueda.</span></div>';
    renderSummary();
  }
  function showDetail(key) {
    const p = products[key]; if (!eligible(p)) return;
    panel.querySelector('[data-detail-modal]')?.remove();
    const previous = document.activeElement, q = quote(p);
    const modal = document.createElement('div');
    modal.className='catalogo-modal';modal.dataset.detailModal='';modal.style.display='flex';
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',p.nombre || p.descripcion);
    modal.innerHTML='<div class="catalogo-modal-card"><button class="catalogo-modal-close" data-close-detail aria-label="Cerrar detalle">×</button><div class="catalogo-modal-imagen">'+root.imagenCatalogoHTML(p,'catalogo-modal-img')+'</div><div class="catalogo-modal-info"><span class="catalogo-card-cat">COMPRAS PARAGUAY</span><h2>'+esc(p.nombre || p.descripcion)+'</h2><div class="catalogo-modal-marca">'+esc(p.marca)+' · '+esc(p.codigo)+'</div><p style="white-space:pre-wrap">'+esc(p.catalogoDescripcion || p.descripcion || 'Sin descripción adicional')+'</p><strong>US$ '+amount(q.usd)+'</strong><p>$ '+amount(q.ars)+' con envío</p><button class="catalogo-agregar-carrito" data-modal-add aria-label="Agregar al carrito"><i class="ti ti-shopping-cart-plus" aria-hidden="true"></i></button><p data-modal-qty aria-live="polite"></p></div></div>';
    const refresh = () => {modal.querySelector('[data-modal-qty]').textContent=(selected[key] || 0)+' unidades en tu lista';};
    const dismiss = () => {modal.remove();if(previous?.isConnected)previous.focus();};
    modal.querySelector('[data-close-detail]').onclick=dismiss;
    modal.onclick=e=>{if(e.target===modal)dismiss();};
    modal.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();dismiss();}if(e.key==='Tab'){const focusable=Array.from(modal.querySelectorAll('button'));const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    modal.querySelector('[data-modal-add]').onclick=()=>{selected[key]=Math.min(9999,(Number(selected[key])||0)+1);renderProducts();refresh();};
    panel.appendChild(modal);refresh();modal.querySelector('[data-close-detail]').focus();
  }
  function renderSummary() {
    const entries = Object.entries(selected).filter(([key]) => eligible(products[key]));
    panel.querySelector('[data-cart-items]').innerHTML = entries.length ? entries.map(([key,qty]) => '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)"><span style="flex:1">'+esc(products[key].nombre || products[key].descripcion)+' <strong>× '+qty+'</strong></span><span>US$ '+amount(quote(products[key]).usd*qty)+'</span><button class="btn btn-sm" data-remove="'+esc(key)+'" aria-label="Quitar '+esc(products[key].nombre)+' del carrito">Quitar</button></div>').join('') : '<p class="py-note">Tu carrito está vacío. Agregá productos desde el catálogo.</p>';
    const missingItems=Object.entries(selected).filter(([key])=>!eligible(products[key]));
    if(missingItems.length)panel.querySelector('[data-cart-items]').insertAdjacentHTML('beforeend',missingItems.map(([key,qty])=>'<div class="py-note">Producto no disponible: '+esc(products[key]?.nombre||key)+' × '+qty+' <button class="btn btn-sm" data-remove="'+esc(key)+'">Quitar producto no disponible</button></div>').join(''));
    const usd = entries.reduce((s,[key,qty]) => s+quote(products[key]).usd*qty,0);
    const ars = entries.reduce((s,[key,qty]) => s+quote(products[key]).ars*qty,0);
    const missing = entries.filter(([key]) => !quote(products[key]).usd).length;
    panel.querySelector('[data-total-products]').textContent = entries.length;
    const units = entries.reduce((s,[,q])=>s+q,0);
    panel.querySelector('[data-total-qty]').textContent = units;
    panel.querySelector('[data-cart-count]').textContent = units;
    panel.querySelector('[data-cart]').setAttribute('aria-label','Ver carrito: '+units+' unidades');
    panel.querySelector('[data-cart-amount]').textContent = '$ '+amount(ars)+' con envío';
    panel.querySelector('[data-total-usd]').textContent = 'US$ '+amount(usd);
    panel.querySelector('[data-total-ars]').textContent = '$ '+amount(ars);
    panel.querySelector('[data-summary]').textContent = (missing ? missing+' productos sin precio USD. ' : '')+'Revisá precios y disponibilidad antes de comprar.';
  }
  function renderLists() {
    panel.querySelector('[data-lists]').innerHTML = '<option value="">Nueva lista</option>'+Object.entries(lists).map(([key,list])=>'<option value="'+esc(key)+'"'+(key===listKey?' selected':'')+'>'+esc(list.nombre)+'</option>').join('');
  }
  function status(text) { if (panel) panel.querySelector('[data-status]').textContent = text; }
  async function open(nombre, options = {}) {
    close();
    const admin = root.currentRole === 'admin' && root.permisoModulo?.('balancecompra');
    if ((!admin && root.currentRole !== 'compras_paraguay') || !root.currentUserUid) return;
    const actor = root.currentUserUid, role = root.currentRole, session = generation;
    const uid = admin && options.ownerUid || actor;
    const valid = () => generation === session && root.currentUserUid === actor && root.currentRole === role;
    const roleQuery = root.fbRef(root.fbDB, 'sv_chat_roles/'+actor);
    const identity = (await root.fbGet(roleQuery)).val();
    if (!valid()) return;
    if (!identity || identity.rol !== role || identity.activo !== true) throw new Error('No se pudo verificar el acceso de Compras Paraguay');
    panel = document.createElement('main'); panel.id = 'screen-paraguay';
    panel.innerHTML = `
      <style>
        #screen-paraguay{display:flex;height:100dvh;flex-direction:column;background:var(--bg);color:var(--text)}
        #screen-paraguay .nav-item{width:100%;font-family:inherit;text-align:left;background:transparent}
        #screen-paraguay .nav-item.active{background:var(--bg3)}
        #screen-paraguay .py-list-fields{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,2fr);gap:14px}
        #screen-paraguay .py-note{font-size:12px;color:var(--text3);line-height:1.5;margin:10px 0 0}
        #screen-paraguay .py-provider-link{display:inline-flex;align-items:center;gap:4px;color:var(--blue);font-size:11px;margin-top:5px;text-decoration:none}
        #screen-paraguay .py-provider-link:hover{text-decoration:underline}
        #screen-paraguay .m-value{font-size:20px;overflow-wrap:anywhere}
        #screen-paraguay .py-actions{display:flex;gap:8px;flex-wrap:wrap}
        #screen-paraguay .py-menu{display:none}
        #screen-paraguay .content{padding-bottom:65px}
        #screen-paraguay .table-wrap{overflow:auto}
        #screen-paraguay table{min-width:680px}
        #screen-paraguay [data-status]:empty{display:none}
        #screen-paraguay [data-status]{font-size:12px;color:var(--blue);margin-top:12px}
        @media(max-width:1100px){#screen-paraguay .py-menu{display:inline-flex}}
        @media(max-width:768px){#screen-paraguay .py-menu{display:inline-flex}#screen-paraguay .py-list-fields{grid-template-columns:1fr}#screen-paraguay .topbar{grid-template-columns:minmax(0,1fr) auto}#screen-paraguay .topbar-center{display:none}#screen-paraguay .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style>
      <div class="app">
        <aside class="sidebar" aria-label="Navegación de Compras Paraguay">
          <div class="s-logo"><div class="s-brand">SisVentas</div><div class="s-sub">powered by Nixa</div></div>
          <nav class="s-nav"><div class="s-section">Compras</div><button class="nav-item active" data-nav="products"><i class="ti ti-package" aria-hidden="true"></i> Productos Paraguay</button><button class="nav-item" data-nav="lists"><i class="ti ti-list-check" aria-hidden="true"></i> Mis listas de compra</button></nav>
          <div class="s-foot"><div class="s-user"><div class="s-avatar admin">${esc(nombre.slice(0,2).toUpperCase())}</div><div style="min-width:0"><div class="s-uname">${esc(nombre)}</div><div class="s-urole">Compras Paraguay</div></div></div><button class="btn btn-sm" data-logout style="width:100%;justify-content:center;margin-top:8px"><i class="ti ti-logout" aria-hidden="true"></i> Cerrar sesión</button></div>
        </aside>
        <div class="main">
          <header class="topbar"><div style="display:flex;align-items:center;gap:10px"><button class="btn btn-icon py-menu" data-menu aria-label="Abrir menú" aria-expanded="false"><i class="ti ti-menu-2" aria-hidden="true"></i></button><span class="page-title">Productos Paraguay</span></div><div class="topbar-center"><span class="topbar-date">${esc(new Date().toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short',year:'numeric'}))}</span></div><div class="topbar-right"><button class="btn btn-sm" data-cart aria-label="Ver carrito"><i class="ti ti-shopping-cart" aria-hidden="true"></i> <span class="catalogo-carrito-contador" data-cart-count aria-live="polite">0</span><span data-cart-amount></span></button><button class="catalogo-agregar-carrito" style="width:44px;height:44px;font-size:22px;border-radius:14px" data-open-list aria-label="Abrir lista de compra"><i class="ti ti-file-description" aria-hidden="true"></i><i class="ti ti-arrow-right" aria-hidden="true"></i></button><button class="icon-btn" data-appearance aria-label="Aspecto visual" title="Aspecto visual"><i class="ti ti-settings" aria-hidden="true"></i></button></div></header>
          <div class="content">
            <div class="metrics" aria-label="Resumen de la lista">
              <div class="metric"><div class="m-label">Productos seleccionados</div><div class="m-value" data-total-products>0</div><div class="m-sub">en tu lista de compra</div></div>
              <div class="metric"><div class="m-label">Unidades a comprar</div><div class="m-value" data-total-qty>0</div><div class="m-sub">cantidad total</div></div>
              <div class="metric"><div class="m-label">Precio página USD</div><div class="m-value" data-total-usd style="color:var(--blue)">US$ 0,00</div><div class="m-sub">total de productos</div></div>
              <div class="metric"><div class="m-label">Costo total ARS</div><div class="m-value" data-total-ars style="color:var(--amber)">$ 0,00</div><div class="m-sub">incluye envío registrado</div></div>
            </div>
            <section class="card" data-list-card aria-label="Lista de compra">
              <div class="card-head"><span class="card-title">Lista de compra</span><div class="py-actions"><button class="btn btn-sm" data-download><i class="ti ti-download" aria-hidden="true"></i> Descargar CSV</button><button class="btn btn-sm btn-primary" data-save><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar lista</button></div></div>
              <div class="py-list-fields"><div class="fg"><label for="py-mis-listas">Mis listas</label><select id="py-mis-listas" data-lists><option value="">Nueva lista</option></select></div><div class="fg"><label for="py-lista-nombre">Nombre de la lista</label><input id="py-lista-nombre" data-name maxlength="120" placeholder="Ej. Próximo viaje"></div></div>
              <div data-cart-items aria-label="Productos del carrito"></div><p class="py-note" data-summary></p><p data-status role="status"></p>
            </section>
            <section class="card" data-products-card aria-label="Productos Paraguay">
              <div class="card-head"><span class="card-title">Productos Paraguay</span><span class="badge">COMPRAS PARAGUAY</span></div>
              <input class="search-input" data-search aria-label="Buscar producto" placeholder="Buscar por nombre, código o marca…" style="width:100%">
              <p class="py-note" data-count style="margin-bottom:16px"></p>
              <div class="catalogo-grid" data-products></div>
              <p class="py-note">Los precios corresponden a la última información registrada.</p>
            </section>
          </div>
        </div>
      </div>`;
    document.body.appendChild(panel);
    if (admin) {
      panel.style.cssText = 'position:fixed;inset:0;z-index:10000';
      panel.querySelector('.s-urole').textContent = 'Administrador · Compras Paraguay';
      panel.querySelector('[data-logout]').textContent = 'Volver a Compras de exterior';
      const back = document.createElement('button');
      back.className = 'btn btn-sm';back.textContent = '← Compras de exterior';
      back.onclick = () => {if(!busy){close();options.onClose?.();}};
      panel.querySelector('.topbar-right').prepend(back);
      panel.querySelector('.page-title').textContent = 'Paraguay · ' + (options.ownerName || 'Mis listas');
      const ownerNote = document.createElement('p');
      ownerNote.className = 'py-note';
      ownerNote.textContent = 'Listas de: ' + (options.ownerName || nombre) + '. Los cambios se guardan para este usuario.';
      panel.querySelector('[data-list-card]').prepend(ownerNote);
    }
    panel.querySelector(".content").prepend(panel.querySelector("[data-products-card]"));
    const preferences = document.createElement('div');
    preferences.hidden = true;
    preferences.setAttribute('role','dialog'); preferences.setAttribute('aria-label','Aspecto visual');
    preferences.style.cssText = 'position:fixed;right:12px;top:60px;z-index:999999;width:min(280px,calc(100vw - 24px));padding:18px;border:1px solid var(--border);border-radius:14px;background:var(--bg2);box-shadow:0 8px 24px #0003';
    preferences.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><strong>Aspecto visual</strong><button class="btn btn-sm" data-close-appearance aria-label="Cerrar apariencia">×</button></div><div class="up-style-options" style="margin-top:14px"><button class="btn" data-visual="v3">SisVentas 3</button><button class="btn" data-visual="classic">Clásico</button></div><label style="display:flex;align-items:center;justify-content:space-between;margin-top:18px">Modo oscuro<input type="checkbox" data-dark></label>';
    panel.appendChild(preferences);
    panel.querySelector('[data-appearance]').onclick = () => {preferences.hidden = !preferences.hidden;preferences.querySelector('[data-dark]').checked=document.body.classList.contains('dark-mode');};
    preferences.querySelector('[data-close-appearance]').onclick = () => {preferences.hidden=true;panel.querySelector('[data-appearance]').focus();};
    preferences.onkeydown = e => {if(e.key==='Escape'){preferences.hidden=true;panel.querySelector('[data-appearance]').focus();}};
    preferences.querySelector('[data-dark]').onchange = e => root.toggleDarkMode(e.target.checked);
    preferences.querySelectorAll('[data-visual]').forEach(button => button.onclick=()=>root.aplicarEstiloVisual(button.dataset.visual));

    panel.querySelector('[data-menu]').onclick = () => {
      const expanded = panel.querySelector('.sidebar').classList.toggle('open');
      panel.querySelector('[data-menu]').setAttribute('aria-expanded', String(expanded));
    };
    panel.querySelectorAll('[data-nav]').forEach(button => button.onclick = () => {
      panel.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b===button));
      const listsView = button.dataset.nav === 'lists';
      panel.querySelector('.page-title').textContent = listsView ? 'Mis listas de compra' : 'Productos Paraguay';
      panel.querySelector(listsView ? '[data-list-card]' : '[data-products-card]').scrollIntoView({behavior:'smooth',block:'start'});
      panel.querySelector('.sidebar').classList.remove('open');
      panel.querySelector('[data-menu]').setAttribute('aria-expanded','false');
    });
    panel.querySelector('[data-logout]').onclick = () => {if(admin){if(!busy){close();options.onClose?.();}}else root.doLogout();};
    panel.querySelector('[data-search]').oninput = renderProducts;
    panel.querySelector('[data-cart-items]').onclick = e => {const button=e.target.closest('[data-remove]');if(button){delete selected[button.dataset.remove];renderProducts();}};
    panel.querySelector('[data-cart]').onclick = () => panel.querySelector('[data-list-card]').scrollIntoView({behavior:'smooth',block:'start'});
    panel.querySelector('[data-open-list]').onclick = panel.querySelector('[data-cart]').onclick;
    panel.querySelector('[data-products]').onclick = e => {
      const minus=e.target.closest('[data-subtract]');if(minus){const key=minus.dataset.subtract;if(selected[key]>1)selected[key]--;else delete selected[key];renderProducts();return;}
      const button = e.target.closest('[data-add]'); if (!button) {if(!e.target.closest('input,label,a')){const card=e.target.closest('[data-detail]');if(card)showDetail(card.dataset.detail);}return;}
      const key = button.dataset.add; if (!eligible(products[key])) return;
      selected[key] = Math.min(9999, (Number(selected[key]) || 0) + 1);
      const input = button.closest('.catalogo-card').querySelector('[data-product]');
      input.value = selected[key]; input.setCustomValidity(''); renderProducts();
    };
    panel.querySelector('[data-products]').onkeydown = e => {if(e.target.matches('[data-detail]') && (e.key==='Enter'||e.key===' ')){e.preventDefault();showDetail(e.target.dataset.detail);}};
    panel.querySelector('[data-products]').oninput = e => {
      const key = e.target.dataset.product; if (!key) return;
      const qty = Number(e.target.value);
      e.target.setCustomValidity(Number.isInteger(qty) && qty >= 0 && qty <= 9999 ? '' : 'Ingresá una cantidad entera entre 0 y 9999');
      if (!e.target.checkValidity()) return;
      if (qty) selected[key] = qty; else delete selected[key]; renderSummary();
    };
    panel.querySelector('[data-lists]').onchange = e => {
      if (busy) return;
      listKey = e.target.value; const list = lists[listKey] || {};
      selected = Object.assign({}, list.productos || {}); panel.querySelector('[data-name]').value = list.nombre || '';
      status(''); renderProducts();
    };
    panel.querySelector('[data-save]').onclick = async () => {
      if (busy || !valid()) return;
      const name = panel.querySelector('[data-name]').value.trim();
      const items = Object.fromEntries(Object.entries(selected).filter(([key])=>eligible(products[key])));
      if (Object.keys(selected).some(key=>!eligible(products[key]))) {status('La lista contiene productos que ya no están disponibles. Quitalos de la lista antes de guardar.');return;}
      if (!name || !Object.keys(items).length) { status('Completá el nombre y elegí al menos un producto con cantidad.'); return; }
      for (const input of panel.querySelectorAll('[data-product]')) if (!input.reportValidity()) return;
      busy = true; panel.querySelector('[data-save]').disabled = true; panel.querySelector('[data-lists]').disabled = true;
      const key = listKey || root.fbPush(root.fbRef(root.fbDB,'sv_listas_paraguay/'+uid)).key;
      try {
        await root.fbSet(root.fbRef(root.fbDB,'sv_listas_paraguay/'+uid+'/'+key),{nombre:name,productos:items,actualizadoEn:root.fbServerTimestamp()});
        if(valid()&&panel){listKey = key;renderLists();status('Lista guardada. No se generó una orden de compra.');}
      } catch (e) {if(valid())status('No se pudo guardar la lista. Revisá la conexión y el acceso.');}
      finally {if(valid()){busy=false;if(panel){panel.querySelector('[data-save]').disabled=false;panel.querySelector('[data-lists]').disabled=false;}}}
    };
    panel.querySelector('[data-download]').onclick = () => {
      if (!Object.keys(selected).some(key=>eligible(products[key]))) {status('Elegí al menos un producto para descargar.');return;}
      const blob = new Blob([csv(selected,products)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='lista-compras-paraguay.csv';link.click();URL.revokeObjectURL(url);
    };
    const query = root.fbQuery(root.fbRef(root.fbDB,'sisventas/productos'),root.fbOrderByChild('categoria'),root.fbEqualTo(CATEGORY));
    stops.push(root.fbOnValue(query,snap=>{if(!valid())return;products=snap.val()||{};if(panel)renderProducts();},()=>status('No se pudo cargar el catálogo autorizado.')));
    let initialList = options.listKey || '';
    stops.push(root.fbOnValue(root.fbRef(root.fbDB,'sv_listas_paraguay/'+uid),snap=>{if(!valid())return;lists=snap.val()||{};if(panel){if(initialList){listKey=initialList;initialList='';const list=lists[listKey]||{};selected={...list.productos};panel.querySelector('[data-name]').value=list.nombre||'';renderProducts();}renderLists();}},()=>status('No se pudieron cargar tus listas.')));
    stops.push(root.fbOnValue(roleQuery,snap=>{if(!valid())return;const identity=snap.val();if(!identity||identity.activo!==true||identity.rol!==role){close();root.doLogout();}}));
    renderProducts();
  }
  const originalRoles = root._renderTablaRolesUI;
  if (typeof originalRoles === 'function') root._renderTablaRolesUI = function() {
    originalRoles.apply(this,arguments);
    const container = document.getElementById('cfg-roles-tabla');
    if (container) container.insertAdjacentHTML('afterbegin','<section class="card" aria-label="Rol Compras Paraguay"><div class="card-head"><span class="card-title">Compras Paraguay</span><span class="badge">Acceso limitado</span></div><p>Catálogo exclusivo de la categoría COMPRAS PARAGUAY, listas de compra propias y ajustes de apariencia.</p><p style="font-size:12px;color:var(--text3)">Este rol se asigna desde Usuarios. No tiene acceso a los módulos generales ni modifica productos.</p></section>');
  };
  document.addEventListener('sisventas:session-ended',close);
  root.SVParaguayPortal = {open,close};
})(typeof window === 'undefined' ? {} : window);
