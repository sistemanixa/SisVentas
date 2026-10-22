'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../cotizador/payment-index-preparation'),I=require('../cotizador/payment-membership-index');
const {apply,copy}=require('./helpers/labor-ui-flow.cjs');
const {restrict,hash,writer}=require('../scripts/prepare-payment-index-rules.cjs');
const {build}=require('../scripts/prepare-labor-fence-rules.cjs');
const generation='synthetic-generation';
test('preparación ficticia conserva negocio y nunca emite ready por construir',()=>{
 for(const payments of [null,{}, {'0':{ventaFbKey:'v',monto:1},'1':{venta:'V-1',monto:2}}]){
  const before=copy(payments),p=P.plan(payments,{generation}),saved={};apply(saved,p.patch);assert.equal(p.coverage.ready,false);assert.deepEqual(payments,before);
  const checked=P.verify(payments,saved.sv_labor_indexes.paymentRefs_v1,{generation});assert.equal(checked.coverage.ready,true);assert.equal(checked.sourceDigest,p.sourceDigest);assert.equal(p.coverage.ready,false);
 }
});
test('lectura incompleta, relación distinta y tamaño excesivo nunca acreditan cobertura',()=>{
 const data={p:{ventaFbKey:'v',monto:1}},p=P.plan(data,{generation}),saved={};apply(saved,p.patch);
 const missing=copy(saved.sv_labor_indexes.paymentRefs_v1);delete missing.byPayment.p;assert.throws(()=>P.verify(data,missing,{generation}),{statusCode:409});
 assert.throws(()=>P.verify({p:{ventaFbKey:'changed',monto:1}},saved.sv_labor_indexes.paymentRefs_v1,{generation}),{statusCode:409});
 assert.equal(P.plan(data,{generation,maxPatchBytes:1}).requiresStaging,true);assert.throws(()=>P.verify(data,saved.sv_labor_indexes.paymentRefs_v1,{generation,maxPatchBytes:1}),{statusCode:413});
});
test('reglas candidatas sólo restringen escritores; conservan permisos, índice y configuración anterior',()=>{
 const base=build({rules:{'.write':false,sisventas:{'.write':false,config:{'.write':false},pagos:{'.read':"auth != null",'.write':"auth.uid === 'admin'",'$id':{'.write':"auth.uid === 'owner'"}}}}}),before=copy(base),result=restrict(base,{expectedHash:hash(base)});
 assert.deepEqual(base,before);assert.equal(result.rules.sisventas.pagos['.read'],base.rules.sisventas.pagos['.read']);assert.deepEqual(result.rules.sv_labor_config,base.rules.sv_labor_config);assert.deepEqual(result.rules.sisventas.ventas,base.rules.sisventas.ventas);
 for(const node of [result.rules.sisventas.pagos,result.rules.sisventas.pagos.$id,result.rules.sv_labor_indexes])assert.ok(node['.write'].endsWith(writer));
 assert.throws(()=>restrict(base,{expectedHash:'0'.repeat(64)}),/inesperada/);assert.throws(()=>restrict(result),/base coordinada/);
});
