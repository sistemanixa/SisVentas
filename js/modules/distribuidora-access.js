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
   if(detailBox&&!allowed('detalle')){detailBox.remove();detailBox=null;}
   if(editor&&!allowed(editor.dataset.new==='1'?'crear':'editar')){editor.remove();editor=null;}
   document.dispatchEvent(new CustomEvent('sisventas:distribuidora-permissions'));
   if(typeof root.aplicarVisibilidadBotonesFlotantes==='function')root.aplicarVisibilidadBotonesFlotantes();
   if(!permissions.chat&&root.currentRole==='distribuidora'){root.chatCerrar?.();document.dispatchEvent(new CustomEvent('sisventas:chat-disabled'));}
   else if(!first&&root.currentRole==='distribuidora'){document.dispatchEvent(new CustomEvent('sisventas:session-ready',{detail:{uid}}));root.chatInicializar?.();}
   if(first){first=false;resolve();}
  },err=>{permissions=null;reject(err);});});
 }
 function edit(key,product,onSaved){
  const isNew=!key;if(!allowed(isNew?'crear':'editar')||(!isNew&&!eligible(product)))return;
  editor?.remove();const form=document.createElement('form');editor=form;form.dataset.new=isNew?'1':'0';form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');form.setAttribute('aria-label',isNew?'Nuevo producto de Distribuidora':'Editar producto de Distribuidora');
  form.style.cssText='position:fixed;inset:0;z-index:100200;background:var(--bg);color:var(--text);overflow:auto;padding:24px;box-sizing:border-box';
  form.innerHTML='<div style="max-width:900px;margin:auto"><div style="display:flex;justify-content:space-between;gap:15px"><h2>'+(isNew?'Nuevo producto':'Editar producto')+'</h2><button type="button" class="btn" data-close aria-label="Cerrar edición">×</button></div><p>Categoría: COMPRAS PARAGUAY</p><p>Los cambios se guardan en el catálogo compartido de SisVentas.</p>'+ (isNew?'<label style="display:block;margin:14px 0">Código<input name="codigo" required class="input" style="width:100%" maxlength="100"></label>':'<p>'+esc(product.codigo)+'</p>')+fields.map(([k,label,type])=>'<label style="display:block;margin:14px 0">'+label+(type==='textarea'?'<textarea name="'+k+'" rows="5" style="width:100%;padding:12px">'+esc(product?.[k])+'</textarea>':'<input name="'+k+'" type="'+type+'" value="'+esc(product?.[k])+'" '+(k==='nombre'?'required':'')+' style="width:100%;padding:12px;box-sizing:border-box">')+'</label>').join('')+'<p data-status role="status"></p><div style="display:flex;justify-content:flex-end;gap:10px"><button type="button" class="btn" data-cancel>Cancelar</button><button class="btn btn-primary" type="submit">Guardar producto</button></div></div>';
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
 function detail(key,p){
  if(!allowed('detalle')||!eligible(p))return;
  detailBox?.remove();const box=document.createElement('section');detailBox=box;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Ficha interna del producto');box.style.cssText='position:fixed;inset:0;z-index:100180;overflow:auto;background:var(--bg);color:var(--text);padding:24px';
  box.innerHTML='<div style="max-width:1000px;margin:auto"><button class="btn" data-close>← Volver al catálogo</button><h2>'+esc(p.nombre||p.descripcion)+'</h2><p>'+esc(p.codigo)+' · '+esc(p.marca)+' · '+CATEGORY+'</p>'+root.imagenCatalogoHTML(p,'catalogo-modal-img')+'<p style="white-space:pre-wrap">'+esc(p.descripcion)+'</p><p>Precio de venta: '+Number(root.precioVentaCanonicoProducto(p).precioARS).toLocaleString('es-AR',{style:'currency',currency:'ARS'})+' (sin IVA)</p><div data-actions></div></div>';
  box.querySelector('[data-close]').onclick=()=>box.remove();box.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();box.remove();}};
  if(allowed('editar')){const b=document.createElement('button');b.className='btn btn-primary';b.textContent='Editar producto';b.onclick=()=>edit(key,p,()=>box.remove());box.querySelector('[data-actions]').appendChild(b);}
  document.body.appendChild(box);box.querySelector('button').focus();
 }
 function renderSettings(container){
  if(root.currentRole!=='admin')return;
  const card=document.createElement('section');card.className='card';card.setAttribute('aria-label','Permisos de Distribuidora');
  card.innerHTML='<h3>Distribuidora</h3><p>Catálogo COMPRAS PARAGUAY y listas propias. Los permisos siguientes se aplican solo a ese catálogo; no habilitan ventas ni administración.</p><div data-options>Cargando permisos…</div><p data-status role="status"></p><button class="btn btn-primary" data-save disabled>Guardar permisos de Distribuidora</button>';
  container.prepend(card);let baseline;
  root.fbGet(root.fbRef(root.fbDB,'sv_distribuidora_permisos')).then(s=>{baseline=clean(s.val());card.querySelector('[data-options]').innerHTML=Object.entries(labels).map(([k,label])=>'<label style="display:block;margin:14px 0"><input type="checkbox" data-permission="'+k+'" '+(baseline[k]?'checked':'')+'> '+label+'</label>').join('');card.querySelector('[data-save]').disabled=false;}).catch(()=>card.querySelector('[data-status]').textContent='No se pudieron cargar los permisos.');
  card.querySelector('[data-save]').onclick=async()=>{const b=card.querySelector('[data-save]');b.disabled=true;try{const next=Object.fromEntries(Array.from(card.querySelectorAll('[data-permission]')).map(n=>[n.dataset.permission,n.checked]));await root.fbSet(root.fbRef(root.fbDB,'sv_distribuidora_permisos'),next);baseline=next;card.querySelector('[data-status]').textContent='Permisos guardados. Se aplican en la sesión de Distribuidora.';}catch(e){card.querySelector('[data-status]').textContent='No se guardaron los permisos.';}finally{b.disabled=false;}};
 }
 document.addEventListener('sisventas:session-ended',()=>{stop?.();stop=null;permissions=null;editor?.remove();editor=null;detailBox?.remove();detailBox=null;});
 root.SVDistribuidora={allowed,start,edit,detail,renderSettings};
})(typeof window==='undefined'?{}:window);
