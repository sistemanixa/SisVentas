const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fn(file,name){const s=fs.readFileSync('js/modules/'+file+'.js','utf8'),start=s.indexOf('function '+name+'(');assert.ok(start>=0);for(let end=s.indexOf('}',start);end>=0;end=s.indexOf('}',end+1)){const code=s.slice(start,end+1);try{new vm.Script(code);return code;}catch{}}throw Error(name);}
test('gráficos agrupan ráfagas y descartan trabajo al salir de la pantalla',()=>{
 let active=true,calls=0,queue=[];const c={pendingCharts334:{},setTimeout:f=>(queue.push(f),queue.length),document:{hidden:false,getElementById:()=>({classList:{contains:()=>active}})}};vm.createContext(c);vm.runInContext(fn('executive-charts','scheduleChart334'),c);
 for(let i=0;i<20;i++)c.scheduleChart334('rentabilidad',()=>calls++);assert.equal(queue.length,1);active=false;queue.shift()();assert.equal(calls,0);active=true;c.scheduleChart334('rentabilidad',()=>calls++);queue.shift()();assert.equal(calls,1);
});
test('módulo de gráficos no envuelve ni recalcula Rentabilidad',()=>{
 const original=()=>42,c={window:{calcRentabilidad:original},document:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync('js/modules/executive-charts.js','utf8'),c);assert.equal(c.window.calcRentabilidad,original);assert.equal(c.window.renderRentGraficos334,undefined);assert.equal(typeof c.window.renderStatsGraficos334,'function');
});
test('punto de equilibrio combina input y change y permite actualizaciones posteriores',()=>{
 let queue=[],calls=0;const c={renderPending:false,setTimeout:f=>queue.push(f),render:()=>calls++};vm.createContext(c);vm.runInContext(fn('business-break-even','scheduleRender'),c);for(let i=0;i<10;i++)c.scheduleRender();assert.equal(queue.length,1);queue.shift()();assert.equal(calls,1);c.scheduleRender();queue.shift()();assert.equal(calls,2);
});
test('Volver no mide geometría de acciones que no son navegación',()=>{
 let measures=0;const c={window:{},document:{readyState:'loading',addEventListener(){},querySelector:s=>s==='.sv-retorno-modulo'?{hidden:false}:{querySelectorAll:()=>Array.from({length:500},()=>({textContent:'Editar'}))}},_svElementoVisible(){measures++;return true;}};vm.runInNewContext(fs.readFileSync('js/modules/navigation-back.js','utf8'),c);c.window.SVBackNavigation.sync();assert.equal(measures,0);
});
test('numeración lineal conserva filas vacías sin consumir posiciones',()=>{
 const rows=[true,false,true].map(meaningful=>({meaningful,dataset:{},querySelector:()=>null,removeAttribute(k){delete this.dataset.itemOrder;}}));let reads=0;const c={isMeaningfulRow:r=>(reads++,r.meaningful)};vm.createContext(c);vm.runInContext(fn('item-row-order','refresh'),c);c.refresh({querySelectorAll:()=>rows});assert.equal(reads,3);assert.deepEqual(rows.map(r=>r.dataset.itemOrder),['1',undefined,'2']);
});
