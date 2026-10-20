'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/modules/budget-presentation-view.js','utf8');
function fixture(options={}){
 const mutations=[],images=[],srcWrites=[],events=new Map();let modalOpens=0;
 const style=()=>{const values=new Map();return {getPropertyValue:name=>values.get(name)?.value||'',getPropertyPriority:name=>values.get(name)?.priority||'',setProperty(name,value,priority=''){values.set(name,{value,priority});},removeProperty:name=>values.delete(name)};};
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attributes=new Map();this.listeners=new Map();this.style=style();this._text='';this._hidden=false;this._value='';this.className='';this.scrollTop=0;this.scrollLeft=0;this.open=false;}
  get isConnected(){return this===document.documentElement||!!this.parentElement?.isConnected;}
  contains(other){for(let n=other;n;n=n.parentElement)if(n===this)return true;return false;}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this._text=String(value);for(const child of this.children)child.parentElement=null;this.children=[];mutations.push({target:this,type:'text'});}
  set innerHTML(value){this._html=String(value);this.textContent='';}
  get innerHTML(){return this._html||'';}
  get hidden(){return this._hidden;}
  set hidden(value){this._hidden=!!value;mutations.push({target:this,type:'hidden'});}
  get value(){return this.tagName==='SELECT'&&!this.children.some(child=>child.value===this._value)?this.children[0]?.value||'':this._value;}
  set value(value){this._value=String(value);}
  get src(){return this._src||'';}
  set src(value){this._src=String(value);srcWrites.push({image:this,src:this._src});mutations.push({target:this,type:'src'});}
  get classList(){return {contains:name=>this.className.split(/\s+/).includes(name),toggle:(name,on)=>{const set=new Set(this.className.split(/\s+/).filter(Boolean));if(on)set.add(name);else set.delete(name);this.className=[...set].join(' ');}};}
  setAttribute(name,value){this.attributes.set(name,String(value));mutations.push({target:this,type:'attribute'});}
  getAttribute(name){return this.attributes.get(name)??null;}
  appendChild(child){return this.insertBefore(child,null);}
  append(...children){children.forEach(child=>this.appendChild(child));}
  insertBefore(child,before){if(before===child)return child;if(child.parentElement)child.remove();const index=before?this.children.indexOf(before):this.children.length;if(index<0)throw Error('Referencia DOM ausente');this.children.splice(index,0,child);child.parentElement=this;this._text='';mutations.push({target:this,type:'children'});return child;}
  replaceChildren(...children){for(const child of [...this.children])child.remove();this._text='';this.append(...children);mutations.push({target:this,type:'replace'});}
  remove(){if(!this.parentElement)return;const parent=this.parentElement;parent.children.splice(parent.children.indexOf(this),1);this.parentElement=null;mutations.push({target:parent,type:'children'});}
  querySelectorAll(selector){const result=[],matches=node=>selector[0]==='.'?node.classList.contains(selector.slice(1)):node.tagName===selector.toUpperCase();const visit=node=>{for(const child of node.children){if(matches(child))result.push(child);visit(child);}};visit(this);return result;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(name,callback,options){const list=this.listeners.get(name)||[];list.push({callback,once:options?.once});this.listeners.set(name,list);}
  dispatch(name,event={}){for(const listener of [...this.listeners.get(name)||[]]){listener.callback(event);if(listener.once)this.listeners.set(name,this.listeners.get(name).filter(entry=>entry!==listener));}}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;modalOpens++;}
  close(){this.open=false;this.dispatch('close');}
 }
 const document={createElement(tag){const element=new Element(tag);if(tag==='img')images.push(element);return element;},addEventListener(name,fn){(events.get(name)||events.set(name,new Set()).get(name)).add(fn);},removeEventListener(name,fn){events.get(name)?.delete(fn);},fullscreenElement:null};
 document.documentElement=new Element('html');document.body=new Element('body');document.documentElement.appendChild(document.body);
 const origin=document.createElement('button');document.body.appendChild(origin);origin.focus();
 const scrolls=[],root={document,scrollX:4,scrollY:60,scrollTo:(...args)=>scrolls.push(args),fetch(){throw Error('El render no debe consultar la red');}};
 vm.runInNewContext(source,{window:root,document,Intl,Date,console});const view=root.SVBudgetPresentationView.create(options);
 return {document,root,view,origin,images,srcWrites,mutations,scrolls,get modalOpens(){return modalOpens;},find:selector=>view.element.querySelector(selector),within:element=>mutations.filter(entry=>element.contains(entry.target)),reset(){mutations.length=0;}};
}
const item=(code='A',image='https://images.fixture.invalid/'+code+'.jpg')=>({code,description:'Producto '+code,quantity:2,unit:'Unidad',unitPrice:100,discountPct:0,subtotal:200,image});
const snapshot=(items=[item('A'),item('B')])=>({number:'PP-FICTICIO',title:'Presupuesto de prueba',client:'Cliente ficticio',currency:'ARS',items,subtotal:400,discountPct:0,discount:0,iva:84,ivaRate:21,includesIva:true,total:484,valid:true});

