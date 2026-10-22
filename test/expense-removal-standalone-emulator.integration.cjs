'use strict';
// Opt-in proof against one explicit demo namespace on loopback. No ADC, SDK,
// provider, remote rules, production database or emulator startup is performed.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {build:restrict,hash}=require('../scripts/prepare-expense-removal-rules.cjs');
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{createLaborGuard,digest}=require('../cotizador/labor-guard'),{createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const Policy=require('../cotizador/expense-removal-policy'),Index=require('../cotizador/labor-index'),Permissions=require('../js/core/permission-index');
const host='127.0.0.1:9037',base='http://'+host,namespace='demo-expense-removal-only-proof',expected='978cea4169880cd9b5d2782fbe17b7243a2fea562cb1737cb15292ebaa2e1782';
const enabled=process.env.FIREBASE_DATABASE_EMULATOR_HOST===host&&!!process.env.SV_RULES_TEST_FILE,opt={skip:!enabled,timeout:30000},clone=value=>structuredClone(value);
let rules,seed,sequence=0;
function put(root,patch){for(const [path,value]of Object.entries(patch)){const keys=path.split('/'),last=keys.pop();let node=root;for(const key of keys)node=node[key]||(node[key]={});if(value===null)delete node[last];else node[last]=clone(value);}return root;}
async function rest(method,path,value){const url=new URL(path+'.json',base);url.searchParams.set('ns',namespace);const response=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(10000)}),text=await response.text();assert.equal(response.status,200,text);return text?JSON.parse(text):null;}
function fixture(){
 const config=Permissions.build({admin:{bloqueados:[],acciones:{gastos:{administrar:false,eliminar:true},empleados:{registrarHaberes:false,gestionarAdelantos:false,pagarMovimiento:false,aprobarMovimiento:false,bonificar:false},comisiones:{crear:false}}}});
 const payment={monto:100,fecha:'2026-10-22',medio:'Efectivo'},paid={descripcion:'Gasto pagado ficticio',fecha:'2026-10-22',monto:100,montoPagado:100,estado:'pagado',empleadoId:'e',empleadoFbKey:'e',pagos:{p:payment}},unpaid={descripcion:'Gasto impagado ficticio',fecha:'2026-10-22',monto:25,montoPagado:0,estado:'pendiente_pago',empleadoId:'e',empleadoFbKey:'e'};
 const root={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{admin:{rol:'admin',activo:true,nombre:'Admin ficticio'}},sv_usuarios:{admin:{uid:'admin',activo:true,rol:'admin',nombre:'Admin ficticio'}},sv_permisos:config,sisventas:{empleados:{e:{nombre:'Empleado ficticio',activo:true}},gastos:{paid,unpaid},ctaemp:{e:{paid:{...clone(paid),gastoFbKey:'paid',tipo:'gasto_empresa'},unpaid:{monto:25,estado:'aprobado',gastoFbKey:'unpaid',tipo:'gasto_empresa'}}},gastos_adjuntos:{paid:{fotoBase64:'FICTICIO'}},haberes:{e:{'2026_10':{total:100,gastoFbKey:'paid'}}},comisiones_generacion:{keep:{estado:'completada',monto:10}},ventas:{v:{comisionesGeneradas:true}}},sv_commission_generation:{v:{estado:'completada'}}};
 return put(root,Index.buildIndex(root.sisventas));
}
function command(key){
 const current=seed.sisventas.gastos[key],path='sisventas/gastos/'+key,auditKey='removal-audit-'+(++sequence),auditPath='sisventas/auditoria_pagos/'+auditKey,accounts=Policy.employeeKeys(current),values={[path]:current,[auditPath]:null};for(const employee of accounts)values['sisventas/ctaemp/'+employee]=seed.sisventas.ctaemp[employee]||null;
 const refs=Policy.linkedMovements(values,accounts,current,key),logical=Policy.hasEconomicHistory(current)||refs.some(ref=>Policy.hasEconomicHistory(ref.mov)),stamp=Date.now(),audit={accion:logical?'baja_administrativa_gasto':'eliminar_gasto',gastoFbKey:key,gastoAnterior:clone(current),movimientosAnteriores:clone(refs),uid:'admin',usuario:'Admin ficticio',ts:stamp};
 const patch=logical?{[path+'/bajaAdministrativa']:{uid:'admin',usuario:audit.usuario,ts:stamp,auditKey},[auditPath]:audit}:{[path]:null,...Object.fromEntries(refs.map(ref=>['sisventas/ctaemp/'+ref.empKey+'/'+ref.key,null])),[auditPath]:audit};
 return {id:'removal-emulator-'+sequence,kind:'atomic',purpose:'expense-removal',path:'',value:patch,expectedHashes:Object.fromEntries(Object.entries(values).map(([source,value])=>[source,digest(value)]))};
}
function runtime(hook){
 const commits=[],store=createLaborRtdbStore({databaseURL:base+'/?ns='+namespace,accessToken:async()=>'owner',requestMs:10000,fetchImpl:async(url,init)=>{const destination=new URL(url);assert.equal(destination.origin,base);assert.equal(destination.searchParams.get('ns'),namespace);if(init.method==='PATCH'){commits.push({keys:Object.keys(JSON.parse(init.body))});await hook?.();}return fetch(destination,init);}}),guard=createLaborGuard({store}),db={};
 // This minimal Admin read adapter is deliberately separate from the real
 // authenticated source reads executed by the gateway's guard/store.
 db.ref=path=>({get:async()=>{const value=await rest('GET','/'+path);return {val:()=>value};}});
 const gateway=createLaborWriteGateway({auth:{},db,store,guard,enabled:true}),actor={uid:'admin',claims:{uid:'admin',name:'Admin ficticio'}};
 return {commits,guard,store,write:body=>gateway.write(actor,body)};
}
before(async()=>{if(!enabled)return;assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,host);const source=JSON.parse(fs.readFileSync(process.env.SV_RULES_TEST_FILE,'utf8'));assert.equal(hash(source),expected);rules=restrict(source,{expectedHash:expected});await rest('PUT','/.settings/rules',rules);},{timeout:20000});
beforeEach(async()=>{if(!enabled)return;await rest('PUT','/.settings/rules',rules);seed=fixture();await rest('PUT','/',seed);});
after(async()=>{if(enabled)await rest('DELETE','/');},{timeout:10000});
test('real rules allow logical removal with eliminar=true and administrar=false, preserving every economic projection',opt,async()=>{
 const f=runtime(),body=command('paid'),result=await f.write(body),saved=await rest('GET','/');assert.equal(result.committed,true);assert.equal(f.commits.length,1);assert.equal(saved.sisventas.gastos.paid.bajaAdministrativa.uid,'admin');assert.deepEqual(saved.sisventas.gastos.paid.pagos,seed.sisventas.gastos.paid.pagos);for(const domain of ['ctaemp','haberes','gastos_adjuntos','comisiones_generacion','ventas'])assert.deepEqual(saved.sisventas[domain],seed.sisventas[domain]);assert.deepEqual(saved.sv_commission_generation,seed.sv_commission_generation);assert.equal(Object.keys(saved.sisventas.auditoria_pagos).length,1);assert.ok(saved.sv_labor_receipts[body.id]);
});
test('real rules allow physical unpaid removal and only its linked employee movement',opt,async()=>{
 const f=runtime(),body=command('unpaid');assert.equal((await f.write(body)).committed,true);const saved=await rest('GET','/');assert.equal(saved.sisventas.gastos.unpaid,undefined);assert.equal(saved.sisventas.ctaemp.e.unpaid,undefined);assert.deepEqual(saved.sisventas.gastos.paid,seed.sisventas.gastos.paid);assert.deepEqual(saved.sisventas.ctaemp.e.paid,seed.sisventas.ctaemp.e.paid);assert.equal(f.commits.length,1);assert.ok(saved.sv_labor_receipts[body.id]);
});
test('same remover fails without the narrow grants and succeeds after adding only those grants',opt,async()=>{
 const baseline=clone(rules);delete baseline.rules.sisventas.gastos.$gasto['.write'];delete baseline.rules.sisventas.gastos.$gasto.bajaAdministrativa;delete baseline.rules.sisventas.auditoria_pagos.$audit;delete baseline.rules.sisventas.ctaemp.$empleado.$movimiento;await rest('PUT','/.settings/rules',baseline);
 const body=command('paid');await assert.rejects(runtime().write(body),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});assert.deepEqual((await rest('GET','/')).sisventas,seed.sisventas);await rest('PUT','/.settings/rules',rules);assert.equal((await runtime().write(body)).committed,true);
});
for(const change of ['inactive','role','permission','revision','module','expired','reset'])test('real commit rejects '+change+' after authorization without partial business or receipt',opt,async()=>{
 let once=false;const body=command('paid'),f=runtime(async()=>{if(once)return;once=true;if(change==='inactive')await rest('PUT','/sv_chat_roles/admin/activo',false);if(change==='role')await rest('PUT','/sv_chat_roles/admin/rol','administrativo');if(change==='permission')await rest('PUT','/sv_permisos/admin/acciones/gastos/eliminar',false);if(change==='revision')await rest('PUT','/sv_permisos/admin/indiceRevision',999);if(change==='module')await rest('PUT','/sv_permisos/admin/indiceModulos/gastos',false);if(change==='expired')await rest('PUT','/sv_labor_guard/expiresAt',Date.now()-1);if(change==='reset')await rest('PUT','/sv_access_resets/admin',{required:true,version:2});});await assert.rejects(f.write(body),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});const saved=await rest('GET','/');assert.deepEqual(saved.sisventas,seed.sisventas);assert.deepEqual(saved.sv_labor_indexes,seed.sv_labor_indexes);assert.equal(saved.sv_labor_receipts,undefined);
});

