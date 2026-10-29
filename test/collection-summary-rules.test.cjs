'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Policy=require('../cotizador/labor-fence-policy'),Rules=require('../scripts/prepare-collection-summary-rules.cjs');
function fixture(){const old=Policy.childRule(4,"auth != null && auth.token.svPasswordChangeRequired !== true && data.parent().child('responsableUid').val() === auth.uid");return {rules:{'.write':false,sisventas:{'.write':false,ventas:{'.read':'false','.write':'false',$venta:{'.read':"data.child('responsableUid').val() === auth.uid",'.write':'false',totalPagado:{'.write':old},estadoPago:{'.write':old}}}},privateDomain:{'.read':'false'}}};}
test('sólo añade resumen bajo comando financiero firmado; conserva lectura y edición comercial',()=>{
 const before=fixture(),after=Rules.prepare(before,{expectedHash:Rules.hash(before)}),clean=structuredClone(after);
 for(const field of ['totalPagado','estadoPago']){const rule=after.rules.sisventas.ventas.$venta[field]['.write'];assert.ok(rule.startsWith('('+before.rules.sisventas.ventas.$venta[field]['.write']+') || '));for(const marker of ['svFinancialAction','cobranzas.registrar','cobranzas.anular','svFinancialPermissionRevision','svPasswordChangeRequired','expiresAt','sv_labor_receipts'])assert.ok(rule.includes(marker),marker);clean.rules.sisventas.ventas.$venta[field]=before.rules.sisventas.ventas.$venta[field];}
 assert.deepEqual(clean,before);assert.deepEqual(before,fixture());
});
test('rechaza base distinta, concesión raíz, regla desconocida y repetición',()=>{
 const before=fixture();assert.throws(()=>Rules.prepare(before,{expectedHash:'0'.repeat(64)}));
 for(const mutate of [x=>x.rules['.write']='auth != null',x=>x.rules.sisventas.ventas.$venta.totalPagado['.write']='true']){const x=fixture();mutate(x);assert.throws(()=>Rules.prepare(x,{expectedHash:Rules.hash(x)}));}
 const next=Rules.prepare(before,{expectedHash:Rules.hash(before)});assert.throws(()=>Rules.prepare(next,{expectedHash:Rules.hash(next)}));
});

test('restricción de escritores conserva recibos y permisos ya publicados',()=>{
 const Writers=require('../scripts/prepare-payment-writer-rules.cjs'),before=fixture(),metadata=Policy.metadataRules();
 before.rules.sv_labor_indexes=metadata.sv_labor_indexes;before.rules.sv_labor_receipts={'.write':'conservar regla ya revisada'};
 before.rules.sisventas.gastos={'.write':'conservar regla ya revisada'};before.rules.sisventas.pagos={'.read':'auth != null','.write':Policy.financialRule(2,'auth != null && auth.token.svPasswordChangeRequired !== true')};
 const after=Writers.prepare(before,{expectedHash:Writers.hash(before)}),clean=structuredClone(after);
 assert.ok(after.rules.sisventas.pagos['.write'].includes('svPaymentIndexVersion'));
 clean.rules.sisventas.pagos=before.rules.sisventas.pagos;clean.rules.sv_labor_indexes=before.rules.sv_labor_indexes;
 assert.deepEqual(clean,before);assert.throws(()=>Writers.prepare(after,{expectedHash:Writers.hash(after)}));
});
