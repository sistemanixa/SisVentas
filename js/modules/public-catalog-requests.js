(function(root){
'use strict';let host,off,offStatus,offEdits,offRate,offAttention,attention={},profitRun=0,owner='',requests={},statuses={},edits={};
function profit(price,qty,costARS,rate){
 if(![price,qty,costARS,rate].every(Number.isFinite)||price<=0||qty<=0||costARS<=0||rate<=0)return null;
 const costCents=Math.round(costARS/rate*100),unitCents=Math.round(price*100)-costCents;
 return {unit:unitCents/100,total:unitCents*qty/100,cost:costCents/100};
}
function purchaseList(request,changes,timestamp){
 const productos={},comprasFinales={},fechasProductos={};
 const items=JSON.parse(request.contenido);if(!Array.isArray(items))throw Error('Detalle inválido');
 items.slice(0,40).forEach((original,index)=>{const item=requestItem(original,changes?.[index]);if(item.eliminado)return;
 if(!item.id||/[.#$\[\]\/]/.test(item.id)||!Number.isInteger(item.cantidad)||item.cantidad<1||item.cantidad>999||!Number.isFinite(item.precioUSD)||item.precioUSD<=0)throw Error('Revisá los productos y sus precios antes de atender.');
 if(productos[item.id])throw Error('Hay productos repetidos. Revisá la solicitud.');
 productos[item.id]=item.cantidad;comprasFinales[item.id]={estado:'pendiente',moneda:'USD',proveedor:'',precioVentaUnitarioUSD:item.precioUSD};fechasProductos[item.id]={agregadoEn:timestamp};});
 if(!Object.keys(productos).length)throw Error('La solicitud no tiene ítems activos.');
 return {nombre:request.lista,productos,comprasFinales,fechasProductos,creadoEn:timestamp,actualizadoEn:timestamp};
}
function requestItem(original,edit){return {...original,...(edit&&Object.hasOwn(edit,'cantidad')?{cantidad:edit.cantidad}:{}),eliminado:edit?.eliminado===true};}
if(typeof module!=='undefined'&&module.exports){module.exports={profit,requestItem,purchaseList};return;}
const money=n=>'US$ '+n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
async function loadProfits(){
 const target=host,uid=owner,cache=new Map(),run=++profitRun;
 const rate=Number(root.obtenerDolarReferenciaProducto?.().valor);
 const pesos=n=>'ARS $ '+n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
 const dual=n=>money(n)+(Number.isFinite(rate)&&rate>0?' ≈ '+pesos(n*rate):'');
 const valid=el=>run===profitRun&&host===target&&owner===uid&&allowed()&&el.isConnected;
 const rows=Array.from(target.querySelectorAll('[data-request-profit]'));let cursor=0;
 function product(id){if(!cache.has(id))cache.set(id,root.fbGet(root.fbRef(root.fbDB,'sisventas/productos/'+id)).then(s=>s.val()).catch(()=>null));return cache.get(id);}
 function total(section){
  const lines=Array.from(section.querySelectorAll('[data-request-profit]')),box=section.querySelector('[data-profit-total]');
  if(lines.some(el=>el.dataset.loaded!=='1'))return;
  if(!lines.length){box.textContent='Pedido sin ítems activos · Ganancia total: '+dual(0);return;}
  const known=lines.filter(el=>el.dataset.profit!==undefined),sum=known.reduce((s,el)=>s+Number(el.dataset.profit),0);
  box.textContent=known.length?('Ganancia estimada '+(known.length===lines.length?'total':'parcial')+': '+dual(sum)+(known.length<lines.length?' · '+(lines.length-known.length)+' ítem(s) sin cálculo':'')):'Ganancia del pedido: faltan costos o precios para calcular';
  box.title='Cotización actual: '+pesos(rate)+' / USD';
  box.style.color=known.length?(sum<0?'var(--red)':'var(--green)'):'var(--text3)';
 }
 target.querySelectorAll('details').forEach(total);
 for(let n=0;n<Math.min(4,rows.length);n++)(async()=>{while(cursor<rows.length){
  const el=rows[cursor++],id=el.dataset.requestProfit;
  const p=id&&!/[.#$\[\]\/]/.test(id)?await product(id):null;
  if(!valid(el))return;
  const cost=p&&typeof root.precioGremioARSDesdeProducto==='function'?Number(root.precioGremioARSDesdeProducto(p)):NaN;
  const rate=Number(root.obtenerDolarReferenciaProducto?.().valor);
  const result=profit(Number(el.dataset.sale),Number(el.dataset.qty),cost,rate);
  el.dataset.loaded='1';
  if(result){el.dataset.profit=String(result.total);el.textContent='Ganancia: '+dual(result.total);el.title='Estimada sobre el costo actual. Ganancia por unidad: '+dual(result.unit);el.style.color=result.total<0?'var(--red)':'var(--green)';}
  else el.textContent='Ganancia: pendiente de datos';
  total(el.closest('details'));
 }})();
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowed=()=>!!root.currentUserUid&&(root.permisoModulo?.('distribuidora')||(root.currentRole==='admin'&&root.permisoModulo?.('balancecompra'))||(root.currentRole==='distribuidora'&&root.SVDistribuidora?.allowed('solicitudes')));
function reset(){off?.();offStatus?.();offEdits?.();offRate?.();offAttention?.();off=offStatus=offEdits=offRate=offAttention=null;attention={};profitRun++;host?.remove();host=null;owner='';requests={};statuses={};edits={};}
function itemActions(id,p){if(attention[id])return '';return '<span style="display:flex;gap:6px;flex:0 0 auto"><button class="btn btn-sm" data-edit-item="'+esc(id)+'" data-index="'+p.index+'" aria-label="Editar '+esc(p.nombre)+'"><i class="ti ti-pencil"></i></button><button class="btn btn-sm" data-delete-item="'+esc(id)+'" data-index="'+p.index+'" aria-label="Eliminar '+esc(p.nombre)+'" style="color:var(--red)"><i class="ti ti-trash"></i></button></span>';}
function editItem(id,index){
 if(host.querySelector('[data-item-editor]'))return;
 const button=Array.from(host.querySelectorAll('[data-edit-item]')).find(b=>b.dataset.editItem===id&&Number(b.dataset.index)===index);
 const row=button?.closest('[data-item-row]');if(!row)return;
 const item=requestItem(JSON.parse(requests[id].contenido)[index],edits[id]?.[index]),uid=owner;
 const form=document.createElement('form');form.dataset.itemEditor='';form.style.cssText='grid-column:1/-1;display:flex;align-items:end;gap:12px;flex-wrap:wrap;padding:16px;background:var(--bg2);border-radius:10px';
 form.innerHTML='<label style="flex:1;min-width:100px">Cantidad<input style="width:100%;margin-top:6px;min-height:38px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg3);color:var(--text)" name="cantidad" aria-label="Cantidad" type="number" min="1" max="999" step="1" required value="'+esc(item.cantidad)+'"></label><div style="flex:2;min-width:160px;padding-bottom:8px;color:var(--text3)">Precio acordado<br><strong style="color:var(--text)">'+money(Number(item.precioUSD)||0)+'</strong></div><button class="btn btn-primary" type="submit">Guardar</button><button type="button" class="btn" data-cancel>Cancelar</button><p role="status" style="flex-basis:100%;margin:0"></p>';
 row.append(form);button.disabled=true;row.querySelector('[data-delete-item]').disabled=true;
 const close=()=>{form.remove();if(host){render();const back=Array.from(host.querySelectorAll('[data-edit-item]')).find(b=>b.dataset.editItem===id&&Number(b.dataset.index)===index);back?.focus();}};
 form.querySelector('[data-cancel]').onclick=close;
 form.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!form.dataset.saving)close();}};
 form.onsubmit=async e=>{e.preventDefault();if(!allowed()||uid!==owner)return;const cantidad=Number(form.elements.cantidad.value);form.dataset.saving='1';form.querySelectorAll('input,button').forEach(b=>b.disabled=true);try{await root.fbSet(root.fbRef(root.fbDB,'sv_catalogo_solicitudes_edicion/'+id+'/'+index),{cantidad,eliminado:false});if(uid===owner)close();}catch(_){form.querySelector('[role=status]').textContent='No se pudo guardar. Reintentá.';}finally{delete form.dataset.saving;form.querySelectorAll('input,button').forEach(b=>b.disabled=false);}};
 form.elements.cantidad.focus();
}
function loadPhotos(){
 const target=host,uid=owner;
 const boxes=Array.from(target.querySelectorAll('[data-request-photo]'));let cursor=0;
 const cache=new Map();
 const valid=()=>host===target&&owner===uid&&allowed();
 async function photo(id){if(!cache.has(id))cache.set(id,root.fbGet(root.fbRef(root.fbDB,'sv_catalogo_publico/'+id)).then(s=>s.val()?.imagenUrl||'').catch(()=>''));return cache.get(id);}
 for(let n=0;n<Math.min(4,boxes.length);n++)(async()=>{while(cursor<boxes.length){const box=boxes[cursor++],id=box.dataset.requestPhoto;if(!id||/[.#$\[\]\/]/.test(id))continue;const url=await photo(id);if(!valid()||!box.isConnected)return;if(!/^https:\/\//i.test(url))continue;const img=document.createElement('img');img.src=url;img.alt=box.dataset.productName||'Producto';img.loading='lazy';img.style.cssText='width:100%;height:100%;object-fit:contain';img.onerror=()=>{box.textContent='Sin imagen';};box.replaceChildren(img);}})();
}
function render(){if(!host||!allowed()||host.querySelector('[data-item-editor]'))return;const opened=new Set(Array.from(host.querySelectorAll('details[open][data-request-id]')).map(el=>el.dataset.requestId));const entries=Object.entries(requests).sort((a,b)=>b[1].creadaEn-a[1].creadaEn);host.querySelector('[data-request-count]').textContent=entries.filter(([id])=>statuses[id]!=='atendida').length+' pendientes';host.querySelector('[data-requests]').innerHTML=entries.length?entries.map(([id,r])=>{let items=[];try{const data=JSON.parse(r.contenido);if(Array.isArray(data))items=data.slice(0,40).map((p,index)=>({...requestItem(p,edits[id]?.[index]),index})).filter(p=>p&&typeof p.nombre==='string'&&Number.isInteger(p.cantidad)&&p.cantidad>0&&p.cantidad<=999);}catch(_){}return '<details data-request-id="'+esc(id)+'" '+(opened.has(id)?'open ':'')+'style="border-top:1px solid var(--border);padding:16px 0"><summary style="cursor:pointer"><strong>'+esc(r.lista)+'</strong> · '+esc(r.nombre)+' · '+new Date(r.creadaEn).toLocaleString('es-AR')+' <span class="badge '+(statuses[id]==='atendida'?'b-green':'b-amber')+'">'+(statuses[id]==='atendida'?'Atendida':'Pendiente')+'</span></summary><div style="padding:16px 0"><p>Teléfono: '+esc(r.telefono||'No indicado')+' · Correo: '+esc(r.email||'No indicado')+'</p><p style="font-size:12px;color:var(--text3);margin:8px 0">Solicitud '+esc(id.slice(0,8).toUpperCase())+'</p>'+items.filter(p=>!p.eliminado).map(p=>'<div data-item-row style="display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:14px;padding:18px 0;border-bottom:1px solid var(--border)"><span data-request-photo="'+esc(p.id)+'" data-product-name="'+esc(p.nombre)+'" style="display:flex;align-items:center;justify-content:center;width:64px;height:64px;background:white;border-radius:10px;overflow:hidden;color:#526174;font-size:11px;text-align:center">Sin imagen</span><span style="min-width:0;overflow-wrap:anywhere">'+'<strong>'+esc(p.nombre)+'</strong><div style="margin-top:6px;color:var(--text3)">'+esc(p.cantidad)+' un.'+(Number.isFinite(p.precioUSD)&&p.precioUSD>0?' · US$ '+esc(p.precioUSD.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}))+' por unidad':' · Precio a consultar')+'</div><small data-request-profit="'+esc(p.id)+'" data-sale="'+esc(p.precioUSD)+'" data-qty="'+esc(p.cantidad)+'" style="display:block;margin-top:8px;color:var(--text3)">Calculando ganancia…</small></span>'+itemActions(id,p)+'</div>').join('')+items.filter(p=>p.eliminado).map(p=>'<p>'+esc(p.nombre)+' · Eliminado <button class="btn btn-sm" data-restore-item="'+esc(id)+'" data-index="'+p.index+'">Restaurar ítem</button></p>').join('')+(!items.length?'<p>No se pudo interpretar el detalle. Consultá al cliente.</p>':'')+'<p data-profit-total style="margin:16px 0 6px;font-weight:700">Calculando ganancia del pedido…</p><p style="font-size:12px;color:var(--text3)">Según costo y dólar actuales.</p><button class="btn btn-sm" style="margin-top:14px" data-status="'+esc(id)+'" '+(attention[id]?'disabled':'')+'>'+ (attention[id]?'Lista de compras creada':'Atender y crear lista')+'</button>'+(attention[id]?'<p style="font-size:12px;color:var(--text3);margin-top:10px">Atendida por '+esc(attention[id].usuario)+' · '+new Date(attention[id].fecha).toLocaleString('es-AR')+' · Lista: '+esc(r.lista)+'</p>':'')+'</div></details>';}).join(''):'<p style="color:var(--text3);padding:16px 0">Todavía no recibiste solicitudes del catálogo.</p>';loadPhotos();loadProfits();}
function mount(container){if(!allowed()){reset();return;}if(host?.isConnected&&owner===root.currentUserUid&&(!container||host.parentElement===container))return;reset();owner=root.currentUserUid;const page=container||document.getElementById('page-balancecompra');if(!page||!root.fbOnValue)return;host=document.createElement('section');host.id='public-catalog-requests';host.className='card';host.innerHTML='<div class="card-head"><h3>Solicitudes de compra</h3><span data-request-count class="badge b-green"></span></div><p style="font-size:12px;color:var(--text3)">Listas enviadas por clientes desde el catálogo público.</p><div data-requests>Cargando solicitudes…</div><p data-request-error role="status"></p>';page.prepend(host);const uid=owner;const valid=()=>host&&allowed()&&owner===uid&&root.currentUserUid===uid;
 const fail=()=>{if(valid())host.querySelector('[data-request-error]').textContent='No se pudieron cargar las solicitudes. Revisá la conexión y los permisos.';};
 off=root.fbOnValue(root.fbRef(root.fbDB,'sv_catalogo_solicitudes'),s=>{if(valid()){requests=s.val()||{};render();}},fail);
 offRate=root.fbOnValue(root.fbRef(root.fbDB,'sisventas/config/tipoCambio'),s=>{if(valid()){root.TIPO_CAMBIO_CONFIG=s.val()||{};loadProfits();}},fail);
 offEdits=root.fbOnValue(root.fbRef(root.fbDB,'sv_catalogo_solicitudes_edicion'),s=>{if(valid()){edits=s.val()||{};host.querySelector('[data-request-error]').textContent='';render();}},()=>{if(valid())host.querySelector('[data-request-error]').textContent='La edición de ítems todavía no está habilitada. Las solicitudes se pueden consultar.';});
 offAttention=root.fbOnValue(root.fbRef(root.fbDB,'sv_catalogo_solicitudes_atencion'),s=>{if(valid()){attention=s.val()||{};render();}},fail);
 offStatus=root.fbOnValue(root.fbRef(root.fbDB,'sv_catalogo_solicitudes_estado'),s=>{if(valid()){statuses=s.val()||{};render();}},fail);
 host.onclick=async e=>{const action=e.target.closest('[data-edit-item],[data-delete-item],[data-restore-item]');if(action&&valid()){const id=action.dataset.editItem||action.dataset.deleteItem||action.dataset.restoreItem,index=Number(action.dataset.index);if(action.dataset.editItem){editItem(id,index);return;}if(action.dataset.deleteItem&&!await root.svConfirm('¿Eliminar este ítem del pedido? Podés restaurarlo después.'))return;if(!valid())return;action.disabled=true;try{await root.fbSet(root.fbRef(root.fbDB,'sv_catalogo_solicitudes_edicion/'+id+'/'+index+'/eliminado'),!!action.dataset.deleteItem);}catch(_){fail();}finally{action.disabled=false;}return;}const b=e.target.closest('[data-status]');if(!b||!valid())return;b.disabled=true;try{const id=b.dataset.status;if(attention[id])return;const listKey='solicitud_'+id,stamp=root.fbServerTimestamp();
 const list=purchaseList(requests[id],edits[id],stamp);
 const existing=await root.fbGet(root.fbRef(root.fbDB,'sv_listas_paraguay/'+uid+'/'+listKey));if(existing.exists())throw Error('Ya existe una lista para esta solicitud.');if(!valid())return;
 const updates={};updates['sv_listas_paraguay/'+uid+'/'+listKey]=list;
 updates['sv_catalogo_solicitudes_atencion/'+id]={fecha:stamp,uid,usuario:String(root.currentUser||uid),lista:listKey};
 updates['sv_catalogo_solicitudes_estado/'+id]='atendida';
 await root.fbUpdate(root.fbRef(root.fbDB),updates);}catch(error){if(valid())host.querySelector('[data-request-error]').textContent=error.message||'No se pudo crear la lista. La solicitud no cambió.';}finally{if(b.isConnected)b.disabled=false;}};
}
document.addEventListener('sisventas:distribuidora-permissions',()=>{if(!allowed())reset();});document.addEventListener('sisventas:session-ended',reset);document.addEventListener('sisventas:page-changed',e=>{if(e.detail?.page==='balancecompra')mount();else if(!allowed())reset();});document.addEventListener('sisventas:module-ready',e=>{if(e.detail?.page==='balancecompra')mount();});root.SVCatalogRequests={mount,reset};if(document.querySelector('#page-balancecompra.active'))mount();
})(typeof window==='undefined'?{}:window);