for(const change of ['permission','revision'])test('mandatory receipt rejects late '+change+' even with administrar=true parent permission',opt,async()=>{
 seed.sv_permisos.admin.acciones.gastos.administrar=true;await rest('PUT','/sv_permisos/admin',seed.sv_permisos.admin);
 let once=false;const body=command('paid'),f=runtime(async()=>{if(once)return;once=true;await rest('PUT',change==='permission'?'/sv_permisos/admin/acciones/gastos/eliminar':'/sv_permisos/admin/indiceRevision',change==='permission'?false:999);});
 await assert.rejects(f.write(body),{code:'SV_LABOR_COMMIT_UNCONFIRMED'});const saved=await rest('GET','/');assert.deepEqual(saved.sisventas,seed.sisventas);assert.deepEqual(saved.sv_labor_indexes,seed.sv_labor_indexes);assert.equal(saved.sv_labor_receipts,undefined);
});

test('another financial action retains its original receipt and expense permission contract',opt,async()=>{
 seed.sv_permisos.admin.acciones.gastos.administrar=true;await rest('PUT','/sv_permisos/admin',seed.sv_permisos.admin);
 const currentPermissions=await rest('GET','/sv_permisos/admin'),f=runtime(),actor={uid:'admin',claims:{uid:'admin'},mode:'user',operation:'other-expense-action-fixture',role:'admin',permissionRevision:currentPermissions.indiceRevision,permissionDigest:digest(currentPermissions),financialAction:'gastos.administrar'};
 await f.guard.run(actor,scope=>scope.update({'sisventas/gastos/another':{monto:12,descripcion:'Ficticio independiente'}}));const saved=await rest('GET','/');assert.equal(saved.sisventas.gastos.another.monto,12);assert.deepEqual(saved.sisventas.gastos.paid,seed.sisventas.gastos.paid);assert.equal(f.commits.length,1);
});

