'use strict';
// Opt-in: explicit loopback + demo namespace + reviewed local rules only.
// "owner" is an emulator fixture credential, never ADC. Real user commits use
// the existing REST store's auth_variable_override and real RTDB evaluation.
const {test,before,beforeEach,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {build,hash} = require('../scripts/prepare-ot-unit-confirmation-rules.cjs');
const {rulesProtectOTUnitConfirmation} = require('../cotizador/ot-unit-confirmation-rules');
const {createLaborGuard} = require('../cotizador/labor-guard');
const {createLaborRtdbStore} = require('../cotizador/labor-rtdb-store');
const {createOTUnitConfirmation} = require('../cotizador/ot-unit-confirmation');
const Permissions = require('../js/core/permission-index');
const base = 'http://127.0.0.1:9041', namespace = 'demo-ot-unit-confirmation-proof';
const enabled = process.env.FIREBASE_DATABASE_EMULATOR_HOST === '127.0.0.1:9041' && !!process.env.SV_OT_UNIT_RULES_FILE && /^[a-f0-9]{64}$/.test(process.env.SV_OT_UNIT_RULES_SHA || '');
const opt = {skip:!enabled,timeout:30000};
const unitKey = 'unidad_venta_ficticia_linea_ficticia_0';
let source, candidate, initial;

function jwt(uid,claims={}) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url'),now = Math.floor(Date.now()/1000);
  return encode({alg:'none',typ:'JWT'}) + '.' + encode({aud:namespace,iss:'https://securetoken.google.com/'+namespace,sub:uid,user_id:uid,iat:now-5,exp:now+300,firebase:{identities:{},sign_in_provider:'custom'},...claims}) + '.';
}
async function request(method,p,value,{uid,claims}={}) {
  const url = new URL(p+'.json',base);
  url.searchParams.set('ns',namespace);
  const headers = {'Content-Type':'application/json'};
  if (uid) url.searchParams.set('auth',jwt(uid,claims));
  else headers.Authorization = 'Bearer owner';
  const response = await fetch(url,{method,headers,body:value === undefined ? undefined : JSON.stringify(value),signal:AbortSignal.timeout(10000)});
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return {status:response.status,body};
}
async function allowed(promise) {
  const result = await promise;
  assert.equal(result.status,200,typeof result.body === 'object' ? JSON.stringify(result.body) : String(result.body));
  return result.body;
}
async function denied(promise) {
  const result = await promise;
  assert.ok([400,401,403].includes(result.status),'Expected denial, got '+result.status);
}
const read = p => allowed(request('GET',p));
const fixture = () => ({
  sv_labor_config:{schema:1,ready:true},
  sv_chat_roles:{admin:{rol:'admin',activo:true,nombre:'Administración ficticia'},vendedor:{rol:'vendedor',activo:true,nombre:'Venta ficticia'}},
  sv_permisos:Permissions.build({admin:{bloqueados:[],acciones:{}},vendedor:{bloqueados:[],acciones:{}}}),
  sisventas:{
    ordenes_trabajo:{ot_ficticia:{id:'OT-FICTICIA',estado:'Finalizado',ventaFbKey:'venta_ficticia',cliente:'Cliente ficticio',tecnico:'Técnico ficticio'}},
    ventas:{venta_ficticia:{id:'V-FICTICIA',cliente:'Cliente ficticio',total:100,totalPagado:100,items:{renglon:{cod:'P-FICTICIO',desc:'Equipo ficticio',qty:2,unidad:'Unidad',garantiaLinea:'linea_ficticia',garantiaConfig:{estado:'si',meses:12,inicio:'instalacion',equipo:true,serie:true}}}}},
    pagos:{conservar:{monto:100,ventaFbKey:'venta_ficticia'}},gastos:{conservar:{monto:5,estado:'pagado',pagos:{p:{monto:5}}}},ctaemp:{conservar:{movimiento:{monto:5,estado:'pagado'}}}
  }
});
const record = change => ({origen:'venta_ot',ventaFbKey:'venta_ficticia',otFbKey:'ot_ficticia',serie:'SERIE-FICTICIA',dir:'Acceso ficticio',fechaInstalacion:'2026-01-01',fechaVenc:'2027-01-01',condiciones:{estado:'si',meses:12,inicio:'instalacion'},...change});
function runtime({hook,leaseMutate,expectOT=true}={}) {
  const commits = [];
  const store = createLaborRtdbStore({databaseURL:base+'/?ns='+namespace,accessToken:async()=>'owner',requestMs:10000,fetchImpl:async(url,init) => {
    const target = new URL(url);
    assert.equal(target.origin,base);
    assert.equal(target.searchParams.get('ns'),namespace);
    if (init.method === 'PUT' && target.pathname === '/sv_labor_guard.json' && leaseMutate) {
      const lease = JSON.parse(init.body), auth = JSON.parse(target.searchParams.get('auth_variable_override'));
      leaseMutate(lease,auth);
      init = {...init,body:JSON.stringify(lease)};
      target.searchParams.set('auth_variable_override',JSON.stringify(auth));
    }
    if (init.method === 'PATCH') {
      const auth = JSON.parse(target.searchParams.get('auth_variable_override'));
      assert.equal(auth.uid,'admin');
      assert.equal(auth.token.svLaborService,true);
      assert.equal(auth.token.svOTUnitConfirmation,expectOT ? true : undefined);
      assert.equal(auth.token.mode,'commit');
      const lease = await read('/sv_labor_guard');
      assert.equal(lease.mode,'user');
      commits.push({patch:JSON.parse(init.body),auth,lease});
      await hook?.(commits.at(-1));
    }
    return fetch(target,init);
  }});
  const guard = createLaborGuard({store});
  // Match the Admin read API consumed by the endpoint; no read grants are
  // invented. All writes are through the real guard+store under user rules.
  const db = {ref:p => ({get:async() => {const value=await read('/'+p);return {val:()=>structuredClone(value)};}}),getRulesJSON:() => read('/.settings/rules')};
  const auth = {verifyIdToken:async(token,revoked) => {assert.equal(revoked,true);if (!['admin','vendedor'].includes(token)) throw Error('Fictitious identity revoked');return {uid:token,name:'Usuario ficticio'};}};
  const api = createOTUnitConfirmation({auth,db,guard,enabled:true,now:() => Date.parse('2026-10-23T15:00:00Z')});
  const req = (method,uid='admin') => ({method:'POST',url:'/ot/unidades/'+method,headers:{authorization:'Bearer '+uid}});
  return {guard,commits,prepare:uid => api.prepare(req('preparar',uid),{otKey:'ot_ficticia'}),confirm:(body,uid) => api.confirm(req('confirmar',uid),body)};
}
const confirmation = prepared => ({otKey:'ot_ficticia',revision:prepared.revision,fecha:'2026-10-23',units:[
  {itemKey:'renglon',n:0,decision:'instalado',serie:'SERIE-FICTICIA',ubicacion:'Acceso ficticio'},
  {itemKey:'renglon',n:1,decision:'pendiente',serie:'',ubicacion:''}
]});
function financial(snapshot) { return {ventas:snapshot.sisventas.ventas,pagos:snapshot.sisventas.pagos,gastos:snapshot.sisventas.gastos,ctaemp:snapshot.sisventas.ctaemp}; }

