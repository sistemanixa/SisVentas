'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs');
const Financial=require('../cotizador/sale-financial-dependencies-model'),Provider=require('../cotizador/sale-financial-dependencies-provider');
const {createLaborDb}=require('../cotizador/labor-db'),{createScopedTransaction}=require('../cotizador/labor-scoped-transaction');
const {createCommissionGeneration}=require('../cotizador/commission-generation');
async function fixture(){
 const sale={id:'V-FIRST',responsableUid:'u',clienteFbKey:'c',fecha:'2026-11-01',empleadoFbKey:'e',comisionHabilitada:true,subtotal:100,descuento:0,iva:0,conIva:false,total:100,items:[{cod:'P',qty:1,punit:100,disc:0,sub:100,costoUnitarioPresupuestado:20,costoUnitarioCompra:20,costoTotalCompra:20}]};
 const f=await createCoordinatedBackend({ventas:{s:sale},ctaemp:{},pagos:{p:{ventaFbKey:'s',monto:100,ts:2000}},config:{maxComisionPct:10,comisionesEmpleados:{e:{pct:10}}}});
 apply(f.state,(await Financial.prepare({ventas:{s:sale},gastos:{},ctaemp:{},comisiones_generacion:{},sv_commission_generation:{}},{generation:'first-account'})).patch);
 f.store.query=async(path,field,value)=>{f.reads.push(['query',path]);return Object.fromEntries(Object.entries(f.get(path)||{}).filter(([,row])=>row?.[field]===value));};
 const raw=[];
 function ref(path=''){return {key:path.split('/').at(-1),toString:()=> 'https://fixture.invalid/'+path,child:key=>ref(path+'/'+key),get:async()=>{raw.push(path);throw Error('Unexpected raw read');},on(){throw Error('Unexpected raw listener');},off(){},transaction(){throw Error('Unexpected raw write');},orderByChild:field=>({equalTo:value=>({toString:()=> 'https://fixture.invalid/'+path,get(){throw Error('Unexpected raw query');}})})};}
 const db=createLaborDb({db:{ref},guard:f.guard});return {...f,db,raw,evidence:()=>Provider.create()({saleKey:'s',read:async path=>f.get(path)})};
}
const actor={uid:'sv-labor-service',mode:'server',operation:'first-account'};
test('real commission generation creates first account with financial delta in one coordinated commit',async()=>{
 const f=await fixture(),service=createCommissionGeneration({db:f.db,commercial:{assertRecord:async()=>{}},enabled:true,now:()=>200000});
 await f.guard.run(actor,async()=>{assert.equal(f.get('sisventas/ctaemp/e'),null);const result=await service.generate({uid:'u'},{ventaFbKey:'s'});assert.equal(result.status,'generada');return result;});
 assert.equal(f.commits.length,1);assert.equal(Object.keys(f.get('sisventas/ctaemp/e')).length,1);assert.equal((await f.evidence()).dependencies.length,4);assert.deepEqual(f.raw,[]);
 assert(!Object.hasOwn(f.commits[0],'sisventas/ctaemp/e'));assert(f.commits[0][Financial.ROOT+'/coverage']);
});
test('account transaction emits individual movements from retained null before image and preserves in-place edits',async()=>{
 const f=await fixture(),movement={tipo:'comision',ventaFbKey:'s',monto:8};
 await f.guard.run(actor,async()=>{const result=await f.db.ref('sisventas/ctaemp/e').transaction(current=>{assert.equal(current,null);return {m:movement};});assert.equal(result.committed,true);return {ok:true};});
 assert.equal(f.commits.length,1);assert.deepEqual(f.commits[0]['sisventas/ctaemp/e/m'],movement);assert(!Object.hasOwn(f.commits[0],'sisventas/ctaemp/e'));assert.equal((await f.evidence()).dependencies.length,1);
 await f.guard.run(actor,async()=>{await f.db.ref('sisventas/ctaemp/e').transaction(current=>{current.m.monto=9;return current;});return {ok:true};});
 assert.equal(f.get('sisventas/ctaemp/e/m/monto'),9);assert.equal((await f.evidence()).dependencies.length,1);assert.deepEqual(f.raw,[]);
 assert(!f.reads.some(([,path])=>['sisventas/ctaemp','sisventas/gastos'].includes(path)));
});
test('scoped transaction emits first permitted commission movement without employee parent',async()=>{
 const f=await fixture(),g={tipo:'comision',ventaFbKey:'s',ventaId:'V-FIRST',legacyKey:'ctaemp/e/m',monto:8,pct:10,gananciaBase:80},group=require('../cotizador/commission-calculations').claveGrupo({...g,fbKey:'g'});
 // Seed through the real guard so the prepared financial certificate stays current.
 await f.guard.run(actor,async scope=>{await scope.update({'sisventas/gastos/g':g});return {ok:true};});
 const transaction=createScopedTransaction({guard:f.guard});
 await transaction(root=>{root.ctaemp.e={m:{tipo:'comision',ventaFbKey:'s',monto:8}};return root;},{kind:'redistribuir-comisiones',identity:{uid:'u',claims:{uid:'u'},role:'admin',permissionDigest:require('../cotizador/labor-guard').digest({})},body:{grupo:{clave:group}}});
 assert.equal(f.commits.length,2);assert(f.commits[1]['sisventas/ctaemp/e/m']);assert(!Object.hasOwn(f.commits[1],'sisventas/ctaemp/e'));assert.equal((await f.evidence()).dependencies.length,2);
});
test('direct employee-parent replacements remain rejected with prepared financial index',async()=>{
 const f=await fixture();await assert.rejects(f.guard.run(actor,async()=>{await f.db.ref('sisventas/ctaemp/e').set({m:{tipo:'comision',ventaFbKey:'s',monto:8}});return {ok:true};}));assert.equal(f.commits.length,0);assert.equal(f.get('sisventas/ctaemp/e'),null);
});
test('account diff removes only the changed movement and preserves untouched precision',async()=>{
 const f=await fixture(),retained={tipo:'bonificacion',monto:7.351};
 await f.guard.run(actor,async()=>{await f.db.ref('sisventas/ctaemp/e').transaction(()=>({a:{tipo:'comision',ventaFbKey:'s',monto:8},b:retained}));return {ok:true};});
 await f.guard.run(actor,async()=>{await f.db.ref('sisventas/ctaemp/e').transaction(current=>{delete current.a;return current;});return {ok:true};});
 assert.equal(f.commits[1]['sisventas/ctaemp/e/a'],null);assert(!Object.hasOwn(f.commits[1],'sisventas/ctaemp/e/b'));assert.deepEqual(f.get('sisventas/ctaemp/e/b'),retained);assert.equal((await f.evidence()).dependencies.length,0);assert.deepEqual(f.raw,[]);
});
