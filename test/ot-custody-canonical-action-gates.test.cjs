'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/modules/ot-material-custody.js'),'utf8'),money=require('../js/core/commercial-money.v1');
function fixture(patch={}){
 const nodes={},notices=[];let confirms=0,saves=0;
 function node(){return {style:{},innerHTML:'',textContent:'',remove(){delete nodes[this.id];},querySelectorAll(){return [];}};}
 for(const id of ['ot-materiales','ot-custodia-estado','ot-btn-todo-instalado','ot-btn-excepciones'])nodes[id]=node();
 nodes['ot-custodia-estado'].parentNode={insertBefore(n){nodes[n.id]=n;}};
 const ot={fbKey:'fiction',estado:'completada',materiales:[{cod:'FIC',desc:'Equipo ficticio',vendida:2,entregada:2,instalada:2,custodiaActiva:true,stockRegistro:'a'.repeat(64),stockRevision:1}],...patch};
 const root={otData:[ot],otActualId:'fiction',currentRole:'admin',currentUserUid:'u',fbAuth:{currentUser:{uid:'u'}},tienePermiso:()=>true,svConfirm:async()=>{confirms++;return confirms===1;},notify:t=>notices.push(t),SVCommercialMoney:money,SVOTLifecycle:{save:async()=>{saves++;throw Error('No writing permitted');}}};
 const document={getElementById:id=>nodes[id]||null,createElement:()=>node(),body:{appendChild(n){nodes[n.id]=n;}}};
 const context={window:root,document};vm.createContext(context);vm.runInContext(source,context);
 return {root,nodes,notices,ot,async correct(){root.otCustodiaRenderMateriales(ot);await nodes['ot-corregir-materiales'].onclick();},get confirms(){return confirms;},get saves(){return saves;}};
}
test('corrección de filas verificadas sin bandera global permite ambas acciones visibles con el mismo criterio canónico',async()=>{
 const f=fixture();await f.correct();assert.equal(f.nodes['ot-btn-todo-instalado'].style.display,'');assert.equal(f.nodes['ot-btn-excepciones'].style.display,'');
 await f.root.otCustodiaTodoInstalado();assert.equal(f.confirms,2);assert.equal(f.saves,0);
 f.root.otCustodiaAbrirExcepciones();assert.ok(f.nodes['ot-custodia-modal']);assert.equal(f.saves,0);assert.equal(Object.hasOwn(f.ot,'custodiaIniciada'),false);
});
for(const key of ['custodiaIniciada','custodiaRendida'])test('false explícito en '+key+' no permite inferir entrega ni guardar',async()=>{
 const f=fixture({[key]:false});await f.correct();assert.equal(f.nodes['ot-btn-todo-instalado'].style.display,'none');assert.equal(f.nodes['ot-btn-excepciones'].style.display,'none');
 await f.root.otCustodiaTodoInstalado();f.root.otCustodiaAbrirExcepciones();assert.equal(f.confirms,1);assert.equal(f.saves,0);assert.equal(f.nodes['ot-custodia-modal'],undefined);assert.equal(f.notices.length,2);assert.equal(f.ot[key],false);
});
test('sin evidencia de entrega las acciones directas avisan y no escriben',async()=>{
 const f=fixture({estado:'en_progreso',materiales:[{cod:'FIC',desc:'Equipo ficticio',vendida:2,entregada:0,instalada:0}]});
 await f.root.otCustodiaTodoInstalado();f.root.otCustodiaAbrirExcepciones();assert.equal(f.confirms,0);assert.equal(f.saves,0);assert.equal(f.notices.length,2);assert.match(f.notices[0],/primero la entrega/);
});
