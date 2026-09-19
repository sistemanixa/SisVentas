const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');const src=require('./helpers/active-app').readActiveApp().source;
test('cerrar menús no vuelve a mutar estilos de menús ya cerrados',()=>{
 let writes=0;const style={get display(){return 'none';},set display(v){writes++;}};
 const ctx={document:{querySelectorAll:()=>[{style}]}};
 vm.runInNewContext(src.slice(src.indexOf('function cerrarMenusPpto()'),src.indexOf('function cerrarMenuPptoGlobal()')),ctx);
 for(let i=0;i<100;i++)ctx.cerrarMenusPpto();assert.equal(writes,0);
});
