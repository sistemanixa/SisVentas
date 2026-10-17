(function(root){
 'use strict';
 const code=value=>{const text=String(value??'').trim();return text&&text.length<=120&&!/[\u0000-\u001f\u007f]/.test(text)?text:null;};
 function createController(env){
  let revision=0;
  function cancel(){revision++;env.camera()?.close();}
  function open(input){
   if(!input?.isConnected||input.disabled||input.readOnly)return;
   const camera=env.camera();if(!camera){env.notify('El lector no está disponible. Podés escribir el código.');return;}
   const token=++revision,context=env.context(input);
   camera.open({kind:'product',label:'Código comercial o SKU registrado en el catálogo',onRead:value=>{
    if(token!==revision||!input.isConnected||input.disabled||input.readOnly||!env.valid(input,context))return;
    const text=code(value);if(!text){env.notify('El código no es válido. Podés escribirlo para buscar.');return;}
    revision++;env.apply(input,text);env.notify("Código leído: "+text+". Revisá los resultados."); // Search only; never select, add, save or open a scanned URL.
   }});
  }
  return {open,cancel};
 }
 const api={code,createController};if(typeof module!=='undefined')module.exports=api;if(!root.document)return;
 const doc=root.document,bound=new WeakSet();
 const controller=createController({camera:()=>root.SVSerialCamera,notify:text=>root.notify?.(text),context:input=>({page:doc.querySelector('.page.active'),owner:input.id==='prod-drop-inp'?root._prodDropTR:input.closest('dialog,.modal-overlay,[role=dialog]')}),valid:(input,context)=>context.page===doc.querySelector('.page.active')&&(!context.owner||context.owner.isConnected)&&(input.id!=='prod-drop-inp'||root._prodDropTR===context.owner)&&input.getClientRects().length>0,apply:(input,text)=>{
  if(input.id==='prod-search'){const field=doc.getElementById('prod-search-field');if(field)field.value='codigo';}
  if(input.id==='ba-texto'){const field=doc.getElementById('ba-campo');if(field)field.value='principales';}
  input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));
 }});
 function attach(input){
  if(!input||bound.has(input))return;bound.add(input);
  const wrap=doc.createElement('span');wrap.className='sv-product-scan-field';wrap.style.marginBottom=input.style.marginBottom;
  input.before(wrap);wrap.append(input);const button=doc.createElement('button');button.type='button';button.className='btn sv-product-scan-button';button.title='Buscar producto con cámara · código de barras o QR';button.setAttribute('aria-label','Escanear código del producto');
  button.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 8v8M10 8v8M14 8v8M17 8v8"/></svg>';
  button.addEventListener('mousedown',event=>{event.preventDefault();event.stopPropagation();});button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();button.focus({preventScroll:true});controller.open(input);});wrap.append(button);
 }
 function staticInputs(){['prod-search','catalogo-buscar','ot-sel-prod-buscar','kit-sel-buscar'].forEach(id=>attach(doc.getElementById(id)));}
 doc.addEventListener('sisventas:page-changed',()=>{controller.cancel();staticInputs();});doc.addEventListener('sisventas:session-ended',()=>controller.cancel());root.addEventListener('pagehide',()=>controller.cancel());
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',staticInputs);else staticInputs();
 root.SVProductCodeSearch={attach,open:controller.open,close:controller.cancel};
})(typeof window==='undefined'?{}:window);
