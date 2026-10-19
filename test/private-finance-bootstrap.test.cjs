'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../js/core/private-finance-model'),source=fs.readFileSync('js/modules/private-finance-ui.js','utf8');
function fixture(hasBridge=true){
 const nodes={},calls=[];let resolve,reject;
 const pending=new Promise((done,fail)=>{resolve=done;reject=fail;});
 const node=()=>({innerHTML:'',textContent:'',open:false,addEventListener(){},replaceChildren(){this.innerHTML='';}});
 for(const id of ['app','nav','dialog','pdfInput','personalUserName','personalUserInitials'])nodes[id]=node();
 const bridge={request:(...args)=>{calls.push(args);return pending;},identity:()=>({name:'Titular ficticio'})};
 const context={SVPrivateFinanceModel:M,SVPrivateFinanceImportQueue:{create:()=>({destroy(){}})},
  document:{body:{style:{overflow:'auto'}},getElementById:id=>nodes[id],addEventListener(){}},
  parent:{location:{origin:'https://fixture.invalid'},SVPrivateFinancePortal:hasBridge?bridge:null},location:{origin:'https://fixture.invalid'},
  addEventListener(){},setTimeout,clearTimeout,URL,AbortController,console};
 context.window=context;vm.runInNewContext(source,context);return {context,nodes,calls,resolve,reject};
}
const settle=()=>new Promise(setImmediate);

test('el arranque privado mantiene una tarjeta accesible hasta recibir la base y luego la reemplaza por los datos',async()=>{
 const f=fixture(),app=f.nodes.app;
 assert.match(app.innerHTML,/class="private-bootstrap-layer"/);assert.match(app.innerHTML,/panel panelbody private-bootstrap-status/);
 assert.match(app.innerHTML,/Cargando el espacio privado/);assert.equal([...app.innerHTML.matchAll(/role="status"/g)].length,1);
 assert.match(app.innerHTML,/pdf-queue-spinner" aria-hidden="true"/);assert.equal(f.context.document.body.style.overflow,'auto');assert.deepEqual(f.calls,[[]]);
 await settle();assert.match(app.innerHTML,/private-bootstrap-layer/);
 f.resolve({state:M.empty('owner-fixture')});await settle();
 assert.doesNotMatch(app.innerHTML,/private-bootstrap/);assert.match(app.innerHTML,/class="pagehead"/);assert.match(f.nodes.nav.innerHTML,/Importar resúmenes/);
 assert.equal(f.nodes.personalUserName.textContent,'Titular ficticio');assert.deepEqual(f.calls,[[]]);
});

test('un fallo inicial reemplaza la tarjeta por el error y el retorno existente, sin nueva petición',async()=>{
 const f=fixture();f.reject(Error('Error ficticio <conexión>'));await settle();
 assert.doesNotMatch(f.nodes.app.innerHTML,/private-bootstrap/);assert.match(f.nodes.app.innerHTML,/No se pudo abrir el espacio privado/);
 assert.match(f.nodes.app.innerHTML,/Error ficticio &lt;conexión&gt;/);assert.match(f.nodes.app.innerHTML,/data-action="return"/);assert.deepEqual(f.calls,[[]]);
});

test('abrir el documento sin el espacio autorizado conserva el aviso de acceso y no muestra carga',()=>{
 const f=fixture(false);assert.match(f.nodes.app.innerHTML,/Acceso privado/);assert.doesNotMatch(f.nodes.app.innerHTML,/private-bootstrap/);assert.deepEqual(f.calls,[]);
});

test('cerrar la vista retira la carga y ni los datos ni un error inicial tardíos vuelven a pintar',async()=>{
 for(const outcome of ['datos','error']){
  const f=fixture();f.context.SVPrivateFinanceUI.destroy();assert.equal(f.nodes.app.innerHTML,'');
  if(outcome==='datos')f.resolve({state:M.empty('owner-fixture')});else f.reject(Error('Error después de cerrar'));
  await settle();assert.equal(f.nodes.app.innerHTML,'');assert.deepEqual(f.calls,[[]]);
 }
});
