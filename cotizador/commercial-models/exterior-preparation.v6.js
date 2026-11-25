(function(root){
  'use strict';
  const Money=typeof module==='object'&&module.exports?require('./commercial-money'):root.SVCommercialMoney;
  const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
  const valid=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0;
  const copy=v=>JSON.parse(JSON.stringify(v));
  function localSavingsCard(value,rate){
    const amount=value?.savingARS,known=typeof amount==='number'&&Number.isFinite(amount),negative=known&&amount<0;
    const money=v=>Number(v).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
    return '<div class="ep-box ep-local-savings" style="margin-top:14px"><small>'+(negative?'Mayor costo frente a compra local':'Ahorro total frente a compra local')+'</small><strong style="display:block;font-size:24px;color:var(--'+(negative?'red':'green')+')">'+(known?'$ '+money(Math.abs(amount)):'Por completar')+'</strong>'+(known?(Number(rate)>0?'<small>USD '+money(Math.abs(amount)/Number(rate))+'</small>':'')+'<p>Costo local de referencia menos costo final del exterior, incluidos los gastos.</p>':'<p>Falta la referencia de costo local'+(Number(value?.missing)>0?' de '+Number(value.missing)+' productos':' o completar los costos del pedido')+'.</p>')+(Number(value?.currentReferences)>0?'<small>'+Number(value.currentReferences)+' referencias de costo actual</small>':'')+'</div>';
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
  function currentLocalReference(providers,at,uid){
    const selected=(providers||[]).filter(p=>p.exterior===false&&p.activo!==false&&Number.isFinite(p.costo)&&p.costo>0).sort((a,b)=>Number(b.disponible!==false)-Number(a.disponible!==false)||a.costo-b.costo)[0];
    return selected?{amount:selected.costo,currency:'ARS',basis:'current',capturedAt:at,capturedBy:uid||'',providerKey:selected.proveedorKey||'',provider:selected.nombre||'',priceDate:selected.actualizado||''}:null;
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
    row.agreed=amount>0?amount:'';
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
  function reviewLegacyPreparation(saved,sources=[]){
    const fail=message=>{throw Object.assign(Error('Preparación v5: '+message+' No se guardaron cambios.'),{code:'SV_PURCHASE_LEGACY_REVIEW'});};
    if(saved?.version!==5||!saved.parameters||!Array.isArray(saved.rows)||!Array.isArray(saved.extras))fail('faltan decisiones originales completas.');
    const p=copy(saved.parameters),chosen=saved.previewChoice||saved.chosen;
    if(!['remote','onsite'].includes(chosen)||saved.previewChoice&&saved.chosen&&saved.previewChoice!==saved.chosen)fail('revisá la modalidad de entrega original.');
    if(p.allocation!=='value'||[...saved.rows,...saved.extras].some(r=>r.expenseExcluded===true))fail('el reparto manual, por cantidad o con exclusiones requiere revisión individual.');
    if(!['insured','uninsured'].includes(p.shippingMode))fail('falta identificar el envío elegido.');
    for(const field of ['shipping','shippingPct','insurance'])if(p[field]!==undefined&&(!valid(p[field])||num(p[field])!==0))fail('el envío antiguo '+field+' no tiene equivalencia inequívoca.');
    // These are the exact v5 form aliases: remote paid USDT, onsite paid USD.
    if(p.payment===undefined)p.payment=chosen==='remote'?'USDT':'USD';
    if(!['USD','USDT'].includes(p.payment))fail('revisá la moneda de pago original.');
    // Unknown quotes remain blank decisions, never live rates or invented 1:1.
    for(const field of ['usd','usdt','usdtPerUsd'])if(p[field]===undefined)p[field]='';
    p.usdMode='manual';p.usdtExchange='manual';p.expensesInitialized=true;
    const number=value=>value===''?'':typeof value==='number'&&Number.isFinite(value)&&value>=0?value:typeof value==='string'&&/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)&&Number.isFinite(Number(value))?Number(value):fail('hay cantidades o importes que necesitan revisión.');
    const keys=new Set(),sourceKeys=new Set(sources.map(r=>r.key));
    function row(r,extra){
      if(!r||typeof r!=='object'||(!extra&&(!sourceKeys.has(r.key)||keys.has(r.key))))fail('un renglón no coincide con su captura original.');
      if(!extra)keys.add(r.key);
      if(r.expenseExcluded===true)fail('hay exclusiones de gastos.');
      const method=r.method||(typeof r.include==='boolean'?(r.include?'exterior':'local'):null);
      if(!['local','exterior','stock'].includes(method)||extra&&method==='stock')fail('falta resolver el destino de un material.');
      if(typeof r.include==='boolean'&&method!=='stock'&&r.include!==(method==='exterior'))fail('el destino y la selección del material se contradicen.');
      const agreed=r.agreed??(method==='exterior'?r.usd:r.localUnitARS)??'',quantity=r.requestedQty??r.qty;
      if(quantity===undefined||r.existing===undefined&&!extra)fail('faltan cantidades originales.');
      if(method!=='stock'&&(typeof r.providerKey!=='string'||!r.providerKey))fail('falta identificar el proveedor original.');
      if(extra&&(typeof r.productKey!=='string'||!r.productKey))fail('falta identificar el producto extra.');
      return {...copy(r),method,include:method==='exterior',agreed:number(agreed),...(extra?{qty:number(quantity)}:{requestedQty:number(quantity),existing:number(r.existing)}),manualPrice:true,reference:{...(r.reference||{}),amount:number(agreed),currency:method==='exterior'?'USD':'ARS',providerKey:r.providerKey||'',provider:r.provider||''}};
    }
    const rows=saved.rows.map(r=>row(r,false)),extras=saved.extras.map(r=>row(r,true));
    if(keys.size!==sourceKeys.size)fail('faltan renglones capturados; no se completan con catálogo.');
    // Carry decisions only; no result, historical author or cost application stamp.
    return {version:6,parameters:p,rows,extras,chosen,previewChoice:chosen};
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
      if(!ctx.reviewLegacy&&!source.include&&!r.reference.amount)r.reference.amount=source.localUnitARS||r.baselineUnit;
      r.agreed=r.agreed??(prior?(r.include?r.usd:r.localUnitARS??r.baselineUnit):'');
      if(ctx.catalog&&!ctx.reviewLegacy){
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
      if(valid(r.agreed))r.agreed=num(r.agreed);
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
    const costs=sum?Money.allocate(logistics,weights):weights.map(()=>0);
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
      const original=item.costoUnitarioAntesPreparacion??item.costoCompraAnterior??item.costoUnitarioPresupuestado??(costOfItem(item)/qty);
      if(typeof original!=='number'||!Number.isFinite(original)||original<0)throw new Error('Falta el costo histórico capturado; no se tomó como cero.');
      const purchased=r.method==='stock'?0:r.requestedQty==null?Math.max(0,qty-num(r.existing)):num(r.requestedQty);
      if(purchased+num(r.existing)>qty)throw new Error('La cantidad supera lo necesario para la venta. Agregá el excedente como extra para stock.');
      const existing=qty-purchased;
      const unit=r.unitCostARS!=null&&r.unitCostARS!==''?num(r.unitCostARS):r.method==='exterior'?num(r.agreed)*num(rate):num(r.agreed);
      if(r.method!=='stock'&&!(unit>0))throw new Error('Falta el costo final acordado: '+r.code);
      item.costoUnitarioAntesPreparacion=original;
      item.preparacionCompra={cantidadStock:existing,costoStockUnitario:original,cantidadComprar:purchased,costoCompraUnitario:unit};
      // Budget captures are raw, current-plan values. Historical original cost
      // remains above; accounting rounds the combined total exactly once.
      const parts=[Money.rawProduct(existing,original),Money.rawProduct(purchased,unit)];
      item.costoTotalPresupuestado=Money.quantitySum(parts);
      item.costoUnitarioPresupuestado=item.costoTotalPresupuestado/qty;
      item.costoTotalCompra=Money.sum(parts);
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
    next.costoTotal=Money.sum(items.map(item=>{const value=costOfItem(item);if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error('Falta el costo corriente capturado; no se tomó como cero.');return value;}));
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
  const api={reviewLegacyPreparation,currentLocalReference,previousExpenses,remoteTotal,tripTotal,hasExpenses,priceDifference,priceDifferenceTotals,orderForExport,pdfRows,revisePDF,purchaseGroups,equivalentAmount,initialize,calculateDraft,providerLink,agreedSummary,applySaleCosts,productProviders,selectProvider,selectExterior};
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
