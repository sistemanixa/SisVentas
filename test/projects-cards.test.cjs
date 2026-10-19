'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/projects.js','utf8').replaceAll('\r\n','\n');
function fn(name){
 const start=source.search(new RegExp('^ (?:async )?function '+name+'\\(','m'));assert.ok(start>=0);
 for(let end=source.indexOf('}',start);end>=0;end=source.indexOf('}',end+1)){const code=source.slice(start,end+1);try{new vm.Script(code);return code;}catch(_){}}
 throw Error(name);
}
const decode=value=>value.replace(/&quot;|&#39;|&lt;|&gt;|&amp;/g,token=>({'&quot;':'"','&#39;':"'",'&lt;':'<','&gt;':'>','&amp;':'&'}[token]));
class Element{
 constructor(tag,attrs={},dispatch){this.tagName=tag.toUpperCase();this.attrs={...attrs};this.children=[];this.parentNode=null;this.dispatch=dispatch;this.value='';}
 get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]));}
 setAttribute(key,value){this.attrs[key]=String(value);}
 getAttribute(key){return this.attrs[key]??null;}
 append(node){node.parentNode=this;this.children.push(node);}
 compound(selector){
  const tag=selector.match(/^[a-z][\w-]*/i),id=selector.match(/#([\w-]+)/);
  if(tag&&tag[0].toUpperCase()!==this.tagName||id&&this.attrs.id!==id[1])return false;
  if([...selector.matchAll(/\.([\w-]+)/g)].some(([,name])=>!(this.attrs.class||'').split(/\s+/).includes(name)))return false;
  return [...selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)].every(([,name,value])=>Object.hasOwn(this.attrs,name)&&(value===undefined||this.attrs[name]===value));
 }
 matches(selector){const parts=selector.trim().split(/\s+/);if(!this.compound(parts.pop()))return false;let node=this.parentNode;while(parts.length){const part=parts.pop();while(node&&!node.compound(part))node=node.parentNode;if(!node)return false;node=node.parentNode;}return true;}
 closest(selector){for(let node=this;node;node=node.parentNode)if(node.matches(selector))return node;return null;}
 querySelectorAll(selector){return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 set innerHTML(html){
  for(const node of this.children)node.parentNode=null;this.children=[];this.html=html;const stack=[this];
  for(const match of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*?)>/gi)){
   if(match[0].startsWith('</')){stack.pop();continue;}
   const attrs={};for(const [,key,,quoted,single,bare]of match[2].matchAll(/([^\s=]+)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[key]=decode(quoted??single??bare??'');
   const node=new Element(match[1],attrs,this.dispatch);stack.at(-1).append(node);if(!['INPUT','BR','HR','IMG'].includes(node.tagName))stack.push(node);
  }
 }
 get innerHTML(){return this.html||'';}
 click(){return this.dispatch('click',{target:this});}
 scrollIntoView(){this.scrolled=(this.scrolled||0)+1;}
}
const project=(id,name,stage='planificacion')=>({id,name,stage,number:'PR-'+id,clientName:'Cliente ficticio',address:'Dirección ficticia',goal:'Objetivo',members:{owner:{name:'Titular'}},needs:[],budgets:[],updatedAt:1000});
function fixture(projects=[project('one','Proyecto de prueba')]){
 const events={},opens=[],creates=[],page=new Element('section',{id:'page-proyectos'},(type,event)=>events[type]?.(event));
 const c={M:require('../js/core/projects-model'),state:{projects,selected:'',tab:'necesidades',search:'',filter:'all',canCreate:true},host:()=>page,
  preview:()=>false,details:()=>opens.push(c.state.selected),editProject:async isNew=>creates.push(isNew),
  selectTab:()=>assert.fail('Una tarjeta no cambia una solapa'),report:error=>assert.fail(error.message),request:()=>assert.fail('Abrir la ficha no consulta ni guarda'),
  document:{addEventListener:(name,handler)=>events[name]=handler}};c.window=c;vm.createContext(c);
 for(const name of ['esc','norm','icon','button','date','initials','pill'])vm.runInContext(source.split('\n').find(line=>line.startsWith(' const '+name+'=')),c);
 for(const name of ['avatars','empty','shell','overview','cards'])vm.runInContext(fn(name),c);
 const start=source.indexOf(" document.addEventListener('input'"),end=source.indexOf(" document.addEventListener('sisventas:page-changed'",start);
 vm.runInContext(source.slice(start,end),c);c.overview();return {c,page,events,opens,creates};
}

