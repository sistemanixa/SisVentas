(function(){
  'use strict';
  function allowed(){return window.tienePermiso&&window.tienePermiso('presupuestos.compararExterior');}
  function money(n){return Number.isFinite(n)?n.toLocaleString('es-AR',{style:'currency',currency:'ARS'}):'Sin dato';}
  function detectLabor(item, prod){
    item = item || {};
    var candidate = prod || item;
    if (item.esManoDeObra === true || item.esManoObra === true || item.esLabor === true || item.labor === true) return true;
    if (item.esManoDeObra === false || item.esManoObra === false) return false;
    if (typeof window.esProductoManoDeObra === 'function' && candidate) {
      var v = window.esProductoManoDeObra(candidate);
      if (v === true) return true;
    }
    if (item && (item.esManoObra === true || String(item.esManoObra || '').toLowerCase() === 'true')) return true;
    if (candidate && (candidate.esManoDeObra === true || candidate.esManoObra === true || String(candidate.esManoDeObra || '').toLowerCase() === 'true')) return true;
    var cat = String(item.categoria || item.catId || item.tipo || item.tipoProducto || candidate.categoria || candidate.tipoProducto || '').toLowerCase();
    var nombre = String(item.desc || item.descripcion || item.nombre || item.nombreProducto || candidate.nombre || candidate.descripcion || '').toLowerCase();
    var normalize = function(v){return v.normalize ? v.normalize('NFD').replace(/[\u0300-\u036f]/g,'') : v;};
    cat = normalize(cat);
    nombre = normalize(nombre);
    return cat.indexOf('mano de obra') >= 0 || /^mano de obra\b/.test(nombre);
  }
  window.calcularEscenarioExterior=function(rows,net,extra){
    var current=0,scenario=0,missing=0,compared=0;
    rows.forEach(function(r){if(!(r.actual>0)){missing++;return;}current+=r.actual*r.qty;scenario+=(r.exterior>0?r.exterior:r.actual)*r.qty;if(r.exterior>0)compared++;});
    scenario+=extra;
    return {actual:current,exterior:scenario,faltantes:missing,comparados:compared,ganancia:missing?null:net-scenario,margen:missing||!(net>0)?null:(net-scenario)/net*100,ahorro:missing?null:current-scenario};
  };
  window.abrirComparacionExterior=function(detalle){
    if(!allowed()){notify('No tenés permiso para comparar compras del exterior');return;}
    var record=detalle?buscarPptoPorRef(pptoActualId):null;
    var items=detalle?(record&&record.items||[]):getPpItems();
    if(!items.length){notify('Agregá productos al presupuesto para comparar');return;}
    var read=function(id){return Number(normalizarNumeroExcel((document.getElementById(id)||{}).textContent||'0'))||0;};
    var net=detalle?Number(record.total||0)-Number(record.iva||0):read('pp-total')-read('pp-iva');
    var currency=detalle?String(record.moneda||'ARS'):String(typeof _pptoMonedaActual!=='undefined'?_pptoMonedaActual:'ARS');
    var tc=obtenerDolarReferenciaProducto(),fx=Number(tc.valor)||0;
    if(currency==='USD'){if(!fx){notify('Falta la cotización del dólar para comparar en pesos');return;}net*=fx;}
    var rows=items.map(function(it){
      var p=Object.values(prodData||{}).find(function(p){return it.productoFbKey||it.pid?String(p.fbKey)===String(it.productoFbKey||it.pid):String(p.codigo)===String(it.cod||it.codigo);});
      if(detectLabor(it,p)) return null;
      var offers=(p&&p.proveedores||[]).filter(function(pv){return /Paraguay/i.test(origenProveedorProducto(pv).etiqueta)&&pv.disponibilidadProveedor!=='sin_stock';}).map(function(pv){
        var original=Number(pv.precioOriginal),usd=String(pv.monedaOriginal||'').toUpperCase()==='USD';
        var cost=usd?(fx>0?original*fx:0):Number(pv.costoRealArs||pv.precioArsPublicado||pv.precio)||0;
        return {pv:pv,cost:cost,usd:usd};
      }).filter(function(o){return o.cost>0;}).sort(function(a,b){return a.cost-b.cost;});
      var offer=offers[0],current=Number(obtenerCostoUnitarioVenta(it.cod||it.codigo,it))||0;
      return {nombre:it.desc||it.descripcion||p&&p.nombre||it.cod||'Producto',qty:Number(it.qty||it.cantidad)||1,actual:current,exterior:offer?offer.cost:0,proveedor:offer?(offer.pv.nombre||'Paraguay'):'Se conserva costo actual',nota:offer?(estadoVigenciaPrecioProveedor(p,offer.pv).texto+' · '+(offer.pv.disponibilidadProveedorTexto||'Stock no verificado')):'Sin cotización de Paraguay disponible'};
    }).filter(function(r){return r;});
    if(!rows.length){notify('No hay productos comparables en este presupuesto (mano de obra omitida).');return;}
    var old=document.getElementById('presupuesto-exterior-dialog');if(old)old.remove();
    var d=document.createElement('dialog');d.id='presupuesto-exterior-dialog';d.style.cssText='position:fixed;inset:0;margin:auto;width:min(980px,96vw);max-height:88vh;overflow:auto;background:linear-gradient(180deg,var(--bg2),var(--bg));color:var(--text);border:1px solid var(--border);border-radius:16px;padding:0;box-shadow:0 20px 40px rgba(0,0,0,.30);';
    function make(tag, parent, value) {
      var el = document.createElement(tag);
      el.textContent = value;
      if (parent) parent.appendChild(el);
      return el;
    }
    var shell=document.createElement('div');
    shell.style.cssText='padding:18px 20px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.03);position:sticky;top:0;z-index:2';
    d.appendChild(shell);
    var h=document.createElement('h3');h.textContent='Comparar compra en Paraguay';h.style.cssText='cursor:grab;touch-action:none;user-select:none;margin:0 0 6px;padding:0;display:flex;align-items:center;gap:8px';
    h.title='Arrastrá para mover la ventana';
    var spark=document.createElement('span');spark.textContent='◉';spark.style.cssText='font-size:10px;line-height:1;color:var(--green);';
    h.prepend(spark);
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
    shell.appendChild(h);
    var subtitle=document.createElement('p');
    subtitle.style.cssText='margin:0;color:var(--text3);font-size:12px;line-height:1.45';
    subtitle.textContent='Simulación en ARS de compra exterior. Mantiene el precio de venta del presupuesto y compara por unidad para estimar costo/margen.';
    shell.appendChild(subtitle);
    var notes=document.createElement('div');
    notes.style.cssText='margin-top:10px;display:flex;flex-wrap:wrap;gap:8px';
    notes.innerHTML='<span style="padding:5px 10px;border-radius:999px;background:rgba(34,197,94,.12);color:var(--green);font-size:11px;border:1px solid var(--green);font-weight:600">Producto base</span>'+
      '<span style="padding:5px 10px;border-radius:999px;background:rgba(59,130,246,.12);color:var(--blue);font-size:11px;border:1px solid var(--blue);font-weight:600">Mano de obra omitida</span>';
    shell.appendChild(notes);
    var bodyWrap=document.createElement('div');
    bodyWrap.style.cssText='padding:16px 18px 18px';
    d.appendChild(bodyWrap);
    var p1 = make('p', bodyWrap, 'Dólar utilizado: ' + money(fx) + ' · Se toma la menor cotización de Paraguay con stock disponible para comprar. Revisá vigencia y disponibilidad.');
    p1.style.cssText='margin:0 0 12px;color:var(--text2);font-size:12px;line-height:1.5';
    var wrap=document.createElement('div');wrap.style.overflowX='auto';
    var table=document.createElement('table');table.style.cssText='width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid var(--border);border-radius:12px';
    table.innerHTML='<colgroup><col style="width:45%"><col style="width:13%"><col style="width:17%"><col style="width:17%"><col style="width:8%"></colgroup>';
    var head=table.createTHead().insertRow();
    ['Producto','Cant.','Costo actual unit.','Paraguay unit.','Referencia'].forEach(function(label){
      var th=document.createElement('th');th.textContent=label;th.style.cssText='font-size:11px;text-transform:uppercase;letter-spacing:.3px;text-align:left;padding:10px;color:var(--text2);background:var(--bg3);font-weight:700;border-bottom:1px solid var(--border)';
      head.appendChild(th);
    });
    var body=table.createTBody();
    rows.forEach(function(r){
      var tr=body.insertRow();
      [r.nombre,r.qty,money(r.actual),r.exterior>0?money(r.exterior):'Sin alternativa',r.proveedor+' · '+r.nota].forEach(function(v){
        var td = tr.insertCell();
        td.textContent = v;
        td.style.cssText = 'padding:10px;border-bottom:1px solid var(--border);font-size:12px;vertical-align:top;';
      });
    });
    wrap.appendChild(table);
    bodyWrap.appendChild(wrap);
    var label=make('label', bodyWrap, 'Costos adicionales estimados en ARS (flete, importación y otros): ');
    var input=document.createElement('input');
    input.type='number';
    input.min='0';
    input.step='.01';
    input.value='0';
    input.className='search-input';
    label.appendChild(input);
    var extrasWrap=document.createElement('div');extrasWrap.style.cssText='margin:12px 0 14px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg3)';
    extrasWrap.appendChild(label);
    bodyWrap.appendChild(extrasWrap);
    var extraHelp=document.createElement('p');
    extraHelp.style.cssText='margin:8px 0 0;color:var(--text3);font-size:11px;line-height:1.4';
    extraHelp.textContent='Los costos extra no se incluyen automáticamente. Ajustalos para calcular una estimación real del escenario.';
    bodyWrap.appendChild(extraHelp);
    var summary=make('p', null, '');
    summary.style.cssText='white-space:pre-line;font-weight:600;line-height:1.7;margin:0;';
    var panel=document.createElement('div');
    panel.style.cssText='margin-top:12px;padding:12px;border-left:4px solid var(--blue);background:rgba(59,130,246,.08);border-radius:10px;color:var(--text2);font-size:12px;white-space:pre-line;line-height:1.45';
    panel.appendChild(summary);
    bodyWrap.appendChild(panel);
    function render(){var v=calcularEscenarioExterior(rows,net,Math.max(0,Number(input.value)||0));summary.textContent='Venta sin IVA: '+money(net)+'\nCosto actual: '+money(v.actual)+' · Costo del escenario: '+money(v.exterior)+'\nAlternativas de Paraguay: '+v.comparados+' de '+rows.length+' renglones\n'+(v.faltantes?'Falta costo actual en '+v.faltantes+' renglones. No se calcula el margen total.':'Diferencia de costo: '+money(v.ahorro)+' · Ganancia estimada: '+money(v.ganancia)+' · Margen sobre venta: '+(v.margen===null?'—':v.margen.toFixed(1)+'%'));}
    input.oninput=render;
    render();
    var footer=document.createElement('div');
    footer.style.cssText='display:flex;justify-content:flex-end;padding:0 18px 18px';
    var close=make('button', footer, 'Cerrar');
    close.className='btn';
    close.onclick=function(){d.close();};
    bodyWrap.appendChild(footer);
    d.addEventListener('close',function(){d.remove();});
    document.body.appendChild(d);
    d.showModal();
  };
  function install(){['pp-total','ppto-det-total2'].forEach(function(id){var anchor=document.getElementById(id);if(!anchor)return;var button=document.getElementById(id+'-exterior');if(!button){button=document.createElement('button');button.id=id+'-exterior';button.type='button';button.className='btn btn-sm';button.onclick=function(){abrirComparacionExterior(id==='ppto-det-total2');};anchor.closest('.totals').after(button);}button.innerHTML='<i class="ti ti-chart-arrows-vertical" aria-hidden="true"></i>';button.title='Análisis interno de compra';button.setAttribute('aria-label','Análisis interno de compra');button.style.cssText='width:36px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;color:var(--amber);border-color:var(--amber);';button.hidden=!allowed();button.style.display=allowed()?'inline-flex':'none';});var d=document.getElementById('presupuesto-exterior-dialog');if(d&&!allowed())d.close();}
  setInterval(install,1000);
})();
