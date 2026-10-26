'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createBackend,copy,apply}=require('./helpers/labor-ui-flow.cjs'),{digest}=require('../cotizador/labor-guard');
const Policy=require('../cotizador/labor-advance-discount'),{functionSource}=require('./helpers/app-functions.cjs');
const Permissions=require('../js/core/permission-index'),{createLaborGuard}=require('../cotizador/labor-guard'),{createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const actor={uid:'u',claims:{uid:'u',passwordAccessVersion:1}},account='sisventas/ctaemp/e',advancePath=account+'/advance';
const advance=(extra={})=>({tipo:'adelanto',monto:100,montoPagado:100,estado:'pagado',fecha:'2026-10-14',fechaPago:'2026-10-14',periodoDescuento:'2026-11',pagos:{p:{monto:100,fecha:'2026-10-14',medio:'Efectivo'}},montoCompensado:0,compensaciones:{},gastoFbKey:'advance-expense',...extra});
function fixture(extra={},options={}){
 const a=advance(extra),salary={tipo:'sueldo',mes:'2026-11',monto:1000,sueldoBruto:1000,adelantoCompensado:0,adelantosAplicados:{},gastoFbKey:'salary',estado:'aprobado',fecha:'2026-11-01'};
 const expense={...copy(salary),tipo:'Fijo',tipoPagable:'sueldo',legacyKey:'ctaemp/e/salary',empleadoId:'e',empleadoFbKey:'e'};if(options.legacyExpense){delete expense.mes;delete expense.legacyKey;}
 return createBackend({ctaemp:{e:{advance:a,salary}},gastos:{'advance-expense':{...copy(a),tipo:'Variable',tipoPagable:'adelanto',origen:'adelanto_personal',legacyKey:'ctaemp/e/advance'},salary:expense},haberes:{e:{'2026_11':{mes:'2026-11',total:1000,sueldoBruto:1000,adelantoCompensado:0,adelantosAplicados:{},gastoFbKey:'salary'}}}});
}
let sequence=0;
function command(f,value,paths=[account]){return {id:'advance-period-fixture-'+(++sequence),kind:'atomic',path:'',value:copy(value),expectedHashes:Object.fromEntries(paths.map(path=>[path,digest(f.get(path))]))};}
function compensation(f,month='2026-11',money=20,{mirrors=false,key=month.replace('-','_')}={}){
 const value={[advancePath+'/montoCompensado']:(Number(f.get(advancePath+'/montoCompensado'))||0)+money,[advancePath+'/compensaciones/'+key]:(Number(f.get(advancePath+'/compensaciones/'+key))||0)+money},paths=[account];
 if(mirrors){const detail={advance:{adelantoFbKey:'advance',monto:money,fecha:'2026-10-14',descripcion:'Ficticio',montoOriginal:100}};
  for(const path of [account+'/salary','sisventas/gastos/salary','sisventas/haberes/e/2026_11']){value[path+'/adelantoCompensado']=money;value[path+'/adelantosAplicados']=detail;value[path+(path.includes('/haberes/')?'/total':'/monto')]=1000-money;}
  paths.push('sisventas/gastos/salary','sisventas/haberes/e/2026_11');
 }
 return command(f,value,paths);
}
const write=(f,body)=>f.gateway.write(actor,body);
function unchanged(f,before){assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,0);assert.equal(f.state.sv_labor_guard??null,null);}
function noGlobal(f){assert.ok(!f.reads.some(([,path])=>['sisventas','sisventas/ctaemp','sisventas/gastos','sisventas/haberes'].includes(path)));}

