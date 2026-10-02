const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('mide todas las celdas antes de escribir títulos para evitar recalcular layout por fila',()=>{
 const source=fs.readFileSync('js/modules/resizable-tables.js','utf8');
 const start=source.indexOf('  function updateOverflowTitles(table) {');
 const end=source.indexOf('  function normalizePercent(',start);
 let writes=0,reads=0;
 const cells=Array.from({length:500},()=>({querySelector:()=>null,textContent:'Descripción completa',dataset:{},
  get scrollWidth(){assert.equal(writes,0,'lecturas de geometría intercaladas con escrituras');reads++;return 200;},
  get clientWidth(){return 80;},get title(){return '';},set title(value){assert.equal(value,'Descripción completa');writes++;}
 }));
 const c={};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 c.updateOverflowTitles({querySelectorAll:()=>cells});assert.equal(reads,500);assert.equal(writes,500);
});
