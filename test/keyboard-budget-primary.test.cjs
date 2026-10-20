'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/keyboard-actions.js','utf8');
function button(id,textContent,action,{hidden=false,disabled=false,busy=false}={}){
 return {id,textContent,disabled,getClientRects:()=>hidden?[]:[{}],getAttribute:name=>name==='aria-busy'&&busy?'true':null,click:action};
}
function scope(id,buttons,{native=false,modal=false,zIndex='0',hidden=false}={}){
 return {id,tagName:native?'DIALOG':'DIV',open:native,style:{zIndex},getClientRects:()=>hidden?[]:[{}],
  matches:selector=>selector===':modal'&&modal,
  querySelector:selector=>selector==='#btn-guardar-principal-ppto'?buttons.find(b=>b.id==='btn-guardar-principal-ppto')||null:null,
  querySelectorAll:()=>buttons};
}
function fixture({mainLabel,mainMode,mainOptions,modals=[],buttons}={}){
 const clicks=[],notices=[];let handler,prevented=0,stopped=0;
 const draft=button('guardar-borrador','Guardar borrador',()=>clicks.push('borrador'));
 const main=button('btn-guardar-principal-ppto',mainLabel,()=>clicks.push(mainMode),mainOptions);
 const page=scope('page-presupuesto',buttons||[draft,main]);
 const c={document:{querySelectorAll:selector=>{assert.match(selector,/dialog\[open\]/);return modals;},querySelector:()=>page,
  addEventListener:(name,fn)=>{assert.equal(name,'keydown');handler=fn;}},
  getComputedStyle:node=>({visibility:'visible',zIndex:node.style?.zIndex||'0'}),notify:message=>notices.push(message)};
 c.window=c;vm.runInNewContext(source,c);
 return {clicks,notices,main,key(extra={}){handler({key:'F5',repeat:false,preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;},...extra});},
  get prevented(){return prevented;},get stopped(){return stopped;}};
}
for(const [role,mainLabel,mainMode]of [
 ['admin','Aprobar y guardar','aprobado_int'],['administrativo','Guardar presupuesto','aprobado_int'],['vendedor','Enviar a revisión','revision']
])test('F5 usa el botón principal configurado para '+role+' y nunca Guardar borrador',()=>{
 const f=fixture({mainLabel,mainMode});f.key();assert.deepEqual(f.clicks,[mainMode]);assert.deepEqual(f.notices,[]);
 assert.equal(f.prevented,1);assert.equal(f.stopped,1);
});
for(const mainOptions of [{disabled:true},{busy:true},{disabled:true,busy:true}])test('F5 no recurre al borrador con acción principal ocupada '+JSON.stringify(mainOptions),()=>{
 const f=fixture({mainLabel:'Aprobar y guardar',mainMode:'aprobado_int',mainOptions});f.key();assert.deepEqual(f.clicks,[]);assert.deepEqual(f.notices,[]);
});
test('F5 respeta el ámbito modal y no busca el botón principal del fondo',()=>{
 const modal=scope('modal-aviso',[]),f=fixture({mainLabel:'Aprobar y guardar',mainMode:'aprobado_int',modals:[modal]});
 f.key();assert.deepEqual(f.clicks,[]);assert.match(f.notices[0],/no tiene un botón Guardar/);
});
test('F5 prioriza el último diálogo nativo modal sobre un overlay de z-index mayor',()=>{
 const clicks=[],overlay=scope('modal-fondo',[button('','Guardar fondo',()=>clicks.push('fondo'))],{zIndex:'999999'});
 const first=scope('',[button('','Guardar anterior',()=>clicks.push('anterior'))],{native:true,modal:true});
 const last=scope('',[button('','Guardar visible',()=>clicks.push('visible'))],{native:true,modal:true});
 const f=fixture({mainLabel:'Aprobar y guardar',mainMode:'aprobado_int',modals:[overlay,first,last]});
 f.key();assert.deepEqual(clicks,['visible']);assert.deepEqual(f.clicks,[]);
});
test('un diálogo nativo sin botón Guardar impide guardar el presupuesto de atrás',()=>{
 const f=fixture({mainLabel:'Aprobar y guardar',mainMode:'aprobado_int',modals:[scope('',[],{native:true,modal:true})]});
 f.key();assert.deepEqual(f.clicks,[]);assert.match(f.notices[0],/no tiene un botón Guardar/);
});
test('otros formularios conservan su Guardar único y la advertencia ante ambigüedad',()=>{
 const clicks=[],one=fixture({buttons:[button('','Guardar producto',()=>clicks.push('producto'))]});one.key();assert.deepEqual(clicks,['producto']);
 const many=fixture({buttons:[button('','Guardar una sección',()=>clicks.push('una')),button('','Guardar otra sección',()=>clicks.push('otra'))]});
 many.key();assert.deepEqual(clicks,['producto']);assert.match(many.notices[0],/Seleccioná el botón Guardar/);
});
test('F5 repetido o con modificadores no duplica la acción principal',()=>{
 const f=fixture({mainLabel:'Aprobar y guardar',mainMode:'aprobado_int'});f.key({repeat:true});f.key({ctrlKey:true});
 assert.deepEqual(f.clicks,[]);assert.equal(f.prevented,1);
});