test('descuento general, total y estados repetidos conservan imágenes y no mutan la lista de productos',()=>{
 const f=fixture(),base=snapshot();f.view.render(base,{status:'draft'});const list=f.find('.sv-bp-items'),cards=[...list.children],images=[...f.images];f.reset();
 for(const status of ['draft','offline','draft','saved','saved'])f.view.render({...base,discountPct:10,discount:40,iva:75.6,total:435.6},{status});
 assert.equal(f.images.length,2);assert.equal(f.srcWrites.length,2);assert.deepEqual(list.children,cards);assert.deepEqual(f.images,images);assert.equal(f.within(list).length,0);assert.equal(f.modalOpens,1);
});

test('cantidad y descuento de línea actualizan importes sin crear imágenes ni volver a asignar src',()=>{
 const f=fixture(),base=snapshot();f.view.render(base);const image=f.images[0],card=f.find('.sv-bp-items').children[0];
 f.view.render({...base,items:[{...base.items[0],quantity:3,discountPct:10,subtotal:270},base.items[1]],total:568.7});
 assert.equal(f.images.length,2);assert.equal(f.srcWrites.length,2);assert.equal(card.querySelector('img'),image);assert.equal(card.querySelector('.sv-bp-quantity-value').textContent,'3');assert.match(card.querySelector('.sv-bp-line-total').textContent,/270,00/);assert.equal(card.querySelector('.sv-bp-item-discount').textContent,'Descuento 10%');
});

test('cambiar una foto crea una sola carga y conserva las otras imágenes',()=>{
 const f=fixture(),base=snapshot();f.view.render(base);const list=f.find('.sv-bp-items'),first=f.images[0],second=f.images[1],cards=[...list.children];
 f.view.render({...base,items:[{...base.items[0],image:'https://images.fixture.invalid/otra.jpg'},base.items[1]]});
 assert.equal(f.images.length,3);assert.equal(f.srcWrites.length,3);assert.equal(first.isConnected,false);assert.equal(list.children[1].querySelector('img'),second);assert.deepEqual(list.children,cards);assert.equal(f.srcWrites.at(-1).src,'https://images.fixture.invalid/otra.jpg');
});

test('reordenar, eliminar y agregar preserva tarjetas e imágenes por código visible',()=>{
 const f=fixture(),a=item('A'),b=item('B'),c=item('C');f.view.render(snapshot([a,b,c]));const list=f.find('.sv-bp-items'),[cardA,cardB,cardC]=list.children,[imageA,imageB,imageC]=f.images;
 f.view.render(snapshot([c,a,b]));assert.deepEqual(list.children,[cardC,cardA,cardB]);assert.equal(f.images.length,3);assert.equal(f.srcWrites.length,3);
 f.view.render(snapshot([c,b]));assert.deepEqual(list.children,[cardC,cardB]);assert.equal(imageA.isConnected,false);assert.equal(list.children[0].querySelector('img'),imageC);assert.equal(list.children[1].querySelector('img'),imageB);
 f.view.render(snapshot([item('D'),c,b]));assert.equal(f.images.length,4);assert.equal(f.srcWrites.length,4);assert.equal(list.children[1],cardC);assert.equal(list.children[2],cardB);
});

test('códigos repetidos conservan sus ocurrencias y las filas sin código conservan su posición',()=>{
 const f=fixture(),a=item('A'),repeat={...item('A'),description:'Segunda ocurrencia'},anonymous=item('','https://images.fixture.invalid/sin-codigo.jpg');f.view.render(snapshot([a,repeat,anonymous]));
 const list=f.find('.sv-bp-items'),cards=[...list.children],images=[...f.images];f.view.render(snapshot([{...a,quantity:4},{...repeat,quantity:7},{...anonymous,description:'Descripción corregida',quantity:9}]));
 assert.deepEqual(list.children,cards);assert.deepEqual(f.images,images);assert.equal(f.srcWrites.length,3);assert.deepEqual(list.children.map(card=>card.querySelector('.sv-bp-quantity-value').textContent),['4','7','9']);
});

