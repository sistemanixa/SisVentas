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
  let panel, stops = [], products = {}, lists = {}, selected = {}, listKey = '', busy = false;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amount = n => Number(n).toLocaleString('es-AR', {minimumFractionDigits:2,maximumFractionDigits:2});
  function close() {
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
      return '<tr><td style="color:var(--text3)">'+esc(p.codigo)+'</td><td><strong style="color:var(--text)">'+esc(p.nombre || p.descripcion)+'</strong><div style="font-size:11px;color:var(--text3);margin-top:3px">'+esc(p.marca)+'</div>'+(url?'<a class="py-provider-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"><i class="ti ti-external-link" aria-hidden="true"></i> Ver en proveedor</a>':'')+'</td><td class="tr" style="color:var(--blue);white-space:nowrap">'+(q.usd?'US$ '+amount(q.usd):'Sin precio USD')+'</td><td class="tr" style="white-space:nowrap">'+(q.ars?'$ '+amount(q.ars):'Sin costo')+'</td><td class="tr"><input class="search-input" type="number" min="0" max="9999" step="1" aria-label="Cantidad '+esc(p.codigo || p.nombre)+'" data-product="'+esc(key)+'" value="'+(selected[key] || 0)+'" style="width:85px;text-align:right"></td></tr>';
    }).join('');
    renderSummary();
  }
  function renderSummary() {
    const entries = Object.entries(selected).filter(([key]) => eligible(products[key]));
    const usd = entries.reduce((s,[key,qty]) => s+quote(products[key]).usd*qty,0);
    const ars = entries.reduce((s,[key,qty]) => s+quote(products[key]).ars*qty,0);
    const missing = entries.filter(([key]) => !quote(products[key]).usd).length;
    panel.querySelector('[data-total-products]').textContent = entries.length;
    panel.querySelector('[data-total-qty]').textContent = entries.reduce((s,[,q])=>s+q,0);
    panel.querySelector('[data-total-usd]').textContent = 'US$ '+amount(usd);
    panel.querySelector('[data-total-ars]').textContent = '$ '+amount(ars);
    panel.querySelector('[data-summary]').textContent = (missing ? missing+' productos sin precio USD. ' : '')+'Revisá precios y disponibilidad antes de comprar.';
  }
  function renderLists() {
    panel.querySelector('[data-lists]').innerHTML = '<option value="">Nueva lista</option>'+Object.entries(lists).map(([key,list])=>'<option value="'+esc(key)+'"'+(key===listKey?' selected':'')+'>'+esc(list.nombre)+'</option>').join('');
  }
  function status(text) { if (panel) panel.querySelector('[data-status]').textContent = text; }
  async function open(nombre) {
    close();
    if (root.currentRole !== 'compras_paraguay' || !root.currentUserUid) return;
    const uid = root.currentUserUid;
    const roleQuery = root.fbRef(root.fbDB, 'sv_chat_roles/'+uid);
    const identity = (await root.fbGet(roleQuery)).val();
    if (root.currentUserUid !== uid || root.currentRole !== 'compras_paraguay') return;
    if (!identity || identity.rol !== 'compras_paraguay' || identity.activo !== true) throw new Error('No se pudo verificar el acceso de Compras Paraguay');
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
          <header class="topbar"><div style="display:flex;align-items:center;gap:10px"><button class="btn btn-icon py-menu" data-menu aria-label="Abrir menú" aria-expanded="false"><i class="ti ti-menu-2" aria-hidden="true"></i></button><span class="page-title">Productos Paraguay</span></div><div class="topbar-center"><span class="topbar-date">${esc(new Date().toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short',year:'numeric'}))}</span></div><div class="topbar-right"><span class="badge">Compras Paraguay</span></div></header>
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
              <p class="py-note" data-summary></p><p data-status role="status"></p>
            </section>
            <section class="card" data-products-card aria-label="Productos Paraguay">
              <div class="card-head"><span class="card-title">Productos Paraguay</span><span class="badge">COMPRAS PARAGUAY</span></div>
              <input class="search-input" data-search aria-label="Buscar producto" placeholder="Buscar por nombre, código o marca…" style="width:100%">
              <p class="py-note" data-count style="margin-bottom:16px"></p>
              <div class="table-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th class="tr">Precio página USD</th><th class="tr">Costo ARS con envío</th><th class="tr">Cantidad a comprar</th></tr></thead><tbody data-products></tbody></table></div>
              <p class="py-note">Los precios corresponden a la última información registrada.</p>
            </section>
          </div>
        </div>
      </div>`;
    document.body.appendChild(panel);
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
    panel.querySelector('[data-logout]').onclick = () => root.doLogout();
    panel.querySelector('[data-search]').oninput = renderProducts;
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
      if (busy) return;
      const name = panel.querySelector('[data-name]').value.trim();
      const items = Object.fromEntries(Object.entries(selected).filter(([key])=>eligible(products[key])));
      if (!name || !Object.keys(items).length) { status('Completá el nombre y elegí al menos un producto con cantidad.'); return; }
      for (const input of panel.querySelectorAll('[data-product]')) if (!input.reportValidity()) return;
      busy = true; panel.querySelector('[data-save]').disabled = true; panel.querySelector('[data-lists]').disabled = true;
      const key = listKey || root.fbPush(root.fbRef(root.fbDB,'sv_listas_paraguay/'+uid)).key;
      try {
        await root.fbSet(root.fbRef(root.fbDB,'sv_listas_paraguay/'+uid+'/'+key),{nombre:name,productos:items,actualizadoEn:root.fbServerTimestamp()});
        listKey = key; if(panel){renderLists();status('Lista guardada. No se generó una orden de compra.');}
      } catch (e) {status('No se pudo guardar la lista. Revisá la conexión y el acceso.');}
      finally {busy=false;if(panel){panel.querySelector('[data-save]').disabled=false;panel.querySelector('[data-lists]').disabled=false;}}
    };
    panel.querySelector('[data-download]').onclick = () => {
      if (!Object.keys(selected).some(key=>eligible(products[key]))) {status('Elegí al menos un producto para descargar.');return;}
      const blob = new Blob([csv(selected,products)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='lista-compras-paraguay.csv';link.click();URL.revokeObjectURL(url);
    };
    const query = root.fbQuery(root.fbRef(root.fbDB,'sisventas/productos'),root.fbOrderByChild('categoria'),root.fbEqualTo(CATEGORY));
    stops.push(root.fbOnValue(query,snap=>{products=snap.val()||{};if(panel)renderProducts();},()=>status('No se pudo cargar el catálogo autorizado.')));
    stops.push(root.fbOnValue(root.fbRef(root.fbDB,'sv_listas_paraguay/'+uid),snap=>{lists=snap.val()||{};if(panel)renderLists();},()=>status('No se pudieron cargar tus listas.')));
    stops.push(root.fbOnValue(roleQuery,snap=>{const role=snap.val();if(!role||role.activo!==true||role.rol!=='compras_paraguay')root.doLogout();}));
    renderProducts();
  }
  root.SVParaguayPortal = {open,close};
})(typeof window === 'undefined' ? {} : window);
