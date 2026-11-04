'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createLaborRuntime}=require('../cotizador/labor-runtime');
const index=fs.readFileSync('cotizador/index.js','utf8'),start=index.indexOf("else if(req.method==='POST'&&['reasignar','preparar'].includes(match[2]))"),end=index.indexOf('\n      else{send(res,405',start);
assert(start>=0&&end>start,'actual HTTP mutation branch must be present');
const branch=index.slice(start,end).replace(/^else if/,'if'),AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const dispatch=new AsyncFunction('req','match','actor','laborRuntime','commercialOwnership','readBody','let result;'+branch+';return result;');
test('both actual HTTP commercial mutation domains pass through the shared runtime entrypoint',async()=>{
 for(const domain of ['ventas','presupuestos'])for(const operation of ['preparar','reasignar']){
  const calls=[],actor={uid:'fictitious',domain},body={id:'fixture',uid:'other'},method=operation==='preparar'?'prepare':'assign';
  const ownership={[method]:async(a,b)=>{assert.equal(a,actor);assert.equal(b,body);calls.push('work');return{record:{id:'fixture'}};}};
  const runtime={commercialMutation:async(a,m,b,work)=>{assert.equal(a,actor);assert.equal(m,method);assert.equal(b,body);calls.push('runtime');return work();},run(){assert.fail('HTTP cannot bypass the complete mutation entrypoint');}};
  const result=await dispatch({method:'POST'},[null,domain,operation],actor,runtime,ownership,async()=>body);assert.deepEqual(result,{record:{id:'fixture'}});assert.deepEqual(calls,['runtime','work']);
 }
});
test('unsupported mutation methods and domain fail before work or network',()=>{
 const runtime=createLaborRuntime({enabled:false,clientAccounts:false,clientHistory:false,db:{},databaseURL:'https://fixture.invalid',accessToken:async()=>{assert.fail('No network');}});
 for(const [domain,method]of [['ventas','delete'],['gastos','assign'],['presupuestos','other']])assert.throws(()=>runtime.commercialMutation({domain},method,{},()=>assert.fail('No work')),{statusCode:400});
});
test('account or history configuration cannot start with the shared writer disabled',()=>{
 for(const flags of [{clientAccounts:true,clientHistory:false},{clientAccounts:false,clientHistory:true}])assert.throws(()=>createLaborRuntime({enabled:false,...flags}),/guardado coordinado/);
});
