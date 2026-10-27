'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {readSalePoint}=require('../cotizador/sale-point-read');
const Index=require('../cotizador/payment-membership-index');
const {memoryDB}=require('./helpers/private-finance-fixtures.cjs');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs');
const {createCommercialOwnership}=require('../cotizador/commercial-ownership');
function setup(extra=0){
 const sales={old:{id:'V-OLD',responsableUid:'a',fecha:'2024-01-01',cliente:'Cliente ficticio',conIva:false,total:10000,items:[{codigo:'P-1',desc:'Equipo ficticio',qty:1,punit:10000,sub:10000}],factura:{pdf:'PRIVATE'},comisionMonto:999}};
 for(let n=0;n<extra;n++)sales['unrelated-'+n]={id:'V-'+n,fecha:'2026-10-01',total:1000,items:[{desc:'No solicitado'}]};
 const payments={p:{ventaFbKey:'old',monto:3000,fecha:'2026-10-27'},cancel:{ventaFbKey:'old',monto:1000,anulado:true},other:{ventaFbKey:'unrelated-1',monto:50}};
 const root={sisventas:{ventas:sales,pagos:payments}},built=Index.buildIndex(payments,{generation:'fixture-generation',ready:true});
 const db=memoryDB(root);for(const [p,v]of Object.entries(built.patch)){let node=db.root,parts=p.split('/');for(const part of parts.slice(0,-1))node=node[part]??={};node[parts.at(-1)]=v;}
 const reads=[];let changed;
 const read=async p=>{assert.ok(!['sisventas/ventas','sisventas/pagos','sisventas/presupuestos'].includes(p),'no full-history root');reads.push(p);const value=(await db.ref(p).get()).val();if(changed)await changed(p);return value;};
 const options={read,actor:{uid:'a',claims:{uid:'a'}},id:'old',authorizeSale:async r=>{if(!r||r.responsableUid!=='a')throw Object.assign(Error('denied'),{statusCode:404});},canPayments:true,revalidate:async()=>{}};
 return {db,reads,options,setHook:f=>{changed=f;}};
}
test('venta de hace años con cobro actual mantiene saldo, sin entregar otras ventas/documentos',async()=>{const t=setup(10000),r=await readSalePoint(t.options);assert.deepEqual(r.account,{status:'ready',total:10000,paid:3000,balance:7000});assert.equal(r.record.fbKey,'old');assert.equal(r.payments.length,1);assert.equal(r.record.factura,undefined);assert.equal(r.record.comisionMonto,undefined);assert.ok(t.reads.length<20);});
test('el volumen ajeno no amplía lecturas ni cuerpo del detalle',async()=>{const a=setup(1),b=setup(10000),x=await readSalePoint(a.options),y=await readSalePoint(b.options);assert.deepEqual(x,y);assert.deepEqual(a.reads,b.reads);});
test('cobros sin cobertura fallan, no muestran cero ni leen raíz como alternativa',async()=>{const t=setup();t.db.root.sv_labor_indexes.paymentRefs_v1.coverage=null;await assert.rejects(readSalePoint(t.options),e=>e.statusCode===503);});
test('revocación no entrega un resultado tardío',async()=>{const t=setup();t.options.revalidate=async()=>{throw Object.assign(Error('revoked'),{statusCode:403});};await assert.rejects(readSalePoint(t.options),{statusCode:403});});
test('cambio concurrente de venta retira resultado',async()=>{const t=setup();t.options.revalidate=async()=>{t.db.root.sisventas.ventas.old.total=20000;};await assert.rejects(readSalePoint(t.options),{statusCode:409});});
test('sin permiso de cobros muestra desconocido, no saldo ficticio',async()=>{const t=setup();t.options.canPayments=false;const r=await readSalePoint(t.options);assert.deepEqual(r.account,{status:'unavailable'});assert.equal(t.reads.some(p=>p.includes('/pagos/')||p.includes('paymentRefs')),false);});
test('no escribe nada durante la consulta',async()=>{const t=setup(),before=structuredClone(t.db.root);await readSalePoint(t.options);assert.deepEqual(t.db.root,before);});
test('pagos embebidos y total legacy se conservan cuando no hay cobros globales',async()=>{for(const variant of ['embedded','legacy']){const t=setup();t.db.root.sisventas.pagos={};const built=Index.buildIndex({}, {generation:'fixture-empty-index',ready:true});t.db.root.sv_labor_indexes={paymentRefs_v1:{coverage:built.coverage}};const s=t.db.root.sisventas.ventas.old;if(variant==='embedded')s.pagos=[{monto:2500,fecha:'2020-01-01'}];else s.totalPagado=2500;assert.equal((await readSalePoint(t.options)).account.balance,7500);}});
test('todos los cobros globales anulados no resucitan copia legacy',async()=>{const t=setup();t.db.root.sisventas.pagos.p.anulado=true;t.db.root.sisventas.ventas.old.totalPagado=9000;assert.equal((await readSalePoint(t.options)).account.balance,10000);});
test('la consulta está apagada por defecto, y respeta propiedad al habilitarla',async()=>{const f=fixture();await assert.rejects(f.api.point(await f.auth('a'),'one'),{statusCode:503});const api=createCommercialOwnership({db:f.db,auth:{verifyIdToken:async uid=>({uid})},enabled:true,pointReadsEnabled:true,pointReader:readSalePoint}),actor=await api.authorize({headers:{authorization:'Bearer b'}},'ventas');await assert.rejects(api.point(actor,'one'),{statusCode:404});});
test('Ver como y reset no se convierten en lectura privilegiada',async()=>{for(const patch of [{viewing:true},{claims:{uid:'a',svPasswordChangeRequired:true}}]){const t=setup();Object.assign(t.options.actor,patch);await assert.rejects(readSalePoint(t.options),{statusCode:403});assert.equal(t.reads.length,0);}});


test('alias comercial sin vínculo técnico no revela un cobro potencialmente ambiguo',async()=>{const t=setup();const pay=t.db.root.sisventas.pagos.p;delete pay.ventaFbKey;pay.ventaId='V-OLD';const built=Index.buildIndex(t.db.root.sisventas.pagos,{generation:'fixture-legacy-index',ready:true});t.db.root.sv_labor_indexes.paymentRefs_v1={};for(const [p,v]of Object.entries(built.patch)){let node=t.db.root,parts=p.split('/');for(const part of parts.slice(0,-1))node=node[part]??={};node[parts.at(-1)]=v;}await assert.rejects(readSalePoint(t.options),{statusCode:503});});
