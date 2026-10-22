'use strict';
// Opt-in loopback proof. The active UI builds the command against fictitious
// snapshots; its unchanged command is then committed by the real guard/store
// against the reviewed local rules. No provider or ADC is used.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs'),Permissions=require('../js/core/permission-index'),Index=require('../cotizador/labor-index');
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{createLaborGuard}=require('../cotizador/labor-guard'),{createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const Builder=require('../scripts/prepare-bonus-history-index.cjs');
const host='127.0.0.1:9037',base='http://'+host,namespace='demo-bonus-financial-proof',sourceFile=process.env.SV_BONUS_RULES_TEST_FILE||process.env.SV_RULES_TEST_FILE;
const enabled=process.env.FIREBASE_DATABASE_EMULATOR_HOST===host&&!!sourceFile,opt={skip:!enabled,timeout:30000};let rules,seed,command,expected;
const rtdb=value=>value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,child])=>child!==null).map(([key,child])=>[key,rtdb(child)])):value;
async function rest(method,path,value){const url=new URL(path+'.json',base);url.searchParams.set('ns',namespace);assert.equal(url.origin,base);assert.match(namespace,/^demo-/);const response=await fetch(url,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(10000)}),text=await response.text();assert.equal(response.status,200,text);return text?JSON.parse(text):null;}
async function fixture(){
 const salary={monto:500,montoPagado:500,estado:'pagado',pagos:{p:{monto:500,medio:'Transferencia',fecha:'2026-10-01'}}};
 const fake=createBackend({haberes:{e:{mes:{total:500}}},gastos:{salary},ctaemp:{e:{salary}},config:{bonificaciones:{model:{nombre:'Original',montoSugerido:75.25}}}}),page=fake.page();
 const initial=copy(fake.state),movement={tipo:'bonificacion',monto:75.25,fecha:'2026-10-22',periodoComputo:'2026-11',descripcion:'Bonificación · Original',bonificacionConceptoId:'model',bonificacionConceptoNombre:'Original',ts:123};
 await page.context._guardarBonificacionEmpleadoAtomica(page.context.empData.e,movement,'concept_emulator');assert.equal(fake.commands.length,1);command=copy(fake.commands[0]);
 expected={expense:'gasto_bonificacion_e_concept_emulator',movement:'bonificacion_e_concept_emulator',records:copy(fake.state.sisventas)};
 initial.sv_usuarios={profile:{uid:'u',rol:'admin',activo:true,nombre:'Titular ficticio'}};
 // All unrelated CTA-writing actions are explicitly false. Expense creation
 // retains its already-existing gastos.administrar gate; CTA requires bonificar.
 initial.sv_permisos=Permissions.build({admin:{bloqueados:[],acciones:{gastos:{administrar:true},empleados:{bonificar:true,registrarHaberes:false,gestionarAdelantos:false,pagarMovimiento:false,aprobarMovimiento:false},comisiones:{crear:false}}}});
 initial.sisventas.pagos={p:{ventaFbKey:'v',monto:72.34,fecha:'2026-10-01'}};
 for(const [path,value]of Object.entries(Index.buildIndex(initial.sisventas))){const keys=path.split('/'),last=keys.pop();let node=initial;for(const key of keys)node=node[key]||(node[key]={});node[last]=value;}
 return initial;
}
function runtime(hook){let count=0;const store=createLaborRtdbStore({databaseURL:base+'/?ns='+namespace,accessToken:async()=>'owner',requestMs:10000,fetchImpl:async(url,init)=>{const destination=new URL(url);assert.equal(destination.origin,base);assert.equal(destination.searchParams.get('ns'),namespace);if(init.method==='PATCH'){count++;await hook?.();}return fetch(destination,init);}}),guard=createLaborGuard({store}),db={ref:path=>({get:async()=>{const value=await rest('GET','/'+path);return {val:()=>value};}})};
 const auth={verifyIdToken:async(token,revoked)=>{assert.equal(token,'fixture-token');assert.equal(revoked,true);return {uid:'u',name:'Titular ficticio',passwordAccessVersion:1};}},gateway=createLaborWriteGateway({auth,db,store,guard,enabled:true});
 return {get commits(){return count;},async write(){const actor=await gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer fixture-token'}});return gateway.write(actor,command);}};
}
before(async()=>{if(!enabled)return;const source=JSON.parse(fs.readFileSync(sourceFile,'utf8'));assert.equal(Builder.hash(source),Builder.BASELINE_HASH);rules=Builder.build(source);await rest('PUT','/.settings/rules',rules);},{timeout:20000});
beforeEach(async()=>{if(enabled){seed=await fixture();await rest('PUT','/',seed);}});
after(async()=>{if(enabled)await rest('DELETE','/');},{timeout:10000});
test('active bonus command accepts both concept fields in CTA and expense through actual guard and reviewed rules',opt,async()=>{
 const f=runtime(),result=await f.write(),saved=await rest('GET','/');assert.equal(result.committed,true);assert.equal(f.commits,1);
 for(const record of [saved.sisventas.gastos[expected.expense],saved.sisventas.ctaemp.e[expected.movement]]){assert.equal(record.bonificacionConceptoId,'model');assert.equal(record.bonificacionConceptoNombre,'Original');assert.equal(record.periodoComputo,'2026-11');assert.equal(record.monto,75.25);}
 assert.deepEqual(saved.sisventas.gastos[expected.expense],rtdb(expected.records.gastos[expected.expense]));assert.deepEqual(saved.sisventas.ctaemp.e[expected.movement],rtdb(expected.records.ctaemp.e[expected.movement]));
 for(const branch of ['haberes','config','pagos'])assert.deepEqual(saved.sisventas[branch],seed.sisventas[branch]);assert.deepEqual(saved.sisventas.gastos.salary,seed.sisventas.gastos.salary);assert.deepEqual(saved.sisventas.ctaemp.e.salary,seed.sisventas.ctaemp.e.salary);
 const before=copy(saved);assert.equal((await f.write()).committed,true);assert.deepEqual(await rest('GET','/'),before,'Replay must not duplicate or rewrite the saved financial records');assert.equal(f.commits,1);
});
for(const late of [false,true])test('current bonificar revocation '+(late?'at commit':'before authorization')+' rejects the whole two-ledger command',opt,async()=>{
 if(!late)await rest('PUT','/sv_permisos/admin/acciones/empleados/bonificar',false);
 const f=runtime(late?()=>rest('PUT','/sv_permisos/admin/acciones/empleados/bonificar',false):undefined);await assert.rejects(f.write());const saved=await rest('GET','/');assert.deepEqual(saved.sisventas,seed.sisventas);assert.deepEqual(saved.sv_labor_indexes,seed.sv_labor_indexes);assert.equal(saved.sv_labor_receipts,undefined);
});
