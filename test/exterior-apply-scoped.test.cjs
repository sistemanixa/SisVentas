const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('js/modules/purchase-orders.js','utf8');
function loadController(c){
 const document={addEventListener(){},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]};
 Object.assign(c.window,{document,currentRole:'administrativo',fbAuth:{currentUser:{uid:'u'}},PERMISOS_ROLES:{administrativo:{indiceRevision:1}},permisoModulo:module=>['ordenes','balancecompra'].includes(module),SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async()=>({})},
  SVPurchaseCommandAdapter:require('../js/modules/purchase-command-adapter.v1'),SVPurchaseCommandForm:require('../js/modules/purchase-command-form.v1'),fetch:async url=>{assert.equal(url,'https://fixture.invalid/laboral/capacidades');return {ok:true,status:200,json:async()=>({ok:true,inventory:{version:1,installed:false,ready:false,generation:''}})};}});
 c.window.SVLaborWrites=require('../js/core/labor-writes').create(c.window);c.window.SVLaborWriteRecovery=require('../js/core/labor-write-recovery').create(c.window);
 Object.assign(c,{document,console,TextEncoder,AbortSignal,URL,setTimeout,clearTimeout});
 const anchor='  window.SisVentasCompras = {';assert.equal(src.split(anchor).length,2);
 vm.createContext(c);vm.runInContext(src.replace(anchor,'  window.__exteriorFixture={savePreparationAndSaleCosts};\n'+anchor),c);
 c.savePreparationAndSaleCosts=c.window.__exteriorFixture.savePreparationAndSaleCosts;
}
function fixture(){
 const db={listas_materiales:{L:{estado:'preparacion',ventaFbKey:'S'}},ventas:{S:{total:1000,subtotal:1000,items:[{cod:'P',qty:1,costoUnitarioCompra:500}],audit:{old:{accion:'Anterior'}}}}};let fail=true;
 const c={PATH_LISTS:'sisventas/listas_materiales',materialListLocked:()=>false,window:{currentUserUid:'u',fbDB:{},fbRunTransaction(){},fbRef:(_,p)=>p,fbGet:async p=>({val:()=>structuredClone(db[p.split('/')[1]][p.split('/')[2]])}),SVExteriorPreparation:require('../js/modules/exterior-preparation'),obtenerCostoItemVenta:i=>i.costoTotalCompra??i.costoUnitarioCompra*i.qty,_rentIngresoNetoVenta:s=>s.subtotal,SVGuardedWrites:{equal:require('../js/core/guarded-writes').equal,restTransaction:async(p,fn)=>{assert.notEqual(p,'sisventas');const [,group,key]=p.split('/');const n=fn(structuredClone(db[group][key]));if(p.endsWith('/L')&&n.aplicacionExteriorId&&fail){fail=false;throw Error('corte');}db[group][key]=n;return {committed:true};}}}};
 loadController(c);
 return {c,db,list:{fbKey:'L',ventaFbKey:'S'},snapshot:{version:6,exteriorAppliedAt:123,parameters:{usd:100},rows:[{code:'P',sourceLine:0,needed:1,qty:1,method:'exterior',agreed:2,providerKey:'F',provider:'Flytec'}]}};
}
test('un corte al finalizar retoma sin duplicar auditoría ni costo y conserva pago concurrente',async()=>{
 const {c,db,list,snapshot}=fixture();await assert.rejects(c.savePreparationAndSaleCosts(list,snapshot,{}),/corte/);
 assert.equal(db.ventas.S.costoTotal,200);assert.ok(db.listas_materiales.L.aplicacionExteriorPendiente);db.ventas.S.pagado=100;
 await c.savePreparationAndSaleCosts(list,{...snapshot,exteriorAppliedAt:456},{});
 assert.equal(db.ventas.S.audit.length,2);assert.equal(db.ventas.S.pagado,100);assert.equal(db.ventas.S.items[0].costoUnitarioAntesPreparacion,500);assert.equal(db.listas_materiales.L.aplicacionExteriorPendiente,undefined);assert.equal(db.listas_materiales.L.simuladorParaguay.exteriorAppliedAt,123);
});
