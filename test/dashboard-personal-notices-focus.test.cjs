const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {source}=require('./helpers/active-app').readActiveApp();
const View=require('../js/modules/dashboard-personal-notices');
function extract(name){const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(start>=0,name);const end=/^\}/gm;end.lastIndex=start;for(let m;(m=end.exec(source));){const value=source.slice(start,m.index+1);try{new vm.Script(value);return value;}catch(_){}}throw Error(name);}
class Element{
 constructor(doc,tag){this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attrs=new Map();this.listeners=new Map();this.hidden=false;this.disabled=false;this.style={};this.dataset={};this.value='';this.scrollTop=0;this.className='';this._text='';this.classList={add:n=>this.className+=' '+n,remove:n=>this.className=this.className.split(' ').filter(x=>x!==n).join(' ')};}
 get isConnected(){return this===this.ownerDocument.body || !!this.parentNode?.isConnected;}
 contains(node){return node===this || this.children.some(c=>c.contains(node));}
 append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}
 replaceChildren(...nodes){if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;for(const c of this.children)c.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
 get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 set textContent(value){this.replaceChildren();this._text=String(value);}
 setAttribute(key,value){this.attrs.set(key,String(value));}getAttribute(key){return this.attrs.get(key)??null;}removeAttribute(key){this.attrs.delete(key);}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
 querySelector(selector){const type=selector.match(/^\[data-personal-notices-open="(bonificacion|comision)"\]$/)?.[1];for(const c of this.children){if(type && c.getAttribute('data-personal-notices-open')===type)return c;const nested=c.querySelector(selector);if(nested)return nested;}return null;}
 focus(options){assert.equal(this.isConnected,true);this.ownerDocument.activeElement=this;this.focusOptions=options;this.focusCount=(this.focusCount||0)+1;this.ownerDocument.emit('focusin',{target:this});}
}
function fixture(){
 const events=new Map(),elements=new Map(),frames=[];
 const doc={hidden:false,addEventListener(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},removeEventListener(name,fn){events.get(name)?.delete(fn);},emit(name,extra={}){for(const fn of [...(events.get(name)||[])])fn({type:name,...extra});},getElementById:id=>elements.get(id)||null,createElement(tag){return new Element(this,tag);}};
 doc.body=doc.createElement('body');doc.documentElement=doc.createElement('html');doc.activeElement=doc.body;
 function node(id,tag='div'){const n=doc.createElement(tag);n.id=id;elements.set(id,n);doc.body.append(n);return n;}
 const box=node('dash-personal-notices'),back=node('ctaemp-volver-empleados','button'),other=node('other','button'),scroll=node('content');scroll.scrollTop=280;
 for(const id of ['ctaemp-filtro-tipo','ctaemp-filtro-estado'])node(id,'select');
 const page={id:'page-dashboard'},permissions=new Set(['dashboard.miCuenta','ctaemp']),user={uid:'u'};
 doc.querySelector=s=>s==='.content'?scroll:s==='.page.active'?page:box.querySelector(s);
 const item={id:'ficticio',type:'bonificacion',description:'Reconocimiento ficticio',status:'aprobado',amount:5000,paidAmount:0,remaining:5000,period:'2026-11',sourceRefs:{ctaKey:'',gastoKey:''}};
 const c={window:null,document:doc,currentUserUid:'u',currentRole:'tecnico',PERMISOS_ROLES:{tecnico:{indiceRevision:1}},_svOperacionesSesionEpoch:0,_impersonacionOriginal:null,fbAuth:{currentUser:user},_dashAvisosCTA:null,_dashAvisosGastosFuente:null,_dashAvisosGeneracion:1,_dashAvisosOrigen:null,_dashAvisosRetorno:null,gastosData:[],_ctaEmpVista:'pendientes',_ctaEmpPeriodoOffset:0,own:{fbKey:'e'},svEmpleadoPropio:()=>c.own,tienePermiso:p=>permissions.has(p),permisoModulo:p=>permissions.has(p),_svEsPaginaActiva:p=>page.id==='page-'+p,_ctaEmpDestinoVolver:()=> 'dashboard',svAvisosCuentaRegistro:x=>x,SVPersonalNoticesView:View,SVPersonalNotices:{build:()=>({status:c.resultStatus,items:c.items,issues:[]})},resultStatus:'ready',items:[item],requestAnimationFrame:fn=>frames.push(fn),fetch:()=>assert.fail('No I/O'),fbGet:()=>assert.fail('No I/O'),fbSet:()=>assert.fail('No writes'),setTimeout:()=>assert.fail('No new timer'),setInterval:()=>assert.fail('No polling'),MutationObserver:class{constructor(){assert.fail('No observer');}},Date,Map,Set,WeakMap,Intl};
 c.svAbrirAvisoCuentaPersonal=()=>assert.fail('Esta prueba sólo retorna, no abre una cuenta');c.renderDashMiCuenta=()=>{};c.svCuentaDashboardEnPrimerPlano=()=>!doc.hidden&&page.id==='page-dashboard';c.svRepintarCuentaDashboard=()=>{};c.addEventListener=doc.addEventListener;c.window=c;vm.createContext(c);
 for(const name of ['svCapturarContextoOperacion','svContextoAvisosCuenta','svCancelarRetornoAvisoCuentaPersonal','svPrepararRetornoAvisoCuentaPersonal','svPaginaRetornoAvisoCuentaPersonal','svRestaurarRetornoAvisoCuentaPersonal','svRetirarCuentaDashboardPendiente','svLimpiarAvisosCuentaPersonal','svRenderAvisosCuentaPersonal','svOrigenAvisoCuentaVigente'])vm.runInContext(extract(name),c);
 const a=source.indexOf("document.addEventListener('sisventas:session-ended',svLimpiarAvisosCuentaPersonal)");assert.ok(a>=0);const hoursEvents=source.indexOf("document.addEventListener('sisventas:session-ended',svLimpiarHorasPersonalesDashboard)",a);vm.runInContext(source.slice(a,hoursEvents>=0?hoursEvents:source.indexOf('function renderDashMiCuenta()',a)),c);
 c._dashAvisosCTA={valid:c.svContextoAvisosCuenta(),employeeId:'e',generation:1,status:'ready',data:{f:item}};
 c._dashAvisosGastosFuente={valid:c.svContextoAvisosCuenta(),employeeId:'e',ready:true};
 const countTemporary=()=>['pointerdown','keydown','wheel','touchstart','focusin'].reduce((n,key)=>n+(events.get(key)?.size||0),0);
 function open(){c.svRenderAvisosCuentaPersonal();page.id='page-ctaemp';back.focus();c._dashAvisosOrigen={valid:c.svContextoAvisosCuenta(),employeeId:'e',type:'bonificacion',scroll,scrollTop:280,filters:{type:'sueldo',state:'aprobado',vista:'pendientes',offset:0}};elements.get('ctaemp-filtro-tipo').value='bonificacion';elements.get('ctaemp-filtro-estado').value='';c._ctaEmpVista='todos';scroll.scrollTop=0;}
 function route(pageName='dashboard'){page.id='page-'+pageName;doc.emit('sisventas:page-changed',{detail:{page:pageName}});for(const frame of frames.splice(0))frame();}
 function begin(){c._dashAvisosGeneracion++;c._dashAvisosCTA={valid:c.svContextoAvisosCuenta(),employeeId:'e',generation:c._dashAvisosGeneracion,status:'loading',data:null};c.svRenderAvisosCuentaPersonal();}
 function finish(status='ready'){c._dashAvisosCTA.status=status;c._dashAvisosCTA.data={f:item};c.svRenderAvisosCuentaPersonal();}
 return {c,doc,elements,box,back,other,scroll,page,permissions,events,open,route,begin,finish,countTemporary,button:()=>box.querySelector('[data-personal-notices-open="bonificacion"]')};
}