before(async() => {
  if (!enabled) return;
  source = JSON.parse(fs.readFileSync(process.env.SV_OT_UNIT_RULES_FILE,'utf8'));
  assert.equal(hash(source),process.env.SV_OT_UNIT_RULES_SHA);
  candidate = build(source,{expectedHash:process.env.SV_OT_UNIT_RULES_SHA});
  await allowed(request('PUT','/.settings/rules',candidate));
  assert.equal(rulesProtectOTUnitConfirmation(await read('/.settings/rules')),true);
},{timeout:30000});
beforeEach(async() => {if (enabled) {initial=fixture();await allowed(request('PUT','/',initial));}});
after(async() => {if (enabled) {await allowed(request('DELETE','/'));assert.equal(await read('/'),null);}});

test('endpoint real confirma unidad y revisión en un PATCH user con recibo, sin tocar finanzas',opt,async() => {
  const f = runtime(),prepared = await f.prepare(),result = await f.confirm(confirmation(prepared));
  assert.deepEqual(result.registered,[unitKey]);
  assert.equal(result.reviewed.length,1);
  assert.equal(f.commits.length,1);
  const patch = f.commits[0].patch;
  assert.equal(f.commits[0].lease.otUnitPolicy,1);
  assert.equal(patch.sv_labor_guard,null);
  assert.equal(Object.keys(patch).some(p => p.startsWith('sv_labor_receipts/')),true);
  assert.equal(Object.keys(patch).some(p => p.startsWith('sisventas/ordenes_trabajo/ot_ficticia/unidadesConfirmacion/')),true);
  assert.equal(Object.entries(patch).filter(([p]) => p.startsWith('sisventas/')).every(([,v]) => v !== null),true);
  const saved = await read('/');
  assert.equal(saved.sisventas.equipos[unitKey].serie,'SERIE-FICTICIA');
  assert.equal(saved.sisventas.equipos[unitKey].fechaVenc,'2027-10-23');
  assert.equal(saved.sisventas.garantias,undefined);
  assert.deepEqual(financial(saved),financial(initial));
});

