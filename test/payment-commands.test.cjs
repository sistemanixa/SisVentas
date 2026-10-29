'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {createBackend,apply,copy}=require('./helpers/labor-ui-flow.cjs');
const Index=require('../cotizador/payment-membership-index');
const {createPaymentCommands,paid,summary}=require('../cotizador/payment-commands');
const {functionSource}=require('./helpers/app-functions.cjs');
function fixture({payments={},sales,enabled=true}={}){
 const f=createBackend({ventas:sales||{v:{id:'V-0001',idOriginal:'OLD/0001',total:100,totalPagado:0}},pagos:payments});
 apply(f.state,Index.buildIndex(f.state.sisventas.pagos,{generation:'synthetic-payment-generation',ready:true}).patch);
 const db={ref:path=>({get:async()=>({val:()=>f.get(path)})})};
 const commands=createPaymentCommands({authorize:f.gateway.authorize,db,guard:f.guard,store:f.store,enabled,now:()=>1792530000000});
 const actor={uid:'u',claims:{uid:'u',name:'Titular ficticio'}};
 const register=(amount=40,extra={})=>({id:'synthetic-payment-01',kind:'registrar',opciones:{grupoPago:'synthetic-group-01',solicitudes:[{ventaFbKey:'v',pagoKey:'new_payment',monto:amount,pago:{fecha:'2026-10-20',usuario:'Titular ficticio',ts:1792530000000}}],montoTotal:amount,...extra}});
 return {...f,commands,actor,register};
}
function assertIndex(f){
 const coverage=f.get(Index.COVERAGE_PATH),rebuilt=Index.buildIndex(f.state.sisventas.pagos,{generation:coverage.generation,ready:true,sequence:coverage.sequence});
 assert.deepEqual(coverage,copy(rebuilt.coverage));
 for(const [path,value]of Object.entries(rebuilt.patch))assert.deepEqual(f.get(path),copy(value));
}

test('administrativo autorizado cobra con PDF y recupera acuse sin duplicar ni leer cuenta privada',async()=>{
 const f=fixture();f.state.sv_chat_roles.u.rol='administrativo';
 f.state.sv_permisos={administrativo:{indiceVersion:2,indiceModulos:{cobranzas:true},acciones:{cobranzas:{registrar:true,anular:false}},indiceRevision:7}};
 const body=f.register(100,{comprobante:{nombre:'Ficticio.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,QQ=='}});
 const before=copy(f.state.sisventas.ctaemp);
 await f.commands.execute(f.actor,body);await f.commands.execute(f.actor,copy(body));
 assert.equal(f.commits.length,1);assert.equal(Object.keys(f.get('sisventas/pagos')).length,1);
 assert.equal(f.get('sisventas/ventas/v/totalPagado'),100);assert.equal(Object.keys(f.get('sisventas/cobros_adjuntos')).length,1);
 assert.deepEqual(f.state.sisventas.ctaemp,before);assert.equal(f.reads.some(([,p])=>p.startsWith('sisventas/ctaemp')),false);
});

