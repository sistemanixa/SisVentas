'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createProjects}=require('../cotizador/projects'),Model=require('../cotizador/projects-model'),{memoryDB}=require('./helpers/private-finance-fixtures.cjs');
const previousOwnership=process.env.COMMERCIAL_OWNERSHIP_ENABLED;
before(()=>{process.env.COMMERCIAL_OWNERSHIP_ENABLED='true';});
after(()=>{if(previousOwnership===undefined)delete process.env.COMMERCIAL_OWNERSHIP_ENABLED;else process.env.COMMERCIAL_OWNERSHIP_ENABLED=previousOwnership;});
const plain=value=>JSON.parse(JSON.stringify(value)),turn=()=>new Promise(resolve=>setImmediate(resolve));
function project(){return {id:'project',number:'PR-FICTICIO',name:'Proyecto ficticio',clientId:'client',clientName:'Cliente ficticio',address:'Domicilio ficticio',goal:'Objetivo ficticio',due:'',stage:'planificacion',owner:'owner',members:{owner:{name:'Titular ficticio',access:'owner'},editor:{name:'Colaborador ficticio',access:'editor'},reader:{name:'Lector ficticio',access:'viewer'}},needs:[],budgets:[],activity:[],revision:1,createdAt:100,updatedAt:100};}
function backend(){
 const db=memoryDB({sv_chat_roles:{owner:{activo:true,rol:'vendedor'},editor:{activo:true,rol:'vendedor'},reader:{activo:true,rol:'vendedor'},other:{activo:true,rol:'vendedor'}},sv_chat_directorio:{owner:{nombre:'Titular ficticio'},editor:{nombre:'Colaborador ficticio'},reader:{nombre:'Lector ficticio'},other:{nombre:'Otra persona'}},sv_usuarios:{a:{uid:'owner',nombre:'Titular ficticio',rol:'vendedor'},b:{uid:'other',nombre:'Otra persona',rol:'vendedor'}},sv_permisos:{vendedor:{indiceVersion:2,indiceRevision:1,indiceModulos:{proyectos:true,presupuesto:true,clientes:true},bloqueados:[]}},sv_proyectos:{project:project()},sisventas:{clientes:{client:{nombre:'Cliente ficticio',direccion:'Domicilio ficticio',secret:'No proyectar'},inactive:{nombre:'Cliente inactivo',activo:false}},presupuestos:{quote:{numero:'PP-FICTICIO',clienteFbKey:'client',responsableUid:'owner',tituloSolucion:'Propuesta ficticia',total:1000,compra:700,items:[{desc:'Producto ficticio',qty:1,punit:1000,compra:700}]},foreign:{numero:'PP-AJENO',clienteFbKey:'client',responsableUid:'other',total:999}}}});
 const reads=[],writes=[];const ref=db.ref.bind(db);db.ref=path=>{const r=ref(path);return {...r,get:async()=>{reads.push(path);return r.get();},transaction:async(...args)=>{writes.push(path);return r.transaction(...args);}};};
 const service=createProjects({db,auth:{verifyIdToken:async uid=>({uid})},enabled:true,now:()=>200,uuid:()=> 'new-fictitious-id'});
 return {db,reads,writes,service,actor:uid=>service.authorize({headers:{authorization:'Bearer '+(uid||'owner')}})};
}
test('base conserva formularios y devuelve cero presupuestos sin leer ningún historial comercial',async()=>{
 const f=backend(),a=await f.actor();f.reads.length=0;const result=await f.service.options(a,'project','base');
 assert.deepEqual(f.reads.sort(),['sv_proyectos/project','sv_chat_directorio','sv_chat_roles','sisventas/clientes'].sort());assert.equal(result.people.length,4);assert.equal(result.clients.length,1);assert.equal(result.clients[0].secret,undefined);assert.deepEqual(result.budgets,[]);assert.deepEqual(f.writes,[]);
});
test('budgets lee las propuestas autorizadas sólo al solicitar selector y no descarga directorios ni clientes',async()=>{
 const f=backend(),a=await f.actor();f.reads.length=0;const result=await f.service.options(a,'project','budgets');
 assert.deepEqual(result.people,[]);assert.deepEqual(result.clients,[]);assert.deepEqual(result.budgets.map(b=>b.id),['quote']);assert.ok(f.reads.includes('sisventas/presupuestos'));assert.ok(!f.reads.includes('sv_chat_directorio'));assert.ok(!f.reads.includes('sisventas/clientes'));assert.equal(result.budgets[0].compra,undefined);assert.equal(result.budgets[0].items[0].compra,undefined);assert.deepEqual(f.writes,[]);
});
test('el contrato sin kind conserva opciones completas y las propuestas todavía no vinculadas',async()=>{
 const f=backend(),a=await f.actor();const original=await f.service.options(a,'project'),explicit=await f.service.options(a,'project','all');assert.deepEqual(original,explicit);assert.ok(original.people.length);assert.ok(original.clients.length);assert.equal(original.budgets[0].id,'quote');assert.equal(f.db.root.sv_proyectos.project.budgets.length,0);
});
test('medición ficticia: ficha nueva evita cuatro lecturas comerciales; no confunde bytes evitados con tiempo o factura',async()=>{
 const f=backend(),a=await f.actor();for(let i=0;i<300;i++)f.db.root.sisventas.presupuestos['fake-'+i]={clienteFbKey:'client',responsableUid:'owner',total:100,items:[{desc:'Detalle ficticio '.repeat(20),qty:1,punit:100}]};
 f.reads.length=0;const all=await f.service.options(a,''),allReads=f.reads.slice();f.reads.length=0;const base=await f.service.options(a,'','base');
 assert.equal(allReads.length,7);assert.equal(f.reads.length,3);assert.equal(base.people.length,all.people.length);assert.equal(base.clients.length,all.clients.length);assert.ok(JSON.stringify(base).length<JSON.stringify(all).length/20);assert.ok(!f.reads.some(p=>p.startsWith('sisventas/presupuestos')));
});
test('kind inválido y selector sin proyecto o sin permiso no consultan catálogos ni escriben',async()=>{
 const f=backend(),a=await f.actor();for(const [id,kind,actor,statusCode]of [['project','otra',a,400],['','budgets',a,400],['project','budgets',{...a,quoteAllowed:false},403]]){f.reads.length=0;await assert.rejects(f.service.options(actor,id,kind),{statusCode});assert.deepEqual(f.reads,[]);}assert.deepEqual(f.writes,[]);
});
test('un proyecto ajeno o de sólo lectura no obtiene directorios ni presupuestos para editar',async()=>{
 for(const uid of ['other','reader']){const f=backend(),a=await f.actor(uid);for(const kind of ['base','budgets']){f.reads.length=0;await assert.rejects(f.service.options(a,'project',kind),{statusCode:uid==='other'?404:403});assert.deepEqual(f.reads,['sv_proyectos/project']);}assert.deepEqual(f.writes,[]);}
});
test('otra solicitud vuelve a comprobar revocación y módulos; base respeta permiso de clientes',async()=>{
 const f=backend(),a=await f.actor();await f.service.options(a,'project','base');f.db.root.sv_chat_roles.owner.activo=false;await assert.rejects(f.actor(),{statusCode:403});f.db.root.sv_chat_roles.owner.activo=true;f.db.root.sv_permisos.vendedor.bloqueados=['proyectos'];await assert.rejects(f.actor(),{statusCode:403});f.db.root.sv_permisos.vendedor.bloqueados=['clientes'];const limited=await f.actor();f.reads.length=0;assert.deepEqual((await f.service.options(limited,'project','base')).clients,[]);assert.ok(!f.reads.includes('sisventas/clientes'));
});
test('elegir presupuesto no concede el vínculo: guardar relee propiedad y conserva el proyecto ante cambio concurrente',async()=>{
 const f=backend(),a=await f.actor(),before=plain(f.db.root.sv_proyectos.project);assert.equal((await f.service.options(a,'project','budgets')).budgets[0].id,'quote');f.db.root.sisventas.presupuestos.quote.responsableUid='other';f.reads.length=0;await assert.rejects(f.service.save(a,{type:'budget-link',projectId:'project',revision:1,data:{sourceId:'quote'}}),{statusCode:404});assert.deepEqual(f.db.root.sv_proyectos.project,before);assert.deepEqual(f.writes,[]);assert.ok(f.reads.includes('sisventas/presupuestos/quote'));
});

