(function(){
  'use strict';
  function allowed(){return window.tienePermiso&&window.tienePermiso('presupuestos.compararExterior');}
  function money(n){return Number.isFinite(n)?n.toLocaleString('es-AR',{style:'currency',currency:'ARS'}):'Sin dato';}
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
      var offers=(p&&p.proveedores||[]).filter(function(pv){return /Paraguay/i.test(origenProveedorProducto(pv).etiqueta)&&pv.disponibilidadProveedor!=='sin_stock';}).map(function(pv){
        var original=Number(pv.precioOriginal),usd=String(pv.monedaOriginal||'').toUpperCase()==='USD';
        var cost=usd?(fx>0?original*fx:0):Number(pv.costoRealArs||pv.precioArsPublicado||pv.precio)||0;
        return {pv:pv,cost:cost,usd:usd};
      }).filter(function(o){return o.cost>0;}).sort(function(a,b){return a.cost-b.cost;});
      var offer=offers[0],current=Number(obtenerCostoUnitarioVenta(it.cod||it.codigo,it))||0;
      return {nombre:it.desc||it.descripcion||p&&p.nombre||it.cod||'Producto',qty:Number(it.qty||it.cantidad)||1,actual:current,exterior:offer?offer.cost:0,proveedor:offer?(offer.pv.nombre||'Paraguay'):'Se conserva costo actual',nota:offer?(estadoVigenciaPrecioProveedor(p,offer.pv).texto+' · '+(offer.pv.disponibilidadProveedorTexto||'Stock no verificado')):'Sin cotización de Paraguay disponible'};
    });
    var old=document.getElementById('presupuesto-exterior-dialog');if(old)old.remove();
    var d=document.createElement('dialog');d.id='presupuesto-exterior-dialog';d.style.cssText='width:min(920px,94vw);max-height:88vh;overflow:auto;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:14px;padding:22px';
    function text(tag,value){var el=document.createElement(tag);el.textContent=value;d.appendChild(el);return el;}
    text('h3','Comparar compra en Paraguay');
    text('p','Simulación interna en ARS. Mantiene la venta del presupuesto y compara su ingreso sin IVA contra los costos. Los productos sin alternativa conservan el costo actual.');
    text('p','Dólar utilizado: '+money(fx)+' · Se toma la menor cotización de Paraguay no marcada sin stock. Revisá vigencia y disponibilidad.');
    var wrap=document.createElement('div');wrap.style.overflowX='auto';var table=document.createElement('table');table.style.width='100%';
    var head=table.createTHead().insertRow();['Producto','Cant.','Costo actual unit.','Paraguay unit.','Referencia'].forEach(function(label){var th=document.createElement('th');th.textContent=label;head.appendChild(th);});
    var body=table.createTBody();rows.forEach(function(r){var tr=body.insertRow();[r.nombre,r.qty,money(r.actual),r.exterior>0?money(r.exterior):'Sin alternativa',r.proveedor+' · '+r.nota].forEach(function(v){tr.insertCell().textContent=v;});});wrap.appendChild(table);d.appendChild(wrap);
    var label=text('label','Costos adicionales estimados en ARS (flete, importación y otros): '),input=document.createElement('input');input.type='number';input.min='0';input.step='.01';input.value='0';input.className='search-input';label.appendChild(input);
    text('p','Los costos adicionales no están incluidos automáticamente. El margen es estimado y depende de completarlos.');
    var summary=text('p','');summary.style.cssText='white-space:pre-line;font-weight:600;line-height:1.7';
    function render(){var v=calcularEscenarioExterior(rows,net,Math.max(0,Number(input.value)||0));summary.textContent='Venta sin IVA: '+money(net)+'\nCosto actual: '+money(v.actual)+' · Costo del escenario: '+money(v.exterior)+'\nAlternativas de Paraguay: '+v.comparados+' de '+rows.length+' renglones\n'+(v.faltantes?'Falta costo actual en '+v.faltantes+' renglones. No se calcula el margen total.':'Diferencia de costo: '+money(v.ahorro)+' · Ganancia estimada: '+money(v.ganancia)+' · Margen sobre venta: '+(v.margen===null?'—':v.margen.toFixed(1)+'%'));}
    input.oninput=render;render();var close=text('button','Cerrar');close.className='btn';close.onclick=function(){d.close();};d.addEventListener('close',function(){d.remove();});document.body.appendChild(d);d.showModal();
  };
  function install(){['pp-total','ppto-det-total2'].forEach(function(id){var anchor=document.getElementById(id);if(!anchor)return;var button=document.getElementById(id+'-exterior');if(!button){button=document.createElement('button');button.id=id+'-exterior';button.type='button';button.className='btn btn-sm';button.textContent='Comparar compra en Paraguay';button.onclick=function(){abrirComparacionExterior(id==='ppto-det-total2');};anchor.closest('.totals').after(button);}button.hidden=!allowed();button.style.display=allowed()?'':'none';});var d=document.getElementById('presupuesto-exterior-dialog');if(d&&!allowed())d.close();}
  setInterval(install,1000);
})();
