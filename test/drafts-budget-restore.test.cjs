'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/commercial-drafts.js','utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const settle=()=>new Promise(setImmediate);
function node(tag){return {tagName:tag.toUpperCase(),dataset:{},children:[],appendChild(child){this.children.push(child);return child;},replaceChildren(){this.children=[];},querySelector(){return null;},setAttribute(){},get rows(){return this.children;}};}
function fixture({changed=false,newBudget=false,deferNavigation=false,writer=()=>Promise.resolve()}={}){
 const original={fbKey:'budget-ficticio',id:'PP-FICTICIO',estado:'aprobado_int',fecha:'2026-10-20',descuentoGeneral:10,items:[]};
 const current=clone(original);if(changed)current.descuentoGeneral=12;
 const d={schema:1,id:'draft-ficticio',kind:'presupuesto',updated:Date.now(),original:newBudget?null:clone(original),data:{edit:newBudget?'':'budget-ficticio',editId:newBudget?'':'PP-FICTICIO',fields:[{id:'pp-cli',value:'Cliente ficticio',data:{}}],rows:[],currency:'ARS',iva:true,detail:true}};
 const storage={['sv:commercial-draft:v1:demo:'+d.id]:JSON.stringify(d)},events={},timers=new Map(),writes=[],subscriptions=[],messages=[],navigation=[];let timer=0,visible=false,opened=0;
 Object.defineProperties(storage,{getItem:{value:k=>storage[k]||null},setItem:{value:(k,v)=>storage[k]=v},removeItem:{value:k=>delete storage[k]}});
 const fields=[{id:'pp-cli',value:'',type:'text',dataset:{},closest:()=>null}],body=node('tbody'),rows=node('tbody');
 const form={querySelectorAll:()=>fields,contains:element=>fields.includes(element),closest:()=>({classList:{contains:()=>true}}),getClientRects:()=>visible?[1]:[]};
 const on=(name,fn)=>{(events[name]||=[]).push(fn);};
 const c={currentUserUid:'demo',currentRole:'admin',navigator:{onLine:true},localStorage:storage,_pptoEditorBase:{unrelated:true},
  _pptoConIva:true,_pptoConDetalle:false,_pptoMonedaActual:'ARS',
  document:{hidden:false,getElementById:id=>({'ppto-form-view':form,'ppto-tbody-main':body,'pp-body':rows,'pp-cli':fields[0]})[id]||null,querySelectorAll:()=>[],createElement:node,addEventListener:on},
  addEventListener:on,setInterval:fn=>{c.tick=fn;},setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),
  permisoModulo:()=>true,puedeEditarPresupuestoPermiso:()=>true,buscarPptoPorRef:()=>current,
  svNavegarDirecto:(_,callback)=>deferNavigation?navigation.push(callback):callback(),abrirNuevoPresupuesto(){opened++;visible=true;c._pptoEditorBase=null;c._pptoEditandoFbKey=null;c._pptoEditandoId=null;},
  calcPpTotales(){},notify:text=>messages.push(text),svConfirm:async()=>true,
  fbDB:{},fbRef:(_,path)=>path,fbOnValue:(path,next,error)=>{subscriptions.push({path,next,error});next({val:()=>({})});return()=>{};},
  fbUpdate:(path,batch)=>{writes.push({path,batch:clone(batch)});return writer(path,batch);},
  fetch(){throw Error('Sin red en pruebas ficticias');},fbGet(){throw Error('Recuperar borrador no consulta registros');}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);
 return {c,current,original,d,storage,body,fields,writes,messages,subscriptions,get opened(){return opened;},
  restore(){c.svDrafts.renderGrid();body.children[0].children.at(-1).children[0].onclick();},
  continueNavigation(){navigation.shift()();},
  edit(value){fields[0].value=value;c.svDrafts.flush();},
  runTimers(){for(const [id,callback]of [...timers])if(timers.delete(id))callback();},
  state(){let snapshot;const stop=c.svDrafts.subscribe(value=>snapshot=clone(value));stop();return snapshot;},hide(){visible=false;}};
}
test('continuar una edición recupera una base independiente para el guardado con concurrencia',()=>{
 const f=fixture();f.restore();
 assert.equal(f.c._pptoEditandoFbKey,f.current.fbKey);assert.equal(f.c._pptoEditandoId,f.current.id);
 assert.deepEqual(clone(f.c._pptoEditorBase),f.current);assert.notEqual(f.c._pptoEditorBase,f.current);
 f.current.descuentoGeneral=20;assert.equal(f.c._pptoEditorBase.descuentoGeneral,10);
 assert.equal(f.c._pptoEditorBase.estado,'aprobado_int');assert.equal(f.writes.length,0);
});
test('un original cambiado bloquea recuperar su borrador sin reemplazar la base ni los datos actuales',()=>{
 const f=fixture({changed:true});f.restore();
 assert.equal(f.opened,0);assert.deepEqual(clone(f.c._pptoEditorBase),{unrelated:true});assert.equal(f.current.descuentoGeneral,12);
 assert.match(f.messages[0],/original cambió/);assert.equal(f.state().records.length,1);assert.equal(f.writes.length,0);
});
test('una actualización durante la navegación conserva la base validada y el guardado rechaza sobrescribirla',async()=>{
 const f=fixture({deferNavigation:true});f.restore();assert.equal(f.opened,0);
 f.current.descuentoGeneral=20;f.continueNavigation();assert.equal(f.c._pptoEditorBase.descuentoGeneral,10);
 f.edit('Edición conservada');assert.equal(f.state().records[0].original.descuentoGeneral,10);
 let financialWrites=0,reads=0;
 Object.assign(f.c,{URL,AbortSignal,TextEncoder,fbAuth:{currentUser:{uid:'demo',getIdToken:async()=>'fake-token'}},
  fbRef:(_,path)=>({toString:()=>'https://fixture.invalid/'+path}),fbGet:async()=>({}),
  fbRunTransaction:async(_,transform)=>{const next=transform(clone(f.current));if(next===undefined)return {committed:false};financialWrites++;return {committed:true,snapshot:{val:()=>next}};},
  fetch:async(_,options)=>{reads++;assert.equal(options.method,undefined,'el conflicto no debe efectuar PUT');return {ok:true,headers:{get:()=> 'version-ficticia'},json:async()=>clone(f.current)};}});
 vm.runInContext(fs.readFileSync('js/core/guarded-writes.js','utf8'),f.c);
 await assert.rejects(f.c.SVGuardedWrites.save('presupuestos/budget-ficticio',f.c._pptoEditorBase,{...f.c._pptoEditorBase,descuentoGeneral:15},true),{code:'SV_CONFLICT'});
 assert.equal(financialWrites,0);assert.equal(reads,1);assert.equal(f.current.descuentoGeneral,20);
});
test('un borrador nuevo conserva identidad y base de alta nuevas al recuperarlo',()=>{
 const f=fixture({newBudget:true});f.restore();
 assert.equal(f.c._pptoEditandoFbKey,null);assert.equal(f.c._pptoEditandoId,null);assert.equal(f.c._pptoEditorBase,null);
 assert.equal(f.state().records[0].data.edit,'');assert.equal(f.writes.length,0);
});
test('completar sólo elimina el borrador recuperado y flush previo a ocultar no lo resucita',()=>{
 const f=fixture();const other=clone(f.d);other.id='otra-edicion';f.storage['sv:commercial-draft:v1:demo:'+other.id]=JSON.stringify(other);
 f.restore();f.edit('Edición ficticia aprobada');f.c.svDrafts.complete('presupuesto');f.c._pptoEditandoFbKey=null;f.c._pptoEditandoId=null;
 f.c.svDrafts.flush();f.hide();f.c.tick();
 const state=f.state();assert.equal(state.records.length,1);assert.equal(state.records[0].id,other.id);assert.deepEqual(state.deletedIds,[f.d.id]);
 assert.equal(f.current.estado,'aprobado_int');
});
test('completar mientras se sincroniza una edición mantiene el tombstone después del envío pendiente',async()=>{
 const pending=[],f=fixture({writer:()=>new Promise(resolve=>pending.push(resolve))});f.restore();f.edit('Cambio ficticio');f.runTimers();
 assert.equal(f.writes.length,1);assert.equal(Object.values(f.writes[0].batch)[0].deleted,undefined);
 f.c.svDrafts.complete('presupuesto');f.c.svDrafts.flush();f.hide();f.runTimers();assert.equal(f.writes.length,1);
 pending.shift()();await settle();f.runTimers();assert.equal(f.writes.length,2);assert.equal(Object.values(f.writes[1].batch)[0].deleted,true);
 pending.shift()();await settle();f.c.tick();f.runTimers();assert.equal(f.writes.length,2);assert.equal(f.state().records.length,0);
});
