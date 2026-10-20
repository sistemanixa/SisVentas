'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createPersonalExpenses,identity}=require('../cotizador/personal-expenses');
const fields=['categoria','proveedor','medio','comprobante','vencimiento'];
const who={uid:'fixture',empleadoFbKey:'e',nombre:'Persona ficticia'},body={fecha:'2026-10-20',descripcion:'Reembolso ficticio',monto:12};
function fixture(gastos={}){
 let calls=0,data={empleados:{e:{activo:true,nombre:'Persona ficticia'}},gastos:structuredClone(gastos)};
 const api=createPersonalExpenses({now:()=>1,transaction:async update=>{calls++;const next=update(structuredClone(data));if(next)data=next;return {committed:!!next};}});
 return {api,get calls(){return calls;},get data(){return data;}};
}
for(const field of fields)test(field+' over 500 characters is rejected before any transaction or stored identity',async()=>{
 const f=fixture();await assert.rejects(f.api.submit(who,{...body,[field]:'x'.repeat(501)}),error=>error.statusCode===400&&error.message.includes(field));
 assert.equal(f.calls,0);assert.deepEqual(f.data.gastos,{});
});
test('500 original characters are preserved, and the key still uses the unchanged historical identity',async()=>{
 const f=fixture(),input={...body,...Object.fromEntries(fields.map(field=>[field,' '.repeat(1)+'x'.repeat(498)+' ']))};
 const saved=await f.api.submit(who,input),data=f.data.gastos[saved.key];
 assert.equal(f.calls,1);for(const field of fields)assert.equal(data[field],input[field]);
 const expected='gasto_'+crypto.createHash('sha256').update(identity({...input,tipo:'Variable',empleadoId:'e'})).digest('hex');assert.equal(saved.key,expected);
});
test('existing records are not normalized, truncated, or rewritten by a rejected new input',async()=>{
 const existing={proveedor:'x'.repeat(900),monto:12,nota:'histórico ficticio'},f=fixture({legacy:existing}),before=structuredClone(f.data);
 await assert.rejects(f.api.submit(who,{...body,proveedor:existing.proveedor}),{statusCode:400});
 assert.equal(f.calls,0);assert.deepEqual(f.data,before);
});