test('mismo acuse/reintento no produce un segundo PATCH ni reinicia cobertura',opt,async() => {
  const f = runtime(),body = confirmation(await f.prepare());
  const result = await f.confirm(body),saved = await read('/sisventas/equipos/'+unitKey);
  assert.deepEqual(await f.confirm(body),result);
  assert.equal(f.commits.length,1);
  assert.deepEqual(await read('/sisventas/equipos/'+unitKey),saved);
});

test('serie y ubicación obligatorias fallan antes de adquirir o crear unidades',opt,async() => {
  const f = runtime(),body = confirmation(await f.prepare());
  for (const field of ['serie','ubicacion']) {
    const invalid = structuredClone(body);invalid.units[0][field] = '';
    await assert.rejects(f.confirm(invalid),error => error.statusCode === 400);
  }
  assert.equal(f.commits.length,0);
  assert.equal(await read('/sv_labor_guard'),null);
  assert.deepEqual(financial(await read('/')),financial(initial));
});

test('registro existente en la otra rama se conserva íntegro sin escribirlo ni duplicarlo',opt,async() => {
  const old = record({observaciones:'Histórico ficticio que se conserva',fechaVenc:'2026-07-01'});
  await allowed(request('PUT','/sisventas/garantias/'+unitKey,old));
  const f = runtime(),result = await f.confirm(confirmation(await f.prepare()));
  assert.deepEqual(result.preserved,[unitKey]);
  assert.equal(f.commits.every(c => !Object.keys(c.patch).some(p => p === 'sisventas/garantias/'+unitKey || p === 'sisventas/equipos/'+unitKey)),true);
  assert.deepEqual(await read('/sisventas/garantias/'+unitKey),old);
  assert.equal(await read('/sisventas/equipos/'+unitKey),null);
});