test('nombre, fondo, icono y pie abren una sola vez mediante la misma tarjeta accesible',async()=>{
 for(const selector of [null,'h3','.px-project-icon i','.px-card-foot small']){
  const f=fixture(),card=f.page.querySelector('.px-card');assert.equal(card.tagName,'ARTICLE');assert.equal(card.getAttribute('role'),'button');assert.equal(card.getAttribute('tabindex'),'0');assert.equal(card.getAttribute('aria-label'),'Abrir proyecto: Proyecto de prueba');
  assert.equal(card.querySelectorAll('button').length,0);assert.equal(card.querySelectorAll('a').length,0);
  await (selector?card.querySelector(selector):card).click();assert.deepEqual(f.opens,['one']);assert.equal(f.c.state.tab,'resumen');assert.equal(f.page.scrolled,1);assert.deepEqual(f.creates,[]);
 }
});

test('Enter y Espacio abren una vez, evitan el scroll y no repiten al mantener la tecla',()=>{
 for(const key of ['Enter',' ']){
  const f=fixture(),card=f.page.querySelector('.px-card');let prevented=0;
  f.events.keydown({target:card,key,repeat:false,preventDefault:()=>prevented++});assert.deepEqual(f.opens,['one']);assert.equal(prevented,1);
  f.events.keydown({target:card,key,repeat:true,preventDefault:()=>prevented++});assert.deepEqual(f.opens,['one']);assert.equal(prevented,2);
  f.events.keydown({target:card,key:'ArrowDown',preventDefault:()=>assert.fail('No capturar otras teclas')});assert.deepEqual(f.opens,['one']);
 }
});

test('buscar y filtrar conserva sus controles y una tarjeta retirada no abre el proyecto anterior',async()=>{
 const f=fixture([project('one','Cámaras del depósito'),project('two','Acceso aprobado','aprobado')]),previous=f.page.querySelector('.px-card h3');
 const filters=f.page.querySelectorAll('[data-px=filter]'),approved=filters.find(node=>node.dataset.id==='approved');
 f.events.keydown({target:approved,key:' ',preventDefault:()=>assert.fail('El filtro conserva su teclado nativo')});await approved.click();
 assert.equal(f.c.state.filter,'approved');assert.equal(approved.getAttribute('aria-pressed'),'true');assert.deepEqual(f.page.querySelectorAll('.px-card').map(node=>node.dataset.id),['two']);assert.deepEqual(f.opens,[]);
 await previous.click();assert.deepEqual(f.opens,[]);
 await filters.find(node=>node.dataset.id==='all').click();const search=f.page.querySelector('[data-px-search]');search.value='camaras';f.events.input({target:search});
 assert.deepEqual(f.page.querySelectorAll('.px-card').map(node=>node.dataset.id),['one']);assert.equal(f.c.state.search,'camaras');assert.deepEqual(f.opens,[]);
 search.value='sin coincidencias';f.events.input({target:search});assert.equal(f.page.querySelectorAll('.px-card').length,0);assert.equal(f.page.querySelector('[data-px=new]')?.dataset.px,'new','La acción superior de crear se conserva');assert.deepEqual(f.opens,[]);
});

test('el nombre se conserva como etiqueta escapada y crear proyecto sigue siendo una acción separada',async()=>{
 const f=fixture([project('one','Alarma "A" <Sur>')]),card=f.page.querySelector('.px-card');
 assert.equal(card.getAttribute('aria-label'),'Abrir proyecto: Alarma "A" <Sur>');assert.equal(card.querySelectorAll('sur').length,0);
 const create=f.page.querySelector('[data-px=new]');await create.click();assert.deepEqual(f.creates,[true]);assert.deepEqual(f.opens,[]);
});
