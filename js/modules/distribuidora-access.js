(function(root){
 'use strict';
 const CATEGORY='COMPRAS PARAGUAY';
 const defaults={chat:true,detalle:true,editar:false,crear:false};
 const labels={chat:'Chat general y mensajes directos',detalle:'Abrir ficha interna del producto',editar:'Editar datos del producto',crear:'Crear productos en su catálogo'};
 let permissions=null,stop=null,editor=null,detailBox=null;
 const eligible=p=>!!p&&p.categoria===CATEGORY&&p.activo!==false&&p.estado!=='Inactivo'&&!p.esManoDeObra;
 const clean=value=>Object.fromEntries(Object.keys(defaults).map(k=>[k,typeof value?.[k]==='boolean'?value[k]:defaults[k]]));
 function allowed(key){return root.currentRole==='admin'||(root.currentRole==='distribuidora'&&!!permissions?.[key]);}
 const fields=[['nombre','Nombre','text'],['marca','Marca','text'],['descripcion','Descripción','textarea'],['codWeb','URL principal del producto','url'],['imagenUrl','URL de imagen','url']];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function payload(values,isNew){
  const out={};fields.forEach(([k,,type])=>{const v=String(values[k]||'').trim();if(v.length>(type==='textarea'?10000:2000))throw Error('El contenido es demasiado largo');if(type==='url'&&v&&!/^https?:\/\//i.test(v))throw Error('Las URL deben comenzar con https:// o http://');out[k]=v;});
  if(!out.nombre)throw Error('Completá el nombre del producto');
  if(isNew){out.categoria=CATEGORY;out.activo=true;out.estado='Activo';out.codigo=String(values.codigo||'').trim();if(!out.codigo)throw Error('Completá el código del producto');out.moneda='ARS';out.iva=21;out.ventaARS=0;}
  return out;
 }
 if(typeof module!=='undefined')module.exports={clean,payload,eligible};
 if(!root.document)return;
 async function start(){
  stop?.();permissions=null;
  const role=root.currentRole,uid=root.currentUserUid;
  return new Promise((resolve,reject)=>{let first=true;stop=root.fbOnValue(root.fbRef(root.fbDB,'sv_distribuidora_permisos'),snap=>{
   if(root.currentRole!==role||root.currentUserUid!==uid)return;
   permissions=clean(snap.val());
   if(detailBox&&!allowed('detalle'))closeDetail();
   if(editor&&!allowed(editor.dataset.new==='1'?'crear':'editar')){editor.remove();editor=null;}
   document.dispatchEvent(new CustomEvent('sisventas:distribuidora-permissions'));
   if(typeof root.aplicarVisibilidadBotonesFlotantes==='function')root.aplicarVisibilidadBotonesFlotantes();
   if(!permissions.chat&&root.currentRole==='distribuidora'){root.chatCerrar?.();document.dispatchEvent(new CustomEvent('sisventas:chat-disabled'));}
   else if(!first&&root.currentRole==='distribuidora'){document.dispatchEvent(new CustomEvent('sisventas:chat-ready',{detail:{uid}}));root.chatInicializar?.();}
   if(first){first=false;resolve();}
  },err=>{permissions=null;reject(err);});});
 }
 function edit(key,product,onSaved){
  const isNew=!key;if(!allowed(isNew?'crear':'editar')||(!isNew&&!eligible(product)))return;
  editor?.remove();const form=document.createElement('form');editor=form;form.dataset.svModalBehavior='compact';form.dataset.new=isNew?'1':'0';form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');form.setAttribute('aria-label',isNew?'Nuevo producto de Distribuidora':'Editar producto de Distribuidora');
  form.style.cssText='position:fixed;inset:0;z-index:100200;background:var(--bg);color:var(--text);overflow:auto;padding:24px;box-sizing:border-box';
  form.innerHTML='<div style="max-width:1400px;margin:auto"><header class="pf-editor-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px"><div><h2 style="margin:0;font-size:22px">'+(isNew?'Nuevo producto':'Editar producto')+'</h2><div class="pf-editor-subtitle">'+esc(product?.nombre||'COMPRAS PARAGUAY')+'</div></div><button type="button" class="btn btn-sm" data-close aria-label="Cerrar edición"><i class="ti ti-x"></i></button></header><div class="pf-identidad-layout"><section class="card pf-identidad-card"><div class="card-head"><span class="card-title">Identificación</span></div><div class="form-grid">'+(isNew?'<div class="fg"><label>Código</label><input name="codigo" required maxlength="100"></div>':'<div class="fg"><label>Código</label><input value="'+esc(product.codigo)+'" disabled></div>')+'<div class="fg"><label>Categoría</label><input value="COMPRAS PARAGUAY" disabled></div>'+fields.map(([k,label,type])=>'<div class="fg full"><label>'+label+'</label>'+(type==='textarea'?'<textarea name="'+k+'" rows="5">'+esc(product?.[k])+'</textarea>':'<input name="'+k+'" type="'+type+'" value="'+esc(product?.[k])+'" '+(k==='nombre'?'required':'')+'>')+'</div>').join('')+'</div></section><aside class="card pf-identidad-media"><div class="card-head"><span class="card-title">Imagen del producto</span></div><div style="background:var(--bg3);border-radius:var(--radius);overflow:hidden">'+root.imagenCatalogoHTML(product||{},'dist-editor-image')+'</div><p style="font-size:12px;color:var(--text3)">Los cambios se guardan en el catálogo compartido de SisVentas.</p></aside></div><p data-status role="status"></p><footer style="display:flex;justify-content:flex-end;gap:10px;padding:16px 0"><button type="button" class="btn" data-cancel>Cancelar</button><button class="btn btn-primary" type="submit"><i class="ti ti-device-floppy"></i> Guardar producto</button></footer><style>.dist-editor-image{width:100%;height:300px;object-fit:contain;background:white}</style></div>';

  const dismiss=()=>{form.remove();if(editor===form)editor=null;};form.querySelector('[data-close]').onclick=dismiss;form.querySelector('[data-cancel]').onclick=dismiss;form.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dismiss();}};
  form.onsubmit=async e=>{e.preventDefault();const btn=form.querySelector('[type=submit]'),status=form.querySelector('[data-status]');if(btn.disabled)return;
   btn.disabled=true;status.textContent='Guardando producto…';
   try{
    if(!allowed(isNew?'crear':'editar'))throw Error('El permiso cambió. Revisá con el administrador.');
    const data=payload(Object.fromEntries(new FormData(form)),isNew),id=key||root.fbPush(root.fbRef(root.fbDB,'sisventas/productos')).key;
    const audit=root.fbPush(root.fbRef(root.fbDB,'sv_distribuidora_auditoria')).key,changes={};
    if(isNew)changes['sisventas/productos/'+id]=data;else for(const [k,v] of Object.entries(data))changes['sisventas/productos/'+id+'/'+k]=v;
    changes['sv_distribuidora_auditoria/'+audit]={uid:root.currentUserUid,producto:id,accion:isNew?'crear':'editar',fecha:root.fbServerTimestamp(),campos:Object.keys(data).join(',')};
    await root.fbUpdate(root.fbRef(root.fbDB),changes);dismiss();onSaved?.(id);root.notify?.('Producto guardado');
   }catch(error){status.textContent='No se guardó el producto. '+(error.message||'Reintentá.');btn.disabled=false;}
  };document.body.appendChild(form);form.querySelector('input').focus();
 }
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
  const back=native.querySelector('button[onclick="cerrarDetalleProducto()"]');back.removeAttribute('onclick');back.textContent='← Volver al catálogo';back.onclick=closeDetail;
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
 document.addEventListener('sisventas:session-ended',()=>{stop?.();stop=null;permissions=null;editor?.remove();editor=null;closeDetail();});
 root.SVDistribuidora={allowed,start,edit,detail,renderSettings};
})(typeof window==='undefined'?{}:window);