test('acuse y replay exponen sólo datos del cobro, nunca costos, comisionados ni documento comercial',async()=>{
 const sale={id:'V-FICTICIA',total:100,subtotal:100,conIva:false,iva:0,cliente:'Cliente ficticio',direccion:'Dirección ficticia',comisionHabilitada:true,items:[{qty:1,punit:100,costoUnitarioCompra:41}],costos:{privado:41},comisionados:[{porcentaje:8}],comisionPct:8,audit:[{secreto:'interno'}],responsableUid:'otra-persona'};
 const f=fixture({sales:{v:sale}}),body=f.register(100);
 body.opciones.solicitudes[0].pago={fecha:'2026-10-29',costos:{privado:41},porcentajeComision:8};
 body.opciones.comprobante={nombre:'Ficticio.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,QQ==',costos:{privado:41}};
 const first=await f.commands.execute(f.actor,body),read=f.store.readAsUser;
 f.store.readAsUser=async(path,actor)=>{if(path.startsWith('sisventas/ventas/'))throw Error('GET comercial no autorizado');return read(path,actor);};
 const replay=await f.commands.execute(f.actor,copy(body));
 for(const response of [first,replay]){
  const row=response.resultados[0];assert.equal(row.venta.total,100);assert.equal(row.venta.totalPagado,100);assert.equal(row.venta.comisionHabilitada,true);assert.equal(row.venta.direccion,sale.direccion);
  for(const field of ['items','costos','comisionados','comisionPct','audit','responsableUid'])assert.equal(Object.hasOwn(row.venta,field),false,field);
  assert.equal(Object.hasOwn(row.pago,'costos'),false);assert.equal(Object.hasOwn(row.pago,'porcentajeComision'),false);assert.equal(Object.hasOwn(row.pago.comprobanteAdjunto,'data'),false);
 }
 assert.equal(f.commits.length,1);assert.deepEqual(f.get('sisventas/ventas/v/items'),sale.items);assert.deepEqual(f.get('sisventas/ventas/v/comisionados'),sale.comisionados);assert.equal(f.get('sisventas/ventas/v/responsableUid'),'otra-persona');
});

