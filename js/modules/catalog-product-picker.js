(function(root){
 'use strict';
 const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function photo(value,base='https://local.invalid/'){
  if(typeof value!=='string'||value.length>2400||/[\u0000-\u001f\u007f]/.test(value))return '';
  try{if(!value.trim())return '';const url=new URL(value,base),origin=new URL(base).origin;return !url.username&&!url.password&&(url.protocol==='https:'||url.origin===origin)&&['http:','https:'].includes(url.protocol)?url.href:'';}catch(_){return '';}
 }
 function matches(product,query,brand=''){
  const terms=norm(query).split(/\s+/).filter(Boolean),text=norm([product.code,product.name,product.brand,product.description].join(' '));
  return (!brand||product.brand===brand)&&terms.every(term=>text.includes(term));
 }
 const price=(p,currency)=>Number.isFinite(p[currency.toLowerCase()])&&p[currency.toLowerCase()]>0?p[currency.toLowerCase()]:null;
 const api={photo,matches,price};if(typeof module!=='undefined')module.exports=api;if(!root.document)return;
 let dialog=null,returnFocus=null,overflow='';
 function close(){if(!dialog)return;root.SVProductCodeSearch?.close();dialog.close();dialog.remove();dialog=null;document.body.style.overflow=overflow;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
 function open({products,currency='USD',onSelect,title='Buscar producto',subtitle='Catálogo de Distribuidora'}){
  close();const source=products.slice();returnFocus=document.activeElement;overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  dialog=document.createElement('dialog');dialog.className='sv-catalog-picker';dialog.setAttribute('data-sv-escape-owner','true');dialog.setAttribute('aria-labelledby','catalog-picker-title');
  dialog.innerHTML='<header><div><h2 id="catalog-picker-title"></h2><p data-catalog-subtitle></p></div><button type="button" class="btn btn-icon" data-close aria-label="Cerrar buscador">×</button></header><section class="sv-catalog-picker-filters"><label>Buscar producto<input type="search" placeholder="Código, nombre o marca…" aria-label="Buscar producto en el catálogo"></label><label data-brand-label>Marca<select aria-label="Filtrar por marca"><option value="">Todas las marcas</option></select></label><p role="status" aria-live="polite" data-count></p></section><div class="sv-catalog-picker-results" role="list" aria-label="Productos del catálogo"></div><footer><span>Elegí un producto para agregarlo al comprobante.</span><button type="button" class="btn" data-cancel>Cancelar</button></footer>';
  const active=dialog;dialog.querySelector('h2').textContent=title;dialog.querySelector('[data-catalog-subtitle]').textContent=subtitle;document.body.append(dialog);
  const search=dialog.querySelector('input'),brand=dialog.querySelector('select'),results=dialog.querySelector('[role=list]'),count=dialog.querySelector('[data-count]');
  const brands=[...new Set(source.map(p=>p.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  for(const name of brands){const option=document.createElement('option');option.value=name;option.textContent=name;brand.append(option);}dialog.querySelector('[data-brand-label]').hidden=!brands.length;
  function render(){
   const filtered=source.filter(p=>matches(p,search.value,brand.value)),shown=filtered.slice(0,80);results.replaceChildren();count.textContent=filtered.length>80?'Mostrando 80 de '+filtered.length+' productos. Afiná la búsqueda.':filtered.length+(filtered.length===1?' producto':' productos');
   if(!shown.length){const empty=document.createElement('p');empty.className='sv-catalog-picker-empty';empty.textContent='No encontramos productos del catálogo con esa búsqueda.';results.append(empty);return;}
   for(const product of shown){
    const row=document.createElement('div');row.setAttribute('role','listitem');const button=document.createElement('button');button.type='button';button.className='sv-catalog-picker-item';button.setAttribute('aria-label','Agregar '+product.name);button.disabled=price(product,currency)===null;
    const imageBox=document.createElement('span');imageBox.className='sv-catalog-picker-photo prod-drop-thumb';const placeholder=document.createElement('span');placeholder.textContent='Sin foto';imageBox.append(placeholder);
    const src=photo(product.image,root.location.href);if(src){const image=document.createElement('img');image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.src=src;image.onload=()=>{placeholder.hidden=true;};image.onerror=()=>image.remove();imageBox.append(image);}
    const info=document.createElement('span');info.className='sv-catalog-picker-info';const code=document.createElement('small');code.textContent=product.code||'Sin código';const name=document.createElement('strong');name.textContent=product.name;const meta=document.createElement('span');meta.textContent=product.brand||'Catálogo de Distribuidora';info.append(code,name,meta);
    const amount=document.createElement('span');amount.className='sv-catalog-picker-price';const value=price(product,currency);amount.textContent=value===null?'Sin precio disponible':(currency==='USD'?'US$ ':'ARS $ ')+value.toLocaleString('es-AR',{minimumFractionDigits:currency==='USD'?0:2,maximumFractionDigits:currency==='USD'?0:2});
    button.append(imageBox,info,amount);button.onclick=()=>{if(dialog!==active||button.disabled)return;close();onSelect(product.id);};row.append(button);results.append(row);
   }
  }
  search.oninput=render;brand.onchange=render;dialog.querySelector('[data-close]').onclick=close;dialog.querySelector('[data-cancel]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  root.SVProductCodeSearch?.attach(search);render();dialog.showModal();search.focus({preventScroll:true});
 }
 document.addEventListener('sisventas:session-ended',close);document.addEventListener('sisventas:page-changed',close);root.addEventListener('pagehide',close);
 root.SVCatalogProductPicker={open,close};
})(typeof window==='undefined'?{}:window);