for (const branch of ['equipos','garantias']) test('alta concurrente en '+branch+' rechaza PATCH completo antes de sobrescribir o crear la otra rama',opt,async() => {
  let inserted;
  const f = runtime({hook:async({patch}) => {
    inserted = branch === 'equipos' ? structuredClone(patch['sisventas/equipos/'+unitKey]) : record({fechaVenc:'2026-02-01'});
    await allowed(request('PUT','/sisventas/'+branch+'/'+unitKey,inserted,{uid:'admin'}));
  }});
  const body = confirmation(await f.prepare());
  await assert.rejects(f.confirm(body),error => error.statusCode === 409);
  const saved = await read('/');
  assert.deepEqual(saved.sisventas[branch][unitKey],inserted);
  assert.equal(saved.sisventas[branch === 'equipos' ? 'garantias' : 'equipos'],undefined);
  assert.equal(saved.sisventas.ordenes_trabajo.ot_ficticia.unidadesConfirmacion,undefined);
  assert.equal(saved.sv_labor_receipts,undefined);
  assert.equal(saved.sv_labor_guard,undefined);
  assert.deepEqual(financial(saved),financial(initial));
});

for (const origin of ['venta_ot','venta_ot_v2']) test('clientes anteriores no pueden crear ambas ramas simultáneamente: '+origin,opt,async() => {
  await denied(request('PATCH','/',{['sisventas/equipos/'+unitKey]:record({origen:origin}),['sisventas/garantias/'+unitKey]:record({origen:origin})},{uid:'admin'}));
  assert.equal(await read('/sisventas/equipos'),null);
  assert.equal(await read('/sisventas/garantias'),null);
});

for (const branch of ['equipos','garantias']) test('cliente anterior no puede crear '+branch+' si la unidad ya está en la otra rama',opt,async() => {
  const opposite = branch === 'equipos' ? 'garantias' : 'equipos';
  await allowed(request('PUT','/sisventas/'+opposite+'/'+unitKey,record(),{uid:'admin'}));
  await denied(request('PUT','/sisventas/'+branch+'/'+unitKey,record(),{uid:'admin'}));
  assert.equal(await read('/sisventas/'+branch+'/'+unitKey),null);
});

test('mover una unidad entre ramas borrando la anterior en el mismo PATCH tampoco evita el control',opt,async() => {
  await allowed(request('PUT','/sisventas/equipos/'+unitKey,record(),{uid:'admin'}));
  await denied(request('PATCH','/',{['sisventas/equipos/'+unitKey]:null,['sisventas/garantias/'+unitKey]:record()},{uid:'admin'}));
  assert.notEqual(await read('/sisventas/equipos/'+unitKey),null);
  assert.equal(await read('/sisventas/garantias/'+unitKey),null);
});

test('edición normal y fotos históricas conservan permisos incluso para duplicados heredados',opt,async() => {
  await allowed(request('PATCH','/',{['sisventas/equipos/'+unitKey]:record(),['sisventas/garantias/'+unitKey]:record()}));
  await allowed(request('PATCH','/sisventas/equipos/'+unitKey,{observaciones:'Nota ficticia',foto:'imagen-ficticia'},{uid:'admin'}));
  assert.equal((await read('/sisventas/equipos/'+unitKey)).foto,'imagen-ficticia');
  await denied(request('PATCH','/sisventas/equipos/'+unitKey,{observaciones:'No autorizado'},{uid:'sin-permiso'}));
});

test('registros ordinarios que no son unidades venta_ot mantienen alta y edición anteriores',opt,async() => {
  const value = {origen:'manual',serie:'FICTICIA'};
  await allowed(request('PUT','/sisventas/equipos/manual_ficticio',value,{uid:'admin'}));
  await allowed(request('PUT','/sisventas/garantias/manual_ficticio',value,{uid:'admin'}));
  await allowed(request('PATCH','/sisventas/equipos/manual_ficticio',{foto:'ficticia'},{uid:'admin'}));
});

test('flags internos sin lease user y permisos del actor no otorgan una concesión nueva',opt,async() => {
  const claims = {svLaborService:true,svOTUnitConfirmation:true,mode:'commit'};
  await denied(request('PUT','/sisventas/equipos/'+unitKey,record(),{uid:'admin',claims}));
  await denied(request('PUT','/sisventas/equipos/'+unitKey,record({svLaborService:true,svOTUnitConfirmation:true}),{uid:'sin-permiso'}));
  const f = runtime();
  await assert.rejects(f.prepare('vendedor'),error => error.statusCode === 403);
  assert.equal(f.commits.length,0);
});

