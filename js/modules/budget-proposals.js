/* New commercial proposals: originals are never modified. */
(function(){
  'use strict';
  var round=function(v){return Math.round((v+Number.EPSILON)*100)/100;};
  function combine(records){
    var out=[],map=new Map();
    records.forEach(function(r){(r.items||[]).forEach(function(raw){
      var it=Object.assign({},raw),historical=Number(it.costoTotalCompra||it.costoTotal||it.costo)||0;
      if(!(it.costoUnitarioCompra>0)&&historical>0&&it.qty>0)it.costoUnitarioCompra=historical/it.qty;
      delete it.costoTotal;delete it.costo;
      var key=JSON.stringify([it.productoFbKey||it.pid||it.cod,it.desc,it.punit,it.disc||0,it.costoUnitarioCompra||null,it.costoUnitario||null,it.unidad||'',it.origenCompra||'']);
      var old=map.get(key);if(old){old.qty+=Number(it.qty)||0;old.sub=round(old.qty*old.punit*(1-(old.disc||0)/100));}
      else{out.push(it);map.set(key,it);}
    });});out.forEach(function(it,index){it.orden=index+1;if(it.costoUnitarioCompra>0)it.costoTotalCompra=round(it.costoUnitarioCompra*it.qty);else if(it.costoTotalCompra)delete it.costoTotalCompra;});return out;
  }
  function scenario(items,choices,extra){
    if(!Number.isFinite(extra)||extra<0)throw Error('Revisá los gastos adicionales.');
    var base=choices.reduce(function(s,c){return s+(c.selected?c.cost*Number(items[c.index].qty):0);},0);
    if(extra>0&&!(base>0))throw Error('Seleccioná una alternativa para distribuir los gastos.');
    return items.map(function(item,i){var c=choices.find(function(c){return c.index===i&&c.selected;});if(!c)return Object.assign({},item);
      if(!(c.cost>0)||!Number.isFinite(c.markup)||c.markup<0||c.markup>500)throw Error('Revisá costo y porcentaje de venta.');
      var cost=c.cost*(1+(base>0?extra/base:0)),it=Object.assign({},item,{costoUnitarioCompra:cost,punit:round(cost*(1+c.markup/100)),origenCompra:'Paraguay',porcentajeVentaCompra:c.markup,monedaOriginal:'ARS'});
      delete it.costoTotalCompra;delete it.costoTotal;delete it.costo;delete it.costoUnitarioUSD;delete it.precioUsdOriginal;
      it.sub=round(it.qty*it.punit*(1-(it.disc||0)/100));return it;
    });
  }
  window.PropuestasComerciales={combine:combine,scenario:scenario};
  function money(v){return Number(v).toLocaleString('es-AR',{style:'currency',currency:'ARS'});}
  function el(tag,parent,text){var n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.appendChild(n);return n;}
  function dialog(title){var d=el('dialog',document.body);d.className='commercial-proposal-dialog';d.style.cssText='inset:0;margin:auto;width:min(1000px,94vw);max-height:90vh;overflow:auto;padding:24px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:16px';var header=el('div',d);header.className='proposal-header';el('h3',header,title);var close=el('button',header,'Cerrar');close.className='btn';close.onclick=function(){d.close();};d.addEventListener('close',function(){d.remove();});d.showModal();return d;}
  function permission(){return window.tienePermiso&&tienePermiso('presupuestos.crear');}
  function normalized(record){var fx=String(record.moneda||'ARS')==='USD'?Number(obtenerDolarReferenciaProducto().valor):1;if(!(fx>0))throw Error('Falta cotización del dólar');return (record.items||[]).map(function(x){var n=pptoNormalizarItemGuardado(x),cost=obtenerCostoUnitarioDetalleVenta(x);var out=Object.assign({},x,n,{monedaOriginal:'ARS',precioUsdOriginal:0,punit:round(n.punit*fx),sub:round(n.qty*n.punit*fx*(1-n.disc/100))});if(cost>0){out.costoUnitarioCompra=cost;delete out.costoTotalCompra;delete out.costoTotal;delete out.costo;delete out.costoUnitarioUSD;}return out;});}
  function prepare(source,items,sources,discount,title){
    if(!permission())throw Error('Sin permiso para crear presupuestos');
    var cliente=_svResolverClienteRegistro(source,true),copy=Object.assign({},source,{items:items,moneda:'ARS',descuentoGeneral:discount});
    if(window.svDrafts)svDrafts.flush();
    _cargarDuplicadoPresupuesto(copy,cliente);
    if(window.svDrafts)svDrafts.begin('presupuesto');
    if(typeof _pptoMonedaActual!=='undefined'&&_pptoMonedaActual==='USD')toggleMonedaPpto();
    // Reload ARS rows after resetting the editor currency, avoiding double conversion.
    pptoCargarItemsEnEditor(copy);
    document.getElementById('pp-titulo-solucion').value=title||source.tituloSolucion||'';
    var obs=document.querySelector('#ppto-form-view input[placeholder="Condiciones, notas..."]');if(obs)obs.value=(source.observaciones||'')+'\nOrigen: '+sources.join(', ');
    calcPpTotales();if(window.svDrafts)svDrafts.flush();
    notify('Nueva propuesta preparada. Revisá cliente, domicilio e importes y guardala como borrador.');
  }
  window.crearPropuestaExterior=function(record,initialExtra){
    if(!permission()||!tienePermiso('presupuestos.compararExterior')){notify('Sin permiso para esta acción');return;}
    try{
      var items=normalized(record),choices=[];var d=dialog('Nueva propuesta con compra en Paraguay');
      el('p',d,'Elegí alternativas vigentes. Las de stock no verificado requieren selección manual. Mano de obra y renglones sin alternativa se conservan. El porcentaje se aplica sobre el costo; los descuentos se mantienen.');
      var wrap=el('div',d);wrap.className='proposal-items';var table=el('table',wrap);table.style.width='100%';var head=el('tr',el('thead',table));['Usar','Producto','Costo ARS','% sobre costo'].forEach(function(t){el('th',head,t);});var body=el('tbody',table);
      items.forEach(function(it,index){var p=obtenerProductoPorCodigoVenta(it.cod,it);if(!p||esProductoManoDeObra(p))return;
        var offers=(p.proveedores||[]).filter(function(pv){return /Paraguay/i.test(origenProveedorProducto(pv).etiqueta)&&pv.disponibilidadProveedor!=='sin_stock'&&estadoVigenciaPrecioProveedor(p,pv).vigente;}).map(function(pv){return {cost:costoExteriorVigenteARS(pv)/metrosPorPresentacionProducto(p),stock:pv.disponibilidadProveedor};}).filter(function(c){return c.cost>0;}).sort(function(a,b){return a.cost-b.cost;});
        var tr=el('tr',body),check=el('input',el('td',tr));check.type='checkbox';check.checked=!!offers.length&&offers[0].stock==='disponible';check.disabled=!offers.length;el('td',tr,it.desc);el('td',tr,offers.length?money(offers[0].cost)+(offers[0].stock==='disponible'?'':' · stock no verificado'):'Sin alternativa vigente disponible');var input=el('input',el('td',tr));input.type='number';input.min='0';input.max='500';input.step='.1';input.className='search-input';input.style.width='100px';var markup=Number(p.margenDeseado);input.value=Number.isFinite(markup)?markup:margenProductoDefault();input.disabled=!offers.length;
        var c={index:index,cost:offers.length?offers[0].cost:0,selected:check.checked,markup:Number(input.value)};choices.push(c);check.onchange=function(){c.selected=check.checked;render();};input.oninput=function(){c.markup=Number(input.value);render();};
      });
      var label=el('label',d,'Flete y otros gastos ARS (distribuidos proporcionalmente): '),extra=el('input',label);extra.type='number';extra.min=0;extra.step='.01';extra.value=Math.max(0,Number(initialExtra)||0);extra.className='search-input';extra.oninput=render;
      var summary=el('p',d);summary.className='proposal-summary';summary.style.whiteSpace='pre-line';var button=el('button',d,'Preparar nuevo presupuesto');button.className='btn btn-primary';
      var discount=Number(record.descuentoGeneral??record.descuentoPct??record.descuento)||0;
      function totals(rows){var subtotal=round(rows.reduce(function(s,it){return s+round(it.qty*it.punit*(1-it.disc/100));},0));var net=round(subtotal-round(subtotal*discount/100));var model=pptoV3Invocar('form',[rows,discount,record.conIva!==false,21],null);if(model)net=Number(model.taxableBase);var costs=rows.map(function(it){return obtenerCostoUnitarioVenta(it.cod,it);});return {net:net,total:model?Number(model.total):round(net+(record.conIva===false?0:round(net*.21))),profit:costs.some(function(c){return !(c>0);})?null:round(net-costs.reduce(function(s,c,i){return s+c*rows[i].qty;},0))};}
      function render(){try{var next=scenario(items,choices,Number(extra.value)||0),a=totals(items),b=totals(next);summary.textContent='Total anterior: '+money(a.total)+' · Nuevo: '+money(b.total)+'\nAhorro cliente: '+money(a.total-b.total)+'\nGanancia Nixa anterior: '+(a.profit===null?'Costo incompleto':money(a.profit))+' · Nueva: '+(b.profit===null?'Costo incompleto':money(b.profit))+'\nMargen nuevo sobre venta neta: '+(b.profit!==null&&b.net>0?(b.profit/b.net*100).toFixed(1)+'%':'Sin dato');button.disabled=!choices.some(function(c){return c.selected;})||Number(extra.value)<0;}catch(e){summary.textContent=e.message;button.disabled=true;}}
      button.onclick=function(){try{if(!tienePermiso('presupuestos.compararExterior'))throw Error('Sin permiso');prepare(record,scenario(items,choices,Number(extra.value)||0),[record.id||'Presupuesto en preparación'],discount,record.tituloSolucion);d.close();}catch(e){notify(e.message);}};render();
    }catch(e){notify(e.message);}
  };
  window.combinarPresupuestos=function(){
    if(!permission()){notify('Sin permiso para crear presupuestos');return;}
    var source=buscarPptoPorRef(pptoActualId);if(!source)return;
    var d=dialog('Combinar presupuestos'),selected=new Set();el('p',d,'Se crea una propuesta nueva. Se suman renglones iguales; precios o descuentos distintos se conservan separados. Elegí cliente y domicilio en el editor antes de guardar.');
    var search=el('input',d);search.className='search-input';search.placeholder='Buscar presupuesto o cliente';var list=el('div',d);list.style.cssText='max-height:260px;overflow:auto';
    var discountLabel=el('label',d,'Descuento general del nuevo presupuesto (%): '),discount=el('input',discountLabel);discount.type='number';discount.min=0;discount.max=100;discount.value=0;discount.className='search-input';
    var title=el('input',d);title.className='search-input';title.placeholder='Título de la solución';title.value=source.tituloSolucion||'';
    var summary=el('p',d),button=el('button',d,'Preparar presupuesto combinado');button.className='btn btn-primary';
    function available(){return (pptoData||[]).filter(function(p){return (p.fbKey||p.id)!==(source.fbKey||source.id)&&p.estado!=='anulado';});}
    function render(){list.replaceChildren();var q=search.value.toLowerCase();available().filter(function(p){return (p.id+' '+p.cliente).toLowerCase().includes(q);}).forEach(function(p){var label=el('label',list);label.style.cssText='display:flex;gap:10px;padding:10px';var check=el('input',label);check.type='checkbox';check.checked=selected.has(p.fbKey);el('span',label,p.id+' · '+p.cliente+' · '+(p.items||[]).length+' renglones');check.onchange=function(){if(check.checked)selected.add(p.fbKey);else selected.delete(p.fbKey);summary.textContent=selected.size+' presupuestos adicionales seleccionados';};});}
    search.oninput=render;render();button.onclick=function(){try{var records=[source].concat(available().filter(function(p){return selected.has(p.fbKey);}));if(records.length<2)throw Error('Seleccioná otro presupuesto');var pct=Number(discount.value);if(!Number.isFinite(pct)||pct<0||pct>100)throw Error('Revisá el descuento general');if(records.some(function(p){return (p.conIva!==false)!==(source.conIva!==false);}))throw Error('Los presupuestos tienen distinto tratamiento de IVA. Revisalos antes de combinarlos.');prepare(source,combine(records.map(function(p){return {items:normalized(p)};})),records.map(function(p){return p.id;}),pct,title.value);d.close();}catch(e){notify(e.message);}};
  };
  setInterval(function(){var anchor=document.getElementById('ppto-det-meta');if(!anchor)return;var b=document.getElementById('ppto-combinar');if(!b){b=el('button',null,'Combinar presupuestos');b.id='ppto-combinar';b.className='btn btn-sm';b.type='button';b.onclick=window.combinarPresupuestos;anchor.after(b);}b.hidden=!permission();},1000);
})();