test('Docker packages the restrictive validator and guard calls it before index planning',()=>{
 assert.match(fs.readFileSync('cotizador/Dockerfile','utf8'),/COPY labor-advance-discount\.js \.\//);
 const guard=fs.readFileSync('cotizador/labor-guard.js','utf8');assert.ok(guard.indexOf('await validateAdvanceDiscount(')<guard.indexOf('Index.planIndexDelta(changes)'));
});
for(const [date,expected]of [['2026-10-14','2026-11'],['14/10/2026','2026-11'],[' 2026-12-31 ','2027-01'],['2024-02-29','2024-03'],['2026-02-29',''],['2026-13-01',''],['2026-10',''],['9999-12-01',''],['','']])test('server next month matches active frontend for '+date,()=>{
 const c={Date,Number,String};vm.createContext(c);vm.runInContext(functionSource('_adelantoMesSiguiente'),c);assert.equal(Policy.nextMonth(date),expected);assert.equal(Policy.nextMonth(date),c._adelantoMesSiguiente(date));
});
for(const value of [{fecha:'2026-10-14'},{fechaPago:'bad',fecha:'14/10/2026'},{periodoDescuento:'2026-09',fecha:'2026-10-14'},{periodoDescuento:'2026-13',fecha:'2026-10-14'},{periodoDescuento:'2026_11',fecha:'2026-10-14'},{periodoDescuento:' 2026-11',fecha:'2026-10-14'},{periodoDescuento:null,fecha:'2026-10-14'},{periodoDescuento:'',fecha:'2026-10-14'},{ts:1792011000000}])test('period selector matches frontend '+JSON.stringify(value),()=>{
 const c={Date,Number,String};vm.createContext(c);vm.runInContext(functionSource('_adelantoMesSiguiente')+'\n'+functionSource('_adelantoPeriodoDescuento'),c);assert.equal(Policy.discountPeriod(value),c._adelantoPeriodoDescuento(value));
});
test('old client cannot allocate October after choosing January; rejection precedes business PATCH',async()=>{
 const f=fixture({periodoDescuento:'2027-01'}),before=copy(f.state.sisventas);await assert.rejects(write(f,compensation(f,'2026-10')),error=>error.code==='SV_ADVANCE_COMPENSATION_TOO_EARLY');unchanged(f,before);noGlobal(f);
});
for(const key of ['2026_11','2026-11'])test('canonical/legacy compensation key '+key+' accepts November and preserves all payments',async()=>{
 const f=fixture(),payments=copy(f.get(advancePath+'/pagos'));await write(f,compensation(f,'2026-11',20,{key}));assert.equal(f.get(advancePath+'/montoCompensado'),20);assert.deepEqual(f.get(advancePath+'/pagos'),payments);assert.equal(f.commits.length,1);noGlobal(f);
});
for(const key of ['2026_1','2026_13','2026-1','2026_00','octubre','202611'])test('new compensation with invalid month key '+key+' rejects',async()=>{
 const f=fixture(),before=copy(f.state.sisventas);await assert.rejects(write(f,compensation(f,'2026-11',20,{key})));unchanged(f,before);noGlobal(f);
});
for(const extra of [{periodoDescuento:'2026-13'},{periodoDescuento:undefined,fechaPago:'bad',fecha:'bad'},{periodoDescuento:null,fechaPago:'',fecha:'',ts:1792011000000}])test('new allocation requires a usable original month '+JSON.stringify(extra),async()=>{
 const f=fixture(extra),before=copy(f.state.sisventas);await assert.rejects(write(f,compensation(f)));unchanged(f,before);
});
test('legacy no field derives next valid payment month then movement date and carries forward',async()=>{
 for(const extra of [{periodoDescuento:undefined},{periodoDescuento:null,fechaPago:'bad',fecha:'14/10/2026'},{periodoDescuento:'',fechaPago:'2026-10-14',fecha:'bad'}]){const f=fixture(extra);await write(f,compensation(f,'2026-12'));assert.equal(f.get(advancePath+'/montoCompensado'),20);}
});
test('explicit selected month may precede delivery, without forcing the default',async()=>{
 const f=fixture({periodoDescuento:'2026-09'});await write(f,compensation(f,'2026-09'));assert.equal(f.get(advancePath+'/compensaciones/2026_09'),20);assert.equal(f.get(advancePath+'/fechaPago'),'2026-10-14');
});
test('same historical compensation before discount month remains intact during medium and payment correction',async()=>{
 const f=fixture({periodoDescuento:'2027-01',montoCompensado:20,compensaciones:{'2026_10':20,legacy_bad:'old'}}),history=copy(f.get(advancePath+'/compensaciones'));await write(f,command(f,{[advancePath+'/medioPago']:'Transferencia',[advancePath+'/pagos/p/medio']:'Transferencia'}));assert.deepEqual(f.get(advancePath+'/compensaciones'),history);assert.equal(f.get(advancePath+'/montoCompensado'),20);assert.equal(f.commits.length,1);
});
test('an increase of an old early month is new compensation and rejects; reversal remains permitted',async()=>{
 const f=fixture({periodoDescuento:'2027-01',montoCompensado:20,compensaciones:{'2026_10':20}}),before=copy(f.state.sisventas);await assert.rejects(write(f,compensation(f,'2026-10',1)));unchanged(f,before);
 await write(f,command(f,{[advancePath+'/montoCompensado']:10,[advancePath+'/compensaciones/2026_10']:10}));assert.equal(f.get(advancePath+'/montoCompensado'),10);
});
test('aggregate compensation increase without attributed month cannot bypass eligibility',async()=>{
 const f=fixture(),before=copy(f.state.sisventas);await assert.rejects(write(f,command(f,{[advancePath+'/montoCompensado']:20})),error=>error.code==='SV_ADVANCE_COMPENSATION_MONTH_REQUIRED');unchanged(f,before);
});
test('partly attributed aggregate compensation also rejects without rounding away an amount',async()=>{
 const f=fixture(),before=copy(f.state.sisventas);await assert.rejects(write(f,command(f,{[advancePath+'/montoCompensado']:20,[advancePath+'/compensaciones/2026_11']:1})));unchanged(f,before);
});
test('an arbitrarily small positive allocation still checks its month',async()=>{
 const f=fixture(),before=copy(f.state.sisventas);await assert.rejects(write(f,compensation(f,'2026-10',1e-12)),error=>error.code==='SV_ADVANCE_COMPENSATION_TOO_EARLY');unchanged(f,before);
});
test('map aliases are summed so adding a second spelling cannot hide an increment',async()=>{
 const f=fixture({periodoDescuento:'2026-12',montoCompensado:20,compensaciones:{'2026_11':20}}),before=copy(f.state.sisventas);await assert.rejects(write(f,compensation(f,'2026-11',20,{key:'2026-11'})));unchanged(f,before);
});
for(const shape of ['fields','record','employee-parent'])test('eligibility cannot be bypassed by '+shape+' patch shape',async()=>{
 const f=fixture(),body=compensation(f,'2026-10'),before=copy(f.state.sisventas);if(shape!=='fields'){const next=copy(f.get(advancePath));next.montoCompensado=20;next.compensaciones={'2026_10':20};body.value=shape==='record'?{[advancePath]:next}:{[account]:{...f.get(account),advance:next}};}
 await assert.rejects(write(f,body));unchanged(f,before);noGlobal(f);
});
test('full old record omission cannot erase a future explicit month then use a legacy fallback',async()=>{
 const f=fixture({periodoDescuento:'2027-01'}),next=copy(f.get(advancePath));delete next.periodoDescuento;next.montoCompensado=20;next.compensaciones={'2026_11':20};const before=copy(f.state.sisventas);await assert.rejects(write(f,command(f,{[advancePath]:next})));unchanged(f,before);
});
test('editing a discount month requires original CAS and preserves historical early allocations',async()=>{
 const f=fixture({montoCompensado:20,compensaciones:{'2026_09':20}}),history=copy(f.get(advancePath+'/compensaciones'));await write(f,command(f,{[advancePath+'/periodoDescuento']:'2027-01'}));assert.equal(f.get(advancePath+'/periodoDescuento'),'2027-01');assert.deepEqual(f.get(advancePath+'/compensaciones'),history);
 const bad=fixture(),before=copy(bad.state.sisventas);await assert.rejects(write(bad,{id:'advance-no-cas-fixture',kind:'patch',path:'',value:{[advancePath+'/periodoDescuento']:'2026-09'}}),error=>error.code==='SV_ADVANCE_PERIOD_CAS_REQUIRED');unchanged(bad,before);
});
test('explicit CAS change can select an earlier month and allocate to it in the same operation',async()=>{
 const f=fixture({periodoDescuento:'2027-01'}),body=compensation(f,'2026-10');body.value[advancePath+'/periodoDescuento']='2026-10';await write(f,body);assert.equal(f.get(advancePath+'/compensaciones/2026_10'),20);
});
test('changing only delivery date cannot reinterpret the original metadata to allocate too early',async()=>{
 const f=fixture({periodoDescuento:undefined,fechaPago:'2026-11-01',fecha:'2026-11-01'}),body=compensation(f,'2026-11');body.value[advancePath+'/fechaPago']='2026-10-01';const before=copy(f.state.sisventas);await assert.rejects(write(f,body));unchanged(f,before);
});
for(const chosen of ['2026-09','2027-03',undefined])test('new advance can keep an explicit chosen month or valid legacy default '+chosen,async()=>{
 const f=fixture(),next=advance({periodoDescuento:chosen});if(chosen===undefined)delete next.periodoDescuento;await write(f,{id:'advance-create-fixture-'+(++sequence),kind:'set',path:account+'/new',value:next});assert.equal(f.get(account+'/new/fechaPago'),'2026-10-14');assert.equal(f.get(account+'/new/monto'),100);
});
for(const extra of [{periodoDescuento:'2026-13'},{periodoDescuento:null,fechaPago:'bad',fecha:'bad'}])test('new unusable advance requires manual month '+JSON.stringify(extra),async()=>{
 const f=fixture(),before=copy(f.state.sisventas);await assert.rejects(write(f,{id:'advance-invalid-create-'+(++sequence),kind:'set',path:account+'/new',value:advance(extra)}));unchanged(f,before);
});
test('one valid atomic allocation keeps salary, Haberes, expense, paid advance and receipt coherent',async()=>{
 const f=fixture(),paid=copy(f.get(advancePath+'/pagos')),body=compensation(f,'2026-11',20,{mirrors:true});await write(f,body);for(const path of [account+'/salary','sisventas/gastos/salary','sisventas/haberes/e/2026_11'])assert.equal(f.get(path+'/adelantosAplicados/advance/monto'),20);assert.deepEqual(f.get(advancePath+'/pagos'),paid);assert.equal(f.commits.length,1);assert.ok(f.get('sv_labor_receipts/'+body.id));noGlobal(f);
});
test('legacy expense with no month uses only original CAS-protected CTA/Haberes links without writing inferred metadata',async()=>{
 const f=fixture({}, {legacyExpense:true});await write(f,compensation(f,'2026-11',20,{mirrors:true}));assert.equal(f.get('sisventas/gastos/salary/monto'),980);assert.equal(f.get('sisventas/gastos/salary/mes'),null);assert.equal(f.get('sisventas/haberes/e/2026_11/total'),980);assert.equal(f.commits.length,1);noGlobal(f);
});
test('legacy expense cannot invent a month when protected counterparts disagree',async()=>{
 const f=fixture({periodoDescuento:'2026-09'});delete f.state.sisventas.gastos.salary.mes;apply(f.state,{[account+'/second']:{tipo:'sueldo',mes:'2026-12',gastoFbKey:'salary',monto:1000}});const body=compensation(f,'2026-11',20,{mirrors:true});body.value[advancePath+'/montoCompensado']=40;body.value[advancePath+'/compensaciones/2026_12']=20;body.value[account+'/second/adelantosAplicados']={advance:{adelantoFbKey:'advance',monto:20}};const before=copy(f.state.sisventas);await assert.rejects(write(f,body));unchanged(f,before);noGlobal(f);
});
test('CAS cannot invent a legacy expense month by changing its existing counterpart month in the same payload',async()=>{
 const f=fixture({}, {legacyExpense:true}),body=compensation(f,'2026-12'),detail={advance:{adelantoFbKey:'advance',monto:20}};body.value[account+'/salary/mes']='2026-12';for(const path of [account+'/salary','sisventas/gastos/salary']){body.value[path+'/adelantosAplicados']=detail;body.value[path+'/adelantoCompensado']=20;body.value[path+'/monto']=980;}body.expectedHashes['sisventas/gastos/salary']=digest(f.get('sisventas/gastos/salary'));const before=copy(f.state.sisventas);await assert.rejects(write(f,body));unchanged(f,before);noGlobal(f);
});
for(const domain of ['ctaemp','gastos','haberes'])test('mirror '+domain+' cannot add an allocation without its canonical advance increment',async()=>{
 const f=fixture(),path=domain==='ctaemp'?account+'/salary':domain==='gastos'?'sisventas/gastos/salary':'sisventas/haberes/e/2026_11',before=copy(f.state.sisventas),value={[path+'/adelantosAplicados']:{advance:{adelantoFbKey:'advance',monto:20}}};const paths=[account];if(domain!=='ctaemp')paths.push(path);await assert.rejects(write(f,command(f,value,paths)),error=>error.code==='SV_ADVANCE_COMPENSATION_DETAIL_REQUIRED');unchanged(f,before);noGlobal(f);
});
test('salary aggregate cannot add compensation without details',async()=>{
 const f=fixture(),before=copy(f.state.sisventas);await assert.rejects(write(f,command(f,{[account+'/salary/adelantoCompensado']:20})),error=>error.code==='SV_ADVANCE_COMPENSATION_DETAIL_REQUIRED');unchanged(f,before);
});
test('expense mirror cannot select another employee from payload identity',async()=>{
 const f=fixture({periodoDescuento:'2027-01'});apply(f.state,{'sisventas/ctaemp/foreign/advance':advance({periodoDescuento:'2026-09'})});const value={'sisventas/gastos/salary/mes':'2026-10','sisventas/gastos/salary/empleadoId':'foreign','sisventas/gastos/salary/empleadoFbKey':'foreign','sisventas/gastos/salary/adelantosAplicados':{advance:{adelantoFbKey:'advance',monto:20}}},before=copy(f.state.sisventas);await assert.rejects(write(f,command(f,value,[account,'sisventas/gastos/salary'])));unchanged(f,before);assert.ok(!f.reads.some(([,path])=>path.startsWith('sisventas/ctaemp/foreign')));
});
test('a mirror without an authorized original CTA source is denied before looking up that source',async()=>{
 const f=fixture(),before=copy(f.state.sisventas);await assert.rejects(write(f,command(f,{'sisventas/gastos/salary/adelantosAplicados':{advance:{adelantoFbKey:'advance',monto:20}}},['sisventas/gastos/salary'])));unchanged(f,before);assert.ok(!f.reads.some(([,path])=>path.startsWith('sisventas/ctaemp/')));
});
test('existing authorized employee snapshot supplies validation data without extra service account reads',async()=>{
 const f=fixture();await write(f,compensation(f,'2026-11',20,{mirrors:true}));assert.equal(f.reads.filter(([mode,path])=>mode==='user'&&path===account).length,1);assert.ok(!f.reads.some(([mode,path])=>mode==='server'&&(path===account||path.startsWith(account+'/'))));noGlobal(f);
});
test('normal historical medium/payment corrections and unrelated commission fields are not reinterpreted',async()=>{
 const f=fixture({periodoDescuento:'invalid',fecha:'bad',fechaPago:'bad',montoCompensado:20,compensaciones:{old:20}});await write(f,command(f,{[advancePath+'/pagos/p/medio']:'Tarjeta',[advancePath+'/descripcion']:'Nota histórica',[account+'/salary/observacion']:'Nota'}));assert.equal(f.get(advancePath+'/compensaciones/old'),20);assert.equal(f.commits.length,1);
});
test('same operation receipt replay is idempotent and two competing CAS writers cannot double-allocate',async()=>{
 const f=fixture(),first=compensation(f),second=compensation(f);await write(f,first);await write(f,first);assert.equal(f.commits.length,1);await assert.rejects(write(f,second),error=>error.code==='SV_CAS_CONFLICT');assert.equal(f.get(advancePath+'/montoCompensado'),20);assert.equal(f.commits.length,1);
 const concurrent=fixture(),a=compensation(concurrent),b=compensation(concurrent),results=await Promise.allSettled([write(concurrent,a),write(concurrent,b)]);assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(concurrent.commits.length,1);
});
test('a changed original period is rejected by the command CAS without overwriting it',async()=>{
 const f=fixture(),body=compensation(f);apply(f.state,{[advancePath+'/periodoDescuento']:'2027-01'});const before=copy(f.state.sisventas);await assert.rejects(write(f,body),error=>error.code==='SV_CAS_CONFLICT');unchanged(f,before);
});
test('original read permission denial and revoked commit permission preserve all business data',async()=>{
 const f=fixture(),before=copy(f.state.sisventas);f.store.readAsUser=async()=>{throw Object.assign(Error('Sin acceso'),{statusCode:403});};await assert.rejects(write(f,compensation(f)),error=>error.statusCode===403);unchanged(f,before);
 const revoked=fixture(),saved=copy(revoked.state.sisventas);revoked.setRejectPatch(()=>{throw Object.assign(Error('Permiso revocado'),{statusCode:403});});await assert.rejects(write(revoked,compensation(revoked)),error=>error.statusCode===403);unchanged(revoked,saved);
});
test('service operations do not open reads or add a background validation job',async()=>{
 let reads=0;await Policy.validateAdvanceDiscount({actor:{mode:'server'},raw:()=>{reads++;},get:()=>{reads++;},patch:{}});assert.equal(reads,0);
});
test('pure comparisons keep deeply frozen historical structures intact',()=>{
 const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;},before=deepFreeze(advance({montoCompensado:20,compensaciones:{'2026_10':20}})),after=deepFreeze({...copy(before),montoCompensado:30,compensaciones:{'2026_10':20,'2026_11':10}}),saved=JSON.stringify([before,after]);assert.deepEqual(Policy.compensationIncreases(before,after).increases,[{month:'2026-11',amount:10}]);assert.equal(JSON.stringify([before,after]),saved);
});
test('native active Haberes function produces a valid guarded bundle without changing payments',async()=>{
 const f=fixture({periodoDescuento:'2026-12'}),page=f.page(),c=page.context;c._habRegistroEnCurso=false;const before=copy(f.get(advancePath+'/pagos'));await c._registrarHaberesAtomico([{e:{fbKey:'e',nombre:'Persona ficticia',cargoId:'c'},sueldo:1000,bonificacion:0,valorHora:100,diasMes:30}], '2026-12','2026-12-01','diciembre');assert.equal(f.get(advancePath+'/montoCompensado'),100);assert.deepEqual(f.get(advancePath+'/pagos'),before);assert.equal(f.commits.length,1);assert.equal(f.get('sisventas/haberes/e/2026_12/total'),900);noGlobal(f);
});
function roleFixture(role='tecnico',actions={bonificar:true,gestionarAdelantos:false,aprobarMovimiento:false},advanceExtra={}){
 const f=fixture(advanceExtra);f.state.sv_chat_roles.u.rol=role;f.state.sv_permisos=Permissions.build({[role]:{acciones:{empleados:actions},bloqueados:[]}});return f;
}
test('only Bonificar does not authorize changing the month of an already paid advance',async()=>{
 const f=roleFixture(),before=copy(f.state.sisventas);await assert.rejects(write(f,command(f,{[advancePath+'/periodoDescuento']:'2026-10'})),error=>error.code==='SV_ADVANCE_PERIOD_PERMISSION_DENIED');unchanged(f,before);
});
for(const action of ['gestionarAdelantos','aprobarMovimiento'])test('the existing '+action+' grant authorizes an explicit month and is freshly rechecked',async()=>{
 const f=roleFixture('tecnico',{bonificar:true,gestionarAdelantos:false,aprobarMovimiento:false,[action]:true});await write(f,command(f,{[advancePath+'/periodoDescuento']:'2026-10'}));assert.equal(f.get(advancePath+'/periodoDescuento'),'2026-10');assert.equal(f.reads.filter(([mode,path])=>mode==='server'&&path==='sv_permisos/tecnico').length,2);assert.equal(f.reads.filter(([mode,path])=>mode==='server'&&path==='sv_chat_roles/u').length,2);
});
test('administrator explicit false overrides prevent using an unrelated manager grant for the new field',async()=>{
 const f=roleFixture('admin',{bonificar:true,gestionarAdelantos:false,aprobarMovimiento:false}),before=copy(f.state.sisventas);await assert.rejects(write(f,command(f,{[advancePath+'/periodoDescuento']:'2026-10'})),error=>error.code==='SV_ADVANCE_PERIOD_PERMISSION_DENIED');unchanged(f,before);
});
for(const module of ['ctaemp'])test('the new paid month cannot bypass blocked '+module+' module',async()=>{
 const f=roleFixture('tecnico',{aprobarMovimiento:true});f.state.sv_permisos.tecnico.indiceModulos[module]=false;const before=copy(f.state.sisventas);await assert.rejects(write(f,command(f,{[advancePath+'/periodoDescuento']:'2026-10'})));unchanged(f,before);
});
test('CTA-only keeps the existing approval action while Empleados-only cannot substitute Bonificar for it',async()=>{
 const cta=roleFixture('tecnico',{aprobarMovimiento:true});cta.state.sv_permisos.tecnico.indiceModulos.empleados=false;cta.state.sv_permisos.tecnico.bloqueados=['empleados'];await write(cta,command(cta,{[advancePath+'/periodoDescuento']:'2026-10'}));assert.equal(cta.get(advancePath+'/periodoDescuento'),'2026-10');
 const employees=roleFixture('tecnico',{bonificar:true,aprobarMovimiento:true});employees.state.sv_permisos.tecnico.indiceModulos.ctaemp=false;const before=copy(employees.state.sisventas);await assert.rejects(write(employees,command(employees,{[advancePath+'/periodoDescuento']:'2026-10'})),error=>error.code==='SV_ADVANCE_PERIOD_PERMISSION_DENIED');unchanged(employees,before);
});
test('no CTA module, an invalid index version or a nonboolean override cannot choose a paid month',async()=>{
 for(const mode of ['none','version','override']){const f=roleFixture('admin',{bonificar:true,gestionarAdelantos:false,aprobarMovimiento:false});if(mode==='none'){f.state.sv_permisos.admin.indiceModulos.ctaemp=false;f.state.sv_permisos.admin.indiceModulos.empleados=false;}if(mode==='version')f.state.sv_permisos.admin.indiceVersion=1;if(mode==='override')f.state.sv_permisos.admin.acciones.empleados.gestionarAdelantos='true';const before=copy(f.state.sisventas);await assert.rejects(write(f,command(f,{[advancePath+'/periodoDescuento']:'2026-10'})));unchanged(f,before);}
});
for(const payment of [{monto:100},{monto:'100 legacy'},{monto:100,anulado:'false'},{monto:100,estado:'cancelada'}])test('legacy active array payment evidence requires paid-month permission '+JSON.stringify(payment),async()=>{
 const f=roleFixture('tecnico',{bonificar:true,gestionarAdelantos:false,aprobarMovimiento:false},{estado:'aprobado',montoPagado:0,fechaPago:'2026-10-14',gastoFbKey:'advance-expense',pagos:[payment]}),before=copy(f.state.sisventas);assert.equal(Policy.delivered(f.get(advancePath)),true);await assert.rejects(write(f,command(f,{[advancePath+'/periodoDescuento']:'2026-10'})),error=>error.code==='SV_ADVANCE_PERIOD_PERMISSION_DENIED');unchanged(f,before);
});
test('a truly annulled payment alone is not a delivered amount and historical paid markers remain conservative',()=>{
 assert.equal(Policy.delivered({estado:'pendiente',montoPagado:0,fechaPago:'2026-10-14',gastoFbKey:'g',pagos:[{monto:100,anulado:true}]}),false);assert.equal(Policy.delivered({estado:'pendiente',montoPagado:0,fechaPago:'2026-10-14',gastoFbKey:'g',pagos:[{monto:100,estado:'Anulado'}]}),false);assert.equal(Policy.delivered({estado:'aprobado',montoPagado:'100 legacy',fechaPago:'2026-10-14',gastoFbKey:'g',pagos:[]}),true);
});
test('new paid explicit month cannot be selected through only Bonificar, even with no old record',async()=>{
 const f=roleFixture(),before=copy(f.state.sisventas);await assert.rejects(write(f,{id:'advance-newpaid-bonus-only',kind:'set',path:account+'/new',value:advance({periodoDescuento:'2026-10'})}),error=>error.code==='SV_ADVANCE_PERIOD_PERMISSION_DENIED');unchanged(f,before);
});
test('unpaid request can select a month; delivering it with that same explicit month requires its approval action',async()=>{
 const f=roleFixture(),request=advance({estado:'pendiente',montoPagado:0,pagos:{},fechaPago:null,periodoDescuento:'2026-10'});await write(f,{id:'advance-pending-period-fixture',kind:'set',path:account+'/new',value:request});assert.equal(f.get(account+'/new/periodoDescuento'),'2026-10');assert.ok(!f.reads.some(([,path])=>path.startsWith('sv_permisos/')));
 const before=copy(f.state.sisventas);const body=command(f,{[account+'/new/estado']:'pagado',[account+'/new/montoPagado']:100,[account+'/new/pagos/p']:{monto:100,fecha:'2026-10-14'},[account+'/new/fechaPago']:'2026-10-14'});const count=f.commits.length;await assert.rejects(write(f,body),error=>error.code==='SV_ADVANCE_PERIOD_PERMISSION_DENIED');assert.deepEqual(f.state.sisventas,before);assert.equal(f.commits.length,count);
});
test('first delivery cannot materialize a pending request default to bypass the existing approval action',async()=>{
 const f=roleFixture('tecnico',{bonificar:true,gestionarAdelantos:false,aprobarMovimiento:false},{estado:'pendiente',montoPagado:0,pagos:{},fechaPago:null,periodoDescuento:undefined}),body=command(f,{[advancePath+'/estado']:'pagado',[advancePath+'/periodoDescuento']:'2026-11',[advancePath+'/montoPagado']:100,[advancePath+'/fechaPago']:'2026-10-14',[advancePath+'/pagos/p']:{monto:100,fecha:'2026-10-14'}}),before=copy(f.state.sisventas);await assert.rejects(write(f,body),error=>error.code==='SV_ADVANCE_PERIOD_PERMISSION_DENIED');unchanged(f,before);
});
test('a normal paid medium correction with the same period opens no new permission reads',async()=>{
 const f=roleFixture();await write(f,command(f,{[advancePath+'/pagos/p/medio']:'Tarjeta'}));assert.ok(!f.reads.some(([,path])=>path==='sv_chat_roles/u'||path.startsWith('sv_permisos/')));assert.equal(f.commits.length,1);
});
test('materializing the exact original legacy default does not choose another month or require another action',async()=>{
 const f=roleFixture('tecnico',{registrarHaberes:true,gestionarAdelantos:false,aprobarMovimiento:false},{periodoDescuento:undefined});await write(f,command(f,{[advancePath+'/periodoDescuento']:'2026-11'}));assert.equal(f.get(advancePath+'/periodoDescuento'),'2026-11');assert.ok(!f.reads.some(([,path])=>path==='sv_chat_roles/u'||path.startsWith('sv_permisos/')));
});
for(const mode of ['permission','revision','role','inactive'])test('new paid period revalidation rejects '+mode+' change before the only PATCH',async()=>{
 const f=roleFixture('tecnico',{aprobarMovimiento:true}),before=copy(f.state.sisventas),read=f.store.read;let roleReads=0,permissionReads=0;
 f.store.read=async path=>{if(path==='sv_permisos/tecnico'&&++permissionReads===2){if(mode==='permission')f.state.sv_permisos.tecnico.acciones.empleados.aprobarMovimiento=false;if(mode==='revision')f.state.sv_permisos.tecnico.indiceRevision++;}if(path==='sv_chat_roles/u'&&++roleReads===2){if(mode==='role')f.state.sv_chat_roles.u.rol='admin';if(mode==='inactive')f.state.sv_chat_roles.u.activo=false;}return read(path);};
 await assert.rejects(write(f,command(f,{[advancePath+'/periodoDescuento']:'2026-10'})),error=>error.code==='SV_LABOR_AUTH_CHANGED');unchanged(f,before);
});
test('a failed fresh permission read rejects the month change without leaving another read running',async()=>{
 const f=roleFixture('tecnico',{aprobarMovimiento:true}),before=copy(f.state.sisventas),read=f.store.read;let count=0,profileReads=0;
 f.store.read=async path=>{if(path==='sv_chat_roles/u')profileReads++;if(path==='sv_permisos/tecnico'&&++count===2)throw Error('Fallo ficticio');return read(path);};await assert.rejects(write(f,command(f,{[advancePath+'/periodoDescuento']:'2026-10'})),error=>error.code==='SV_ADVANCE_PERIOD_PERMISSION_UNCONFIRMED');unchanged(f,before);assert.equal(profileReads,2);
});
test('permission callback does not extend the lease; expiry during its fresh reads prevents commit',async()=>{
 const f=roleFixture('tecnico',{aprobarMovimiento:true}),before=copy(f.state.sisventas),read=f.store.read;let clock=0,profiles=0;
 f.store.read=async path=>{if(path==='sv_chat_roles/u'&&++profiles===2)clock=2000;return read(path);};const guard=createLaborGuard({store:f.store,now:()=>clock,leaseMs:1000,uuid:()=> 'advance-period-expired-lease',delay:async()=>{}}),gateway=createLaborWriteGateway({guard,store:f.store,auth:{},db:{},enabled:true});await assert.rejects(gateway.write(actor,command(f,{[advancePath+'/periodoDescuento']:'2026-10'})),error=>error.code==='SV_LABOR_LEASE_EXPIRED');unchanged(f,before);
});
test('a confirmed period replay returns its receipt without reapplying the field after a later revocation',async()=>{
 const f=roleFixture('tecnico',{aprobarMovimiento:true}),body=command(f,{[advancePath+'/periodoDescuento']:'2026-10'});await write(f,body);f.state.sv_permisos.tecnico.acciones.empleados.aprobarMovimiento=false;const reads=f.reads.length;await write(f,body);assert.equal(f.commits.length,1);assert.equal(f.get(advancePath+'/periodoDescuento'),'2026-10');assert.equal(f.reads.length,reads+1,'Only the preexisting receipt lookup remains');
});
for(const chosen of [undefined,'2026-12'])test('native Haberes-only actor keeps a previously delivered legacy advance month '+chosen,async()=>{
 const legacy={tipo:'adelanto',monto:100,estado:'aprobado',fecha:'2026-10-14'};if(chosen)legacy.periodoDescuento=chosen;
 const f=createBackend({ctaemp:{e:{advance:legacy}},gastos:{},haberes:{},config:{cargos:{c:{nombre:'Cargo ficticio',valorHora:5,diasMes:25}}}});f.state.sv_chat_roles.u.rol='tecnico';f.state.sv_permisos=Permissions.build({tecnico:{acciones:{empleados:{registrarHaberes:true,bonificar:false,gestionarAdelantos:false,aprobarMovimiento:false,verCuentas:false}},bloqueados:['gastos','ctaemp','configuracion','comisiones']}});
 const bootstrap=require('../cotizador/employee-account-view-bootstrap'),Monthly=require('../cotizador/employee-monthly-payroll'),Client=require('../js/modules/employee-monthly-payroll'),snapshot={ctaemp:f.get('sisventas/ctaemp'),gastos:f.get('sisventas/gastos'),pagos_realizados:null,auditoria_pagos:null,empleados:f.get('sisventas/empleados'),cargos:f.get('sisventas/config/cargos')},plan=bootstrap.build(snapshot,{employeeIds:['e']});assert.equal(plan.complete,true,JSON.stringify(plan.issues));f.state.sv_employee_account_views={v1:plan.views};f.state.sv_labor_config.employeeAccountViews={schema:1,enabled:true};
 const page=f.page(),c=page.context;c.currentRole='tecnico';c.PERMISOS_ROLES=f.state.sv_permisos;c.empData={e:{fbKey:'e',nombre:'Persona ficticia',cargoId:'c'}};c.CARGOS_DATA={};c.escapeHTML=value=>String(value).replace(/[<>]/g,'');c.tienePermiso=name=>name==='empleados.registrarHaberes';c.permisoModulo=name=>f.state.sv_permisos.tecnico.indiceModulos[name]===true;c.svCapturarContextoOperacion=()=>()=>c.currentRole==='tecnico'&&c.currentUserUid==='u';const month=chosen||'2026-11';
 c.SVForegroundSession.isVisible=()=>true;c.document.body={style:{overflow:''}};c.document.activeElement=null;c.document.hidden=false;c.document.visibilityState='visible';const modal=page.node('modal-haberes-mes'),controls=[page.node('hab-mes-sel'),page.node('hab-confirmar-btn')];for(const node of [modal,...controls]){node.setAttribute=function(){};node.focus=()=>{c.document.activeElement=node;};node.getClientRects=()=>[{}];node.addEventListener=function(){};}modal.querySelectorAll=q=>q.includes('abrirConfiguracion')?[]:controls;modal.contains=node=>node===modal||controls.includes(node);controls[0].value=month;c._habFilasActuales=[];c._renderTablaHaberes=()=>'';
 vm.runInContext(functionSource('svRevisionMetaEmpleado'),c);const userRead=f.store.readAsUser;f.store.readAsUser=async(path,identity)=>{assert.ok(path.startsWith('sv_employee_account_views/v1/globalEmployeeDirectory/rows/')&&path.endsWith('/meta'),'Only employee metadata, no raw salary read');return userRead(path,identity);};const service=Monthly.createEmployeeMonthlyPayrollCommands({authorize:async()=>actor,guard:f.guard,store:f.store});
 c.fetch=async(url,options)=>{assert.equal(url,'https://gateway.invalid/laboral/liquidacion/comando');const body=JSON.parse(options.body),result=await service.execute(actor,body);return{ok:true,status:200,json:async()=>copy(result)};};c.SVPayrollMonthly=Client.create(c);c._habCrearFilas=mes=>c.SVPayrollMonthly.rows(mes);assert.equal(await c.SVPayrollMonthly.attach(modal),true,page.node('hab-tabla-body').innerHTML);assert.equal(c._habFilasActuales[0].sueldo,1000);await c._registrarHaberesAtomico(c._habFilasActuales,month,month+'-01','mes ficticio');
 assert.equal(f.get(advancePath+'/montoCompensado'),100);assert.equal(f.get(advancePath+'/periodoDescuento'),chosen??null);const expense=f.get('sisventas/gastos/adelanto_e_advance');assert.deepEqual(expense.pagos,f.get(advancePath+'/pagos'));assert.equal(Object.values(expense.pagos)[0].monto,100);assert.equal(expense.periodoDescuento,chosen||'2026-11');assert.equal(f.commits.length,1);assert.equal(f.state.sv_permisos.tecnico.acciones.empleados.gestionarAdelantos,false);assert.equal(f.state.sv_permisos.tecnico.acciones.empleados.aprobarMovimiento,false);assert.ok(f.reads.some(([,path])=>path==='sv_permisos/tecnico'),'The explicit command rechecks its own authority');assert.ok(!f.reads.some(([kind,path])=>kind==='client'&&path.startsWith('sisventas/')),'Frontend only obtains employee META; salary comes from authorized preview');noGlobal(f);c.SVPayrollMonthly.close(true);
});

