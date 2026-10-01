(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
  function summarize(list,products){
    const rows=Object.entries(list.productos||{}).map(([key,qty])=>{
      const p=products[key];const r=p&&(p.proveedores||[]).find(r=>{try{return /^(?:www\.|mobile\.)?comprasparaguai\.com\.br$/.test(new URL(r.url).hostname);}catch(_){return false;}});
      return {key,qty:Number(qty)||0,name:p&&(p.nombre||p.descripcion)||'Producto no disponible',code:p&&p.codigo||key,usd:r&&r.monedaOriginal==='USD'?Number(r.precioOriginal)||0:0,ars:Number(r&&(r.costoRealArs||r.precio)||p&&(p.compraARS||p.compra))||0};
    });
    return {rows,units:rows.reduce((s,r)=>s+r.qty,0),usd:rows.reduce((s,r)=>s+r.qty*r.usd,0),ars:rows.reduce((s,r)=>s+r.qty*r.ars,0)};
  }
  if(typeof module!=='undefined')module.exports={summarize};
  if(!root.document)return;
  let host,owner='',request=0;
  const allowed=()=>root.currentRole==='admin'&&root.permisoModulo&&root.permisoModulo('balancecompra');
  function reset(){request++;host?.remove();host=null;owner='';}
  function mount(){
    if(!allowed()){reset();return;}
    if(host?.isConnected&&owner===root.currentUserUid)return;
    reset();owner=root.currentUserUid;
    const page=document.getElementById('page-balancecompra');if(!page)return;
    host=document.createElement('section');host.className='card';host.id='exterior-user-lists';
    host.innerHTML='<div class="card-head"><span class="card-title">Listas de compra de usuarios</span><button class="btn btn-sm btn-primary" data-catalog>Ofertas · Mis listas</button><button class="btn btn-sm" data-refresh>Actualizar listas</button></div><p style="font-size:12px;color:var(--text3)">Agrupadas por usuario. Los totales se calculan con los precios actuales del catálogo; estas listas todavía no son órdenes de compra.</p><div data-results role="status">Cargando listas…</div>';
    page.prepend(host);host.querySelector('[data-refresh]').onclick=load;
    host.onclick=async e=>{
      const button=e.target.closest('[data-catalog],[data-edit-list]');if(!button||!allowed())return;
      button.disabled=true;
      try{await root.SVParaguayPortal.open('Administrador',{ownerUid:button.dataset.owner,ownerName:button.dataset.ownerName,listKey:button.dataset.editList,onClose:load});}
      catch(_){targetError('No se pudo abrir el catálogo. Revisá la conexión y volvé a intentar.');}
      finally{button.disabled=false;}
    };
    load();
  }
  function targetError(message){if(host)host.querySelector('[data-results]').textContent=message;}
  async function load(){
    if(!allowed()||!host)return;const current=++request,uid=root.currentUserUid,target=host;
    const valid=()=>request===current&&host===target&&allowed()&&root.currentUserUid===uid;
    const button=target.querySelector('[data-refresh]'),result=target.querySelector('[data-results]');button.disabled=true;result.textContent='Cargando listas…';
    try{
      const users=(await root.fbGet(root.fbRef(root.fbDB,'sv_usuarios'))).val()||{};
      if(!valid())return;
      const unique=new Map();Object.values(users).forEach(u=>{if(u&&u.uid)unique.set(u.uid,u);});
      const products=(await root.fbGet(root.fbRef(root.fbDB,'sisventas/productos'))).val()||{};
      if(!valid())return;
      const groups=await Promise.all(Array.from(unique,async([userUid,user])=>{try{return {userUid,user,lists:(await root.fbGet(root.fbRef(root.fbDB,'sv_listas_paraguay/'+userUid))).val()||{}};}catch(_){return {user,error:true};}}));
      if(!valid())return;
      const errors=groups.filter(g=>g.error),filled=groups.filter(g=>!g.error&&Object.keys(g.lists).length).sort((a,b)=>String(a.user.nombre||a.user.login).localeCompare(String(b.user.nombre||b.user.login),'es'));
      result.innerHTML=(errors.length?'<p>No se pudieron consultar '+errors.length+' usuarios. Volvé a actualizar para reintentar.</p>':'')+(filled.map(g=>'<details open style="margin:16px 0"><summary style="cursor:pointer;font-weight:700">'+esc(g.user.nombre||g.user.login||g.user.mail)+' · '+esc(g.user.login||g.user.mail||'')+' · '+Object.keys(g.lists).length+' listas</summary>'+Object.entries(g.lists).sort((a,b)=>Number(b[1].actualizadoEn)-Number(a[1].actualizadoEn)).map(([listId,list])=>{
        const s=summarize(list,products);const date=Number(list.actualizadoEn)>0?new Date(Number(list.actualizadoEn)).toLocaleString('es-AR'):'';
        return '<details style="margin:12px 0;padding:14px;border:1px solid var(--border);border-radius:12px"><summary style="cursor:pointer"><strong>'+esc(list.nombre)+'</strong> · '+s.units+' unidades · US$ '+money(s.usd)+' · $ '+money(s.ars)+'</summary><button class="btn btn-sm btn-primary" style="margin-top:12px" data-edit-list="'+esc(listId)+'" data-owner="'+esc(g.userUid)+'" data-owner-name="'+esc(g.user.nombre||g.user.login||g.userUid)+'">Editar lista en catálogo</button><p style="font-size:12px;color:var(--text3)">Actualizada: '+esc(date)+'</p><div style="overflow:auto"><table style="width:100%"><thead><tr><th>Producto</th><th>Cantidad</th><th>USD unitario</th><th>ARS unitario con envío</th><th>Total ARS</th></tr></thead><tbody>'+s.rows.map(r=>'<tr><td>'+esc(r.name)+'<br><small>'+esc(r.code)+'</small></td><td>'+r.qty+'</td><td>'+money(r.usd)+'</td><td>'+money(r.ars)+'</td><td>'+money(r.ars*r.qty)+'</td></tr>').join('')+'</tbody></table></div></details>';
      }).join('')+'</details>').join('')||'<p>Todavía no hay listas de compra guardadas.</p>');
    }catch(_){if(valid())result.textContent='No se pudieron cargar las listas. Revisá la conexión y volvé a actualizar.';}
    finally{if(valid())button.disabled=false;}
  }
  document.addEventListener('sisventas:session-ended',reset);
  root.SVExteriorLists={mount,reset};
})(typeof window==='undefined'?{}:window);
