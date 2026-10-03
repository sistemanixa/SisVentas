(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
  function summarize(list,products){
    const rows=Object.entries(list.productos||{}).map(([key,qty])=>{
      const p=products[key];const r=p&&(p.proveedores||[]).find(r=>{try{return /^(?:www\.|mobile\.)?(?:comprasparaguai\.com\.br|comprasparaguay\.com\.ar)$/.test(new URL(r.url).hostname);}catch(_){return false;}});
      return {key,qty:Number(qty)||0,name:p&&(p.nombre||p.descripcion)||'Producto no disponible',code:p&&p.codigo||key,usd:r&&r.monedaOriginal==='USD'?Number(r.precioOriginal)||0:0,ars:Number(r&&(r.costoRealArs||r.precio)||p&&(p.compraARS||p.compra))||0};
    });
    return {rows,units:rows.reduce((s,r)=>s+r.qty,0),usd:rows.reduce((s,r)=>s+r.qty*r.usd,0),ars:rows.reduce((s,r)=>s+r.qty*r.ars,0)};
  }
  if(typeof module!=='undefined')module.exports={summarize};
  if(!root.document)return;
  let host,owner='',request=0,stops=[],timer=null,products={},groups=new Map(),readyProducts=false,readyUsers=false,syncError=false;
  const allowed=()=>root.currentRole==='admin'&&root.permisoModulo&&root.permisoModulo('balancecompra');
  function stop(){request++;stops.splice(0).forEach(off=>off());groups.forEach(g=>g.off?.());groups.clear();clearTimeout(timer);timer=null;}
  function reset(){stop();host?.remove();host=null;owner='';products={};}
  function mount(){
    if(!allowed()){reset();return;}
    if(host?.isConnected&&owner===root.currentUserUid)return;
    reset();owner=root.currentUserUid;
    const page=document.getElementById('page-balancecompra');if(!page)return;
    host=document.createElement('section');host.className='card';host.id='exterior-user-lists';
    host.innerHTML='<style>#page-balancecompra #exterior-user-lists{background:transparent;border:0;border-bottom:1px solid var(--border);border-radius:0;box-shadow:none;padding:16px 0 28px;margin-bottom:24px}.exterior-list-photo{width:100%;height:100%;object-fit:contain}</style><h3 style="font-size:15px;font-weight:700;margin:0">Listas de usuarios</h3><div class="card-head" style="margin-top:14px"><button class="btn btn-sm btn-primary" data-catalog>Ofertas · Mis listas</button><button class="btn btn-sm" data-refresh>Actualizar listas</button></div><p style="font-size:12px;color:var(--text3)">Agrupadas por usuario. Los totales se calculan con los precios actuales del catálogo; estas listas todavía no son órdenes de compra.</p><div data-results role="status">Cargando listas…</div>';
    page.prepend(host);host.querySelector('[data-refresh]').onclick=load;
    host.onclick=async e=>{
      const button=e.target.closest('[data-catalog],[data-edit-list],[data-delete-list]');if(!button||!allowed())return;
      button.disabled=true;
      try{if(button.hasAttribute('data-delete-list')){if(await root.SVParaguayPortal.removeList(button.dataset.owner,button.dataset.deleteList,button.dataset.name))await load();return;}await root.SVParaguayPortal.open('Administrador',{ownerUid:button.dataset.owner,ownerName:button.dataset.ownerName,listKey:button.dataset.editList,onClose:load});}
      catch(_){targetError(button.hasAttribute('data-delete-list')?'No se pudo eliminar la lista. Revisá la conexión y el acceso.':'No se pudo abrir el catálogo. Revisá la conexión y volvé a intentar.');}
      finally{button.disabled=false;}
    };
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
      result.innerHTML=(errors.length?'<p>No se pudieron consultar '+errors.length+' usuarios. Volvé a actualizar para reintentar.</p>':'')+(filled.map(g=>'<details data-group="'+esc(g.userUid)+'" style="margin:16px 0"><summary style="cursor:pointer;font-weight:700">'+esc(g.user.nombre||g.user.login||g.user.mail)+' · '+esc(g.user.login||g.user.mail||'')+' · '+Object.keys(g.lists).length+' listas</summary>'+Object.entries(g.lists).sort((a,b)=>Number(b[1].actualizadoEn)-Number(a[1].actualizadoEn)).map(([listId,list])=>{
        const s=summarize(list,products);const date=Number(list.actualizadoEn)>0?new Date(Number(list.actualizadoEn)).toLocaleString('es-AR'):'';
        return '<details data-list="'+esc(g.userUid+':'+listId)+'" style="margin:12px 0;padding:14px;border:1px solid var(--border);border-radius:12px"><summary style="cursor:pointer"><strong>'+esc(list.nombre)+'</strong> · '+s.units+' unidades · US$ '+money(s.usd)+' · $ '+money(s.ars)+'</summary><button class="btn btn-sm btn-primary" style="margin-top:12px" data-edit-list="'+esc(listId)+'" data-owner="'+esc(g.userUid)+'" data-owner-name="'+esc(g.user.nombre||g.user.login||g.userUid)+'">Ver / editar lista</button><button class="btn btn-sm" style="margin:12px 0 0 8px;color:var(--red,#ef8585)" data-delete-list="'+esc(listId)+'" data-owner="'+esc(g.userUid)+'" data-name="'+esc(list.nombre)+'">Eliminar lista</button><p style="font-size:12px;color:var(--text3)">Actualizada: '+esc(date)+'</p><div style="overflow:auto"><table style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>USD unitario</th><th>ARS unitario con envío</th><th>Total ARS</th></tr></thead><tbody>'+s.rows.map(r=>'<tr><td><div style="display:flex;align-items:center;gap:10px"><span style="display:block;width:48px;height:48px;flex:0 0 48px;background:white;border-radius:8px;overflow:hidden">'+(products[r.key]?root.imagenCatalogoHTML(products[r.key],'exterior-list-photo'):'')+'</span><span>'+esc(r.name)+'<br><small>'+esc(r.code)+'</small></span></div></td><td>'+r.qty+'</td><td>'+money(r.usd)+'</td><td>'+money(r.ars)+'</td><td>'+money(r.ars*r.qty)+'</td></tr>').join('')+'</tbody></table></div></details>';
      }).join('')+'</details>').join('')||'<p>Todavía no hay listas de compra guardadas.</p>');

    result.querySelectorAll('details').forEach(n=>{if(opened.has(n.dataset.list||n.dataset.group))n.open=true;});
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
