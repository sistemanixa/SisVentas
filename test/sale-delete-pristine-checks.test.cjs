'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm');
const Activity=require('../cotizador/sale-delete-activity');
const {readActiveApp}=require('./helpers/active-app');
function generatedOT(){
 const source=readActiveApp().source,start=source.indexOf('function generarOTdesdeVenta('),end=source.indexOf('\n// Inicializar al entrar al módulo',start);a(start>=0&&end>start);
 let saved;const context={ventasList:[],otData:[],CHECKLISTS:{preparacion:['Antes'],instalacion:['A','B'],verificacion:['Después']},_contarVisitasPrevias:()=>0,fbGuardarOT:async ot=>{saved=ot;return 'fixture-ot';},window:{}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);context.generarOTdesdeVenta('V-FICTICIA','Persona ficticia','Dirección ficticia');a(saved);return structuredClone(saved);
}
const validate=ot=>Activity.validate(async()=>({}),{fbKey:'sale-fixture'},{ot});
test('active application creator produces untouched three-phase false checklist eligible for cascade',async()=>{
 const ot=generatedOT(),before=JSON.stringify(ot);await validate(ot);a.equal(JSON.stringify(ot),before);a.deepEqual(Object.keys(ot.checks).sort(),['instalacion','preparacion','verificacion']);a(ot.checks.instalacion.every(value=>value===false));
});
for(const mutation of ['true','hole','nullPhase','nullChecks','extraPhase','string','missingPhase','arrayExtra','nestedUnknown'])test('generated checklist rejects '+mutation+' without defaults',async()=>{
 const ot=generatedOT();
 if(mutation==='true')ot.checks.instalacion[0]=true;
 if(mutation==='hole')delete ot.checks.instalacion[0];
 if(mutation==='nullPhase')ot.checks.instalacion=null;
 if(mutation==='nullChecks')ot.checks=null;
 if(mutation==='extraPhase')ot.checks.extra=[];
 if(mutation==='string')ot.checks.instalacion[0]='false';
 if(mutation==='missingPhase')delete ot.checks.preparacion;
 if(mutation==='arrayExtra')ot.checks.instalacion.extra=false;
 if(mutation==='nestedUnknown')ot.checks.instalacion[0]={value:false};
 await a.rejects(validate(ot),{code:'SV_SALE_DELETE_OT_PHYSICAL',statusCode:409});
});
test('valid planned checklist remains AND with shared OT no-activity policy',async()=>{
 const ot=generatedOT();ot.notasTecnico={nota:{texto:'Trabajo registrado'}};await a.rejects(validate(ot),{code:'SV_OT_DELETE_ACTIVITY',statusCode:409});
});
test('no exception is introduced for unknown installation dates or physical fields',async()=>{
 for(const field of ['fechaInstalacion','instalacionPactada','stockUnknown']){const ot=generatedOT();ot[field]='2026-12-01';await a.rejects(validate(ot),{code:'SV_SALE_DELETE_OT_PHYSICAL',statusCode:409});}
});