test('the previous packaged fiscal guard/store still commits only sale metadata without new claims or touching retired expenses', {...opt,skip:!enabled||!process.env.SV_FISCAL_LABOR_VENDOR},async()=>{
 const path=require('node:path'),vendor=path.resolve(process.env.SV_FISCAL_LABOR_VENDOR),oldGuard=require(path.join(vendor,'labor-guard.js')),oldStore=require(path.join(vendor,'labor-rtdb-store.js'));
 assert.equal(path.basename(vendor),'labor');assert.match(vendor.replace(/\\/g,'/'),/^C:\/SisVentas\/tmp\/big-update19\/fiscal-stage\/vendor\/labor$/);
 seed.sisventas.gastos.paid.bajaAdministrativa={uid:'admin',usuario:'Admin ficticio',ts:1,auditKey:'retained'};await rest('PUT','/',seed);const calls=[];
 const store=oldStore.createLaborRtdbStore({databaseURL:base+'/?ns='+namespace,accessToken:async()=>'owner',fetchImpl:async(url,init)=>{const destination=new URL(url);assert.equal(destination.origin,base);assert.equal(destination.searchParams.get('ns'),namespace);if(init.method==='PATCH'){const token=JSON.parse(destination.searchParams.get('auth_variable_override')).token;assert.equal(token.svPaymentIndexVersion,undefined);assert.equal(token.svFinancialAction,undefined);calls.push(JSON.parse(init.body));}return fetch(destination,init);}}),guard=oldGuard.createLaborGuard({store});
 const currentPermissions=await rest('GET','/sv_permisos/admin');await guard.run({uid:'admin',claims:{uid:'admin'},mode:'command',role:'admin',permissionRevision:currentPermissions.indiceRevision,permissionDigest:oldGuard.digest(currentPermissions),operation:'fiscal-metadata-fixture'},scope=>scope.update({'sisventas/ventas/v/numeroFactura':'FICTICIO-NO-VALIDO'}));
 const saved=await rest('GET','/');assert.equal(saved.sisventas.ventas.v.numeroFactura,'FICTICIO-NO-VALIDO');for(const domain of ['gastos','ctaemp','haberes','gastos_adjuntos','comisiones_generacion'])assert.deepEqual(saved.sisventas[domain],seed.sisventas[domain]);assert.equal(calls.length,1);assert.ok(Object.keys(calls[0]).every(p=>!p.startsWith('sv_labor_indexes/')));
});
