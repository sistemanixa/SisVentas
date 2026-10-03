const {test}=require('node:test'),assert=require('node:assert/strict');
const {initialize,calculateDraft}=require('../js/modules/exterior-preparation');
const row=(key,qty,price,method='exterior')=>({key,productKey:key,code:key,description:key,needed:qty,existing:0,qty,baselineUnit:120000,baselinePart:qty*120000,method,include:method==='exterior',provider:'Proveedor',providerKey:'P',agreed:price,reference:{amount:110,currency:method==='local'?'ARS':'USD'}});
const draft=()=>({parameters:{usd:1000,payment:'USD',shippingInsuredUSD:20,remoteOther:0,baseline:360000,revenue:600000,extraLogisticsUSD:0},rows:[row('A',2,100),row('B',1,80000,'local')],extras:[],chosen:'remote'});
test('compra mixta conserva referencias y calcula margen sin modificar venta',()=>{const d=draft(),s=calculateDraft(d);assert.equal(s.result.orderTotal,300000);assert.equal(s.result.retained,80000);assert.equal(s.result.profit,300000);assert.equal(s.result.margin,50);assert.equal(s.complete,true);assert.equal(d.rows[0].reference.amount,110);assert.equal(d.parameters.revenue,600000);});
test('compra local no pide dólar, USDT, envío ni viaje',()=>{const d=draft();d.rows=[row('A',1,90000,'local')];d.parameters.usd='';d.parameters.shippingInsuredUSD='';const s=calculateDraft(d);assert.equal(s.complete,true);assert.equal(s.result.logistics,0);assert.equal(s.hasForeign,false);});
test('stock completo no genera importe de compra y conserva su costo en margen',()=>{const d=draft();d.rows=[row('A',1,'','stock')];const s=calculateDraft(d);assert.equal(s.rows[0].qty,0);assert.equal(s.rows[0].existing,1);assert.equal(s.result.orderTotal,0);assert.equal(s.result.profit,240000);assert.equal(s.complete,true);});
test('referencia sirve para estimar pero no cuenta como precio confirmado',()=>{const d=draft();d.rows[0].agreed='';const s=calculateDraft(d);assert.equal(s.rows[0].usd,110);assert.equal(s.complete,false);assert.ok(s.pending.some(p=>p.includes('precio acordado')));});
test('extras comparten logística sin cargar su costo al margen de la venta',()=>{const d=draft();d.rows=[row('A',1,100)];d.extras=[{...row('X',1,100),destination:'stock'}];const s=calculateDraft(d);assert.equal(s.result.remote,110000);assert.equal(s.result.extraTotal,110000);assert.equal(s.result.orderTotal,220000);assert.equal(s.result.profit,250000);assert.equal(s.extras[0].unitCostARS,110000);});
test('USDT respeta relación pactada y no la deduce del dólar en pesos',()=>{const d=draft();d.rows=[row('A',1,100)];Object.assign(d.parameters,{payment:'USDT',usdt:1200,usdtPerUsd:1.02,fee:2});const s=calculateDraft(d);assert.equal(s.result.remote,144800);assert.equal(s.parameters.goodsRate,1224);assert.equal(s.complete,true);});
test('viaje sólo requiere costo total y no exige completar envío',()=>{const d=draft();d.chosen='onsite';d.parameters.shippingInsuredUSD='';d.parameters.tripTotalARS=30000;const s=calculateDraft(d);assert.equal(s.complete,true);assert.equal(s.result.orderTotal,310000);});
test('apertura conserva precio negociado previo y proveedor elegido',()=>{const source=row('A',2,100);source.usd=110;const ctx={rows:[source],saved:{version:6,rows:[{...source,agreed:95,reference:{amount:110,currency:'USD',provider:'Inicial'},providerKey:'OTRO'}],parameters:{usd:1000}}};const d=initialize(ctx);assert.equal(d.rows[0].agreed,95);assert.equal(d.rows[0].providerKey,'OTRO');assert.equal(d.rows[0].reference.provider,'Inicial');});

