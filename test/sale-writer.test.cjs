const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Writer=require('../js/core/sale-writer.v1.js'),Costs=require('../js/core/sale-costs.v1.js');
function fixture(){
 let sequence=0,writes=0,denied=false,cost=55;
 const data={},get=p=>p.split('/').filter(Boolean).reduce((v,k)=>v?.[k],data)??null;
 const put=(p,value)=>{const parts=p.split('/').filter(Boolean);let node=data;for(const key of parts.slice(0,-1))node=node[key]??={};node[parts.at(-1)]=structuredClone(value);};
 const root={currentUserUid:'operator',currentRole:'admin',currentUser:'Operador ficticio',document:{},FB_PATHS:{ventas:'sisventas/ventas'},fbDB:{},fbRef:(_,p)=>p,fbPush:()=>({key:'sale-'+(++sequence)}),fbGet:async p=>({val:()=>structuredClone(get(p))}),obtenerProductoPorCodigoVenta:code=>code==='P'?{compraARS:cost}:null,obtenerCostoUnitarioVenta:()=>cost};
 root.SVCommercialOwnership={clean:r=>structuredClone(r),stamp:r=>({...r,creadorOriginalUid:'operator',creadorOriginalNombre:'Operador ficticio'}),prepare:async(_domain,key,baseline)=>{if(denied)throw Error('Permission denied');return {record:structuredClone(get('sisventas/ventas/'+key)),baseline};},refresh(){}};
 root.window=root;vm.runInNewContext(fs.readFileSync('js/modules/commercial-document-controls.js','utf8'),root);
 root.SVSaleCosts=Costs.create(root);
 root.SVLaborWrites={atomic:async({paths,build})=>{if(denied)throw Error('Permission denied');const patch=build(Object.fromEntries(paths.map(p=>[p,structuredClone(get(p))])));if(!patch)return {committed:false};writes++;for(const [p,v]of Object.entries(patch))put(p,v);return {committed:true};}};
 root.SVGuardedWrites={save:async(path,baseline,record)=>{if(denied)throw Error('Permission denied');const current=get(path),clean=x=>{const n=structuredClone(x);delete n.fbKey;return n;};assert.deepEqual(clean(current),clean(baseline));const next={...current,...record};delete next.fbKey;put(path,next);writes++;return next;}};
 return {root,api:Writer.create(root),get,put,writes:()=>writes,cost:n=>cost=n,deny:()=>denied=true};
}
const sale=()=>({id:'V-FICTICIA',cliente:'Cliente ficticio',fecha:'2026-10-28',subtotal:200,iva:42,total:242,items:[{cod:'P',cantidad:2,precio:100}],empleado:'Vendedor original',comisionHabilitada:true});
for(const origin of ['manual','soporte','conversion','adicional_ot','credito'])test(origin+': contrato y guardado únicos con vínculos atómicos',async()=>{
 const f=fixture(),input={...sale(),origen:origin},before=structuredClone(input);
 const saved=await f.api.commit({record:input,key:origin,related:{['sisventas/ordenes_trabajo/ot-'+origin+'/ventaId']:input.id}});
 assert.equal(saved.items[0].qty,2);assert.equal(saved.items[0].punit,100);assert.equal(saved.items[0].sub,200);assert.equal(saved.items[0].costoTotalCompra,110);assert.equal(saved.ventaFormatoVersion,1);assert.equal(saved.moneda,'ARS');assert.deepEqual(saved.pagos,[]);assert.equal(saved.empleado,input.empleado);assert.equal(f.writes(),1);assert.deepEqual(input,before);
 await f.api.commit({record:saved,key:origin,related:{}});assert.equal(f.writes(),1,'reintentar no duplica ni reescribe');
});
test('editar conserva costos, pagos, factura, comisión generada y autoría sin tocar el original',async()=>{
 const f=fixture(),saved=await f.api.save(sale());Object.assign(saved,{pagos:[{id:'p',monto:20}],totalPagado:20,factura:{numero:'FACT-FICTICIA'},comisionGenerada:true});f.put('sisventas/ventas/'+saved.fbKey,saved);const before=structuredClone(saved);f.cost(999);
 const result=await f.api.save({...saved,totalPagado:0,pagos:[],factura:null,comisionGenerada:false,creadorOriginalUid:'otro',items:saved.items.map(i=>({...i,disc:10,sub:180,costoUnitarioCompra:999}))},saved);
 for(const key of ['pagos','totalPagado','factura','comisionGenerada','creadorOriginalUid'])assert.deepEqual(result[key],saved[key]);assert.equal(result.items[0].costoTotalCompra,110);assert.deepEqual(saved,before);
});
test('cambio concurrente de pago aborta también los vínculos de OT',async()=>{
 const f=fixture(),saved=await f.api.save(sale()),current={...saved,totalPagado:10};f.put('sisventas/ventas/'+saved.fbKey,current);const before=f.writes();
 await assert.rejects(f.api.commit({record:{items:saved.items},baseline:saved,key:saved.fbKey,partial:true,related:{'sisventas/ordenes_trabajo/ot/materiales':[]}}),/venta cambió/);assert.equal(f.writes(),before);assert.equal(f.get('sisventas/ordenes_trabajo/ot'),null);
});
test('permisos denegados no tienen fallback directo ni crean venta u OT',async()=>{
 const f=fixture();f.deny();await assert.rejects(f.api.save(sale()),/Permission denied/);await assert.rejects(f.api.commit({record:sale(),key:'denied',related:{'sisventas/ordenes_trabajo/ot/ventaId':'V'}}),/Permission denied/);assert.equal(f.writes(),0);
});
test('costo faltante impide cualquier escritura y conserva históricos desconocidos',async()=>{
 const f=fixture();await assert.rejects(f.api.save({...sale(),items:[{cod:'UNKNOWN',qty:1,punit:100}]}),/Falta definir/);assert.equal(f.writes(),0);
 const historic={id:'ANTIGUA',fecha:'2020-01-01',items:[{cod:'P',qty:1,punit:100,sub:100}],total:100};const next=f.api.prepare({...historic,items:[{...historic.items[0],costoUnitarioCompra:999}]},historic);assert.equal(next.items[0].costoUnitarioCompra,undefined);assert.equal(next.ventaFormatoVersion,undefined);assert.equal(historic.items[0].costoUnitarioCompra,undefined);
});
test('conversión conserva autor y comisionado; no los reemplaza el operador',async()=>{
 const f=fixture(),record={...sale(),creadorOriginalUid:'author',creadorOriginalNombre:'Autor original',convertidaPorUid:'operator'};const saved=await f.api.commit({record,key:'converted'});assert.equal(saved.creadorOriginalUid,'author');assert.equal(saved.empleado,'Vendedor original');assert.equal(saved.convertidaPorUid,'operator');
});
test('sesión cambiada durante comprobación no llega al guardado',async()=>{
 const f=fixture(),saved=await f.api.save(sale());f.root.SVCommercialOwnership.prepare=async()=>{f.root.currentUserUid='changed';return {record:saved};};const before=f.writes();await assert.rejects(f.api.save(saved,saved),/sesión cambió/);assert.equal(f.writes(),before);
});
test('el permiso específico de configurar comisiones sigue funcionando y no permite cambiar pagos',()=>{
 const f=fixture(),base={...sale(),totalPagado:20};f.root.tienePermiso=permission=>permission==='ventas.configurarComision';
 const next=f.api.prepare({...base,empleado:'Otro vendedor autorizado',comisionHabilitada:false,totalPagado:0},base);
 assert.equal(next.empleado,'Otro vendedor autorizado');assert.equal(next.comisionHabilitada,false);assert.equal(next.totalPagado,20);
});
test('cualquier origen calcula una sola vez descuento de ítem, general e IVA',()=>{
 const f=fixture();
 for(const origen of ['manual','soporte','conversion','adicional_ot']){
  const prepared=f.api.prepare({...sale(),origen,conIva:true,descuentoGeneral:10,subtotal:999,iva:999,total:999,items:[{cod:'P',qty:2,punit:100,disc:10,sub:999}]});
  assert.equal(prepared.items[0].sub,180);assert.equal(prepared.subtotal,162);assert.equal(prepared.iva,34.02);assert.equal(prepared.total,196.02);assert.equal(prepared.descuento,38);assert.equal(prepared.items[0].costoTotalCompra,110);
 }
});
test('cambiar sólo información operativa no recalcula importes históricos',()=>{
 const f=fixture(),base={...sale(),total:242.01,items:[{cod:'P',qty:2,punit:100,sub:200,costoUnitarioCompra:55}]};
 const next=f.api.prepare({...base,estadoInst:'instalado'},base);assert.equal(next.total,242.01);assert.equal(base.total,242.01);
});
test('transporte real usa un comando atómico y sólo lee la venta, sin exigir leer avisos privados',async()=>{
 const source=fs.readFileSync('test/labor-writes.test.cjs','utf8');
 const f=vm.runInNewContext(source.slice(0,source.indexOf('\ntest('))+';fixture();',{require,URL,TextEncoder,Uint8Array,AbortSignal,Promise,structuredClone});
 f.root.SVSaleCosts=Costs.create({obtenerProductoPorCodigoVenta:()=>({compraARS:55}),obtenerCostoUnitarioVenta:()=>55});
 f.root.SVCommercialOwnership={stamp:r=>r,refresh(){}};
 f.setHandler(command=>{assert.equal(command.kind,'atomic');for(const [p,value]of Object.entries(command.value))f.put(p,value);return {ok:true,status:200,json:async()=>({ok:true,committed:true})};});
 const saved=await Writer.create(f.root).commit({record:sale(),key:'created',related:{'sisventas/notificaciones_admin/private/ventaId':'V-FICTICIA'}});
 assert.equal(saved.items[0].costoTotalCompra,110);assert.deepEqual(Array.from(f.reads),['sisventas/ventas/created']);assert.equal(f.commands.length,1);assert.equal(f.direct.length,0);assert.ok(f.commands[0].expectedHashes['sisventas/ventas/created']);assert.equal(f.get('sisventas/notificaciones_admin/private/ventaId'),'V-FICTICIA');
});
