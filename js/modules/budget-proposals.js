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
    var base=choices.reduce(function(s,c){return s+(c.selected&&c.useExterior!==false?c.cost*Number(items[c.index].qty):0);},0);
    if(extra>0&&!(base>0))throw Error('Seleccioná una alternativa para distribuir los gastos.');
    return items.map(function(item,i){var c=choices.find(function(c){return c.index===i;});if(c&&!c.selected)return null;if(!c||c.useExterior===false)return Object.assign({},item);
      if(!(c.cost>0)||!Number.isFinite(c.markup)||c.markup<0||c.markup>500)throw Error('Revisá costo y porcentaje de venta.');
      var cost=c.cost*(1+(base>0?extra/base:0)),it=Object.assign({},item,{costoUnitarioCompra:cost,punit:round(cost*(1+c.markup/100)),origenCompra:'Paraguay',porcentajeVentaCompra:c.markup,monedaOriginal:'ARS'});
      delete it.costoTotalCompra;delete it.costoTotal;delete it.costo;delete it.costoUnitarioUSD;delete it.precioUsdOriginal;
      it.sub=round(it.qty*it.punit*(1-(it.disc||0)/100));return it;
    }).filter(Boolean);
  }
  function origenExterior(record){
    var items=Array.isArray(record&&record.items)?record.items:[],paises=new Set(),cantidad=0;
    items.forEach(function(item){
      var origen=String(item&&item.origenCompra||'').trim();
      if(!(Number(item&&item.costoUnitarioCompra)>0)||!origen||/^(argentina|local|nacional)$/i.test(origen))return;
      cantidad++;
      paises.add(origen);
    });
    return {cantidad:cantidad,paises:Array.from(paises)};
  }
  function nuevaCotizacionAplicable(item,costoOferta){
    if(!(Number(costoOferta)>0)||origenExterior({items:[item]}).cantidad)return false;
    var costoActual=Number(item&&item.costoUnitarioCompra)||0;
    return !(costoActual>0)||Number(costoOferta)<costoActual;
  }
  function mejorOfertaParaguay(item,producto){
    if(!producto||esProductoManoDeObra(producto))return null;
    return (producto.proveedores||[]).filter(function(pv){
      return /Paraguay/i.test(origenProveedorProducto(pv).etiqueta)&&
        pv.disponibilidadProveedor!=='sin_stock'&&estadoVigenciaPrecioProveedor(producto,pv).vigente;
    }).map(function(pv){return {cost:costoExteriorVigenteARS(pv)/metrosPorPresentacionProducto(producto),stock:pv.disponibilidadProveedor};})
      .filter(function(oferta){return oferta.cost>0;}).sort(function(a,b){return a.cost-b.cost;})[0]||null;
  }
  function puedeMejorarValorParaguay(item,producto){var oferta=mejorOfertaParaguay(item,producto);return !!(oferta&&nuevaCotizacionAplicable(item,oferta.cost));}
  window.PropuestasComerciales={combine:combine,scenario:scenario,origenExterior:origenExterior,nuevaCotizacionAplicable:nuevaCotizacionAplicable,mejorOfertaParaguay:mejorOfertaParaguay,puedeMejorarValorParaguay:puedeMejorarValorParaguay,guardarCotizacionesEnPresupuesto:guardarCotizacionesEnPresupuesto};
  function money(v){return Number(v).toLocaleString('es-AR',{style:'currency',currency:'ARS'});}
  function el(tag,parent,text){var n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.appendChild(n);return n;}
  function dialog(title){var d=el('dialog',document.body);d.className='commercial-proposal-dialog';d.style.cssText='inset:0;margin:auto;width:min(1000px,94vw);max-height:90vh;overflow:auto;padding:24px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:16px';var header=el('div',d);header.className='proposal-header';el('h3',header,title);var close=el('button',header,'Cerrar');close.className='btn';close.onclick=function(){d.close();};windowControls(d,header,close);d.addEventListener('close',function(){d.remove();});d.showModal();return d;}
  function permission(){return window.tienePermiso&&tienePermiso('presupuestos.crear');}
  function windowControls(d,header,close){
    var max=el('button',null);max.type='button';max.className='btn';header.insertBefore(max,close);
    close.textContent='';close.innerHTML='<i class="ti ti-x" aria-hidden="true"></i>';close.title='Cerrar';close.setAttribute('aria-label','Cerrar');
    var expanded=false,saved='',drag=null;
    function label(){max.innerHTML='<i class="ti '+(expanded?'ti-arrows-minimize':'ti-maximize')+'" aria-hidden="true"></i>';max.title=expanded?'Restaurar':'Maximizar';max.setAttribute('aria-label',max.title);}
    max.onclick=function(){drag=null;if(!expanded){saved=d.style.cssText;d.style.inset='0';d.style.margin='0';d.style.width='100vw';d.style.height='100dvh';d.style.maxHeight='100dvh';d.style.maxWidth='100vw';d.style.borderRadius='0';}else d.style.cssText=saved;expanded=!expanded;label();};label();
    header.style.cursor='grab';header.style.touchAction='none';header.style.userSelect='none';header.querySelector('h3').style.flex='1';
    header.addEventListener('pointerdown',function(e){if(expanded||e.button!==0||e.target.closest('button'))return;var r=d.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top};d.style.inset='auto';d.style.margin='0';d.style.left=r.left+'px';d.style.top=r.top+'px';header.setPointerCapture(e.pointerId);e.preventDefault();});
    header.addEventListener('pointermove',function(e){if(!drag||drag.id!==e.pointerId)return;d.style.left=Math.max(0,Math.min(innerWidth-d.offsetWidth,e.clientX-drag.x))+'px';d.style.top=Math.max(0,Math.min(innerHeight-d.offsetHeight,e.clientY-drag.y))+'px';});
    ['pointerup','pointercancel','lostpointercapture'].forEach(function(event){header.addEventListener(event,function(){drag=null;});});
  }
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
  async function guardarCotizacionesEnPresupuesto(record,items,discount){
    if(!tienePermiso('presupuestos.editar')||!tienePermiso('presupuestos.compararExterior'))throw Error('Sin permiso para actualizar presupuestos');
    var vigente=buscarPptoPorRef(record.fbKey||record.id);
    if(!vigente||!vigente.fbKey)throw Error('No se encontró el presupuesto original');
    if(vigente.ventaId||vigente.ventaFbKey||vigente.estado==='convertido')throw Error('Este presupuesto ya pasó a venta y no puede actualizarse');
    var datosCalculo={items:items,descuentoGeneral:discount,conIva:vigente.conIva!==false,moneda:'ARS'};
    var model=pptoV3Invocar('fields',[datosCalculo],function(){
      var budget=window.SisVentas&&window.SisVentas.V3Budget;
      if(budget&&typeof budget.fields==='function')return budget.fields(datosCalculo);
      var filas=items.map(function(it){return Object.assign({},it,{sub:round(it.qty*it.punit*(1-(it.disc||0)/100))});});
      var subtotal=round(filas.reduce(function(sum,it){return sum+it.sub;},0));
      var descuentoAmt=round(subtotal*discount/100),base=round(subtotal-descuentoAmt);
      var iva=datosCalculo.conIva?round(base*.21):0;
      return {items:filas,subtotal:subtotal,descuentoAmt:descuentoAmt,iva:iva,total:round(base+iva)};
    });
    if(!model||!Array.isArray(model.items)||!Number.isFinite(Number(model.total)))throw Error('No se pudo conciliar el nuevo total');
    var ahora=new Date();
    var audit=(vigente.audit||[]).concat([{
      fecha:ahora.toLocaleDateString('es-AR')+' '+ahora.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}),
      usuario:typeof currentUser!=='undefined'&&currentUser||'Admin',
      accion:'Valores de Paraguay actualizados en '+(vigente.id||'presupuesto')+' sin crear copia'
    }]);
    var cambios={items:Array.from(model.items),subtotal:model.subtotal,descuentoAmt:model.descuentoAmt,
      iva:model.iva,total:model.total,moneda:'ARS',audit:audit,tsActualizacionValores:Date.now()};
    await pptoPersistirActualizar(vigente.fbKey,cambios);
    Object.assign(vigente,cambios);
    if(typeof verPpto==='function')verPpto(vigente.fbKey);
    notify('Valores actualizados en '+(vigente.id||'el presupuesto')+'. No se creó una copia.');
    return cambios;
  }
  window.crearPropuestaExterior=function(record,initialExtra,soloNuevas,actualizarMismo,soloItemIndex){
    actualizarMismo=actualizarMismo===true;
    if(!(actualizarMismo?tienePermiso('presupuestos.editar'):permission())||!tienePermiso('presupuestos.compararExterior')){notify('Sin permiso para esta acción');return;}
    try{
      soloNuevas=soloNuevas===true;
      soloItemIndex=Number.isInteger(soloItemIndex)?soloItemIndex:null;
      var items=normalized(record),choices=[];var d=dialog(actualizarMismo?'Actualizar valores de '+(record.id||'presupuesto'):soloNuevas?'Revisar nuevas cotizaciones de Paraguay':'Nueva propuesta con compra en Paraguay');
      el('p',d,actualizarMismo?soloItemIndex!==null?'Se actualiza este renglón en el mismo presupuesto, sin crear copias. Los demás valores se conservan. Revisá precio, total y stock antes de guardar.':'Se actualiza este mismo presupuesto, sin crear copias. Sólo se marcan automáticamente las cotizaciones nuevas de Paraguay que bajan el costo. Los demás renglones conservan costo, precio y descuento. Revisá el nuevo total, el porcentaje de venta y la disponibilidad antes de guardar.':soloNuevas?'Se prepara una nueva versión; '+(record.id||'el presupuesto original')+' no se modifica. Sólo se aplican por defecto las cotizaciones nuevas de Paraguay que bajan el costo. Los demás renglones conservan costo, precio y descuento. Revisá el porcentaje de venta y la disponibilidad antes de guardar.':'Todos los ítems están seleccionados. Desmarcá los que no necesitás. Sin alternativa de Paraguay se conservan costo, precio y descuentos originales, incluida la mano de obra. Las alternativas indican si su stock no está verificado.');
      var wrap=el('div',d);wrap.className='proposal-items';var table=el('table',wrap);table.style.width='100%';var head=el('tr',el('thead',table));[soloNuevas?'Actualizar':'Usar','Producto','Costo ARS','% sobre costo'].forEach(function(t){el('th',head,t);});var body=el('tbody',table);
      items.forEach(function(it,index){var p=obtenerProductoPorCodigoVenta(it.cod,it);
        var oferta=mejorOfertaParaguay(it,p),offers=oferta?[oferta]:[];
        var aplicar=offers.length>0&&(!soloNuevas||nuevaCotizacionAplicable(it,offers[0].cost))&&(soloItemIndex===null||soloItemIndex===index);
        var tr=el('tr',body),check=el('input',el('td',tr));if(soloItemIndex!==null&&soloItemIndex!==index)tr.hidden=true;check.type='checkbox';check.checked=soloNuevas?aplicar:true;check.disabled=soloNuevas&&(!offers.length||origenExterior({items:[it]}).cantidad>0||soloItemIndex!==null&&soloItemIndex!==index);check.setAttribute('aria-label',(soloNuevas?'Actualizar costo de ':'Incluir ')+it.desc);
        el('td',tr,it.desc);el('td',tr,offers.length?(soloItemIndex===index&&it.costoUnitarioCompra>0?'Actual: '+money(it.costoUnitarioCompra)+' · Nuevo: ':'')+money(offers[0].cost)+(offers[0].stock==='disponible'?'':' · stock no verificado')+(soloNuevas&&!aplicar?' · conserva valor anterior por defecto':''):(it.costoUnitarioCompra>0?money(it.costoUnitarioCompra)+' · ':'')+'Se conservan valores originales');var input=el('input',el('td',tr));input.type='number';input.min='0';input.max='500';input.step='.1';input.className='search-input';input.style.width='100px';var markup=Number(p&&p.margenDeseado);input.value=Number.isFinite(markup)?markup:margenProductoDefault();input.disabled=!aplicar;if(!offers.length)input.value='';
        var c={index:index,cost:offers.length?offers[0].cost:0,selected:true,useExterior:aplicar,markup:Number(input.value)};choices.push(c);check.onchange=function(){if(soloNuevas){c.useExterior=check.checked;input.disabled=!check.checked;}else c.selected=check.checked;render();};input.oninput=function(){c.markup=Number(input.value);render();};
      });
      var label=el('label',d,'Flete y otros gastos ARS (sólo entre ítems de Paraguay seleccionados): '),extra=el('input',label);extra.type='number';extra.min=0;extra.step='.01';extra.value=Math.max(0,Number(initialExtra)||0);extra.className='search-input';extra.oninput=render;
      var summary=el('p',d);summary.className='proposal-summary';summary.style.whiteSpace='pre-line';var button=el('button',d,actualizarMismo?'Guardar cambios en '+(record.id||'este presupuesto'):'Preparar nuevo presupuesto');button.className='btn btn-primary';
      var discount=Number(record.descuentoGeneral??record.descuentoPct??record.descuento)||0;
      function totals(rows){var subtotal=round(rows.reduce(function(s,it){return s+round(it.qty*it.punit*(1-it.disc/100));},0));var net=round(subtotal-round(subtotal*discount/100));var model=pptoV3Invocar('form',[rows,discount,record.conIva!==false,21],null);if(model)net=Number(model.taxableBase);var costs=rows.map(function(it){return obtenerCostoUnitarioVenta(it.cod,it);});return {net:net,total:model?Number(model.total):round(net+(record.conIva===false?0:round(net*.21))),profit:costs.some(function(c){return !(c>0);})?null:round(net-costs.reduce(function(s,c,i){return s+c*rows[i].qty;},0))};}
      function render(){try{var next=scenario(items,choices,Number(extra.value)||0),a=totals(items),b=totals(next);summary.textContent=(soloNuevas?'Nuevas cotizaciones aplicadas: '+choices.filter(function(c){return c.useExterior;}).length+'\n':'')+'Total anterior: '+money(a.total)+' · Nuevo: '+money(b.total)+'\n'+(choices.some(function(c){return !c.selected;})?'Diferencia total (incluye ítems quitados): ':'Ahorro cliente: ')+money(a.total-b.total)+'\nGanancia Nixa anterior: '+(a.profit===null?'Costo incompleto':money(a.profit))+' · Nueva: '+(b.profit===null?'Costo incompleto':money(b.profit))+'\nMargen nuevo sobre venta neta: '+(b.profit!==null&&b.net>0?(b.profit/b.net*100).toFixed(1)+'%':'Sin dato');button.disabled=!(soloNuevas?choices.some(function(c){return c.useExterior;}):choices.some(function(c){return c.selected;}))||Number(extra.value)<0;}catch(e){summary.textContent=e.message;button.disabled=true;}}
      button.onclick=async function(){button.disabled=true;try{if(!tienePermiso('presupuestos.compararExterior'))throw Error('Sin permiso');var next=scenario(items,choices,Number(extra.value)||0);if(actualizarMismo)await guardarCotizacionesEnPresupuesto(record,next,discount);else prepare(record,next,[record.id||'Presupuesto en preparación'],discount,soloNuevas?'Revisión de '+(record.id||'presupuesto')+' · '+(record.tituloSolucion||'Compra en Paraguay'):record.tituloSolucion);d.close();}catch(e){notify(e.message);}finally{if(d.open)render();}};render();
    }catch(e){notify(e.message);}
  };
  function combinable(p,source){
    if((p.fbKey||p.id)===(source.fbKey||source.id))return false;
    if(['anulado','convertido','rechazado','vencido'].includes(p.estado)||p.ventaId||p.ventaFbKey||pptoEstaVencidoParaActualizar(p))return false;
    var a=_svResolverClienteRegistro(source,true),b=_svResolverClienteRegistro(p,true);
    if(a&&b)return String(a.fbKey||a.id)===String(b.fbKey||b.id);
    var refs=function(r){return [r.clienteFbKey,r.clienteKey,r.clienteId,r.idCliente].filter(Boolean).map(String);};
    var ar=refs(source),br=refs(p);return ar.length>0&&br.some(function(k){return ar.includes(k);});
  }
  window.combinarPresupuestos=function(){
    if(!permission()){notify('Sin permiso para crear presupuestos');return;}
    var source=buscarPptoPorRef(pptoActualId);if(!source)return;
    var d=dialog('Combinar presupuestos'),selected=new Set();el('p',d,'Sólo presupuestos vigentes de ' + source.cliente + '. Se crea una propuesta nueva conservando los originales. Revisá el domicilio antes de guardar.');
    var search=el('input',d);search.className='search-input';search.placeholder='Buscar por número o título';var list=el('div',d);list.style.cssText='max-height:260px;overflow:auto';
    var fields=el('div',d);fields.className='proposal-combine-fields';
    var titleLabel=el('label',fields,'Título del nuevo presupuesto'),title=el('input',titleLabel);title.type='text';title.className='search-input';title.placeholder='Unión de presupuestos';title.value=source.tituloSolucion||'';
    var discountLabel=el('label',fields,'Descuento general del nuevo presupuesto (%)'),discount=el('input',discountLabel);discount.type='number';discount.min=0;discount.max=100;discount.value=0;discount.className='search-input';
    var summary=el('div',d);summary.className='proposal-summary proposal-combine-summary';
    var button=el('button',d,'Preparar presupuesto combinado');button.className='btn btn-primary';
    var titleEdited=false,discountEdited=false;
    title.oninput=function(){titleEdited=true;};discount.oninput=function(){discountEdited=true;updatePreview();};
    var discountNotice=el('p',discountLabel);discountNotice.className='proposal-discount-notice';
    function selectedRecords(){return [source].concat(available().filter(function(p){return selected.has(p.fbKey||p.id);}));}
    function updatePreview(){
      summary.replaceChildren();
      var records=selectedRecords(),value=discount.value.trim(),pct=Number(value);
      if(records.some(function(p){return (p.conIva!==false)!==(source.conIva!==false);})){
        el('strong',summary,'Los presupuestos seleccionados tienen distinto tratamiento de IVA.');button.disabled=true;return;
      }
      if(value===''||!Number.isFinite(pct)||pct<0||pct>100){
        el('strong',summary,'Indicá un descuento general entre 0% y 100% para ver el total.');button.disabled=true;return;
      }
      try{
        var items=combine(records.map(function(p){return {items:normalized(p)};}));
        var calculadora=window.SisVentas&&window.SisVentas.V3Budget;
        var model=calculadora&&typeof calculadora.form==='function'
          ? calculadora.form(items,pct,source.conIva!==false,21)
          : pptoV3Invocar('form',[items,pct,source.conIva!==false,21],null);
        if(!model||!Number.isFinite(Number(model.total)))throw Error('No se pudo calcular el total');
        el('div',summary,records.map(function(p){return p.id;}).join(' + ')).className='proposal-combine-references';
        var total=el('div',summary);total.className='proposal-combine-total';
        el('span',total,records.length<2?'Total del presupuesto actual':'Total estimado del nuevo presupuesto');el('strong',total,money(model.total));
        el('div',summary,'Subtotal de ítems: '+money(model.subtotal)+' · Descuento general '+pct+'%: -'+money(model.generalDiscount)+(model.includesIva?' · IVA: '+money(model.iva):' · Sin IVA')).className='proposal-combine-breakdown';
        button.disabled=records.length<2;
      }catch(e){el('strong',summary,e.message||'No se pudo calcular el total');button.disabled=true;}
    }
    function defaults(){
      var records=selectedRecords();
      if(!titleEdited)title.value='Unión de presupuestos '+records.map(function(p){return p.id;}).join(' y ');
      var discounts=records.map(function(p){return Number(p.descuentoGeneral??p.descuentoPct??p.descuento)||0;});
      var same=discounts.every(function(v){return v===discounts[0];});
      if(!discountEdited)discount.value=same?discounts[0]:'';
      discountNotice.textContent=same?'Descuento común: '+discounts[0]+'%. Podés editarlo.':'Los descuentos son distintos. Indicá el descuento general del nuevo presupuesto.';
      updatePreview();
    }
    function available(){return (pptoData||[]).filter(function(p){return combinable(p,source);});}
    function render(){
      list.replaceChildren();var q=search.value.toLocaleLowerCase();
      var rows=available().filter(function(p){return (p.id+' '+(p.tituloSolucion||'')).toLocaleLowerCase().includes(q);});
      if(!rows.length)el('p',list,'No hay otros presupuestos vigentes de este cliente que coincidan.');
      rows.forEach(function(p){
        var label=el('label',list);label.style.cssText='display:flex;align-items:center;gap:14px;padding:14px;margin:8px 0;border:1px solid var(--border);border-radius:10px;cursor:pointer';
        var key=p.fbKey||p.id,check=el('input',label);check.type='checkbox';check.checked=selected.has(key);
        var info=el('div',label);info.style.cssText='flex:1;min-width:0';el('strong',info,p.id+' · '+(p.tituloSolucion||'Sin título'));
        var detail=el('div',info,(p.items||[]).length+' ítems · Vence: '+(p.vence||p.vencimiento||'Sin fecha')+' · '+(typeof pptoEstadoLabel==='function'?pptoEstadoLabel(p.estado):p.estado||''));detail.style.cssText='font-size:12px;color:var(--text3);margin-top:5px';
        var value=el('strong',info,money(p.total)+' ARS');value.style.cssText='display:block;margin-top:6px;color:var(--text)';
        check.onchange=function(){if(check.checked)selected.add(key);else selected.delete(key);defaults();};
      });
    }
    search.oninput=render;render();defaults();button.onclick=function(){try{var records=[source].concat(available().filter(function(p){return selected.has(p.fbKey||p.id);}));if(records.length<2)throw Error('Seleccioná otro presupuesto');if(discount.value.trim()==='')throw Error('Indicá el descuento general');var pct=Number(discount.value);if(!Number.isFinite(pct)||pct<0||pct>100)throw Error('Revisá el descuento general');if(records.some(function(p){return (p.conIva!==false)!==(source.conIva!==false);}))throw Error('Los presupuestos tienen distinto tratamiento de IVA. Revisalos antes de combinarlos.');prepare(source,combine(records.map(function(p){return {items:normalized(p)};})),records.map(function(p){return p.id;}),pct,title.value);d.close();}catch(e){notify(e.message);}};
  };
  function marcarOrigenExterior(contenedor,record){
    if(!contenedor)return;
    var badge=contenedor.querySelector('.ppto-exterior-badge'),origen=origenExterior(record);
    if(!origen.cantidad){if(badge)badge.remove();return;}
    if(!badge){badge=el('span',contenedor);badge.className='ppto-exterior-badge';}
    var texto='Compra en '+origen.paises.join(' / ');
    var titulo=origen.cantidad+' '+(origen.cantidad===1?'ítem calculado':'ítems calculados')+' con costos de compra de '+origen.paises.join(', ');
    if(badge.textContent!==texto)badge.textContent=texto;
    if(badge.title!==titulo)badge.title=titulo;
  }
  setInterval(function(){
    var anchor=document.getElementById('ppto-det-meta');
    if(anchor){
      var b=document.getElementById('ppto-combinar');
      if(!b){b=el('button',null,'Combinar presupuestos');b.id='ppto-combinar';b.className='btn btn-sm';b.type='button';b.onclick=window.combinarPresupuestos;anchor.after(b);}
      b.hidden=!permission();
      if(typeof buscarPptoPorRef==='function'&&typeof pptoActualId!=='undefined')marcarOrigenExterior(document.getElementById('ppto-det-estado-badge'),buscarPptoPorRef(pptoActualId));
    }
    if(typeof pptoData!=='undefined'&&Array.isArray(pptoData)){
      var presupuestos=new Map(pptoData.map(function(p){return [String(p.fbKey||p.id||''),p];}));
      document.querySelectorAll('#ppto-tbody-main tr[data-ppto-ref]').forEach(function(row){
        marcarOrigenExterior(row.cells[0],presupuestos.get(row.dataset.pptoRef));
      });
    }
  },1000);
})();