test('replay no entrega proyección si revocan registrar durante su lectura interna',async()=>{
 const f=fixture(),body=f.register();await f.commands.execute(f.actor,body);
 const read=f.store.read;let changed=false;
 f.store.read=async path=>{const value=await read(path);if(path==='sisventas/ventas/v'&&!changed){changed=true;f.state.sv_permisos={admin:{indiceVersion:2,indiceModulos:{cobranzas:true},acciones:{cobranzas:{registrar:false}}}};}return value;};
 await assert.rejects(f.commands.execute(f.actor,copy(body)),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});assert.equal(f.commits.length,1);
});
test('registro acotado confirma cobro, venta, grupo, índice y recibo en un commit',async()=>{
 const f=fixture(),before=copy(f.state.sisventas),body=f.register(),r=await f.commands.execute(f.actor,body);
 assert.equal(r.resultados[0].venta.totalPagado,40);assert.equal(r.resultados[0].pago.monto,40);assert.equal(f.commits.length,1);
 assert.equal(f.get('sisventas/ventas/v/estadoPago'),'seniado');assert.deepEqual(f.get('sisventas/gastos'),before.gastos);assert.deepEqual(f.get('sisventas/ctaemp'),before.ctaemp);
 assert.ok(f.commits[0]['sv_labor_receipts/'+body.id]);assert.equal(f.commits[0].sv_labor_guard,null);assertIndex(f);
 assert.ok(f.reads.every(([,path])=>!['sisventas/pagos','sisventas/ventas','sisventas'].includes(path)));
});
test('crecimiento de pagos ajenos no crece el conjunto descargado por el comando',async()=>{
 for(const n of [20,5000]){
  const unrelated=Object.fromEntries(Array.from({length:n},(_,i)=>['unrelated_'+i,{ventaFbKey:'other_'+i,monto:3,comprobante:'x'.repeat(300)}]));
  const f=fixture({payments:unrelated});await f.commands.execute(f.actor,f.register());
  assert.equal(f.reads.some(([,p])=>p==='sisventas/pagos'),false);assert.equal(f.reads.some(([,p])=>p.includes('unrelated_')),false);assertIndex(f);
 }
});
test('multi-venta guarda un adjunto y no pisa otras imputaciones',async()=>{
 const f=fixture({sales:{v:{id:'V-0001',total:100},second:{id:'V-0002',total:70}}}),body=f.register(150);
 body.opciones.solicitudes=[{ventaFbKey:'v',pagoKey:'p1',monto:100,pago:{}},{ventaFbKey:'second',pagoKey:'p2',monto:50,pago:{}}];
 body.opciones.comprobante={nombre:'Ficticio.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,QQ=='};
 const r=await f.commands.execute(f.actor,body);assert.equal(r.resultados.length,2);assert.equal(f.get('sisventas/ventas/second/totalPagado'),50);assert.equal(Object.keys(f.get('sisventas/cobros_adjuntos')).length,1);assert.equal(f.commits.length,1);assertIndex(f);
});
test('rechaza ventas repetidas, claves repetidas e imputación distinta del total sin commit',async()=>{
 for(const kind of ['sale','key','total']){
  const f=fixture({sales:{v:{id:'V-1',total:100},second:{id:'V-2',total:100}}}),body=f.register(120);
  body.opciones.solicitudes=[{ventaFbKey:'v',pagoKey:'p1',monto:60,pago:{}},{ventaFbKey:kind==='sale'?'v':'second',pagoKey:kind==='key'?'p1':'p2',monto:60,pago:{}}];
  if(kind==='total')body.opciones.montoTotal=130;
  await assert.rejects(f.commands.execute(f.actor,body),{statusCode:400});assert.equal(f.commits.length,0);assert.deepEqual(f.get('sisventas/pagos'),{});
 }
});
test('cobros concurrentes revalidan saldo bajo el mismo fence',async()=>{
 const f=fixture(),a=f.register(60),b=copy(a);b.id='synthetic-payment-02';b.opciones.grupoPago='synthetic-group-02';b.opciones.solicitudes[0].pagoKey='second_payment';
 const results=await Promise.allSettled([f.commands.execute(f.actor,a),f.commands.execute(f.actor,b)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(Object.values(f.get('sisventas/pagos')).reduce((n,p)=>n+p.monto,0),60);assert.equal(f.commits.length,1);assertIndex(f);
});
test('replay idéntico no duplica y mismo id con otro importe falla',async()=>{
 const f=fixture(),body=f.register();await f.commands.execute(f.actor,body);const r=await f.commands.execute(f.actor,copy(body));assert.equal(r.resultados[0].pago.monto,40);assert.equal(f.commits.length,1);
 body.opciones.solicitudes[0].monto=55;body.opciones.montoTotal=55;await assert.rejects(f.commands.execute(f.actor,body),{statusCode:409});assert.equal(f.commits.length,1);
});
test('no recupera resultado después de revocar acción, módulo o usuario',async()=>{
 for(const revoke of ['action','module','identity']){
  const f=fixture(),body=f.register();await f.commands.execute(f.actor,body);
  if(revoke==='identity')f.state.sv_chat_roles.u.activo=false;
  else f.state.sv_permisos={admin:{indiceVersion:2,indiceModulos:{cobranzas:revoke!=='module'},acciones:{cobranzas:{registrar:revoke!=='action'}}}};
  await assert.rejects(f.commands.execute(f.actor,body),{statusCode:403});assert.equal(f.commits.length,1);
 }
});
test('permiso final denegado no deja negocio, índice ni recibo parciales',async()=>{
 const f=fixture(),before=copy(f.state.sisventas),coverage=f.get(Index.COVERAGE_PATH);
 f.setRejectPatch(()=>{throw Object.assign(Error('Denegado ficticio'),{statusCode:403});});
 await assert.rejects(f.commands.execute(f.actor,f.register()),{statusCode:403});assert.deepEqual(f.state.sisventas,before);assert.deepEqual(f.get(Index.COVERAGE_PATH),coverage);assert.equal(f.commits.length,0);
});
test('acuse perdido después de persistir se recupera por mismo recibo',async()=>{
 const f=fixture(),body=f.register(),commit=f.store.commit;let fail=true;
 f.store.commit=async(...args)=>{await commit(...args);if(fail){fail=false;throw Object.assign(Error('Acuse perdido ficticio'),{statusCode:503,code:'SV_LABOR_COMMIT_UNCONFIRMED'});}};
 await assert.rejects(f.commands.execute(f.actor,body),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});assert.equal(f.commits.length,1);
 const r=await f.commands.execute(f.actor,body);assert.equal(r.resultados[0].pago.monto,40);assert.equal(f.commits.length,1);assertIndex(f);
});
test('primer acuse conserva su proyección confirmada aunque otro commit anule inmediatamente después',async()=>{
 const f=fixture(),body=f.register(),commit=f.store.commit;
 f.store.commit=async(...args)=>{await commit(...args);const before=f.get('sisventas/pagos/new_payment'),after={...before,anulado:true,estado:'anulado'};apply(f.state,{'sisventas/pagos/new_payment':after,'sisventas/ventas/v/totalPagado':0,'sisventas/ventas/v/estadoPago':'pendiente_pago',...Index.planIndexDelta([{key:'new_payment',before,after,reverseBefore:f.get(Index.reversePath('new_payment'))}],{coverage:f.get(Index.COVERAGE_PATH)}).patch});};
 const result=await f.commands.execute(f.actor,body);assert.equal(result.replayed,false);assert.equal(result.resultados[0].pago.anulado,undefined);assert.equal(result.resultados[0].venta.totalPagado,40);assert.equal(f.get('sisventas/ventas/v/totalPagado'),0);assert.equal(f.commits.length,1);assertIndex(f);
});
test('replay detecta cambio entre lecturas puntuales y devuelve una vista coherente sin otro commit',async()=>{
 const f=fixture(),body=f.register();await f.commands.execute(f.actor,body);const read=f.store.readAsUser;let changed=false;
 f.store.readAsUser=async(path,actor)=>{const result=await read(path,actor);if(path==='sisventas/pagos/new_payment'&&!changed){changed=true;const before=f.get(path),after={...before,anulado:true,estado:'anulado'};apply(f.state,{[path]:after,'sisventas/ventas/v/totalPagado':0,'sisventas/ventas/v/estadoPago':'pendiente_pago',...Index.planIndexDelta([{key:'new_payment',before,after,reverseBefore:f.get(Index.reversePath('new_payment'))}],{coverage:f.get(Index.COVERAGE_PATH)}).patch});}return result;};
 const result=await f.commands.execute(f.actor,body);assert.equal(result.replayed,true);assert.equal(result.currentView,true);assert.equal(result.resultados[0].pago.anulado,true);assert.equal(result.resultados[0].venta.totalPagado,0);assert.equal(f.commits.length,1);
});
test('desaparición posterior del registro confirmado no presenta un cobro nuevo ni repite negocio',async()=>{
 const f=fixture(),body=f.register();await f.commands.execute(f.actor,body);delete f.state.sisventas.ventas.v;
 await assert.rejects(f.commands.execute(f.actor,body),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/pagos/new_payment/monto'),40);
});
test('cobertura ausente, corrupta o falsa falla cerrada sin scan',async()=>{
 for(const change of ['absent','corrupt','not-ready']){
  const f=fixture({payments:{old:{ventaOrigenFbKey:'v',monto:20}}});
  if(change==='absent')delete f.state.sv_labor_indexes.paymentRefs_v1.coverage;
  if(change==='corrupt')f.state.sv_labor_indexes.paymentRefs_v1.coverage.paymentCount=500;
  if(change==='not-ready')f.state.sv_labor_indexes.paymentRefs_v1.coverage.ready=false;
  await assert.rejects(f.commands.execute(f.actor,f.register()),{statusCode:503});assert.equal(f.commits.length,0);assert.equal(f.reads.some(([,p])=>p==='sisventas/pagos'),false);
 }
});
for(const corrupt of ['missing','digest'])test('reverse '+corrupt+' de sólo lectura no es fuente contable, pero el pago mutado se valida antes de confirmar',async()=>{
 const payments={old:{ventaOrigenFbKey:'v',monto:20}},registered=fixture({payments}),annulled=fixture({payments});
 for(const f of [registered,annulled])if(corrupt==='missing')delete f.state.sv_labor_indexes.paymentRefs_v1.byPayment.old;else f.state.sv_labor_indexes.paymentRefs_v1.byPayment.old.relationDigest='0'.repeat(64);
 const result=await registered.commands.execute(registered.actor,registered.register());assert.equal(result.resultados[0].venta.totalPagado,60);assert.equal(registered.get('sisventas/pagos/old/monto'),20);assert.equal(registered.commits.length,1);assert.ok(!registered.reads.some(([,path])=>path===Index.reversePath('old')));assert.equal(registered.get(Index.reversePath('old'))?.relationDigest??null,corrupt==='missing'?null:'0'.repeat(64),'no repara metadatos ajenos como efecto incidental');
 const before=copy(annulled.state.sisventas),coverage=annulled.get(Index.COVERAGE_PATH);await assert.rejects(annulled.commands.execute(annulled.actor,{id:'synthetic-annul-corrupt',kind:'anular',pagoKey:'old',ventaKey:'v'}),{statusCode:503,code:'SV_PAYMENT_INDEX_INVALID'});assert.equal(annulled.commits.length,0);assert.deepEqual(annulled.state.sisventas,before);assert.deepEqual(annulled.get(Index.COVERAGE_PATH),coverage);assert.equal(annulled.reads.filter(([,path])=>path===Index.reversePath('old')).length,1);
});
for(const corruption of ['extra-bucket','missing-bucket','wrong-bucket','false-member','dangling','source-changed'])test('membresías consultadas deben coincidir exactamente con la fuente autorizada: '+corruption,async()=>{
 const f=fixture({payments:{old:{ventaId:'V-0001',monto:20}}}),technical=Index.bucketPath('technical','v'),digits=Index.bucketPath('businessDigits','0001');
 if(corruption==='extra-bucket')apply(f.state,{[technical+'/old']:true});
 if(corruption==='missing-bucket')apply(f.state,{[digits+'/old']:null});
 if(corruption==='wrong-bucket'){apply(f.state,{[Index.bucketPath('businessExact','V-0001')+'/old']:null,[digits+'/old']:null,[technical+'/old']:true});}
 if(corruption==='false-member')apply(f.state,{[technical+'/old']:false});
 if(corruption==='dangling')apply(f.state,{[technical+'/does_not_exist']:true});
 if(corruption==='source-changed')f.state.sisventas.pagos.old.ventaId='V-9999';
 const before=copy(f.state.sisventas),coverage=f.get(Index.COVERAGE_PATH);await assert.rejects(f.commands.execute(f.actor,f.register()),{statusCode:503});assert.equal(f.commits.length,0);assert.deepEqual(f.state.sisventas,before);assert.deepEqual(f.get(Index.COVERAGE_PATH),coverage);assert.ok(!f.reads.some(([,path])=>path==='sisventas/pagos'));
});
test('100 pagos relacionados conservan una lectura fuente autorizada por pago sin fanout inverso de sólo lectura',async()=>{
 const totals=[];
 for(const count of [0,100]){
  const payments=Object.fromEntries(Array.from({length:count},(_,i)=>['related_'+i,{ventaFbKey:'v',monto:.1}])),f=fixture({payments});await f.commands.execute(f.actor,f.register());
  const source=f.reads.filter(([who,path])=>path.startsWith('sisventas/pagos/related_'));assert.equal(source.length,count);assert.ok(source.every(([who])=>who==='user'));assert.ok(!f.reads.some(([,path])=>path.startsWith(Index.INDEX_ROOT+'/byPayment/related_')));assert.equal(f.reads.filter(([,path])=>path===Index.reversePath('new_payment')).length,1);assert.equal(f.commits.length,1);assertIndex(f);totals.push(f.reads.length);
 }
 assert.equal(totals[1]-totals[0],100,'el crecimiento de candidatos añade una lectura por fuente, no una segunda por reverse');
});
test('un pago legacy compartido por aliases de varias ventas se lee una vez y conserva el matcher',async()=>{
 const f=fixture({payments:{old:{ventaId:'V-0001',monto:10}},sales:{v:{id:'V-0001',total:100},w:{id:'V-0001',total:100}}}),body=f.register(40);body.opciones.solicitudes=[{ventaFbKey:'v',pagoKey:'pv',monto:20,pago:{}},{ventaFbKey:'w',pagoKey:'pw',monto:20,pago:{}}];
 const result=await f.commands.execute(f.actor,body);assert.deepEqual(result.resultados.map(row=>row.venta.totalPagado),[30,30]);assert.equal(f.reads.filter(([,path])=>path==='sisventas/pagos/old').length,1);assert.ok(!f.reads.some(([,path])=>path===Index.reversePath('old')));assert.equal(f.commits.length,1);assertIndex(f);
});
test('el límite de candidatos se aplica al conjunto único antes de descargar sus fuentes',async()=>{
 const {createPaymentSnapshot}=require('../cotizador/payment-snapshot'),f=fixture({payments:{a:{ventaFbKey:'v',monto:1},b:{ventaFbKey:'v',monto:1},c:{ventaFbKey:'v',monto:1}}}),load=createPaymentSnapshot({store:f.store,maxCandidates:2});
 await assert.rejects(f.guard.run({...f.actor,mode:'user',operation:'snapshot-fictitious-limit'},scope=>load(scope,f.actor,['v'])),{statusCode:413,code:'SV_PAYMENT_SCOPE_SIZE'});assert.equal(f.commits.length,0);assert.ok(!f.reads.some(([,path])=>/^sisventas\/pagos\//.test(path)));
});
test('el índice nunca reemplaza la autorización actual para leer cada fuente',async()=>{
 const f=fixture({payments:{old:{ventaFbKey:'v',monto:20}}}),original=f.store.readAsUser;f.store.readAsUser=async(path,actor)=>{if(path==='sisventas/pagos/old')throw Object.assign(Error('Sin permiso ficticio'),{statusCode:403});return original(path,actor);};await assert.rejects(f.commands.execute(f.actor,f.register()),{statusCode:403});assert.equal(f.commits.length,0);assert.equal(f.get('sisventas/pagos/old/monto'),20);
});
test('anular relee todos los cobros relacionados, conserva membresía y comisiones',async()=>{
 const f=fixture({payments:{a:{ventaFbKey:'v',monto:20},b:{ventaOrigenFbKey:'v',monto:30}},sales:{v:{id:'V-0001',total:100,totalPagado:50}}});
 const r=await f.commands.execute(f.actor,{id:'synthetic-annul-01',kind:'anular',pagoKey:'a',ventaKey:'v',fecha:'2026-10-20',motivo:'Prueba ficticia'});
 assert.equal(r.resultados[0].pago.anulado,true);assert.equal(f.get('sisventas/ventas/v/totalPagado'),30);assert.equal(f.get('sisventas/pagos/b/monto'),30);assert.equal(f.commits.length,1);assertIndex(f);
});
test('no expone borrado físico ni anulación a un rol sin acción',async()=>{
 const f=fixture({payments:{p:{ventaFbKey:'v',monto:30}}});await assert.rejects(f.commands.execute(f.actor,{id:'synthetic-delete-01',kind:'eliminar',pagoKey:'p',ventaKey:'v'}),{statusCode:400});
 f.state.sv_chat_roles.u.rol='administrativo';await assert.rejects(f.commands.execute(f.actor,{id:'synthetic-annul-01',kind:'anular',pagoKey:'p',ventaKey:'v'}),{statusCode:403});assert.equal(f.commits.length,0);
});
test('semánticas legacy distintas de registrar/anular permanecen iguales al cliente',()=>{
 const c={_svTotalVentaCanonico:s=>Number(s.total)||0};vm.createContext(c);
 vm.runInContext(['_svTxtClave','_svVentaClaves','_svRegistroPerteneceVenta','_svPagoValido','_svPagosGlobalesRelacionadosVenta','_svPagosEmbebidosVenta','_svResumenPagoLegacyVenta','_svResumenPagoVentaDesdeLista'].map(functionSource).join('\n'),c);
 for(const payments of [[],[{ventaFbKey:'v',monto:20}],[{ventaFbKey:'v',monto:90,anulado:true}],[{ventaKey:'v',monto:13},{ventaId:'V-0001',monto:17}]])for(const embedded of [undefined,[{monto:50}],{legacy:{monto:50}}]){
  const sale={fbKey:'v',id:'V-0001',total:100,totalPagado:80,pagos:embedded},valid=payments.filter(c._svPagoValido),oldRegistration=valid.length?valid.reduce((n,p)=>n+(parseFloat(p.monto)||0),0):c._svResumenPagoLegacyVenta(sale),oldAnnul=c._svResumenPagoVentaDesdeLista(sale,payments);
  assert.equal(paid(sale,payments),oldRegistration);assert.deepEqual(summary(sale,payments),{total:100,pagado:oldAnnul.pagado,estadoPago:oldAnnul.estadoPago});
 }
});
test('circuito apagado no inicia lecturas ni escrituras',async()=>{
 const f=fixture({enabled:false});await assert.rejects(f.commands.execute(f.actor,f.register()),{code:'SV_PAYMENTS_NOT_ENABLED'});assert.equal(f.reads.length,0);assert.equal(f.commits.length,0);
});
module.exports={fixture,assertIndex};

test('registrar por rol no exige lectura comercial ni cambia el responsable de venta',async()=>{
 const f=fixture({sales:{v:{id:'V-0001',total:100,creadaPor:'Otro usuario ficticio',responsableUid:'otro',items:[{cod:'P',qty:1,punit:100,costoUnitarioCompra:40}],comisionados:['otro']}}});
 f.state.sv_chat_roles.u.rol='administrativo';
 (f.state.sv_permisos||={}).administrativo={indiceVersion:2,indiceRevision:3,indiceModulos:{cobranzas:true},acciones:{cobranzas:{registrar:true}}};
 const prior=copy(f.get('sisventas/ventas/v')),read=f.store.readAsUser;
 f.store.readAsUser=async(path,actor)=>{if(path.startsWith('sisventas/ventas/'))throw Object.assign(Error('No permite edición comercial'),{statusCode:403});return read(path,actor);};
 await f.commands.execute(f.actor,f.register());
 const after=f.get('sisventas/ventas/v');for(const key of ['responsableUid','creadaPor','items','comisionados','total'])assert.deepEqual(after[key],prior[key]);
 assert.equal(after.totalPagado,40);assert.equal(f.commits.length,1);
});

test('una acción revocada no permite ni la lectura interna de venta para el cobro',async()=>{
 const f=fixture();f.state.sv_chat_roles.u.rol='administrativo';(f.state.sv_permisos||={}).administrativo={indiceVersion:2,indiceRevision:3,indiceModulos:{cobranzas:true},acciones:{cobranzas:{registrar:false}}};
 await assert.rejects(f.commands.execute(f.actor,f.register()),{statusCode:403});assert.equal(f.commits.length,0);assert.equal(f.reads.some(([,path])=>path==='sisventas/ventas/v'),false);
});

test('otro rol interno sólo cobra con módulo y acción expresamente habilitados',async()=>{
 for(const allowed of [false,true]){const f=fixture();f.state.sv_chat_roles.u.rol='tecnico';
  (f.state.sv_permisos||={}).tecnico={indiceVersion:2,indiceRevision:3,indiceModulos:{cobranzas:true},acciones:{cobranzas:{registrar:allowed}}};
  if(allowed){await f.commands.execute(f.actor,f.register());assert.equal(f.commits.length,1);}else{await assert.rejects(f.commands.execute(f.actor,f.register()),{statusCode:403});assert.equal(f.commits.length,0);}
 }
});
