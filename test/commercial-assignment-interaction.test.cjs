const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {load}=require('./helpers/app-functions.cjs');
function badge(role='admin') {return load({window:{SVCommercialOwnership:{author:v=>v.creadorOriginalNombre},usuariosData:[]},currentRole:role,currentUser:'Admin',escapeHTML:s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),jsStringAttr:s=>String(s)},['ventaCreadorBadge']);}
test('toda la etiqueta es un único botón que detiene la fila, sin botón anidado',()=>{
 const html=badge().ventaCreadorBadge({fbKey:'demo',creadorOriginalNombre:'Autora',responsableNombre:'Otra persona'});
 assert.match(html,/^<button\b/);assert.match(html,/event.stopPropagation\(\);abrirReasignacionComercial/);assert.equal((html.match(/<button\b/g)||[]).length,1);assert.match(html,/<small>Asignado a Otra persona<\/small><\/button>$/);
});
test('evita repetir autora y responsable iguales sin modificar identidades ni habilitar a otros roles',()=>{
 const record={fbKey:'demo',creadorOriginalNombre:'Autora',responsableNombre:'Autora',responsableUid:'one'};
 const original=JSON.stringify(record),html=badge().ventaCreadorBadge(record);assert.doesNotMatch(html,/<small>/);assert.match(html,/>Autora<\/button>$/);assert.equal(JSON.stringify(record),original);
 assert.match(badge('vendedor').ventaCreadorBadge(record),/^<span\b/);assert.doesNotMatch(badge('vendedor').ventaCreadorBadge(record),/onclick=/);
});
function assignment(type='venta'){
 const nodes=[],body={style:{overflow:'auto'},append(){}},record={fbKey:'demo',responsableUid:'one',responsableNombre:'Autora',creadorOriginalNombre:'Autora'};let writes=0;
 const c={window:null,currentRole:'admin',ventasList:[record],pptoData:[record],notify(){},Option:function(text,value){return {text,value};},document:{body,createElement:tag=>{const node={tag,style:{},value:'',isConnected:true,append(){},setAttribute(){},addEventListener(){},showModal(){},close(){},focus(){},remove(){this.isConnected=false;}};nodes.push(node);return node;}},SVCommercialOwnership:{author:r=>r.creadorOriginalNombre,options:async()=>[{uid:'one',nombre:'Autora',rol:'vendedor'},{uid:'two',nombre:'Otra persona',rol:'vendedor'}],assign:async(domain,r,uid)=>{writes++;assert.equal(domain,type==='venta'?'ventas':'presupuestos');return {responsableUid:uid,responsableNombre:'Otra persona'};}}};c.window=c;vm.runInNewContext(fs.readFileSync('js/modules/commercial-document-controls.js','utf8'),c);return {c,nodes,record,writes:()=>writes};
}
for(const type of ['venta','presupuesto'])test(type+': explica selección actual y no escribe; otra selección conserva creador',async()=>{
 const f=assignment(type);await f.c.SVCommercialDocument.assignDialog(type,'demo');const select=f.nodes.find(n=>n.tag==='select'),save=f.nodes.find(n=>n.textContent==='Asignar'),status=f.nodes.find(n=>/ya es responsable/.test(n.textContent||''));
 assert.ok(status);assert.equal(save.disabled,true);await save.onclick();assert.equal(f.writes(),0);
 select.value='two';select.onchange();assert.equal(save.disabled,false);assert.match(status.textContent,/Se asignará a Otra persona/);
 select.value='one';select.onchange();assert.equal(save.disabled,true);assert.match(status.textContent,/ya es responsable/);
 select.value='two';select.onchange();await save.onclick();assert.equal(f.writes(),1);assert.equal(f.record.creadorOriginalNombre,'Autora');
});
