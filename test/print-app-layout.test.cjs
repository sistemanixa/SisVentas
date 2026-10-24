'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {functionSource}=require('./helpers/app-functions.cjs');
const escaped=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// A small DOM boundary double. Browser/PDF pagination is verified separately
// with the real generated documents; this checks the snapshot's data contract.
function dom(){
 const document={createElement:tag=>new Element(tag)};
 class Element{
  constructor(tag,text=''){
   this.tagName=tag.toUpperCase();this._text=text;this.children=[];this.attrs={};this.ownerDocument=document;
   this.computed={display:'block',visibility:'visible',position:'static'};
   this.style={setProperty(name,value){this[name]=value;}};
  }
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,value}));}
  getAttribute(name){return this.attrs[name]??null;}
  removeAttribute(name){delete this.attrs[name];}
  querySelectorAll(){return this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);}
  cloneNode(){
   const clone=new Element(this.tagName,this._text);
   Object.assign(clone,{attrs:{...this.attrs},computed:{...this.computed},hidden:this.hidden,type:this.type,value:this.value,checked:this.checked,selectedOptions:this.selectedOptions,width:this.width,height:this.height});
   Object.assign(clone.style,this.style);clone.append(...this.children.map(child=>child.cloneNode(true)));this.lastClone=clone;return clone;
  }
  remove(){if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}
  replaceWith(next){const parent=this.parent;parent.children.splice(parent.children.indexOf(this),1,next);next.parent=parent;this.parent=null;}
  getBoundingClientRect(){return this.rect||{width:640,height:200};}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set textContent(value){this._text=String(value??'');this.children=[];}
  get innerHTML(){return escaped(this._text)+this.children.map(c=>c.html()).join('');}
  html(){const attrs={...this.attrs};for(const k of ['src','alt','width','height','className'])if(this[k]!==undefined)attrs[k==='className'?'class':k]=this[k];const style=Object.entries(this.style).filter(([,v])=>typeof v!=='function').map(([k,v])=>k+':'+v).join(';');if(style)attrs.style=style;return '<'+this.tagName.toLowerCase()+Object.entries(attrs).map(([k,v])=>' '+k+'="'+escaped(v)+'"').join('')+'>'+this.innerHTML+'</'+this.tagName.toLowerCase()+'>';}
 }
 const context={window:{getComputedStyle:element=>element.computed},Array};vm.createContext(context);vm.runInContext(functionSource('svContenidoVisibleParaImprimir'),context);
 return {Element,document,snapshot:element=>context.svContenidoVisibleParaImprimir(element)};
}

test('snapshot includes every visible row beyond a scroll container without changing the live list',()=>{
 const f=dom(),page=new f.Element('div'),scroll=new f.Element('div');scroll.style.height='180px';scroll.style.overflow='auto';page.append(scroll);
 for(let n=1;n<=80;n++){const row=new f.Element('div','Fila '+n);row.attrs['data-row']=String(n);scroll.append(row);}
 const hidden=new f.Element('div','No debe imprimirse');hidden.computed.display='none';scroll.append(hidden);
 const html=f.snapshot(page);
 assert.equal((html.match(/data-row=/g)||[]).length,80);assert.ok(html.includes('Fila 80'));assert.ok(!html.includes('No debe imprimirse'));
 assert.match(html,/height:auto/);assert.match(html,/overflow:visible/);assert.equal(scroll.style.height,'180px');assert.equal(scroll.style.overflow,'auto');assert.equal(scroll.children.length,81);
});
test('snapshot carries the rendered chart bitmap and dimensions instead of an empty canvas',()=>{
 const f=dom(),page=new f.Element('div'),canvas=new f.Element('canvas');canvas.rect={width:320,height:100};canvas.toDataURL=type=>{assert.equal(type,'image/png');return 'data:image/png;base64,ZmljdGljaW8=';};page.append(canvas);
 const html=f.snapshot(page);assert.match(html,/<img/);assert.match(html,/data:image\/png;base64,ZmljdGljaW8=/);assert.match(html,/width="320"/);assert.match(html,/height="100"/);assert.doesNotMatch(html,/<canvas/);assert.equal(page.children[0],canvas);
});
test('tainted charts stop the snapshot rather than silently printing a missing graph',()=>{
 const f=dom(),page=new f.Element('div'),canvas=new f.Element('canvas');canvas.toDataURL=()=>{throw Error('tainted fixture');};page.append(canvas);assert.throws(()=>f.snapshot(page),/tainted fixture/);
});
test('snapshot preserves current controls and masks passwords while discarding hidden controls and handlers',()=>{
 const f=dom(),page=new f.Element('div'),input=new f.Element('input'),select=new f.Element('select'),password=new f.Element('input'),hidden=new f.Element('input');
 input.value='Valor actual';input.attrs.value='Valor anterior';input.attrs.onclick='no ejecutar';select.selectedOptions=[{textContent:'Período actual'}];password.type='password';password.value='secreto ficticio';hidden.type='hidden';hidden.value='dato oculto';page.append(input,select,password,hidden);
 const html=f.snapshot(page);assert.ok(html.includes('Valor actual'));assert.ok(html.includes('Período actual'));assert.ok(html.includes('••••'));for(const text of ['Valor anterior','secreto ficticio','dato oculto','onclick'])assert.ok(!html.includes(text));assert.equal(input.value,'Valor actual');
});