test('foto fallida no se reintenta por cambios numéricos y una URL nueva permite una carga nueva',()=>{
 const f=fixture(),base=snapshot([item('A')]);f.view.render(base);const failed=f.images[0],placeholder=f.find('.sv-bp-picture-placeholder');failed.dispatch('error');assert.equal(placeholder.hidden,false);
 f.view.render({...base,total:123});f.view.render({...base,items:[{...base.items[0],quantity:5}]});assert.equal(f.images.length,1);assert.equal(f.srcWrites.length,1);assert.equal(f.find('img'),null);
 f.view.render({...base,items:[{...base.items[0],image:'https://images.fixture.invalid/reemplazo.jpg'}]});assert.equal(f.images.length,2);assert.equal(f.srcWrites.length,2);f.images[1].dispatch('load');assert.equal(placeholder.hidden,true);failed.dispatch('load');assert.equal(placeholder.hidden,true);
});

test('selector, foco y scroll se conservan al actualizar estado y etiquetas de las ediciones',()=>{
 const chosen=[],f=fixture({onChooseDraft:value=>chosen.push(value)}),base=snapshot(),alternatives=[{id:'d1',label:'Edición 1'},{id:'d2',label:'Edición 2'}];f.view.render(base,{alternatives,selectedDraft:'d2'});
 const select=f.find('.sv-bp-select'),options=[...select.children],content=f.find('.sv-bp-content');select.focus();content.scrollTop=174;content.scrollLeft=8;
 f.view.render({...base,total:250},{status:'offline',alternatives:[{id:'d1',label:'Edición 1 actualizada'},alternatives[1]]});
 assert.equal(f.document.activeElement,select);assert.equal(select.value,'d2');assert.deepEqual(select.children,options);assert.equal(options[1].textContent,'Edición 1 actualizada');assert.equal(content.scrollTop,174);assert.equal(content.scrollLeft,8);select.dispatch('change');assert.deepEqual(chosen,['d2']);assert.equal(f.srcWrites.length,2);
});

test('dos ediciones sin elegir muestran una opción neutra y permiten seleccionar la primera',()=>{
 const chosen=[],f=fixture({onChooseDraft:value=>chosen.push(value)});
 f.view.render(snapshot(),{alternatives:[{id:'d1',label:'Edición 1'},{id:'d2',label:'Edición 2'}],selectedDraft:''});
 const select=f.find('.sv-bp-select');assert.equal(select.value,'');assert.equal(select.children[0].textContent,'Elegí una edición');
 select.value='d1';select.dispatch('change');assert.deepEqual(chosen,['d1']);
});

test('lista vacía reutiliza su aviso y render después de cerrar no crea nodos ni imágenes',()=>{
 let closes=0;const f=fixture({onClose:()=>closes++});f.document.body.style.setProperty('overflow','auto');f.view.render(snapshot([]));const list=f.find('.sv-bp-items'),empty=list.children[0];f.reset();f.view.render(snapshot([]),{status:'paused'});
 assert.equal(list.children[0],empty);assert.equal(f.within(list).length,0);assert.equal(f.document.body.style.getPropertyValue('overflow'),'hidden');f.view.close();f.view.close();f.view.render(snapshot());
 assert.equal(closes,1);assert.equal(f.view.element.isConnected,false);assert.equal(f.document.body.style.getPropertyValue('overflow'),'auto');assert.equal(f.document.activeElement,f.origin);assert.deepEqual(f.scrolls,[[4,60]]);assert.equal(f.images.length,0);assert.equal(f.modalOpens,1);
});

test('IVA se etiqueta como componente separado y cierre nativo libera la vista una sola vez',()=>{
 let closes=0;const f=fixture({onClose:()=>closes++});f.view.render(snapshot());const summary=f.find('.sv-bp-summary');assert.match(summary.textContent,/IVA 21%/);assert.doesNotMatch(summary.textContent,/IVA incluido/);
 f.view.element.close();assert.equal(closes,1);assert.equal(f.view.element.isConnected,false);f.view.close();assert.equal(closes,1);
});
