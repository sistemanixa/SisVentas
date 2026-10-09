(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
  function summarize(list,products){
    const rows=Object.entries(list.productos||{}).map(([key,qty])=>{
      const p=products[key],quote=root.SVParaguayQuote||(typeof require==='function'?require('./paraguay-shopping-access').quote:null);
      const q=p&&quote?quote(p,list.comprasFinales?.[key]?.proveedor):{usd:0,ars:0,store:''};
      return {key,qty:Number(qty)||0,name:p&&(p.nombre||p.descripcion)||'Producto no disponible',code:p&&p.codigo||key,usd:q.usd,ars:q.ars,store:q.store};
    });
    const grouped=new Map();
    rows.forEach(row=>{
      const name=String(row.store||'Local por identificar').trim(),key=name.toLocaleUpperCase('es');
      if(!grouped.has(key))grouped.set(key,{name,products:0,units:0});
      const group=grouped.get(key);group.products++;group.units+=row.qty;
    });
    const stores=Array.from(grouped.values()).sort((a,b)=>a.name.localeCompare(b.name,'es'));
    return {rows,stores,units:rows.reduce((s,r)=>s+r.qty,0),usd:rows.reduce((s,r)=>s+r.qty*r.usd,0),ars:rows.reduce((s,r)=>s+r.qty*r.ars,0)};
  }
  function combine(entries,products,pendingOnly=true){
    const stores=new Map();
    entries.forEach(entry=>summarize(entry.list,products).rows.forEach(row=>{
      const state=entry.list.comprasFinales?.[row.key]?.estado||'pendiente';
      if(row.qty<=0||(pendingOnly&&state!=='pendiente'))return;
      const name=String(row.store||'Local por identificar').trim(),id=name.toLocaleUpperCase('es');
      if(!stores.has(id))stores.set(id,{name,rows:[],units:0,usd:0,ars:0});
      const store=stores.get(id);let item=store.rows.find(r=>r.key===row.key);
      if(!item){item={...row,qty:0,usdTotal:0,arsTotal:0,sources:[]};store.rows.push(item);}
      item.qty+=row.qty;item.usdTotal+=row.qty*row.usd;item.arsTotal+=row.qty*row.ars;
      item.sources.push({owner:entry.owner,list:entry.list.nombre,uid:entry.uid,listId:entry.listId,qty:row.qty,state,purchase:structuredClone(entry.list.comprasFinales?.[row.key]||{})});
      store.units+=row.qty;store.usd+=row.qty*row.usd;store.ars+=row.qty*row.ars;
    }));
    return Array.from(stores.values()).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  }
  if(typeof module!=='undefined')module.exports={summarize,combine};
  if(!root.document)return;
  let host,owner='',request=0,stops=[],timer=null,products={},groups=new Map(),readyProducts=false,readyUsers=false,syncError=false;
  let view='users',excluded=new Set(),pendingOnly=true,drafts=new Map(),visibleRows=new Map(),saving=false,saveMessage='';
  const allowed=()=>root.currentRole==='admin'&&root.permisoModulo&&root.permisoModulo('balancecompra');
  function stop(){request++;stops.splice(0).forEach(off=>off());groups.forEach(g=>g.off?.());groups.clear();clearTimeout(timer);timer=null;}
  function reset(){stop();host?.remove();host=null;owner='';products={};view='users';excluded.clear();pendingOnly=true;drafts.clear();visibleRows.clear();saveMessage='';}
  function mount(){
    if(!allowed()){reset();return;}
    if(host?.isConnected&&owner===root.currentUserUid)return;
    reset();owner=root.currentUserUid;
    const page=document.getElementById('page-balancecompra');if(!page)return;
    host=document.createElement('section');host.className='card';host.id='exterior-user-lists';
    host.innerHTML='<style>#exterior-user-lists [data-list]>summary{display:flex;align-items:center;gap:8px}#exterior-user-lists [data-list]>summary::before{content:"▸"}#exterior-user-lists [data-list][open]>summary::before{content:"▾"}.list-summary-layout{width:100%;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}.list-summary-left{flex:1;min-width:220px}.list-summary-profit{display:block;text-align:right;min-width:230px;padding:8px 14px;border-left:2px solid var(--green);color:var(--green)}.list-summary-profit strong{display:block;font-size:27px;font-weight:800;margin:4px 0}.list-summary-profit small{display:block;font-size:11px;color:var(--text3);max-width:340px}.list-summary-profit .profit-label{font-size:11px;font-weight:700;letter-spacing:.06em}@media(max-width:600px){.list-summary-profit{width:100%;text-align:left;border-left:0;border-top:1px solid var(--border);padding:12px 0 0}}#page-balancecompra #exterior-user-lists{background:transparent;border:0;border-bottom:1px solid var(--border);border-radius:0;box-shadow:none;padding:16px 0 28px;margin-bottom:24px}.exterior-list-photo{width:100%;height:100%;object-fit:contain}</style><h3 style="font-size:15px;font-weight:700;margin:0">Listas de usuarios</h3><div class="card-head" style="margin-top:14px"><button class="btn btn-sm btn-primary" data-catalog>Ofertas · Mis listas</button><button class="btn btn-sm" data-refresh>Actualizar listas</button></div><p style="font-size:12px;color:var(--text3)">Agrupadas por usuario. Los totales se calculan con los precios actuales del catálogo; estas listas todavía no son órdenes de compra.</p><div style="display:flex;gap:8px;margin:14px 0"><button class="btn btn-sm" data-view="users" aria-pressed="true">Por usuario</button><button class="btn btn-sm" data-view="stores" aria-pressed="false">Ver por proveedor</button></div><div data-results role="status">Cargando listas…</div>';
    page.prepend(host);host.querySelector('[data-refresh]').onclick=load;
    host.onclick=async e=>{
      const save=e.target.closest('[data-save-price]');if(save&&allowed()){await savePrice(save.dataset.savePrice);return;}
      const mode=e.target.closest('[data-view]');if(mode&&allowed()){view=mode.dataset.view;render();return;}
      const button=e.target.closest('[data-catalog],[data-edit-list],[data-delete-list]');if(!button||!allowed())return;
      button.disabled=true;
      try{if(button.hasAttribute('data-delete-list')){if(await root.SVParaguayPortal.removeList(button.dataset.owner,button.dataset.deleteList,button.dataset.name))await load();return;}await root.SVParaguayPortal.open('Administrador',{ownerUid:button.dataset.owner,ownerName:button.dataset.ownerName,listKey:button.dataset.editList,onClose:load});}
      catch(_){targetError(button.hasAttribute('data-delete-list')?'No se pudo eliminar la lista. Revisá la conexión y el acceso.':'No se pudo abrir el catálogo. Revisá la conexión y volvé a intentar.');}
      finally{button.disabled=false;}
    };
    host.onchange=e=>{if(!allowed())return;if(e.target.matches('[data-agreed-price],[data-agreed-currency]')){const id=e.target.dataset.agreedPrice||e.target.dataset.agreedCurrency,row=visibleRows.get(id);let d=drafts.get(id);if(!d){d={value:'',currency:'USD',sources:structuredClone(row.sources),key:row.key};drafts.set(id,d);}const box=e.target.closest('[data-price-editor]');d.value=box.querySelector('[data-agreed-price]').value;d.currency=box.querySelector('[data-agreed-currency]').value;saveMessage='';render();return;}if(e.target.matches('[data-select-list]')){const id=e.target.dataset.selectList;e.target.checked?excluded.delete(id):excluded.add(id);render();}if(e.target.matches('[data-pending-only]')){pendingOnly=e.target.checked;render();}};
    load();
  }
  function targetError(message){if(host)host.querySelector('[data-results]').textContent=message;}
  function render(){
    if(!allowed()||!host)return;
    const result=host.querySelector('[data-results]');
    if(syncError){targetError('No se pudieron sincronizar las listas. Volvé a actualizar para reintentar.');return;}
    if(!readyProducts||!readyUsers||Array.from(groups.values()).some(g=>!g.ready)){result.textContent='Cargando listas…';return;}
    const opened=new Set(Array.from(result.querySelectorAll('details[open]')).map(n=>n.dataset.list||n.dataset.group));
      const errors=Array.from(groups.values()).filter(g=>g.error),filled=Array.from(groups.values()).filter(g=>!g.error&&Object.keys(g.lists).length).sort((a,b)=>String(a.user.nombre||a.user.login).localeCompare(String(b.user.nombre||b.user.login),'es'));
      host.querySelectorAll('[data-view]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.view===view));b.classList.toggle('btn-primary',b.dataset.view===view);});
      host.querySelector('p').hidden=view==='stores';
      if(view==='stores'){renderCombined(result,filled,errors);return;}
      result.innerHTML=(errors.length?'<p>No se pudieron consultar '+errors.length+' usuarios. Volvé a actualizar para reintentar.</p>':'')+(filled.map(g=>'<details data-group="'+esc(g.userUid)+'" style="margin:16px 0"><summary style="cursor:pointer;font-weight:700">'+esc(g.user.nombre||g.user.login||g.user.mail)+' · '+esc(g.user.login||g.user.mail||'')+' · '+Object.keys(g.lists).length+' listas</summary>'+Object.entries(g.lists).sort((a,b)=>Number(b[1].actualizadoEn)-Number(a[1].actualizadoEn)).map(([listId,list])=>{
        const s=summarize(list,products);const savings=root.SVParaguayPortal?.listSavings(list,products,Number(root.obtenerDolarReferenciaProducto?.().valor),root.costoUnitarioProveedorProducto);const savingHTML='<span class="list-summary-profit" '+(savings?.included&&savings.ars<0?'style="color:var(--red);border-color:var(--red)"':'')+'><span class="profit-label">GANANCIA COMPARATIVA</span>'+(savings?.included?'<strong>ARS $ '+money(savings.ars)+'</strong>'+(savings.usd!==null?'<span>≈ US$ '+money(savings.usd)+'</span>':'')+'<small>Frente a proveedores locales / Mercado Libre · '+savings.included+' comparados · '+savings.omitted+' omitidos</small>':'<strong style="font-size:17px;color:var(--text3)">'+(savings?.withReference?'Falta registrar la compra':'Sin referencia local')+'</strong><small>'+(savings?.withReference?'Hay referencia local / Mercado Libre. Completá el precio final y la cantidad comprada para calcular la ganancia.':'Falta un precio local comparable en los productos de esta lista.')+'</small>')+'</span>';const date=Number(list.actualizadoEn)>0?new Date(Number(list.actualizadoEn)).toLocaleString('es-AR'):'';
        return '<details data-list="'+esc(g.userUid+':'+listId)+'" style="margin:12px 0;padding:14px;border:1px solid var(--border);border-radius:12px"><summary style="cursor:pointer"><span class="list-summary-layout"><span class="list-summary-left"><strong>'+esc(list.nombre)+'</strong> · '+s.units+' unidades · US$ '+money(s.usd)+' · $ '+money(s.ars)+'<span style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:12px;font-weight:400">'+s.stores.map(store=>'<span style="padding:4px 8px;border:1px solid var(--border);border-radius:8px;color:var(--text2)">'+esc(store.name)+': <strong>'+store.products+' '+(store.products===1?'producto':'productos')+'</strong>'+(store.units!==store.products?' · '+store.units+' unidades':'')+'</span>').join('')+'</span></span>'+savingHTML+'</span></summary><button class="btn btn-sm btn-primary" style="margin-top:12px" data-edit-list="'+esc(listId)+'" data-owner="'+esc(g.userUid)+'" data-owner-name="'+esc(g.user.nombre||g.user.login||g.userUid)+'">Ver / editar lista</button><button class="btn btn-sm" style="margin:12px 0 0 8px;color:var(--red,#ef8585)" data-delete-list="'+esc(listId)+'" data-owner="'+esc(g.userUid)+'" data-name="'+esc(list.nombre)+'">Eliminar lista</button><p style="font-size:12px;color:var(--text3)">Actualizada: '+esc(date)+' · Creada: '+(Number(list.creadoEn)>0?esc(new Date(Number(list.creadoEn)).toLocaleDateString('es-AR')):'Sin fecha registrada')+'</p><p style="font-size:11px;color:var(--text3)">Comparación de precios de productos, sin gastos adicionales. Conversión al cambio de referencia actual.</p><div style="overflow:auto"><table style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>USD unitario</th><th>ARS unitario con envío</th><th>Total ARS</th></tr></thead><tbody>'+s.rows.map(r=>'<tr><td><div style="display:flex;align-items:center;gap:10px"><span style="display:block;width:48px;height:48px;flex:0 0 48px;background:white;border-radius:8px;overflow:hidden">'+(products[r.key]?root.imagenCatalogoHTML(products[r.key],'exterior-list-photo'):'')+'</span><span>'+esc(r.name)+'<br><small>'+esc(r.code)+'</small><br><small>Local: '+esc(r.store||'Por identificar')+'</small></span></div></td><td>'+r.qty+'</td><td>'+money(r.usd)+'</td><td>'+money(r.ars)+'</td><td>'+money(r.ars*r.qty)+'</td></tr>').join('')+'</tbody></table></div></details>';
      }).join('')+'</details>').join('')||'<p>Todavía no hay listas de compra guardadas.</p>');

    result.querySelectorAll('details').forEach(n=>{if(opened.has(n.dataset.list||n.dataset.group))n.open=true;});
  }
  function priceEditor(row){
    const d=drafts.get(row.editId),values=row.sources.map(s=>s.purchase),first=values[0]||{};
    const same=values.every(v=>v.precioUnitario===first.precioUnitario&&(v.moneda||'USD')===(first.moneda||'USD'));
    const value=d?d.value:(same?first.precioUnitario??'':''),currency=d?.currency||(same?first.moneda||'USD':'USD');
    return `<div class="joint-price-editor" data-price-editor><span class="joint-price-title">Precio acordado · unitario</span><input type="number" min="0" max="1000000000" step="0.01" inputmode="decimal" aria-label="Precio acordado ${esc(row.code)}" data-agreed-price="${esc(row.editId)}" value="${esc(value)}" placeholder="${same?'Sin acordar':'Precios diferentes'}" ${saving?'disabled':''}><select aria-label="Moneda acordada ${esc(row.code)}" data-agreed-currency="${esc(row.editId)}" ${saving?'disabled':''}>${['USD','ARS','PYG'].map(c=>`<option ${c===currency?'selected':''}>${c}</option>`).join('')}</select><small>${value!==''?`Total acordado: ${currency} ${money(Number(value)*row.qty)}`:'Precio unitario para las listas seleccionadas'}</small><button class="btn btn-sm btn-primary" data-save-price="${esc(row.editId)}" ${!d||saving?'disabled':''}>${saving?'Guardando…':'Guardar precio'}</button></div>`;
  }
  async function savePrice(id){
    if(!allowed()||saving)return;const d=drafts.get(id);if(!d)return;
    const price=Number(d.value);if(d.value===''||!Number.isFinite(price)||price<0||price>1e9){saveMessage='Ingresá un precio acordado válido.';render();return;}
    saving=true;saveMessage='';render();const uid=root.currentUserUid;let completed=0;
    try{
      for(const source of [...d.sources]){
        if(!allowed()||uid!==root.currentUserUid)throw new Error('La sesión cambió.');
        const actual={...source.purchase,precioUnitario:price,moneda:d.currency,cantidad:source.purchase.cantidad??0,proveedor:source.purchase.proveedor||'',estado:source.purchase.estado||'pendiente'};
        await root.SVGuardedWrites.conditionalUpdate('sv_listas_paraguay/'+source.uid+'/'+source.listId,current=>Number(current.productos?.[d.key])===source.qty&&root.SVGuardedWrites.equal(current.comprasFinales?.[d.key]||{},source.purchase),{['comprasFinales/'+d.key]:actual,actualizadoEn:root.fbServerTimestamp()});
        completed++;d.sources.shift();
      }
      drafts.delete(id);saveMessage='Precio acordado guardado en '+completed+' lista(s). El precio leído se conserva.';
    }catch(e){saveMessage=(completed?'Guardado en '+completed+' lista(s). ':'')+(e.code==='SV_CONFLICT'?'Otra persona cambió una lista. Revisá los cambios antes de reintentar.':'No se pudo completar el guardado. Revisá la conexión; el precio ingresado sigue disponible.');}
    finally{saving=false;if(uid===root.currentUserUid)render();}
  }
  function renderCombined(result,filled,errors){
    const selectionOpen=!!result.querySelector('.joint-selection[open]');
    const entries=filled.flatMap(g=>Object.entries(g.lists).map(([id,list])=>({id:g.userUid+':'+id,uid:g.userUid,listId:id,owner:g.user.nombre||g.user.login,list})));
    const selected=entries.filter(e=>!excluded.has(e.id)),combined=combine(selected,products,pendingOnly);
    visibleRows.clear();combined.forEach(g=>g.rows.forEach(r=>{r.editId=g.name+':'+r.key;visibleRows.set(r.editId,r);}));
    const plural=(n,one,many)=>n+' '+(n===1?one:many);
    result.innerHTML=`<style>
      .exterior-combined .joint-store{margin-top:16px;padding:0;overflow:hidden}
      .joint-store-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px 20px;border-bottom:1px solid var(--border)}
      .joint-store-head h3{margin:0;font-size:17px}.joint-store-head{background:var(--bg3,rgba(120,150,190,.06));border-left:3px solid var(--green,#7fda8d)}.joint-store-head h3::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green,#7fda8d);margin-right:9px}.joint-row:hover{background:rgba(130,160,200,.04)}.joint-muted{color:var(--text3);font-size:12px}
      .joint-row,.joint-columns{display:grid;grid-template-columns:minmax(220px,1fr) 65px 110px 180px 140px;align-items:center;gap:16px;padding:14px 20px}
      .joint-columns{font-size:11px;color:var(--text3);padding-top:10px;padding-bottom:10px}.joint-row{border-top:1px solid var(--border)}
      .joint-product{display:flex;align-items:center;gap:14px;min-width:0}.joint-photo{display:block;width:72px;height:72px;flex:0 0 72px;background:white;border-radius:8px;overflow:hidden}.joint-photo img{width:100%;height:100%;object-fit:contain}
      .joint-product strong{font-size:13px}.joint-source{display:inline-block;font-size:11px;color:var(--text2);margin:7px 5px 0 0;padding:4px 7px;border-radius:6px;background:rgba(130,160,200,.09)}.joint-number{text-align:right;font-size:13px}.joint-qty{text-align:center;font-size:18px;font-weight:700;color:var(--green,#7fda8d)}.joint-mobile-label{display:none}
      .joint-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:12px 0}.joint-controls label{display:flex;gap:8px;align-items:center;min-height:44px}.joint-selection{padding:10px 14px;border:1px solid var(--border);border-radius:8px}.joint-selection summary{cursor:pointer}
      .joint-price-editor input,.joint-price-editor select,.joint-price-editor button{min-height:44px!important;width:100%;box-sizing:border-box}.joint-price-editor input{font-size:16px;border-radius:8px;padding:8px}.joint-price-title{grid-column:1/-1;font-size:11px;color:var(--text3)}.joint-price-editor{display:grid;grid-template-columns:1fr 70px;gap:6px}.joint-price-editor button{grid-column:1/-1}.joint-price-editor small{grid-column:1/-1;color:var(--text3)}
      @media(max-width:850px){.joint-columns{display:none}.joint-row{grid-template-columns:65px 1fr 1fr;gap:12px}.joint-product{grid-column:1/-1}.joint-price-editor{grid-column:1/-1}.joint-row>.joint-number:last-child{grid-column:3;grid-row:2}.joint-mobile-label{display:block;font-size:11px;color:var(--text3);font-weight:400;margin-bottom:4px}.joint-qty,.joint-number{text-align:left}.joint-row{padding:14px}.joint-store-head{padding:14px}}
    </style><div class="exterior-combined">
    <details class="joint-selection" ${selectionOpen?'open':''}><summary>${selected.length} listas seleccionadas · Cambiar selección</summary><div class="joint-controls">${entries.map(e=>`<label><input type="checkbox" data-select-list="${esc(e.id)}" ${!excluded.has(e.id)?'checked':''}>${esc(e.list.nombre)} · ${esc(e.owner)}</label>`).join('')}</div></details>
    <div class="joint-controls"><strong>${combined.length} proveedores · ${plural(combined.reduce((n,g)=>n+g.units,0),'unidad','unidades')}</strong><label class="joint-muted"><input type="checkbox" data-pending-only ${pendingOnly?'checked':''}>Solo pendientes</label><span class="joint-muted">Precios de referencia · ARS incluye envío</span></div>
    <div role="status">${esc(saveMessage)}</div>
    ${errors.length?`<p role="alert">Faltan listas de ${errors.length} usuarios por sincronizar.</p>`:''}
    ${combined.map(g=>`<section class="card joint-store" data-store="${esc(g.name)}"><div class="joint-store-head"><div><h3>${esc(g.name)}</h3><span class="joint-muted">${plural(g.rows.length,'producto','productos')} · ${plural(g.units,'unidad','unidades')}</span></div><div class="joint-number"><strong>US$ ${money(g.usd)}</strong><div class="joint-muted">ARS ${money(g.ars)} con envío</div></div></div>
    <div class="joint-columns"><span>Producto / lista de origen</span><span style="text-align:center">Cantidad</span><span style="text-align:right">Precio leído · USD</span><span>Precio acordado</span><span style="text-align:right">Total leído</span></div>
    ${g.rows.map(r=>`<div class="joint-row"><div class="joint-product"><span class="joint-photo">${products[r.key]?root.imagenCatalogoHTML(products[r.key],'exterior-list-photo'):''}</span><div><strong>${esc(r.name)}</strong><div class="joint-muted">${esc(r.code)}</div>${r.sources.map(source=>`<div class="joint-source">${source.qty} × ${esc(source.list)} · ${esc(source.owner)}${pendingOnly?'':' · '+esc(source.state)}</div>`).join('')}</div></div><div class="joint-qty"><span class="joint-mobile-label">Cantidad</span>${r.qty}</div><div class="joint-number"><span class="joint-mobile-label">Precio leído · USD</span>US$ ${money(r.usd)}</div>${priceEditor(r)}<div class="joint-number"><span class="joint-mobile-label">Total leído</span><strong>US$ ${money(r.usdTotal)}</strong><div class="joint-muted">ARS ${money(r.arsTotal)}</div></div></div>`).join('')}</section>`).join('')}
    ${!combined.length?'<p>No hay productos para esta selección.</p>':''}</div>`;

  }
  function load(){
    if(!allowed()||!host)return;
    stop();readyProducts=false;readyUsers=false;syncError=false;const generation=request,uid=root.currentUserUid;
    const valid=()=>generation===request&&host&&allowed()&&uid===root.currentUserUid;
    const schedule=()=>{if(!valid())return;clearTimeout(timer);timer=setTimeout(()=>{if(valid())render();},40);};
    const fail=()=>{if(valid()){syncError=true;targetError('No se pudieron sincronizar las listas. Volvé a actualizar para reintentar.');}};
    if(typeof root.fbOnValue!=='function'){fail();return;}
    host.querySelector('[data-results]').textContent='Cargando listas…';
    stops.push(root.fbOnValue(root.fbRef(root.fbDB,'sisventas/productos'),snap=>{if(!valid())return;products=snap.val()||{};readyProducts=true;schedule();},fail));
    stops.push(root.fbOnValue(root.fbRef(root.fbDB,'sv_usuarios'),snap=>{
      if(!valid())return;
      readyUsers=true;const users=new Map();Object.values(snap.val()||{}).forEach(user=>{if(user?.uid)users.set(user.uid,user);});
      groups.forEach((group,key)=>{if(!users.has(key)){group.off?.();groups.delete(key);}});
      users.forEach((user,userUid)=>{
        if(groups.has(userUid)){groups.get(userUid).user=user;return;}
        const group={user,userUid,lists:{}};groups.set(userUid,group);
        group.off=root.fbOnValue(root.fbRef(root.fbDB,'sv_listas_paraguay/'+userUid),data=>{
          if(!valid()||groups.get(userUid)!==group)return;group.lists=data.val()||{};group.ready=true;group.error=false;schedule();
        },()=>{if(!valid()||groups.get(userUid)!==group)return;group.ready=true;group.error=true;schedule();});
      });schedule();
    },fail));
  }
  document.addEventListener('sisventas:session-ended',reset);
  root.SVExteriorLists={mount,reset};
})(typeof window==='undefined'?{}:window);
