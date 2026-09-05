const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function escenario(buttons, modal) {
  let handler, saves=0, renders=0;
  const btns=buttons.map(text=>({textContent:text,disabled:false,getClientRects:()=>[1],click(){saves++;}}));
  const root={id:'page-dashboard',querySelectorAll:()=>btns};
  const ctx={document:{querySelectorAll:()=>modal?[{...root,id:'modal-prueba',getClientRects:()=>[1],querySelectorAll:()=>[]}]:[],querySelector:()=>root,getElementById:()=>null,addEventListener:(k,h)=>{handler=h;}},getComputedStyle:()=>({visibility:'visible',zIndex:'10'}),notify(){},Event:function(){},dispatchEvent(){},solicitarRenderDashboard(){renders++;}};
  ctx.window=ctx;vm.runInNewContext(fs.readFileSync('js/modules/keyboard-actions.js','utf8'),ctx);
  return {btns,get saves(){return saves;},get renders(){return renders;},key(key,repeat=false){let prevented=false;handler({key,repeat,preventDefault(){prevented=true;},stopImmediatePropagation(){}});return prevented;}};
}
test('F5 usa Guardar visible y evita recargar o repetir el guardado',()=>{const s=escenario(['Guardar producto']);assert.equal(s.key('F5'),true);assert.equal(s.saves,1);s.key('F5',true);assert.equal(s.saves,1);});
test('F5 respeta el modal y no guarda la página que está detrás',()=>{const s=escenario(['Guardar producto'],true);s.key('F5');assert.equal(s.saves,0);});
test('F8 actualiza dashboard y preserva formularios',()=>{const s=escenario([]);s.key('F8');assert.equal(s.renders,1);const form=escenario(['Guardar']);form.key('F8');assert.equal(form.renders,0);assert.equal(form.saves,0);});
test('Escape resuelve Volver de la vista antes del historial de módulos',()=>{const src=fs.readFileSync('js/app.v3.3.15.js','utf8');const inicio=src.indexOf('function volverAtrasSisVentas()');const fin=src.indexOf("document.addEventListener('keydown'",inicio);let clicks=0;const boton={textContent:'\ueb19 Volver',disabled:false,click(){clicks++;}};const ctx={document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>({querySelectorAll:()=>[boton]})},_svElementoVisible:n=>!!n,_svHistorialPaginas:[]};vm.runInNewContext(src.slice(inicio,fin),ctx);assert.equal(ctx.volverAtrasSisVentas(),true);assert.equal(clicks,1);});
