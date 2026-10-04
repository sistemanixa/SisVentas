(function(root){
  'use strict';
  const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
  const valid=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const travelKeys=['bus','tolls','flight','border','cargo','packARS','night','nights','airport','food','days','other'];
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
    const saved=copy(ctx.saved||{}), p=Object.assign({usd:defaults.usd||'',usdt:defaults.usdt||'',payment:'USD',usdtPerUsd:1,shippingInsuredUSD:defaults.shippingUSD??'',shippingMode:'insured',fee:0,remoteOther:0,balance:0,valuation:'current',allocation:'value',retained:'',extraLogisticsUSD:0},defaults.travel||{},ctx.initial||{},saved.parameters||{});
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
          }else{selectProvider(r,pv);if(manual){r.agreed=agreed;r.manualPrice=true;}}
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
    if(!['remote','onsite'].includes(chosen))pending.push('Elegir modalidad de entrega');
    ['usd','usdt','usdtPerUsd','shippingInsuredUSD','remoteOther','tripTotalARS','fee','extraLogisticsUSD'].forEach(k=>{if(p[k]!==undefined&&p[k]!==''&&!valid(p[k]))pending.push('Importe inválido: '+k);});
    rows.forEach(r=>{if(!['exterior','local','stock'].includes(r.method))pending.push('Elegir destino: '+r.description);if(!valid(r.existing))pending.push('Revisar stock: '+r.description);r.include=r.method==='exterior';r.existing=r.method==='stock'?num(r.needed):num(r.existing);r.qty=r.method==='stock'?0:r.requestedQty==null?Math.max(0,num(r.needed)-r.existing):num(r.requestedQty);if(r.qty+r.existing>num(r.needed)||!valid(r.requestedQty??r.qty))pending.push('Revisar cantidad: '+r.description);if(r.qty+r.existing<num(r.needed))pending.push('Cantidad pendiente de resolver: '+r.description);r.baselinePart=r.qty*num(r.baselineUnit);r.providerOverride=true;});
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
      if(chosen==='remote'){
        if(!valid(p.shippingInsuredUSD))pending.push('Costo de envío (0 si no corresponde)');
        logistics=num(p.shippingInsuredUSD)*num(p.usd)+num(p.remoteOther);
      }else{
        if(!valid(p.tripTotalARS))pending.push('Costo total del viaje (0 si no corresponde)');
        logistics=num(p.tripTotalARS);
      }
      if(tokens){if(!valid(p.fee))pending.push('Comisión de pago USDT');logistics+=num(p.fee)*effectiveUSDT;}
    }
    const goods=active.reduce((s,r)=>s+r.qty*num(r.usd),0),allGoods=foreign.reduce((s,r)=>s+num(r.qty)*num(r.usd),0);
    const weights=foreign.map(r=>r.expenseExcluded?0:num(r.qty)*num(r.usd)),sum=weights.reduce((a,b)=>a+b,0);
    if(logistics>0&&!sum)pending.push('Elegir productos que participen en los gastos');
    let remaining=Math.round(logistics*100);const last=weights.reduce((a,w,i)=>w>0?i:a,-1);
    const costs=weights.map((w,i)=>{if(!w||!sum)return 0;const cents=i===last?remaining:Math.round(logistics*100*w/sum);remaining-=cents;return cents/100;});
    const alloc=active.map((r,i)=>num(r.qty)*num(r.usd)*(unitRate-num(p.usd))+costs[i]);
    extras.forEach(r=>{const i=foreign.indexOf(r);r.unitCostARS=r.include?num(r.usd)*unitRate+(num(r.qty)?num(costs[i])/num(r.qty):0):num(r.localUnitARS);});
    const extraTotal=extras.reduce((s,r)=>s+num(r.qty)*num(r.unitCostARS),0)+num(p.extraLogisticsUSD)*num(p.usd);
    const total=goods*unitRate+costs.slice(0,active.length).reduce((a,b)=>a+b,0);
    const localCostAdjustment=rows.filter(r=>!r.include&&r.qty>0).reduce((s,r)=>s+r.qty*(num(r.localUnitARS)-num(r.baselineUnit)),0);
    const retained=Math.max(0,num(p.baseline)-active.reduce((s,r)=>s+r.baselinePart,0))+localCostAdjustment;
    const revenue=num(p.revenue),profit=revenue-retained-total;
    const result={goods,remote:total,onsite:total,remoteAllocation:alloc,onsiteAllocation:alloc,localCostAdjustment,travel:chosen==='onsite'?logistics:0,remoteExtra:total-goods*num(p.usd),onsiteExtra:total-goods*num(p.usd),extraTotal,orderTotal:total+rows.filter(r=>!r.include).reduce((s,r)=>s+r.qty*num(r.localUnitARS),0)+extraTotal,retained,profit,margin:revenue?profit/revenue*100:null,allGoods,logistics,usedUSDT:used,freshUSDT:tokens?tokenTotal-used:0};
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
      if(r.method!=='stock'&&(!r.providerKey||!(num(r.agreed)>0)))return;
      if(r.method==='exterior'&&!(num(rate)>0))throw new Error('Falta la cotización del dólar para actualizar la venta.');
      const original=num(item.costoUnitarioAntesPreparacion??(costOfItem(item)/qty));
      const purchased=r.method==='stock'?0:r.requestedQty==null?Math.max(0,qty-num(r.existing)):num(r.requestedQty);
      if(purchased+num(r.existing)>qty)throw new Error('La cantidad supera lo necesario para la venta. Agregá el excedente como extra para stock.');
      const existing=qty-purchased;
      const unit=r.method==='exterior'?num(r.agreed)*num(rate):num(r.agreed);
      item.costoUnitarioAntesPreparacion=original;
      item.costoTotalCompra=Math.round((existing*original+(qty-existing)*unit)*100)/100;
      item.costoUnitarioCompra=item.costoTotalCompra/qty;
      delete item.costoUnitarioUSD;
      item.proveedorCompra=r.method==='stock'?'Stock disponible':r.provider;
      item.proveedorCompraKey=r.method==='stock'?'':r.providerKey;
      item.origenCompra=r.method==='exterior'?'Exterior':r.method==='stock'?'Stock':'Local';
      item.precioAcordadoCompra=r.method==='stock'?original:num(r.agreed);
      item.monedaCompra=r.method==='exterior'?'USD':'ARS';
      item.cotizacionCompra=r.method==='exterior'?num(rate):1;
    });
    next.costoTotal=items.reduce((sum,item)=>sum+num(costOfItem(item)),0);
    const revenue=num(income(next));next.margenPct=revenue?(revenue-next.costoTotal)/revenue*100:0;
    return next;
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
  const api={purchaseGroups,equivalentAmount,initialize,calculateDraft,providerLink,agreedSummary,applySaleCosts,productProviders,selectProvider,selectExterior};
  if(typeof module!=='undefined')module.exports=api;
  if(!root.document)return;
  root.SVExteriorPreparation=api;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>(Number(v)||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
  api.open=async function(ctx){
    if(!root.permisoModulo?.('balancecompra'))return;
    let defaults={};
    try{const [trip,shipping]=await Promise.all(['costosViaje','envioHabitual'].map(k=>root.fbGet(root.fbRef(root.fbDB,'sisventas/config/comprasParaguay/'+k))));defaults={travel:trip.val()||{},shippingUSD:shipping.val()?.usd};}catch(e){root.notify?.('No se pudieron cargar los gastos habituales. Podés completar los importes de esta compra.');}
    const quote=root.obtenerDolarReferenciaProducto?.()||{};defaults.usd=quote.valor;defaults.usdt=ctx.rates?.().usdt||'';Object.keys(defaults.travel?.monedas||{}).forEach(k=>{if(defaults.travel.monedas[k]==='USD'&&valid(defaults.travel[k]))defaults.travel[k]=num(defaults.travel[k])*num(quote.valor);});
    const d=initialize(ctx,defaults);const frozen=!!ctx.closed;
    if(frozen){d.rows=copy(ctx.saved.rows||[]);d.extras=copy(ctx.saved.extras||[]);d.parameters=copy(ctx.saved.parameters||{});}
    if(!frozen&&(!ctx.saved?.parameters||d.parameters.usdMode!=='manual'))d.parameters.usd=num(quote.valor)||d.parameters.usd;
    if(d.parameters.packARS===undefined&&d.parameters.pack!==undefined)d.parameters.packARS=num(d.parameters.pack)*num(d.parameters.usd);
    if(d.parameters.tripTotalARS===undefined){const p=d.parameters;d.parameters.tripTotalARS=travelKeys.some(k=>valid(p[k]))?['bus','tolls','flight','border','cargo','packARS','airport','other'].reduce((s,k)=>s+num(p[k]),0)+num(p.night)*num(p.nights)+num(p.food)*num(p.days):'';}
    let tab='products',renderedTab='',dirty=false,busy=false,status='';
    function editState(){
      const row=r=>[r.productKey,r.providerKey,r.method,num(r.agreed),r.method==='stock'?0:num(r.requestedQty??r.qty),num(r.existing),!!r.expenseExcluded];
      const parameters=Object.keys(d.parameters).sort().map(k=>[k,valid(d.parameters[k])?Number(d.parameters[k]):d.parameters[k]]);
      return JSON.stringify([d.rows.map(row),d.extras.map(row),parameters,d.chosen]);
    }
    let cleanState=editState();
    function refreshSaveState(){
      dirty=editState()!==cleanState;
      const button=frame.querySelector('[data-save]');
      const apply=frame.querySelector('[data-apply-exterior]');
      if(apply){apply.disabled=busy||frozen||![...d.rows,...d.extras].some(r=>r.method==='exterior'&&num(r.requestedQty??r.qty)>0);apply.textContent=busy?'Aplicando…':'Aplicar compra exterior';}
      if(button){button.disabled=busy||!dirty;button.textContent=busy?'Guardando…':'Guardar preparación';button.classList.toggle('ep-save-ready',dirty&&!busy);button.setAttribute('aria-busy',String(busy));}
    }
    const priorFocus=document.activeElement;
    const owner=String(root.currentUserUid||'');
    const el=document.createElement('section');el.id='py-planner';el.dataset.svEscapeOwner='';el.className='ep-modal';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Preparar compra');
    document.getElementById('py-planner')?.remove();document.body.appendChild(el);
    const style=document.createElement('style');style.textContent=`
      .ep-product-links{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:7px}.ep-product-links button{border:0;background:none;padding:0;color:var(--blue);font:inherit;font-size:12px;text-decoration:underline;cursor:pointer}.ep-modal{position:fixed;inset:12px;z-index:11000;background:var(--bg,#0c1422);color:var(--text);border:1px solid var(--border2);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 80px #0008}.ep-modal *{box-sizing:border-box}.ep-head,.ep-foot{padding:16px 22px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--bg2);border-bottom:1px solid var(--border)}.ep-head h2{font-size:20px;margin:0}.ep-head small{display:block;margin-top:5px;color:var(--text3)}.ep-head>div{flex:1}.ep-head .ep-head-total{flex:0 0 auto;text-align:right}.ep-head-total strong{display:block;margin-top:4px;color:var(--green)}.ep-head-total button{margin-bottom:6px}.ep-profit{display:flex;justify-content:center;gap:24px;text-align:center;flex:1}.ep-profit span{font-size:11px;color:var(--text3)}.ep-profit strong{display:block;font-size:17px;color:var(--green);margin-top:5px}@media(max-width:760px){.ep-profit{flex-basis:100%;order:-1}.ep-head .ep-head-total{width:100%}}.ep-tabs{display:flex;gap:8px;padding:12px 22px;background:var(--bg2)}.ep-tabs button[aria-selected=true]{color:var(--green);background:var(--green-bg);border-color:var(--green)}.ep-body{overflow:auto;min-height:0;flex:1;padding:18px 22px}.ep-foot{border-top:1px solid var(--border);border-bottom:0;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}.ep-foot-actions{display:flex;justify-content:flex-end;gap:8px}.ep-profit{grid-column:2;justify-self:center;align-items:center}.ep-profit .ep-profit-arrow{font-size:24px;color:var(--text3)}.ep-profit small{display:block;font-size:10px;margin-top:4px;white-space:nowrap}.ep-foot [data-save]:disabled{opacity:.4;cursor:default}.ep-foot .ep-save-ready{border-color:var(--green);color:var(--green);background:var(--green-bg)}@media(max-width:1100px){.ep-foot{grid-template-columns:1fr}.ep-profit{grid-column:1;grid-row:1}.ep-foot-actions{justify-content:flex-end;justify-self:end}.ep-foot [role=status]:empty{display:none}}.ep-foot [role=status]{flex:1;font-size:12px;color:var(--text3)}.ep-modal .btn-primary{background:var(--green-bg);color:var(--green);border:1px solid var(--green)}.ep-card{display:grid;grid-template-columns:minmax(230px,1.6fr) 65px minmax(105px,.7fr) minmax(130px,.8fr) minmax(110px,.7fr) minmax(180px,1fr);gap:14px;padding:12px 16px;margin-bottom:10px;border:1px solid var(--border);border-radius:13px;background:var(--bg2);align-items:center}.ep-product{display:flex;gap:12px;align-items:center}.ep-search-result{width:100%;text-align:left;margin:0;padding:10px;border-radius:0;white-space:normal}.ep-search-result+.ep-search-result{border-top:0}.ep-search-copy{flex:1;min-width:0}.ep-search-result strong{font-size:12px}.ep-search-age{font-size:9px;margin-top:3px}.ep-search-detail{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}.ep-search-price{flex:none;text-align:right;font-size:12px}.ep-search-price small{display:block}.ep-search-price .badge{font-size:9px}@media(max-width:600px){.ep-search-result{flex-wrap:wrap}.ep-search-price{margin-left:64px;text-align:left}}.ep-product img{width:52px;height:52px;object-fit:contain;border-radius:9px;background:white}.ep-product strong{font-size:14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.ep-item-options{grid-column:1/-1}.ep-item-options>summary{font-size:11px;color:var(--text3);width:fit-content}.ep-item-options[open]>summary{margin-bottom:10px}.ep-price{display:flex;gap:5px}.ep-price input{flex:1}.ep-price button{flex:none}.ep-item-options>small{margin-top:10px}.ep-modal small{color:var(--text3);font-size:11px;line-height:1.5}.ep-card small{display:block}.ep-modal label{display:flex;flex-direction:column;gap:7px;font-size:12px;color:var(--text2)}.ep-modal input,.ep-modal select{width:100%;min-width:0;min-height:38px}.ep-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ep-row>*{flex:1}.ep-options{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;border-top:1px solid var(--border);padding-top:10px}.ep-box{border:1px solid var(--border);background:var(--bg2);border-radius:12px;padding:18px;margin-bottom:14px}.ep-box h3{margin:0 0 14px;font-size:16px}.ep-box p{line-height:1.5;color:var(--text2)}.ep-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.ep-metric{padding:18px;background:var(--bg3);border-radius:12px}.ep-metric strong{display:block;font-size:24px;margin-top:8px;color:var(--green)}.ep-warning{color:var(--amber)!important}.ep-modal details>summary{cursor:pointer}.ep-modal [hidden]{display:none!important}@media(max-width:1100px){.ep-card{grid-template-columns:1fr 1fr}.ep-product{grid-column:1/-1}.ep-options{grid-template-columns:1fr 1fr}}@media(max-width:600px){.ep-modal{inset:0;border-radius:0}.ep-head,.ep-foot,.ep-tabs{padding:12px}.ep-body{padding:12px}.ep-head h2{font-size:17px}.ep-card{gap:12px;padding:12px}.ep-options,.ep-metrics{grid-template-columns:1fr}.ep-tabs .btn{flex:1;padding:8px 4px;font-size:12px}.ep-foot .btn{flex:1}.ep-foot [role=status]{flex-basis:100%}}
      .ep-foot{grid-template-columns:minmax(0,1fr) auto;column-gap:32px}.ep-foot>.ep-profit{grid-column:1;grid-row:1;justify-self:start;justify-content:flex-start;min-width:0}.ep-foot>.ep-foot-actions{grid-column:2;grid-row:1;justify-self:end}.ep-foot>[role=status]{grid-column:1/-1;grid-row:2}.ep-foot>[role=status]:empty{display:none}.ep-profit>span{max-width:285px}.ep-foot-actions .btn{white-space:nowrap}.ep-purchase-group>h3{margin:20px 0 12px;font-size:16px}.ep-purchase-group>h3 small{display:inline;font-weight:400;margin-left:8px}
      @media(max-width:1100px){.ep-foot{grid-template-columns:minmax(0,1fr)}.ep-foot>.ep-profit{grid-column:1;grid-row:1}.ep-foot>.ep-foot-actions{grid-column:1;grid-row:2}.ep-foot>[role=status]{grid-row:3}.ep-profit>span{max-width:240px}}@media(max-width:600px){.ep-foot{column-gap:12px}.ep-profit{gap:12px}.ep-profit small{white-space:normal}.ep-foot-actions{flex-wrap:wrap}.ep-foot-actions .btn{white-space:normal}}
    `;el.appendChild(style);
    const frame=document.createElement('div');frame.style.cssText='display:contents';el.appendChild(frame);
    const input=(key,value,label,extra='')=>'<label>'+esc(label)+'<input class="search-input" type="number" min="0" step="0.01" data-param="'+key+'" value="'+esc(value??'')+'" '+extra+'></label>';
    function providers(r){return productProviders(r,ctx.catalog);}
    function equivalentHTML(value,currency){const e=equivalentAmount(value,currency,d.parameters.usd);return e?'≈ '+e.currency+' '+money(e.amount):'Sin cotización';}
    function groupedCards(rows,extra){return purchaseGroups(rows).map(g=>'<section class="ep-purchase-group" data-purchase-group="'+(extra?'extra-':'')+g.method+'"><h3>'+g.title+' <small>'+g.items.length+' productos</small></h3>'+g.items.map(({row,index})=>card(row,index,extra)).join('')+'</section>').join('');}
    function card(r,i,extra){
      const currency=r.method==='exterior'?'USD':'ARS',id=(extra?'extra:':'row:')+i;
      const mode=extra?'Extra para stock':r.method==='stock'?'Stock disponible':r.method==='local'?'Compra local':'Compra exterior';
      const qty=extra?num(r.qty):r.method==='stock'?0:r.requestedQty==null?Math.max(0,num(r.needed)-num(r.existing)):num(r.requestedQty);
      const accept=r.method!=='stock'&&r.reference?.currency===currency&&r.reference?.providerKey===r.providerKey&&num(r.reference?.amount)>0&&!num(r.agreed);
      const link=providerLink(r,ctx.catalog,ctx.providers);
      return '<article data-card-id="'+id+'" class="ep-card"><div class="ep-product">'+(ctx.thumbnail?.(r)||'')+'<div><strong>'+esc(r.description)+'</strong></div></div>'+
        '<div><small>Cantidad</small>'+(extra?'<input class="search-input" aria-label="Cantidad extra" type="number" min="1" step="1" data-item="'+id+'" data-field="qty" value="'+r.qty+'">':'<input class="search-input" aria-label="Cantidad a comprar '+esc(r.code)+'" type="number" min="0" max="'+Math.max(0,num(r.needed)-num(r.existing))+'" step="any" data-item="'+id+'" data-field="requestedQty" value="'+qty+'" '+(r.method==='stock'?'disabled':'')+'>')+'</div>'+
        '<div><small>'+(r.reference?.converted?'Referencia convertida':'Precio leído')+'</small><strong>'+(num(r.reference?.amount)>0?esc(r.reference?.currency||currency)+' '+money(r.reference.amount):'Sin precio registrado')+'</strong>'+(r.reference?.converted?'<small>Según cotización guardada</small>':'')+(num(r.reference?.amount)>0?'<small>'+equivalentHTML(r.reference.amount,r.reference.currency||currency)+'</small>':'')+'</div>'+
        '<label>Precio acordado · '+currency+'<div class="ep-price"><input class="search-input" type="number" min="0.01" step="0.01" data-item="'+id+'" data-field="agreed" value="'+esc(r.agreed==null||r.agreed===''?'':Number(r.agreed).toFixed(2))+'" placeholder="Pendiente" '+(r.method==='stock'?'disabled':'')+'>'+(accept?'<button class="btn btn-sm" data-accept="'+id+'" title="Usar precio leído" aria-label="Usar precio leído">=</button>':'')+'</div><small data-unit-equivalent="'+id+'"></small></label>'+
        '<div><small>Total acordado</small><strong data-line-total="'+id+'"></strong><small data-total-equivalent="'+id+'"></small></div>'+
        '<div><label>Proveedor<select class="search-input" data-item="'+id+'" data-field="providerKey" '+(r.method==='stock'?'disabled':'')+'><option value="">Seleccionar</option>'+providers(r).map(v=>'<option value="'+esc(v.proveedorKey)+'" '+(r.providerKey===v.proveedorKey?'selected':'')+'>'+esc(v.nombre)+'</option>').join('')+'</select></label><div class="ep-product-links">'+(link?'<a href="'+esc(link.url)+'" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--blue)">'+esc(link.label)+' ↗</a>':'<small>Sin enlace del proveedor</small>')+(root.permisoModulo?.('productos')?'<button type="button" data-product-sheet="'+id+'">Ver producto</button>':'')+'</div></div>'+
        '<details class="ep-item-options"><summary>'+mode+' · Opciones</summary><div class="ep-options">'+
        (extra?'<button class="btn" data-remove="'+i+'">Quitar extra</button>':'<label>Cómo resolverlo<select class="search-input" data-item="'+id+'" data-field="method">'+[['exterior','Compra exterior'],['local','Compra local'],['stock','Usar stock disponible']].map(([v,t])=>'<option value="'+v+'" '+(r.method===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Usar del stock · disponible '+num(ctx.available?.(r))+'<input class="search-input" type="number" min="0" max="'+num(r.needed)+'" step="1" data-item="'+id+'" data-field="existing" value="'+(r.method==='stock'?num(r.needed):num(r.existing))+'" '+(r.method==='stock'?'disabled':'')+'></label>')+
        (r.method==='exterior'?'<label style="flex-direction:row;align-items:center"><input style="width:auto;min-height:0" type="checkbox" data-item="'+id+'" data-field="expenseExcluded" '+(!r.expenseExcluded?'checked':'')+'>Participa en gastos compartidos</label>':'')+
        '</div><small>'+esc(r.code)+' · '+esc(r.saleLabel||ctx.customer||'Stock general')+' · Referencia: '+esc(r.reference?.provider||'Sin proveedor')+' · '+esc(r.reference?.date||'Sin fecha de consulta')+'</small></details></article>';
    }

    function render(){const scroll=renderedTab===tab?(frame.querySelector('.ep-body')?.scrollTop||0):0;renderedTab=tab;const expanded=Array.from(frame.querySelectorAll('.ep-item-options')).filter(el=>el.open).map(el=>el.closest('[data-card-id]').dataset.cardId);const s=frozen?Object.assign({},copy(ctx.saved),{hasForeign:d.rows.some(r=>r.include&&r.qty>0)||d.extras.length>0}):calculateDraft(d),p=d.parameters;const used={};d.rows.forEach(r=>{const k=r.productKey||r.code;used[k]=num(used[k])+(r.method==='stock'?num(r.needed):num(r.existing));});const shortages=d.rows.filter((r,i,a)=>a.findIndex(x=>(x.productKey||x.code)===(r.productKey||r.code))===i&&num(used[r.productKey||r.code])>num(ctx.available?.(r)));if(!frozen)shortages.forEach(r=>s.pending.push('Stock insuficiente: '+r.description));s.complete=!s.pending.length;
      let body='';
      if(tab==='products')body='<div style="margin-bottom:14px"><button class="btn" data-all-exterior>Usar proveedores del exterior</button></div>'+groupedCards(d.rows,false)+(d.extras.length?'<h3>Extras para stock</h3>'+groupedCards(d.extras,true):'')+(d.extras.length?'<div class="ep-box">'+input('extraLogisticsUSD',d.parameters.extraLogisticsUSD,'Gastos exclusivos de extras · USD')+'</div>':'')+'<details class="ep-box"><summary>Agregar extras para stock</summary><label>Buscar producto<div class="ep-row"><input class="search-input" data-search placeholder="Nombre o código"><button class="btn" style="flex:0 0 42px" data-search-modal aria-label="Abrir buscador de productos"><i class="ti ti-search"></i></button></div></label><div data-extra-results></div></details>';
      if(tab==='delivery')body=!s.hasForeign?'<div class="ep-box"><h3>Compra local y stock</h3><p>Este pedido no requiere gastos de envío o viaje al exterior. Continúa en Órdenes de compra.</p></div>':'<div class="ep-box"><h3>Entrega</h3><label>Modalidad<select class="search-input" data-mode><option value="remote" '+(d.chosen==='remote'?'selected':'')+'>Recibir con envío</option><option value="onsite" '+(d.chosen==='onsite'?'selected':'')+'>Ir a buscar</option></select></label><div class="ep-row" style="margin-top:16px">'+(d.chosen==='remote'?input('shippingInsuredUSD',p.shippingInsuredUSD,'Envío y seguro · USD')+input('remoteOther',p.remoteOther,'Otros gastos del envío · ARS'):input('tripTotalARS',p.tripTotalARS,'Costo total del viaje · ARS'))+'</div><small>Los gastos se cargan una sola vez y se reparten por el valor de los productos que participan, incluidos los extras.</small></div><div class="ep-box"><h3>Pago y cotización</h3><label>Pago de la mercadería<select class="search-input" data-param="payment"><option '+(p.payment==='USD'?'selected':'')+' value="USD">Dólares</option><option '+(p.payment==='USDT'?'selected':'')+' value="USDT">USDT</option></select></label><details style="margin-top:16px"><summary>Dólar '+esc(quote.tipo||'configurado')+' · $ '+money(p.usd)+'</summary>'+input('usd',p.usd,'Pesos por dólar · modificar sólo para esta compra')+'</details>'+(p.payment==='USDT'?'<div class="ep-row" style="margin-top:16px">'+input('usdt',p.usdt,'Pesos por USDT')+input('usdtPerUsd',p.usdtPerUsd,'USDT que acepta el proveedor por cada USD')+input('fee',p.fee,'Comisión de pago · USDT')+'</div><small>La relación de pago la confirma el proveedor. No se deduce de la diferencia entre cotizaciones en pesos.</small><details style="margin-top:16px"><summary>Saldo USDT disponible y valoración</summary><div class="ep-row">'+input('balance',p.balance,'Saldo disponible · USDT')+'<label>Valoración<select class="search-input" data-param="valuation"><option value="current" '+(p.valuation==='current'?'selected':'')+'>Cotización actual</option><option value="historic" '+(p.valuation==='historic'?'selected':'')+'>Costo histórico</option></select></label>'+input('historic',p.historic,'Costo histórico · ARS/USDT')+'</div><p>Para completar el pago: '+money(s.result.freshUSDT)+' USDT por comprar.</p></details>':'')+'</div>';
      if(tab==='summary')body='<div class="ep-metrics"><div class="ep-metric"><small>Venta sin IVA</small><strong>$ '+money(p.revenue)+'</strong></div><div class="ep-metric"><small>Costo previsto de la venta</small><strong>$ '+money(s.result.retained+s.result[s.chosen])+'</strong></div><div class="ep-metric"><small>Margen proyectado</small><strong>'+(s.result.margin===null?'—':s.result.margin.toLocaleString('es-AR',{maximumFractionDigits:2})+'%')+'</strong></div></div><div class="ep-box" style="margin-top:14px"><p>Ganancia proyectada: <strong>$ '+money(s.result.profit)+'</strong></p><p>Costo base de la venta: $ '+money(p.baseline)+'. La venta conserva su importe acordado con el cliente.</p><p>Pedido completo: <strong>$ '+money(s.result.orderTotal)+'</strong> · incluye $ '+money(s.result.extraTotal)+' de extras para stock, separados del margen de la venta.</p><p>Confirmar genera órdenes y reserva el stock indicado. La recepción registra lo recibido y actualiza los costos reales.</p></div>'+(s.pending.length?'<div class="ep-box ep-warning"><strong>Falta completar</strong><ul>'+s.pending.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></div>':'<p>Pedido listo para confirmar.</p>');
      if(tab==='summary'&&s.hasForeign&&!frozen){
        const other=calculateDraft(Object.assign({},d,{chosen:d.chosen==='remote'?'onsite':'remote'}));
        body+='<details class="ep-box"><summary>Comparar envío y viaje</summary><div class="ep-row" style="margin-top:14px">'+input('shippingInsuredUSD',p.shippingInsuredUSD,'Envío y seguro · USD')+input('tripTotalARS',p.tripTotalARS,'Costo total del viaje · ARS')+'</div><p>Alternativa '+(d.chosen==='remote'?'viaje':'envío')+': $ '+money(other.result.orderTotal)+' para el pedido completo.'+(other.pending.length?' Estimación pendiente de completar.':'')+'</p><small>La modalidad elegida se cambia en Entrega y pago.</small></details>';
      }
      frame.innerHTML='<header class="ep-head"><div><h2>Preparar compra · '+esc(ctx.customer||ctx.saleId)+'</h2><small>'+d.rows.length+' productos de venta · '+d.extras.length+' extras</small></div><div class="ep-head-total"><button class="btn" data-close>Volver</button><div data-agreed-total></div></div></header><nav class="ep-tabs">'+[['products','Productos'],['delivery','Entrega y pago'],['summary','Resumen']].map(([k,t])=>'<button class="btn" data-tab="'+k+'" aria-selected="'+(tab===k)+'">'+t+'</button>').join('')+'</nav><main class="ep-body">'+body+'</main><footer class="ep-foot"><span role="status">'+esc(status)+'</span><div class="ep-profit" data-profit></div><div class="ep-foot-actions"><button class="btn btn-primary" data-apply-exterior>Aplicar compra exterior</button><button class="btn" data-save aria-live="polite">Guardar preparación</button><button class="btn btn-primary" '+(tab==='summary'?'data-confirm '+(!s.complete?'disabled':''):'data-next')+'>'+(tab==='summary'?'Confirmar compra':'Ver resumen')+'</button></div></footer>';
      refreshAmounts();refreshSaveState();
      frame.querySelector('.ep-body').scrollTop=scroll;
      frame.querySelectorAll('[data-card-id]').forEach(card=>{if(expanded.includes(card.dataset.cardId))card.querySelector('.ep-item-options').open=true;});
      if(frozen){frame.querySelector('[role=status]').textContent='Compra confirmada · valores conservados';frame.querySelector('[data-apply-exterior]')?.remove();frame.querySelector('[data-save]')?.remove();frame.querySelector('[data-confirm]')?.remove();const button=document.createElement('button');button.className='btn';button.textContent='Ver órdenes';button.dataset.orders='';frame.querySelector('.ep-foot-actions').appendChild(button);frame.querySelectorAll('input,select,[data-accept],[data-remove],[data-add],[data-all-exterior],[data-search-modal]').forEach(c=>c.disabled=true);}
      frame.querySelectorAll('button,input,select').forEach(c=>{if(busy)c.disabled=true;});return s;
    }
    function refreshAmounts(){
      const totals=agreedSummary(d);
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
      if(header)header.innerHTML='<small>Total de productos · sin logística'+(totals.missing?' · parcial':'')+'</small><strong>ARS $ '+money(totals.ars)+'</strong><small>USD '+(totals.usd===null?'—':money(totals.usd))+' · USDT '+(totals.usdt===null?'sin cotización':money(totals.usdt))+'</small><small>Exterior: USD '+money(totals.foreignUSD)+' · Local: ARS '+money(totals.localARS)+'</small>';
      const equivalents=value=>'<small>USD '+(num(d.parameters.usd)?money(value/num(d.parameters.usd)):'—')+' · USDT '+(num(d.parameters.usdt)?money(value/num(d.parameters.usdt)):'—')+'</small>';
      if(footer)footer.innerHTML='<span>Ganancia anterior<strong>$ '+money(totals.before)+'</strong>'+equivalents(totals.before)+'</span><span class="ep-profit-arrow" aria-label="cambia a">→</span><span>Ganancia con cambios · sin logística'+(totals.quantityPending?' · falta resolver cantidades':totals.missing?' · parcial':'')+'<strong>$ '+(totals.missing?'Pendiente':money(totals.after))+'</strong>'+(totals.missing?'':equivalents(totals.after))+'</span>';
    }
    function refreshRates(){if(frozen||d.parameters.usdtExchange==='manual')return;const value=ctx.rates?.().usdt;if(num(value)>0){const wasClean=editState()===cleanState;d.parameters.usdt=value;if(wasClean)cleanState=editState();refreshAmounts();refreshSaveState();}}
    document.addEventListener('sisventas:usdt-quote',refreshRates);
    frame.addEventListener('input',e=>{
      const t=e.target;if(busy||frozen||!t.dataset.item)return;
      const field=t.dataset.field;if(!['agreed','requestedQty','qty'].includes(field))return;
      const row=rowFor(t.dataset.item);row[field]=t.value;if(field==='agreed')row.manualPrice=true;dirty=true;status='';refreshAmounts();
      frame.querySelector('[role=status]').textContent='';refreshSaveState();
    });
    async function save(confirm,applyExterior=false){if(busy||frozen||(!confirm&&!applyExterior&&editState()===cleanState))return;status='';const s=render();if(confirm&&!s.complete)return;if(ctx.isClosed?.()||String(root.currentUserUid||'')!==owner){root.notify?.('La sesión o la compra cambió. Volvé a abrirla.');return;}busy=true;render();try{const snapshot=Object.assign({},d.saved,s,{updatedAt:Date.now(),updatedBy:root.currentUser||''});delete snapshot.hasForeign;if(applyExterior||confirm){const foreign=[...(snapshot.rows||[]),...(snapshot.extras||[])].filter(r=>r.method==='exterior'&&num(r.qty)>0);if(applyExterior&&!foreign.length)throw new Error('Elegí al menos un producto para comprar en el exterior.');if(foreign.some(r=>!r.providerKey||!(num(r.agreed)>0))||(foreign.length&&!(num(snapshot.parameters.usd)>0)))throw new Error('Completá proveedor, precio acordado y cotización de los productos del exterior.');snapshot.exteriorAppliedAt=Date.now();snapshot.exteriorAppliedBy=owner;}await ctx.save(snapshot);d.saved=copy(snapshot);cleanState=editState();dirty=false;if(confirm){await ctx.confirm(snapshot);close(true);}else{status=applyExterior?'Compra exterior aplicada. Ítems marcados en la venta y disponibles en Compras de exterior.':'';render();}}catch(e){render();status=root.SVGuardedWrites?.errorMessage(e)||e.message;}finally{busy=false;if(el.isConnected)render();}}
    function close(force){if(busy&&!force)return;if(!force&&dirty&&!root.confirm('Hay cambios sin guardar. ¿Salir de la preparación?'))return;el.remove();document.removeEventListener('sisventas:usdt-quote',refreshRates);document.removeEventListener('sisventas:session-ended',sessionEnded);document.removeEventListener('keydown',onEscape);if(priorFocus?.isConnected)priorFocus.focus();}
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
    function onEscape(event){if(!el.isConnected||productSheet)return;if(event.key==='Escape'&&el.querySelector('.ep-extra-search')){event.preventDefault();event.stopImmediatePropagation();el.querySelector('.ep-extra-search').remove();return;}if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}}document.addEventListener('keydown',onEscape);
    function sessionEnded(){returnFromProduct();close(true);}document.addEventListener('sisventas:session-ended',sessionEnded);
    function rowFor(id){const [kind,index]=id.split(':');return (kind==='row'?d.rows:d.extras)[Number(index)];}
    frame.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||busy)return;if(b.dataset.productSheet)return openProductSheet(rowFor(b.dataset.productSheet));if(b.hasAttribute('data-close'))return close();if(b.hasAttribute('data-orders')){close();ctx.openOrders?.();return;}if(b.dataset.tab){tab=b.dataset.tab;render();}if(b.hasAttribute('data-next')){tab='summary';render();}if(b.hasAttribute('data-apply-exterior'))save(false,true);if(b.hasAttribute('data-save'))save(false);if(b.hasAttribute('data-confirm'))save(true);if(b.dataset.accept&&!frozen){const r=rowFor(b.dataset.accept);r.agreed=r.reference.amount;status='';dirty=true;render();}if(b.dataset.remove!==undefined&&!frozen){d.extras.splice(Number(b.dataset.remove),1);dirty=true;render();}if(b.hasAttribute('data-all-exterior')&&!frozen){const count=selectExterior(d.rows,ctx.catalog);dirty=true;status=count+' productos con proveedor del exterior';render();}if(b.hasAttribute('data-search-modal')&&!frozen){openExtraSearch();}if(b.dataset.add&&!frozen)addExtra(b.dataset.add);});
    function addExtra(key){
      if(busy||frozen)return;
      const product=(ctx.catalog||[]).find(p=>String(p.key)===String(key));
      if(!product){root.notify?.('No se encontró el producto. Volvé a buscarlo.');return;}
      const options=product.providers||[],pv=options.find(p=>p.exterior&&p.activo!==false&&p.disponible!==false)||options.find(p=>p.activo!==false&&p.disponible!==false);
      const added={key:'extra-'+Date.now(),productKey:product.key,code:product.code,description:product.description,method:'local',destination:'stock',include:false,qty:1,agreed:'',reference:{amount:0,currency:'ARS'}};
      selectProvider(added,pv);d.extras.push(added);dirty=true;render();
      const card=frame.querySelector('[data-item="extra:'+ (d.extras.length-1) +'"]')?.closest('.ep-card');
      card?.scrollIntoView({block:'center',behavior:'smooth'});
      root.notify?.('Agregado para stock. Guardá la preparación para conservarlo.');
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
    function openExtraSearch(){
      const box=document.createElement('div');box.className='ep-extra-search';box.style.cssText='position:absolute;inset:20px;z-index:2;background:var(--bg,#0c1422);border:1px solid var(--border);border-radius:12px;padding:20px;display:flex;flex-direction:column';
      box.innerHTML='<div class="ep-row"><h3>Agregar extras para stock</h3><button class="btn" data-close-search style="flex:none">Cerrar</button></div><input class="search-input" data-large-search placeholder="Buscar por nombre o código" aria-label="Buscar extras"><div data-large-results style="overflow:auto;flex:1"></div>';
      el.appendChild(box);const input=box.querySelector('input'),results=box.querySelector('[data-large-results]');results.innerHTML=extraResults('',80);input.oninput=()=>results.innerHTML=extraResults(input.value,80);
      box.onclick=e=>{const button=e.target.closest('button');if(!button)return;if(button.hasAttribute('data-close-search')){box.remove();return;}if(button.dataset.add){box.remove();addExtra(button.dataset.add);}};
      input.focus();
    }
    frame.addEventListener('input',e=>{if(!e.target.hasAttribute('data-search'))return;frame.querySelector('[data-extra-results]').innerHTML=e.target.value.trim()?extraResults(e.target.value,12):'';});
    frame.addEventListener('change',e=>{const t=e.target;if(busy||frozen)return;if(!t.dataset.item&&!t.dataset.param&&!t.hasAttribute('data-mode'))return;status='';if(t.dataset.item&&['agreed','requestedQty','qty'].includes(t.dataset.field)){refreshAmounts();refreshSaveState();return;}if(t.dataset.item){const r=rowFor(t.dataset.item),field=t.dataset.field;if(field==='providerKey'){const pv=providers(r).find(p=>p.proveedorKey===t.value);selectProvider(r,pv);}else if(field==='method'){delete r.requestedQty;r.method=t.value;r.include=t.value==='exterior';r.existing=t.value==='stock'?num(r.needed):0;r.agreed='';const choices=providers(r).filter(v=>!!v.exterior===(t.value==='exterior'));const pv=choices.find(v=>v.proveedorKey===r.reference?.providerKey)||choices[0];if(t.value!=='stock')selectProvider(r,pv);}else r[field]=field==='expenseExcluded'?!t.checked:t.value;if(field==='agreed')r.manualPrice=true;dirty=true;}if(t.dataset.param){d.parameters[t.dataset.param]=t.value;if(t.dataset.param==='usd')d.parameters.usdMode='manual';if(t.dataset.param==='usdt')d.parameters.usdtExchange='manual';dirty=true;}if(t.hasAttribute('data-mode')){d.chosen=t.value;dirty=true;}render();});
    render();refreshRates();
  };
})(typeof window!=='undefined'?window:globalThis);
