'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readActiveApp}=require('./helpers/active-app');
const {load}=require('./helpers/app-functions.cjs');
const source=readActiveApp().source;
const printFunction=source.slice(source.indexOf('function imprimirInforme() {'),source.indexOf('// MÓDULO GASTOS',source.indexOf('function imprimirInforme() {')));
const escapeFunction=source.slice(source.indexOf('function escapeHTML(value) {'),source.indexOf('\n}',source.indexOf('function escapeHTML(value) {'))+2);
function print(address){
  let html='',printed=false;
  const values={'cfg-empresa-dir':address,'inf-dir':'Domicilio del servicio ficticio','inf-numero':'DEMO','inf-fecha':'2026-10-16'};
  const context={URL,currentUserUid:'uid-ficticio',currentRole:'admin',fbAuth:{currentUser:{uid:'uid-ficticio'}},svTextoLegible:value=>String(value??''),document:{getElementById:id=>values[id]!==undefined?{value:values[id]}:null},open:()=>({document:{write:value=>html=value,close(){}},print(){printed=true;}}),logoImpresionActualUrl:()=>'',setTimeout:fn=>fn()};
  context.window=context;
  load(context,['svCapturarContextoOperacion','svPostventaFormulario']);
  vm.runInContext(escapeFunction+'\n'+printFunction+'\nimprimirInforme();',context);
  assert.equal(printed,true);
  return html;
}
test('informe imprime dirección configurada y domicilio del servicio por separado',()=>{
  const html=print('Dirección empresarial de prueba 123');
  assert.ok(html.includes('Dirección empresarial de prueba 123'));
  assert.ok(html.includes('Domicilio del servicio ficticio'));
  assert.ok(!html.includes('Patagones 390'));
});
test('informe con dirección vacía o ausente no agrega un domicilio fijo',()=>{
  for(const address of ['', '   ', undefined]){
    const html=print(address);
    assert.ok(!html.includes('Patagones 390'));
    assert.ok(html.includes('Informe Técnico'));
  }
});
test('dirección configurada se imprime como texto y no como HTML',()=>{
  const html=print('Oficina <central> & sucursal');
  assert.ok(html.includes('Oficina &lt;central&gt; &amp; sucursal'));
  assert.ok(!html.includes('Oficina <central>'));
});
