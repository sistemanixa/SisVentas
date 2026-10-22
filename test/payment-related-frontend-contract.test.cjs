'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');

function frontend(){
  const c={console,Map,Set,Array,Object,String,Number,Math,JSON,parseFloat,_svResumenVentaCanonico:()=>null,_svTotalVentaCanonico:venta=>Number(venta.total)||0};
  c.window=c;c._historialPagosCompleto=[];
  load(c,['_svTxtClave','_svVentaClaves','_svRegistroPerteneceVenta','_svPagoValido','_svPagosGlobalesRelacionadosVenta','_svAgregarPagoIndice','_svCrearIndicePagosVentas','_svPagosIndiceVenta','_svPagosGlobalesVenta','_svPagosEmbebidosVenta','_svResumenPagoLegacyVenta','_svResumenPagoVentaDesdeLista','_svMontoPagadoVenta']);
  return c;
}
const keys=rows=>Array.from(rows,p=>p.fbKey).sort();
const technical=['ventaFbKey','ventaKey','ventaGeneradaFbKey','ventaOrigenFbKey'];
const business=['venta','ventaId','idVenta','nroVenta','numeroVenta','ventaNumero'];

for(const field of technical)test('membresía frontend conserva la referencia técnica '+field,()=>{
  const c=frontend(),venta={fbKey:'clave física Ω',id:'#V-00123',idOriginal:'#V-00045'};
  const pago={fbKey:'pago-demo',[field]:'  clave física Ω\u00a0',venta:'#V-999'};
  assert.equal(c._svRegistroPerteneceVenta(pago,venta),true);
  assert.deepEqual(keys(c._svPagosIndiceVenta(c._svCrearIndicePagosVentas([pago]),venta)),['pago-demo']);
  assert.equal(c._svRegistroPerteneceVenta(pago,{fbKey:'otra',id:'#V-999'}),false,'una referencia comercial no supera una técnica distinta');
});

for(const field of business)test('membresía frontend conserva aliases exactos y numéricos de '+field,()=>{
  const c=frontend(),venta={fbKey:'actual',id:'V-123',idOriginal:'#V-00045',numeroOriginal:'ORIG-89'};
  const pagos=[
    {fbKey:'actual',[field]:'V-123'},
    {fbKey:'original',[field]:'#V-00045'},
    {fbKey:'numero',[field]:'OTRO-00045'},
    {fbKey:'numero-original',[field]:'REM-89'},
    {fbKey:'ceros-diferentes',[field]:'V-45'},
    {fbKey:'ajeno',[field]:'V-999'}
  ];
  const scan=pagos.filter(p=>c._svRegistroPerteneceVenta(p,venta));
  assert.deepEqual(keys(scan),['actual','numero','numero-original','original']);
  assert.deepEqual(keys(c._svPagosIndiceVenta(c._svCrearIndicePagosVentas(pagos),venta)),keys(scan));
});

test('membresía conserva prioridad técnica, valores falsy y no normaliza mayúsculas ni ceros',()=>{
  const c=frontend(),venta={fbKey:'CaseΩ',id:'V-001',idOriginal:0};
  const pagos=[
    {fbKey:'tecnica',ventaKey:'CaseΩ'},
    {fbKey:'otra-tecnica',ventaKey:'caseΩ',venta:'V-001'},
    {fbKey:'numero-distinto',venta:'V-1'},
    {fbKey:'cero',ventaKey:0,ventaId:'V-001'},
    {fbKey:'falso',ventaFbKey:false,venta:'V-001'},
    {fbKey:'espacios',ventaOrigenFbKey:'\u00a0\t',nroVenta:'V-001'}
  ];
  const expected=['cero','espacios','falso','tecnica'];
  assert.deepEqual(keys(pagos.filter(p=>c._svRegistroPerteneceVenta(p,venta))),expected);
  assert.deepEqual(keys(c._svPagosIndiceVenta(c._svCrearIndicePagosVentas(pagos),venta)),expected);
});

test('dos ventas con alias numérico coincidente conservan la ambigüedad previa sin duplicar un pago',()=>{
  const c=frontend(),pagos=[{fbKey:'legacy',venta:'REC-123',ventaId:'V-123',nroVenta:'123',anulado:true}];
  const index=c._svCrearIndicePagosVentas(pagos);
  for(const venta of [{fbKey:'uno',id:'V-123'},{fbKey:'dos',id:'OT-123'}]){
    assert.deepEqual(keys(c._svPagosIndiceVenta(index,venta)),['legacy']);
    assert.equal(c._svRegistroPerteneceVenta(pagos[0],venta),true);
  }
});

