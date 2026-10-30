'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{build}=require('../scripts/lib/sale-create-preflight-rules.cjs');
test('only adds an authorized null snapshot clause, never existing-sale or parent access',()=>{
 const before={rules:{sisventas:{ventas:{'.read':'adminOnly',$venta:{'.read':'ownerOnly','.write':'unchanged','.validate':'unchanged'}}},private:{'.read':false}}},saved=JSON.stringify(before),next=build(before);
 assert.equal(JSON.stringify(before),saved);assert.equal(next.rules.sisventas.ventas['.read'],'adminOnly');assert.equal(next.rules.sisventas.ventas.$venta['.write'],'unchanged');assert.equal(next.rules.sisventas.ventas.$venta['.validate'],'unchanged');
 assert.ok(next.rules.sisventas.ventas.$venta['.read'].startsWith('(ownerOnly || (!data.exists() && auth != null'));
 for(const s of ["child('activo')","child('venta')","child('crear')","svPasswordChangeRequired","sv_access_resets","svAccessVersion"])assert.ok(next.rules.sisventas.ventas.$venta['.read'].includes(s));
 assert.deepEqual(build(next),next);
});
test('refuses an unexpected rules schema',()=>assert.throws(()=>build({rules:{}})));
