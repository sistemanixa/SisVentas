'use strict';
// Opt-in. Never writes to a remote project; rules stay in a private local file.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
if(process.env.SV_COLLECTION_ACTION_EMULATOR!=='1'){
 test('collection action emulator requires explicit opt-in',{skip:true},()=>{});
}else{
 const host='127.0.0.1:9044',project='demo-collection-action';
 if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!==host)throw Error('Only the isolated loopback emulator 9044 is allowed');
 const root=path.resolve(process.env.SV_COLLECTION_TEST_SOURCE||path.join(__dirname,'..'));
 const dep=createRequire(path.join(path.resolve(process.env.SV_SECURITY_TOOLS||'tmp/firebase-security-tools'),'package.json'));
 const {initializeTestEnvironment}=dep('@firebase/rules-unit-testing'),{ref,set,get}=dep('firebase/database');
 const Summary=require(path.join(root,'scripts/prepare-collection-summary-rules.cjs')),Writers=require(path.join(root,'scripts/prepare-payment-writer-rules.cjs'));
 const {createLaborRtdbStore}=require(path.join(root,'cotizador/labor-rtdb-store')),{createLaborGuard}=require(path.join(root,'cotizador/labor-guard')),{createPaymentCommands}=require(path.join(root,'cotizador/payment-commands')),Index=require(path.join(root,'cotizador/payment-membership-index'));
 let env,store,commands;
 const config=()=>({indiceVersion:2,indiceRevision:2,indiceModulos:{cobranzas:true,venta:false,detalle:false,presupuesto:false},acciones:{cobranzas:{registrar:true,anular:false}}});
 const actor={uid:'fictional',claims:{uid:'fictional'}};
 const input=(id='fictitious-collection-01',amount=100)=>({id,kind:'registrar',opciones:{grupoPago:'group-'+id,montoTotal:amount,solicitudes:[{ventaFbKey:'sale',pagoKey:'payment-'+id,monto:amount,pago:{fecha:'2026-10-29',referencia:'FICTICIA'}}],comprobante:{nombre:'Ficticio.pdf',tipo:'application/pdf',data:'data:application/pdf;base64,QQ=='}}});
 const write=async(p,v)=>env.withSecurityRulesDisabled(c=>set(ref(c.database(),p||undefined),v));
 before(async()=>{
  if(!path.isAbsolute(process.env.SV_RULES_TEST_FILE||'')||!/^[a-f0-9]{64}$/.test(process.env.SV_RULES_TEST_EXPECTED_HASH||''))throw Error('Explicit private rules file and reviewed hash are required');
  const base=JSON.parse(fs.readFileSync(process.env.SV_RULES_TEST_FILE,'utf8'));
  assert.equal(Summary.hash(base),process.env.SV_RULES_TEST_EXPECTED_HASH,'The rules base changed');
  const summary=Summary.prepare(base,{expectedHash:Summary.hash(base)}),candidate=Writers.prepare(summary,{expectedHash:Summary.hash(summary)});
  env=await initializeTestEnvironment({projectId:project,database:{host:'127.0.0.1',port:9044,rules:JSON.stringify(candidate)}});
 });
 beforeEach(async()=>{
  const sale={id:'V-FICTICIA',cliente:'Cliente ficticio',total:100,subtotal:100,conIva:false,iva:0,estadoPago:'pendiente_pago',items:[{qty:1,punit:100,costoUnitarioCompra:40}],comisionados:[{uid:'other',porcentaje:8}]};
  await write('',{sv_chat_roles:{fictional:{activo:true,rol:'administrativo'}},sv_permisos:{administrativo:config()},sv_labor_config:{ready:true,schema:1},sisventas:{ventas:{sale},pagos:{}}});
  for(const [p,v]of Object.entries(Index.buildIndex({},{generation:'fictitious-index',ready:true}).patch))await write(p,v);
  store=createLaborRtdbStore({databaseURL:'http://'+host+'/?ns='+project,accessToken:async()=> 'owner'});
  const db={ref:p=>({get:async()=>{const v=await store.read(p);return {val:()=>v};}})};
  commands=createPaymentCommands({authorize:async()=>{},db,store,guard:createLaborGuard({store}),enabled:true});
 });
 after(async()=>{await env?.cleanup();});
 async function invariants(expected){
  const data=await store.read('sisventas');assert.equal(Object.keys(data.pagos||{}).length,expected);assert.equal(data.ventas.sale.totalPagado??null,expected?100:null);
  assert.equal(data.ventas.sale.items[0].costoUnitarioCompra,40);assert.equal(data.ventas.sale.comisionados[0].porcentaje,8);return data;
 }
 function projected(response){const row=response.resultados[0];assert.equal(row.venta.total,100);assert.equal(row.venta.totalPagado,100);for(const k of ['items','costos','comisionados','comisionPct','responsableUid'])assert.equal(Object.hasOwn(row.venta,k),false,k);assert.equal(Object.hasOwn(row.pago.comprobanteAdjunto,'data'),false);assert.equal(row.pago.referencia,'FICTICIA');}
 for(const owner of [null,'other'])test('role collection with owner '+owner+' does not grant commercial access',async()=>{
  if(owner)await write('sisventas/ventas/sale/responsableUid',owner);
  const browser=env.authenticatedContext('fictional').database();await assert.rejects(get(ref(browser,'sisventas/ventas/sale')));
  for(const [p,v]of [['items/0/costoUnitarioCompra',1],['responsableUid','fictional']])await assert.rejects(set(ref(browser,'sisventas/ventas/sale/'+p),v));
  const body=input();projected(await commands.execute(actor,body));projected(await commands.execute(actor,structuredClone(body)));
  const data=await invariants(1);assert.equal(data.ventas.sale.responsableUid??null,owner);assert.equal(Object.keys(data.cobros_adjuntos||{}).length,1);
 });
 test('lost acknowledgement replays one payment and one PDF',async()=>{
  const commit=store.commit;let once=true;store.commit=async(...args)=>{await commit(...args);if(once){once=false;throw Object.assign(Error('Lost fictitious acknowledgement'),{code:'SV_LABOR_COMMIT_UNCONFIRMED',statusCode:503});}};
  const body=input();await assert.rejects(commands.execute(actor,body),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});projected(await commands.execute(actor,structuredClone(body)));const data=await invariants(1);assert.equal(Object.keys(data.cobros_adjuntos||{}).length,1);
 });
 for(const denied of ['action','module'])test('denied '+denied+' has no financial effect',async()=>{const cfg=config();if(denied==='action')cfg.acciones.cobranzas.registrar=false;else cfg.indiceModulos.cobranzas=false;await write('sv_permisos/administrativo',cfg);await assert.rejects(commands.execute(actor,input()),{statusCode:403});await invariants(0);});
 test('permission revoked at commit rejects the complete patch',async()=>{
  const commit=store.commit;store.commit=async(...args)=>{const cfg=config();cfg.acciones.cobranzas.registrar=false;await write('sv_permisos/administrativo',cfg);return commit(...args);};
  await assert.rejects(commands.execute(actor,input()));await invariants(0);
 });
 test('overpayment and a fresh duplicate operation cannot create another payment',async()=>{
  await assert.rejects(commands.execute(actor,input('fictitious-overpayment',101)),{statusCode:409});await invariants(0);
  await commands.execute(actor,input());await assert.rejects(commands.execute(actor,input('fictitious-second-payment')),{statusCode:409});await invariants(1);
 });
}