test('el corpus de candidatos indexados equivale al scan completo incluyendo anulados y aliases legacy',()=>{
  const c=frontend(),ventas=Array.from({length:40},(_,i)=>({fbKey:'key '+i,id:'V-'+String(i).padStart(4,'0'),idOriginal:'#V-'+String(i+100).padStart(4,'0'),numeroOriginal:'ORIG-'+i}));
  const pagos=[];
  for(let i=0;i<650;i++){
    const sale=ventas[i%ventas.length],field=i%3===0?technical[i%technical.length]:business[i%business.length];
    const reference=field.startsWith('venta')&&technical.includes(field)?sale.fbKey:i%4===0?sale.idOriginal:i%4===1?sale.id:i%4===2?'NC-'+String(i%ventas.length).padStart(4,'0'):sale.numeroOriginal;
    const p={fbKey:'p'+i,[field]:reference,monto:i/100,anulado:i%7===0,estado:i%11===0?'anulado':'activo'};
    if(i%13===0)p.ventaFbKey='otra técnica '+i;
    if(i%17===0)p.comprobante={data:'fixture grande sin datos reales '+'.'.repeat(2000)};
    pagos.push(p);
  }
  const before=JSON.stringify({ventas,pagos}),index=c._svCrearIndicePagosVentas(pagos);
  for(const venta of ventas)assert.deepEqual(keys(c._svPagosIndiceVenta(index,venta)),keys(pagos.filter(p=>c._svRegistroPerteneceVenta(p,venta))));
  assert.equal(JSON.stringify({ventas,pagos}),before,'no cambia importes, adjuntos, referencias ni estados del histórico');
});

test('todos los pagos globales anulados impiden revivir resumen legacy o pagos embebidos',()=>{
  const c=frontend(),venta={fbKey:'v',id:'V-1',total:100,totalPagado:100,pagos:[{monto:100}]};
  const anulados=[{fbKey:'p1',ventaFbKey:'v',monto:40,anulado:true},{fbKey:'p2',ventaId:'V-1',monto:60,estado:'anulado'}];
  c._historialPagosCompleto=anulados;
  const related=c._svPagosIndiceVenta(c._svCrearIndicePagosVentas(anulados),venta);
  assert.equal(related.length,2,'la membresía incluye anulados');
  const summary=c._svResumenPagoVentaDesdeLista(venta,related);
  assert.equal(summary.pagado,0);assert.equal(summary.estadoPago,'pendiente_pago');
  assert.equal(c._svMontoPagadoVenta(venta),0);
});

test('resumen financiero conserva centavos y la fuente global frente a copias embebidas',()=>{
  const c=frontend(),venta={fbKey:'v',id:'V-1',total:100.4,totalPagado:100.4,pagos:[{monto:100.4}]};
  const pagos=[{fbKey:'p1',ventaKey:'v',monto:99.6},{fbKey:'p2',ventaOrigenFbKey:'v',monto:0.4},{fbKey:'p3',venta:'V-1',monto:10,anulado:true}];
  c._historialPagosCompleto=pagos;
  let summary=c._svResumenPagoVentaDesdeLista(venta,pagos);
  assert.equal(summary.pagado,100);assert.equal(summary.estadoPago,'seniado');assert.equal(c._svMontoPagadoVenta(venta),100);
  pagos.push({fbKey:'p4',venta:'V-1',monto:0.4});
  summary=c._svResumenPagoVentaDesdeLista(venta,pagos);
  assert.equal(summary.pagado,100.4);assert.equal(summary.estadoPago,'pago_total');
});

test('sin miembros globales se conservan pagos embebidos y resumen legacy en su ruta vigente',()=>{
  const c=frontend(),venta={fbKey:'v',total:100,totalPagado:20,pagos:[{monto:30},{monto:10,estado:'anulado'}]};
  assert.equal(c._svMontoPagadoVenta(venta),30);
  assert.equal(c._svResumenPagoVentaDesdeLista(venta,[]).pagado,30);
  delete venta.pagos;
  assert.equal(c._svMontoPagadoVenta(venta),20);
});