test('rollback completo rechaza capability nueva en acquire, sin unidades, journal ni recibo',opt,async() => {
  await allowed(request('PUT','/.settings/rules',source));
  try {
    const f = runtime();
    const prepared = await f.prepare();
    await assert.rejects(f.confirm(confirmation(prepared)),error => error.statusCode === 503);
    assert.equal(f.commits.length,0);
    assert.equal(await read('/sv_labor_guard'),null);
    assert.equal(await read('/sv_labor_receipts'),null);
    assert.deepEqual(await read('/sisventas'),initial.sisventas);
  } finally {await allowed(request('PUT','/.settings/rules',candidate));}
});

test('rollback exige la protección completa incluso antes de recuperar un acuse',opt,async() => {
  const f = runtime(),body = confirmation(await f.prepare()),result = await f.confirm(body),saved = await read('/');
  await allowed(request('PUT','/.settings/rules',source));
  try {
    await assert.rejects(f.confirm(body),error=>error.statusCode===503);
    assert.equal(f.commits.length,1);
    assert.deepEqual(await read('/'),saved);
    const different = structuredClone(body);different.fecha='2026-10-22';
    await assert.rejects(f.confirm(different),error => error.statusCode === 503);
    assert.equal(f.commits.length,1);
    assert.deepEqual(await read('/'),saved);
  } finally {await allowed(request('PUT','/.settings/rules',candidate));}
});

for (const [name,mutate] of [
  ['version string',lease => {lease.otUnitPolicy='1';}],
  ['version unknown',lease => {lease.otUnitPolicy=2;}],
  ['non-user mode',lease => {lease.mode='command';}],
  ['wrong operation ID',(lease,auth) => {lease.opId='other_operation_1234';auth.token.opId=lease.opId;}],
  ['missing internal claim',(_lease,auth) => {delete auth.token.svOTUnitConfirmation;}],
  ['client UID',(_lease,auth) => {auth.uid='admin';}],
  ['conflicting actor',lease => {lease.actorUid='vendedor';}]
]) test('capability de lease rechaza contexto contradictorio: '+name,opt,async() => {
  const f = runtime({leaseMutate:mutate});
  await assert.rejects(f.confirm(confirmation(await f.prepare())),error => error.statusCode === 403);
  assert.equal(f.commits.length,0);
  assert.equal(await read('/sv_labor_guard'),null);
  assert.equal(await read('/sv_labor_receipts'),null);
  assert.deepEqual(await read('/sisventas'),initial.sisventas);
});

test('propiedad otUnitPolicy en el body no se convierte en capacidad interna',opt,async() => {
  const f = runtime(),body = confirmation(await f.prepare());
  body.otUnitPolicy=1;
  await assert.rejects(f.confirm(body),error => error.statusCode === 400);
  assert.equal(f.commits.length,0);
  assert.equal(await read('/sv_labor_guard'),null);
});

test('guard de otro cliente y protocolo anterior sin capability siguen funcionando',opt,async() => {
  const f = runtime({expectOT:false});
  await f.guard.run({uid:'admin',claims:{uid:'admin'},mode:'user',operation:'legacy-note-only'},scope => scope.update({'sisventas/ordenes_trabajo/ot_ficticia/observaciones':'Nota ficticia compatible'}));
  assert.equal(f.commits.length,1);
  assert.equal(f.commits[0].lease.otUnitPolicy,undefined);
  assert.equal((await read('/sisventas/ordenes_trabajo/ot_ficticia')).observaciones,'Nota ficticia compatible');
  assert.deepEqual(financial(await read('/')),financial(initial));
});