function legacyProjection(f,id='adelanto_e_advance',money=100){
 const original=f.get(advancePath),payment={fecha:'2026-10-14',monto:money,medio:'Sin especificar',concepto:'adelanto',usuario:'Histórico ficticio',rol:'admin',ts:1,origen:'compatibilidad_legacy'},payments={pago_legacy_advance:payment},expensePath='sisventas/gastos/'+id;
 const expense={fecha:'2026-10-14',periodoDescuento:Policy.discountPeriod(original),tipo:'Variable',tipoPagable:'adelanto',monto:money,montoPagado:money,estado:'pagado',medio:'Sin especificar',pagos:copy(payments),empleadoId:'e',empleadoFbKey:'e',origen:'adelanto_personal_legacy',origenLegacy:'ctaemp',legacyKey:'ctaemp/e/advance'};
 return command(f,{[advancePath+'/estado']:'pagado',[advancePath+'/montoPagado']:money,[advancePath+'/fechaPago']:'2026-10-14',[advancePath+'/medioPago']:'Sin especificar',[advancePath+'/pagos']:payments,[advancePath+'/gastoFbKey']:id,[expensePath]:expense},[account,expensePath]);
}
function legacyProjectionFixture(){return roleFixture('tecnico',{bonificar:true,gestionarAdelantos:false,aprobarMovimiento:false},{estado:'aprobado',montoPagado:0,fechaPago:null,gastoFbKey:null,pagos:{},periodoDescuento:'2026-11'});}
for(const mode of ['duplicate-id','wrong-after-link','already-linked','inflated-principal','inflated-synthetic-payment'])test('a copied legacy projection cannot bypass the field permission via '+mode,async()=>{
 const f=legacyProjectionFixture();if(mode==='already-linked')apply(f.state,{[advancePath+'/gastoFbKey']:'other-expense'});const body=legacyProjection(f,mode==='duplicate-id'?'duplicate':'adelanto_e_advance',mode==='inflated-principal'||mode==='inflated-synthetic-payment'?200:100);
 if(mode==='wrong-after-link')body.value[advancePath+'/gastoFbKey']='other-expense';if(mode==='inflated-principal')body.value[advancePath+'/monto']=200;if(mode==='inflated-synthetic-payment')body.value['sisventas/gastos/adelanto_e_advance'].monto=100;
 const before=copy(f.state.sisventas);await assert.rejects(write(f,body),error=>error.code==='SV_ADVANCE_PERIOD_PERMISSION_DENIED');unchanged(f,before);noGlobal(f);
});
test('an existing expense cannot swap its legacy key to copy another advance period without the correct action',async()=>{
 const f=roleFixture();apply(f.state,{[account+'/older']:advance({gastoFbKey:'older-expense',periodoDescuento:'2026-10'})});const path='sisventas/gastos/advance-expense',before=copy(f.state.sisventas),body=command(f,{[path+'/periodoDescuento']:'2026-10',[path+'/legacyKey']:'ctaemp/e/older'},[account,path]);await assert.rejects(write(f,body),error=>error.code==='SV_ADVANCE_PERIOD_PERMISSION_DENIED');unchanged(f,before);
});
