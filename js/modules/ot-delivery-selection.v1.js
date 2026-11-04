(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../core/commercial-money.v1'));else root.SVOTDeliverySelection=factory(root.SVCommercialMoney).create(root);})(typeof window==='object'?window:globalThis,function(Money){
'use strict';
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
function lessOrEqual(a,b){const x=Money.decimal(a),y=Money.decimal(b);return x.n*y.d<=y.n*x.d;}
function quantityText(value){
 // decimal() supplies a nonnegative integer numerator and power-of-ten scale
 // for these validated quantities. Expand its text without float formatting.
 const valueDecimal=Money.decimal(value),scale=valueDecimal.d.toString().length-1,digits=valueDecimal.n.toString().padStart(scale+1,'0');
 return scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits;
}
function normalized(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>5000)throw Error('No hay materiales para entregar.');
 const seen=new Set();return rows.map(row=>{
  if(!row||!Number.isSafeInteger(row.index)||row.index<0||seen.has(row.index)||!positive(row.pending)||row.pending===0||typeof row.description!=='string'||row.available!==undefined&&!positive(row.available))throw Error('Los materiales necesitan actualizarse.');
  seen.add(row.index);const maximum=row.available===undefined||lessOrEqual(row.pending,row.available)?row.pending:row.available;
  return {index:row.index,description:row.description,unit:typeof row.unit==='string'?row.unit:'unidades',pending:row.pending,maximum,availabilityKnown:row.available!==undefined};
 });
}
function selected(rows,values){
 const list=normalized(rows);if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Revisá las cantidades.');
 const indices=new Set(list.map(row=>String(row.index)));if(Object.keys(values).some(index=>!indices.has(index)))throw Error('Hay un material que cambió.');
 const result=[];for(const row of list){const raw=Object.hasOwn(values,row.index)?values[row.index]:'0',text=String(raw).trim().replace(',','.');
  if(!/^(?:\d+)(?:\.\d+)?$/.test(text))throw Error('Ingresá cantidades válidas, sin separadores de miles.');
  const quantity=Number(text);if(!positive(quantity)||!lessOrEqual(text,row.maximum))throw Error('La cantidad supera lo pendiente o disponible.');
  // Preserve the decimal that was actually entered; never round a quantity.
  const parsed=Money.decimal(text),stored=Money.decimal(quantity);if(parsed.n*stored.d!==stored.n*parsed.d)throw Error('La cantidad tiene más precisión de la admitida.');
  if(quantity>0)result.push({index:row.index,cantidad:quantity});
 }
 if(!result.length)throw Error('Elegí al menos un material para entregar.');return result;
}
function create(root){let current=null;
 function choose({rows,technician='',valid}={}){
  if(current)return Promise.reject(Error('Ya hay una entrega en preparación.'));
  if(typeof valid!=='function'||valid()!==true)return Promise.reject(Error('La sesión o los permisos cambiaron.'));
  const list=normalized(rows),doc=root.document,previous=doc.activeElement,host=doc.body,previousOverflow=host.style.overflow;
  return new Promise((resolve,reject)=>{
   const dialog=doc.createElement('dialog');current=dialog;dialog.className='sv-ot-delivery-selection';dialog.setAttribute('aria-labelledby','sv-ot-delivery-title');
   dialog.style.cssText='padding:0;border:1px solid var(--border);border-radius:16px;background:var(--bg2);color:var(--text);width:min(720px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:hidden';
   const form=doc.createElement('form');form.style.cssText='display:flex;flex-direction:column;max-height:calc(100dvh - 26px);min-height:0';dialog.appendChild(form);
   const header=doc.createElement('header');header.style.cssText='padding:18px 20px;background:var(--bg2);border-bottom:1px solid var(--border);flex-shrink:0';
   const title=doc.createElement('h2');title.id='sv-ot-delivery-title';title.textContent='Entregar materiales';title.style.cssText='font-size:18px;margin:0 0 6px';
   const subtitle=doc.createElement('p');subtitle.textContent=technician?'Para '+technician:'Elegí las cantidades que se entregan ahora.';subtitle.style.cssText='margin:0;color:var(--text2);font-size:13px';header.append(title,subtitle);form.appendChild(header);
   const body=doc.createElement('div');body.style.cssText='padding:4px 20px;overflow:auto;overscroll-behavior:contain;min-height:0';form.appendChild(body);const inputs=new Map();
   for(const row of list){const label=doc.createElement('label');label.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) 100px;gap:12px;align-items:center;padding:14px 0;border-bottom:1px solid var(--border)';
    const description=doc.createElement('span'),name=doc.createElement('strong'),detail=doc.createElement('small');name.textContent=row.description;name.style.cssText='display:block;font-size:13px;overflow-wrap:anywhere';detail.textContent='Pendiente: '+quantityText(row.pending)+' '+row.unit+(row.availabilityKnown?' · Disponible: '+quantityText(row.maximum):'');detail.style.cssText='display:block;margin-top:5px;color:var(--text2);font-size:11px;overflow-wrap:anywhere';description.append(name,detail);
    const input=doc.createElement('input');input.type='text';input.inputMode='decimal';input.value=quantityText(row.maximum);input.className='search-input';input.setAttribute('aria-label','Cantidad de '+row.description);input.style.cssText='width:100%;min-width:0;text-align:right';inputs.set(row.index,input);label.append(description,input);body.appendChild(label);
   }
   const footer=doc.createElement('footer');footer.style.cssText='padding:14px 20px;background:var(--bg2);flex-shrink:0';const error=doc.createElement('p');error.setAttribute('role','alert');error.style.cssText='margin:0 0 10px;color:var(--red);font-size:12px';error.hidden=true;footer.appendChild(error);
   const actions=doc.createElement('div');actions.className='flex-end';const cancel=doc.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancelar';const accept=doc.createElement('button');accept.type='submit';accept.className='btn btn-primary';accept.textContent='Confirmar entrega';actions.append(cancel,accept);footer.appendChild(actions);form.appendChild(footer);
   let settled=false,observer=null;function finish(value,reason){
    if(settled)return;settled=true;observer?.disconnect();
    try{if(dialog.open)dialog.close();}catch(_){}dialog.remove();current=null;host.style.overflow=previousOverflow;
    try{root.svSincronizarPilaModales?.();}catch(_){}
    if(previous?.isConnected&&!previous.closest('[inert]'))previous.focus({preventScroll:true});
    if(reason)reject(reason);else resolve(value);
   }
   cancel.onclick=()=>finish(null);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>{if(!settled)finish(null);});
   form.onsubmit=event=>{event.preventDefault();try{if(valid()!==true)throw Error('La sesión o los permisos cambiaron. Volvé a abrir la OT.');const values=Object.fromEntries([...inputs].map(([index,input])=>[index,input.value]));finish(selected(rows,values));}catch(reason){error.textContent=reason.message;error.hidden=false;}};
   for(const input of inputs.values())input.addEventListener('input',()=>{error.hidden=true;});
   try{
    host.appendChild(dialog);
    if(root.MutationObserver){observer=new root.MutationObserver(()=>{if(!dialog.isConnected)finish(null);});observer.observe(doc.documentElement||host,{childList:true,subtree:true});}
    dialog.showModal();host.style.overflow='hidden';root.svSincronizarPilaModales?.();inputs.values().next().value?.focus({preventScroll:true});
   }catch(reason){finish(null,reason);}
  });
 }
 return Object.freeze({choose});
}
return Object.freeze({create,selected,normalized});
});
