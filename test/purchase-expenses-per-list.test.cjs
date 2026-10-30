const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=require('../js/modules/exterior-preparation');
const list=(id,ts,p)=>({fbKey:id,ts,numero:id,simuladorParaguay:{parameters:p}});
const history=[list('old',10,{bus:100}),list('last',20,{bus:200,usd:99,revenue:999,payment:'USDT'}),list('future',40,{bus:999}),list('empty',25,{baseline:400,expensesInitialized:true,remoteTotalARS:''})];
test('chooses nearest earlier purchase with expenses, not last edited/future/empty/self/cancelled',()=>{
 const current=list('current',30,{});history[0].updatedAt=10000;
 const prior=api.previousExpenses(current,[...history,{...list('cancelled',29,{bus:999}),estado:'anulada'},current]);assert.equal(prior.listId,'last');assert.equal(prior.parameters.bus,200);assert.equal(prior.parameters.usd,undefined);assert.equal(prior.parameters.revenue,undefined);assert.equal(prior.parameters.payment,undefined);
});
test('first opening copies only expense suggestions and does not share objects',()=>{
 const prior=api.previousExpenses(list('current',30,{}),history),ctx={rows:[],previousExpenses:prior,initial:{revenue:123},saved:{parameters:{baseline:45}}};const before=JSON.stringify(ctx),d=api.initialize(ctx,{usd:1540});
 assert.equal(d.parameters.bus,200);assert.equal(d.parameters.usd,1540);assert.equal(d.parameters.revenue,123);assert.equal(d.parameters.payment,'USD');assert.equal(d.parameters.expensesCopiedFrom,'last');assert.equal(JSON.stringify(ctx),before);d.parameters.bus=1;assert.equal(prior.parameters.bus,200);
});
test('own zero, empty initialized and partial legacy expenses never get overwritten',()=>{
 for(const parameters of [{bus:0},{expensesInitialized:true},{shippingInsuredUSD:0,remoteOther:0},{remoteTotalARS:0}]){const d=api.initialize({rows:[],saved:{parameters},previousExpenses:{listId:'other',parameters:{bus:999}}});assert.equal(d.parameters.bus,parameters.bus);assert.equal(d.parameters.expensesCopiedFrom,undefined);}
});
test('saved snapshot reopens independently from next suggestion and closed record stays unchanged',()=>{
 const first=api.initialize({rows:[],previousExpenses:{listId:'old',parameters:{bus:200,remoteTotalARS:300}},saved:{}});first.parameters.remoteTotalARS=321;
 const saved={version:6,parameters:first.parameters},reopen=api.initialize({rows:[],saved,previousExpenses:{listId:'new',parameters:{remoteTotalARS:900}}});assert.equal(reopen.parameters.remoteTotalARS,321);
 const closed=api.initialize({rows:[],closed:true,saved:{parameters:{tripTotalARS:55}}});assert.equal(closed.parameters.expensesInitialized,undefined);assert.equal(closed.parameters.tripTotalARS,55);
});
const draft=()=>({chosen:'remote',rows:[{key:'A',code:'A',needed:1,qty:1,existing:0,method:'exterior',agreed:100,providerKey:'P'}],extras:[],parameters:{usd:1540,payment:'USD',remoteTotalARS:12345}});
test('one total in pesos is used once, independent of the dollar and old shipping values',()=>{
 const d=draft();Object.assign(d.parameters,{shippingInsuredUSD:999,remoteOther:999});const result=api.calculateDraft(d);assert.equal(result.result.logistics,12345);assert.equal(result.result.orderTotal,166345);assert.equal(result.complete,true);d.parameters.usd=2000;assert.equal(api.calculateDraft(d).result.logistics,12345);
});
test('legacy USD shipping preserves original base and current valuation when not edited',()=>{
 const d=draft();delete d.parameters.remoteTotalARS;Object.assign(d.parameters,{shippingInsuredUSD:90,remoteOther:1000});assert.equal(api.calculateDraft(d).result.logistics,139600);d.parameters.usd=1600;assert.equal(api.calculateDraft(d).result.logistics,145000);assert.equal(d.parameters.shippingInsuredUSD,90);
 const prior=api.previousExpenses(list('new',40,{}),[list('legacy',20,d.parameters)]);assert.equal(prior.parameters.remoteTotalARS,145000);assert.equal(prior.parameters.shippingInsuredUSD,undefined);
});
test('travel breakdown uses nights and days without imposing expenses for a new purchase',()=>{
 assert.equal(api.tripTotal({bus:200,night:50,nights:2,food:20,days:3}),360);assert.equal(api.tripTotal({bus:0}),0);assert.equal(api.tripTotal({}), '');assert.equal(api.tripTotal({night:2,nights:-1}), '');assert.equal(api.tripTotal({bus:Infinity}), '');
 const d=api.initialize({rows:[],saved:{}});assert.equal(d.parameters.remoteTotalARS,'');assert.equal(d.parameters.bus,undefined);
});
test('missing and invalid totals stay pending; explicit zero is allowed',()=>{
 for(const value of ['',-1,Infinity,'bad']){const d=draft();d.parameters.remoteTotalARS=value;assert.equal(api.calculateDraft(d).complete,false);}const d=draft();d.parameters.remoteTotalARS=0;assert.equal(api.calculateDraft(d).complete,true);
});
test('allocation including extras applies the order total once, without touching sale inputs',()=>{
 const d=draft();d.parameters.remoteTotalARS=100;d.extras=[{key:'extra',description:'Extra',qty:1,method:'exterior',agreed:100,providerKey:'P'}];const before=JSON.stringify(d),r=api.calculateDraft(d);assert.equal(r.result.orderTotal,308100);assert.equal(r.result.extraTotal,154050);assert.equal(r.result.remote,154050);assert.equal(JSON.stringify(d),before);
});
test('configuration form and cost reads are removed; only authorized loaded lists supply suggestions',()=>{
 const config=fs.readFileSync('js/modules/paraguay-config.js','utf8'),prep=fs.readFileSync('js/modules/exterior-preparation.js','utf8'),orders=fs.readFileSync('js/modules/purchase-orders.js','utf8'),legacy=fs.readFileSync('js/modules/paraguay-planner.js','utf8');
 assert.doesNotMatch(config,/montarGastos|data-save-travel|costosViaje/);assert.doesNotMatch(prep,/fbGet\(|config\/comprasParaguay|data-expense-field/i);assert.doesNotMatch(legacy,/config\/comprasParaguay/);assert.match(orders,/previousExpenses\?\.\(list,state.lists\)/);assert.match(config,/guardarConversionParaguay/);
});

test('legacy packaging USD is copied as pesos using its own saved rate, never another purchase rate',()=>{const prior=api.previousExpenses(list('new',40,{}),[list('old',20,{pack:2,usd:1000})]);assert.equal(prior.parameters.packARS,2000);assert.equal(prior.parameters.pack,undefined);const own=api.initialize({rows:[],saved:{parameters:{pack:2,usd:1000}},previousExpenses:{listId:'wrong',parameters:{packARS:999}}});assert.equal(own.parameters.pack,2);assert.equal(own.parameters.expensesCopiedFrom,undefined);});

test('desglose remoto se suma una vez y conserva valores al alternar modalidad',()=>{const d=draft();Object.assign(d.parameters,{logisticsARS:190000,transportARS:90000,courierARS:205600});assert.equal(api.remoteTotal(d.parameters),485600);assert.equal(api.calculateDraft(d).result.logistics,485600);d.chosen='onsite';d.parameters.tripTotalARS=50;assert.equal(api.calculateDraft(d).result.logistics,50);d.chosen='remote';assert.equal(api.calculateDraft(d).result.logistics,485600);d.parameters.courierARS=-1;assert.equal(api.calculateDraft(d).complete,false);});

test('resumen de siete productos conserva referencias y concilia gastos con costo final',()=>{const d=draft();d.rows=[];d.extras=Array.from({length:7},(_,i)=>({code:'P-'+i,description:'Producto '+i,qty:i+1,method:'exterior',agreed:10+i,reference:{currency:'USD',amount:20+i},providerKey:'P'}));Object.assign(d.parameters,{logisticsARS:190000,transportARS:90000,courierARS:205600});const before=JSON.stringify(d),s=api.calculateDraft(d),lines=s.result.purchaseBreakdown;assert.equal(lines.length,7);assert.equal(Math.round(lines.reduce((n,r)=>n+r.expenses,0)*100),48560000);assert.equal(Math.round(lines.reduce((n,r)=>n+r.total,0)*100),Math.round(s.result.orderTotal*100));assert.equal(lines[0].initial,20);assert.equal(lines[0].agreed,10);for(const r of lines)assert.ok(Math.abs(r.unitCost*r.quantity-r.total)<0.00001);assert.equal(JSON.stringify(d),before);});

test('todos los productos exteriores participan aunque exista una exclusion antigua',()=>{const d=draft();d.parameters.remoteTotalARS=100;d.rows[0].expenseExcluded=true;d.extras=[{key:'B',code:'B',qty:1,method:'exterior',agreed:100,providerKey:'P',expenseExcluded:true}];const before=JSON.stringify(d),s=api.calculateDraft(d);assert.deepEqual(s.result.purchaseBreakdown.map(r=>r.expenses),[50,50]);assert.equal(s.complete,true);assert.ok(s.rows.concat(s.extras).every(r=>!Object.hasOwn(r,'expenseExcluded')));assert.equal(JSON.stringify(d),before);});
