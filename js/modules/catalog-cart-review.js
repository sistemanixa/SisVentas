(function(){
  'use strict';
  window.catalogoAccionSeleccion=function(){return window.tienePermiso('presupuestos.crear')?'Preparar presupuesto':'Enviar a revisión';};
  window.abrirSeleccionCatalogo=function(){
    var old=document.getElementById('catalogo-seleccion-dialog');if(old)old.remove();
    var d=document.createElement('dialog');d.id='catalogo-seleccion-dialog';
    d.style.cssText='position:fixed;inset:0;margin:auto;width:min(660px,92vw);max-height:85vh;overflow:auto;border:1px solid var(--border);border-radius:14px;background:var(--bg2);color:var(--text);padding:20px';
    var h=document.createElement('h3');h.textContent='Productos seleccionados';d.appendChild(h);
    h.style.cssText='cursor:grab;touch-action:none;user-select:none;margin:0 0 14px;padding:6px 0';
    h.title='Arrastrá para mover la ventana';
    var drag=null;
    h.addEventListener('pointerdown',function(e){
      if(e.button!==0)return;
      var r=d.getBoundingClientRect();
      drag={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top};
      d.style.inset='auto';d.style.margin='0';d.style.left=r.left+'px';d.style.top=r.top+'px';
      h.setPointerCapture(e.pointerId);h.style.cursor='grabbing';e.preventDefault();
    });
    h.addEventListener('pointermove',function(e){
      if(!drag||e.pointerId!==drag.id)return;
      d.style.left=Math.max(0,Math.min(innerWidth-d.offsetWidth,e.clientX-drag.x))+'px';
      d.style.top=Math.max(0,Math.min(innerHeight-d.offsetHeight,e.clientY-drag.y))+'px';
    });
    function stopDrag(){drag=null;h.style.cursor='grab';}
    h.addEventListener('pointerup',stopDrag);h.addEventListener('pointercancel',stopDrag);h.addEventListener('lostpointercapture',stopDrag);
    var rows=document.createElement('div');d.appendChild(rows);
    function render(){rows.replaceChildren();var products=productosVisiblesCatalogo();
      if(!catalogoCarrito.size){rows.textContent='No hay productos seleccionados.';return;}
      catalogoCarrito.forEach(function(qty,key){var p=products.find(function(x){return String(x.fbKey)===key;});
        var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--border)';
        var name=document.createElement('span');name.style.flex='1';name.textContent=p?(p.codigo||'')+' · '+(p.nombre||p.descripcion||''):'Producto no disponible';row.appendChild(name);
        var count=document.createElement('span');
        function action(label,fn){var b=document.createElement('button');b.type='button';b.className='btn btn-sm';b.textContent=label;b.onclick=function(){fn();render();};row.appendChild(b);}
        action('−',function(){restarCarritoCatalogo(key);});count.textContent=qty;row.appendChild(count);
        action('+',function(){cambiarCantidadCarritoCatalogo(key,qty+1);});action('Quitar',function(){cambiarCantidadCarritoCatalogo(key,0);});rows.appendChild(row);
      });
    }render();
    var customer=document.createElement('input');customer.placeholder='Cliente o referencia de la solicitud';customer.className='search-input';customer.style.cssText='width:100%;margin-top:14px';
    var notes=document.createElement('textarea');notes.placeholder='Trabajo o solución que necesita el cliente';notes.className='search-input';notes.style.cssText='width:100%;margin-top:10px';
    if(!window.tienePermiso('presupuestos.crear')){d.appendChild(customer);d.appendChild(notes);}
    var footer=document.createElement('div');footer.style.cssText='display:flex;justify-content:flex-end;gap:10px;margin-top:16px';
    var close=document.createElement('button');close.className='btn btn-sm';close.textContent='Cerrar';close.onclick=function(){d.close();};footer.appendChild(close);
    var next=document.createElement('button');next.className='btn btn-sm btn-primary';next.textContent=catalogoAccionSeleccion();
    next.onclick=async function(){if(!catalogoCarrito.size){notify('Seleccioná al menos un producto');return;}
      if(window.tienePermiso('presupuestos.crear')){d.close();await prepararPresupuestoCatalogo();return;}
      if(!window.tienePermiso('catalogo.solicitarPresupuesto')){notify('No tenés permiso para enviar una selección a revisión');return;}
      next.disabled=true;next.textContent='Enviando…';
      try{await enviarSeleccionCatalogoRevision(customer.value,notes.value);d.close();}catch(e){notify('No se pudo enviar: '+e.message);}finally{next.disabled=false;next.textContent=catalogoAccionSeleccion();}
    };footer.appendChild(next);d.appendChild(footer);document.body.appendChild(d);d.addEventListener('close',function(){d.remove();});d.showModal();
  };
  window.enviarSeleccionCatalogoRevision=async function(cliente,notas){
    if(!window.tienePermiso('catalogo.solicitarPresupuesto'))throw Error('Sin permiso para solicitar revisión');
    if(window._catalogoEnviandoRevision)throw Error('La selección ya se está enviando');
    window._catalogoEnviandoRevision=true;
    try{
      var products=productosVisiblesCatalogo();
      var items=Array.from(catalogoCarrito).map(function(entry,i){var p=products.find(function(x){return String(x.fbKey)===entry[0];});if(!p)throw Error('Quitá los productos que ya no están disponibles');var price=precioVentaCanonicoProducto(p).precioARS;return {pid:p.fbKey,productoFbKey:p.fbKey,cod:p.codigo||'',desc:p.nombre||p.descripcion||'',qty:entry[1],punit:price,disc:0,sub:_redondearPrecioActual(price*entry[1]),orden:i+1,unidad:p.unidad||'Unidad'};});
      if(!items.length)throw Error('La selección está vacía');
      var subtotal=_redondearPrecioActual(items.reduce(function(n,i){return n+i.sub;},0)),iva=_redondearPrecioActual(subtotal*.21),id=await reservarSiguientePptoId();
      var record={id:id,numero:id,origen:'catalogo_solicitud',cliente:String(cliente||'').trim()||'CONSUMIDOR FINAL',observaciones:String(notas||'').trim(),items:items,subtotal:subtotal,iva:iva,total:_redondearPrecioActual(subtotal+iva),conIva:true,descuento:0,descuentoGeneral:0,descuentoAmt:0,estado:'revision',requiereAprobacion:true,motivo:'Selección del catálogo pendiente de revisión comercial',creadoPor:currentUser||'',usuario:currentUser||'',empleado:currentUser||'',empleadoUid:currentUserUid||'',empleadoEmail:currentUserEmail||'',fecha:new Date().toLocaleDateString('es-AR'),ts:Date.now(),audit:[{fecha:new Date().toLocaleString('es-AR'),usuario:currentUser||'',accion:'Selección enviada desde catálogo para revisión comercial'}]};
      await fbGuardarPresupuesto(record);catalogoCarrito.clear();renderCarritoCatalogo();notify('Selección enviada a Presupuestos pendientes para revisión');return record;
    }finally{window._catalogoEnviandoRevision=false;}
  };
})();