test('lease real de una confirmación excluye una segunda y sólo la primera crea la unidad',opt,async() => {
  let release,entered;
  const held = new Promise(resolve => {release=resolve;}),inside = new Promise(resolve => {entered=resolve;});
  const first = runtime({hook:async() => {entered();await held;}}),second=runtime();
  const body = confirmation(await first.prepare());
  const pending = first.confirm(body);
  await inside;
  try {
    await assert.rejects(second.confirm(confirmation(await second.prepare())),error => error.statusCode === 423);
    assert.equal(second.commits.length,0);
  } finally {release();}
  await pending;
  assert.equal(first.commits.length,1);
  assert.equal(Object.keys((await read('/sisventas/equipos'))).length,1);
});

test('el endpoint verifica reglas completas y rechaza validadores eliminados selectivamente',opt,async() => {
  const partial = structuredClone(candidate);
  delete partial.rules.sisventas.equipos.$unidad;
  delete partial.rules.sisventas.garantias.$unidad;
  assert.equal(rulesProtectOTUnitConfirmation(partial),false);
  await allowed(request('PUT','/.settings/rules',partial));
  try {
    const f = runtime({hook:async() => allowed(request('PUT','/sisventas/garantias/'+unitKey,record(),{uid:'admin'}))});
    await assert.rejects(f.confirm(confirmation(await f.prepare())),error=>error.statusCode===503);
    assert.equal(f.commits.length,0);
    assert.deepEqual(await read('/sisventas'),initial.sisventas);
  } finally {await allowed(request('PUT','/.settings/rules',candidate));}
});

for (const change of ['perfil','reset']) test('revocación '+change+' antes del PATCH es evaluada por las reglas reales y revierte toda la operación',opt,async() => {
  const f = runtime({hook:async() => change === 'perfil' ? allowed(request('PUT','/sv_chat_roles/admin/activo',false)) : allowed(request('PUT','/sv_access_resets/admin',{required:true,version:2}))});
  await assert.rejects(f.confirm(confirmation(await f.prepare())),error => error.statusCode === 409);
  const saved = await read('/');
  assert.equal(saved.sisventas.equipos,undefined);
  assert.equal(saved.sisventas.ordenes_trabajo.ot_ficticia.unidadesConfirmacion,undefined);
  assert.equal(saved.sv_labor_receipts,undefined);
  assert.deepEqual(financial(saved),financial(initial));
});

test('validate no bloquea eliminaciones RTDB; el endpoint jamás las genera',opt,async() => {
  // A .validate-only restriction cannot revoke an inherited parent .write for
  // a deletion. This explicit limit is not claimed as protection for deletes.
  await allowed(request('PUT','/sisventas/equipos/'+unitKey,record(),{uid:'admin'}));
  const f = runtime();
  await f.guard.run({uid:'admin',claims:{uid:'admin',svOTUnitConfirmation:true},mode:'user',operation:'fictitious-validator-deletion-limit'},scope => scope.update({['sisventas/equipos/'+unitKey]:null}));
  assert.equal(await read('/sisventas/equipos/'+unitKey),null);
  const flow = runtime();
  await flow.confirm(confirmation(await flow.prepare()));
  assert.equal(flow.commits.every(c => Object.entries(c.patch).filter(([p]) => p.startsWith('sisventas/')).every(([,value]) => value !== null)),true);
});

