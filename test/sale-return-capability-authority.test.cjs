const test=require('node:test'),assert=require('node:assert/strict');
const Server=require('../cotizador/sale-return-to-budget'),Client=require('../js/core/sale-return-capability.v1.js'),Transition=require('../js/core/sale-budget-transition.v1.js');
const {load}=require('./helpers/app-functions.cjs');
test('format-valid digest is configuration evidence, not proof of deployed rule authority',()=>{
 assert.equal(Server.capability().enabled,false);
 const arbitraryDigest='a'.repeat(64),saleReturn=Server.capability({enabled:true,coordinated:true,rulesDigest:arbitraryDigest});
 assert.equal(saleReturn.rules.verified,true);
 assert.equal(Client.validate({ok:true,revision:'fixture-only',saleReturn}).rulesDigest,arbitraryDigest);
 assert.equal(Server.capability({enabled:true,coordinated:true,rulesDigest:'invalid'}).enabled,false);
});
for(const mode of ['disabled','network','auth','role','revision'])test('real app rejects '+mode+' capability before counter and atomic path reads',async()=>{
 const calls=[],actor={auth:'A',role:'admin',revision:1},capture=()=>({...actor});
 const own={captureWriteContext:capture,isWriteContext:context=>JSON.stringify(context)===JSON.stringify(actor)};
 const context=load({window:{tienePermiso:()=>true,fbDB:{},SVCommercialOwnership:own,SVSaleReturnCapability:Client,SVLaborWrites:{atomic:async()=>calls.push('atomic')},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async()=>({})},fetch:async()=>{calls.push('capability');if(mode==='network')throw Error('fixture offline');return {ok:true,json:async()=>{if(mode==='auth')actor.auth='B';if(mode==='role')actor.role='vendedor';if(mode==='revision')actor.revision++;return {ok:true,revision:'fixture',saleReturn:Server.capability()};}};}},console:{warn(){}},_svResolverVentaRegistro:()=>({fbKey:'sale-ficticia'}),svConfirm:async()=>true,reservarSiguientePptoId:async()=>calls.push('reserve'),notify:()=>calls.push('notice')},['_svCargaOperacion_moverVentaAPresupuesto']);
 await context._svCargaOperacion_moverVentaAPresupuesto('sale-ficticia');
 assert.deepEqual(calls,['capability','notice']);
});
test('native corrected budget never inherits sale percentage interpretation from its origin link',()=>{
 const record={ventaOrigenFbKey:'sale-ficticia',items:[{qty:1,punit:100,sub:100}],subtotal:100,descuento:5,descuentoGeneral:5,descuentoAmt:5,conIva:false,iva:0,total:95};
 assert.equal(Transition.toBudget(record,{sourceFormat:'budget'}).total,95);assert.throws(()=>Transition.toBudget(record,{sourceFormat:'sale'}),/semántica propia/);
});
