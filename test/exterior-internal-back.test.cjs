const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Volver recorre las vistas internas sin volver a SisVentas hasta agotar el historial',()=>{
const source=fs.readFileSync('js/modules/paraguay-shopping-access.js','utf8');const state=source.match(/const viewHistory=\[\];[\s\S]*?function rememberView\(next\)\{[^\n]+\}/)[0];const back=source.match(/back.onclick = \(\) => \{([\s\S]*?)\n      \};/)[1];const calls=[];const context={busy:false,options:{},close:()=>calls.push('salir'),panel:{querySelector:()=>({click:()=>context.rememberView('promotions')})},showRequests:()=>{calls.push('requests');context.rememberView('requests');},showView:lists=>{calls.push(lists?'lists':'products');context.rememberView(lists?'lists':'products');}};
vm.createContext(context);vm.runInContext(state+'\nfunction back(){'+back+'}',context);
for(const view of ['products','lists','requests','promotions','promotions'])context.rememberView(view);
context.back();context.back();context.back();assert.deepEqual(calls,['requests','lists','products']);context.back();assert.equal(calls[3],'salir');
});
