'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Policy=require('../cotizador/expense-removal-policy');
const {digest}=require('../cotizador/labor-guard');
const clone=value=>structuredClone(value);
function fixture({expense={},accounts={}}={}){
 const actor={uid:'admin-ficticio',mode:'user',role:'admin',financialAction:'gastos.eliminar'},key='gasto-ficticio',path='sisventas/gastos/'+key,auditKey='audit-ficticio',auditPath='sisventas/auditoria_pagos/'+auditKey;
 const current={fecha:'2026-10-22',descripcion:'Gasto ficticio',monto:100,montoPagado:0,estado:'pendiente_pago',...clone(expense)},values={[path]:current,[auditPath]:null};
 const employees=Policy.employeeKeys(current);
 for(const employee of employees)values['sisventas/ctaemp/'+employee]=clone(accounts[employee]??null);
 const refs=Policy.linkedMovements(values,employees,current,key),logical=Policy.hasEconomicHistory(current)||refs.some(ref=>Policy.hasEconomicHistory(ref.mov));
 const audit={accion:logical?'baja_administrativa_gasto':current.tipoPagable==='adelanto'||/^adelanto_personal/.test(current.origen||'')?'eliminar_adelanto_vinculado':'eliminar_gasto',gastoFbKey:key,gastoAnterior:clone(current),movimientosAnteriores:clone(refs),uid:actor.uid,usuario:'Administrador ficticio',ts:1792700000000};
 const patch=logical?{[path+'/'+Policy.markerField]:{uid:actor.uid,usuario:audit.usuario,ts:audit.ts,auditKey},[auditPath]:audit}:{[path]:null,...Object.fromEntries(refs.map(ref=>['sisventas/ctaemp/'+ref.empKey+'/'+ref.key,null])),[auditPath]:audit};
 const body={id:'expense-removal-ficticio',kind:'atomic',purpose:'expense-removal',path:'',value:clone(patch),expectedHashes:Object.fromEntries(Object.entries(values).map(([source,value])=>[source,digest(value)]))};
 return {actor,key,path,auditKey,auditPath,values,body,patch,current,refs,validate(){return Policy.validateRemoval(this);},rehash(){this.body.expectedHashes=Object.fromEntries(Object.keys(this.body.expectedHashes).map(source=>[source,digest(this.values[source])]));}};
}
test('describe acota exactamente gasto, cuentas y auditoría sin raíces',()=>{
 const f=fixture({expense:{empleadoFbKey:'e2',empleadoId:'e1',legacyKey:'ctaemp/e3/m'}}),description=Policy.describe(f.body);
 assert.deepEqual(description,{key:f.key,path:f.path,auditKey:f.auditKey,auditPath:f.auditPath,accounts:['e1','e2','e3'],paths:[f.path,'sisventas/ctaemp/e1','sisventas/ctaemp/e2','sisventas/ctaemp/e3',f.auditPath]});
 assert.equal(Policy.markerField,'bajaAdministrativa');
});
test('un gasto impagado sólo puede eliminarse físicamente con auditoría exacta',()=>{
 const f=fixture(),before=clone({current:f.current,values:f.values,patch:f.patch});
 assert.deepEqual(f.validate(),{mode:'physical',key:f.key,refs:[]});
 assert.deepEqual(f.current,before.current);assert.deepEqual(f.values,before.values);assert.deepEqual(f.patch,before.patch);
});
test('la baja lógica conserva el historial y sólo admite marker hijo más auditoría',()=>{
 const f=fixture({expense:{montoPagado:100,estado:'pagado',pagos:{p:{monto:100,fecha:'2026-10-22',comprobante:{nombre:'Ficticio.pdf'}}}}}),before=clone(f.values);
 assert.equal(f.validate().mode,'logical');assert.deepEqual(f.values,before);assert.equal(f.patch[f.path],undefined);assert.equal(Object.keys(f.patch).length,2);
 f.patch={[f.path]:{...clone(f.current),bajaAdministrativa:f.patch[f.path+'/bajaAdministrativa']},[f.auditPath]:f.patch[f.auditPath]};assert.throws(()=>f.validate(),{statusCode:400});
});
for(const expense of [
 {montoPagado:1},{saldoPagadoLegacy:1},{estado:'Pagado'},{estado:'pagada'},{estado:'pagado_parcial'},
 {pagos:{p:{monto:1}}},{montoCompensado:1},{adelantoCompensado:1},{compensaciones:{'2026_10':1}},{adelantosAplicados:{a:{monto:1}}}
])test('historia económica impide purga física: '+JSON.stringify(expense),()=>{
 const f=fixture({expense});assert.equal(f.validate().mode,'logical');f.patch[f.path]=null;delete f.patch[f.path+'/bajaAdministrativa'];assert.throws(()=>f.validate(),{statusCode:400});
});
test('pagos anulados con contadores vacíos conservan la eliminación física anterior',()=>{
 const f=fixture({expense:{estado:'pagado',pagos:{p1:{monto:50,anulado:true},p2:{monto:50,estado:'Anulado'}},montoPagado:0,saldoPagadoLegacy:0}});assert.equal(f.validate().mode,'physical');
 assert.equal(Policy.hasEconomicHistory({pagos:{p:{monto:2,anulado:true}},montoCompensado:2}),true);
});
test('un pago positivo no se oculta por un importe negativo ni por estado anulado del gasto',()=>{
 const f=fixture({expense:{estado:'anulado',pagos:{p:{monto:100},correccion:{monto:-100}}}});assert.equal(f.validate().mode,'logical');
});
test('pago o compensación de cualquier movimiento vinculado obliga a baja lógica',()=>{
 for(const history of [{pagos:{p:{monto:25}}},{estado:'Pagado'},{montoCompensado:50}]){
  const f=fixture({expense:{empleadoId:'e'},accounts:{e:{m:{tipo:'adelanto',gastoFbKey:'gasto-ficticio',...history},otro:{montoPagado:99}}}}),before=clone(f.values);
  assert.equal(f.validate().mode,'logical');assert.deepEqual(f.values,before);assert.equal(f.patch['sisventas/ctaemp/e/m'],undefined);
 }
});
test('la historia de un movimiento ajeno no impide eliminar un gasto sin pagos',()=>{
 const f=fixture({expense:{empleadoId:'e'},accounts:{e:{otro:{montoPagado:99,gastoFbKey:'otro-gasto'}}}});assert.equal(f.validate().mode,'physical');
});
test('eliminación física incluye todos los vínculos exactos ordenados por ASCII',()=>{
 const f=fixture({expense:{empleadoId:'e',empleadoFbKey:'E',legacyKey:'ctaemp/e/z',movimientoCtaKey:'A'},accounts:{e:{z:{tipo:'gasto_empresa'},A:{tipo:'otro'},x:{gastoKey:'gasto-ficticio'}},E:{b:{gastoFbKey:'gasto-ficticio'}}}});
 assert.equal(f.validate().mode,'physical');assert.deepEqual(f.refs.map(ref=>ref.empKey+'/'+ref.key),['E/b','e/A','e/x','e/z']);
 for(const ref of f.refs)assert.equal(f.patch['sisventas/ctaemp/'+ref.empKey+'/'+ref.key],null);
 delete f.patch['sisventas/ctaemp/e/x'];assert.throws(()=>f.validate(),{statusCode:400});
});
test('cuentas numéricas RTDB aceptan arrays con huecos sin fabricar vínculos',()=>{
 const f=fixture({expense:{empleadoId:'e'},accounts:{e:[{gastoFbKey:'gasto-ficticio'},null,{tipo:'otro'}]}});assert.deepEqual(f.validate().refs.map(ref=>ref.key),['0']);
});
for(const type of ['bonificacion','adelanto'])test(type+' impagado sin vínculo requiere revisión; pagado no borra la proyección ausente',()=>{
 const f=fixture({expense:{tipoPagable:type,empleadoId:'e'}});assert.throws(()=>f.validate(),{statusCode:409});
 const paid=fixture({expense:{tipoPagable:type,empleadoId:'e',montoPagado:100}});assert.equal(paid.validate().mode,'logical');
});
test('adelanto impagado vinculado usa la acción de auditoría específica',()=>{
 const f=fixture({expense:{tipoPagable:'adelanto',empleadoId:'e'},accounts:{e:{a:{gastoFbKey:'gasto-ficticio'}}}});assert.equal(f.validate().mode,'physical');assert.equal(f.patch[f.auditPath].accion,'eliminar_adelanto_vinculado');
});
for(const actorChange of [{mode:'server'},{role:'administrativo'},{financialAction:'gastos.administrar'},{uid:''},null])test('rechaza actor fuera del contrato: '+JSON.stringify(actorChange),()=>{
 const f=fixture();f.actor=actorChange===null?null:{...f.actor,...actorChange};assert.throws(()=>f.validate(),{statusCode:403});
});
for(const variant of ['purpose','kind','root-expense','root-account','other-expense','other-audit','child-account','foreign-domain','missing-expense','missing-audit','bad-hash'])test('comparación rechaza alcance no permitido: '+variant,()=>{
 const f=fixture(),expected=f.body.expectedHashes;
 if(variant==='purpose')f.body.purpose='other';if(variant==='kind')f.body.kind='patch';
 const extras={'root-expense':'sisventas/gastos','root-account':'sisventas/ctaemp','other-expense':'sisventas/gastos/otro','other-audit':'sisventas/auditoria_pagos/otro','child-account':'sisventas/ctaemp/e/m','foreign-domain':'sisventas/ventas/v'};
 if(extras[variant])expected[extras[variant]]=digest(null);
 if(variant==='missing-expense')delete expected[f.path];if(variant==='missing-audit')delete expected[f.auditPath];if(variant==='bad-hash')expected[f.path]='fake';
 assert.throws(()=>f.validate(),{statusCode:400});
});
test('cuentas CAS deben coincidir con las identidades actuales del gasto',()=>{
 for(const variant of ['extra','missing','changed']){
  const f=fixture({expense:{empleadoId:'e'}});
  if(variant==='extra'){f.values['sisventas/ctaemp/foreign']=null;f.body.expectedHashes['sisventas/ctaemp/foreign']=digest(null);}
  if(variant==='missing')delete f.body.expectedHashes['sisventas/ctaemp/e'];
  if(variant==='changed'){f.values[f.path].empleadoId='new';f.rehash();}
  assert.throws(()=>f.validate(),{statusCode:409});
 }
});
test('cualquier cambio del gasto o cuenta completa invalida CAS, incluso vínculo nuevo',()=>{
 for(const source of ['expense','account']){
  const f=fixture({expense:{empleadoId:'e'},accounts:{e:{}}});if(source==='expense')f.values[f.path].monto=200;else f.values['sisventas/ctaemp/e'].new={gastoFbKey:f.key,montoPagado:50};
  assert.throws(()=>f.validate(),{statusCode:409,code:'SV_CAS_CONFLICT'});
 }
});
test('no reutiliza auditoría ocupada aun con hash actualizado',()=>{
 const f=fixture();f.values[f.auditPath]={accion:'anterior'};f.rehash();assert.throws(()=>f.validate(),{statusCode:409});
});
for(const variant of ['uid','source','refs','action','extra','fraction','infinite','negative'])test('auditoría rechaza evidencia alterada: '+variant,()=>{
 const f=fixture(),audit=f.patch[f.auditPath];
 if(variant==='uid')audit.uid='other';if(variant==='source')audit.gastoAnterior.monto=999;if(variant==='refs')audit.movimientosAnteriores=[{empKey:'e',key:'fake',mov:{}}];if(variant==='action')audit.accion='baja_administrativa_gasto';if(variant==='extra')audit.extra=true;if(variant==='fraction')audit.ts=1.1;if(variant==='infinite')audit.ts=Infinity;if(variant==='negative')audit.ts=-1;
 assert.throws(()=>f.validate(),{statusCode:400});
});
for(const variant of ['uid','user','time','auditKey','extra','movement','expense-field','outside'])test('baja lógica rechaza mutaciones adicionales: '+variant,()=>{
 const f=fixture({expense:{montoPagado:100}}),marker=f.patch[f.path+'/bajaAdministrativa'];
 if(variant==='uid')marker.uid='other';if(variant==='user')marker.usuario='other';if(variant==='time')marker.ts++;if(variant==='auditKey')marker.auditKey='other';if(variant==='extra')marker.extra=true;if(variant==='movement')f.patch['sisventas/ctaemp/e/m']=null;if(variant==='expense-field')f.patch[f.path+'/pagos']=null;if(variant==='outside')f.patch['sisventas/comisiones_generacion/control']=null;
 assert.throws(()=>f.validate(),{statusCode:400});
});
test('un registro ya retirado no se vuelve a retirar ni se purga aunque esté impagado',()=>{
 for(const value of [{uid:'prior',ts:1},false,null]){
  const f=fixture({expense:{bajaAdministrativa:value}});assert.throws(()=>f.validate(),{statusCode:409});
 }
});
test('validación no modifica ninguna fuente, patch ni cuerpo',()=>{
 const f=fixture({expense:{empleadoId:'e',tipoPagable:'sueldo',adelantoCompensado:50},accounts:{e:{m:{gastoFbKey:'gasto-ficticio',compensaciones:{'2026_10':50}}}}}),before=clone({values:f.values,patch:f.patch,body:f.body});f.validate();assert.deepEqual({values:f.values,patch:f.patch,body:f.body},before);
});
