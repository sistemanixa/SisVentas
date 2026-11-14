(function(root){
 'use strict';
 const doc=root.document;let panel,rows,original=null;
 const category=()=>root.SVExpenseClothingModel.category(doc.getElementById('g-categoria')?.value,root.SVEmployeeResourcesIntegration?.categoryState());
 function row(item={}){
  const line=doc.createElement('div');line.className='expense-clothing-row';
  for(const [name,label,type]of [['name','Prenda','text'],['size','Talle','text'],['color','Color','text'],['quantity','Cantidad','number']]){
   const wrap=doc.createElement('label');wrap.textContent=label;const input=doc.createElement('input');input.type=type;input.dataset.clothingField=name;input.value=item[name]??(name==='quantity'?1:'');input.disabled=!!original;
   if(name==='quantity'){input.min='1';input.step='1';input.inputMode='numeric';}else input.maxLength=name==='name'?160:name==='size'?40:60;
   wrap.append(input);line.append(wrap);
  }
  const remove=doc.createElement('button');remove.type='button';remove.className='btn btn-sm';remove.setAttribute('aria-label','Quitar prenda');remove.textContent='×';remove.hidden=!!original;
  remove.onclick=()=>{if(rows.children.length===1){line.querySelector('input').focus();return;}line.remove();};line.append(remove);rows.append(line);
 }
 function refresh(){
  if(!panel)return;panel.hidden=!category()&&!original;
  panel.querySelector('[data-clothing-add]').hidden=!!original;
  panel.querySelector('[data-clothing-note]').textContent=original?'Estas prendas ya ingresaron al stock. La entrega se registra desde Indumentaria.':'Al guardar el gasto, estas prendas quedan disponibles para entregar.';
 }
 function mount(value){
  original=value?.indumentaria||null;
  if(!panel){
   const select=doc.getElementById('g-categoria');if(!select)return;
   panel=doc.createElement('section');panel.className='expense-clothing';panel.setAttribute('aria-label','Prendas de la compra');
   const heading=doc.createElement('strong');heading.textContent='Indumentaria';panel.append(heading);
   const note=doc.createElement('p');note.dataset.clothingNote='';panel.append(note);rows=doc.createElement('div');rows.className='expense-clothing-rows';panel.append(rows);
   const add=doc.createElement('button');add.type='button';add.className='btn btn-sm';add.dataset.clothingAdd='';add.textContent='+ Agregar prenda';add.onclick=()=>{row();rows.lastElementChild.querySelector('input').focus();};panel.append(add);
   select.closest('.fg').after(panel);select.addEventListener('change',refresh);doc.addEventListener('sisventas:expense-categories-changed',refresh);
  }
  rows.replaceChildren();for(const item of original?.items||[{}])row(item);refresh();
 }
 function collect(){
  if(original)return JSON.parse(JSON.stringify(original));if(!category())return null;
  if(root.tienePermiso?.('empleados.indumentaria')!==true)throw Error('No tenés permiso para ingresar indumentaria.');
  const items=[...rows.children].map(line=>Object.fromEntries([...line.querySelectorAll('input')].map(input=>[input.dataset.clothingField,input.dataset.clothingField==='quantity'?Number(input.value):input.value])));
  return root.SVExpenseClothingModel.normalize({schema:1,items});
 }
 root.SVExpenseClothingForm=Object.freeze({mount,collect});
})(window);
