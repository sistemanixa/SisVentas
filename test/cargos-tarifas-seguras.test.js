const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const app=fs.readFileSync('js/app.v3.5.4.js','utf8');
const code=app.slice(app.indexOf('function _cargoNumeroEstricto'),app.indexOf('function _cargoNumeroPantalla'));
const ctx={}; vm.createContext(ctx); vm.runInContext(code,ctx);
const base={nombre:'Técnico',valorHora:6450,valorHoraExtra:6200,diasMes:23,comision:5};
const registro={ts:123,usuario:'Prueba',version:'test'};
const edit={valorHora:6500,valorHoraExtra:6200,diasMes:23};
let result=ctx._cargoAplicarCambio(base,base,edit,false,registro,'a');
assert.equal(result.valorHoraExtra,6200,'Cambiar hora normal no cambia extra');
assert.equal(result.comision,5,'Conserva otros campos');
assert.equal(result.historialValorHora.a.anterior,6450);
assert.equal(result.historialCambios.a_valorHora.nuevo,6500);
assert.equal(ctx._cargoAplicarCambio({...base,valorHoraExtra:8000},base,edit,false,registro,'b'),undefined,'Rechaza tarifa concurrente');
assert.equal(ctx._cargoAplicarCambio(null,base,edit,false,registro,'b'),undefined,'No recrea cargo eliminado');
assert.equal(ctx._cargoAplicarCambio(base,null,edit,true,registro,'b'),undefined,'No reemplaza cargo creado simultáneamente');
result=ctx._cargoAplicarCambio(base,base,{valorHoraExtra:7000},false,registro,'c');
assert.equal(result.historialCambios.c_valorHoraExtra.anterior,6200);
assert.equal(result.historialCambios.c_valorHoraExtra.nuevo,7000);
assert.equal(result.historialCambios.c_valorHoraExtra.usuario,'Prueba');
assert.equal(result.historialValorHora,undefined,'Extra no dispara aviso de aumento de hora normal');
assert.equal(base.valorHoraExtra,6200,'No muta base de edición');
for(const invalid of ['', '9.700', '9.700,50', '-5', 'abc', '65xyz',Infinity]) assert.ok(Number.isNaN(ctx._cargoNumeroEstricto(invalid)));
assert.equal(ctx._cargoNumeroEstricto('9700,50'),9700.5);
assert.equal(ctx._cargoNumeroEstricto(0),0);
// Ejercitar guardado, reintento de transacción y falta de permisos sin datos reales.
(async()=>{
 let writes=0;
 Object.assign(ctx,{esAdmin:()=>true,currentUser:'Prueba',APP_CONFIG:{VERSION:'test'},window:{
 fbDB:{},fbRef:(_,p)=>p,fbPush:()=>({key:'k'}),fbGet:async()=>({val:()=>base}),
 fbRunTransaction:async(_,fn)=>{writes++; assert.ok(fn(base)); return {committed:!!fn({...base,valorHoraExtra:8000})};}
 }});
 await assert.rejects(ctx._cargoGuardarSeguro('tecnico',edit,base,false),/otra sesión/);
 assert.equal(writes,1);
 await assert.rejects(ctx._cargoGuardarSeguro('tecnico',{valorHoraExtra:NaN},base,false),/inválido/);
 ctx.esAdmin=()=>false;
 await assert.rejects(ctx._cargoGuardarSeguro('tecnico',edit,base,false),/administrador/);
 assert.equal(writes,1);
 console.log('OK: independencia, concurrencia, historial, entradas inválidas y permisos');
})().catch(e=>{console.error(e);process.exitCode=1;});
