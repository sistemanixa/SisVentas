'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
test('read-only credentials retain operational fields without requiring the editor',async()=>{
 const filename=require.resolve('./client-history-credentials-host.test.cjs'),source=fs.readFileSync(filename,'utf8'),context={require:createRequire(filename),module:{exports:{}},structuredClone};
 vm.runInNewContext(source.slice(0,source.indexOf("\ntest('"))+'\nmodule.exports=fixture;',context,{filename});
 const fixture=context.module.exports();fixture.root.edit=false;Object.assign(fixture.data['sisventas/credencialesPorCliente/a'].same,{ip:'192.0.2.10',puerto:'8443',serie:'FIXTURE-SERIAL',notas:'Fictitious read-only note'});await fixture.host.open();
 const text=fixture.node('hc-cred-lista').text;
 for(const expected of ['192.0.2.10','8443','FIXTURE-SERIAL','Fictitious read-only note'])assert.ok(text.includes(expected),'Missing authorized read-only field '+expected);
});
