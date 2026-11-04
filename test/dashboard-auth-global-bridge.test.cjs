'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{readActiveApp}=require('./helpers/active-app');
test('Dashboard host reads the live lexical authentication state through a read-only global bridge',()=>{
 const source=readActiveApp().source,match=source.match(/Object\.defineProperty\(window, 'isAuthenticated', \{[\s\S]*?\n\}\);/);
 assert.ok(match,'actual app must expose its lexical session state');
 const window={},context=vm.createContext({window});vm.runInContext('let isAuthenticated=false;\n'+match[0],context);
 assert.equal(window.isAuthenticated,false);vm.runInContext('isAuthenticated=true;',context);assert.equal(window.isAuthenticated,true);
 assert.equal(Object.getOwnPropertyDescriptor(window,'isAuthenticated').set,undefined);vm.runInContext('isAuthenticated=false;',context);assert.equal(window.isAuthenticated,false);
});