function acta(){
 let html='';const ot={fbKey:'ot-demo',id:'OT-DEMO',cliente:'Persona ficticia',tecnico:'Técnico ficticio',fechaCierre:'23/10/2026',conformidadCliente:'Conforme',firmaClienteUrl:'data:image/svg+xml;base64,ZmljdGljaW8=',firmaTecnicoUrl:'data:image/svg+xml;base64,ZmljdGljaW8=',fechaFirma:'23/10/2026 10:00',fechaFirmaTecnico:'23/10/2026 10:01',materiales:[{desc:'Equipo <A> & B',vendida:5,instalada:3}],notasTecnico:[{texto:'Nota ficticia completa',autor:'Persona ficticia',fotoUrl:'data:image/svg+xml;base64,ZmljdGljaW8='}]};
 const before=JSON.stringify(ot),c={otData:[ot],otActualId:ot.fbKey,document:{getElementById:()=>({value:'Empresa ficticia'})},svTextoLegible:v=>String(v??''),logoImpresionActualUrl:()=>'',otFirmaTecnicoUrl:o=>o.firmaTecnicoUrl,nombreClienteVigente:o=>o.cliente,otNotasNormalizadas:o=>o.notasTecnico,_svResolverClienteRegistro:()=>null,abrirVistaPreviaActaOT:()=>({document:{write:text=>{html+=text;},close(){}}}),notify:assert.fail,fbGet:assert.fail,fbUpdate:assert.fail};c.window=c;vm.createContext(c);
 for(const name of ['escapeHTML','otFirmaUrl','nombreArchivoActaOT','_imprimirOTReal'])vm.runInContext(functionSource(name),c);c._imprimirOTReal();assert.equal(JSON.stringify(ot),before);return html;
}
test('acta uses a semantic materials header and keeps original quantities, notes, names and signature dates',()=>{
 const html=acta();assert.match(html,/<thead><tr><th>Descripción<\/th>/);assert.match(html,/<tbody><tr><td>Equipo &lt;A&gt; &amp; B<\/td><td>5<\/td><td>3<\/td>/);
 for(const text of ['Persona ficticia','Técnico ficticio','Nota ficticia completa','23/10/2026 10:00','23/10/2026 10:01'])assert.ok(html.includes(text));
 assert.match(html,/<figure class="nota-evidencia"><img[^>]+><figcaption>Foto de la OT<\/figcaption><\/figure>/);assert.equal((html.match(/class="firma-img"/g)||[]).length,2);
});
test('acta allows an oversized native row to flow while ordinary signatures remain grouped',()=>{
 const html=acta(),script=html.match(/<script>([\s\S]*?)<\/script>/)[1],blocks=[{height:1400,on:false},{height:150,on:true}];let beforePrint;
 const context={window:{addEventListener:(name,fn)=>{assert.equal(name,'beforeprint');beforePrint=fn;}},document:{querySelectorAll:()=>blocks.map(b=>({getBoundingClientRect:()=>({height:b.height}),classList:{toggle:(name,on)=>{assert.equal(name,'acta-divisible');b.on=on;}}}))}};
 vm.runInNewContext(script,context);beforePrint();assert.deepEqual(blocks.map(b=>b.on),[true,false]);
});