const {productProviders,selectProvider,selectExterior,applySaleCosts}=require('../js/modules/exterior-preparation');
const catalog=[{key:'A',code:'A',providers:[{proveedorKey:'L',nombre:'Local',costo:800,exterior:false},{proveedorKey:'P',nombre:'Exterior',usd:2,exterior:true}]}];
test('proveedores se limitan al producto y seleccionar carga referencia y precio',()=>{
 const r={productKey:'A',code:'A'};assert.equal(productProviders(r,catalog).length,2);assert.equal(productProviders({productKey:'B',code:'A'},catalog).length,0);
 selectProvider(r,catalog[0].providers[1]);assert.equal(r.agreed,2);assert.equal(r.reference.currency,'USD');assert.equal(r.method,'exterior');
 selectProvider(r,catalog[0].providers[0]);assert.equal(r.agreed,800);assert.equal(r.reference.amount,800);assert.equal(r.method,'local');
});
test('selección exterior conserva negociación y no cambia productos sin alternativa',()=>{
 const rows=[{productKey:'A',method:'local',agreed:800},{productKey:'B',method:'local',agreed:50}];assert.equal(selectExterior(rows,catalog),1);assert.equal(rows[0].agreed,2);assert.equal(rows[1].agreed,50);
 rows[0].agreed=1.5;selectExterior(rows,catalog);assert.equal(rows[0].agreed,1.5);
});
const cost=i=>i.costoTotalCompra??i.costoUnitarioCompra*i.qty;
const income=s=>s.subtotal;
test('guardar preparación cambia costo y margen, conserva mano de obra, descuento y venta',()=>{
 const sale={subtotal:900,total:1089,descuento:10,items:[{cod:'A',qty:2,costoUnitarioCompra:200},{cod:'MO',qty:1,costoUnitarioCompra:100}]};
 const rows=[{code:'A',sourceLine:0,needed:2,existing:0,agreed:1.5,method:'exterior',provider:'Exterior',providerKey:'P'}];
 const result=applySaleCosts(sale,rows,100,cost,income);
 assert.equal(result.items[0].costoTotalCompra,300);assert.equal(result.costoTotal,400);assert.equal(result.margenPct,500/900*100);
 assert.equal(result.total,1089);assert.equal(result.descuento,10);assert.deepEqual(result.items[1],sale.items[1]);assert.equal(sale.items[0].costoUnitarioCompra,200);
 const again=applySaleCosts(result,rows,100,cost,income);assert.deepEqual(again,result);
});
test('stock parcial conserva costo original y líneas repetidas se resuelven por posición',()=>{
 const sale={subtotal:1000,items:[{cod:'A',qty:2,costoUnitarioCompra:200},{cod:'A',qty:2,costoUnitarioCompra:300}]};
 const rows=[{code:'A',sourceLine:'list:1',needed:2,existing:1,agreed:1,method:'exterior',providerKey:'P',provider:'P'}];
 const result=applySaleCosts(sale,rows,100,cost,income);assert.equal(result.items[1].costoTotalCompra,400);assert.equal(result.items[0].costoUnitarioCompra,200);
 rows[0].method='stock';const restored=applySaleCosts(result,rows,100,cost,income);assert.equal(restored.items[1].costoTotalCompra,600);
});
test('cantidad externa distinta o dólar ausente impiden cambiar el costo',()=>{
 const sale={subtotal:1000,items:[{cod:'A',qty:2,costoUnitarioCompra:200}]},r={code:'A',sourceLine:0,needed:2,agreed:1,method:'exterior',providerKey:'P'};
 assert.throws(()=>applySaleCosts(sale,[r],0,cost,income),/cotización/);assert.throws(()=>applySaleCosts(sale,[{...r,needed:3}],100,cost,income),/cantidad/);
});

test('al abrir reemplaza un proveedor ajeno al producto por uno vinculado con su precio',()=>{
 const source={key:'A|0|L',productKey:'A',code:'A',qty:1,needed:1,baselinePart:800,providerKey:'L',provider:'Local',include:false};
 const saved={version:6,rows:[{...source,providerKey:'AJENO',method:'exterior',agreed:30}],parameters:{}};
 const d=initialize({rows:[source],saved,catalog});assert.equal(d.rows[0].providerKey,'L');assert.equal(d.rows[0].agreed,800);assert.equal(d.rows[0].reference.currency,'ARS');
});

test('cantidad editable recalcula totales y ganancia sin imputar extras a la venta',()=>{
 const {agreedSummary}=require('../js/modules/exterior-preparation');const d=draft();d.rows=[{...row('A',2,100),requestedQty:1}];d.extras=[{...row('X',1,50),destination:'stock'}];d.parameters.usdt=1250;
 const t=agreedSummary(d);assert.equal(t.ars,150000);assert.equal(t.usd,150);assert.equal(t.usdt,120);assert.equal(t.before,240000);assert.equal(t.after,260000);
 const calc=calculateDraft(d);assert.equal(calc.rows[0].qty,1);assert.equal(calc.rows[0].existing,0);assert.ok(calc.pending.some(p=>p.includes('Cantidad pendiente')));
 const sale={subtotal:600000,items:[{cod:'A',qty:2,costoUnitarioCompra:120000}]};d.rows[0].sourceLine=0;
 const saved=applySaleCosts(sale,d.rows,1000,cost,income);assert.equal(saved.items[0].costoTotalCompra,220000);assert.equal(saved.items[0].qty,2);
});
test('extra local conserva pesos, no requiere dólar ni envío y no altera ganancia',()=>{const d=draft();d.rows=[];d.extras=[{...row('P-9213',2,2500,'local'),destination:'stock'}];d.parameters.usd='';d.parameters.shippingInsuredUSD='';const s=calculateDraft(d);assert.equal(s.complete,true);assert.equal(s.hasForeign,false);assert.equal(s.extras[0].unitCostARS,2500);assert.equal(s.result.extraTotal,5000);assert.equal(s.result.profit,240000);assert.equal(require('../js/modules/exterior-preparation').agreedSummary(d).ars,5000);const reopened=initialize({rows:[],saved:s});assert.equal(reopened.extras[0].method,'local');});
test('extras locales no absorben logística exterior ni cotización USD',()=>{const d=draft();d.extras=[{...row('local',1,2500,'local'),destination:'stock'},{...row('foreign',1,100),destination:'stock'}];const s=calculateDraft(d);assert.equal(s.extras[0].unitCostARS,2500);assert.equal(s.extras[1].unitCostARS,106666.67);assert.equal(s.result.extraTotal,109166.67);});
