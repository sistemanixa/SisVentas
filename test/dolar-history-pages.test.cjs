const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('histórico permite 10, 25 y 50 registros por página conservando los meses anteriores y el gráfico completo',async()=>{
 const nodes={}, controls={'[data-page-size]':{},'[data-newer]':{},'[data-older]':{},'[data-history-range]':{}};
 const tbody={innerHTML:'',closest:()=>({parentElement:{after(nav){nodes[nav.id]=nav;}}})};nodes['dolar-historico-tbody']=tbody;
 let chartRows;const data={};
 for(let i=0;i<121;i++){const fecha='2026-'+(i<60?'07':'10')+'-'+String(1+Math.floor((i%60)/24)).padStart(2,'0'),hour=String(i%24).padStart(2,'0');(data[fecha]??={})[hour]={fecha,hora:hour+':00',ts:i+1,oficial:1500+i};}
 const count=Object.values(data).reduce((n,h)=>n+Object.keys(h).length,0);
 nodes['dh-history-scope']={value:'all'};const page={id:'page-configuracion'};nodes['cfg-dolar-historico-card']={getClientRects:()=>[{}],setAttribute(){}};
 const c={isAuthenticated:true,window:{currentUserUid:'u',fbAuth:{currentUser:{uid:'u'}},permisoModulo:()=>true,fbDB:{},location:{hash:'#/configuracion'},SVDollarHistoryScope:require('../js/core/dollar-history-scope.v1'),fbRef:()=>'',fbGet:async()=>({val:()=>data}),SisVentasDolarMensual:{update:r=>chartRows=r,getSelection:()=>({anchor:'2026-10-24',mode:'month'}),sourceState(){},bindSource(){}}},document:{querySelector:()=>page,body:{classList:{contains:()=>false}},addEventListener(){},getElementById:id=>nodes[id],createElement:()=>({style:{},querySelector:s=>controls[s]})},setTimeout(){}};
 nodes['dh-count']={};vm.runInNewContext(fs.readFileSync('js/modules/dolar-historico.js','utf8'),c);
 await c.window.dolarHistoricoCargar();
 assert.equal((tbody.innerHTML.match(/<tr>/g)||[]).length,25);assert.equal(nodes['dh-count'].textContent,count);assert.equal(chartRows.length,count);assert.equal(controls['[data-newer]'].disabled,true);
 controls['[data-page-size]'].onchange({target:{value:'10'}});assert.equal((tbody.innerHTML.match(/<tr>/g)||[]).length,10);
 controls['[data-older]'].onclick();assert.match(controls['[data-history-range]'].textContent,/11–20/);
 controls['[data-page-size]'].onchange({target:{value:'50'}});assert.match(controls['[data-history-range]'].textContent,/1–50/);
 controls['[data-older]'].onclick();assert.match(controls['[data-history-range]'].textContent,/51–100/);
 controls['[data-older]'].onclick();assert.equal((tbody.innerHTML.match(/<tr>/g)||[]).length,count-100);assert.equal(controls['[data-older]'].disabled,true);assert.match(tbody.innerHTML,/07\/2026/);
 controls['[data-newer]'].onclick();assert.equal((tbody.innerHTML.match(/<tr>/g)||[]).length,50);
 await c.window.dolarHistoricoCargar();assert.match(controls['[data-history-range]'].textContent,/1–50/);assert.equal(controls['[data-newer]'].disabled,true);
 assert.match(tbody.innerHTML,/10\/2026/);
});
