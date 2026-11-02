'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),api=require('../js/core/ot-sale-completion.v1'),M=require('../cotizador/record-list-model');
const clone=v=>structuredClone(v),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function fixture(){const c={window:{prodData:{},tienePermiso:()=>false},document:{getElementById:()=>null}};vm.createContext(c);vm.runInContext(fs.readFileSync('js/modules/ot-material-custody.js','utf8'),c);
 const ot={fbKey:'ot-fixture',id:'OT-FICTICIA',estado:'con_observaciones',cierreConObservaciones:true,progreso:100,fechaCierre:'2026-10-07',custodiaIniciada:true,custodiaRendida:true,firmada:true,firmaClienteUrl:'https://fixture.invalid/signature',conformidadCliente:'conforme',nombreConformidad:'Persona ficticia',observacionesCierre:'Conservar original',ventaFbKey:'sale-fixture',ventaId:'#SP-FICTICIA',_svListRevision:2,materiales:[{cod:'P-FICTICIO',desc:'Equipo ficticio',vendida:1,custodiaActiva:true,entregada:1,instalada:0,devuelta:1}],audit:[{accion:'Cierre histórico'}]};
 const sale={fbKey:'sale-fixture',id:'#SP-FICTICIA',otId:'ot-fixture',estadoInst:'en_instalacion',total:96000,pagado:96000,items:[{qty:1,punit:96000,costoUnitarioCompra:30000}],audit:[{accion:'Venta original'}]};
 const args=()=>({ot,sale,others:{},custody:c.window.otCustodiaValidarCierre(ot),summary:c.window.otCustodiaResumen(ot),actor:{uid:'admin-fixture',role:'admin',name:'Admin ficticio'},at:'2026-11-01T12:00:00Z'});
 return {ot,sale,c,args};}
const {createLaborGuard,child,parts,put,digest}=require('../cotizador/labor-guard'),{createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
test('helper guarda por gateway y guard reales con resumen OT y sin movimientos',async()=>{
 const f=fixture(),clean=v=>{const r=clone(v);delete r.fbKey;return r;},op='sisventas/ordenes_trabajo/'+f.ot.fbKey,sp='sisventas/ventas/'+f.sale.fbKey;
 let state={sv_labor_config:{schema:1,ready:true},sv_record_list_config:{schema:1,ready:true}};
 state=put(state,parts(op),clean(f.ot));state=put(state,parts(sp),clean(f.sale));
 state=put(state,parts(api.INDEX),{_svCoverage:{schema:1,ready:true,baselineCount:1,sourceHash:'a'.repeat(64)},[f.ot.fbKey]:M.summary('ordenes_trabajo',clean(f.ot))});
 const read=p=>child(state,parts(p)),set=(p,v)=>{state=put(state,parts(p),v);},commits=[];
 const store={read:async p=>read(p),acquire:async l=>set('sv_labor_guard',l),abort:async()=>set('sv_labor_guard',null),commit:async patch=>{commits.push(clone(patch));for(const [p,v]of Object.entries(patch))set(p,v);},readAsUser:async p=>read(p)};
 const guard=createLaborGuard({store,operationalSummaries:true,delay:async()=>{}}),db={ref:p=>({get:async()=>({val:()=>read(p)})})};
 const gateway=createLaborWriteGateway({auth:{},db,guard,store,enabled:true});
 const root={currentUserUid:'fixture-admin',currentRole:'admin',currentUser:'Fixture',fbAuth:{currentUser:{uid:'fixture-admin'}},SVRecordListModel:M,SVGuardedWrites:{equal},otCustodiaValidarCierre:f.c.window.otCustodiaValidarCierre,otCustodiaResumen:f.c.window.otCustodiaResumen,SVLaborWrites:{atomic:async({paths,build})=>{
  const values=Object.fromEntries(paths.map(p=>[p,read(p)])),patch=build(values);if(patch===undefined)return {committed:false};
  const result=await gateway.write({uid:'fixture-admin',claims:{uid:'fixture-admin'}},{id:'ot-completion-fixture-command',kind:'atomic',path:'',value:patch,expectedHashes:Object.fromEntries(paths.map(p=>[p,digest(values[p])]))});return result;
 }}};
 const result=await api.save(root,f);assert.equal(result.committed,true);assert.equal(commits.length,1);assert.equal(read(sp).estadoInst,'instalado');assert.equal(read(op).estado,'completada');assert.equal(read(api.INDEX+'/'+f.ot.fbKey).estado,'completada');assert.equal(read(op)._svListRevision,3);
 assert.deepEqual(read(op).materiales,f.ot.materiales);assert.equal(read(op).firmaClienteUrl,f.ot.firmaClienteUrl);assert.equal(read(op).fechaCierre,f.ot.fechaCierre);assert.deepEqual(read(sp).items,f.sale.items);assert.equal(read(sp).total,f.sale.total);
 assert.equal(Object.keys(commits[0]).some(p=>/inventario|stock|pagos\//.test(p)),false);
});
