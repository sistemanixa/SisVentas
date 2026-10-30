(function(root){
  'use strict';
  const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
  const valid=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0;
  const copy=v=>JSON.parse(JSON.stringify(v));
  function localSavingsCard(value,rate){
    const amount=value?.savingARS,known=typeof amount==='number'&&Number.isFinite(amount),negative=known&&amount<0;
    const money=v=>Number(v).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
    return '<div class="ep-box ep-local-savings" style="margin-top:14px"><small>'+(negative?'Mayor costo frente a compra local':'Ahorro total frente a compra local')+'</small><strong style="display:block;font-size:24px;color:var(--'+(negative?'red':'green')+')">'+(known?'$ '+money(Math.abs(amount)):'Por completar')+'</strong>'+(known?(Number(rate)>0?'<small>USD '+money(Math.abs(amount)/Number(rate))+'</small>':'')+'<p>Costo local original menos costo final del exterior, incluidos los gastos.</p>':'<p>Falta el costo local original'+(Number(value?.missing)>0?' de '+Number(value.missing)+' productos':' o completar los costos del pedido')+'.</p>')+'</div>';
  }
  const travelKeys=['bus','tolls','flight','border','cargo','packARS','night','nights','airport','food','days','other'];
  const remoteLabels=[['logisticsARS','Logística'],['transportARS','Traslado'],['courierARS','Pasero']];
  const expenseFields=[...remoteLabels.map(([key])=>key),...travelKeys,'tripTotalARS','remoteTotalARS','tripDetailsVersion','pack'];
  const tripLabels=[['bus','Traslado MDP ↔ Buenos Aires'],['tolls','Peajes ida y vuelta'],['flight','Aéreo ida y vuelta'],['border','Iguazú ↔ Paraguay'],['airport','Aeropuerto ↔ hotel'],['cargo','Transporte de mercadería'],['packARS','Embalaje'],['night','Hotel por noche'],['food','Comida por día'],['other','Otros gastos']];
  function hasExpenses(p){return !!p&&(p.expensesInitialized===true||[...expenseFields,'shippingInsuredUSD','remoteOther'].some(k=>Object.hasOwn(p,k)));}
  function remoteTotal(p){if(remoteLabels.some(([key])=>Object.hasOwn(p,key))){const values=remoteLabels.map(([key])=>p[key]);return values.some(v=>v!==''&&v!=null&&!valid(v))?'':values.every(v=>v===''||v==null)?'':Math.round(values.reduce((sum,v)=>sum+num(v),0)*100)/100;}return Object.hasOwn(p,'remoteTotalARS')?p.remoteTotalARS:valid(p.shippingInsuredUSD)&&num(p.usd)>0?Math.round((num(p.shippingInsuredUSD)*num(p.usd)+num(p.remoteOther))*100)/100:'';}
  function tripTotal(p){
    let total=0,filled=false;
    for(const [key]of tripLabels){if(p[key]===''||p[key]==null)continue;filled=true;if(!valid(p[key]))return '';
      const quantity=key==='night'?(p.nights??1):key==='food'?(p.days??1):1;if(!valid(quantity))return '';total+=Number(p[key])*Number(quantity);
    }return filled?Math.round((total+Number.EPSILON)*100)/100:'';
  }
  function hasExpenseValues(p){return !!p&&[...remoteLabels.map(([key])=>key),...tripLabels.map(([key])=>key),'tripTotalARS','remoteTotalARS','shippingInsuredUSD','remoteOther','pack'].some(key=>valid(p[key]));}
  function previousExpenses(current,lists){
    const time=Number(current?.ts)||Date.parse(current?.fecha)||Date.now();
    const candidates=(lists||[]).filter(l=>l&&l.fbKey!==current?.fbKey&&!['anulada','cancelada','eliminada'].includes(l.estado)&&Number(l.ts||Date.parse(l.fecha))<time&&hasExpenseValues(l.simuladorParaguay?.parameters));
    candidates.sort((a,b)=>Number(b.ts||Date.parse(b.fecha))-Number(a.ts||Date.parse(a.fecha))||String(b.fbKey).localeCompare(String(a.fbKey)));
    const last=candidates[0];if(!last)return null;
    const p=last.simuladorParaguay.parameters,out={};for(const key of expenseFields)if(Object.hasOwn(p,key))out[key]=copy(p[key]);
    if(out.packARS===undefined&&valid(p.pack)&&num(p.usd)>0)out.packARS=num(p.pack)*num(p.usd);delete out.pack;
    out.remoteTotalARS=remoteTotal(p);
    return {listId:last.fbKey,label:last.numero||last.ventaId||'',parameters:out};
  }
  function productProviders(row,catalog){
    const product=(catalog||[]).find(p=>row.productKey?p.key===row.productKey:p.code===row.code);
    return (product?.providers||[]).filter((p,i,a)=>p.proveedorKey&&p.activo!==false&&a.findIndex(v=>v.proveedorKey===p.proveedorKey)===i);
  }
  function selectProvider(row,provider){
    row.providerKey=provider?.proveedorKey||'';row.provider=provider?.nombre||'';
    if(!provider){row.agreed='';return;}
    row.method=provider.exterior?'exterior':'local';row.include=!!provider.exterior;
    const amount=provider.exterior?num(provider.usd):num(provider.costo);
    row.reference={amount,currency:provider.exterior?'USD':'ARS',provider:row.provider,providerKey:row.providerKey,date:provider.actualizado||'',converted:!!provider.exterior&&!!provider.usdConverted};
    row.agreed=amount>0?Math.round(amount*100)/100:'';
    row.manualPrice=false;
  }
  function selectExterior(rows,catalog){
    let count=0;
    rows.forEach(row=>{
      const choices=productProviders(row,catalog).filter(p=>p.exterior&&p.disponible!==false);
      const selected=choices.find(p=>p.proveedorKey===row.providerKey)||choices[0];
      if(!selected)return;
      if(row.method!=='exterior'||row.providerKey!==selected.proveedorKey||!num(row.agreed))selectProvider(row,selected);
      row.method='exterior';row.include=true;count++;
    });return count;
  }
  function initialize(ctx,defaults={}){
    const saved=copy(ctx.saved||{}), own=hasExpenses(saved.parameters), prior=!own?ctx.previousExpenses:null, p=Object.assign({usd:defaults.usd||'',usdt:defaults.usdt||'',payment:'USD',usdtPerUsd:1,shippingInsuredUSD:defaults.shippingUSD??'',shippingMode:'insured',fee:0,remoteOther:0,balance:0,valuation:'current',allocation:'value',retained:'',extraLogisticsUSD:0},prior?.parameters||{},ctx.initial||{},saved.parameters||{});
    if(!ctx.closed){p.expensesInitialized=true;if(!own&&!prior)p.remoteTotalARS='';if(prior)p.expensesCopiedFrom=prior.listId;}
    const chosen=saved.previewChoice||saved.chosen||'remote';
    if(saved.version<6&&!saved.parameters?.payment){p.payment=chosen==='remote'?'USDT':'USD';if(p.shippingMode==='uninsured')p.shippingInsuredUSD=p.shippingUninsuredUSD;}
    const rows=(ctx.rows||[]).map(source=>{
      const prior=(saved.rows||[]).find(r=>r.key===source.key), r=Object.assign({},source,prior||{});
      if(prior&&saved.version<6&&prior.requestedQty==null&&valid(prior.qty))r.requestedQty=num(prior.qty);
      r.needed=num(source.needed??source.qty);r.existing=num(r.existing);r.qty=r.requestedQty==null?Math.max(0,r.needed-r.existing):num(r.requestedQty);
      r.baselineUnit=r.needed?num(source.baselinePart)/r.needed:0;
      r.baselinePart=r.qty*r.baselineUnit;r.sourceQty=source.sourceQty??source.qty;
      r.method=r.method||(r.qty===0&&r.existing?'stock':r.include?'exterior':'local');
      r.reference=r.reference||source.reference||{amount:r.originalUsd??source.usd,currency:source.include?'USD':'ARS',provider:source.provider,providerKey:source.providerKey,date:source.referenceDate||''};
      if(!source.include&&!r.reference.amount)r.reference.amount=source.localUnitARS||r.baselineUnit;
      r.agreed=r.agreed??(prior?(r.include?r.usd:r.localUnitARS??r.baselineUnit):'');
      if(ctx.catalog){
        const linked=productProviders(r,ctx.catalog);
        const pv=linked.find(p=>p.proveedorKey===r.providerKey)||linked.find(p=>p.proveedorKey===source.providerKey)||linked[0];
        if(pv&&r.method!=='stock'){
          const agreed=r.agreed,priorCurrency=prior?.reference?.currency||(prior?.method==='exterior'||prior?.include===true?'USD':'ARS');
          const manual=prior&&prior.providerKey===pv.proveedorKey&&priorCurrency===(pv.exterior?'USD':'ARS')&&num(agreed)>0&&(prior.manualPrice===true||num(agreed)!==num(prior.reference?.amount));
          // Older plans kept an exterior alternative on rows still purchased locally.
          // Preserve that choice and never relabel its peso amount as dollars.
          if(prior&&saved.version<6&&prior.include===false&&r.method==='local'&&pv.exterior){
            r.reference={amount:num(r.localUnitARS??r.baselineUnit),currency:'ARS',provider:r.provider,providerKey:r.providerKey};
            r.agreed=agreed;r.include=false;
          }else{const reference=prior?.providerKey===pv.proveedorKey&&prior.reference?.currency===(pv.exterior?'USD':'ARS')?copy(prior.reference):null;selectProvider(r,pv);if(reference){r.reference=reference;if(valid(agreed))r.agreed=agreed;}if(manual){r.agreed=agreed;r.manualPrice=true;}}
        }else if(!pv&&r.method!=='stock'){r.providerKey='';r.provider='';r.agreed='';}
      }
      if(valid(r.agreed))r.agreed=Math.round(num(r.agreed)*100)/100;
      r.providerOverride=true;
      return r;
    });
    const extras=(saved.extras||[]).map(r=>Object.assign(r,{method:r.method||'exterior',include:r.method!=='local',destination:'stock',agreed:r.agreed??r.usd,reference:r.reference||{amount:r.originalUsd??r.usd,currency:'USD',provider:r.provider,providerKey:r.providerKey}}));
    return {saved,parameters:p,rows,extras,chosen};
  }
  function calculateDraft(draft){
    const p=draft.parameters,rows=copy(draft.rows),extras=copy(draft.extras),pending=[];
    const chosen=draft.chosen;
    rows.concat(extras).forEach(r=>delete r.expenseExcluded);
    if(!['remote','onsite'].includes(chosen))pending.push('Elegir modalidad de entrega');
    ['usd','usdt','usdtPerUsd','shippingInsuredUSD','remoteOther','tripTotalARS','fee','extraLogisticsUSD'].forEach(k=>{if(p[k]!==undefined&&p[k]!==''&&!valid(p[k]))pending.push('Importe inválido: '+k);});
    rows.forEach(r=>{if(!['exterior','local','stock'].includes(r.method))pending.push('Elegir destino: '+r.description);if(!valid(r.existing))pending.push('Revisar stock: '+r.description);r.include=r.method==='exterior';r.existing=r.method==='stock'?num(r.needed):num(r.existing);r.qty=r.method==='stock'?0:r.requestedQty==null?Math.max(0,num(r.needed)-r.existing):num(r.requestedQty);if(r.qty+r.existing>num(r.needed)||!valid(r.requestedQty??r.qty))pending.push('Revisar cantidad: '+r.description);if(r.qty+r.existing<num(r.needed))pending.push('Cantidad pendiente: falta resolver '+(num(r.needed)-r.qty-r.existing).toLocaleString('es-AR')+' de '+num(r.needed).toLocaleString('es-AR')+': '+r.description);r.baselinePart=r.qty*num(r.baselineUnit);r.providerOverride=true;});
    extras.forEach(r=>{r.include=r.method!=='local';if(!r.include)r.usd=0;});
    const active=rows.filter(r=>r.include&&r.qty>0),buy=rows.filter(r=>r.qty>0).concat(extras),foreign=active.concat(extras.filter(r=>r.include)),hasForeign=foreign.length>0;
    buy.forEach(r=>{
      const ext=r.include;
      if(!r.providerKey)pending.push('Elegir proveedor: '+r.description);
      if(!valid(r.agreed)||num(r.agreed)<=0)pending.push('Confirmar precio acordado: '+r.description);
      if(!valid(r.agreed)&&r.agreed!=='')pending.push('Precio inválido: '+r.description);
      const price=valid(r.agreed)&&num(r.agreed)>0?num(r.agreed):r.reference?.currency===(ext?'USD':'ARS')?num(r.reference.amount):0;
      if(ext)r.usd=price;else r.localUnitARS=price;
      if(!valid(r.qty)||num(r.qty)<=0)pending.push('Revisar cantidad: '+r.description);
    });
    rows.forEach(r=>{if(!valid(r.existing)||r.existing>num(r.needed))pending.push('Revisar stock: '+r.description);});
    const hasStock=rows.some(r=>r.existing>0);
    if(!buy.length&&!hasStock)pending.push('Agregar productos al pedido');
    if(hasForeign&&!(num(p.usd)>0))pending.push('Cotización del dólar');
    const tokens=hasForeign&&p.payment==='USDT';
    if(tokens&&(!(num(p.usdt)>0)||!(num(p.usdtPerUsd)>0)))pending.push('Cotización y relación de pago USDT');
    const tokenTotal=foreign.reduce((sum,r)=>sum+num(r.qty)*num(r.usd),0)*num(p.usdtPerUsd)+num(p.fee);
    const used=tokens?Math.min(tokenTotal,num(p.balance)):0;
    if(tokens&&p.valuation==='historic'&&used>0&&!(num(p.historic)>0))pending.push('Costo histórico del saldo USDT');
    const tokenCost=tokens?(tokenTotal-used)*num(p.usdt)+used*(p.valuation==='historic'?num(p.historic):num(p.usdt)):0;
    const effectiveUSDT=tokenTotal?tokenCost/tokenTotal:num(p.usdt);
    const unitRate=tokens?effectiveUSDT*num(p.usdtPerUsd):num(p.usd);
    let logistics=0;
    if(hasForeign){
      if(chosen==='remote'&&(Object.hasOwn(p,'remoteTotalARS')||remoteLabels.some(([key])=>Object.hasOwn(p,key)))){if(!valid(remoteTotal(p)))pending.push('Completar gastos del pedido (0 si no corresponde)');logistics=num(remoteTotal(p));}
      else if(chosen==='remote'){
        if(!valid(p.shippingInsuredUSD))pending.push('Costo de envío (0 si no corresponde)');
        logistics=num(p.shippingInsuredUSD)*num(p.usd)+num(p.remoteOther);
      }else{
        if(!valid(p.tripTotalARS))pending.push('Costo total del viaje (0 si no corresponde)');
        logistics=num(p.tripTotalARS);
      }
      if(tokens){if(!valid(p.fee))pending.push('Comisión de pago USDT');logistics+=num(p.fee)*effectiveUSDT;}
    }
    const goods=active.reduce((s,r)=>s+r.qty*num(r.usd),0),allGoods=foreign.reduce((s,r)=>s+num(r.qty)*num(r.usd),0);
    const weights=foreign.map(r=>num(r.qty)*num(r.usd)),sum=weights.reduce((a,b)=>a+b,0);
    if(logistics>0&&!sum)pending.push('Elegir productos que participen en los gastos');
    let remaining=Math.round(logistics*100);const last=weights.reduce((a,w,i)=>w>0?i:a,-1);
    const costs=weights.map((w,i)=>{if(!w||!sum)return 0;const cents=i===last?remaining:Math.round(logistics*100*w/sum);remaining-=cents;return cents/100;});
    rows.forEach(r=>{const i=foreign.indexOf(r);r.unitCostARS=r.include?num(r.usd)*unitRate+(num(r.qty)?num(costs[i])/num(r.qty):0):num(r.localUnitARS);});
    const alloc=active.map((r,i)=>num(r.qty)*num(r.usd)*(unitRate-num(p.usd))+costs[i]);
    extras.forEach(r=>{const i=foreign.indexOf(r);r.unitCostARS=r.include?num(r.usd)*unitRate+(num(r.qty)?num(costs[i])/num(r.qty):0):num(r.localUnitARS);});
    const extraTotal=extras.reduce((s,r)=>s+num(r.qty)*num(r.unitCostARS),0)+num(p.extraLogisticsUSD)*num(p.usd);
    const total=goods*unitRate+costs.slice(0,active.length).reduce((a,b)=>a+b,0);
    const localCostAdjustment=rows.filter(r=>!r.include&&r.qty>0).reduce((s,r)=>s+r.qty*(num(r.localUnitARS)-num(r.baselineUnit)),0);
    const retained=Math.max(0,num(p.baseline)-active.reduce((s,r)=>s+r.baselinePart,0))+localCostAdjustment;
    const revenue=num(p.revenue),profit=revenue-retained-total;
    const result={goods,remote:total,onsite:total,remoteAllocation:alloc,onsiteAllocation:alloc,localCostAdjustment,travel:chosen==='onsite'?logistics:0,remoteExtra:total-goods*num(p.usd),onsiteExtra:total-goods*num(p.usd),extraTotal,orderTotal:total+rows.filter(r=>!r.include).reduce((s,r)=>s+r.qty*num(r.localUnitARS),0)+extraTotal,retained,profit,margin:revenue?profit/revenue*100:null,allGoods,logistics,usedUSDT:used,freshUSDT:tokens?tokenTotal-used:0};
    result.purchaseBreakdown=buy.map(r=>{const exterior=!!r.include,index=foreign.indexOf(r),quantity=num(r.qty),rate=exterior?unitRate:1,initial=r.reference?.currency===(exterior?'USD':'ARS')&&valid(r.reference?.amount)?Number(r.reference.amount):null,agreed=num(r.agreed),expenses=exterior?num(costs[index]):0,base=quantity*(exterior?num(r.usd)*rate:num(r.localUnitARS));return {productKey:r.productKey,code:r.code,description:r.description,quantity,currency:exterior?'USD':'ARS',initial,agreed,expenses,unitCost:quantity?(base+expenses)/quantity:0,total:base+expenses};});
    return {version:6,rows,extras,parameters:Object.assign({},p,{retained:'',goodsRate:unitRate}),chosen,previewChoice:chosen,choiceMode:'manual',result,complete:pending.length===0,pending,hasForeign};
  }
  function applySaleCosts(sale,rows,rate,costOfItem,income){
    const next=copy(sale),items=next.items||[];
    rows.forEach(r=>{
      if(r.destination==='stock')return;
      const index=Number(String(r.sourceLine??String(r.key||'').split('|')[1]??'').split(':').pop());
      const item=items[index],code=String(item?.cod||item?.codigo||'');
      if(!item||!r.code||code!==String(r.code))throw new Error('Cambió el detalle de la venta. Volvé a abrir la preparación.');
      const qty=num(item.qty??item.cantidad??item.cant);
      if(!qty||qty!==num(r.needed))throw new Error('Cambió la cantidad de la venta. Volvé a abrir la preparación.');
      if(num(item.cantidadCompraReal)>0)throw new Error('El producto ya tiene una recepción registrada. Revisá la compra antes de cambiar su costo.');
      if(r.method!=='stock'&&(!r.providerKey||!(num(r.agreed)>0)))throw new Error('Faltan proveedor o precio acordado: '+r.code);
      if(r.method==='exterior'&&!(num(rate)>0))throw new Error('Falta la cotización del dólar para actualizar la venta.');
      const original=num(item.costoUnitarioAntesPreparacion??item.costoCompraAnterior??item.costoUnitarioPresupuestado??(costOfItem(item)/qty));
      const purchased=r.method==='stock'?0:r.requestedQty==null?Math.max(0,qty-num(r.existing)):num(r.requestedQty);
      if(purchased+num(r.existing)>qty)throw new Error('La cantidad supera lo necesario para la venta. Agregá el excedente como extra para stock.');
      const existing=qty-purchased;
      const unit=r.unitCostARS!=null&&r.unitCostARS!==''?num(r.unitCostARS):r.method==='exterior'?num(r.agreed)*num(rate):num(r.agreed);
      if(r.method!=='stock'&&!(unit>0))throw new Error('Falta el costo final acordado: '+r.code);
      item.costoUnitarioAntesPreparacion=original;
      item.preparacionCompra={cantidadStock:existing,costoStockUnitario:original,cantidadComprar:purchased,costoCompraUnitario:unit};
      item.costoTotalCompra=Math.round((existing*original+(qty-existing)*unit)*100)/100;
      item.costoUnitarioCompra=item.costoTotalCompra/qty;
      delete item.costoUnitarioUSD;
      item.proveedorCompra=r.method==='stock'?'Stock disponible':r.provider;
      item.proveedorCompraKey=r.method==='stock'?'':r.providerKey;
      item.origenCompra=r.method==='exterior'?'Exterior':r.method==='stock'?'Stock':'Local';
      if(r.method==='exterior')item.compraExteriorAplicada={origen:'preparacion',proveedor:r.provider,proveedorKey:r.providerKey,cantidad:purchased,cantidadStock:num(r.existing),cantidadPendiente:Math.max(0,qty-purchased-num(r.existing)),precioUnitarioUSD:num(r.agreed),cotizacion:num(rate)};
      else delete item.compraExteriorAplicada;
      item.precioAcordadoCompra=r.method==='stock'?original:num(r.agreed);
      item.monedaCompra=r.method==='exterior'?'USD':'ARS';
      item.cotizacionCompra=r.method==='exterior'?num(rate):1;
    });
    next.costoTotal=items.reduce((sum,item)=>sum+num(costOfItem(item)),0);
    const revenue=num(income(next));next.margenPct=revenue?(revenue-next.costoTotal)/revenue*100:0;
    return next;
  }
  function priceDifference(row){
    const currency=row.method==='exterior'?'USD':'ARS';
    const qty=purchaseQuantity(row),ref=row.reference;
    if(row.method==='stock'||!qty)return null;
    if(!ref||ref.currency!==currency||!row.providerKey||ref.providerKey!==row.providerKey||!valid(ref.amount)||num(ref.amount)<=0||!valid(row.agreed)||num(row.agreed)<=0)return null;
    const original=num(ref.amount),agreed=num(row.agreed);
    return {currency,original,agreed,quantity:qty,difference:Math.round((original-agreed)*qty*100)/100};
  }
  function priceDifferenceTotals(draft){
    const result={USD:0,ARS:0,missing:0};
    [...draft.rows,...draft.extras].forEach(row=>{if(row.method==='stock'||!purchaseQuantity(row))return;const delta=priceDifference(row);if(!delta){result.missing++;return;}result[delta.currency]=Math.round((result[delta.currency]+delta.difference)*100)/100;});
    return result;
  }
  function agreedSummary(draft){
    const p=draft.parameters;let total=0,delta=0,missing=false,foreignUSD=0,localARS=0,quantityPending=false;
    [...draft.rows,...draft.extras].forEach(r=>{
      const extra=r.destination==='stock',qty=extra?num(r.qty):r.method==='stock'?0:r.requestedQty==null?Math.max(0,num(r.needed)-num(r.existing)):num(r.requestedQty);
      const ext=r.method==='exterior';
      if(!extra&&r.method!=='stock'&&qty+num(r.existing)!==num(r.needed))quantityPending=true;
      if(!qty)return;
      if(!num(r.agreed)||(ext&&!num(p.usd))){missing=true;return;}
      const unit=num(r.agreed)*(ext?num(p.usd):1);total+=qty*unit;if(ext)foreignUSD+=qty*num(r.agreed);else localARS+=qty*unit;
      if(!extra)delta+=qty*(num(r.baselineUnit)-unit);
    });
    const before=num(p.revenue)-num(p.baseline);
    return {ars:total,usd:num(p.usd)?total/num(p.usd):null,usdt:num(p.usdt)?total/num(p.usdt):null,before,after:before+delta,missing,foreignUSD,localARS,quantityPending};
  }
  function purchaseGroups(rows){
    return [['exterior','Compra exterior'],['local','Compra local'],['stock','Stock disponible']].map(([method,title])=>({method,title,items:rows.map((row,index)=>({row,index})).filter(({row})=>row.method===method)})).filter(group=>group.items.length);
  }
  function equivalentAmount(value,currency,rate){
    if(!valid(value)||!num(rate))return null;
    return {currency:currency==='USD'?'ARS':'USD',amount:currency==='USD'?num(value)*num(rate):num(value)/num(rate)};
  }
  function providerLink(row,catalog,masters){
    if(!row.providerKey||row.method==='stock')return null;
    const product=(catalog||[]).find(p=>(row.productKey&&p.key===row.productKey)||(row.code&&p.code===row.code));
    const linked=(product?.providers||[]).find(p=>p.proveedorKey===row.providerKey);
    const master=(masters||[]).find(p=>p.proveedorKey===row.providerKey);
    for(const [value,label] of [[linked?.url,'Web del producto'],[master?.web,'Web del proveedor']]){
      try{const url=new URL(value);if(/^https?:$/.test(url.protocol)&&!url.username&&!url.password)return {url:url.href,label};}catch(_){}
    }
    return null;
  }
  function purchaseQuantity(r){return r.method==='stock'?0:r.destination==='stock'?num(r.qty):r.requestedQty==null?Math.max(0,num(r.needed)-num(r.existing)):num(r.requestedQty);}
  function pdfRows(draft){return [...draft.rows,...draft.extras].filter(r=>purchaseQuantity(r)>0).map(r=>({...r,usd:r.agreed,currency:r.method==='exterior'?'USD':'ARS'}));}
  function revisePDF(draft,changes){
    const next=copy(draft),rows=[...next.rows,...next.extras],seen=new Set();
    if(!changes.length)throw Error('Marcá al menos un precio revisado.');
    changes.forEach(c=>{const r=rows.find(r=>r.key===c.key),currency=r?.method==='exterior'?'USD':'ARS';
      if(!r||r.method==='stock'||!purchaseQuantity(r)||seen.has(c.key)||String(r.agreed)!==String(c.before)||c.currency!==currency)throw Error('La preparación cambió. Volvé a analizar el comprobante.');
      if(typeof c.after!=='number'||!Number.isFinite(c.after)||c.after<=0)throw Error('Precio revisado inválido');seen.add(c.key);r.agreed=c.after;r.manualPrice=true;
    });return next;
  }
  function orderForExport(draft,title='Pedido de compra',catalog=[]) {
    const rows=[...(draft.rows||[]),...(draft.extras||[])].filter(r=>r.method!=='stock').map(r=>{
      const quantity=r.destination==='stock'?r.qty:r.requestedQty??Math.max(0,Number(r.needed)-Number(r.existing));
      if(!valid(quantity))throw Error('Revisá la cantidad de '+(r.code||r.description)+'.');
      const products=(catalog||[]).filter(p=>r.productKey?p.key===r.productKey:p.code===r.code);
      const candidates=products.length===1?(products[0].providers||[]).filter(p=>p.activo!==false&&p.proveedorKey===r.providerKey):[];
      const linked=candidates.length===1?candidates[0]:null;
      return {code:r.code||'',name:r.description||'',productUrl:linked?.url||'',extra:r.destination==='stock',quantity:Number(quantity),providerId:r.providerKey||'',provider:r.provider||'',currency:r.method==='exterior'?'USD':'ARS',unitPrice:valid(r.agreed)&&Number(r.agreed)>0?Number(r.agreed):null,priceKind:'agreed'};
    }).filter(r=>r.quantity>0);
    return {title,usdDecimals:2,rows};
  }
  const api={previousExpenses,remoteTotal,tripTotal,hasExpenses,priceDifference,priceDifferenceTotals,orderForExport,pdfRows,revisePDF,purchaseGroups,equivalentAmount,initialize,calculateDraft,providerLink,agreedSummary,applySaleCosts,productProviders,selectProvider,selectExterior};
  if(typeof module!=='undefined')module.exports=api;
  if(!root.document)return;
  root.SVExteriorPreparation=api;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>(Number(v)||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
  api.open=async function(ctx){
    if(!root.permisoModulo?.('balancecompra'))return;
    const quote=ctx.closed?{}:root.obtenerDolarReferenciaProducto?.()||{};const defaults={usd:quote.valor,usdt:ctx.closed?'':ctx.rates?.().usdt||''};
    const d=initialize(ctx,defaults);const frozen=!!ctx.closed;
    if(frozen){d.rows=copy(ctx.saved.rows||[]);d.extras=copy(ctx.saved.extras||[]);d.parameters=copy(ctx.saved.parameters||{});}
    if(!frozen&&(!ctx.saved?.parameters||d.parameters.usdMode!=='manual'))d.parameters.usd=num(quote.valor)||d.parameters.usd;
    if(d.parameters.packARS===undefined&&d.parameters.pack!==undefined)d.parameters.packARS=num(d.parameters.pack)*num(d.parameters.usd);
    if(!frozen&&d.parameters.tripTotalARS===undefined)d.parameters.tripTotalARS=tripTotal(d.parameters);
    const stockOnly=ctx.stockOnly===true;
    let tab='products',renderedTab='',dirty=false,busy=false,status='',searchTerm='',searchExpanded=false,extraSequence=0,layout='list';
    function editState(){
      const row=r=>[r.productKey,r.providerKey,r.method,num(r.agreed),r.method==='stock'?0:num(r.requestedQty??r.qty),num(r.existing)];
      const parameters=Object.keys(d.parameters).sort().map(k=>[k,valid(d.parameters[k])?Number(d.parameters[k]):d.parameters[k]]);
      return JSON.stringify([d.rows.map(row),d.extras.map(row),parameters,d.chosen]);
    }
    let cleanState=editState(),pdfUI=null;
    function refreshSaveState(){
      dirty=editState()!==cleanState;
      const review=calculateDraft(d),used={};d.rows.forEach(r=>{const key=r.productKey||r.code;used[key]=num(used[key])+(r.method==='stock'?num(r.needed):num(r.existing));});const canReview=review.complete&&!d.rows.some(r=>num(used[r.productKey||r.code])>num(ctx.available?.(r)));
      frame.querySelectorAll('[data-next],[data-tab="summary"]').forEach(b=>{b.disabled=busy||(!frozen&&!canReview);b.title=canReview?'Ver resumen del pedido':review.pending[0]||'Revisar stock disponible';});
      const button=frame.querySelector('[data-save]');
      const needsApply=!d.saved.exteriorAppliedAt && [...d.rows,...d.extras].some(r=>r.method==='exterior');
      const apply=frame.querySelector('[data-apply-exterior]');
      if(apply){apply.disabled=busy||frozen||![...d.rows,...d.extras].some(r=>r.method==='exterior'&&num(r.requestedQty??r.qty)>0);apply.textContent=busy?'Aplicando…':'Aplicar compra exterior';}
      if(button){button.disabled=busy||(!dirty&&!needsApply);button.textContent=busy?'Guardando y aplicando…':'Guardar y aplicar';button.classList.toggle('ep-save-ready',dirty&&!busy);button.setAttribute('aria-busy',String(busy));}
    }
    const priorFocus=document.activeElement;
    const owner=String(root.currentUserUid||'');
    const el=document.createElement('section');el.id='py-planner';el.dataset.svEscapeOwner='';el.className='ep-modal ep-list';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Preparar compra');
    document.getElementById('py-planner')?.remove();document.body.appendChild(el);
    const style=document.createElement('style');style.textContent=`.ep-trip-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}@media(max-width:600px){.ep-trip-fields{grid-template-columns:1fr}}

      .ep-product-links{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:7px}.ep-product-links button{border:0;background:none;padding:0;color:var(--blue);font:inherit;font-size:12px;text-decoration:underline;cursor:pointer}.ep-modal{position:fixed;inset:12px;z-index:11000;background:var(--bg,#0c1422);color:var(--text);border:1px solid var(--border2);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 80px #0008}.ep-modal *{box-sizing:border-box}.ep-head,.ep-foot{padding:16px 22px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--bg2);border-bottom:1px solid var(--border)}.ep-head h2{font-size:20px;margin:0}.ep-head small{display:block;margin-top:5px;color:var(--text3)}.ep-head>div{flex:1}.ep-head .ep-head-total{flex:0 0 auto;text-align:right}.ep-head-total strong{display:block;margin-top:4px;color:var(--green)}.ep-head-total button{margin-bottom:6px}.ep-profit{display:flex;justify-content:center;gap:24px;text-align:center;flex:1}.ep-profit span{font-size:11px;color:var(--text3)}.ep-profit strong{display:block;font-size:17px;color:var(--green);margin-top:5px}@media(max-width:760px){.ep-profit{flex-basis:100%;order:-1}.ep-head .ep-head-total{width:100%}}.ep-tabs{display:flex;gap:8px;padding:12px 22px;background:var(--bg2)}.ep-tabs button[aria-selected=true]{color:var(--green);background:var(--green-bg);border-color:var(--green)}.ep-body{overflow:auto;min-height:0;flex:1;padding:18px 22px}.ep-foot{border-top:1px solid var(--border);border-bottom:0;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}.ep-foot-actions{display:flex;justify-content:flex-end;gap:8px}.ep-profit{grid-column:2;justify-self:center;align-items:center}.ep-profit .ep-profit-arrow{font-size:24px;color:var(--text3)}.ep-profit small{display:block;font-size:10px;margin-top:4px;white-space:nowrap}.ep-foot [data-save]:disabled{opacity:.4;cursor:default}.ep-foot .ep-save-ready{border-color:var(--green);color:var(--green);background:var(--green-bg)}@media(max-width:1100px){.ep-foot{grid-template-columns:1fr}.ep-profit{grid-column:1;grid-row:1}.ep-foot-actions{justify-content:flex-end;justify-self:end}.ep-foot [role=status]:empty{display:none}}.ep-foot [role=status]{flex:1;font-size:12px;color:var(--text3)}.ep-modal .btn-primary{background:var(--green-bg);color:var(--green);border:1px solid var(--green)}.ep-card{display:grid;grid-template-columns:minmax(230px,1.6fr) 65px minmax(105px,.7fr) minmax(130px,.8fr) minmax(110px,.7fr) minmax(180px,1fr);gap:14px;padding:12px 16px;margin-bottom:10px;border:1px solid var(--border);border-radius:13px;background:var(--bg2);align-items:center}.ep-product{display:flex;gap:12px;align-items:center}.ep-search-result{width:100%;text-align:left;margin:0;padding:10px;border-radius:0;white-space:normal}.ep-search-result+.ep-search-result{border-top:0}.ep-search-copy{flex:1;min-width:0}.ep-search-result strong{font-size:12px}.ep-search-age{font-size:9px;margin-top:3px}.ep-search-detail{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}.ep-search-price{flex:none;text-align:right;font-size:12px}.ep-search-price small{display:block}.ep-search-price .badge{font-size:9px}@media(max-width:600px){.ep-search-result{flex-wrap:wrap}.ep-search-price{margin-left:64px;text-align:left}}.ep-product img{width:52px;height:52px;object-fit:contain;border-radius:9px;background:white}.ep-product strong{font-size:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.ep-price{display:flex;gap:5px}.ep-price input{flex:1}.ep-price button{flex:none}.ep-modal small{color:var(--text3);font-size:11px;line-height:1.5}.ep-card small{display:block}.ep-modal label{display:flex;flex-direction:column;gap:7px;font-size:12px;color:var(--text2)}.ep-modal input,.ep-modal select{width:100%;min-width:0;min-height:38px}.ep-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ep-row>*{flex:1}.ep-options{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;border-top:1px solid var(--border);padding-top:10px}.ep-box{border:1px solid var(--border);background:var(--bg2);border-radius:12px;padding:18px;margin-bottom:14px}.ep-box h3{margin:0 0 14px;font-size:16px}.ep-box p{line-height:1.5;color:var(--text2)}.ep-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}.ep-metric{padding:18px;background:var(--bg3);border-radius:12px}.ep-metric strong{display:block;font-size:24px;margin-top:8px;color:var(--green)}.ep-warning{color:var(--amber)!important}.ep-modal details>summary{cursor:pointer}.ep-modal [hidden]{display:none!important}@media(max-width:1100px){.ep-card{grid-template-columns:1fr 1fr}.ep-product{grid-column:1/-1}.ep-options{grid-template-columns:1fr 1fr}}@media(max-width:600px){.ep-modal{inset:0;border-radius:0}.ep-head,.ep-foot,.ep-tabs{padding:12px}.ep-body{padding:12px}.ep-head h2{font-size:17px}.ep-card{gap:12px;padding:12px}.ep-options,.ep-metrics{grid-template-columns:1fr}.ep-tabs .btn{flex:1;padding:8px 4px;font-size:12px}.ep-foot .btn{flex:1}.ep-foot [role=status]{flex-basis:100%}}
      .ep-foot{grid-template-columns:minmax(0,1fr) auto;column-gap:32px}.ep-foot>.ep-profit{grid-column:1;grid-row:1;justify-self:start;justify-content:flex-start;min-width:0}.ep-foot>.ep-foot-actions{grid-column:2;grid-row:1;justify-self:end}.ep-foot>[role=status]{grid-column:1/-1;grid-row:2}.ep-foot>[role=status]:empty{display:none}.ep-profit>span{max-width:285px}.ep-foot-actions .btn{white-space:nowrap}.ep-purchase-group>h3{margin:20px 0 12px;font-size:16px}.ep-purchase-group>h3 small{display:inline;font-weight:400;margin-left:8px}
      @media(max-width:1100px){.ep-foot{grid-template-columns:minmax(0,1fr)}.ep-foot>.ep-profit{grid-column:1;grid-row:1}.ep-foot>.ep-foot-actions{grid-column:1;grid-row:2}.ep-foot>[role=status]{grid-row:3}.ep-profit>span{max-width:240px}}@media(max-width:600px){.ep-foot{column-gap:12px}.ep-profit{gap:12px}.ep-profit small{white-space:normal}.ep-foot-actions{flex-wrap:wrap}.ep-foot-actions .btn{white-space:normal}}
      .ep-modal .oc-product-thumb,.ep-modal .oc-product-thumb *{overscroll-behavior:auto!important}.ep-modal .oc-product-thumb{overflow:clip!important}.ep-modal .oc-product-thumb img{width:100%;height:100%;max-width:100%;max-height:100%}
      .ep-profit>span{min-width:0}.ep-product-toolbar{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap}.ep-view-switch{display:flex;gap:4px;margin-left:auto}.ep-view-switch .btn{font-size:12px;min-height:36px;padding:6px 10px}.ep-view-switch [aria-pressed=true]{border-color:var(--green);color:var(--green);background:var(--green-bg)}.ep-code{display:block!important;color:var(--blue)!important;font-size:11px;font-weight:600;margin-bottom:3px}.ep-remove{justify-self:end;color:var(--text3);font-size:12px;min-height:36px}.ep-card{position:relative}.ep-card>.ep-remove{grid-column:-2/-1}.ep-reference-details{display:none}.ep-list .ep-reference-details{display:block}.ep-list .ep-reference{display:none}.ep-product>div{min-width:0}
      .ep-list .ep-card{grid-template-columns:minmax(180px,1.6fr) 60px minmax(110px,.8fr) minmax(100px,.7fr) minmax(150px,1fr) 52px;gap:6px 10px;padding:8px 12px;margin-bottom:6px;border-radius:9px}.ep-list .ep-product{gap:8px;grid-column:auto}.ep-list .ep-product strong{font-size:12px;-webkit-line-clamp:2;line-height:1.35}.ep-list .oc-product-thumb{width:32px!important;height:32px!important;flex-basis:32px!important;border-radius:6px!important}.ep-list .ep-card label{gap:3px;font-size:11px}.ep-list .ep-card input,.ep-list .ep-card select{min-height:34px;padding:5px 8px;font-size:12px}.ep-list .ep-card>.ep-total>small:not(:first-child),.ep-list .ep-card>.ep-agreed>small{display:none}.ep-list .ep-product-links{margin-top:3px;gap:6px}.ep-list .ep-product-links a,.ep-list .ep-product-links button{font-size:10px!important}.ep-list .ep-total strong{font-size:12px}.ep-list .ep-options{gap:10px}.ep-list .ep-purchase-group>h3{margin:12px 0 8px;font-size:14px}
      @media(max-width:900px){.ep-list .ep-card{grid-template-columns:minmax(160px,1.4fr) 58px minmax(110px,.8fr) minmax(100px,.7fr) 52px}.ep-list .ep-provider{grid-column:1/5;grid-row:2;display:flex;gap:12px;align-items:center}.ep-list .ep-provider>label{flex:1;max-width:320px}.ep-list .ep-card>.ep-remove{grid-column:5;grid-row:2}.ep-list .ep-provider .ep-product-links{flex:1;max-width:300px}}
      @media(max-width:760px){.ep-product-toolbar{gap:6px}.ep-view-switch .btn{min-height:38px}.ep-list .ep-card{grid-template-columns:70px minmax(0,1fr) minmax(0,1fr);gap:8px;padding:10px}.ep-list .ep-product{grid-column:1/-1;grid-row:1}.ep-list .ep-card input,.ep-list .ep-card select{min-height:38px}.ep-list .ep-provider{grid-column:1/3;grid-row:auto;display:block}.ep-list .ep-provider .ep-product-links{margin-top:6px}.ep-list .ep-card>.ep-remove{grid-column:3;grid-row:auto;align-self:start;margin-top:16px;min-height:38px}.ep-card>.ep-remove{grid-column:2}.ep-profit>span:not(:only-child) strong{display:block;margin-left:0;font-size:13px}.ep-profit>span:not(:only-child) small{display:block;margin-left:0}.ep-list .ep-code{margin-bottom:1px}.ep-list .ep-card small{font-size:10px}}
      .ep-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px 18px;padding:10px 18px;flex:none;align-items:center}
      .ep-head h2{font-size:17px;line-height:1.3}.ep-head small{margin-top:2px}.ep-head>div{min-width:0}.ep-head .ep-head-total{width:auto;text-align:right;position:relative}
      .ep-head-total>summary{position:relative;padding-right:12px;cursor:pointer;list-style:none;font-size:11px;color:var(--text3)}.ep-head-total>summary::-webkit-details-marker{display:none}.ep-head-total>summary:after{content:' ▾';position:absolute;right:0;top:0}.ep-head-total .ep-head-currencies{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:2px 8px;margin-top:2px;color:var(--text2)}.ep-head-currencies span{white-space:nowrap}.ep-head-total strong{display:inline;margin:0 0 0 8px;font-size:16px}.ep-head-total>div{position:absolute;right:0;top:100%;width:280px;max-width:calc(100vw - 48px);padding:12px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;box-shadow:0 8px 24px #0006;z-index:5;text-align:right}
      .ep-tabs{padding:6px 18px;gap:6px;align-items:center;flex-wrap:wrap;flex:none}.ep-tabs>.btn{min-height:34px;padding:6px 10px;font-size:12px}.ep-export-menu{margin-left:auto;position:relative}.ep-export-menu>summary{font-size:12px;cursor:pointer;padding:8px;list-style:none;color:var(--text2)}.ep-export-menu>summary:after{content:' ▾'}.ep-export-menu>summary::-webkit-details-marker{display:none}.ep-export-menu [data-order-tools]{position:absolute;right:0;top:100%;width:320px;max-width:calc(100vw - 48px);padding:12px;background:var(--bg2);border:1px solid var(--border2);border-radius:10px;box-shadow:0 8px 24px #0006;z-index:5}.ep-export-menu [data-order-tools] .btn{min-height:38px}.ep-head-total>summary:focus-visible,.ep-export-menu>summary:focus-visible{outline:2px solid var(--blue);outline-offset:3px;border-radius:4px}
      .ep-foot{padding:8px 18px;gap:6px 18px;grid-template-columns:minmax(0,1fr) auto;flex:none}.ep-foot>.ep-foot-actions{grid-column:2;grid-row:1;align-self:center}.ep-foot>.ep-profit{grid-column:1;grid-row:1;gap:14px;text-align:left}.ep-profit strong{font-size:16px;margin-top:1px;white-space:nowrap}.ep-profit>span:only-child{max-width:none}.ep-profit>span:only-child strong{display:inline;margin-left:8px}.ep-profit small{margin-top:0}.ep-foot-actions .btn{min-height:36px;padding:7px 10px;font-size:12px}.ep-foot>[role=status]{grid-column:1/-1;grid-row:2}
      @media(max-width:760px){.ep-head{padding:8px 12px;gap:6px 10px;grid-template-columns:auto minmax(0,1fr)}.ep-head h2{font-size:16px}.ep-head>button{grid-column:1;grid-row:1}.ep-head-currencies{justify-content:flex-start!important}.ep-head .ep-head-total{grid-column:1/-1;text-align:left;justify-self:start}.ep-head-total>div{left:0;right:auto;text-align:left}.ep-tabs{padding:4px 12px}.ep-tabs>.btn{flex:0 1 auto;min-height:38px;padding:7px 9px}.ep-export-menu>summary{min-height:38px;display:flex;align-items:center;padding:7px 0}.ep-foot{padding:8px 12px;gap:6px 12px}.ep-foot>.ep-profit{gap:10px}.ep-profit>span{max-width:none}.ep-profit strong{font-size:15px}.ep-profit small{white-space:normal}.ep-foot-actions{gap:6px;flex-wrap:nowrap}.ep-foot-actions .btn{min-height:40px;padding:7px 9px}.ep-profit .ep-profit-arrow{font-size:18px}}
      @media(max-width:600px){.ep-foot{grid-template-columns:1fr}.ep-foot>.ep-foot-actions{grid-column:1;grid-row:2;justify-self:stretch}.ep-foot>[role=status]{grid-row:3}.ep-foot>.ep-profit{justify-self:stretch}.ep-profit>span{flex:1}.ep-profit strong{display:inline;margin-left:7px}.ep-profit small{display:inline;margin-left:7px}.ep-export-menu{margin-left:auto}.ep-export-menu>summary{font-size:11px}.ep-tabs{gap:4px}}

      .ep-tabs .ep-nav-total{flex:1;min-width:190px;text-align:center;position:relative;margin:0 12px}.ep-tabs .ep-nav-total>summary{padding:0;line-height:1.2}.ep-nav-total>summary:after{display:none}.ep-tabs .ep-nav-total strong{display:block;font-size:28px;color:var(--green);margin:2px 0}.ep-nav-total .ep-head-currencies{justify-content:center!important;font-size:11px}.ep-nav-total>div{right:50%;transform:translateX(50%);text-align:center}.ep-export-menu{margin-left:0}.ep-export-menu>summary{display:flex;align-items:center;justify-content:center;width:40px;min-height:40px;font-size:21px;border:1px solid var(--border);border-radius:8px}.ep-export-menu>summary:after{display:none}@media(max-width:650px){.ep-tabs .ep-nav-total{order:2;flex-basis:100%;margin:5px 0}.ep-tabs .ep-nav-total strong{font-size:25px}.ep-export-menu{margin-left:auto}}
      .ep-export-menu [data-order-tools]{display:flex;flex-direction:column;gap:4px;width:255px}.ep-export-menu [data-order-tools]>select{width:100%;margin-bottom:6px}.ep-export-menu [data-order-tools]>.btn{width:100%;display:flex;align-items:center;justify-content:flex-start;gap:10px;text-align:left;border:0;background:transparent;padding:10px 12px}.ep-export-menu [data-order-tools]>.btn:hover{background:var(--bg3)}.ep-export-menu [data-order-tools]>.btn>i{font-size:20px}.ep-export-menu [data-order-copy]>i{color:var(--green)}.ep-export-menu [role=status]:empty{display:none}
      .ep-stock-foot{position:relative;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);padding-top:8px;padding-bottom:8px}.ep-stock-foot>.ep-profit{grid-column:2;grid-row:1;text-align:center;display:flex;flex-direction:column;gap:0;justify-self:center}.ep-stock-foot>.ep-foot-actions{grid-column:3;grid-row:1;justify-self:end}.ep-stock-foot .ep-profit>span strong,.ep-stock-foot .ep-profit>span:only-child strong{display:block;font-size:28px;margin:2px 0;color:var(--green)}.ep-stock-foot .ep-profit>span small{display:block;font-size:11px;white-space:normal;max-width:380px}.ep-stock-foot [data-price-difference-total]{position:absolute;left:18px;top:50%;transform:translateY(-50%);max-width:220px;text-align:left}.ep-stock-foot>[role=status]{grid-column:1/-1;grid-row:2}.ep-stock-foot>[role=status]:empty{display:none}@media(max-width:950px){.ep-stock-foot{grid-template-columns:1fr}.ep-stock-foot>.ep-profit{grid-column:1;grid-row:1}.ep-stock-foot>.ep-foot-actions{grid-column:1;grid-row:2;justify-self:center}.ep-stock-foot [data-price-difference-total]{position:static;transform:none;text-align:center;max-width:none;margin-top:4px}.ep-stock-foot>[role=status]{grid-row:3}.ep-stock-foot .ep-profit>span strong{font-size:25px}}
      .ep-export-slot{flex:none;margin-left:0}@media(max-width:650px){.ep-export-slot{margin-left:auto}}
      .ep-tabs{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}.ep-tabs>[data-tab]{grid-row:1;justify-self:start}.ep-tabs>[data-tab="products"]{grid-column:1}.ep-tabs>[data-tab="delivery"]{grid-column:1;margin-left:82px}.ep-tabs>[data-tab="summary"]{grid-column:1;margin-left:190px}.ep-tabs .ep-nav-total{grid-column:2;grid-row:1;margin:0;min-width:0}.ep-export-slot{grid-column:3;grid-row:1;justify-self:end}.ep-review-button{grid-column:3;min-height:38px}.ep-review-button:disabled,.ep-tabs [data-tab="summary"]:disabled{color:var(--text3);background:var(--bg3);border-color:var(--border);opacity:.6;cursor:default}@media(max-width:950px){.ep-tabs{display:flex;flex-wrap:wrap}.ep-tabs>[data-tab]{margin-left:0}.ep-tabs .ep-nav-total{order:2;flex-basis:100%;margin:5px 0}.ep-export-slot{margin-left:auto}}@media(max-width:760px){.ep-head{grid-template-columns:auto minmax(0,1fr) auto}.ep-review-button{font-size:11px;padding:7px 9px}}
      .ep-stock-foot .ep-cost-explanation{position:absolute;left:18px;top:50%;transform:translateY(-50%);max-width:300px;text-align:left}.ep-stock-foot .ep-cost-explanation [data-price-difference-total]{position:static;transform:none;max-width:none;font-size:13px;line-height:1.4}.ep-cost-explanation [data-order-cost-note]{display:block;margin-top:4px;font-size:11px;line-height:1.4}@media(max-width:950px){.ep-stock-foot .ep-cost-explanation{position:static;transform:none;text-align:center;max-width:none;margin-top:5px}}
      .ep-expenses-total{text-align:right;margin-top:16px}.ep-expenses-total small{display:block}.ep-expenses-total strong{display:block;color:var(--green);font-size:24px;margin-top:3px}
      .ep-summary-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.ep-summary-heading h3{margin:0}
      .ep-summary-product{display:flex;align-items:center;gap:10px;min-width:0}.ep-summary-product>div{min-width:0}.ep-summary-product img,.ep-summary-product .oc-product-thumb{width:42px!important;height:42px!important;flex:0 0 42px!important;object-fit:contain;border-radius:6px}.ep-summary-product small{display:block;color:var(--text3)}.ep-summary-delta,.ep-summary-neutral{display:block;font-size:11px!important;margin-top:4px}.ep-summary-expense{color:var(--amber)!important}.ep-summary-final{background:var(--green-bg,#16352b);font-weight:700}.ep-cost-summary td{vertical-align:middle}
    `;el.appendChild(style);
    const frame=document.createElement('div');frame.style.cssText='display:contents';el.appendChild(frame);
    function expenseForm(p,mode){
      if(mode==='remote')return '<section><h3>Gastos de este pedido</h3><div class="ep-trip-fields">'+remoteLabels.map(([key,label])=>input(key,p[key],label+' · ARS')).join('')+'</div>'+(!remoteLabels.some(([key])=>Object.hasOwn(p,key))&&valid(remoteTotal(p))?'<p>Total anterior sin desglosar: $ '+money(remoteTotal(p))+'</p>':'')+'</section>';
      return '<section><h3>Gastos del viaje</h3><div class="ep-trip-fields">'+tripLabels.map(([key,label])=>input(key,p[key],label+' · ARS')).join('')+input('nights',p.nights??1,'Noches')+input('days',p.days??1,'Días')+'</div>'+input('tripTotalARS',p.tripTotalARS,'Total del viaje · ARS')+'</section>';
    }
    const input=(key,value,label,extra='')=>'<label>'+esc(label)+'<input class="search-input" type="number" min="0" step="0.01" data-param="'+key+'" value="'+esc(value??'')+'" '+extra+'></label>';
    function providers(r){return productProviders(r,ctx.catalog);}
    function equivalentHTML(value,currency){const e=equivalentAmount(value,currency,d.parameters.usd);return e?'≈ '+e.currency+' '+money(e.amount):'Sin cotización';}
    function groupedCards(rows,extra){return purchaseGroups(rows).map(g=>'<section class="ep-purchase-group" data-purchase-group="'+(extra?'extra-':'')+g.method+'"><h3>'+g.title+' <small>'+g.items.length+' productos</small></h3>'+g.items.map(({row,index})=>card(row,index,extra)).join('')+'</section>').join('');}
    function card(r,i,extra){
      const currency=r.method==='exterior'?'USD':'ARS',id=(extra?'extra:':'row:')+i;
      const mode=extra?(stockOnly?'Para stock':'Extra para stock'):r.method==='stock'?'Stock disponible':r.method==='local'?'Compra local':'Compra exterior';
      const qty=extra?num(r.qty):r.method==='stock'?0:r.requestedQty==null?Math.max(0,num(r.needed)-num(r.existing)):num(r.requestedQty);
      const accept=r.method!=='stock'&&r.reference?.currency===currency&&r.reference?.providerKey===r.providerKey&&num(r.reference?.amount)>0&&!num(r.agreed);
      const link=providerLink(r,ctx.catalog,ctx.providers);
      return '<article data-card-id="'+id+'" class="ep-card"><div class="ep-product">'+(ctx.thumbnail?.(r)||'')+'<div><small class="ep-code">'+esc(r.code||'Sin código')+'</small><strong>'+esc(r.description)+'</strong>'+(extra?'':'<small data-quantity-status="'+id+'" style="display:block;margin-top:6px;line-height:1.5" aria-live="polite"></small>')+'</div></div>'+
        '<div><small>Cantidad</small>'+(extra?'<input class="search-input" aria-label="'+(stockOnly?'Cantidad a comprar':'Cantidad extra')+'" type="number" min="1" step="1" data-item="'+id+'" data-field="qty" value="'+r.qty+'">':'<input class="search-input" aria-label="Cantidad a comprar '+esc(r.code)+'" type="number" min="0" max="'+Math.max(0,num(r.needed)-num(r.existing))+'" step="any" data-item="'+id+'" data-field="requestedQty" value="'+qty+'" '+(r.method==='stock'?'disabled':'')+'>')+'</div>'+
        '<div class="ep-reference"><small>'+(r.reference?.converted?'Referencia convertida':'Precio leído')+'</small><strong>'+(num(r.reference?.amount)>0?esc(r.reference?.currency||currency)+' '+money(r.reference.amount):'Sin precio registrado')+'</strong>'+(r.reference?.converted?'<small>Según cotización guardada</small>':'')+(num(r.reference?.amount)>0?'<small>'+equivalentHTML(r.reference.amount,r.reference.currency||currency)+'</small>':'')+'</div>'+
        '<label class="ep-agreed">Precio acordado · '+currency+'<div class="ep-price"><input class="search-input" type="number" min="0.01" step="0.01" data-item="'+id+'" data-field="agreed" value="'+esc(r.agreed==null||r.agreed===''?'':Number(r.agreed).toFixed(2))+'" placeholder="Pendiente" '+(r.method==='stock'?'disabled':'')+'>'+(accept?'<button class="btn btn-sm" data-accept="'+id+'" title="Usar precio leído" aria-label="Usar precio leído">=</button>':'')+'</div><small data-unit-equivalent="'+id+'"></small></label>'+
        '<div class="ep-total"><small>Total acordado</small><strong data-line-total="'+id+'"></strong><small data-total-equivalent="'+id+'"></small><small data-price-difference="'+id+'" style="display:block"></small></div>'+
        '<div class="ep-provider"><label>Proveedor<select class="search-input" data-item="'+id+'" data-field="providerKey" '+(r.method==='stock'?'disabled':'')+'><option value="">Seleccionar</option>'+providers(r).map(v=>'<option value="'+esc(v.proveedorKey)+'" '+(r.providerKey===v.proveedorKey?'selected':'')+'>'+esc(v.nombre)+'</option>').join('')+'</select></label><div class="ep-product-links">'+(link?'<a href="'+esc(link.url)+'" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--blue)">'+esc(link.label)+' ↗</a>':'<small>Sin enlace del proveedor</small>')+(root.permisoModulo?.('productos')?'<button type="button" data-product-sheet="'+id+'">Ver producto</button>':'')+'</div></div>'+
        (extra&&!frozen?'<button class="btn btn-sm ep-remove" data-remove="'+i+'" aria-label="Quitar producto '+esc(r.code||r.description)+'" title="Quitar producto">Quitar</button>':'')+(extra?'':'<div class="ep-options">')+
        (extra?'':'<label>Cómo resolverlo<select class="search-input" data-item="'+id+'" data-field="method">'+[['exterior','Compra exterior'],['local','Compra local'],['stock','Usar stock disponible']].map(([v,t])=>'<option value="'+v+'" '+(r.method===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Usar del stock · disponible '+num(ctx.available?.(r))+'<input class="search-input" type="number" min="0" max="'+num(r.needed)+'" step="1" data-item="'+id+'" data-field="existing" value="'+(r.method==='stock'?num(r.needed):num(r.existing))+'" '+(r.method==='stock'?'disabled':'')+'></label>')+
        (extra?'':'</div>')+'</article>';
    }

    function render(){const addPanel=frame.querySelector('details[data-add-panel]');if(addPanel)searchExpanded=addPanel.open;pdfUI?.destroy();pdfUI=null;const scroll=renderedTab===tab?(frame.querySelector('.ep-body')?.scrollTop||0):0;renderedTab=tab;const s=frozen?Object.assign({},copy(ctx.saved),{hasForeign:d.rows.some(r=>r.include&&r.qty>0)||d.extras.length>0}):calculateDraft(d),p=d.parameters;const used={};d.rows.forEach(r=>{const k=r.productKey||r.code;used[k]=num(used[k])+(r.method==='stock'?num(r.needed):num(r.existing));});const shortages=d.rows.filter((r,i,a)=>a.findIndex(x=>(x.productKey||x.code)===(r.productKey||r.code))===i&&num(used[r.productKey||r.code])>num(ctx.available?.(r)));s.pending=Array.isArray(s.pending)?s.pending:[];if(!frozen){shortages.forEach(r=>s.pending.push('Stock insuficiente: '+r.description));s.complete=!s.pending.length;}
      let body='';
      if(tab==='products')body='<div class="ep-product-toolbar"><div data-product-toolbar>'+(stockOnly?'':'<button class="btn" data-all-exterior>Usar proveedores del exterior</button>')+'</div><div class="ep-view-switch" role="group" aria-label="Vista de productos"><button class="btn btn-sm" data-layout="list" aria-pressed="'+(layout==='list')+'">Lista</button><button class="btn btn-sm" data-layout="cards" aria-pressed="'+(layout==='cards')+'">Tarjetas</button></div></div>'+groupedCards(d.rows,false)+productSearchMarkup()+(d.extras.length?'<h3>'+(stockOnly?'Productos del pedido':'Extras para stock')+'</h3>'+groupedCards(d.extras,true):'')+(d.extras.length?'<div class="ep-box">'+input('extraLogisticsUSD',d.parameters.extraLogisticsUSD,stockOnly?'Gastos adicionales del pedido · USD':'Gastos exclusivos de extras · USD')+'</div>':'');
      if(tab==='delivery')body=!s.hasForeign?'<div class="ep-box"><h3>Compra local y stock</h3><p>Este pedido no requiere gastos de envío o viaje al exterior. Continúa en Órdenes de compra.</p></div>':'<div class="ep-box"><h3>Entrega</h3><label>Modalidad<select class="search-input" data-mode><option value="remote" '+(d.chosen==='remote'?'selected':'')+'>Recibir con envío</option><option value="onsite" '+(d.chosen==='onsite'?'selected':'')+'>Ir a buscar</option></select></label><div class="ep-row" style="margin-top:16px">'+expenseForm(p,d.chosen)+'</div><div class="ep-expenses-total" aria-live="polite"><small>Total de gastos</small><strong data-expenses-total></strong></div></div><div class="ep-box"><h3>Pago y cotización</h3><label>Pago de la mercadería<select class="search-input" data-param="payment"><option '+(p.payment==='USD'?'selected':'')+' value="USD">Dólares</option><option '+(p.payment==='USDT'?'selected':'')+' value="USDT">USDT</option></select></label><small>Elegí la moneda con la que vas a pagar la mercadería: USD o USDT.</small>'+input('usd',p.usd,'Dólar conseguido · ARS por USD')+(p.payment==='USDT'?'<div class="ep-row" style="margin-top:16px">'+input('usdt',p.usdt,'Pesos por USDT')+input('usdtPerUsd',p.usdtPerUsd,'USDT que acepta el proveedor por cada USD')+input('fee',p.fee,'Comisión de pago · USDT')+'</div><small>La relación de pago la confirma el proveedor. No se deduce de la diferencia entre cotizaciones en pesos.</small><details style="margin-top:16px"><summary>Saldo USDT disponible y valoración</summary><div class="ep-row">'+input('balance',p.balance,'Saldo disponible · USDT')+'<label>Valoración<select class="search-input" data-param="valuation"><option value="current" '+(p.valuation==='current'?'selected':'')+'>Cotización actual</option><option value="historic" '+(p.valuation==='historic'?'selected':'')+'>Costo histórico</option></select></label>'+input('historic',p.historic,'Costo histórico · ARS/USDT')+'</div><p>Para completar el pago: '+money(s.result.freshUSDT)+' USDT por comprar.</p></details>':'')+'</div>';
      if(tab==='summary'&&!stockOnly)body='<div class="ep-metrics"><div class="ep-metric"><small>Venta sin IVA</small><strong>$ '+money(p.revenue)+'</strong></div><div class="ep-metric"><small>Costo previsto de la venta</small><strong>$ '+money(s.result.retained+s.result[s.chosen])+'</strong></div><div class="ep-metric"><small>Margen proyectado</small><strong>'+(!Number.isFinite(s.result.margin)?'—':s.result.margin.toLocaleString('es-AR',{maximumFractionDigits:2})+'%')+'</strong></div></div><div class="ep-box" style="margin-top:14px"><p>Ganancia proyectada: <strong>$ '+money(s.result.profit)+'</strong></p><p>Costo base de la venta: $ '+money(p.baseline)+'. La venta conserva su importe acordado con el cliente.</p><p>Pedido completo: <strong>$ '+money(s.result.orderTotal)+'</strong> · incluye $ '+money(s.result.extraTotal)+' de extras para stock, separados del margen de la venta.</p><p>Confirmar genera órdenes y reserva el stock indicado. La recepción registra lo recibido y actualiza los costos reales.</p></div>'+(s.pending.length?'<div class="ep-box ep-warning"><strong>Falta completar</strong><ul>'+s.pending.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></div>':'<p>Pedido listo para confirmar.</p>');
      const supplierSavings=priceDifferenceTotals(d),savingsCurrencies=['USD','ARS'].filter(currency=>supplierSavings[currency]!==0);if(!savingsCurrencies.length)savingsCurrencies.push('USD');
      if(tab==='summary'&&stockOnly)body='<div class="ep-metrics"><div class="ep-metric"><small>'+(supplierSavings.USD<0||supplierSavings.ARS<0?'Diferencia con el proveedor':'Ahorro por descuento del proveedor')+'</small>'+savingsCurrencies.map(currency=>'<strong style="color:var(--'+(supplierSavings[currency]<0?'red':'green')+')">'+currency+' '+money(supplierSavings[currency])+'</strong>').join('')+(supplierSavings.missing?'<small>Comparación parcial · '+supplierSavings.missing+' sin precio inicial</small>':'')+'</div><div class="ep-metric"><small>Productos para stock</small><strong>'+d.extras.length+'</strong></div><div class="ep-metric"><small>'+(d.chosen==='onsite'?'Gastos del viaje':'Logística, traslado y pasero')+'</small><strong>$ '+money(s.result.logistics)+'</strong></div></div><div class="ep-box" style="margin-top:14px"><p>Confirmar genera las órdenes de compra. La recepción registra lo recibido y lo incorpora al stock general.</p></div>'+(s.pending.length?'<div class="ep-box ep-warning"><strong>Falta completar</strong><ul>'+s.pending.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></div>':'<p>Pedido listo para confirmar.</p>');
      if(frozen&&tab==='summary')body=body.replace('Confirmar genera las órdenes de compra. La recepción registra lo recibido y lo incorpora al stock general.','Pedido confirmado. Consultá las órdenes para ver las cantidades pendientes de recepción.').replace('Confirmar genera órdenes y reserva el stock indicado. La recepción registra lo recibido y actualiza los costos reales.','Pedido confirmado. Consultá las órdenes para ver la recepción y sus costos registrados.').replace('Pedido listo para confirmar.','Pedido confirmado · valores conservados.');
      if(tab==='summary')body=body.replace('</div></div><div class="ep-box"','</div><div class="ep-metric"><small>Dólar conseguido · ARS por USD</small><strong>'+(num(p.usd)>0?'$ '+money(p.usd):'Pendiente')+'</strong></div></div><div class="ep-box"');
      if(tab==='summary'&&stockOnly)body+=localSavingsCard(ctx.localSavings?.(Object.assign({},d,{complete:s.complete,result:s.result})),p.usd);
      if(tab==='summary'&&Array.isArray(s.result.purchaseBreakdown)){
        const lines=s.result.purchaseBreakdown,finalUSD=value=>num(p.usd)>0?'USD '+money(value/num(p.usd)):'Falta dólar conseguido';
        body='<div class="ep-box"><div class="ep-summary-heading"><div><h3>Costo final de los productos</h3><small>USD al dólar conseguido: $ '+money(p.usd)+'</small></div><button type="button" class="btn btn-sm btn-icon sv-column-percent-btn" data-summary-columns title="Configurar columnas" aria-label="Configurar columnas"><i class="ti ti-columns" aria-hidden="true"></i></button></div><div class="table-wrap" style="overflow-x:auto"><table id="exterior-cost-summary-table" class="ep-cost-summary" style="width:100%;border-collapse:collapse"><thead><tr>'+['Producto','Cant.','Inicial / unidad','Conseguido / unidad','Gastos / unidad · USD','Final / unidad · USD','Total · USD'].map(label=>'<th style="text-align:left;padding:10px">'+label+'</th>').join('')+'</tr></thead><tbody>'+lines.map(r=>'<tr><td style="padding:10px"><div class="ep-summary-product">'+(ctx.thumbnail?.(r)||'')+'<div><small>'+esc(r.code||'')+'</small><div>'+esc(r.description||'')+'</div></div></div></td><td>'+r.quantity+'</td><td>'+(r.initial===null?'Sin referencia':r.currency+' '+money(r.initial))+'</td><td>'+r.currency+' '+money(r.agreed)+(r.initial===null?'':r.initial===r.agreed?'<small class="ep-summary-neutral">Sin descuento</small>':'<small class="ep-summary-delta" style="color:var(--'+(r.initial>r.agreed?'green':'red')+')">'+(r.initial>r.agreed?'Ahorrás ':'Aumentó ')+r.currency+' '+money(Math.abs(r.initial-r.agreed))+' / unidad</small>')+'</td><td class="ep-summary-expense">+ '+finalUSD(r.quantity?r.expenses/r.quantity:0)+'</td><td class="ep-summary-final"><strong>'+finalUSD(r.unitCost)+'</strong></td><td>'+finalUSD(r.total)+'<small class="ep-summary-neutral">$ '+money(r.total)+'</small></td></tr>').join('')+'</tbody></table></div>'+(num(p.extraLogisticsUSD)>0?'<p>Adicional exclusivo de extras: $ '+money(num(p.extraLogisticsUSD)*num(p.usd))+' (sin distribuir en las filas).</p>':'')+'</div>'+body;
      }
      if(tab==='summary'&&s.hasForeign&&!frozen){
        const other=calculateDraft(Object.assign({},d,{chosen:d.chosen==='remote'?'onsite':'remote'}));
        body+='<details class="ep-box"><summary>Comparar envío y viaje</summary><div class="ep-row" style="margin-top:14px">'+'<span>Envío: ARS '+money(remoteTotal(p))+'</span><span>Viaje: ARS '+money(p.tripTotalARS)+'</span>'+'</div><p>Alternativa '+(d.chosen==='remote'?'viaje':'envío')+': $ '+money(other.result.orderTotal)+' para el pedido completo.'+(other.pending.length?' Estimación pendiente de completar.':'')+'</p><small>La modalidad elegida se cambia en Entrega y pago.</small></details>';
      }
      frame.innerHTML='<header class="ep-head"><button class="btn btn-sm" data-close><i class="ti ti-arrow-left" aria-hidden="true"></i> Volver</button><div><h2>Preparar compra · '+esc(ctx.customer||ctx.saleId)+'</h2><small>'+(stockOnly?(d.rows.length+d.extras.length)+' productos para stock':d.rows.length+' productos de venta · '+d.extras.length+' extras')+'</small></div><button class="btn ep-review-button" data-next>Ver resumen</button></header><nav class="ep-tabs">'+[['products','Productos'],['delivery','Entrega y pago'],['summary','Resumen']].map(([k,t])=>'<button class="btn" data-tab="'+k+'" aria-selected="'+(tab===k)+'">'+t+'</button>').join('')+'<details class="ep-head-total ep-nav-total" data-agreed-total></details><div class="ep-export-slot" data-order-tools></div></nav><main class="ep-body">'+body+'</main><footer class="ep-foot '+(stockOnly?'ep-stock-foot':'')+'"><span role="status">'+esc(status)+'</span><div class="ep-profit" data-profit></div><div class="ep-foot-actions"><button class="btn btn-primary" data-save aria-live="polite">Guardar y aplicar</button>'+(tab==='summary'?'<button class="btn btn-primary" data-confirm '+(!s.complete?'disabled':'')+'>Confirmar compra</button>':'')+'</div></footer>';
      if(root.SVPurchaseOrderExport)root.SVPurchaseOrderExport.mount(frame.querySelector('[data-order-tools]'),{isCurrent:()=>el.isConnected&&String(root.currentUserUid||'')===owner&&!!root.permisoModulo?.('balancecompra'),getOrder:()=>orderForExport(d,'Pedido de compra'+(ctx.saleId?' · '+ctx.saleId:''),ctx.catalog)});
      refreshAmounts();refreshSaveState();
      if(tab==='summary')root.SisVentas?.prepareResizablePage?.(frame);
      const productSearch=frame.querySelector('[data-search]');if(productSearch)root.SVProductCodeSearch?.attach(productSearch);
      if(tab==='products'&&!frozen&&root.SVPurchasePDF){pdfUI=root.SVPurchasePDF.mount({host:el,toolbar:frame.querySelector('[data-product-toolbar]'),currencyAware:true,rows:()=>pdfRows(d),apply:applyPDF});}
      frame.querySelector('.ep-body').scrollTop=scroll;
      if(frozen){frame.querySelector('[role=status]').textContent='Compra confirmada · valores conservados';frame.querySelector('[data-apply-exterior]')?.remove();frame.querySelector('[data-save]')?.remove();frame.querySelector('[data-confirm]')?.remove();const button=document.createElement('button');button.className='btn';button.textContent='Ver órdenes';button.dataset.orders='';frame.querySelector('.ep-foot-actions').appendChild(button);frame.querySelectorAll('input,select,[data-accept],[data-remove],[data-add],[data-all-exterior],[data-search-modal],.sv-product-scan-button').forEach(c=>c.disabled=true);}
      frame.querySelectorAll('button,input,select').forEach(c=>{if(busy)c.disabled=true;});return s;
    }
    function refreshAmounts(){
      const expensesNode=frame.querySelector('[data-expenses-total]');if(expensesNode){const value=d.chosen==='remote'?remoteTotal(d.parameters):d.parameters.tripTotalARS;expensesNode.textContent=valid(value)?'$ '+money(value):'Pendiente';}
      const totals=agreedSummary(d);
      const differenceLabel=(amount,currency)=>amount>0?'Ahorrás '+currency+' '+money(amount):amount<0?'Aumento '+currency+' '+money(-amount):'Sin diferencia · '+currency;
      frame.querySelectorAll('[data-price-difference]').forEach(node=>{const value=priceDifference(rowFor(node.dataset.priceDifference));node.textContent=value?'Original '+value.currency+' '+money(value.original)+' → Acordado '+money(value.agreed)+' · '+differenceLabel(value.difference,value.currency):'Sin referencia comparable';node.style.color=value?.difference>0?'var(--green,#73dcb2)':value?.difference<0?'var(--amber,#e5b83b)':'var(--text3)';});
      frame.querySelectorAll('[data-quantity-status]').forEach(node=>{
        const r=rowFor(node.dataset.quantityStatus),needed=num(r.needed),stock=r.method==='stock'?needed:num(r.existing),qty=r.method==='stock'?0:r.requestedQty==null?Math.max(0,needed-stock):num(r.requestedQty),missing=needed-stock-qty;
        const fmt=n=>n.toLocaleString('es-AR');
        node.textContent='Necesitás '+fmt(needed)+' · A comprar '+fmt(qty)+' · Del stock '+fmt(stock)+(missing>0?' · Falta resolver '+fmt(missing):missing<0?' · Sobran '+fmt(-missing):' · Cantidad completa');
        node.style.color=missing?'var(--amber,#e5b83b)':'var(--text3)';
      });
      frame.querySelectorAll('[data-line-total]').forEach(node=>{
        const r=rowFor(node.dataset.lineTotal),qty=r.destination==='stock'?num(r.qty):r.method==='stock'?0:r.requestedQty==null?Math.max(0,num(r.needed)-num(r.existing)):num(r.requestedQty);
        node.textContent=valid(r.agreed)?(r.method==='exterior'?'USD ':'ARS ')+money(qty*num(r.agreed)):'Pendiente';
      });
      frame.querySelectorAll('[data-unit-equivalent],[data-total-equivalent]').forEach(node=>{
        const total=node.hasAttribute('data-total-equivalent'),r=rowFor(total?node.dataset.totalEquivalent:node.dataset.unitEquivalent);
        const qty=r.destination==='stock'?num(r.qty):r.method==='stock'?0:r.requestedQty==null?Math.max(0,num(r.needed)-num(r.existing)):num(r.requestedQty);
        node.textContent=valid(r.agreed)?equivalentHTML(num(r.agreed)*(total?qty:1),r.method==='exterior'?'USD':'ARS'):'';
      });
      const header=frame.querySelector('[data-agreed-total]'),footer=frame.querySelector('[data-profit]');
      const differences=priceDifferenceTotals(d),comparison=document.createElement('small');comparison.setAttribute('data-price-difference-total','');comparison.style.display='block';comparison.textContent=[differences.USD?differenceLabel(differences.USD,'USD'):'',differences.ARS?differenceLabel(differences.ARS,'ARS'):''].filter(Boolean).join(' · ');if(comparison.textContent)comparison.textContent='Diferencia con el precio inicial: '+comparison.textContent;else comparison.textContent='Sin diferencia con los precios iniciales';if(differences.missing)comparison.textContent+=' · '+differences.missing+' productos sin precio inicial';
      if(header)header.innerHTML='<summary>Total productos'+(totals.missing?' · parcial':'')+'<strong>$ '+money(totals.ars)+'</strong><small class="ep-head-currencies"><span>USD '+(totals.usd===null?'—':money(totals.usd))+'</span><span>USDT '+(totals.usdt===null?'sin cotización':money(totals.usdt))+'</span></small></summary><div><small>Sin logística</small><small>Exterior: USD '+money(totals.foreignUSD)+' · Local: ARS '+money(totals.localARS)+'</small></div>';
      const equivalents=value=>'<small>USD '+(num(d.parameters.usd)?money(value/num(d.parameters.usd)):'—')+' · USDT '+(num(d.parameters.usdt)?money(value/num(d.parameters.usdt)):'—')+'</small>';
      if(footer&&stockOnly){const estimate=frozen?ctx.saved:calculateDraft(d);footer.innerHTML='<span>'+(estimate.pending?.length?'Subtotal calculado':'Total del pedido')+'<strong>$ '+money(estimate.result.orderTotal)+'</strong>'+equivalents(estimate.result.orderTotal)+'</span>';const details=document.createElement('small');details.setAttribute('data-order-cost-note','');details.textContent=estimate.pending?.length?estimate.pending[0]:'Productos + $ '+money(estimate.result.logistics)+' de gastos';const aside=document.createElement('div');aside.className='ep-cost-explanation';aside.append(comparison,details);footer.appendChild(aside);return;}
      if(footer)footer.innerHTML='<span>Ganancia anterior<strong>$ '+money(totals.before)+'</strong>'+equivalents(totals.before)+'</span><span class="ep-profit-arrow" aria-label="cambia a">→</span><span>Ganancia con cambios · sin logística'+(totals.quantityPending?' · falta resolver cantidades':totals.missing?' · parcial':'')+'<strong>$ '+(totals.missing?'Pendiente':money(totals.after))+'</strong>'+(totals.missing?'':equivalents(totals.after))+'</span>';
      if(footer)footer.appendChild(comparison);
    }
    function refreshRates(){if(frozen||d.parameters.usdtExchange==='manual')return;const value=ctx.rates?.().usdt;if(num(value)>0){const wasClean=editState()===cleanState;d.parameters.usdt=value;if(wasClean)cleanState=editState();refreshAmounts();refreshSaveState();}}
    document.addEventListener('sisventas:usdt-quote',refreshRates);
    frame.addEventListener('input',e=>{
      const t=e.target;if(busy||frozen)return;
      if(t.dataset.param){d.parameters[t.dataset.param]=t.value;if(travelKeys.includes(t.dataset.param)){d.parameters.tripDetailsVersion=1;d.parameters.tripTotalARS=tripTotal(d.parameters);const total=frame.querySelector('[data-param=tripTotalARS]');if(total)total.value=d.parameters.tripTotalARS;}else if(t.dataset.param==='tripTotalARS')delete d.parameters.tripDetailsVersion;if(t.dataset.param==='usd')d.parameters.usdMode='manual';if(t.dataset.param==='usdt')d.parameters.usdtExchange='manual';status='';refreshAmounts();refreshSaveState();return;}
      if(!t.dataset.item)return;
      const field=t.dataset.field;if(!['agreed','requestedQty','qty'].includes(field))return;
      const row=rowFor(t.dataset.item);row[field]=t.value;if(field==='agreed')row.manualPrice=true;dirty=true;status='';refreshAmounts();
      frame.querySelector('[role=status]').textContent='';refreshSaveState();
    });
    async function applyPDF(changes,doc){
      if(busy||frozen||ctx.isClosed?.()||String(root.currentUserUid||'')!==owner||!el.isConnected)throw Error('La sesión o la compra cambió. Volvé a abrirla.');
      const next=revisePDF(d,changes),snapshot=Object.assign({},d.saved,calculateDraft(next),{updatedAt:Date.now(),updatedBy:root.currentUser||''});delete snapshot.hasForeign;
      snapshot.importHistory=[...(d.saved.importHistory||[]),{documentId:doc.id,name:doc.name,at:Date.now(),by:owner,changes}];
      busy=true;const locked=Array.from(frame.querySelectorAll('input,select,button')).map(c=>[c,c.disabled]);locked.forEach(([c])=>c.disabled=true);
      try{await ctx.save({...snapshot,pdfImport:doc});if(!el.isConnected||String(root.currentUserUid||'')!==owner)return;
        d.rows=next.rows;d.extras=next.extras;d.saved=copy(snapshot);cleanState=editState();dirty=false;status='Precios revisados y comprobante guardados. La compra no fue confirmada.';
      }finally{busy=false;locked.forEach(([c,disabled])=>{if(c.isConnected)c.disabled=disabled;});}
      render();
    }
    async function save(confirm,applyExterior=false){if(busy||frozen||(!confirm&&!applyExterior&&editState()===cleanState))return;status='';const s=render();if(confirm&&!s.complete)return;if(ctx.isClosed?.()||String(root.currentUserUid||'')!==owner){root.notify?.('La sesión o la compra cambió. Volvé a abrirla.');return;}busy=true;render();try{const snapshot=Object.assign({},d.saved,s,{updatedAt:Date.now(),updatedBy:root.currentUser||''});delete snapshot.hasForeign;if(applyExterior||confirm){const foreign=[...(snapshot.rows||[]),...(snapshot.extras||[])].filter(r=>r.method==='exterior'&&num(r.qty)>0);if(foreign.some(r=>!r.providerKey||!(num(r.agreed)>0))||(foreign.length&&!(num(snapshot.parameters.usd)>0)))throw new Error('Completá proveedor, precio acordado y cotización de los productos del exterior.');snapshot.exteriorAppliedAt=Date.now();snapshot.exteriorAppliedBy=owner;}await ctx.save(snapshot);d.saved=copy(snapshot);cleanState=editState();dirty=false;if(confirm){await ctx.confirm(snapshot);close(true);}else{status=applyExterior?'Preparación guardada y decisiones de compra aplicadas.':'Preparación guardada.';render();}}catch(e){render();status=root.SVGuardedWrites?.errorMessage(e)||e.message;}finally{busy=false;if(el.isConnected)render();}}
    function close(force){if(busy&&!force)return;if(!force&&dirty&&!root.confirm('Hay cambios sin guardar. ¿Salir de la preparación?'))return;root.SVProductCodeSearch?.close();pdfUI?.destroy();pdfUI=null;el.remove();document.removeEventListener('sisventas:usdt-quote',refreshRates);document.removeEventListener('sisventas:session-ended',sessionEnded);document.removeEventListener('keydown',onEscape);if(priorFocus?.isConnected)priorFocus.focus();}
    let productSheet=null;
    function returnFromProduct(){
      if(!productSheet)return false;
      const sheet=productSheet;productSheet=null;
      root.removeEventListener('popstate',sheet.back,true);root.removeEventListener('hashchange',sheet.back,true);
      sheet.nodes.forEach(({node,marker,style})=>{marker.replaceWith(node);if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);});
      sheet.host.remove();el.style.display='';api.returnFromProduct=null;
      if(sheet.focus?.isConnected)sheet.focus.focus();
      return true;
    }
    function openProductSheet(row){
      if(productSheet||!root.permisoModulo?.('productos'))return;
      const product=Object.values(root.prodData||{}).find(p=>String(p.fbKey||p.id)===String(row.productKey)||String(p.codigo)===String(row.code));
      const views=['prod-detail-view','prod-form-view'].map(id=>document.getElementById(id));
      if(!product||views.some(n=>!n)||typeof root.verProducto!=='function'){root.notify?.('No se encontró la ficha del producto.');return;}
      const host=document.createElement('section');host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Ficha del producto de la compra');host.dataset.svEscapeOwner='';
      host.style.cssText='position:fixed;inset:0;z-index:11001;overflow:auto;background:var(--bg);color:var(--text);padding:20px';
      host.innerHTML='<style>[aria-label="Ficha del producto de la compra"] #pf-anterior,[aria-label="Ficha del producto de la compra"] #pf-siguiente{display:none!important}</style>';
      const focus=document.activeElement;
      const nodes=views.map(node=>{const marker=document.createComment('retorno preparación');node.before(marker);const style=node.getAttribute('style');host.appendChild(node);return {node,marker,style};});
      const url=root.location.href;
      const leave=()=>{if(views[1].style.display!=='none')root.cerrarFormProducto();else root.cerrarDetalleProducto();};
      const back=e=>{e.stopImmediatePropagation();root.history.replaceState(root.history.state,'',url);leave();};
      productSheet={host,nodes,focus,back};api.returnFromProduct=returnFromProduct;
      root.addEventListener('popstate',back,true);root.addEventListener('hashchange',back,true);
      host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();leave();}});
      el.style.display='none';document.body.appendChild(host);
      try{root.verProducto(product.fbKey||product.id);host.querySelector('button')?.focus();}catch(e){returnFromProduct();root.notify?.('No se pudo abrir la ficha del producto.');}
    }
    function onEscape(event){if(!el.isConnected||productSheet||el.querySelector('dialog[open]')||document.querySelector('dialog[data-sv-camera][open]'))return;if(event.key==='Escape'&&el.querySelector('.ep-extra-search')){event.preventDefault();event.stopImmediatePropagation();closeExtraSearch();return;}if(event.key==='Escape'){const disclosure=el.querySelector('.sv-purchase-menu[open],.ep-head-total[open]');if(disclosure){event.preventDefault();event.stopImmediatePropagation();disclosure.open=false;disclosure.querySelector('summary')?.focus();return;}event.preventDefault();event.stopImmediatePropagation();close();}}document.addEventListener('keydown',onEscape);
    function sessionEnded(){returnFromProduct();close(true);}document.addEventListener('sisventas:session-ended',sessionEnded);
    function rowFor(id){const [kind,index]=id.split(':');return (kind==='row'?d.rows:d.extras)[Number(index)];}
    frame.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||busy)return;if(b.dataset.layout){layout=b.dataset.layout;el.classList.toggle('ep-list',layout==='list');frame.querySelectorAll('[data-layout]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.layout===layout)));return;}if(b.dataset.productSheet)return openProductSheet(rowFor(b.dataset.productSheet));if(b.hasAttribute('data-close'))return close();if(b.hasAttribute('data-orders')){close();ctx.openOrders?.();return;}if(b.dataset.tab){tab=b.dataset.tab;render();}if(b.hasAttribute('data-summary-columns')){root.SisVentas?.openColumnPercentEditor?.('exterior-cost-summary-table');return;}if(b.hasAttribute('data-next')){tab='summary';render();}if(b.hasAttribute('data-apply-exterior'))save(false,true);if(b.hasAttribute('data-save'))save(false,true);if(b.hasAttribute('data-confirm'))save(true);if(b.dataset.accept&&!frozen){const r=rowFor(b.dataset.accept);r.agreed=r.reference.amount;status='';dirty=true;render();}if(b.dataset.remove!==undefined&&!frozen&&e.detail<2){const index=Number(b.dataset.remove);d.extras.splice(index,1);dirty=true;status='Producto quitado del pedido';render();(frame.querySelector('[data-remove="'+Math.min(index,d.extras.length-1)+'"]')||frame.querySelector('[data-search]'))?.focus({preventScroll:true});}if(b.hasAttribute('data-all-exterior')&&!frozen){const count=selectExterior(d.rows,ctx.catalog);dirty=true;status=count+' productos con proveedor del exterior';render();}if(b.hasAttribute('data-search-modal')&&!frozen){openExtraSearch();}if(b.dataset.add&&!frozen&&e.detail<2)addExtra(b.dataset.add);});
    function productSearchMarkup(){
      const content='<label>Buscar producto<div class="ep-row"><input class="search-input" data-search placeholder="Nombre o código" value="'+esc(searchTerm)+'"><button class="btn" style="flex:0 0 42px" data-search-modal aria-label="Abrir buscador de productos"><i class="ti ti-search"></i></button></div></label><div data-extra-results>'+(searchTerm.trim()?extraResults(searchTerm,12):'')+'</div>';
      return stockOnly?'<section class="ep-box" data-add-panel><h3>Agregar productos</h3>'+content+'</section>':'<details class="ep-box" data-add-panel '+(searchExpanded?'open':'')+'><summary>Agregar extras para stock</summary>'+content+'</details>';
    }
    function addExtra(key,searchInput){
      if(busy||frozen)return;
      const product=(ctx.catalog||[]).find(p=>String(p.key)===String(key));
      if(!product){root.notify?.('No se encontró el producto. Volvé a buscarlo.');return;}
      root.advertirStockProveedorFavorito?.(String(product.key));
      const options=product.providers||[],pv=options.find(p=>p.exterior&&p.activo!==false&&p.disponible!==false)||options.find(p=>p.activo!==false&&p.disponible!==false);
      const added={key:'extra-'+Date.now()+'-'+(++extraSequence),productKey:product.key,code:product.code,description:product.description,method:'local',destination:'stock',include:false,qty:1,agreed:'',reference:{amount:0,currency:'ARS'}};
      selectProvider(added,pv);d.extras.push(added);dirty=true;searchTerm='';status='Producto agregado · '+d.extras.length+' en el pedido';render();
      const input=searchInput?.isConnected?searchInput:frame.querySelector('[data-search]');
      if(input){input.value='';input.focus({preventScroll:true});}
      root.notify?.('Agregado para stock. Guardá la preparación para conservarlo.');
      return true;
    }
    function extraResults(term,limit){
      const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const words=normalize(term).trim().split(/\s+/).filter(Boolean);
      const matches=(ctx.catalog||[]).filter(p=>words.every(w=>normalize(p.description+' '+p.code).includes(w))).slice(0,limit);
      return matches.map(p=>{
        const pv=p.providers.find(v=>v.exterior&&v.activo!==false&&v.disponible!==false)||p.providers.find(v=>v.activo!==false&&v.disponible!==false);
        const amount=pv?(pv.exterior?num(pv.usd):num(pv.costo)):0,currency=pv?.exterior?'USD':'ARS';
        let raw=pv?.actualizado||'',date;
        const parts=String(raw).match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
        date=parts?new Date(Number(parts[3]),Number(parts[2])-1,Number(parts[1])):new Date(raw);
        const days=raw&&Number.isFinite(date.getTime())?Math.max(0,Math.floor((Date.now()-date.getTime())/86400000)):null;
        const age=days===null?'Sin fecha':days===0?'Actualizado hoy':days===1?'Hace 1 día':'Hace '+days+' días';
        const detail=p.detail&&p.detail!==p.description&&p.detail!=='-'?p.detail:'';
        return '<button type="button" class="btn ep-product ep-search-result" data-add="'+esc(p.key)+'">'+(ctx.thumbnail?.({destination:'stock',productKey:p.key,code:p.code})||'')+'<span class="ep-search-copy"><strong>'+esc(p.code)+' — '+esc(p.description)+'</strong><span class="badge '+(days!==null&&days<=5?'b-green':'b-amber')+' ep-search-age">'+esc(age)+'</span>'+(detail?'<small class="ep-search-detail">'+esc(detail)+'</small>':'')+'</span><span class="ep-search-price">'+(amount?'<span class="badge b-blue">'+currency+'</span> '+amount.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}):'Precio pendiente')+'<small>Compra · '+(num(p.stock)>0?num(p.stock)+' en stock':'a comprar')+'</small></span></button>';
      }).join('')||'<p>Sin resultados</p>';
    }
    function closeExtraSearch(){root.SVProductCodeSearch?.close();
      el.querySelector('.ep-extra-search')?.remove();frame.inert=false;frame.removeAttribute('aria-hidden');frame.querySelector('[data-search]')?.focus({preventScroll:true});
    }
    function searchKeys(event,input,results){
      if(event.target!==input||event.isComposing)return;
      if(event.key==='ArrowDown'){event.preventDefault();results.querySelector('[data-add]')?.focus();}
      if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(!event.repeat&&input.value.trim())results.querySelector('[data-add]')?.click();}
    }
    function openExtraSearch(){
      if(el.querySelector('.ep-extra-search'))return;
      const box=document.createElement('div');box.className='ep-extra-search';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',stockOnly?'Agregar productos':'Agregar extras para stock');box.style.cssText='position:absolute;inset:20px;z-index:2;background:var(--bg,#0c1422);border:1px solid var(--border);border-radius:12px;padding:20px;display:flex;flex-direction:column';
      box.innerHTML='<div class="ep-row"><h3>'+(stockOnly?'Agregar productos':'Agregar extras para stock')+'</h3><button class="btn" data-close-search style="flex:none">Cerrar</button></div><input class="search-input" data-large-search placeholder="Buscar por nombre o código" aria-label="Buscar productos"><div role="status" data-search-status></div><div data-large-results style="overflow:auto;flex:1"></div>';
      el.appendChild(box);frame.inert=true;frame.setAttribute('aria-hidden','true');const input=box.querySelector('input'),results=box.querySelector('[data-large-results]');results.innerHTML=extraResults('',80);input.oninput=()=>results.innerHTML=extraResults(input.value,80);
      box.onclick=e=>{const button=e.target.closest('button');if(!button||busy||frozen)return;if(button.hasAttribute('data-close-search'))return closeExtraSearch();if(button.dataset.add&&e.detail<2&&addExtra(button.dataset.add,input)){results.innerHTML=extraResults('',80);results.scrollTop=0;box.querySelector('[data-search-status]').textContent='Producto agregado · '+d.extras.length+' en el pedido';}};
      box.onkeydown=event=>{searchKeys(event,input,results);if(event.key==='Tab'){const controls=Array.from(box.querySelectorAll('input,button')).filter(n=>!n.disabled&&n.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
      root.SVProductCodeSearch?.attach(input);input.focus();
    }
    frame.addEventListener('input',e=>{if(!e.target.hasAttribute('data-search'))return;searchTerm=e.target.value;frame.querySelector('[data-extra-results]').innerHTML=searchTerm.trim()?extraResults(searchTerm,12):'';});
    frame.addEventListener('keydown',e=>{const input=frame.querySelector('[data-search]'),results=frame.querySelector('[data-extra-results]');if(input&&results)searchKeys(e,input,results);});
    frame.addEventListener('change',e=>{const t=e.target;if(busy||frozen)return;if(!t.dataset.item&&!t.dataset.param&&!t.hasAttribute('data-mode'))return;status='';if(t.dataset.item&&['agreed','requestedQty','qty'].includes(t.dataset.field)){refreshAmounts();refreshSaveState();return;}if(t.dataset.item){const r=rowFor(t.dataset.item),field=t.dataset.field;if(field==='providerKey'){const pv=providers(r).find(p=>p.proveedorKey===t.value);selectProvider(r,pv);}else if(field==='method'){delete r.requestedQty;r.method=t.value;r.include=t.value==='exterior';r.existing=t.value==='stock'?num(r.needed):0;r.agreed='';const choices=providers(r).filter(v=>!!v.exterior===(t.value==='exterior'));const pv=choices.find(v=>v.proveedorKey===r.reference?.providerKey)||choices[0];if(t.value!=='stock')selectProvider(r,pv);}else r[field]=t.value;if(field==='agreed')r.manualPrice=true;dirty=true;}if(t.dataset.param){d.parameters[t.dataset.param]=t.value;if(t.dataset.param==='usd')d.parameters.usdMode='manual';if(t.dataset.param==='usdt')d.parameters.usdtExchange='manual';dirty=true;refreshAmounts();refreshSaveState();return;}if(t.hasAttribute('data-mode')){d.chosen=t.value;dirty=true;}render();});
    render();refreshRates();if(stockOnly&&!frozen)frame.querySelector('[data-search]')?.focus({preventScroll:true});
  };
})(typeof window!=='undefined'?window:globalThis);
