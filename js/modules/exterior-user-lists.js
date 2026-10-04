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
      item.sources.push({owner:entry.owner,list:entry.list.nombre,qty:row.qty,state});
      store.units+=row.qty;store.usd+=row.qty*row.usd;store.ars+=row.qty*row.ars;
    }));
    return Array.from(stores.values()).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  }
  if(typeof module!=='undefined')module.exports={summarize,combine};
  if(!root.document)return;
  let host,owner='',request=0,stops=[],timer=null,products={},groups=new Map(),readyProducts=false,readyUsers=false,syncError=false;
  let view='users',excluded=new Set(),pendingOnly=true;
  const allowed=()=>root.currentRole==='admin'&&root.permisoModulo&&root.permisoModulo('balancecompra');
  function stop(){request++;stops.splice(0).forEach(off=>off());groups.forEach(g=>g.off?.());groups.clear();clearTimeout(timer);timer=null;}
  function reset(){stop();host?.remove();host=null;owner='';products={};view='users';excluded.clear();pendingOnly=true;}
  function mount(){
    if(!allowed()){reset();return;}
    if(host?.isConnected&&owner===root.currentUserUid)return;
    reset();owner=root.currentUserUid;
    const page=document.getElementById('page-balancecompra');if(!page)return;
    host=document.createElement('section');host.className='card';host.id='exterior-user-lists';
    host.innerHTML='<style>#page-balancecompra #exterior-user-lists{background:transparent;border:0;border-bottom:1px solid var(--border);border-radius:0;box-shadow:none;padding:16px 0 28px;margin-bottom:24px}.exterior-list-photo{width:100%;height:100%;object-fit:contain}</style><h3 style="font-size:15px;font-weight:700;margin:0">Listas de usuarios</h3><div class="card-head" style="margin-top:14px"><button class="btn btn-sm btn-primary" data-catalog>Ofertas · Mis listas</button><button class="btn btn-sm" data-refresh>Actualizar listas</button></div><p style="font-size:12px;color:var(--text3)">Agrupadas por usuario. Los totales se calculan con los precios actuales del catálogo; estas listas todavía no son órdenes de compra.</p><div style="display:flex;gap:8px;margin:14px 0"><button class="btn btn-sm" data-view="users" aria-pressed="true">Por usuario</button><button class="btn btn-sm" data-view="stores" aria-pressed="false">Ver por proveedor</button></div><div data-results role="status">Cargando listas…</div>';
    page.prepend(host);host.querySelector('[data-refresh]').onclick=load;
    host.onclick=async e=>{
      const mode=e.target.closest('[data-view]');if(mode&&allowed()){view=mode.dataset.view;render();return;}
      const button=e.target.closest('[data-catalog],[data-edit-list],[data-delete-list]');if(!button||!allowed())return;
      button.disabled=true;
      try{if(button.hasAttribute('data-delete-list')){if(await root.SVParaguayPortal.removeList(button.dataset.owner,button.dataset.deleteList,button.dataset.name))await load();return;}await root.SVParaguayPortal.open('Administrador',{ownerUid:button.dataset.owner,ownerName:button.dataset.ownerName,listKey:button.dataset.editList,onClose:load});}
      catch(_){targetError(button.hasAttribute('data-delete-list')?'No se pudo eliminar la lista. Revisá la conexión y el acceso.':'No se pudo abrir el catálogo. Revisá la conexión y volvé a intentar.');}
      finally{button.disabled=false;}
    };
    host.onchange=e=>{if(!allowed())return;if(e.target.matches('[data-select-list]')){const id=e.target.dataset.selectList;e.target.checked?excluded.delete(id):excluded.add(id);render();}if(e.target.matches('[data-pending-only]')){pendingOnly=e.target.checked;render();}};
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
      if(view==='stores'){renderCombined(result,filled,errors);return;}
      result.innerHTML=(errors.length?'<p>No se pudieron consultar '+errors.length+' usuarios. Volvé a actualizar para reintentar.</p>':'')+(filled.map(g=>'<details data-group="'+esc(g.userUid)+'" style="margin:16px 0"><summary style="cursor:pointer;font-weight:700">'+esc(g.user.nombre||g.user.login||g.user.mail)+' · '+esc(g.user.login||g.user.mail||'')+' · '+Object.keys(g.lists).length+' listas</summary>'+Object.entries(g.lists).sort((a,b)=>Number(b[1].actualizadoEn)-Number(a[1].actualizadoEn)).map(([listId,list])=>{
        const s=summarize(list,products);const date=Number(list.actualizadoEn)>0?new Date(Number(list.actualizadoEn)).toLocaleString('es-AR'):'';
        return '<details data-list="'+esc(g.userUid+':'+listId)+'" style="margin:12px 0;padding:14px;border:1px solid var(--border);border-radius:12px"><summary style="cursor:pointer"><strong>'+esc(list.nombre)+'</strong> · '+s.units+' unidades · US$ '+money(s.usd)+' · $ '+money(s.ars)+'<span style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:12px;font-weight:400">'+s.stores.map(store=>'<span style="padding:4px 8px;border:1px solid var(--border);border-radius:8px;color:var(--text2)">'+esc(store.name)+': <strong>'+store.products+' '+(store.products===1?'producto':'productos')+'</strong>'+(store.units!==store.products?' · '+store.units+' unidades':'')+'</span>').join('')+'</span></summary><button class="btn btn-sm btn-primary" style="margin-top:12px" data-edit-list="'+esc(listId)+'" data-owner="'+esc(g.userUid)+'" data-owner-name="'+esc(g.user.nombre||g.user.login||g.userUid)+'">Ver / editar lista</button><button class="btn btn-sm" style="margin:12px 0 0 8px;color:var(--red,#ef8585)" data-delete-list="'+esc(listId)+'" data-owner="'+esc(g.userUid)+'" data-name="'+esc(list.nombre)+'">Eliminar lista</button><p style="font-size:12px;color:var(--text3)">Actualizada: '+esc(date)+'</p><div style="overflow:auto"><table style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>USD unitario</th><th>ARS unitario con envío</th><th>Total ARS</th></tr></thead><tbody>'+s.rows.map(r=>'<tr><td><div style="display:flex;align-items:center;gap:10px"><span style="display:block;width:48px;height:48px;flex:0 0 48px;background:white;border-radius:8px;overflow:hidden">'+(products[r.key]?root.imagenCatalogoHTML(products[r.key],'exterior-list-photo'):'')+'</span><span>'+esc(r.name)+'<br><small>'+esc(r.code)+'</small><br><small>Local: '+esc(r.store||'Por identificar')+'</small></span></div></td><td>'+r.qty+'</td><td>'+money(r.usd)+'</td><td>'+money(r.ars)+'</td><td>'+money(r.ars*r.qty)+'</td></tr>').join('')+'</tbody></table></div></details>';
      }).join('')+'</details>').join('')||'<p>Todavía no hay listas de compra guardadas.</p>');

    result.querySelectorAll('details').forEach(n=>{if(opened.has(n.dataset.list||n.dataset.group))n.open=true;});
  }
  function renderCombined(result,filled,errors){
    const entries=filled.flatMap(g=>Object.entries(g.lists).map(([id,list])=>({id:g.userUid+':'+id,owner:g.user.nombre||g.user.login,list})));
    const selected=entries.filter(e=>!excluded.has(e.id)),combined=combine(selected,products,pendingOnly);
    result.innerHTML='<div class="exterior-combined"><p>Seleccioná las listas para reunir sus productos por local. Cada producto conserva el detalle de quién lo pidió.</p><div style="display:flex;flex-wrap:wrap;gap:12px">'+entries.map(e=>'<label style="display:flex;align-items:center;gap:8px;min-height:44px;padding:8px;border:1px solid var(--border);border-radius:8px"><input type="checkbox" data-select-list="'+esc(e.id)+'" '+(!excluded.has(e.id)?'checked':'')+'> '+esc(e.list.nombre)+' · '+esc(e.owner)+'</label>').join('')+'</div><label style="display:flex;align-items:center;gap:8px;min-height:44px;margin:12px 0"><input type="checkbox" data-pending-only '+(pendingOnly?'checked':'')+'> Solo pendientes (excluye pedidos y comprados)</label>'+(errors.length?'<p role="alert">Faltan listas de '+errors.length+' usuarios por sincronizar. Esta compra conjunta está incompleta.</p>':'')+'<p><strong>'+selected.length+' listas · '+combined.length+' locales · '+combined.reduce((n,g)=>n+g.units,0)+' unidades</strong></p><p style="font-size:12px;color:var(--text3)">Importes de referencia del catálogo. Esta vista no modifica las listas ni registra compras.</p>'+combined.map(g=>'<section data-store="'+esc(g.name)+'" style="border:1px solid var(--border);border-radius:12px;padding:16px;margin-top:14px"><h3 style="margin:0 0 8px">'+esc(g.name)+'</h3><p>'+g.rows.length+' productos · '+g.units+' unidades · US$ '+money(g.usd)+' · ARS '+money(g.ars)+' con envío</p>'+g.rows.map(r=>'<div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;border-top:1px solid var(--border);padding:14px 0"><div style="flex:1 1 280px;min-width:0"><strong>'+esc(r.name)+'</strong><div style="font-size:12px;color:var(--text3)">'+esc(r.code)+'</div>'+r.sources.map(source=>'<div style="font-size:12px;margin-top:6px">'+source.qty+' × '+esc(source.list)+' · '+esc(source.owner)+(pendingOnly?'':' · '+esc(source.state))+'</div>').join('')+'</div><div style="text-align:right"><strong style="font-size:18px">'+r.qty+' unidades</strong><div>US$ '+money(r.usdTotal)+'</div><small>ARS '+money(r.arsTotal)+' con envío</small></div></div>').join('')+'</section>').join('')+(!combined.length?'<p>No hay productos para esta selección.</p>':'')+'</div>';
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
