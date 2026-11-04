'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Cut=require('../scripts/lib/client-account-cut-rules.cjs');
function source(){return{rules:{'.read':false,'.write':false,sv_commercial_pages_config:{'.read':"auth != null && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && auth.token.svPasswordChangeRequired !== true"},sv_labor_indexes:{'.write':"auth.token.svLaborService === true && root.child('sv_labor_guard').exists()"},sv_usuarios:{'.indexOn':['login'],'.read':false,$record:{'.read':'existing private identity rule'}},sv_commercial_pages:{'.read':false,'.write':false,v1:{records:{payments:{$record:{'.read':"auth != null && root.child('sv_access_resets').exists() && root.child('cobranzas').val() === true"}}}}},sisventas:{pagos:{'.indexOn':['ventaFbKey'],'.write':'existing financial writer'},clientes:{$record:{'.write':'auth != null'}},gastos:{'.write':'existing expenses writer'}}}};}
test('composes paired rules and UID index without changing private identity grants or financial writers',()=>{
 const input=source(),before=structuredClone(input),result=Cut.prepare(input);assert.deepEqual(input,before);
 assert.deepEqual(result.rules.sv_usuarios['.indexOn'],['login','uid']);assert.equal(result.rules.sv_usuarios.$record['.read'],before.rules.sv_usuarios.$record['.read']);
 assert.equal(result.rules.sisventas.pagos['.write'],before.rules.sisventas.pagos['.write']);assert.deepEqual(result.rules.sisventas.gastos,before.rules.sisventas.gastos);
 assert(result.rules.sv_client_accounts);assert(result.rules.sv_commercial_pages.v1.records.collection);
 assert.match(result.rules.sisventas.clientes.$record['.write'],/sv_client_accounts_config/);
 assert.deepEqual(result.rules.sisventas.pagos['.indexOn'],['ventaFbKey','grupoPago']);
});
test('keeps existing UID index once and rejects an unknown index shape or missing Users',()=>{
 const input=source();input.rules.sv_usuarios['.indexOn']=['uid','login'];assert.deepEqual(Cut.prepare(input).rules.sv_usuarios['.indexOn'],['uid','login']);
 for(const value of [null,{},[17]]){const input=source();input.rules.sv_usuarios['.indexOn']=value;assert.throws(()=>Cut.prepare(input),/revisión/);}
 const missing=source();delete missing.rules.sv_usuarios;assert.throws(()=>Cut.prepare(missing),/Usuarios/);
});
test('cannot compose over preexisting account authority or a broad ancestor grant',()=>{
 const existing=source();existing.rules.sv_client_accounts={'.read':true};assert.throws(()=>Cut.prepare(existing));
 for(const key of ['.read','.write']){const broad=source();broad.rules[key]=true;assert.throws(()=>Cut.prepare(broad));}
});
