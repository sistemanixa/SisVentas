const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(fs.readFileSync('index.html','utf8').match(/src="\.\/(js\/app\.v[\d.]+\.js)"/)[1],'utf8');
const code=src.slice(src.indexOf('function chatPuedeAccederCanal('),src.indexOf('function chatAplicarAccesos('));
test('matriz de acceso de todos los grupos',()=>{
 const c={window:{},currentUserUid:'juan',currentUser:'Juan',currentRole:'tecnico',_chatUsuarioKey:s=>s.toLowerCase()};vm.createContext(c);vm.runInContext(code,c);
 const matrix={admin:[true,true,true],administrativo:[true,false,true],vendedor:[true,false,true],tecnico:[true,true,false],tecnico_vendedor:[true,true,true]};
 for(const [role,values]of Object.entries(matrix))['general','tecnicos','admin'].forEach((channel,i)=>assert.equal(c.chatPuedeAccederCanal(channel,role),values[i],role+' '+channel));
 assert.equal(c.chatPuedeAccederCanal('directo_juan_pedro'),true);assert.equal(c.chatPuedeAccederCanal('directo_juana_pedro'),false);
});