test('cinco unidades manuales se registran con reglas reales sin alterar venta, catálogo ni finanzas',opt,async()=>{
  const sale=structuredClone(initial.sisventas.ventas.venta_ficticia);sale.items.renglon.qty=5;delete sale.items.renglon.garantiaConfig;delete sale.items.renglon.garantiaLinea;
  await allowed(request('PUT','/sisventas/ventas/venta_ficticia',sale));const before=financial(await read('/'));
  const f=runtime(),prepared=await f.prepare();assert.equal(prepared.manualUnits.length,5);
  const body={otKey:'ot_ficticia',revision:prepared.revision,fecha:'2026-10-23',units:Array.from({length:5},(_,n)=>({itemKey:'renglon',n,decision:'instalado',serie:'SERIE-FICTICIA-'+n,ubicacion:'Acceso ficticio '+n,manual:{confirmado:true,estado:'si',meses:12,inicio:'instalacion',serie:true,fecha:'2026-10-23'}}))};
  const result=await f.confirm(body);assert.equal(result.registered.length,5);assert.equal(f.commits.length,1);
  const records=await read('/sisventas/equipos');assert.equal(Object.keys(records).length,5);for(const r of Object.values(records)){assert.equal(r.manualConfirmado,true);assert.equal(r.actorUid,'admin');assert.equal(r.fechaVenc,'2027-10-23');assert.match(r.sourceItemDigest,/^[a-f0-9]{64}$/);}
  assert.deepEqual(financial(await read('/')),before);assert.deepEqual(await f.confirm(body),result);assert.equal(f.commits.length,1);assert.deepEqual(await read('/sisventas/equipos'),records);
});


test('custodia protegida permite notas normales y rechaza cambios o borrados directos',opt,async()=>{
 const Custody=require('../cotizador/ot-unit-custody-rules');
 const protectedRules=Custody.build(candidate,{expectedHash:hash(candidate)});assert.equal(Custody.protects(protectedRules,'ordenes_trabajo'),true);
 await allowed(request('PUT','/.settings/rules',protectedRules));
 try{
  const unit={unitKey:'unit',itemKey:'renglon',n:0,materialKey:'0',productKey:'product',sourceDigest:'f'.repeat(64),technicianKey:'employee',serie:'FICTICIA',estado:'en_tecnico',historial:[{accion:'entregar',estado:'en_tecnico',uid:'admin',technicianKey:'employee',ts:1}],actualizadoEn:1,actualizadoPor:'admin',entregadoEn:1};
  await allowed(request('PUT','/sisventas/ordenes_trabajo/ot_ficticia/unidadesCustodia',{unit}));
  await allowed(request('PATCH','/sisventas/ordenes_trabajo/ot_ficticia',{observaciones:'Nota ficticia permitida'},{uid:'admin'}));
  for(const [method,path,value]of [
   ['PUT','unidadesCustodia/unit/serie','OTRA'],
   ['DELETE','unidadesCustodia',undefined],
   ['DELETE','unidadesCustodia/unit',undefined],
   ['DELETE','unidadesCustodia/unit/serie',undefined],
   ['PUT','unidadesCustodia/unit/historial/0/accion','recibir'],
   ['DELETE','unidadesCustodia/unit/historial',undefined],
   ['PUT','unidadesCustodia/other',{...unit,unitKey:'other'}]
  ])await denied(request(method,'/sisventas/ordenes_trabajo/ot_ficticia/'+path,value,{uid:'admin'}));
  assert.deepEqual(await read('/sisventas/ordenes_trabajo/ot_ficticia/unidadesCustodia'),{unit});
  await denied(request('PUT','/sisventas/ordenes_trabajo/ot_ficticia/unidadesCustodia/unit/serie','OTRA',{uid:'admin',claims:{svLaborService:true,svOTUnitConfirmation:true,svOTUnitCustody:true,mode:'commit'}}));
  const five=Object.fromEntries(Array.from({length:5},(_,n)=>['unit_'+n,{...structuredClone(unit),unitKey:'unit_'+n,n,serie:'FICTICIA-'+n}]));
  const f=runtime();await f.guard.run({uid:'admin',claims:{uid:'admin',svOTUnitConfirmation:true,svOTUnitCustody:true},mode:'user',operation:'ot-unit-confirmation',opId:'ot_units_'+'a'.repeat(64)},scope=>scope.update({'sisventas/ordenes_trabajo/ot_ficticia/unidadesCustodia':five}));
  assert.deepEqual(await read('/sisventas/ordenes_trabajo/ot_ficticia/unidadesCustodia'),five);assert.deepEqual(financial(await read('/')),financial(initial));

 }finally{await allowed(request('PUT','/.settings/rules',candidate));}
});
