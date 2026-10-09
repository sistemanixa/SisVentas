(function(root) {
  'use strict';
  const CATEGORY = 'COMPRAS PARAGUAY';
  const eligible = p => !!p && p.categoria === CATEGORY && p.estado !== 'Inactivo' && p.activo !== false && !p.esManoDeObra;
  const quote = (p, selectedProvider='') => {
    const rows=(p.proveedores||[]).filter(r=>r.activo!==false);
    const cp=r=>{try{return /^(?:www\.|mobile\.)?(?:comprasparaguai\.com\.br|comprasparaguay\.com\.ar)$/.test(new URL(r.url).hostname);}catch(_){return false;}};
    const row=rows.find(r=>selectedProvider&&r.nombre===selectedProvider)||rows.find(r=>root.proveedorProductoEsFavorito?.(r,p))||rows.find(cp)||rows.find(r=>r.nombre===p.proveedor)||rows.find(r=>r.monedaOriginal==='USD');
    const usd=row?(String(row.monedaOriginal).toUpperCase()==='USD'?Number(row.precioOriginal)||0:Number(row.precioUsdReferencia)||0):Number(p.precioUsdReferencia||p.compraUSD)||0;
    const store=row?.tiendaOrigen||(!row||cp(row)?'':row.nombre)||'';
    return {usd,ars:Number(row&&(row.costoRealArs||row.precio)||p.compraARS||p.compra)||0,url:row&&(row.urlOferta||row.url)||p.codWeb||'',store};
  };
  root.SVParaguayQuote=quote;
  const hasVAT = p => p.iva == null || Number(p.iva) > 0;
  function subscribeExchangeRate(api, valid, refresh, fail) {
    return api.fbOnValue(api.fbRef(api.fbDB,'sisventas/config/tipoCambio'), snap => {
      if (!valid()) return;
      api.TIPO_CAMBIO_CONFIG = snap.val() || {};
      refresh();
    }, error => { if (valid()) fail(error); });
  }
  function salePrice(p, pricing = root.precioVentaCanonicoProducto) {
    const net = typeof pricing === 'function' ? Number(pricing(p).precioARS) : Number(p.ventaARS || (p.moneda !== 'USD' && p.venta) || 0);
    const iva = p.iva == null ? 21 : Number(p.iva);
    return Number.isFinite(net) && net > 0 && Number.isFinite(iva) && iva >= 0 ? Math.round(net * (1 + iva / 100) * 100) / 100 : 0;
  }
  function saleAmounts(p, rate, pricing = root.precioVentaCanonicoProducto) {
    const ars=salePrice(p,pricing), exchange=Number(rate);
    return {ars,usd:ars>0&&Number.isFinite(exchange)&&exchange>0?Math.round(ars/exchange*100)/100:0};
  }
  async function removeShoppingList(ownerUid, key, name) {
    const actor=root.currentUserUid, role=root.currentRole;
    const allowed=()=>root.currentUserUid===actor&&root.currentRole===role&&!!actor&&
      ((role==='admin'&&root.permisoModulo?.('balancecompra'))||(['compras_paraguay','distribuidora'].includes(role)&&ownerUid===actor));
    if(!allowed()||![ownerUid,key].every(v=>typeof v==='string'&&v.length&&!/[.#$\[\]\/]/.test(v)))throw Error('Sin permiso para eliminar esta lista.');
    if(!root.confirm('¿Eliminar la lista «'+name+'»? Esta acción no modifica productos, stock ni órdenes de compra.'))return false;
    if(!allowed())throw Error('La sesión cambió. Volvé a ingresar.');
    await root.fbSet(root.fbRef(root.fbDB,'sv_listas_paraguay/'+ownerUid+'/'+key),null);
    return true;
  }
  const purchaseStates = {pendiente:'Pendiente',pedido:'Pedido',comprado:'Comprado'};
  const csvCell = v => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
  function mlComparison(p, price, unitCost = root.costoUnitarioProveedorProducto, includeAll = false) {
    const refs = (p.proveedores || []).filter(pv=>{
      if (!pv || pv.disponibilidadProveedor==='sin_stock' || pv.activo===false) return false;
      let host='';try {host=new URL(pv.url).hostname.toLowerCase();} catch (_) {}
      return /(^|\.)mercadolibre\.com\.ar$/.test(host) || host==='meli.la' || /^mercado\s*libre$/i.test(String(pv.nombre||'').trim());
    }).map(pv=>typeof unitCost==='function'?Number(unitCost(p,pv)):Number(pv.costoRealArs || (Number(pv.precioArsPublicado || pv.precio)*(pv.sinIva?1+Number(pv.iva??p.iva??21)/100:1)))).filter(n=>Number.isFinite(n)&&n>0);
    if (!refs.length || !(price>0)) return null;
    const reference=Math.min(...refs), saving=Math.round((reference-price)*100)/100;
    if (saving<=0 && !includeAll) return null;
    return {reference,saving,percent:Math.floor(saving/reference*1000)/10};
  }
  function pdfComparisonText(comparison, rate = 0) {
    if (!comparison) return 'Sin referencia de Mercado Libre';
    if (comparison.saving === 0) return 'Mismo precio que Mercado Libre';
    const percent=Math.abs(comparison.saving/comparison.reference*100);
    return (percent<0.01?'Menos de 0,01':percent.toLocaleString('es-AR',{maximumFractionDigits:2}))+'% '+(comparison.saving>0?'menos':'más')+' que Mercado Libre · '+(comparison.saving>0?'Ahorrás ':'Diferencia ')+(rate>0?'US$ ':'ARS $ ')+Math.abs(comparison.saving/(rate>0?rate:1)).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})+' por unidad';
  }
  function pdfEntries(entries, pricing=root.precioVentaCanonicoProducto, unitCost=root.costoUnitarioProveedorProducto) {
    const brand=p=>String(p.marca||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('es')||'SIN MARCA';
    return entries.map(entry=>{
      const price=salePrice(entry.p,pricing),comparison=mlComparison(entry.p,price,unitCost,true);
      const featured=!!comparison&&price<comparison.reference*0.7;
      return {...entry,featured,comparison,group:featured?'Destacados':brand(entry.p)};
    }).sort((a,b)=>Number(b.featured)-Number(a.featured)||(a.featured?(b.comparison.saving/b.comparison.reference-a.comparison.saving/a.comparison.reference):a.group==='SIN MARCA'?Number(b.group!=='SIN MARCA'):b.group==='SIN MARCA'?-1:a.group.localeCompare(b.group,'es'))||String(a.p.nombre||a.p.descripcion||'').localeCompare(String(b.p.nombre||b.p.descripcion||''),'es'));
  }

  function listHistory(previous,items,purchases,now=Date.now()) {
    const result={fechasProductos:{}};
    if(previous?.creadoEn)result.creadoEn=previous.creadoEn;else if(!previous)result.creadoEn=now;
    for(const key of Object.keys(items)){
      const history={...(previous?.fechasProductos?.[key]||{})};
      if(!previous?.productos?.[key])history.agregadoEn=now;
      if(purchases[key]?.estado==='comprado'&&previous?.comprasFinales?.[key]?.estado!=='comprado'&&!history.compradoEn)history.compradoEn=now;
      if(Object.keys(history).length)result.fechasProductos[key]=history;
    }
    if(!Object.keys(result.fechasProductos).length)result.fechasProductos=null;
    return result;
  }
  function localPriceReference(product,unitCost=root.costoUnitarioProveedorProducto) {
    const refs=(product.proveedores||[]).filter(pv=>{
      if(!pv||pv.activo===false||pv.disponibilidadProveedor==='sin_stock')return false;
      let host='';try{host=new URL(pv.url).hostname.toLowerCase();}catch(_){}
      const ml=/(^|\.)mercadolibre\.com\.ar$/.test(host)||host==='meli.la'||/^mercado\s*libre$/i.test(String(pv.nombre||'').trim());
      if(ml)return true;
      if(pv.exterior===true||/paraguay|flytec|nissei|cellshop|shopping china/i.test(String(pv.nombre||''))||/\.(py|br)$/.test(host))return false;
      if(typeof root.origenProveedorProducto==='function')return !root.origenProveedorProducto(pv).exterior;
      return pv.exterior===false||/^(argentina|ar|arg)$/i.test(String(pv.pais||''))||/\.com\.ar$/.test(host);
    }).map(pv=>typeof unitCost==='function'?Number(unitCost(product,pv)):Number(pv.costoRealArs||Number(pv.precioArsPublicado||pv.precio)*(pv.sinIva?1+Number(pv.iva??product.iva??21)/100:1))).filter(n=>Number.isFinite(n)&&n>0);
    return refs.length?Math.min(...refs):null;
  }
  function localReferenceHTML(product) {
    const reference=localPriceReference(product);
    return reference===null?'':'<small class="py-local-reference" style="display:block;margin-top:8px;color:var(--green)">Referencia local / ML: ARS $ '+reference.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})+'</small>';
  }
  function listSavings(list,products,rate,unitCost) {
    let ars=0,included=0,units=0,withReference=0,pendingFinal=0;const total=Object.keys(list.productos||{}).length;
    for(const key of Object.keys(list.productos||{})){
      const actual=list.comprasFinales?.[key],product=products[key];
      if(!product)continue;
      const reference=localPriceReference(product,unitCost);if(reference===null)continue;withReference++;
      if(actual?.estado!=='comprado'||!(actual.cantidad>0)||!Number.isFinite(actual.precioUnitario)||actual.precioUnitario<0){pendingFinal++;continue;}
      const currency=actual.moneda||'USD';
      const paid=currency==='ARS'?actual.precioUnitario:currency==='USD'&&rate>0?actual.precioUnitario*rate:null;
      if(paid===null)continue;
      ars+=(reference-paid)*actual.cantidad;included++;units+=actual.cantidad;
    }
    ars=Math.round(ars*100)/100;return {ars,usd:rate>0?Math.round(ars/rate*100)/100:null,included,omitted:total-included,units,withReference,pendingFinal};
  }
  const historyDate=value=>Number(value)>0?new Date(Number(value)).toLocaleDateString('es-AR'):'Sin fecha registrada';

  function pdfPages(entries) {
    const groups=new Map(),pages=[];
    entries.forEach(entry=>{const key=entry.featured?'__featured__':'__regular__'; if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);});
    for(const section of groups.values())for(let i=0;i<section.length;i+=5)pages.push(section.slice(i,i+5));
    return pages;
  }
  const csv = (items, products, purchases = {}) => '\uFEFF' + [['Código','Producto','Cantidad','USD unitario','Costo ARS unitario con envío','URL','Cantidad comprada','Precio unitario acordado','Moneda','Proveedor','Estado','Local'], ...Object.entries(items).map(([key, qty]) => {
    const p = products[key]; if (!eligible(p)) return null;
    const q = quote(p,purchases[key]?.proveedor); return [p.codigo || '', p.nombre || p.descripcion || '', qty, q.usd || '', q.ars || '', q.url, purchases[key]?.cantidad ?? '', purchases[key]?.precioUnitario ?? '', purchases[key]?.moneda || '', purchases[key]?.proveedor || '', purchaseStates[purchases[key]?.estado] || 'Pendiente',q.store||'Por identificar'];
  }).filter(Boolean)].map(row => row.map(csvCell).join(';')).join('\r\n');
  if (typeof module !== 'undefined') module.exports = {eligible, quote, csv, salePrice, saleAmounts, mlComparison, removeShoppingList, pdfEntries, pdfPages, providerSelection, subscribeExchangeRate, pdfComparisonText, listHistory, listSavings};
  if (!root.document) return;
  let detailModal, pdfPreview, purchases = {}, panel, stops = [], products = {}, lists = {}, selected = {}, listKey = '', listBaseline = null, busy = false, generation = 0;
  let cartDraft = {productos:{}, comprasFinales:{}, nombre:''};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amount = n => Number(n).toLocaleString('es-AR', {minimumFractionDigits:2,maximumFractionDigits:2});
  const exchangeRate = () => Number(root.obtenerDolarReferenciaProducto?.().valor)||0;
  function renderExchangeReference() {
    if(!panel)return;
    let node=panel.querySelector('[data-dollar-reference]');
    if(!node){
      node=document.createElement('div');
      node.className='topbar-dolar';
      node.dataset.dollarReference='';
      node.setAttribute('role','status');
      node.setAttribute('aria-label','Cotización del dólar');
      node.style.cssText='cursor:default;line-height:1.3;flex-wrap:wrap;justify-content:center';
      node.innerHTML='<span class="topbar-dolar-label">USD</span><strong data-dollar-value style="color:var(--blue)"></strong><span data-dollar-type></span>';
      panel.querySelector('.topbar-right').prepend(node);
    }
    const reference=root.obtenerDolarReferenciaProducto?.()||{},cfg=root.TIPO_CAMBIO_CONFIG||{};
    const type=Number(cfg[reference.tipo])>0?reference.tipo:(['oficial','blue','mep'].find(key=>Number(cfg[key])>0)||reference.tipo||'referencia');
    const label=({oficial:'Oficial',blue:'Blue',mep:'MEP',ccl:'CCL',tarjeta:'Tarjeta',venta:'Venta',referencia:'Referencia'})[type]||type;
    node.querySelector('[data-dollar-value]').textContent=Number(reference.valor)>0?'$ '+amount(reference.valor):'Sin cotización';
    node.querySelector('[data-dollar-type]').textContent=label;
    node.title='Dólar de referencia del catálogo · '+label+' · Pesos argentinos por USD';
  }
  function salePriceHTML(p) {
    const reference=root.obtenerDolarReferenciaProducto?.()||{}, values=saleAmounts(p,reference.valor);
    const cfg=root.TIPO_CAMBIO_CONFIG||{};
    const type=Number(cfg[reference.tipo])>0?reference.tipo:([reference.tipo==='venta'?'venta':null,...['oficial','blue','mep'].filter(key=>Number(cfg[key])>0)].find(Boolean)||reference.tipo||'referencia');
    const label=({oficial:'Dólar oficial',blue:'Dólar blue',mep:'Dólar MEP',ccl:'Dólar CCL',tarjeta:'Dólar tarjeta',venta:'Dólar venta',referencia:'Dólar de referencia'})[type]||('Dólar '+type);
    if(!values.usd)return '<strong>Consultar precio en USD</strong>';
    return '<span style="display:flex;flex-direction:column;gap:6px;align-items:flex-start"><strong style="font-size:19px;color:var(--green)">US$ '+amount(values.usd)+(hasVAT(p)?' <small style="font-size:10px">con IVA</small>':'')+'</strong><small style="font-size:12px;font-weight:400;color:var(--text3)">≈ ARS $ '+amount(values.ars)+' · '+esc(label)+' $ '+amount(reference.valor)+'</small></span>';
  }
  function mlBadge(p, price) {
    const comparison=mlComparison(p,price,root.costoUnitarioProveedorProducto,true);if(!comparison)return '';
    if(comparison.saving<=0)return '<span class="py-ml-saving" style="display:block;margin:9px 0;color:var(--text2);font-size:12px;line-height:1.4"><b>'+esc(pdfComparisonText(comparison))+'</b><small style="display:block;color:var(--text3);font-size:10px">ML: ARS $ '+amount(comparison.reference)+' · referencia registrada</small></span>';
    return '<span class="py-ml-saving" style="display:flex;flex-wrap:wrap;gap:4px 8px;margin:9px 0;color:var(--green);font-size:12px;line-height:1.4"><b>'+(comparison.percent>0?comparison.percent.toLocaleString('es-AR')+'% menos que ML':'Menos que ML')+'</b><span>Ahorrás $ '+amount(comparison.saving)+'</span><small style="flex-basis:100%;color:var(--text3);font-size:10px">ML: $ '+amount(comparison.reference)+' · referencia registrada</small></span>';
  }
  let productSheet=null;
  function returnFromProduct(restore=true) {
    if(!productSheet)return false;
    const context=productSheet;productSheet=null;
    root.removeEventListener('popstate',context.back,true);root.removeEventListener('hashchange',context.back,true);
    context.nodes.forEach(({node,marker,style})=>{marker.replaceWith(node);if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);});
    context.labels.forEach(({node,html})=>{node.innerHTML=html;});
    context.host.remove();
    if(panel){panel.style.display=context.panelDisplay;panel.style.removeProperty('visibility');}
    if(detailModal)detailModal.style.display='flex';
    if(restore&&panel&&context.session===generation){renderProducts();showDetail(context.key);}
    return true;
  }
  function openProductSheet(key) {
    if(root.currentRole==='distribuidora'){root.SVDistribuidora?.detail(key,products[key]);return;}
    if(productSheet||root.currentRole!=='admin'||!root.permisoModulo?.('productos')||!eligible(products[key]))return;
    const views=['prod-detail-view','prod-form-view'].map(id=>document.getElementById(id));
    if(views.some(node=>!node)||typeof root.verProducto!=='function'){root.alert('No se pudo abrir la ficha del producto.');return;}
    const host=document.createElement('section');host.id='sv-exterior-product-sheet';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Ficha detallada del producto');
    host.style.cssText='position:fixed;inset:0;z-index:9999;overflow:auto;background:var(--bg);color:var(--text);padding:20px;box-sizing:border-box';
    host.innerHTML='<style>#sv-exterior-product-sheet #pf-anterior,#sv-exterior-product-sheet #pf-siguiente{display:none!important}#sv-exterior-product-sheet>div{max-width:1400px;margin:auto}#sv-exterior-product-sheet .pf-editor-header{top:0} @media(max-width:600px){#sv-exterior-product-sheet{padding:12px!important}}</style>';
    const nodes=views.map(node=>{const marker=document.createComment('ficha exterior');node.before(marker);const style=node.getAttribute('style');host.appendChild(node);return {node,marker,style};});
    const labels=Array.from(host.querySelectorAll('button[onclick="cerrarFormProducto()"],button[onclick="cerrarDetalleProducto()"]')).map(node=>({node,html:node.innerHTML}));labels.forEach(({node})=>{if(node.textContent.includes('Volver'))node.textContent='← Volver a Ofertas';});
    const context={host,nodes,labels,key,session:generation,panelDisplay:panel.style.display,url:root.location.href};productSheet=context;
    const leave=()=>{if(views[1].style.display!=='none')root.cerrarFormProducto();else returnFromProduct();};
    context.back=e=>{e.stopImmediatePropagation();root.history.replaceState(root.history.state,'',context.url);leave();};
    root.addEventListener('popstate',context.back,true);root.addEventListener('hashchange',context.back,true);
    host.onkeydown=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();e.preventDefault();leave();}};
    panel.style.setProperty('display','none','important');if(detailModal)detailModal.style.display='none';document.body.appendChild(host);
    try{root.verProducto(key,'ofertas');if(host.querySelector('#pd-codigo-lbl')?.textContent!==String(products[key].codigo||''))throw Error('Producto pendiente de cargar');host.querySelector('button')?.focus();}catch(e){returnFromProduct();root.alert('No se pudo abrir la ficha del producto.');}
  }
  function close() {
    returnFromProduct(false);
    pdfPreview?.remove();pdfPreview=null;
    detailModal?.remove(); detailModal=null; purchases={};
    generation++;
    stops.forEach(stop => stop()); stops = [];
    cartDraft = {productos:{}, comprasFinales:{}, nombre:''};
    panel?.remove(); panel = null; products = {}; lists = {}; selected = {}; listKey = ''; listBaseline = null; busy = false;
  }
  function renderProducts() {
    const search = panel.querySelector('[data-search]').value.toLowerCase();
    const rows = Object.entries(products).filter(([,p]) => eligible(p) && [p.nombre,p.descripcion,p.codigo,p.marca].join(' ').toLowerCase().includes(search));
    panel.querySelector('[data-count]').textContent = rows.length + (rows.length === 1 ? ' producto' : ' productos');
    const grouped = panel.querySelector('[data-group-brand]').checked;
    const brand = p => String(p.marca || '').trim().replace(/\s+/g,' ').toLocaleUpperCase('es') || 'SIN MARCA';
    const counts = new Map();
    if (grouped) {
      rows.forEach(([,p])=>counts.set(brand(p),(counts.get(brand(p))||0)+1));
      rows.sort(([,a],[,b])=>brand(a)===brand(b)?0:brand(a)==='SIN MARCA'?1:brand(b)==='SIN MARCA'?-1:brand(a).localeCompare(brand(b),'es'));
    }
    panel.querySelector('[data-products]').innerHTML = rows.map(([key,p]) => {
      const price = salePrice(p), qty = Number(selected[key]) || 0;
      // Misma estructura y clases que renderCatalogo: tarjeta y controles hermanos.
      return '<article class="catalogo-tarjeta"><button type="button" class="catalogo-card" data-detail="'+esc(key)+'" aria-label="Ver '+esc(p.nombre || p.descripcion)+'"><div class="catalogo-card-imagen">'+root.imagenCatalogoHTML(p,'catalogo-card-img')+'</div><div class="catalogo-card-body"><span class="catalogo-card-cat">Ofertas</span><h3>'+esc(p.nombre || p.descripcion)+'</h3>'+(p.marca?'<div class="catalogo-card-marca">'+esc(p.marca)+'</div>':'')+'<p>Local: '+esc(quote(p).store||'Por identificar')+'</p><p>'+esc(p.catalogoDescripcion || p.descripcion || '')+'</p>'+salePriceHTML(p)+mlBadge(p,price)+'<span class="catalogo-card-footer"><span class="catalogo-ver">Ver detalle <i class="ti ti-arrow-right"></i></span></span></div></button><button type="button" class="catalogo-agregar-carrito catalogo-carrito-tarjeta '+(qty?'seleccionado':'')+'" data-add="'+esc(key)+'" aria-label="Agregar '+esc(p.nombre || p.codigo)+' al carrito"><i class="ti ti-shopping-cart-plus" aria-hidden="true"></i><span class="catalogo-producto-contador" '+(qty?'':'hidden')+'>'+qty+'</span></button><button type="button" class="catalogo-restar catalogo-restar-tarjeta" data-subtract="'+esc(key)+'" aria-label="Quitar una unidad" '+(qty?'':'hidden')+'><i class="ti ti-minus" aria-hidden="true"></i></button></article>';

    }).map((card,index)=>{
      const name=brand(rows[index][1]);
      return (grouped && (index===0 || name!==brand(rows[index-1][1])) ? '<h3 class="py-brand-heading">'+esc(name)+' <small>'+counts.get(name)+(counts.get(name)===1?' producto':' productos')+'</small></h3>' : '')+card;
    }).join('') || '<div class="catalogo-vacio" style="display:flex;grid-column:1/-1"><strong>No hay productos para mostrar</strong><span>Probá otra búsqueda.</span></div>';
    renderSummary();
    refreshOpenDetail();
  }
  function refreshOpenDetail() {
    if (!detailModal?.isConnected) return;
    const p=products[detailModal.dataset.productKey];
    if (!eligible(p)) {detailModal.remove();detailModal=null;return;}
    const title=detailModal.querySelector('h2'); if(title)title.textContent=p.nombre||p.descripcion||'';
    const brand=detailModal.querySelector('.catalogo-modal-marca'); if(brand)brand.textContent=(p.marca||'')+' · '+(p.codigo||'');
    const description=detailModal.querySelector('.catalogo-modal-info > p'); if(description)description.textContent=p.catalogoDescripcion||p.descripcion||'Sin descripción adicional';
    const photo=detailModal.querySelector('.catalogo-modal-imagen');
    const photoKey=JSON.stringify([p.imagenUrl,p.imagen,p.imagenes,p.foto]);
    if(photo && detailModal.dataset.photoKey!==photoKey){photo.innerHTML=root.imagenCatalogoHTML(p,'catalogo-modal-img');detailModal.dataset.photoKey=photoKey;}
    detailModal.setAttribute('aria-label',p.nombre||p.descripcion||'Producto');
    const price=detailModal.querySelector('[data-detail-price]');
    const html=salePriceHTML(p)+mlBadge(p,salePrice(p));
    if(price && price.innerHTML!==html)price.innerHTML=html;
    detailModal.querySelector('[data-modal-qty]').textContent=(selected[detailModal.dataset.productKey]||0)+' unidades en tu lista';
  }
  function showDetail(key) {
    const p = products[key]; if (!eligible(p)) return;
    detailModal?.remove();
    const previous = document.activeElement, price = salePrice(p);
    const sourceUrl = [p.codWeb,p.urlProveedor,...(p.proveedores||[]).map(row=>row.url)].map(value=>{
      try {const url=new URL(String(value||''));return /^https?:$/.test(url.protocol)?url.href:'';} catch (_) {return '';}
    }).find(Boolean);
    const modal = document.createElement('div');
    modal.dataset.svModalBehavior='compact';modal.className='catalogo-modal';modal.dataset.detailModal='';modal.dataset.productKey=key;modal.style.cssText='display:flex;z-index:100100';
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',p.nombre || p.descripcion);
    modal.innerHTML='<div class="catalogo-modal-card"><button class="catalogo-modal-close" data-close-detail aria-label="Cerrar detalle">×</button><div class="catalogo-modal-imagen">'+root.imagenCatalogoHTML(p,'catalogo-modal-img')+'</div><div class="catalogo-modal-info"><span class="catalogo-card-cat">Ofertas</span><h2>'+esc(p.nombre || p.descripcion)+'</h2><div class="catalogo-modal-marca">'+esc(p.marca)+' · '+esc(p.codigo)+'</div><p style="white-space:pre-wrap">'+esc(p.catalogoDescripcion || p.descripcion || 'Sin descripción adicional')+'</p><div data-detail-price aria-live="polite">'+salePriceHTML(p)+mlBadge(p,price)+'</div><button class="catalogo-agregar-carrito" style="display:flex;margin-top:18px" data-modal-add aria-label="Agregar al carrito"><i class="ti ti-shopping-cart-plus" aria-hidden="true"></i></button><p data-modal-qty aria-live="polite"></p></div></div>';
    if(root.SVPublicCatalog&&['admin','distribuidora'].includes(root.currentRole)){
      const share=document.createElement('button');share.type='button';share.className='catalogo-share';share.setAttribute('aria-label','Compartir producto');share.title='Compartir producto';
      share.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>';
      share.style.cssText='position:absolute;right:20px;bottom:20px;width:48px;height:48px;border:0;border-radius:50%;background:var(--green,#7fda91);color:var(--bg,#0b1320);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 3px 12px #0003';
      const card=modal.querySelector('.catalogo-modal-card');card.style.position='relative';modal.querySelector('.catalogo-modal-info').style.paddingBottom='84px';share.onclick=()=>root.SVPublicCatalog.share(key,products,share);card.appendChild(share);
    }
    const detailKeys=Object.entries(products).filter(([,product])=>eligible(product)&&[product.nombre,product.descripcion,product.codigo,product.marca].join(' ').toLowerCase().includes(panel.querySelector('[data-search]').value.toLowerCase())).map(([id])=>id);
    if(sourceUrl){
      const link=document.createElement('a');link.href=sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.className='btn btn-primary';link.textContent='Ver producto ↗';link.title='Abrir la página original del producto';link.style.cssText='display:inline-flex;align-self:flex-start;margin-top:14px;text-decoration:none';
      modal.querySelector('[data-modal-qty]').after(link);
    }
    if((root.currentRole==='admin'&&root.permisoModulo?.('productos'))||root.currentRole==='distribuidora'&&root.SVDistribuidora?.allowed('detalle')){
      const sheetButton=document.createElement('button');sheetButton.type='button';sheetButton.className='btn';sheetButton.textContent='Ver ficha detallada del producto';sheetButton.dataset.productSheet='';sheetButton.style.cssText='display:inline-flex;align-self:flex-start;margin-top:10px';sheetButton.onclick=()=>openProductSheet(key);modal.querySelector('.catalogo-modal-info').appendChild(sheetButton);
    }
    const move=delta=>showDetail(detailKeys[(detailKeys.indexOf(key)+delta+detailKeys.length)%detailKeys.length]);
    if(detailKeys.length>1){
      modal.insertAdjacentHTML('beforeend','<button class="catalogo-modal-nav catalogo-modal-prev" aria-label="Producto anterior">‹</button><button class="catalogo-modal-nav catalogo-modal-next" aria-label="Producto siguiente">›</button>');
      modal.querySelector('.catalogo-modal-prev').onclick=()=>move(-1);modal.querySelector('.catalogo-modal-next').onclick=()=>move(1);
    }
    const refresh = () => {modal.querySelector('[data-modal-qty]').textContent=(selected[key] || 0)+' unidades en tu lista';};
    const dismiss = () => {modal.remove();if(previous?.isConnected)previous.focus();};
    modal.querySelector('[data-close-detail]').onclick=dismiss;
    modal.onclick=e=>{if(e.target===modal)dismiss();};
    modal.onkeydown=e=>{if(detailKeys.length>1 && (e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);return;}if(e.key==='Escape'){e.stopPropagation();dismiss();}if(e.key==='Tab'){const focusable=Array.from(modal.querySelectorAll('button,a[href]'));const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    modal.querySelector('[data-modal-add]').onclick=()=>{selected[key]=Math.min(9999,(Number(selected[key])||0)+1);renderProducts();refresh();};
    document.body.appendChild(modal);detailModal=modal;refresh();modal.querySelector('[data-close-detail]').focus();
  }
  function exportPDF(onlySelected) {
    const search=panel.querySelector('[data-search]').value.toLowerCase();
    let entries=onlySelected?Object.entries(selected).filter(([key])=>eligible(products[key])).map(([key,qty])=>({p:products[key],qty})):Object.values(products).filter(p=>eligible(p)&&[p.nombre,p.descripcion,p.codigo,p.marca].join(' ').toLowerCase().includes(search)).map(p=>({p,qty:1}));
    if(!entries.length){root.alert('No hay productos para exportar.');return;}
    entries=pdfEntries(entries);
    pdfPreview?.remove();pdfPreview=document.createElement('div');
    pdfPreview.dataset.svModalBehavior='compact';pdfPreview.setAttribute('role','dialog');pdfPreview.setAttribute('aria-label','Vista previa PDF');pdfPreview.setAttribute('aria-modal','true');
    pdfPreview.style.cssText='position:fixed;inset:0;z-index:100110;background:#e8eef5;display:flex;flex-direction:column';
    const back=document.createElement('button');back.textContent='← Volver al catálogo';back.className='btn';back.style.cssText='flex-shrink:0;align-self:flex-start;margin:8px;background:#142b48;color:white';
    const previous=document.activeElement;back.onclick=()=>{pdfPreview.remove();pdfPreview=null;previous?.focus();};
    const frame=document.createElement('iframe');frame.title='PDF de productos';frame.style.cssText='flex:1;width:100%;border:0;background:#e8eef5';
    pdfPreview.append(back,frame);document.body.appendChild(pdfPreview);back.focus();
    const win=frame.contentWindow;
    const title=onlySelected?(panel.querySelector('[data-name]').value.trim()||'Mi lista de productos'):'Catálogo de Productos';
    const date=new Date().toLocaleDateString('es-AR');
    const rate=exchangeRate();if(!(rate>0)){pdfPreview.remove();pdfPreview=null;root.alert('Falta la cotización del dólar para generar el PDF.');return;}
    const money=n=>'US$ '+amount(n);
    const total=entries.reduce((s,{p,qty})=>s+saleAmounts(p,rate).usd*qty,0);
    const pages=[], pageEntries=pdfPages(entries);
    for(let pageIndex=0;pageIndex<pageEntries.length;pageIndex++){
      const pageRows=pageEntries[pageIndex];
      const cards=pageRows.map(({p,qty,featured,comparison,group},offset)=>{
        const price=saleAmounts(p,rate).usd;
        let src='';try{if(p.imagenUrl){const u=new URL(p.imagenUrl,root.location.href);if(/^https?:$/.test(u.protocol)||/^data:image\/(png|jpeg|webp);base64,/.test(p.imagenUrl))src=u.href;if(src&&/^https?:/.test(src)&&typeof root.urlImagenProductoParaArchivo==='function')src=root.urlImagenProductoParaArchivo(src);}}catch(_){}
        const groupHeading=offset===0||pageRows[offset-1].group!==group?esc(group):'';
        return '<div class="pdf-item"><div class="group-heading '+(featured?'featured-heading':'')+'">'+groupHeading+'</div><article class="'+(featured?'featured':'')+'"><div class="photo">'+(src?'<img src="'+esc(src)+'" alt="">':'')+'</div><div class="info"><div class="brand">'+esc(p.marca||'Ofertas')+' <span>'+esc(p.codigo||'')+'</span></div><h2>'+esc(p.nombre||p.descripcion||'Producto')+'</h2><p>'+esc(String(p.catalogoDescripcion||p.descripcion||'').slice(0,240))+'</p><div class="price">'+(price?money(price):'Consultar precio')+(price&&hasVAT(p)?' <small>con IVA</small>':'')+'</div>'+'<div class="saving"'+(!comparison||comparison.saving<=0?' style="color:#54677e"':'')+'>'+esc(pdfComparisonText(comparison,rate))+'</div>'+(onlySelected?'<div class="quantity">Cantidad: '+qty+' · Subtotal: '+(price?money(price*qty):'A consultar')+'</div>':'')+'</div></article></div>';
      }).join('');
      pages.push('<section class="sheet"><header><div class="logo">SisVentas<span>powered by Nixa</span></div><div class="edition">OFERTAS<br><small>'+esc(date)+'</small></div></header><div class="heading"><h1>'+esc(title)+'</h1><span>'+entries.length+' productos'+(onlySelected?' · '+entries.reduce((s,e)=>s+Number(e.qty),0)+' unidades':'')+'</span></div><div class="cards">'+cards+'</div>'+(onlySelected&&pageIndex===pageEntries.length-1?'<div class="total">Total a precio de venta <strong>'+money(total)+'</strong></div>':'')+'<footer><span>Precios de venta registrados · Sujetos a disponibilidad'+(entries.some(e=>!salePrice(e.p))?' · Hay productos con precio a consultar':'')+'</span><b>'+(pageIndex+1)+' / '+pageEntries.length+'</b></footer></section>');
    }
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · SisVentas</title><style>
      *{box-sizing:border-box}body{margin:0;background:#e8eef5;color:#15243a;font-family:Arial,sans-serif}.toolbar{position:sticky;top:0;z-index:5;background:#112239;color:white;padding:14px;display:flex;justify-content:center;align-items:center;gap:14px;flex-wrap:wrap}.toolbar button{background:#78d68a;color:#102b1a;border:0;border-radius:9px;padding:12px 22px;font-weight:bold;cursor:pointer}.toolbar button:disabled{opacity:.6}.sheet{position:relative;width:794px;height:1122px;padding:24px 32px;margin:24px auto;background:white;overflow:hidden}header{display:flex;justify-content:space-between;align-items:center;background:#142b48;color:white;padding:8px 16px;border-radius:10px;border-bottom:4px solid #73d28c}.logo{font-size:22px;font-weight:800}.logo span{display:block;font-size:10px;font-weight:400;letter-spacing:1px;margin-top:2px;color:#b8cbe2}.edition{text-align:right;color:#8ce8a4;font-weight:bold;letter-spacing:2px}.edition small{color:white;font-size:11px;letter-spacing:0}.heading{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0 8px}.heading h1{font-size:17px;margin:0;max-width:490px;overflow-wrap:anywhere}.heading span{font-size:11px;color:#58718f;white-space:nowrap}.pdf-item{height:178px}.group-heading{height:20px;font-size:11px;line-height:18px;font-weight:bold;color:#326598}.featured-heading{color:#14613c;font-size:16px;font-weight:800;letter-spacing:.5px;text-transform:uppercase}.featured{border-left-color:#24a35b;background:#effaf2}article{display:flex;height:150px;border:1px solid #dce5ee;border-left:5px solid #73d28c;border-radius:12px;margin-bottom:8px;overflow:hidden;background:#f6f9fc}.photo{width:126px;flex-shrink:0;background:white;display:flex;align-items:center;justify-content:center;padding:12px}.photo img{max-width:100%;max-height:124px;object-fit:contain}.info{padding:8px 12px;min-width:0;flex:1}.brand{color:#326598;font-size:10px;font-weight:bold;text-transform:uppercase}.brand span{float:right;color:#73869d}h2{font-size:13px;line-height:1.3;margin:5px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.info p{font-size:10px;line-height:1.35;color:#54677e;margin:4px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.price{font-size:18px;font-weight:bold;color:#177e49;margin-top:4px}.price small{font-size:9px}.quantity{font-size:10px;margin-top:4px}.saving{color:#17653c;font-weight:bold;font-size:10px;margin-top:3px}.saving small{display:block;font-size:8px;margin-top:2px}.total{padding:7px 14px;background:#142b48;border-radius:10px;color:#fff;display:flex;justify-content:space-between;font-size:13px}.total strong{color:#8ce8a4;font-size:18px}footer{position:absolute;bottom:18px;left:32px;right:32px;border-top:1px solid #dce5ee;padding-top:10px;display:flex;justify-content:space-between;font-size:9px;color:#647b95}@media print{@page{size:A4;margin:0}.toolbar{display:none}body{background:white}.sheet{margin:0;page-break-after:always;print-color-adjust:exact;-webkit-print-color-adjust:exact}.sheet:last-child{page-break-after:auto}}
      .preview-page{width:calc(794px * var(--preview-scale,1));height:calc(1122px * var(--preview-scale,1));margin:16px auto}.preview-page>.sheet{margin:0;transform:scale(var(--preview-scale,1));transform-origin:top left}@media print{.preview-page{width:794px;height:1122px;margin:0}.preview-page>.sheet{transform:none}}
      </style><script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script><script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script></head><body><div class="toolbar"><button id="download" aria-live="polite">Descargar PDF</button></div>${pages.map(page=>'<div class="preview-page">'+page+'</div>').join('')}<script>
      const fitPreview=()=>document.documentElement.style.setProperty('--preview-scale',Math.min(1,(document.documentElement.clientWidth-16)/794));fitPreview();window.addEventListener('resize',fitPreview);
      document.getElementById('download').onclick=async function(){const b=this,s=b;b.disabled=true;b.textContent='Generando PDF…';let stage;try{
        if(typeof html2pdf!=='function')throw Error('No se pudo cargar el generador. Revisá la conexión e intentá nuevamente.');
        // Embed the bytes before cloning: a visible remote image is not necessarily canvas-safe.
        const imageData=new Map();
        await Promise.all(Array.from(document.querySelectorAll('.sheet img')).map(async img=>{
          const src=img.getAttribute('src');
          if(!imageData.has(src))imageData.set(src,(async()=>{
            if(src.startsWith('data:image/'))return src;
            const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
            try{
              const response=await fetch(src,{mode:'cors',credentials:'omit',signal:controller.signal});
              if(!response.ok)throw Error('Imagen no disponible');
              const blob=await response.blob();
              if(!blob.type.startsWith('image/'))throw Error('Respuesta sin imagen');
              return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
            }finally{clearTimeout(timeout);}
          })());
          try{img.src=await imageData.get(src);await img.decode();}
          catch(_){throw Error('No se pudo incorporar la foto de '+(img.closest('article').querySelector('h2')?.textContent||'un producto')+'. Intentá descargar nuevamente.');}
        }));
        const pdf=await html2pdf().set({jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}}).from(document.createElement('div')).toPdf().get('pdf');
        stage=document.createElement('div');stage.style.cssText='position:absolute;left:0;top:0;width:794px;z-index:-1;background:white';document.body.appendChild(stage);
        const sheets=Array.from(document.querySelectorAll('.sheet'));
        for(let i=0;i<sheets.length;i++){const clone=sheets[i].cloneNode(true);clone.style.margin='0';stage.replaceChildren(clone);const canvas=await html2canvas(clone,{x:0,y:0,scale:2,useCORS:true,backgroundColor:'#fff',scrollX:0,scrollY:0,windowWidth:794,width:794,height:1122});if(i)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',.97),'JPEG',0,0,210,297);s.textContent='Página '+(i+1)+' de '+sheets.length;}
        const now=new Date(),pad=n=>String(n).padStart(2,'0');
        const filename='SisVentas-Ofertas-'+now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+'_'+pad(now.getHours())+'-'+pad(now.getMinutes())+'-'+pad(now.getSeconds())+'.pdf';
        const link=document.createElement('a');link.href=pdf.output('datauristring');link.download=filename;link.hidden=true;document.body.appendChild(link);link.click();setTimeout(()=>link.remove(),60000);b.textContent='Descarga iniciada';await new Promise(resolve=>setTimeout(resolve,1200));
      }catch(e){alert(e.message||'No se pudo generar el PDF');}finally{stage?.remove();b.textContent='Descargar PDF';b.disabled=false;}};
      <\/script></body></html>`);
    win.document.close();
  }
  function providerSelection(product, saved, catalog, master) {
    const exterior=pv=>pv&&pv.activo!==false&&(typeof root.origenProveedorProducto==='function'?root.origenProveedorProducto(pv).exterior:!!String(pv.pais||'').trim()&&!/^(argentina|ar|arg)$/i.test(pv.pais)||/paraguay|flytec|nissei/i.test(pv.nombre||''));
    const attached=(product.proveedores||[]).filter(exterior);
    const initial=attached.find(pv=>root.proveedorProductoEsFavorito?.(pv,product))||attached[0];
    const chosen=saved||initial?.nombre||product.proveedor||'';
    const options=new Map();
    [...master,...catalog.flatMap(p=>p.proveedores||[]),...attached].filter(exterior).forEach(pv=>{const name=String(pv.nombre||'').trim();if(name)options.set(name.toUpperCase(),name);});
    if(chosen)options.set(chosen.toUpperCase(),chosen);
    return {chosen,options:Array.from(options.values()).sort((a,b)=>a.localeCompare(b,'es'))};
  }
  const editingPurchases=new Set(),explicitPurchaseEdits=new Set();
  function refreshPurchaseRows() {
    panel.querySelectorAll('[data-cart-items] tr[data-item-state]').forEach(row=>{
      const field=row.querySelector('[data-purchase="precioUnitario"]'),key=field?.dataset.key;if(!key)return;
      const actual=purchases[key]||{},edit=editingPurchases.has(key),p=products[key],q=quote(p,actual.proveedor);
      let badge=row.querySelector('[data-purchase-badge]');
      if(!badge){badge=document.createElement('small');badge.dataset.purchaseBadge='';row.querySelector('strong').after(badge);badge.style.cssText='display:block;color:var(--green);margin:6px 0';}
      badge.textContent=purchaseStates[actual.estado||'pendiente'];
      let dates=row.querySelector('[data-item-dates]');if(!dates){dates=document.createElement('small');dates.dataset.itemDates='';dates.style.cssText='display:block;margin:8px 0;color:var(--text3)';row.querySelector('td').appendChild(dates);}
      const history=listBaseline?.fechasProductos?.[key]||{},created=listBaseline?.creadoEn;
      dates.textContent='Agregado: '+historyDate(history.agregadoEn)+' · Compra: '+historyDate(history.compradoEn)+(created&&history.compradoEn>=created?' · '+Math.floor((history.compradoEn-created)/86400000)+' días desde la creación':'');
      const state=row.querySelector('[data-purchase="estado"]');if(state)state.closest('label').hidden=!explicitPurchaseEdits.has(key);
      row.querySelectorAll('input,select').forEach(input=>input.disabled=actual.estado==='comprado'&&!edit);
      let button=row.querySelector('[data-edit-purchase]');if(!button){button=document.createElement('button');button.type='button';button.className='btn btn-sm py-edit-item';button.dataset.editPurchase=key;button.title='Editar ítem';button.setAttribute('aria-label','Editar '+p.nombre);button.innerHTML='<i class="ti ti-pencil" aria-hidden="true"></i>';row.querySelector('td').appendChild(button);}
      let saving=row.querySelector('[data-purchase-saving]');if(!saving){saving=document.createElement('small');saving.dataset.purchaseSaving='';field.after(saving);}
      const reference=actual.moneda==='ARS'?q.ars:!actual.moneda||actual.moneda==='USD'?q.usd:0;
      let savingArs=row.querySelector('[data-purchase-saving-ars]');if(!savingArs){savingArs=document.createElement('small');savingArs.dataset.purchaseSavingArs='';savingArs.style.cssText='display:block;margin-top:4px;color:var(--green);font-size:11px';saving.after(savingArs);}savingArs.textContent='';
      if(Number.isFinite(actual.precioUnitario)&&reference>0&&actual.cantidad>0){const delta=reference-actual.precioUnitario;const currency=actual.moneda||'USD';saving.textContent=(delta>=0?'Ahorro: ':'Diferencia: ')+currency+' '+amount(Math.abs(delta))+' por unidad · '+currency+' '+amount(Math.abs(delta)*actual.cantidad)+' total';const rate=exchangeRate();if(currency==='USD'&&rate>0)savingArs.textContent=(delta>=0?'Ahorro en pesos: ':'Diferencia en pesos: ')+'≈ ARS $ '+amount(Math.abs(delta)*rate)+' por unidad · ARS $ '+amount(Math.abs(delta)*actual.cantidad*rate)+' total';}else saving.textContent='';
    });
  }
  function renderSummary() {
    const dates=panel.querySelector('[data-list-dates]');if(dates)dates.textContent='Creada: '+(listKey?historyDate(listBaseline?.creadoEn):'Se registrará al guardar')+' · Última actualización: '+historyDate(listBaseline?.actualizadoEn);

    const entries = Object.entries(selected).filter(([key]) => eligible(products[key]));
    panel.querySelector('[data-cart-items]').innerHTML = entries.length ? '<div class="table-wrap"><table class="sv-no-resize"><thead><tr><th>Producto / proveedor</th><th>Solicitado</th><th>Referencia</th><th>Cantidad comprada</th><th>Precio final por unidad</th><th>Moneda</th></tr></thead><tbody>'+entries.map(([key,qty]) => {
      const p=products[key],q=quote(p,purchases[key]?.proveedor),actual=purchases[key]||{},provider=providerSelection(p,actual.proveedor,Object.values(products),typeof proveedoresData==='undefined'?[]:proveedoresData||[]);let url='';try{if(/^https?:$/.test(new URL(q.url).protocol))url=q.url;}catch(_){}
      return '<tr data-item-state="'+esc(actual.estado||'pendiente')+'"><td><button type="button" class="btn btn-sm py-remove-item" data-remove="'+esc(key)+'" aria-label="Eliminar '+esc(p.nombre||p.codigo)+' de la lista" title="Eliminar de la lista"><i class="ti ti-trash" aria-hidden="true"></i></button><div class="py-list-product" style="display:flex;align-items:center;gap:10px"><span style="display:block;width:52px;height:52px;flex:0 0 52px;background:white;border-radius:8px;overflow:hidden">'+root.imagenCatalogoHTML(p,'py-list-photo')+'</span><strong>'+esc(p.nombre || p.descripcion)+'</strong></div><small class="py-note">Local: '+esc(q.store||'Por identificar')+'</small>'+(url?'<br><a class="py-provider-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Corroborar en proveedor ↗</a>':'')+'<label class="py-provider-choice"><span>Proveedor</span><select aria-label="Proveedor '+esc(p.codigo)+'" data-purchase="proveedor" data-key="'+esc(key)+'">'+(!provider.chosen?'<option value="">Elegir proveedor</option>':'')+provider.options.map(name=>'<option value="'+esc(name)+'" '+(name===provider.chosen?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label><label class="py-provider-choice"><span>Estado de la compra</span><select aria-label="Estado '+esc(p.codigo)+'" data-purchase="estado" data-key="'+esc(key)+'">'+Object.entries(purchaseStates).map(([value,label])=>'<option value="'+value+'" '+((actual.estado||'pendiente')===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label></td><td data-label="Solicitado"><input aria-label="Cantidad solicitada '+esc(p.codigo)+'" type="number" min="1" max="9999" step="1" data-requested="'+esc(key)+'" value="'+qty+'"></td><td data-label="Referencia">US$ '+amount(q.usd)+'<br><small>$ '+amount(q.ars)+' con envío</small>'+localReferenceHTML(p)+'</td><td data-label="Cantidad comprada"><input aria-label="Cantidad comprada '+esc(p.codigo)+'" data-purchase="cantidad" data-key="'+esc(key)+'" type="number" min="0" max="9999" step="1" value="'+esc(actual.cantidad??qty)+'" placeholder="Pendiente"></td><td data-label="Precio final por unidad"><input aria-label="Precio real '+esc(p.codigo)+'" data-purchase="precioUnitario" data-key="'+esc(key)+'" type="number" min="0" max="1000000000" step="0.01" value="'+esc(actual.precioUnitario??'')+'" placeholder="Pendiente"></td><td data-label="Moneda"><select aria-label="Moneda '+esc(p.codigo)+'" data-purchase="moneda" data-key="'+esc(key)+'">'+['USD','ARS','PYG'].map(c=>'<option '+((actual.moneda||'USD')===c?'selected':'')+'>'+c+'</option>').join('')+'</select></td></tr>';
    }).join('')+'</tbody></table></div>' : '<p class="py-note">Tu lista está vacía. Agregá productos desde Ofertas.</p>';
    refreshPurchaseRows();renderPurchaseProgress();
    const missingItems=Object.entries(selected).filter(([key])=>!eligible(products[key]));
    if(missingItems.length)panel.querySelector('[data-cart-items]').insertAdjacentHTML('beforeend',missingItems.map(([key,qty])=>'<div class="py-note py-missing-item">Producto no disponible: '+esc(products[key]?.nombre||key)+' × '+qty+' <button type="button" class="btn btn-sm py-remove-item" data-remove="'+esc(key)+'" aria-label="Eliminar producto no disponible de la lista" title="Eliminar de la lista"><i class="ti ti-trash" aria-hidden="true"></i></button></div>').join(''));
    const usd = entries.reduce((s,[key,qty]) => s+quote(products[key],purchases[key]?.proveedor).usd*qty,0);
    const ars = entries.reduce((s,[key,qty]) => s+quote(products[key],purchases[key]?.proveedor).ars*qty,0);
    const missing = entries.filter(([key]) => !quote(products[key]).usd).length;
    panel.querySelector('[data-total-products]').textContent = entries.length;
    const units = entries.reduce((s,[,q])=>s+q,0);
    panel.querySelector('[data-total-qty]').textContent = units;
    const cartEntries=Object.entries(listKey?cartDraft.productos:selected).filter(([key])=>eligible(products[key]));
    const cartUnits=cartEntries.reduce((sum,[,qty])=>sum+Number(qty),0);
    panel.querySelector('[data-cart-count]').textContent = cartUnits;
    panel.querySelector('[data-cart]').setAttribute('aria-label','Ver carrito: '+cartUnits+' unidades');
    panel.querySelector('[data-cart-iva]').hidden = !cartEntries.some(([key])=>hasVAT(products[key]));
    panel.querySelector('[data-cart-amount]').textContent = 'US$ '+amount(cartEntries.reduce((s,[key,qty])=>s+saleAmounts(products[key],exchangeRate()).usd*qty,0));
    panel.querySelector('[data-total-usd]').textContent = 'US$ '+amount(usd);
    panel.querySelector('[data-total-ars]').textContent = '$ '+amount(ars);
    panel.querySelector('[data-summary]').textContent = (missing ? missing+' productos sin precio USD. ' : '')+'La referencia no es el costo definitivo. Registrá por separado lo comprado y el precio unitario acordado; no modifica stock ni genera órdenes.';
    if (!panel.querySelector('[data-list-card]').hidden) root.SisVentas?.prepareResizablePage?.(panel.querySelector('[data-cart-items]'));
  }
  function renderPurchaseProgress() {
    const counts={pendiente:0,pedido:0,comprado:0};
    Object.keys(selected).filter(key=>eligible(products[key])).forEach(key=>counts[purchases[key]?.estado||'pendiente']++);
    panel.querySelector('[data-progress]').textContent=counts.pendiente+' pendientes · '+counts.pedido+' pedidos · '+counts.comprado+' comprados. Guardá la lista para conservar los cambios.';
  }
  function renderLists() {
    panel.querySelector('[data-delete-list]').disabled=busy||!listKey||!lists[listKey];
    panel.querySelector('[data-lists]').innerHTML = '<option value="">Nueva lista</option>'+Object.entries(lists).map(([key,list])=>'<option value="'+esc(key)+'"'+(key===listKey?' selected':'')+'>'+esc(list.nombre)+'</option>').join('');
  }
  function status(text) { if(panel) panel.querySelectorAll('[data-status],[data-save-feedback]').forEach(el=>el.textContent=text); }
  async function open(nombre, options = {}) {
    close();editingPurchases.clear();explicitPurchaseEdits.clear();
    const admin = root.currentRole === 'admin' && root.permisoModulo?.('balancecompra');
    if ((!admin && !['compras_paraguay','distribuidora'].includes(root.currentRole)) || !root.currentUserUid) return;
    const actor = root.currentUserUid, role = root.currentRole, session = generation;
    const uid = admin && options.ownerUid || actor;
    const valid = () => generation === session && root.currentUserUid === actor && root.currentRole === role;
    const roleQuery = root.fbRef(root.fbDB, 'sv_chat_roles/'+actor);
    const identity = (await root.fbGet(roleQuery)).val();
    if (!valid()) return;
    if (!identity || identity.rol !== role || identity.activo !== true) throw new Error('No se pudo verificar el acceso a Ofertas');
    panel = document.createElement('main'); panel.id = 'screen-paraguay';
    panel.innerHTML = `
      <style>
      #screen-paraguay .py-add-context{position:sticky;top:0;z-index:5;background:var(--bg2);padding:12px;border:1px solid var(--border);border-radius:10px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}#screen-paraguay .py-add-actions{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-left:auto}#screen-paraguay .py-add-actions [data-confirm-products]{background:var(--green-bg);color:var(--green);border:1px solid var(--green)}#screen-paraguay .py-add-context[hidden]{display:none}#screen-paraguay .py-edit-item{position:absolute;right:12px;top:60px;width:44px;height:44px;padding:0;display:inline-flex;align-items:center;justify-content:center;color:var(--blue);z-index:2}#screen-paraguay [data-purchase-saving]{display:block;margin-top:6px;color:var(--green);font-size:11px}#screen-paraguay .py-list-photo{width:100%;height:100%;object-fit:contain}
      #screen-paraguay [data-cart-items] table{min-width:1100px;table-layout:auto}
      #screen-paraguay [data-cart-items] th:first-child,#screen-paraguay [data-cart-items] td:first-child{width:320px!important;min-width:320px;white-space:normal!important}
      #screen-paraguay .py-list-product strong{white-space:normal;overflow-wrap:anywhere;line-height:1.4;min-width:0}
      #screen-paraguay [data-cart-items] input,#screen-paraguay [data-cart-items] select{max-width:100%;box-sizing:border-box}
      #screen-paraguay [data-cart-items] input[type=number]{width:100px}
      #screen-paraguay .py-provider-choice{display:flex;flex-direction:column;gap:5px;margin-top:10px}
      #screen-paraguay .py-provider-choice>span{font-size:10px;color:var(--text3)}
      #screen-paraguay [data-cart-items] select{padding:8px 10px;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:8px;min-height:34px}
      #screen-paraguay .py-provider-choice select{width:100%;max-width:300px}
      #screen-paraguay [data-cart-items] td{padding:14px 10px;vertical-align:middle}
      #screen-paraguay .py-provider-link{display:inline-block;margin-top:7px}
      #screen-paraguay [data-save]{background:var(--green-bg);color:var(--green);border-color:var(--green)}
        #screen-paraguay{display:flex;height:100dvh;overflow:hidden;flex-direction:column;background:var(--bg);color:var(--text)}
        #screen-paraguay>.app{flex:1;min-height:0;width:100%;overflow:hidden}
        #screen-paraguay .main{min-height:0;min-width:0}
        #screen-paraguay .topbar{flex-shrink:0}
        @media(max-width:600px){#screen-paraguay .topbar{display:flex;flex-wrap:wrap;height:auto;gap:8px;padding:10px 12px}#screen-paraguay .topbar-right{flex-wrap:wrap;gap:8px}}
        #screen-paraguay .nav-item{width:100%;font-family:inherit;text-align:left;background:transparent}
        #screen-paraguay .nav-item.active{background:var(--bg3)}
        #screen-paraguay .py-list-fields{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,2fr);gap:14px}
        #screen-paraguay .py-note{font-size:12px;color:var(--text3);line-height:1.5;margin:10px 0 0}
        #screen-paraguay .py-provider-link{display:inline-flex;align-items:center;gap:4px;color:var(--blue);font-size:11px;margin-top:5px;text-decoration:none}
        #screen-paraguay .py-provider-link:hover{text-decoration:underline}
        #screen-paraguay .m-value{font-size:20px;overflow-wrap:anywhere}
        #screen-paraguay .py-actions{display:flex;gap:8px;flex-wrap:wrap}
        #screen-paraguay .py-menu{display:none}
        #screen-paraguay .content{flex:1;min-height:0;overflow-y:auto;padding-bottom:65px;overscroll-behavior-y:contain}
        #screen-paraguay .catalogo-precio{gap:5px;align-items:baseline}
        #screen-paraguay .py-view-switch{display:flex;gap:6px}
        #screen-paraguay .py-catalog-controls{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
        #screen-paraguay .py-group-label{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text2);cursor:pointer}
        #screen-paraguay .py-brand-heading{grid-column:1/-1;display:flex;align-items:baseline;gap:10px;margin:8px 0 0;padding-bottom:10px;border-bottom:1px solid var(--border);font-size:14px;color:var(--blue)}
        #screen-paraguay .py-brand-heading small{font-size:11px;font-weight:400;color:var(--text3)}
        #screen-paraguay .py-view-switch [aria-pressed="true"]{background:var(--bg3);color:var(--blue);border-color:var(--blue)}
        #screen-paraguay [data-products-card]>.card-head{flex-wrap:wrap;gap:12px}
        #screen-paraguay .py-catalog-list{grid-template-columns:minmax(0,1fr);gap:10px}
        #screen-paraguay .py-catalog-list .catalogo-card{display:flex;align-items:stretch}
        #screen-paraguay .py-catalog-list .catalogo-card-imagen{width:120px;min-height:150px;height:auto;flex-shrink:0}
        #screen-paraguay .py-catalog-list .catalogo-card-body{flex:1;min-width:0;padding:14px 124px 14px 18px}
        #screen-paraguay .py-catalog-list .catalogo-card h3{font-size:14px;margin-top:5px}
        #screen-paraguay .py-catalog-list .catalogo-card p{min-height:0;margin:6px 0;-webkit-line-clamp:1}
        #screen-paraguay .py-catalog-list .catalogo-card-footer{min-height:0;padding:8px 0 0}
        @media(max-width:600px){#screen-paraguay .py-catalog-list .catalogo-card-imagen{width:82px;min-height:160px}#screen-paraguay .py-catalog-list .catalogo-card-body{padding:12px 12px 64px}#screen-paraguay .py-catalog-list .catalogo-card h3{font-size:12px}#screen-paraguay .py-catalog-list .catalogo-card-img{padding:6px}}
        #screen-paraguay [hidden]{display:none!important}
        #screen-paraguay [data-cart-items] input{width:100%;min-width:75px;max-width:160px;padding:7px;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:6px}
        #screen-paraguay .table-wrap{overflow:auto}
        #screen-paraguay table{min-width:680px}
        #screen-paraguay [data-status]:empty{display:none}
        #screen-paraguay [data-status]{font-size:12px;color:var(--blue);margin-top:12px}
        @media(max-width:1100px){#screen-paraguay .py-menu{display:inline-flex}}
        @media(max-width:768px){#screen-paraguay .py-menu{display:inline-flex}#screen-paraguay .py-list-fields{grid-template-columns:1fr}#screen-paraguay .topbar{grid-template-columns:minmax(0,1fr) auto}#screen-paraguay .topbar-center{display:none}#screen-paraguay .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}

        #screen-paraguay [data-item-state="comprado"]{box-shadow:inset 4px 0 var(--green)}
        #screen-paraguay [data-item-state="pedido"]{box-shadow:inset 4px 0 var(--blue)}
        /* The shopping list uses its available container, including tablet split views. */
        #screen-paraguay .content{min-width:0;width:100%;max-width:none;box-sizing:border-box}
        #screen-paraguay [data-list-card]{min-width:0;container-type:inline-size}
        #screen-paraguay [data-list-card]>.card-head{flex-wrap:wrap;gap:12px}
        #screen-paraguay .py-actions{margin-left:auto}
        #screen-paraguay .py-list-fields>*{min-width:0}
        #screen-paraguay .py-list-fields input,#screen-paraguay .py-list-fields select{width:100%;min-height:44px;box-sizing:border-box}
        #screen-paraguay [data-cart-items] table{width:100%!important;min-width:0;table-layout:fixed}
        #screen-paraguay [data-cart-items] th:first-child,#screen-paraguay [data-cart-items] td:first-child{width:30%!important;min-width:0}
        #screen-paraguay [data-cart-items] th,#screen-paraguay [data-cart-items] td{white-space:normal;overflow-wrap:anywhere}
        #screen-paraguay [data-cart-items] input[type=number],#screen-paraguay [data-cart-items] select{width:100%;max-width:none;min-width:0;min-height:44px;font-size:16px}
        #screen-paraguay [data-list-card] .btn,#screen-paraguay .py-add-context .btn{min-height:44px}
        #screen-paraguay .py-add-context{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px;margin-bottom:12px;border:1px solid var(--green);border-radius:10px}
        #screen-paraguay .metrics{grid-template-columns:repeat(4,minmax(0,1fr));min-width:0}
        #screen-paraguay [data-cart-items] tbody tr,#screen-paraguay .py-missing-item{position:relative}
        #screen-paraguay [data-cart-items] .py-remove-item{position:absolute;top:12px;right:12px;width:44px;height:44px;min-height:44px;padding:0;display:inline-flex;align-items:center;justify-content:center;color:var(--red);z-index:2}
        #screen-paraguay .py-remove-item i{font-size:18px;line-height:1;flex:none}
        #screen-paraguay .py-missing-item{padding:18px 64px 18px 14px}
        #screen-paraguay [data-cart-items] tbody td:last-child{padding-right:66px}
        @container(max-width:1100px){
          #screen-paraguay [data-cart-items] table,#screen-paraguay [data-cart-items] tbody{display:block}
          #screen-paraguay [data-cart-items] thead{display:none}
          #screen-paraguay [data-cart-items] tr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:16px;margin-top:14px;border:1px solid var(--border);border-radius:12px;background:var(--bg)}
          #screen-paraguay [data-cart-items] td{display:block;padding:0;border:0;min-width:0}
          #screen-paraguay [data-cart-items] td:first-child{grid-column:1/-1;width:auto!important;padding-right:52px}
          #screen-paraguay [data-cart-items] td[data-label]:before{content:attr(data-label);display:block;margin-bottom:7px;font-size:12px;color:var(--text3)}
          #screen-paraguay [data-cart-items] tbody td:last-child{padding-right:0}
          #screen-paraguay .py-provider-choice select{max-width:none}
        }
        @container(max-width:540px){#screen-paraguay [data-cart-items] tr{grid-template-columns:repeat(2,minmax(0,1fr))}#screen-paraguay .py-list-fields{grid-template-columns:minmax(0,1fr)}}
        @media(max-width:1100px){#screen-paraguay .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
      </style>
      <div class="app">
        <aside class="sidebar" aria-label="Navegación de Ofertas">
          <div class="s-logo"><div class="s-brand">SisVentas</div><div class="s-sub">powered by Nixa</div></div>
          <nav class="s-nav"><div class="s-section">Compras</div><button class="nav-item active" data-nav="products"><i class="ti ti-package" aria-hidden="true"></i> Ofertas</button><button class="nav-item" data-nav="lists"><i class="ti ti-list-check" aria-hidden="true"></i> Mis listas de compra</button></nav>
          <div class="s-foot"><div class="s-user"><div class="s-avatar admin">${esc(nombre.slice(0,2).toUpperCase())}</div><div style="min-width:0"><div class="s-uname">${esc(nombre)}</div><div class="s-urole">${role === 'distribuidora' ? 'Distribuidora' : 'Ofertas'}</div></div></div><button class="btn btn-sm" data-logout style="width:100%;justify-content:center;margin-top:8px"><i class="ti ti-logout" aria-hidden="true"></i> Cerrar sesión</button></div>
        </aside>
        <div class="main">
          <header class="topbar"><div style="display:flex;align-items:center;gap:10px"><button class="btn btn-icon py-menu" data-menu aria-label="Abrir menú" aria-expanded="false"><i class="ti ti-menu-2" aria-hidden="true"></i></button><span class="page-title">Ofertas</span></div><div class="topbar-center"><span class="topbar-date">${esc(new Date().toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short',year:'numeric'}))}</span></div><div class="topbar-right"><span class="catalogo-carrito-indicador"><i class="ti ti-shopping-cart" aria-hidden="true"></i> <button type="button" class="catalogo-carrito-contador" style="border:0;cursor:pointer;color:var(--bg);font:inherit;font-weight:700" data-cart aria-label="Ver carrito"><span data-cart-count aria-live="polite">0</span></button><span class="catalogo-carrito-importe"><span data-cart-amount></span> <small data-cart-iva hidden>con IVA</small></span></span><button class="icon-btn" data-appearance aria-label="Aspecto visual" title="Aspecto visual"><i class="ti ti-settings" aria-hidden="true"></i></button></div></header>
          <div class="content">
            <div class="metrics" aria-label="Resumen de la lista">
              <div class="metric"><div class="m-label">Productos seleccionados</div><div class="m-value" data-total-products>0</div><div class="m-sub">en tu lista de compra</div></div>
              <div class="metric"><div class="m-label">Unidades a comprar</div><div class="m-value" data-total-qty>0</div><div class="m-sub">cantidad total</div></div>
              <div class="metric"><div class="m-label">Precio página USD</div><div class="m-value" data-total-usd style="color:var(--blue)">US$ 0,00</div><div class="m-sub">total de productos</div></div>
              <div class="metric"><div class="m-label">Costo total ARS</div><div class="m-value" data-total-ars style="color:var(--amber)">$ 0,00</div><div class="m-sub">incluye envío registrado</div></div>
            </div>
            <section class="card" data-list-card aria-label="Lista de compra">
              <div class="card-head"><span class="card-title">Lista de compra</span><div class="py-actions"><button class="btn btn-sm" data-add-products>＋ Agregar productos</button><button class="btn btn-sm" data-pdf-list><i class="ti ti-file-type-pdf" aria-hidden="true"></i> Exportar PDF</button><button class="btn btn-sm" data-download><i class="ti ti-download" aria-hidden="true"></i> Descargar CSV</button><button class="btn btn-sm" data-delete-list disabled style="color:var(--red,#ef8585)"><i class="ti ti-trash" aria-hidden="true"></i> Eliminar lista</button><span data-save-feedback role="status" aria-live="polite" style="font-size:12px;max-width:320px;white-space:normal"></span><button class="btn btn-sm btn-primary" data-save><i class="ti ti-device-floppy" aria-hidden="true"></i> Guardar lista</button></div></div>
              <div class="py-list-fields"><div class="fg"><label for="py-mis-listas">Mis listas</label><select id="py-mis-listas" data-lists><option value="">Nueva lista</option></select></div><div class="fg"><label for="py-lista-nombre">Nombre de la lista</label><input id="py-lista-nombre" data-name maxlength="120" placeholder="Ej. Próximo viaje"></div></div>
              <p class="py-note" data-list-dates></p><p class="py-note" data-progress role="status"></p><div data-cart-items aria-label="Productos del carrito"></div><p class="py-note" data-summary></p><p data-status role="status"></p>
            </section>
            <section class="card" data-products-card aria-label="Catálogo de Productos">
              <div class="card-head"><span class="card-title">Catálogo de Productos</span><div class="py-catalog-controls"><button type="button" class="btn btn-sm" data-pdf-catalog><i class="ti ti-file-type-pdf" aria-hidden="true"></i> Exportar PDF</button><label class="py-group-label"><input type="checkbox" data-group-brand> Agrupar por marca</label><div class="py-view-switch" role="group" aria-label="Vista del catálogo"><button type="button" class="btn btn-sm" data-layout="grid" aria-pressed="true"><i class="ti ti-layout-grid" aria-hidden="true"></i> Cuadrícula</button><button type="button" class="btn btn-sm" data-layout="list" aria-pressed="false"><i class="ti ti-list" aria-hidden="true"></i> Lista</button></div></div></div>
              <div class="py-add-context" data-add-context hidden><strong data-add-title></strong><div class="py-add-actions"><button class="btn" data-return-list>Revisar lista</button><button class="btn btn-primary" data-confirm-products>Confirmar productos en la lista</button></div></div><input class="search-input" data-search aria-label="Buscar producto" placeholder="Buscar por nombre, código o marca…" style="width:100%">
              <p class="py-note" data-count style="margin-bottom:16px"></p>
              <div class="catalogo-grid" data-products></div>
              <p class="py-note">Los precios corresponden a la última información registrada.</p>
            </section>
          </div>
        </div>
      </div>`;
    document.body.appendChild(panel);
    renderExchangeReference();
    if(role==='distribuidora'){
      const create=document.createElement('button');create.className='btn btn-primary';create.textContent='Nuevo producto';create.onclick=()=>root.SVDistribuidora.edit(null,null);panel.querySelector('[data-products-card] .card-head').appendChild(create);
      const refreshPermissions=()=>{create.hidden=!root.SVDistribuidora.allowed('crear');if(detailModal)detailModal.remove();};refreshPermissions();document.addEventListener('sisventas:distribuidora-permissions',refreshPermissions);stops.push(()=>document.removeEventListener('sisventas:distribuidora-permissions',refreshPermissions));
    }
    panel.querySelector('[data-pdf-catalog]').onclick=()=>exportPDF(false);
    panel.querySelector('[data-pdf-list]').onclick=()=>exportPDF(true);
    const groupBrand = panel.querySelector('[data-group-brand]');
    try {groupBrand.checked=root.localStorage.getItem('sv_ofertas_group_brand')==='true';} catch (_) {}
    groupBrand.onchange=()=>{try {root.localStorage.setItem('sv_ofertas_group_brand',String(groupBrand.checked));} catch (_) {} renderProducts();};
    const setLayout = layout => {
      panel.querySelector('[data-products]').classList.toggle('py-catalog-list',layout==='list');
      panel.querySelectorAll('[data-layout]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.layout===layout)));
    };
    try {setLayout(root.localStorage.getItem('sv_ofertas_layout')==='list'?'list':'grid');} catch (_) {setLayout('grid');}
    panel.querySelectorAll('[data-layout]').forEach(button=>button.onclick=()=>{
      setLayout(button.dataset.layout);
      try {root.localStorage.setItem('sv_ofertas_layout',button.dataset.layout);} catch (_) {}
    });
    if (admin) {
      panel.style.cssText = 'position:fixed;inset:0;z-index:10000';
      panel.querySelector('.s-urole').textContent = 'Administrador · Ofertas';
      panel.querySelector('[data-logout]').textContent = 'Volver a Compras de exterior';
      const back = document.createElement('button');
      back.className = 'btn btn-sm';back.textContent = '← Compras de exterior';
      back.onclick = () => {if(!busy){close();options.onClose?.();}};
      const backRow = document.createElement('div');
      backRow.style.cssText = 'margin-bottom:14px;display:flex;align-items:center';
      backRow.appendChild(back);
      panel.querySelector('.content').prepend(backRow);
      panel.querySelector('.page-title').textContent = 'Ofertas · ' + (options.ownerName || 'Mis listas');
      const ownerNote = document.createElement('p');
      ownerNote.className = 'py-note';
      ownerNote.textContent = 'Listas de: ' + (options.ownerName || nombre) + '. Los cambios se guardan para este usuario.';
      panel.querySelector('[data-list-card]').prepend(ownerNote);
    }
    function showView(listsView) {
      panel.querySelector('[data-products-card]').hidden=listsView;
      panel.querySelector('[data-list-card]').hidden=!listsView;
      panel.querySelector('.metrics').hidden=!listsView;
      panel.querySelector('.page-title').textContent=listsView?'Mis listas de compra':'Ofertas';
      panel.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',(b.dataset.nav==='lists')===listsView));
      panel.querySelector('.sidebar').classList.remove('open');
      panel.querySelector('[data-menu]').setAttribute('aria-expanded','false');
      panel.querySelector('.content').scrollTop=0;
      // El portal no navega con showPage: al quitar hidden hay que reactivar
      // las tablas que se prepararon mientras el catálogo estaba visible.
      if (listsView) root.SisVentas?.prepareResizablePage?.(panel.querySelector('[data-cart-items]'));
    }
    showView(!!options.listKey);
    const preferences = document.createElement('div');
    preferences.hidden = true;
    preferences.setAttribute('role','dialog'); preferences.setAttribute('aria-label','Configuración de cuenta');
    preferences.style.cssText = 'position:fixed;right:12px;top:60px;z-index:999999;width:min(280px,calc(100vw - 24px));padding:18px;border:1px solid var(--border);border-radius:14px;background:var(--bg2);box-shadow:0 8px 24px #0003';
    preferences.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><strong>Configuración</strong><button class="btn btn-sm" data-close-appearance aria-label="Cerrar apariencia">×</button></div><div class="up-style-options" style="margin-top:14px"><button class="btn" data-visual="v3">SisVentas 3</button><button class="btn" data-visual="classic">Clásico</button></div><label style="display:flex;align-items:center;justify-content:space-between;margin-top:18px">Modo oscuro<input type="checkbox" data-dark></label>';
    const logoutRight=document.createElement('button');logoutRight.type='button';logoutRight.className='btn';logoutRight.dataset.logoutRight='';logoutRight.textContent='Cerrar sesión';logoutRight.style.cssText='width:100%;justify-content:center;min-height:44px;margin-top:20px';logoutRight.onclick=()=>root.doLogout();preferences.appendChild(logoutRight);
    preferences.style.maxHeight='calc(100dvh - 84px)';preferences.style.overflowY='auto';
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
    function rememberCart() {
      if(!listKey)cartDraft={productos:{...selected},comprasFinales:structuredClone(purchases),nombre:panel.querySelector('[data-name]').value};
    }
    function openCart() {
      if(busy)return;
      if(listKey){listKey='';listBaseline=null;selected={...cartDraft.productos};purchases=structuredClone(cartDraft.comprasFinales);panel.querySelector('[data-name]').value=cartDraft.nombre;}
      panel.querySelector('[data-add-context]').hidden=true;renderLists();renderProducts();
    }
    panel.querySelector('[data-add-products]').onclick=()=>{
      panel.querySelector('[data-add-context]').hidden=false;
      panel.querySelector('[data-add-title]').textContent='Agregando productos a: '+(panel.querySelector('[data-name]').value||'Nueva lista');
      showView(false);panel.querySelector('[data-search]').focus();
    };
    panel.querySelector('[data-return-list]').onclick=()=>showView(true);
    panel.querySelector('[data-confirm-products]').onclick=async()=>{if(busy)return;showView(true);await panel.querySelector('[data-save]').onclick();};
    panel.querySelectorAll('[data-nav]').forEach(button => button.onclick = () => {
      if(button.dataset.nav!=='lists')openCart();
      showView(button.dataset.nav === 'lists');
    });
    panel.querySelector('[data-logout]').onclick = () => {if(admin){if(!busy){close();options.onClose?.();}}else root.doLogout();};
    panel.querySelector('[data-search]').oninput = renderProducts;
    panel.querySelector('[data-cart-items]').onclick = e => {const edit=e.target.closest('[data-edit-purchase]');if(edit){editingPurchases.add(edit.dataset.editPurchase);explicitPurchaseEdits.add(edit.dataset.editPurchase);renderSummary();return;}const button=e.target.closest('[data-remove]');if(button){delete selected[button.dataset.remove];delete purchases[button.dataset.remove];renderProducts();}};
    function capturePurchase(input) {
      const field=input.dataset.purchase,key=input.dataset.key;if(!field||!key)return;
      purchases[key]||={};if(field==='cantidad'&&purchases[key].cantidad==null&&!Number.isFinite(purchases[key].precioUnitario)&&input.value===String(selected[key]))return;if(input.value==='')delete purchases[key][field];else purchases[key][field]=['cantidad','precioUnitario'].includes(field)?Number(input.value):input.value;
    }
    panel.querySelector('[data-cart-items]').oninput=e=>{
      const t=e.target;if(t.dataset.purchase==='estado')return;capturePurchase(t);
      if(t.dataset.purchase==='precioUnitario'&&t.value!==''&&t.checkValidity()){
        const item=purchases[t.dataset.key];item.cantidad=item.cantidad??Number(selected[t.dataset.key]);item.estado=item.cantidad>0?'comprado':'pendiente';editingPurchases.add(t.dataset.key);
        const row=t.closest('tr');row.querySelector('[data-purchase="cantidad"]').value=item.cantidad;row.querySelector('[data-purchase="estado"]').value=item.estado;row.dataset.itemState=item.estado;
      }
      refreshPurchaseRows();renderPurchaseProgress();
    };
    panel.querySelector('[data-cart-items]').onchange=e=>{
      if(e.target.dataset.requested){const qty=Number(e.target.value);if(!e.target.reportValidity())return;selected[e.target.dataset.requested]=qty;renderProducts();return;}
      if(e.target.dataset.purchase==='estado'&&e.target.value==='comprado'){
        const item=purchases[e.target.dataset.key]||{};
        if(!(item.cantidad>0)||!Number.isFinite(item.precioUnitario)){
          e.target.value=item.estado||'pendiente';status('Para marcar como comprado, completá la cantidad comprada y el precio unitario final (puede ser 0).');return;
        }
      }
      capturePurchase(e.target);
      if(e.target.dataset.purchase==='estado'){e.target.closest('tr').dataset.itemState=e.target.value;renderPurchaseProgress();}
    };
    panel.querySelector('[data-cart]').onclick = () => {if(panel.querySelector('[data-add-context]').hidden)openCart();showView(true);};
    panel.querySelector('[data-products]').onclick = e => {
      const minus=e.target.closest('[data-subtract]');if(minus){const key=minus.dataset.subtract;if(selected[key]>1)selected[key]--;else {delete selected[key];delete purchases[key];}renderProducts();return;}
      const button = e.target.closest('[data-add]'); if (!button) {if(!e.target.closest('input,label,a')){const card=e.target.closest('[data-detail]');if(card)showDetail(card.dataset.detail);}return;}
      const key = button.dataset.add; if (!eligible(products[key])) return;
      selected[key] = Math.min(9999, (Number(selected[key]) || 0) + 1);
      renderProducts();
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
      rememberCart();
      if(!e.target.value){openCart();return;}
      listKey = e.target.value; const list = lists[listKey] || {}; listBaseline=listKey?structuredClone(list):null;
      selected = Object.assign({}, list.productos || {}); purchases=structuredClone(list.comprasFinales||{}); panel.querySelector('[data-name]').value = list.nombre || '';
      status(''); renderProducts();
    };
    panel.querySelector('[data-delete-list]').onclick = async () => {
      if(busy||!valid()||!listKey||!lists[listKey])return;
      const key=listKey, name=lists[key].nombre;
      busy=true;panel.querySelector('[data-save]').disabled=true;panel.querySelector('[data-lists]').disabled=true;renderLists();
      try {
        const removed=await removeShoppingList(uid,key,name);
        if(removed&&valid()&&panel){delete lists[key];listKey='';listBaseline=null;selected={};purchases={};panel.querySelector('[data-name]').value='';renderProducts();status('Lista eliminada.');}
      } catch(e){if(valid())status('No se pudo eliminar la lista. Revisá la conexión y el acceso.');}
      finally{if(valid()&&panel){busy=false;panel.querySelector('[data-save]').disabled=false;panel.querySelector('[data-lists]').disabled=false;renderLists();}}
    };
    panel.querySelector('[data-save]').onclick = async () => {
      if (busy || !valid()) return;
      const name = panel.querySelector('[data-name]').value.trim();
      const items = Object.fromEntries(Object.entries(selected).filter(([key])=>eligible(products[key])));
      if (Object.keys(selected).some(key=>!eligible(products[key]))) {status('La lista contiene productos que ya no están disponibles. Quitalos de la lista antes de guardar.');return;}
      if (!name || !Object.keys(items).length) { status('Completá el nombre y elegí al menos un producto con cantidad.'); return; }
      for (const input of panel.querySelectorAll('[data-requested],[data-purchase]')) if (!input.reportValidity()) {status('Revisá '+(input.getAttribute('aria-label')||'los valores ingresados')+'. La lista todavía no se guardó.');return;}
      panel.querySelectorAll('[data-purchase]').forEach(capturePurchase);
      const actualItems={};
      for(const [productKey,value] of Object.entries(purchases)) {
        if(!items[productKey])continue;
        const state=value.estado||'pendiente';
        if(!purchaseStates[state]||(state==='comprado'&&(!(value.cantidad>0)||!Number.isFinite(value.precioUnitario)))){status('Revisá cantidad y precio final de los productos marcados como comprados.');return;}
        if(value.cantidad==null && value.precioUnitario==null){actualItems[productKey]={proveedor:value.proveedor||'',moneda:value.moneda||'USD',estado:state};continue;}
        if(!Number.isInteger(value.cantidad)||value.cantidad<0||value.cantidad>9999||!Number.isFinite(value.precioUnitario)||value.precioUnitario<0||value.precioUnitario>1e9||!['USD','ARS','PYG'].includes(value.moneda||'USD')){status('Completá cantidad comprada y precio real de cada producto revisado.');return;}
        actualItems[productKey]={estado:state,cantidad:value.cantidad,precioUnitario:value.precioUnitario,moneda:value.moneda||'USD',proveedor:value.proveedor||''};
      }
      busy = true; status('Guardando lista…');panel.querySelector('[data-save]').textContent='Guardando…';panel.querySelector('[data-save]').setAttribute('aria-busy','true'); panel.querySelector('[data-delete-list]').disabled=true; panel.querySelector('[data-save]').disabled = true; panel.querySelector('[data-lists]').disabled = true;
      const key = listKey || root.fbPush(root.fbRef(root.fbDB,'sv_listas_paraguay/'+uid)).key;
      try {
        const path='sv_listas_paraguay/'+uid+'/'+key;
        const data={nombre:name,productos:items,actualizadoEn:root.fbServerTimestamp(),comprasFinales:Object.keys(actualItems).length?actualItems:null,...listHistory(listKey?listBaseline:null,items,actualItems)};
        let saved;
        if(listKey){
          if(!listBaseline||!root.SVGuardedWrites)throw new Error('Volvé a abrir la lista antes de guardar.');
          saved=await root.SVGuardedWrites.save(path,listBaseline,data,true,{ignoreUpdatedTimestamp:true});
        }else{
          await root.fbSet(root.fbRef(root.fbDB,path),data);
          saved=(await root.fbGet(root.fbRef(root.fbDB,path))).val();
        }
        if(valid())listBaseline=structuredClone(saved);
        if(valid()&&panel){editingPurchases.clear();explicitPurchaseEdits.clear();if(!listKey)cartDraft={productos:{},comprasFinales:{},nombre:''};lists[key]=structuredClone(saved);listKey=key;panel.querySelector('[data-add-context]').hidden=true;showView(true);renderLists();renderProducts();status('✓ Lista guardada correctamente.');}
      } catch (e) {if(valid())status(e.code==='SV_CONFLICT'?'La versión guardada de esta lista cambió desde que la abriste, posiblemente en otra ventana. Tus cambios siguen aquí; revisá la lista antes de reintentar.':(e.message||'No se pudo guardar la lista. Revisá la conexión y el acceso.'));}
      finally {if(valid()){busy=false;if(panel){panel.querySelector('[data-save]').textContent='Guardar lista';panel.querySelector('[data-save]').setAttribute('aria-busy','false');panel.querySelector('[data-save]').disabled=false;panel.querySelector('[data-lists]').disabled=false;renderLists();}}}
    };
    panel.querySelector('[data-download]').onclick = () => {
      if (!Object.keys(selected).some(key=>eligible(products[key]))) {status('Elegí al menos un producto para descargar.');return;}
      const blob = new Blob([csv(selected,products,purchases)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='lista-compras-paraguay.csv';link.click();URL.revokeObjectURL(url);
    };
    const query = root.fbQuery(root.fbRef(root.fbDB,'sisventas/productos'),root.fbOrderByChild('categoria'),root.fbEqualTo(CATEGORY));
    stops.push(subscribeExchangeRate(root,valid,()=>{if(panel){renderExchangeReference();renderProducts();}},()=>status('No se pudo cargar la cotización. Revisá la conexión y volvé a ingresar.')));
    stops.push(root.fbOnValue(query,snap=>{if(!valid())return;products=snap.val()||{};if(panel)renderProducts();},()=>status('No se pudo cargar el catálogo autorizado.')));
    let initialList = options.listKey || '';
    stops.push(root.fbOnValue(root.fbRef(root.fbDB,'sv_listas_paraguay/'+uid),snap=>{if(!valid())return;lists=snap.val()||{};if(panel){if(initialList){listKey=initialList;initialList='';const list=lists[listKey]||{};listBaseline=structuredClone(list);selected={...list.productos};purchases=structuredClone(list.comprasFinales||{});panel.querySelector('[data-name]').value=list.nombre||'';renderProducts();}renderLists();}},()=>status('No se pudieron cargar tus listas.')));
    stops.push(root.fbOnValue(roleQuery,snap=>{if(!valid())return;const identity=snap.val();if(!identity||identity.activo!==true||identity.rol!==role){close();root.doLogout();}}));
    renderProducts();
  }
  const originalRoles = root._renderTablaRolesUI;
  if (typeof originalRoles === 'function') root._renderTablaRolesUI = function() {
    originalRoles.apply(this,arguments);
    const container = document.getElementById('cfg-roles-tabla');
    if(container)root.SVDistribuidora?.renderSettings(container);
    if (container) container.insertAdjacentHTML('afterbegin','<section class="card" aria-label="Rol Compras Paraguay"><div class="card-head"><span class="card-title">Compras Paraguay</span><span class="badge">Acceso limitado</span></div><p>Catálogo exclusivo de la categoría COMPRAS PARAGUAY, listas de compra propias y ajustes de apariencia.</p><p style="font-size:12px;color:var(--text3)">Este rol se asigna desde Usuarios. No tiene acceso a los módulos generales ni modifica productos.</p></section>');
  };
  document.addEventListener('sisventas:session-ended',close);
  root.SVParaguayPortal = {listSavings,open,close,removeList:removeShoppingList,returnFromProduct,isProductSheetOpen:()=>!!productSheet};
})(typeof window === 'undefined' ? {} : window);
