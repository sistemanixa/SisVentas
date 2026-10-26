'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {load}=require('./app-functions.cjs');
function fixture({permissionFailure=false,heldPermissions=false,initial='ordentrabajo'}={}){
 let document,now=0,id=0,route=initial,releasePermissions;
 class Node{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.style={};this.dataset={};this.tokens=new Set();this.attrs={};this.classList={contains:n=>this.tokens.has(n),add:(...names)=>names.forEach(n=>this.tokens.add(n)),remove:(...names)=>names.forEach(n=>this.tokens.delete(n)),toggle:(n,on)=>on?this.tokens.add(n):this.tokens.delete(n)};}
  get parentElement(){return this.parentNode;}
  get className(){return [...this.tokens].join(' ');}set className(v){this.tokens=new Set(v.split(/\s+/).filter(Boolean));}
  setAttribute(n,v){this.attrs[n]=String(v);}removeAttribute(n){delete this.attrs[n];}
  appendChild(child){this.append(child);return child;}append(...children){for(const child of children){child.remove();child.parentNode=this;this.children.push(child);}}
  prepend(child){child.remove();child.parentNode=this;this.children.unshift(child);}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}}
  contains(node){return this===node||this.children.some(child=>child.contains(node));}
  matches(s){if(s[0]==='#')return this.id===s.slice(1);if(s[0]==='.')return s.slice(1).split('.').every(n=>this.tokens.has(n));if(s==='[data-sv-data-status]')return this.dataset.svDataStatus!==undefined;return this.tagName.toLowerCase()===s;}
  querySelectorAll(s){return this.children.flatMap(child=>[...(child.matches(s)?[child]:[]),...child.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
 }
 const body=new Node('body'),boot=new Node(),message=new Node(),bar=new Node(),content=new Node(),handlers=new Map(),frames=[],timers=new Map(),calls=[],tokens={};
 boot.id='screen-loading';boot.style.display='flex';boot.className='sv-boot-screen sv-intro-loading';message.id='loading-msg';bar.id='loading-bar';content.append(message,bar);boot.append(content);body.append(boot);
 const pages={};for(const name of ['dashboard','ordentrabajo','presupuesto']){const node=pages[name]=new Node();node.id='page-'+name;node.className='page'+(name==='dashboard'?' active':'');body.append(node);}
 document={body,activeElement:body,hidden:false,createElement:tag=>new Node(tag),getElementById:id=>body.querySelector('#'+id),querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),
  addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},removeEventListener(name,fn){handlers.get(name)?.delete(fn);},dispatchEvent(event){for(const fn of [...(handlers.get(event.type)||[])])fn(event);}};
 const c={document,URL,Promise,AbortController,navigator:{onLine:true},Date:{now:()=>now},CustomEvent:class{constructor(type){this.type=type;}},console:{warn(){}},
  currentUserUid:'admin-ficticio',currentRole:'admin',isAuthenticated:true,fbAuth:{currentUser:{uid:'admin-ficticio'}},_svOperacionesSesionEpoch:0,PERMISOS_ROLES:{admin:{indiceRevision:1}},
  addEventListener(){},requestAnimationFrame:fn=>frames.push(fn),setTimeout(fn,delay){const key=++id;timers.set(key,{fn,at:now+delay});return key;},clearTimeout(key){timers.delete(key);},
  tienePermiso:()=>true,permisoModulo:()=>true,svPuedeLeerDominio:()=>true,_svPaginaDesdeRuta:()=>route,_svActualizarRuta:value=>{route=value;},
  _svAbrirRutaActual(){calls.push('ruta');for(const[name,node]of Object.entries(pages))node.classList.toggle('active',name===route);},
  fbCargarTodo(){calls.push('datos');for(const key of ['clientes','productos','ordenes_trabajo'])tokens[key]=c.SVDataReadiness.beginSource(key);},
  async cargarPermisosRoles(){calls.push('permisos');if(heldPermissions)await new Promise(resolve=>releasePermissions=resolve);if(permissionFailure)throw Error('Red ficticia interrumpida');c.PERMISOS_ROLES.admin.indiceRevision++;document.dispatchEvent({type:'sisventas:role-changed'});return true;},
  _svCargaInicial:{clientes:{listo:false,etiqueta:'clientes'},productos:{listo:false,etiqueta:'productos'},ventas:{listo:false,etiqueta:'ventas'},pagos:{listo:false,etiqueta:'cobros'}}};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/core/data-readiness.js','utf8'),c);load(c,['svCapturarContextoOperacion','svIniciarCargaPantalla','svClavesCargaInicial','svEstadoCargaInicial','svPintarCargaInicial']);
 function emit(type){document.dispatchEvent({type});}
 function flush(){let left=60;while(frames.length&&left--)frames.shift()();assert.equal(frames.length,0);}
 function tick(ms){now+=ms;for(const[key,timer]of[...timers])if(timer.at<=now){timers.delete(key);timer.fn();}flush();}
 emit('sisventas:session-ready');
 return{c,body,boot,message,bar,calls,tokens,emit,flush,tick,Node,permissionsFail:value=>{permissionFailure=value;},release:()=>releasePermissions(),setRoute(value){route=value;},now:()=>now};
}
module.exports={fixture};
