'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../cotizador/labor-fence-policy'),{prepare}=require('../scripts/lib/purchase-manual-sdk-interlock.cjs');
const fixture=()=>({rules:{'.read':false,'.write':false,sisventas:{'.write':false,ordenes:{'.write':P.permissionsIdle+' && auth.uid === "authorized"','.read':'original-read','.validate':'original-validator'},inventario_operativo:{'.write':P.permissionsIdle+' && auth.uid === "authorized"'},compras_resumen:{'.write':false,ordenes:{'.write':P.permissionsIdle+' && auth.uid === "authorized"'},inventario_operativo:{'.write':P.permissionsIdle+' && auth.uid === "authorized"'}},ventas:{'.write':'original-sales'},$dominio:{'.write':'original-wildcard'}}}});
test('el ajuste conserva lecturas, validadores, autorización original y dominios ajenos',()=>{
 const base=fixture(),before=structuredClone(base),result=prepare(base);assert.deepEqual(base,before);assert.equal(result.rules.rules.sisventas.ordenes['.read'],'original-read');assert.equal(result.rules.rules.sisventas.ordenes['.validate'],'original-validator');assert.deepEqual(result.rules.rules.sisventas.ventas,before.rules.sisventas.ventas);
 const write=result.rules.rules.sisventas.ordenes['.write'];assert.match(write,/auth.uid === "authorized"/);assert.match(write,/svFinancialAction === 'ordenes.eliminar'/);assert.match(write,/svFinancialPermissionRevision/);assert.match(write,/expiresAt/);assert.match(result.rules.rules.sisventas.$dominio['.write'],/original-wildcard/);
});
test('no transforma autoridades padre o globales sin revisión',()=>{
 for(const type of ['root','sisventas','wildcard']){const input=fixture();if(type==='root')input.rules['.write']='auth != null';if(type==='sisventas')input.rules.sisventas['.write']='auth != null';if(type==='wildcard')input.rules.$any={'.write':'auth != null'};assert.throws(()=>prepare(input));}
});