const decode=value=>value.replace(/&quot;|&#39;|&lt;|&gt;|&amp;/g,token=>({'&quot;':'"','&#39;':"'",'&lt;':'<','&gt;':'>','&amp;':'&'}[token]));
class Element{
 constructor(tag,attrs={}){this.tagName=tag.toUpperCase();this.attrs={...attrs};this.children=[];this.parentNode=null;this.style={};this.isConnected=true;this.value='';this.events={};this.classList={contains:name=>(this.attrs.class||'').split(/\s+/).includes(name),add:name=>this.attrs.class=(this.attrs.class||'')+' '+name,remove:name=>this.attrs.class=(this.attrs.class||'').split(/\s+/).filter(v=>v!==name).join(' ')};}
 get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]));}
 get className(){return this.attrs.class||'';}set className(v){this.attrs.class=v;}
 setAttribute(key,value){this.attrs[key]=String(value);}getAttribute(key){return this.attrs[key]??null;}
 appendChild(node){node.parentNode=this;this.children.push(node);return node;}append(node){return this.appendChild(node);}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;this.isConnected=false;}
 showModal(){this.open=true;}scrollIntoView(){}focus(){this.focused=true;}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
 matches(selector){const parts=selector.trim().split(/\s+/);if(!this.compound(parts.pop()))return false;let node=this.parentNode;while(parts.length){const part=parts.pop();while(node&&!node.compound(part))node=node.parentNode;if(!node)return false;node=node.parentNode;}return true;}
 compound(selector){const tag=selector.match(/^[a-z][\w-]*/i),id=selector.match(/#([\w-]+)/);if(tag&&tag[0].toUpperCase()!==this.tagName||id&&this.attrs.id!==id[1])return false;if([...selector.matchAll(/\.([\w-]+)/g)].some(([,name])=>!(this.attrs.class||'').split(/\s+/).includes(name)))return false;return [...selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)].every(([,name,value])=>Object.hasOwn(this.attrs,name)&&(value===undefined||this.attrs[name]===value));}
 closest(selector){for(let n=this;n;n=n.parentNode)if(n.matches(selector))return n;return null;}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(n.matches(selector)?[n]:[]),...n.querySelectorAll(selector)]);}querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 get textContent(){return (this._text||'')+this.children.map(n=>n.textContent).join('');}set textContent(value){this._text=String(value);this.children=[];}
 set innerHTML(html){this.children=[];this._text='';this.html=html;const stack=[this];let at=0;for(const match of html.matchAll(/<\/?([a-z][\w-]*)\b([^>]*?)>/gi)){stack.at(-1)._text=(stack.at(-1)._text||'')+decode(html.slice(at,match.index));at=match.index+match[0].length;if(match[0].startsWith('</')){stack.pop();continue;}const attrs={};for(const [,key,,quoted,single,bare]of match[2].matchAll(/([^\s=]+)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[key]=decode(quoted??single??bare??'');const n=new Element(match[1],attrs);n.value=attrs.value||'';stack.at(-1).append(n);if(!['INPUT','BR','HR','IMG'].includes(n.tagName))stack.push(n);}}
 get innerHTML(){return this.html||'';}
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function frontend(environment={}){
 const events={},body=new Element('body'),page=new Element('section',{id:'page-proyectos',class:'page active'}),calls=[],messages=[];body.style.overflow='auto';body.append(page);let allowed=true,next=null;
 const record=Model.project(project(),{uid:'owner',name:'Titular ficticio',role:'vendedor',enabled:true,createAllowed:true,editAllowed:true,quoteAllowed:true});
 const c={window:null,SVProjectsModel:Model,currentUserUid:'owner',currentRole:'vendedor',PERMISOS_ROLES:{vendedor:{indiceRevision:1},admin:{indiceRevision:2}},fbAuth:{currentUser:{uid:'owner',getIdToken:async()=> 'fictitious-token'}},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://transport.invalid'},location:{hostname:'127.0.0.1',search:''},URLSearchParams,AbortSignal:environment.AbortSignal||AbortSignal,AbortController,crypto:{randomUUID:()=> 'fictitious'},console,Promise,Date,setTimeout,clearTimeout,FormData:class{constructor(form){this.form=form;}get(k){return this.form.querySelector('[name='+k+']')?.value??null;}getAll(){return [];}}};
 c.window=c;c.permisoModulo=()=>allowed;c.notify=m=>messages.push(m);
 c.document={body,getElementById:id=>id==='page-proyectos'?page:null,createElement:tag=>new Element(tag),addEventListener:(name,fn)=>(events[name]??=[]).push(fn)};
 c.fetch=async(url,opts)=>{calls.push({url,opts});if(url.endsWith('/proyectos'))return response({projects:[record],canCreate:true});if(next)return next(url,opts);return response({people:[{uid:'owner',name:'Titular ficticio',role:'vendedor'},{uid:'editor',name:'Colaborador ficticio',role:'vendedor'}],clients:[{id:'client',name:'Cliente ficticio',address:'Domicilio ficticio'}],budgets:[]});};
 vm.runInNewContext(fs.readFileSync('js/modules/projects.js','utf8'),c);await c.SVProjects.open();
 async function emit(name,event){for(const fn of events[name]||[])await fn(event);}
 const api={c,page,body,calls,messages,record,events,response:fn=>{next=fn;},deny:()=>{allowed=false;},dialog:()=>body.querySelector('dialog'),async click(action,id){const target=page.querySelector('[data-px='+action+']'+(id?'[data-id='+id+']':''));assert.ok(target,'Existe acción '+action);return emit('click',{target});},cancel(){const d=body.querySelector('dialog');assert.ok(d);d.querySelector('[data-px=close]').onclick();},async openProject(){await this.click('open','project');},emit};return api;
}
function response(data){return {ok:true,status:200,json:async()=>plain({ok:true,...data})};}
const baseOptions={people:[{uid:'owner',name:'Titular ficticio',role:'vendedor'},{uid:'editor',name:'Colaborador ficticio',role:'vendedor'}],clients:[{id:'client',name:'Cliente ficticio'}],budgets:[]};
test('nuevo, editar e integrantes piden base y muestran carga antes de abrir el formulario',async()=>{
 for(const action of ['new','edit','members']){const f=await frontend();if(action!=='new')await f.openProject();if(action==='members')await f.click('tab','integrantes');const pending=deferred();f.response(()=>pending.promise);const task=f.click(action);await turn();assert.match(f.dialog().querySelector('[data-px-options-status]').textContent,/Cargando clientes e integrantes/);assert.match(f.calls.at(-1).url,/\/opciones\?kind=base/);assert.ok(!f.calls.at(-1).url.includes('kind=budgets'));assert.equal(f.body.style.overflow,'hidden');pending.resolve(response(baseOptions));await task;assert.equal(f.dialog().querySelector('[data-px-options-status]'),null);assert.ok(f.dialog().querySelector('[type=submit]'));assert.equal(f.calls.length,2);assert.deepEqual(f.messages,[]);f.cancel();assert.equal(f.body.style.overflow,'auto');}
});
test('vincular solicita presupuestos al abrir, filtra mismo cliente y no necesita directorio',async()=>{
 const f=await frontend();await f.openProject();await f.click('tab','presupuestos');assert.equal(f.calls.length,1);const pending=deferred();f.response(()=>pending.promise);const task=f.click('link');await turn();assert.match(f.dialog().querySelector('[data-px-options-status]').textContent,/Cargando presupuestos/);assert.match(f.calls.at(-1).url,/kind=budgets&proyecto=project/);pending.resolve(response({people:[],clients:[],budgets:[{id:'quote',number:'PP-FICTICIO',title:'Opción ficticia',clientId:'client',total:100,currency:'ARS',status:'borrador'},{id:'other-client',number:'PP-OTRO',title:'No mostrar',clientId:'other-client',total:1}]}));await task;assert.deepEqual(f.dialog().querySelectorAll('[name=budget]').map(n=>n.value),['quote']);assert.deepEqual(f.messages,[]);
});
test('cancelar una lectura pendiente aborta sólo su petición y una respuesta tardía no abre formulario',async()=>{
 const f=await frontend();const pending=deferred();f.response(()=>pending.promise);const task=f.click('new');await turn();const signal=f.calls.at(-1).opts.signal;f.cancel();assert.equal(signal.aborted,true);assert.equal(f.dialog(),null);assert.equal(f.body.style.overflow,'auto');pending.resolve(response(baseOptions));await task;assert.equal(f.dialog(),null);assert.deepEqual(f.messages,[]);assert.equal(f.calls.length,2);
});
test('sin AbortSignal.any se conservan tanto Cancelar como el plazo de veinte segundos',async()=>{
 for(const cancel of [true,false]){const deadline=new AbortController(),limits=[],f=await frontend({AbortSignal:{timeout:ms=>{limits.push(ms);return deadline.signal;}}});f.response((_url,opts)=>new Promise((_resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('Tiempo de espera ficticio')),{once:true})));const task=f.click('new');await turn();const signal=f.calls.at(-1).opts.signal;if(cancel)f.cancel();else deadline.abort();await task;assert.equal(signal.aborted,true);assert.deepEqual(limits,[20000,20000]);assert.deepEqual(f.messages,[]);if(cancel)assert.equal(f.dialog(),null);else assert.equal(f.dialog().querySelector('.px-error').textContent,'Tiempo de espera ficticio');}
});
test('la respuesta cancelada no reemplaza ni cierra el formulario abierto por un segundo intento',async()=>{
 const f=await frontend(),first=deferred(),second=deferred();let calls=0;f.response(()=>++calls===1?first.promise:second.promise);
 const old=f.click('new');await turn();f.cancel();const current=f.click('new');await turn();second.resolve(response({...baseOptions,clients:[{id:'fresh-client',name:'Cliente de la nueva consulta'}]}));await current;const latest=f.dialog();assert.ok(latest.querySelector('[name=clientId]').querySelector('[value=fresh-client]'));
 first.resolve(response({...baseOptions,clients:[{id:'old-client',name:'Cliente anterior'}]}));await old;assert.equal(f.dialog(),latest);assert.equal(latest.querySelector('[value=old-client]'),null);assert.deepEqual(f.messages,[]);assert.equal(f.calls.length,3);
});
test('fallo de opciones conserva un aviso concreto y Cancelar; sólo reabrir inicia otra consulta',async()=>{
 const f=await frontend();f.response(async()=>{throw Error('Red ficticia interrumpida');});await f.click('new');assert.match(f.dialog().querySelector('[data-px-options-status]').textContent,/No se pudieron cargar/);assert.equal(f.dialog().querySelector('.px-error').textContent,'Red ficticia interrumpida');assert.equal(f.dialog().querySelector('[type=submit]'),null);assert.deepEqual(f.messages,[]);assert.equal(f.calls.length,2);await turn();assert.equal(f.calls.length,2);f.cancel();f.response(async()=>response(baseOptions));await f.click('new');assert.ok(f.dialog().querySelector('[type=submit]'));assert.equal(f.calls.length,3);
});
for(const [name,change]of[
 ['Auth',f=>{f.c.fbAuth.currentUser={uid:'owner',getIdToken:async()=> 'another-fictitious-token'};}],['UID',f=>{f.c.currentUserUid='other';}],['rol',f=>{f.c.currentRole='admin';}],['revisión',f=>{f.c.PERMISOS_ROLES.vendedor.indiceRevision++;}],['módulo',f=>{f.deny();}],['Ver como',f=>{f.c._impersonacionOriginal={uid:'owner'};}],['ruta',f=>f.emit('sisventas:page-changed',{detail:{page:'dashboard'}})]
])test('cambiar '+name+' durante la lectura no muestra opciones del contexto anterior',async()=>{
 const f=await frontend(),pending=deferred();f.response(()=>pending.promise);const task=f.click('new');await turn();await change(f);pending.resolve(response(baseOptions));await task;assert.equal(f.dialog(),null);assert.deepEqual(f.messages,[]);assert.equal(f.body.style.overflow,'auto');assert.equal(f.calls.length,2);
});
test('revocar revisión después de abrir el formulario impide reutilizar el directorio para guardar',async()=>{
 const f=await frontend();await f.click('new');const d=f.dialog();f.c.PERMISOS_ROLES.vendedor.indiceRevision++;await d.querySelector('form').onsubmit({preventDefault(){}});assert.match(d.querySelector('.px-error').textContent,/sesión o el permiso cambió/);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,0);assert.equal(d.querySelector('[type=submit]').disabled,false);
});
test('perder el contexto durante getIdToken no envía la consulta de opciones',async()=>{
 const f=await frontend(),token=deferred();f.c.fbAuth.currentUser.getIdToken=()=>token.promise;const task=f.click('new');await turn();f.c.currentRole='admin';token.resolve('fictitious-token');await task;assert.equal(f.calls.length,1);assert.equal(f.dialog(),null);assert.deepEqual(f.messages,[]);
});
