const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {load}=require('./helpers/app-functions.cjs');
const {source}=require('./helpers/active-app').readActiveApp();
test('mayúsculas conservan inserción y selección en medio del texto',()=>{
  const c=load({},['svMayusculasInput']);
  for(const [value,start,end,expectedStart,expectedEnd] of [['CAMaRA',4,4,4,4],['niño blanco',2,6,2,6],['aßz',2,3,3,4]]){
    const input={value,selectionStart:start,selectionEnd:end,selectionDirection:'backward',setSelectionRange(a,b,d){this.selectionStart=a;this.selectionEnd=b;this.selectionDirection=d;}};
    c.svMayusculasInput(input,{});
    assert.equal(input.value,value.toLocaleUpperCase('es-AR'));
    assert.equal(input.selectionStart,expectedStart);assert.equal(input.selectionEnd,expectedEnd);assert.equal(input.selectionDirection,'backward');
  }
});
test('no interrumpe composición ni reescribe texto ya normalizado',()=>{
  const c=load({},['svMayusculasInput']);
  const composing={value:'niñ'};c.svMayusculasInput(composing,{isComposing:true});assert.equal(composing.value,'niñ');
  const stable={get value(){return 'ABC';},set value(v){throw Error('reescritura innecesaria');}};c.svMayusculasInput(stable,{});
});
test('importe conserva el texto y cursor durante edición y calcula su valor crudo',()=>{
  const listeners={},input={value:'1234.56',type:'number',dataset:{},getAttribute:()=>null,addEventListener:(n,f)=>listeners[n]=f};
  const c=load({},['_formatMontoVisual','_refrescarMoneyVisual','initMoneyInput','getMontoRaw']);c.initMoneyInput(input);
  input.value='12.934,5';input.selectionStart=4;listeners.input();
  assert.equal(input.value,'12.934,5');assert.equal(input.selectionStart,4);assert.equal(c.getMontoRaw(input),12934.5);
});
test('revisión usa recargo entero y recalcula la venta',()=>{
  const start=source.indexOf('    function actualizar(origen){');
  const fn=source.slice(start,source.indexOf('    costoInput.oninput=',start));
  const margin={value:'12.345'},price={value:'112.35'},total={};
  const c={input:price,margenInput:margin,costoInput:{value:'100'},sinCosto:{},iva:21,ventaOriginal:100,money:v=>'ARS '+v,d:{querySelector:()=>total}};vm.createContext(c);vm.runInContext(fn+';actualizar("recargo");',c);
  assert.equal(margin.value,'12');assert.equal(price.value,'112.00');
  price.value='134.56';vm.runInContext('actualizar("venta")',c);assert.equal(margin.value,'35');
});
test('punto de equilibrio conserva campos manuales vacíos y decimales parciales',()=>{
  const code=fs.readFileSync('js/modules/business-break-even.js','utf8');
  const fragment=code.slice(code.indexOf('    if (fixedInput)'),code.indexOf("    setText('be-kpi-fixed'"));
  const fixedInput={value:''},marginInput={value:'12.345'};
  const c={fixedInput,marginInput,cfg:{fixedMode:'manual',marginMode:'manual'},form:{autoFixed:1234.5,autoMargin:23.45}};vm.createContext(c);vm.runInContext(fragment,c);
  assert.equal(fixedInput.value,'');assert.equal(marginInput.value,'12.345');
  c.cfg={fixedMode:'auto',marginMode:'auto'};vm.runInContext(fragment,c);assert.equal(fixedInput.value,1235);assert.equal(marginInput.value,'23.4');
});
