(function(root){
  'use strict';
  let sequence=0;
  const svg={
    back:'<path d="m12 5-7 7 7 7M5 12h14"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L6 21"/>',
    saved:'<path d="m5 12 4 4L19 6"/>',
    warning:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>'
  };
  function icon(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+svg[name]+'</svg>';}
  function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text??'');return el;}
  function button(label,name,className){const el=node('button','sv-bp-button '+(className||''));el.type='button';el.innerHTML=icon(name);el.appendChild(node('span','sv-bp-button-label',label));return el;}
  function textIfChanged(el,value){const text=String(value??'');if(el.textContent!==text)el.textContent=text;}
  function hiddenIfChanged(el,value){if(el.hidden!==value)el.hidden=value;}
  function attributeIfChanged(el,name,value){if(el.getAttribute(name)!==value)el.setAttribute(name,value);}
  function numeric(value){return value!==null&&value!==undefined&&value!==''&&typeof value!=='boolean'&&Number.isFinite(Number(value))?Number(value):null;}
  function amount(value,currency){const number=numeric(value);if(number===null)return '—';const unit=String(currency||'').toUpperCase();const formatted=new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(number);return (unit==='ARS'?'$':unit||'$')+' '+formatted;}
  function quantity(value){const number=numeric(value);return number===null?'—':new Intl.NumberFormat('es-AR',{maximumFractionDigits:8}).format(number);}
  function imageURL(value){if(typeof value!=='string')return '';const text=value.trim();if(/^(?:https?:\/\/|blob:|data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,)/i.test(text))return text;if(text&&!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(text)&&!/[\u0000-\u001f]/.test(text))return text;return '';}
  function statusOf(value){
    const text=String(value||'').trim(),aliases={saved:'Versión guardada',draft:'En edición',editing:'En edición',offline:'Sin conexión',paused:'En pausa',ended:'Edición finalizada'};
    const label=aliases[text]||(['Versión guardada','En edición','Sin conexión','En pausa','Edición finalizada'].includes(text)?text:'Presupuesto');
    return {label,kind:label==='Sin conexión'?'offline':label==='En pausa'||label==='Edición finalizada'?'paused':label==='En edición'?'editing':'saved'};
  }
  function updatedText(value){
    if(value===true)return 'Actualizado ahora';
    if(value instanceof Date||typeof value==='number'){const date=new Date(value);return Number.isFinite(date.getTime())?'Actualizado '+date.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'';}
    return typeof value==='string'?value:'';
  }
  function create(options){
    options=options||{};
    const id='sv-budget-presentation-'+(++sequence),element=node('dialog','sv-bp-dialog');
    element.setAttribute('aria-labelledby',id+'-title');element.setAttribute('aria-describedby',id+'-client');
    const frame=node('div','sv-bp-frame'),header=node('header','sv-bp-header'),toolbar=node('div','sv-bp-toolbar'),back=button('Volver','back','sv-bp-back'),actions=node('div','sv-bp-actions');
    const saved=button('Ver versión guardada','saved','sv-bp-saved'),fullscreen=button('Pantalla completa','fullscreen','sv-bp-fullscreen'),exit=button('Cerrar','close','sv-bp-close');
    exit.setAttribute('aria-label','Cerrar visualizador');exit.title='Cerrar visualizador';
    fullscreen.setAttribute('aria-pressed','false');fullscreen.hidden=typeof options.onFullscreen!=='function';saved.hidden=true;
    actions.append(saved,fullscreen,exit);toolbar.append(back,actions);
    const heading=node('div','sv-bp-heading'),headingText=node('div','sv-bp-heading-text'),number=node('p','sv-bp-number'),title=node('h1','sv-bp-title'),client=node('p','sv-bp-client'),meta=node('div','sv-bp-meta'),status=node('span','sv-bp-status'),updated=node('span','sv-bp-updated');
    title.id=id+'-title';client.id=id+'-client';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
    headingText.append(number,title,client);meta.append(status,updated);heading.append(headingText,meta);
    const choices=node('label','sv-bp-choices'),choicesText=node('span','','Elegí la edición'),select=node('select','sv-bp-select');select.setAttribute('aria-label','Elegí la edición del presupuesto');choices.append(choicesText,select);choices.hidden=true;
    header.append(toolbar,heading,choices);
    const content=node('div','sv-bp-content');content.tabIndex=0;content.setAttribute('aria-label','Productos del presupuesto');
    const warning=node('div','sv-bp-warning'),warningText=node('p');warning.innerHTML=icon('warning');warning.appendChild(warningText);warning.hidden=true;
    const list=node('div','sv-bp-items');list.setAttribute('role','list');content.append(warning,list);
    const footer=node('footer','sv-bp-footer'),summary=node('dl','sv-bp-summary'),totalBox=node('div','sv-bp-total'),totalLabel=node('span','sv-bp-total-label','Total'),totalValue=node('strong','sv-bp-total-value','—');
    totalBox.append(totalLabel,totalValue);footer.append(summary,totalBox);frame.append(header,content,footer);element.appendChild(frame);
    let closed=false,opened=false,previous=null,scrollX=0,scrollY=0,lock=null,itemViews=new Map(),optionViews=new Map(),emptyItem=null;
    function showWarning(text){warningText.textContent=String(text||'');warning.hidden=!text;}
    function invoke(handler,args,message){try{const result=handler?.apply(null,args||[]);if(result&&typeof result.catch==='function')result.catch(()=>{if(!closed)showWarning(message);});}catch(_){if(!closed)showWarning(message);}}
    function release(){
      if(closed)return;closed=true;
      document.removeEventListener('fullscreenchange',fullscreenState);
      if(opened&&lock){
        for(const [el,value,priority]of lock)if(el){if(value)el.style.setProperty('overflow',value,priority);else el.style.removeProperty('overflow');}
        if(typeof root.scrollTo==='function')root.scrollTo(scrollX,scrollY);
      }
      element.remove();
      if(previous?.isConnected&&typeof previous.focus==='function'){try{previous.focus({preventScroll:true});}catch(_){previous.focus();}}
      invoke(options.onClose,[],'');
    }
    function close(){
      if(closed)return;
      if(document.fullscreenElement===element&&typeof document.exitFullscreen==='function'){try{Promise.resolve(document.exitFullscreen()).catch(()=>{});}catch(_){/* Cerrar sigue disponible fuera de pantalla completa. */}}
      if(element.open){try{element.close();}finally{release();}}else release();
    }
    function fullscreenState(){const active=document.fullscreenElement===element;fullscreen.setAttribute('aria-pressed',String(active));fullscreen.querySelector('span').textContent=active?'Salir de pantalla completa':'Pantalla completa';}
    function open(){
      if(opened||closed)return;
      previous=document.activeElement;scrollX=root.scrollX||0;scrollY=root.scrollY||0;
      if(!element.isConnected)document.body.appendChild(element);
      // El dialog nativo mantiene el fondo inerte y el foco dentro de la vista.
      // El bloqueo explícito impide desplazar la página con rueda o gestos.
      if(typeof element.showModal!=='function')throw new Error('Este navegador no puede abrir el visualizador.');
      element.showModal();opened=true;
      lock=[document.documentElement,document.body].filter(Boolean).map(el=>[el,el.style.getPropertyValue('overflow'),el.style.getPropertyPriority('overflow')]);
      lock.forEach(([el])=>el.style.setProperty('overflow','hidden'));
      document.addEventListener('fullscreenchange',fullscreenState);back.focus({preventScroll:true});
    }
    function createItem(){
      const card=node('article','sv-bp-item');card.setAttribute('role','listitem');
      const picture=node('div','sv-bp-picture'),placeholder=node('div','sv-bp-picture-placeholder');placeholder.innerHTML=icon('image');placeholder.appendChild(node('span','','Sin imagen'));picture.appendChild(placeholder);
      const detail=node('div','sv-bp-item-detail'),description=node('h2','sv-bp-item-description'),code=node('p','sv-bp-item-code');
      const measures=node('div','sv-bp-item-measures'),qty=node('div','sv-bp-quantity'),qtyLabel=node('span','sv-bp-quantity-label','Cantidad'),qtyValue=node('strong','sv-bp-quantity-value'),unit=node('span','sv-bp-unit');
      qty.append(qtyLabel,qtyValue,unit);
      const pricing=node('div','sv-bp-item-pricing'),unitPrice=node('p','sv-bp-unit-price'),discount=node('p','sv-bp-item-discount'),lineTotal=node('strong','sv-bp-line-total');
      pricing.append(unitPrice,discount,lineTotal);measures.append(qty,pricing);detail.append(code,description,measures);card.append(picture,detail);
      return {card,picture,placeholder,description,code,qtyValue,unit,unitPrice,discount,lineTotal,image:null,imageSource:''};
    }
    function updateItem(view,item,index,currency){
      item=item||{};
      textIfChanged(view.description,item.description||'Producto');textIfChanged(view.code,item.code||'');hiddenIfChanged(view.code,!item.code);
      textIfChanged(view.qtyValue,quantity(item.quantity));textIfChanged(view.unit,item.unit||'');hiddenIfChanged(view.unit,!item.unit);
      textIfChanged(view.unitPrice,'Precio unitario '+amount(item.unitPrice,currency));textIfChanged(view.lineTotal,amount(item.subtotal,currency));attributeIfChanged(view.lineTotal,'aria-label','Subtotal '+amount(item.subtotal,currency));
      const discounted=numeric(item.discountPct)>0;hiddenIfChanged(view.discount,!discounted);textIfChanged(view.discount,discounted?'Descuento '+quantity(item.discountPct)+'%':'');
      const src=imageURL(item.image);
      if(src!==view.imageSource){
        view.imageSource=src;view.image?.remove();view.image=null;hiddenIfChanged(view.placeholder,false);
        if(src){
          const image=node('img','sv-bp-image');view.image=image;image.decoding='async';image.referrerPolicy='no-referrer';
          image.addEventListener('load',()=>{if(view.image===image)hiddenIfChanged(view.placeholder,true);});
          image.addEventListener('error',()=>{if(view.image!==image)return;image.remove();view.image=null;hiddenIfChanged(view.placeholder,false);},{once:true});
          image.alt=String(item.description||'Producto');image.loading=index<6?'eager':'lazy';image.src=src;view.picture.appendChild(image);
        }
      }
      if(view.image){const alt=String(item.description||'Producto'),loading=index<6?'eager':'lazy';if(view.image.alt!==alt)view.image.alt=alt;if(view.image.loading!==loading)view.image.loading=loading;}
    }
    function reconcileItems(items,currency){
      const next=new Map(),occurrences=new Map();
      items.forEach((item,index)=>{
        // El código visible más su ocurrencia conserva filas repetidas. Las
        // filas sin código usan su posición, sin depender de IDs internos.
        const code=String(item?.code||''),occurrence=occurrences.get(code)||0;occurrences.set(code,occurrence+1);
        const key=JSON.stringify(code?[code,occurrence]:['',index]),view=itemViews.get(key)||createItem();next.set(key,view);updateItem(view,item,index,currency);
        if(list.children[index]!==view.card)list.insertBefore(view.card,list.children[index]||null);
      });
      for(const [key,view]of itemViews)if(!next.has(key))view.card.remove();itemViews=next;
      if(items.length){emptyItem?.remove();emptyItem=null;}
      else if(!emptyItem){emptyItem=node('div','sv-bp-empty');emptyItem.innerHTML=icon('image');emptyItem.appendChild(node('p','','Este presupuesto todavía no tiene productos.'));list.appendChild(emptyItem);}
    }
    function reconcileOptions(alternatives){
      const next=new Map(),occurrences=new Map();
      alternatives.forEach((alternative,index)=>{
        const value=String(alternative.id??''),occurrence=occurrences.get(value)||0;occurrences.set(value,occurrence+1);
        const key=JSON.stringify([value,occurrence]),option=optionViews.get(key)||node('option');next.set(key,option);
        if(option.value!==value)option.value=value;textIfChanged(option,alternative.label||'Edición');
        if(select.children[index]!==option)select.insertBefore(option,select.children[index]||null);
      });
      for(const [key,option]of optionViews)if(!next.has(key))option.remove();optionViews=next;
    }
    function metric(label,value){const pair=node('div','sv-bp-summary-pair');pair.append(node('dt','',label),node('dd','',value));summary.appendChild(pair);}
    function render(snapshot,state){
      if(closed)return;
      snapshot=snapshot||{};state=state||{};
      const top=content.scrollTop,left=content.scrollLeft,selected=select.value,viewStatus=statusOf(state.status),currency=snapshot.currency;
      number.textContent=snapshot.number?'Presupuesto '+String(snapshot.number):'Presupuesto';
      title.textContent=snapshot.title||'Tu presupuesto';client.textContent=snapshot.client||'';client.hidden=!snapshot.client;
      status.textContent=viewStatus.label;status.className='sv-bp-status is-'+viewStatus.kind;
      updated.textContent=updatedText(state.updated);updated.hidden=!updated.textContent;
      saved.hidden=typeof options.onSaved!=='function'||!['En edición','Edición finalizada'].includes(viewStatus.label);
      const alternatives=Array.isArray(state.alternatives)?state.alternatives:[];
      choices.hidden=alternatives.length<=1;
      if(alternatives.length>1){const entries=[{id:'',label:'Elegí una edición'},...alternatives];reconcileOptions(entries);const desired=state.selectedDraft===null||state.selectedDraft===undefined?selected:String(state.selectedDraft);if(entries.some(item=>String(item.id??'')===desired)&&select.value!==desired)select.value=desired;}
      showWarning(snapshot.warning||(snapshot.valid===false?'Revisá los importes de este presupuesto.':''));
      const items=Array.isArray(snapshot.items)?snapshot.items:[];
      reconcileItems(items,currency);
      summary.replaceChildren();metric('Subtotal',amount(snapshot.subtotal,currency));
      if(numeric(snapshot.discountPct)>0||numeric(snapshot.discount)>0)metric('Descuento'+(numeric(snapshot.discountPct)>0?' '+quantity(snapshot.discountPct)+'%':''),numeric(snapshot.discount)===null?'—':'− '+amount(snapshot.discount,currency));
      if(snapshot.includesIva===true||numeric(snapshot.iva)>0)metric('IVA'+(numeric(snapshot.ivaRate)>0?' '+quantity(snapshot.ivaRate)+'%':''),amount(snapshot.iva,currency));
      totalLabel.textContent=snapshot.valid===false?'Total por revisar':'Total';totalValue.textContent=amount(snapshot.total,currency);totalBox.classList.toggle('is-invalid',snapshot.valid===false);
      content.scrollTop=top;content.scrollLeft=left;open();
    }
    back.addEventListener('click',close);exit.addEventListener('click',close);
    saved.addEventListener('click',()=>invoke(options.onSaved,[],'No se pudo abrir la versión guardada. Volvé a intentarlo.'));
    fullscreen.addEventListener('click',()=>invoke(options.onFullscreen,[element],'No se pudo abrir la pantalla completa.'));
    select.addEventListener('change',()=>invoke(options.onChooseDraft,[select.value],'No se pudo abrir esa edición. Volvé a intentarlo.'));
    element.addEventListener('cancel',event=>{event.preventDefault();close();});element.addEventListener('close',release);
    for(const event of ['click','pointerdown','pointerup'])element.addEventListener(event,e=>e.stopPropagation());
    return {element,render,close};
  }
  root.SVBudgetPresentationView={create};
})(window);
