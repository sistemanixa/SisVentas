const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {eligible,model,html}=require('../js/modules/employee-cash-receipt.js');
const gasto={empleadoId:'e1',empleadoNombre:'Empleado de prueba',descripcion:'Haberes septiembre',monto:100000,mes:'2026-09'};
const pago={medio:'Efectivo',monto:12500.40,fecha:'2026-10-01',usuario:'Administración'};
test('recibo identifica el pago parcial, fecha y DNI sin confundirlo con el total del haber',()=>{
  const m=model(gasto,'g1',pago,'p1',{nombre:'Empleado de prueba',dni:'12345678'},{nombre:'Empresa de prueba'});
  assert.equal(m.amount,12500.40);assert.equal(m.reference,'RE-g1-p1');
  const page=html(m);
  for(const text of ['12.500,40','01/10/2026','12345678','Haberes septiembre','2026-09','Firma de quien recibe','Aclaración','Fecha de recepción'])assert.ok(page.includes(text),text);
  assert.ok(!page.includes('100.000,00'));
});
test('sólo acepta efectivo real, vigente y asociado al empleado',()=>{
  assert.equal(eligible(gasto,pago),true);
  for(const change of [{medio:'Transferencia'},{anulado:true},{estado:'anulado'},{monto:0},{monto:NaN},{monto:-1},{origen:'alta_gasto'},{moneda:'USD'}])assert.equal(eligible(gasto,{...pago,...change}),false);
  assert.equal(eligible({descripcion:'Proveedor'},pago),false);
  assert.equal(eligible({...gasto,empleadoId:'',legacyKey:'ctaemp/e1/m1'},pago),true);
  assert.throws(()=>model(gasto,'g1',{...pago,anulado:true},'p1'),/vigente/);
});
test('DNI faltante queda para completar y todo contenido dinámico se escapa',()=>{
  const m=model({...gasto,descripcion:'<img src=x onerror=alert(1)>'},'g1',pago,'p1',{}, {nombre:'A&B'});
  const page=html(m);assert.ok(page.includes('____________________________'));
  assert.ok(page.includes('&lt;img'));assert.ok(page.includes('A&amp;B'));assert.ok(!page.includes('<img'));
});
function load(){
  let data={...gasto,pagos:{p1:pago}},printed=0,reads=0;
  const elements={};
  const document={getElementById:id=>elements[id]||null,addEventListener(){},body:{appendChild(el){elements[el.id]=el;}},createElement(tag){
    if(tag!=='dialog')throw Error('Unexpected element '+tag);
    const frame={contentWindow:{focus(){},print(){printed++;}},set srcdoc(value){this.page=value;queueMicrotask(()=>this.onload?.());}},buttons={'[data-print]':{},'[data-close]':{},'[data-status]':{},iframe:frame};
    return {style:{},querySelector:s=>buttons[s],addEventListener(){},showModal(){},remove(){delete elements[this.id];}};
  }};
  let permitted=true;
  const root={document,empData:{e1:{fbKey:'e1',nombre:'Empleado de prueba',dni:'12345678'}},puedeAdministrarGastos:()=>permitted,fbDB:{},fbRef:(_,p)=>p,fbGet:async()=>{reads++;return {val:()=>data};},notify:message=>root.message=message};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/modules/employee-cash-receipt.js'),'utf8'),{window:root,document,console,queueMicrotask});
  return {root,elements,setData:v=>data=v,deny:()=>permitted=false,counts:()=>({reads,printed})};
}
test('reimprimir consulta el pago vigente y bloquea si fue anulado después de abrir el recibo',async()=>{
  const c=load();await c.root.SVEmployeeCashReceipt.preview('g1','p1');
  const dialog=c.elements['employee-cash-receipt'];assert.ok(dialog);
  c.setData({...gasto,pagos:{p1:{...pago,anulado:true}}});
  const button=dialog.querySelector('[data-print]');await button.onclick({currentTarget:button});
  assert.equal(c.counts().printed,0);assert.match(dialog.querySelector('[data-status]').textContent,/vigente/);
  c.setData({...gasto,pagos:{p1:{...pago,monto:5000,editadoTs:1}}});
  await button.onclick({currentTarget:button});assert.equal(c.counts().printed,1);
  assert.match(dialog.querySelector('iframe').page,/5\.000,00/);assert.match(dialog.querySelector('iframe').page,/Pago corregido/);
});
test('historial antiguo en array conserva identidad al migrar y exige permisos al imprimir',async()=>{
  const c=load();c.setData({...gasto,pagos:[pago]});await c.root.SVEmployeeCashReceipt.preview('g1','legacy_0');
  assert.ok(c.elements['employee-cash-receipt']);c.deny();
  await c.root.SVEmployeeCashReceipt.preview('g1','legacy_0');assert.match(c.root.message,/permiso/);
  assert.equal(c.counts().printed,0);
});

test('el agregado conserva el resultado y los errores de la imputación, sin repetirla',async()=>{
  let calls=0,fail=false;
  const document={addEventListener(){},getElementById(){return null;}};
  const root={document,puedeAdministrarGastos:()=>false,_actualizarCtaEmpPorPagoGasto:async function(){calls++;if(fail)throw Error('Sin conexión');return 'imputado';}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/modules/employee-cash-receipt.js'),'utf8'),{window:root,document,console});
  assert.equal(await root._actualizarCtaEmpPorPagoGasto(gasto,'g1',100000,12500,'parcial','Efectivo','p1',pago),'imputado');
  assert.equal(calls,1);fail=true;
  await assert.rejects(root._actualizarCtaEmpPorPagoGasto(gasto,'g1',100000,12500,'parcial','Efectivo','p1',pago),/Sin conexión/);
  assert.equal(calls,2);
});
