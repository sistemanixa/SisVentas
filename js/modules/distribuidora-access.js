(function(root){
 'use strict';
 const CATEGORY='COMPRAS PARAGUAY';
 const defaults={chat:true,detalle:true,editar:false,crear:false,solicitudes:false};
 const labels={chat:'Chat general y mensajes directos',detalle:'Abrir ficha interna del producto',editar:'Editar datos del producto',crear:'Crear productos en su catálogo',solicitudes:'Ver solicitudes del catálogo y marcar su atención'};
 let permissions=null,stop=null,editor=null,detailBox=null,providersStop=null;
 const eligible=p=>!!p&&p.categoria===CATEGORY&&p.activo!==false&&p.estado!=='Inactivo'&&!p.esManoDeObra;
 const clean=value=>Object.fromEntries(Object.keys(defaults).map(k=>[k,typeof value?.[k]==='boolean'?value[k]:defaults[k]]));
 function allowed(key){return root.currentRole==='admin'||(root.currentRole==='distribuidora'&&!!permissions?.[key]);}
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function publicProviders(list){
  const out={};for(const p of list||[]){const id=p.fbKey||p.key||p.id;if(!id)continue;out[id]={};for(const k of ['nombre','web','pais','monedaPrecios','activo','base','favorito','preciosSinIva','descuentoPorcentaje'])if(p[k]!==undefined)out[id][k]=p[k];}return out;
 }
 if(typeof module!=='undefined')module.exports={clean,eligible,publicProviders};
 if(!root.document)return;
 async function start(){
  stop?.();permissions=null;
  const role=root.currentRole,uid=root.currentUserUid;
  return new Promise((resolve,reject)=>{let first=true;stop=root.fbOnValue(root.fbRef(root.fbDB,'sv_distribuidora_permisos'),snap=>{
   if(root.currentRole!==role||root.currentUserUid!==uid)return;
   permissions=clean(snap.val());
   if(role==='distribuidora'&&(permissions.editar||permissions.crear))startProviders();
   if(detailBox&&!allowed('detalle'))closeDetail();
   if(editor&&!allowed(editor.dataset.new==='1'?'crear':'editar')){closeEditor();}
   document.dispatchEvent(new CustomEvent('sisventas:distribuidora-permissions'));
   if(typeof root.aplicarVisibilidadBotonesFlotantes==='function')root.aplicarVisibilidadBotonesFlotantes();
   if(!permissions.chat&&root.currentRole==='distribuidora'){root.chatCerrar?.();document.dispatchEvent(new CustomEvent('sisventas:chat-disabled'));}
   else if(!first&&root.currentRole==='distribuidora'){document.dispatchEvent(new CustomEvent('sisventas:chat-ready',{detail:{uid}}));root.chatInicializar?.();}
   if(first){first=false;resolve();}
  },err=>{permissions=null;reject(err);});});
 }
 function syncProviders(list){
  if(root.currentRole!=='admin'||!root.fbDB)return Promise.resolve();
  return root.fbSet(root.fbRef(root.fbDB,'sv_catalogo_proveedores'),publicProviders(list));
 }
 function startProviders(){
  if(providersStop)return;
  providersStop=root.fbOnValue(root.fbRef(root.fbDB,'sv_catalogo_proveedores'),snap=>{
   if(root.currentRole!=='distribuidora')return;
   root.proveedoresData=Object.entries(snap.val()||{}).map(([fbKey,p])=>({...p,fbKey}));
   if(root.proveedoresConReferenciaDeValor)root.proveedoresData=root.proveedoresConReferenciaDeValor(root.proveedoresData);
   if(editor&&!root.productoFichaConsultando?.())root.inicializarFichaProducto?.();
  },()=>root.notify?.('No se pudo cargar el listado de proveedores.'));
 }
 async function saveProduct(product){
  if(!editor)throw Error('Abrí el producto desde tu catálogo.');
  const isNew=editor.dataset.new==='1',id=editor.dataset.productId;
  if(!allowed(isNew?'crear':'editar')||product.categoria!==CATEGORY||product.esManoDeObra||(!isNew&&product.fbKey!==id))throw Error('El producto no pertenece al catálogo autorizado.');
  const data={...product};delete data.fbKey;
  const key=isNew?root.fbPush(root.fbRef(root.fbDB,'sisventas/productos')).key:id;
  const changes={};if(isNew)changes['sisventas/productos/'+key]=data;else for(const [k,v] of Object.entries(data))changes['sisventas/productos/'+key+'/'+k]=v;
  const audit=root.fbPush(root.fbRef(root.fbDB,'sv_distribuidora_auditoria')).key;
  changes['sv_distribuidora_auditoria/'+audit]={uid:root.currentUserUid,producto:key,accion:isNew?'crear':'editar',fecha:root.fbServerTimestamp(),campos:Object.keys(data).join(',')};
  await root.fbUpdate(root.fbRef(root.fbDB),changes);return {...data,fbKey:key};
 }
 function closeEditor(){if(editor){const current=editor;root.cancelarFichaProducto?.();root.cancelarCotizacionProductoEditor?.();editor=null;current._restore?.();current.remove();}}
 function edit(key,product,onSaved){
  const isNew=!key;if(!allowed(isNew?'crear':'editar')||(!isNew&&!eligible(product)))return;
  closeEditor();
  const native=document.getElementById('prod-form-view');
  if(!native||typeof root.abrirFormProducto!=='function'){root.notify?.('No se pudo abrir el formulario del producto');return;}
  const marker=document.createComment('distribuidora-product-editor');native.before(marker);
  const previousHTML=native.innerHTML,previousStyle=native.getAttribute('style');
  const related=['prod-list-view','prod-detail-view'].map(id=>document.getElementById(id)).filter(Boolean).map(node=>[node,node.getAttribute('style')]);
  const form=document.createElement('section');editor=form;form.dataset.svModalBehavior='compact';form.dataset.new=isNew?'1':'0';form.dataset.productId=key||'';form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');form.setAttribute('aria-label',isNew?'Nuevo producto de Distribuidora':'Editar producto de Distribuidora');
  form.style.cssText='position:fixed;inset:0;z-index:100200;background:var(--bg);color:var(--text);overflow:auto;padding:20px;box-sizing:border-box';
  form.appendChild(native);document.body.appendChild(form);
  form._restore=()=>{native.innerHTML=previousHTML;if(previousStyle===null)native.removeAttribute('style');else native.setAttribute('style',previousStyle);marker.replaceWith(native);related.forEach(([node,style])=>{if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);});};
  const oldProducts=root.prodData;const restoreForm=form._restore;form._restore=()=>{restoreForm();root.prodData=oldProducts;};
  try{root.prodData=isNew?[]:[{...product,fbKey:key}];root.abrirFormProducto(key||null);}catch(error){closeEditor();root.notify?.('No se pudo mostrar el formulario');return;}
  native.querySelector('#pf-categoria').innerHTML='<option>COMPRAS PARAGUAY</option>';
  native.querySelector('#pf-categoria').disabled=true;
  native.querySelector('#pf-es-mano-obra').disabled=true;
  native.querySelectorAll('#pf-anterior,#pf-siguiente').forEach(node=>node.style.setProperty('display','none','important'));
  const notice=document.createElement('p');notice.setAttribute('role','status');notice.style.cssText='margin:12px 0;color:var(--text);white-space:pre-wrap';
  const saveButton=native.querySelector('#btn-guardar-producto');saveButton?.parentElement.appendChild(notice);
  const toast=document.getElementById('notif');const observer=toast?new MutationObserver(()=>{if(editor===form&&toast.classList.contains('show'))notice.textContent=toast.textContent;}):null;
  observer?.observe(toast,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  const restoreNotice=form._restore;form._restore=()=>{observer?.disconnect();restoreNotice();};
  if(saveButton){saveButton.removeAttribute('onclick');saveButton.onclick=async()=>{notice.textContent='';try{await root.guardarProducto();}catch(error){notice.textContent='No se pudo guardar: '+(error.message||'Revisá los datos e intentá nuevamente.');root.restaurarBotonGuardarProducto?.();}};}
  const dismiss=()=>root.cerrarFormProducto();
  native.querySelectorAll('[onclick="cerrarFormProducto()"]').forEach(node=>{node.removeAttribute('onclick');node.onclick=dismiss;if(node.textContent.includes('Volver'))node.innerHTML='<i class="ti ti-arrow-left" aria-hidden="true"></i> Volver al catálogo';});
  form.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dismiss();}};
  native.querySelector('#pf-nombre').focus();
 }
 function returnFromProduct(){if(!editor)return false;closeEditor();closeDetail();return true;}

 function closeDetail(){if(detailBox){detailBox._restore?.();detailBox.remove();detailBox=null;}}
 function detail(key,p){
  if(!allowed('detalle')||!eligible(p))return;
  closeDetail();
  const native=document.getElementById('prod-detail-view');
  if(!native||typeof root.verProducto!=='function'){root.notify?.('No se pudo abrir la ficha del producto');return;}
  const marker=document.createComment('distribuidora-product-detail');native.before(marker);
  const previousHTML=native.innerHTML,previousStyle=native.getAttribute('style');
  const box=document.createElement('section');detailBox=box;box.dataset.svModalBehavior='compact';box.className='sv-distribuidora-detail';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Ficha interna del producto');
  box.style.cssText='position:fixed;inset:0;z-index:100180;overflow:auto;background:var(--bg);color:var(--text);padding:20px;box-sizing:border-box';
  box.appendChild(native);document.body.appendChild(box);
  box._restore=()=>{native.innerHTML=previousHTML;if(previousStyle===null)native.removeAttribute('style');else native.setAttribute('style',previousStyle);marker.replaceWith(native);};
  const oldProducts=root.prodData;
  try{root.prodData=[{...p,fbKey:key}];root.verProducto(key,'ofertas');}catch(error){closeDetail();root.notify?.('No se pudo mostrar la ficha');return;}finally{root.prodData=oldProducts;}
  const back=native.querySelector('button[onclick="cerrarDetalleProducto()"]');back.removeAttribute('onclick');back.innerHTML='<i class="ti ti-arrow-left" aria-hidden="true"></i> Volver al catálogo';back.onclick=closeDetail;
  const hero=native.querySelector('.product-hero');hero.removeAttribute('onclick');hero.style.cursor='default';hero.removeAttribute('title');
  native.querySelectorAll('.product-hero-delete,.product-active-toggle,[data-permiso="productos.agregarProveedor"],#btn-pd-actualizar-proveedores').forEach(n=>n.remove());
  const editButton=native.querySelector('.product-hero-edit');editButton.removeAttribute('onclick');editButton.hidden=!allowed('editar');editButton.onclick=()=>edit(key,p,closeDetail);
  const description=document.createElement('section');description.className='card';description.innerHTML='<div class="card-head"><span class="card-title">Descripción del producto</span></div><p style="white-space:pre-wrap;line-height:1.6;margin:0">'+esc(p.descripcion||'Sin descripción')+'</p>';native.appendChild(description);
  box.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeDetail();}};back.focus();
 }
 function renderSettings(container){
  if(root.currentRole!=='admin')return;
  const card=document.createElement('section');card.className='card';card.setAttribute('aria-label','Permisos de Distribuidora');
  card.innerHTML='<h3>Distribuidora</h3><p>Catálogo COMPRAS PARAGUAY y listas propias. Los permisos siguientes se aplican solo a ese catálogo; no habilitan ventas ni administración.</p><div data-options>Cargando permisos…</div><p data-status role="status"></p><button class="btn btn-primary" data-save disabled>Guardar permisos de Distribuidora</button>';
  container.prepend(card);let baseline;
  root.fbGet(root.fbRef(root.fbDB,'sv_distribuidora_permisos')).then(s=>{baseline=clean(s.val());card.querySelector('[data-options]').innerHTML=Object.entries(labels).map(([k,label])=>'<label style="display:block;margin:14px 0"><input type="checkbox" data-permission="'+k+'" '+(baseline[k]?'checked':'')+'> '+label+'</label>').join('');card.querySelector('[data-save]').disabled=false;}).catch(()=>card.querySelector('[data-status]').textContent='No se pudieron cargar los permisos.');
  card.querySelector('[data-save]').onclick=async()=>{const b=card.querySelector('[data-save]');b.disabled=true;try{const next=Object.fromEntries(Array.from(card.querySelectorAll('[data-permission]')).map(n=>[n.dataset.permission,n.checked]));await root.fbSet(root.fbRef(root.fbDB,'sv_distribuidora_permisos'),next);baseline=next;card.querySelector('[data-status]').textContent='Permisos guardados. Se aplican en la sesión de Distribuidora.';}catch(e){card.querySelector('[data-status]').textContent='No se guardaron los permisos.';}finally{b.disabled=false;}};
 }
 document.addEventListener('sisventas:session-ended',()=>{stop?.();stop=null;providersStop?.();providersStop=null;permissions=null;closeEditor();closeDetail();});
 root.SVDistribuidora={allowed,start,edit,detail,renderSettings,saveProduct,returnFromProduct,syncProviders,isEditing:()=>!!editor};
})(typeof window==='undefined'?{}:window);
