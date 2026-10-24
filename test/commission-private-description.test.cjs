'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),path=require('node:path');
const {memoryDB}=require('./helpers/private-finance-fixtures.cjs'),{createCommissionGeneration}=require('../cotizador/commission-generation'),{createCommissionOperations}=require('../cotizador/commission-operations'),P=require('../cotizador/commission-public-response');
function generationFixture(create=createCommissionGeneration){
 const sale={id:'V-FICTICIA',cliente:'Cliente ficticio',responsableUid:'actor',empleadoFbKey:'e',comisionHabilitada:true,estadoPago:'pago_total',items:[{cod:'P-FICTICIO',qty:2,punit:100,sub:200,costoUnitarioPresupuestado:40}],subtotal:200,total:200,iva:0,conIva:false};
 const db=memoryDB({sisventas:{ventas:{sale},pagos:{p:{ventaFbKey:'sale',ventaId:sale.id,monto:200,ts:2000}},empleados:{e:{nombre:'Persona ficticia',activo:true}},config:{maxComisionPct:25,comisionesEmpleados:{e:{pct:25}}},gastos:{unrelated:{tipo:'Variable',monto:42,descripcion:'Histórico intacto'}},ctaemp:{other:{old:{tipo:'comision',monto:10,pct:5,gananciaBase:200,descripcion:'Comisión antigua · 5% sobre ganancia $200'}}},comisiones_generacion:{}}});
 const raw=db.ref.bind(db);db.ref=p=>{const ref=raw(p);return {...ref,orderByChild:field=>({equalTo:value=>({get:async()=>{const rows=(await ref.get()).val()||{};return {val:()=>Object.fromEntries(Object.entries(rows).filter(([,row])=>row[field]===value))};}})})};};
 const commercial={authorize:async()=>({uid:'actor',role:'vendedor',name:'Persona ficticia'}),assertRecord:async()=>{}};
 return {db,service:create({db,commercial,enabled:true,from:1000,now:()=>10000}),actor:{uid:'actor',role:'vendedor',name:'Persona ficticia'}};
}
test('generation keeps internal plan/base/percent/amount and every historical record while neutralizing only future description',async()=>{
 const f=generationFixture(),old=JSON.stringify(f.db.root.sisventas.ctaemp.other),unrelated=JSON.stringify(f.db.root.sisventas.gastos.unrelated),p=await f.service.inspect(f.actor,'sale');
 assert.equal(p.base.ganancia,120);assert.equal(p.base.costoOriginal,80);assert.equal(p.participantes[0].pct,25);assert.equal(p.participantes[0].monto,30);
 const result=await f.service.generate(f.actor,{ventaFbKey:'sale',digest:p.digest});assert.equal(result.status,'generada');assert.equal(result.participantes[0].pct,25);
 const move=f.db.root.sisventas.ctaemp.e.comision_sale_e,g=f.db.root.sisventas.gastos.gasto_comision_sale_e;
 for(const row of [move,g]){assert.equal(row.descripcion,'Comisión venta #V-FICTICIA · Cliente ficticio');assert.equal(row.gananciaBase,120);assert.equal(row.pct,25);assert.equal(row.pctOriginal,25);assert.equal(row.monto,30);}
 assert.equal(JSON.stringify(f.db.root.sisventas.ctaemp.other),old);assert.equal(JSON.stringify(f.db.root.sisventas.gastos.unrelated),unrelated);
 assert.equal(f.db.root.sv_commission_generation.sale.plan.digest,p.digest);assert.equal(f.db.root.sv_commission_generation.sale.plan.base.ganancia,120);
 const before=JSON.stringify(f.db.root.sisventas);assert.equal((await f.service.generate(f.actor,{ventaFbKey:'sale'})).reutilizada,true);assert.equal(JSON.stringify(f.db.root.sisventas),before);
});
function distributionFixture(create=createCommissionOperations){
 let data={config:{maxComisionPct:10},gastos:{a:{tipoPagable:'comision',ventaId:'V-FICTICIA',cliente:'Cliente ficticio',gananciaBase:1000,pct:4,monto:40,estado:'pendiente_aprobacion',legacyKey:'ctaemp/e/m'},paid:{tipoPagable:'comision',ventaId:'V-FICTICIA',gananciaBase:1000,pct:4,monto:40,montoPagado:40,estado:'pagado',descripcion:'Histórico pagado · 4% sobre ganancia $1000'}},ctaemp:{e:{m:{pct:4,pctOriginal:4,monto:40,gananciaBase:1000,cliente:'Cliente ficticio',descripcion:'Histórico · 4% sobre ganancia $1000'}}},ventas:{untouched:true}};
 const body={grupo:{clave:'V-FICTICIA',items:Object.entries(data.gastos).map(([fbKey,g])=>({...g,fbKey}))},movimientos:{a:{...data.ctaemp.e.m,empFbKey:'e',movFbKey:'m'}},valores:[{fbKey:'a',pct:5}]};
 const service=create({auth:{},db:{},now:()=>12345,transaction:async fn=>{const next=fn(structuredClone(data));if(next)data=next;return {committed:!!next};}});
 return {body,service,data:()=>data};
}
test('redistribution preserves amounts, gain, stored percent, paid records and CAS behavior; only new description is neutral',async()=>{
 const f=distributionFixture(),paid=JSON.stringify(f.data().gastos.paid);await f.service.redistribute({nombre:'Admin'},f.body);
 for(const row of [f.data().gastos.a,f.data().ctaemp.e.m]){assert.equal(row.monto,50);assert.equal(row.pct,5);assert.equal(row.gananciaBase,1000);assert.equal(row.descripcion,'Comisión venta #V-FICTICIA · Cliente ficticio');assert.equal(row.modificadoTs,12345);}
 assert.equal(f.data().ctaemp.e.m.pctOriginal,4);assert.equal(JSON.stringify(f.data().gastos.paid),paid);assert.equal(f.data().ventas.untouched,true);
 const denied=distributionFixture();denied.body.valores[0].pct=7;const before=JSON.stringify(denied.data());await assert.rejects(denied.service.redistribute({nombre:'Admin'},denied.body),{statusCode:400});assert.equal(JSON.stringify(denied.data()),before);
});
function previousImplementation(file,createName,previous=true){
 // Load the prior description expression only; this verifies financial parity
 // against the real same module rather than reimplementing its calculations.
 let code=fs.readFileSync('cotizador/'+file,'utf8');if(previous)code=code.replace("const {description:commissionDescription}=require('./commission-public-response');\n",'');
 if(previous&&file==='commission-generation.js')code=code.replace('descripcion:commissionDescription(plan.ventaId,initial.data.sale.cliente)',()=>"descripcion:'Comisión venta '+plan.ventaId+' · '+emp.pct+'% sobre ganancia original · generación automática'");
 else if(previous)code=code.replace('descripcion:commissionDescription(actual.find(a=>a.fbKey===v.fbKey).ventaId,g.cliente||link?.movement.cliente)',()=>"descripcion:'Comisión venta '+(actual.find(a=>a.fbKey===v.fbKey).ventaId||'')+' · '+v.pct+'% sobre ganancia $'+Math.round(gain).toLocaleString('es-AR')+' · distribución administrada'");
 const baseRequire=createRequire(path.resolve('cotizador/'+file));const deterministicRequire=name=>name==='node:crypto'?{...baseRequire(name),randomUUID:()=> 'fixture-lease-token'}:baseRequire(name);const context={require:deterministicRequire,module:{exports:{}},structuredClone,Date,Map,Set,Promise,Buffer,Intl,setInterval,clearInterval};vm.runInNewContext(code,context);return context.module.exports[createName];
}
function omitDescriptions(value){if(Array.isArray(value))return value.map(omitDescriptions);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='descripcion').map(([key,child])=>[key,omitDescriptions(child)]));return value;}
test('real generation previous/new implementations produce byte-identical financial/control state except descriptions',async()=>{
 const previous=generationFixture(previousImplementation('commission-generation.js','createCommissionGeneration')),current=generationFixture(previousImplementation('commission-generation.js','createCommissionGeneration',false));
 const a=await previous.service.generate(previous.actor,{ventaFbKey:'sale'}),b=await current.service.generate(current.actor,{ventaFbKey:'sale'});
 assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(JSON.stringify(omitDescriptions(previous.db.root)),JSON.stringify(omitDescriptions(current.db.root)));
});
test('real redistribution previous/new implementations produce byte-identical financial/control state except descriptions',async()=>{
 const previous=distributionFixture(previousImplementation('commission-operations.js','createCommissionOperations')),current=distributionFixture(previousImplementation('commission-operations.js','createCommissionOperations',false));
 await previous.service.redistribute({nombre:'Admin'},previous.body);await current.service.redistribute({nombre:'Admin'},current.body);
 assert.equal(JSON.stringify(omitDescriptions(previous.data())),JSON.stringify(omitDescriptions(current.data())));
});
