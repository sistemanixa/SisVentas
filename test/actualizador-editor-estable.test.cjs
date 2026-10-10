const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function scenario({active=true,exists=true,display='flex',input=true}={}) {
 const field={value:'https://nueva.test/sin-guardar',selectionStart:8,selectionEnd:12,focus(){this.focused=true;},setSelectionRange(a,b){this.range=[a,b];}};
 const editor={id:'actualizador-url-editor-producto-2',style:{display},querySelector:()=>input?field:null,contains:x=>x===field};
 let retained=null;
 const replacement={replaceWith(node){retained=node;}};
 const parent={scrollTop:280,scrollLeft:0,parentElement:null};
 const container={scrollTop:12,scrollLeft:4,parentElement:parent,querySelectorAll:()=>[editor],contains:x=>x===replacement || retained===editor&&x===field,set innerHTML(value){this.html=value;this.scrollTop=0;parent.scrollTop=0;}};
 const c=load({document:{activeElement:active?field:{},getElementById:()=>exists?replacement:null}},['actualizadorActualizarHTMLConEdicion']);
 c.actualizadorActualizarHTMLConEdicion(container,'nuevo resultado');
 return {field,editor,retained,container,parent};
}
test('avance de producto conserva nodo, borrador, selección y scroll del editor abierto',()=>{const r=scenario();assert.equal(r.retained,r.editor);assert.equal(r.field.value,'https://nueva.test/sin-guardar');assert.deepEqual(r.field.range,[8,12]);assert.equal(r.parent.scrollTop,280);assert.equal(r.container.scrollTop,12);});
test('conserva borrador al abrir proveedor en otra pestaña sin robar foco',()=>{const r=scenario({active:false});assert.equal(r.retained,r.editor);assert.equal(r.field.focused,undefined);});
test('no restaura editor cerrado, guardado en curso ni producto ya resuelto',()=>{for(const args of [{display:'none'},{exists:false},{input:false}]){const r=scenario(args);assert.equal(r.retained,null);assert.equal(r.field.focused,undefined);}});