test('retorno humano espera render de la carga diferida real; el paint cacheado y loading no consumen foco',async()=>{
 const f=fixture();f.open();f.c.svPrepararRetornoAvisoCuentaPersonal({isTrusted:true});assert.equal(f.countTemporary(),5);f.route();
 assert.equal(f.elements.get('ctaemp-filtro-tipo').value,'sueldo');assert.equal(f.elements.get('ctaemp-filtro-estado').value,'aprobado');assert.equal(f.c._ctaEmpVista,'pendientes');assert.equal(f.c._dashAvisosOrigen,null);
 f.c.svRenderAvisosCuentaPersonal();assert.notEqual(f.doc.activeElement,f.button());assert.ok(f.c._dashAvisosRetorno); // Before the existing showPage 40ms callback.
 f.begin();assert.equal(f.button(),null);assert.ok(f.c._dashAvisosRetorno);await Promise.resolve();f.finish();
 assert.equal(f.doc.activeElement,f.button());assert.equal(f.button().focusOptions.preventScroll,true);assert.equal(f.scroll.scrollTop,280);assert.equal(f.c._dashAvisosRetorno,null);assert.equal(f.countTemporary(),0);
 const first=f.button();f.c.svRenderAvisosCuentaPersonal();assert.notEqual(f.button(),first);assert.equal(f.doc.activeElement,f.button());assert.equal(f.countTemporary(),0);
});
for(const event of [undefined,{}, {isTrusted:false}])test('navegación sin gesto explícito no crea intención de foco: '+JSON.stringify(event),()=>{
 const f=fixture();f.open();f.c.svPrepararRetornoAvisoCuentaPersonal(event);f.route();f.begin();f.finish();assert.notEqual(f.doc.activeElement,f.button());assert.equal(f.c._dashAvisosRetorno,null);assert.equal(f.countTemporary(),0);
});
for(const kind of ['pointerdown','keydown','wheel','touchstart','focusin'])test('la interacción posterior '+kind+' cancela sin robar foco a un control nuevo',()=>{
 const f=fixture();f.open();f.c.svPrepararRetornoAvisoCuentaPersonal({isTrusted:true});f.route();f.begin();
 if(kind==='focusin')f.other.focus();else f.doc.emit(kind,{target:f.other});
 const focus=f.doc.activeElement;assert.equal(f.c._dashAvisosRetorno,null);f.finish();assert.equal(f.doc.activeElement,focus);assert.equal(f.countTemporary(),0);assert.equal(f.scroll.scrollTop,0);
});
for(const state of ['empty','error','incomplete-empty'])test('la carga '+state+' consume intención sin enfocar un botón inexistente o no verificado',()=>{
 const f=fixture();f.open();f.c.svPrepararRetornoAvisoCuentaPersonal({isTrusted:true});f.route();f.begin();if(state!=='error')f.c.items=[];if(state==='incomplete-empty')f.c.resultStatus='incomplete';f.finish(state==='error'?'error':'ready');assert.equal(f.button(),null);assert.equal(f.c._dashAvisosRetorno,null);assert.equal(f.countTemporary(),0);
});
test('incompleto con movimiento verificado devuelve foco sólo a su botón disponible',()=>{const f=fixture();f.open();f.c.svPrepararRetornoAvisoCuentaPersonal({isTrusted:true});f.route();f.begin();f.c.resultStatus='incomplete';f.finish();assert.equal(f.doc.activeElement,f.button());assert.equal(f.c._dashAvisosRetorno,null);});
for(const mutate of [f=>f.c.currentUserUid='other',f=>f.c.fbAuth.currentUser={uid:'u'},f=>f.c.currentRole='admin',f=>f.c.PERMISOS_ROLES.tecnico.indiceRevision++,f=>f.c._svOperacionesSesionEpoch++,f=>f.c._impersonacionOriginal={},f=>f.c.own={fbKey:'other'},f=>f.permissions.delete('dashboard.miCuenta'),f=>f.permissions.delete('ctaemp')])test('contexto perdido descarta retorno: '+mutate.toString(),()=>{
 const f=fixture();f.open();f.c.svPrepararRetornoAvisoCuentaPersonal({isTrusted:true});f.route();f.begin();mutate(f);f.finish();assert.notEqual(f.doc.activeElement,f.button());assert.equal(f.c._dashAvisosRetorno,null);assert.equal(f.countTemporary(),0);
});
for(const kind of ['hidden','route','second-dashboard','session','role'])test('el ciclo '+kind+' retira la intención y todas sus escuchas temporales',()=>{
 const f=fixture();f.open();f.c.svPrepararRetornoAvisoCuentaPersonal({isTrusted:true});f.route();f.begin();
 if(kind==='hidden'){f.doc.hidden=true;f.doc.emit('visibilitychange');f.doc.hidden=false;}else if(kind==='route')f.route('productos');else if(kind==='second-dashboard')f.route();else f.doc.emit(kind==='session'?'sisventas:session-ended':'sisventas:role-changed');
 assert.equal(f.c._dashAvisosRetorno,null);assert.equal(f.countTemporary(),0);if(f.c._dashAvisosCTA)f.finish();assert.notEqual(f.doc.activeElement,f.button());
});
test('rearmar sustituye la intención anterior y clear no deja escuchas acumuladas',()=>{
 const f=fixture();f.open();for(let i=0;i<10;i++){f.c.svPrepararRetornoAvisoCuentaPersonal({isTrusted:true});assert.equal(f.countTemporary(),5);}f.c.svLimpiarAvisosCuentaPersonal();assert.equal(f.countTemporary(),0);assert.equal(f.events.get('visibilitychange').size,1);assert.equal(f.c._dashAvisosRetorno,null);
});
test('foco cambiado por otro controlador también prevalece aunque no se haya emitido focusin',()=>{
 const f=fixture();f.open();f.c.svPrepararRetornoAvisoCuentaPersonal({isTrusted:true});f.route();f.begin();f.doc.activeElement=f.other;f.finish();assert.equal(f.doc.activeElement,f.other);assert.equal(f.c._dashAvisosRetorno,null);
});
test('sólo el retorno propio a Inicio acepta una intención humana',()=>{
 for(const change of [f=>f.c._ctaEmpDestinoVolver=()=> 'empleados',f=>f.page.id='page-productos',f=>f.c._dashAvisosOrigen=null]){const f=fixture();f.open();change(f);f.c.svPrepararRetornoAvisoCuentaPersonal({isTrusted:true});assert.equal(f.c._dashAvisosRetorno,null);assert.equal(f.countTemporary(),0);}
});
