'use strict';
const profile=require('../fixtures/historical-reference-profile.json'),crypto=require('node:crypto');
const id=(kind,n)=>'syn_'+kind+'_'+String(n).padStart(5,'0');
const histogram=a=>a.reduce((out,n)=>(out[n]=(out[n]||0)+1,out),{});
function generate(seed=profile.seed,capacity){
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
 const expand=h=>{const a=Object.entries(h).flatMap(([n,count])=>Array(count).fill(Number(n)));for(let i=a.length-1;i>0;i--){const j=random()%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
 const data=Object.fromEntries(Object.keys(profile.collections).map(k=>[k,{}])),itemCounts=expand(profile.salesItemsHistogram),offerCounts=expand(profile.providerOffersHistogram);
 for(let i=0;i<639;i++){const proveedores={};for(let j=0;j<offerCounts[i];j++)proveedores[id('provider',j)]={nombre:'Proveedor sintético '+j,precio:40+i%29,costoRealArs:40+i%29,activo:true};data.productos[id('product',i)]={codigo:'SYN-P-'+i,nombre:'Producto sintético '+i,activo:true,moneda:'ARS',compraARS:40+i%29,pventa:100+i%29,proveedores};}
 for(let i=0;i<492;i++)data.clientes[id('client',i)]={id:'SYN-C-'+i,nombre:'Cliente sintético '+i,activo:true,dir:'Domicilio sintético '+i};
 for(let i=0;i<407;i++)data.clientes_unificados[id('group',i)]={nombre:'Grupo sintético '+i,principalLegacyFbKey:id('client',i)};
 for(let i=0;i<488;i++)data.clientes_unificados_indice[id('client',i)]={clienteKey:id('group',i%407)};
 const uid=i=>i===0?'u':id('user',i),empleados={};for(let i=0;i<8;i++)empleados[id('employee',i)]={nombre:'Integrante sintético '+i,activo:true,estado:'Activo'};
 for(let i=0;i<1095;i++){
  const date=(i%5===0?'2020':'2026')+'-'+String(1+i%10).padStart(2,'0')+'-'+String(1+i%28).padStart(2,'0'),items=[];
  for(let j=0;j<itemCounts[i];j++){const p=(i*7+j)%639,cost=40+p%29,price=100+p%29;items.push({cod:'SYN-P-'+p,desc:'Ítem sintético '+i+' '+j,productoFbKey:id('product',p),qty:1,punit:price,sub:price,costoUnitarioCompra:cost,costoUnitarioPresupuestado:cost,costoVersion:1});}
  const total=items.reduce((sum,r)=>sum+r.sub,0),client=i%492;
  data.ventas[id('sale',i)]={id:'SYN-V-'+i,...(i<81?{}:{fecha:date}),ts:Date.parse(date+'T15:00:00Z'),clienteFbKey:id('client',client),cliente:'Cliente sintético '+client,responsableUid:uid(i%5),creadaPor:uid(i%5),empleadoFbKey:id('employee',i%5),empleado:'Integrante sintético '+i%5,comisionHabilitada:true,subtotal:total,total,iva:0,conIva:false,descuento:0,items};
 }
 // One unpaid target, one sale with two payments: equal cardinality is not a
 // one-to-one payment assumption. This topology is synthetic, not observed.
 for(let i=0;i<1095;i++){const s=1+i%1094,sale=data.ventas[id('sale',s)];data.pagos[id('payment',i)]={ventaFbKey:id('sale',s),ventaId:sale.id,monto:5,fecha:'2026-11-04',medio:'Transferencia',ts:1793800000000+i,clienteFbKey:sale.clienteFbKey,cliente:sale.cliente};}
 for(let i=0;i<123;i++)data.presupuestos[id('budget',i)]={id:'SYN-PP-'+i,fecha:'2026-11-04',estado:'borrador',clienteFbKey:id('client',i%492),cliente:'Cliente sintético '+i%492,responsableUid:uid(i%5),total:100,subtotal:100,items:[{cod:'SYN-P-'+i,qty:1,punit:100,sub:100}]};
 for(let i=0;i<131;i++){const sale=data.ventas[id('sale',i)];data.ordenes_trabajo[id('ot',i)]={id:'SYN-OT-'+i,fecha:'2026-11-04',estado:'pendiente',ventaFbKey:id('sale',i),ventaId:sale.id,clienteFbKey:sale.clienteFbKey,cliente:sale.cliente,materiales:[{cod:'SYN-P-'+i,productoKey:id('product',i),vendida:1,entregada:0,instalada:0}]};sale.otId=id('ot',i);sale.estadoInst='pendiente_inst';}
 for(let i=0;i<40;i++){data.reclamos[id('claim',i)]={id:'SYN-R-'+i,clienteFbKey:id('client',i),cliente:'Cliente sintético '+i,fecha:'2026-11-04',estado:'pendiente'};data.ordenes[id('order',i)]={numero:'SYN-OC-'+i,estado:'ordenada',ventaFbKey:id('sale',i),items:[{codigo:'SYN-P-'+i,productoKey:id('product',i),cantidadOrdenada:3,cantidadRecibida:0,costoUnitario:40+i%29}],recepciones:[]};}
 for(let i=0;i<252;i++)data.gastos[id('expense',i)]={concepto:'Gasto sintético '+i,tipo:'Operativo',monto:10,fecha:'2026-11-04',estado:'pendiente'};
 for(let i=0;i<27;i++)data.listas_materiales[id('list',i)]={nombre:'Lista sintética '+i,ventaFbKey:id('sale',i),items:[{productoKey:id('product',i),codigo:'SYN-P-'+i,cantidad:3}]};
 for(let i=0;i<111;i++)data.inventario_operativo[id('product',i)]={general:10,reservado:0,enCompra:i<40?3:0,consumido:0,asignaciones:{}};
 data.empleados=empleados;data.config={maxComisionPct:25,comisionesEmpleados:Object.fromEntries(Object.keys(empleados).map(k=>[k,{pct:25}]))};
 const roles=['admin','administrativo','vendedor','tecnico_vendedor','tecnico','distribuidora'],users={},identities={};for(let i=0;i<8;i++){const rol=roles[i%6];users[uid(i)]={uid:uid(i),nombre:'Integrante sintético '+i,rol,activo:true,empleadoFbKey:id('employee',i)};identities[uid(i)]={rol,activo:true};}
 if(capacity){
  // Capacity is a private caller input. Original historical histograms remain
  // unchanged; extra synthetic rows repeat a deterministic historical shape.
  for(const [collection,wanted] of Object.entries(capacity)){
   if(!Object.hasOwn(profile.collections,collection)||!Number.isSafeInteger(wanted)||wanted<0)throw Error('Invalid synthetic capacity');
   const entries=Object.entries(data[collection]);if(wanted>entries.length&&!entries.length)throw Error('Cannot extend an empty template');
   for(let i=entries.length;i<wanted;i++){const row=structuredClone(entries[i%entries.length][1]);if(row.id)row.id='SYN-CAPACITY-'+collection+'-'+i;if(row.numero)row.numero='SYN-CAPACITY-'+i;data[collection][id('capacity_'+collection,i)]=row;}
   for(const key of Object.keys(data[collection]).slice(wanted))delete data[collection][key];
  }
 }
 return {profile:structuredClone(profile),seed,data,users,identities,target:id('sale',0),...(capacity?{capacityOverride:true}: {})};
}
function summary(f){const collections=Object.fromEntries(Object.keys(profile.collections).map(k=>[k,Object.keys(f.data[k]).length])),bytes=Object.fromEntries(Object.keys(profile.referenceBodyBytes).map(k=>[k,{generated:Buffer.byteLength(JSON.stringify(f.data[k])),historicalReference:profile.referenceBodyBytes[k]}]));return {kind:profile.kind,currentEquivalent:false,coherentSnapshot:false,seed:f.seed,collections,salesItemsHistogram:histogram(Object.values(f.data.ventas).map(r=>r.items.length)),providerOffersHistogram:histogram(Object.values(f.data.productos).map(r=>Object.keys(r.proveedores).length)),bytes,digest:crypto.createHash('sha256').update(JSON.stringify(f)).digest('hex')};}
async function createFixture({capacity,seed=profile.seed}={}){
 const synthetic=generate(seed,capacity),started=performance.now(),backend=await require('./coordinated-backend.cjs').createCoordinatedBackend(synthetic.data),{apply}=require('./labor-ui-flow.cjs');
 apply(backend.state,{sv_usuarios:synthetic.users,sv_chat_roles:synthetic.identities});
 const model=require('../../cotizador/commercial-pages-model'),search=require('../../scripts/lib/sales-search-plan.cjs').prepare({rows:backend.get(model.ROOT+'/records/sales'),coverage:backend.get(model.ROOT+'/coverage'),config:backend.get('sv_commercial_pages_config'),originals:synthetic.data.ventas,targetEmpty:true});apply(backend.state,search.patch);backend.state.sv_commercial_pages_config=search.activate;
 const index=require('../../scripts/lib/record-list-activation.cjs'),prepared=await index.scan(async p=>backend.get(p));apply(backend.state,{[index.target]:prepared.indexes,sv_record_list_config:{schema:1,ready:true}});
 return {...backend,synthetic,buildMs:performance.now()-started,summary:summary(synthetic)};
}
module.exports={profile,generate,summary,createFixture,id};
