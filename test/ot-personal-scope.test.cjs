'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope=require('../js/core/ot-personal-scope.js');
const employee=()=>({fbKey:'employee-demo',id:17,codigo:'TECH-DEMO',nombre:'Técnico Ejemplo',apellidoNombre:'Ejemplo, Técnico'});
const other=()=>({fbKey:'employee-other',id:18,codigo:'TECH-OTHER',nombre:'Otra Persona'});

test('normalize compara acentos, mayúsculas y espacios sin convertir objetos en nombres',()=>{
 assert.equal(scope.normalize('  TÉCNICO\t  Ejémplo  '),'tecnico ejemplo');
 for(const value of [null,undefined,{},[],true,17])assert.equal(scope.normalize(value),'');
 assert.equal(scope.normalize('Ejemplo, Técnico'),'ejemplo, tecnico');
});

test('exporta la misma API pura en CommonJS y en el navegador',()=>{
 const window={},source=fs.readFileSync('js/core/ot-personal-scope.js','utf8');
 const sandbox={window,fetch(){assert.fail('Sin consultas de red');},localStorage:{setItem(){assert.fail('Sin almacenamiento');}}};
 vm.runInNewContext(source,sandbox);
 assert.equal(typeof window.SVOTPersonalScope.assigned,'function');assert.equal(typeof window.SVOTPersonalScope.normalize,'function');
 const emp=employee();assert.equal(window.SVOTPersonalScope.assigned({tecnicoFbKey:emp.fbKey},emp),true);assert.ok(Object.isFrozen(scope));
});

for(const field of ['fbKey','id','codigo'])test('una clave explícita reconoce el alias laboral '+field,()=>{
 const emp=employee();assert.equal(scope.assigned({tecnicoFbKey:emp[field]},emp),true);assert.equal(scope.assigned({tecnicoFbKey:String(emp[field])},emp),true);
});

test('claves de texto se recortan y cero numérico es una identidad válida',()=>{
 const emp=employee();assert.equal(scope.assigned({tecnicoFbKey:'  employee-demo  '},emp),true);
 assert.equal(scope.assigned({tecnicoFbKey:0},{fbKey:'0'}),true);assert.equal(scope.assigned({tecnicoFbKey:'0'},{id:0}),true);
 assert.equal(scope.assigned({tecnicoFbKey:'EMPLOYEE-DEMO'},emp),false);
});

test('una reasignación explícita ajena prevalece sobre el nombre anterior y claves inferiores',()=>{
 const emp=employee();assert.equal(scope.assigned({tecnicoFbKey:'employee-other',empleadoFbKey:emp.fbKey,tecnicoKey:emp.id,tecnico:emp.nombre},emp,[emp,other()]),false);
 assert.equal(scope.assigned({tecnicoFbKey:emp.fbKey,empleadoFbKey:'employee-other',tecnico:'Otra Persona'},emp,[emp,other()]),true);
 assert.equal(scope.assigned({empleadoFbKey:'employee-other',tecnicoKey:emp.codigo,tecnico:emp.nombre},emp,[emp]),false);
});

for(const field of ['empleadoFbKey','tecnicoKey'])test('conserva asignación heredada mediante '+field,()=>{
 const emp=employee();assert.equal(scope.assigned({[field]:emp.fbKey},emp),true);
});

for(const empty of ['', '  ',null,undefined])test('un default vacío '+String(empty)+' permite la siguiente clave y el nombre legacy',()=>{
 const emp=employee();assert.equal(scope.assigned({tecnicoFbKey:empty,empleadoFbKey:emp.fbKey},emp),true);
 assert.equal(scope.assigned({tecnicoFbKey:empty,empleadoFbKey:empty,tecnicoKey:empty,tecnico:emp.nombre},emp,[emp]),true);
});

for(const invalid of [{},[],true,false,NaN,Infinity,-Infinity])test('clave malformada '+String(invalid)+' no cae a otra clave ni al nombre',()=>{
 const emp=employee();assert.equal(scope.assigned({tecnicoFbKey:invalid,empleadoFbKey:emp.fbKey,tecnico:emp.nombre},emp,[emp]),false);
 assert.equal(scope.assigned({tecnicoFbKey:null,empleadoFbKey:invalid,tecnicoKey:emp.fbKey,tecnico:emp.nombre},emp,[emp]),false);
});

test('una clave con controles es inválida y no abre el fallback histórico',()=>{
 const emp=employee();assert.equal(scope.assigned({tecnicoFbKey:'employee\u0000-demo',tecnico:emp.nombre},emp,[emp]),false);
});

test('el nombre legacy admite normalización y el alias apellidoNombre',()=>{
 const emp=employee();assert.equal(scope.assigned({tecnico:'  TECNICO   EJEMPLO '},emp,[emp,other()]),true);
 assert.equal(scope.assigned({tecnicoNombre:'Ejemplo, Tecnico'},emp,{current:emp,other:other()}),true);
 assert.equal(scope.assigned({tecnico:' ',tecnicoNombre:'TECNICO EJEMPLO'},emp,[emp]),true);
 assert.equal(scope.assigned({tecnico:'Otra Persona'},emp,[emp,other()]),false);
});

test('el nombre legacy homónimo se deniega, mientras una clave explícita sigue siendo inequívoca',()=>{
 const emp=employee(),homonym={...other(),nombre:'  TECNICO EJEMPLO '};
 assert.equal(scope.assigned({tecnico:emp.nombre},emp,[emp,homonym]),false);
 assert.equal(scope.assigned({tecnicoFbKey:emp.fbKey,tecnico:emp.nombre},emp,[emp,homonym]),true);
 assert.equal(scope.assigned({tecnico:emp.nombre},emp,[emp,{...emp}]),true);
});

test('no confunde identidades distintas por compartir un código secundario',()=>{
 const emp=employee(),homonym={...other(),nombre:emp.nombre,codigo:emp.codigo};
 assert.equal(scope.assigned({tecnico:emp.nombre},emp,[emp,homonym]),false);
 assert.equal(scope.assigned({tecnico:emp.nombre},emp,[homonym]),false);
});

test('el fallback exige directorio conocido y al menos una ficha coincidente verificable',()=>{
 const emp=employee();
 for(const directory of [undefined,null,[],{},false,'directorio',[[emp]],[{}],[{nombre:emp.nombre}]])assert.equal(scope.assigned({tecnico:emp.nombre},emp,directory),false);
 assert.equal(scope.assigned({tecnico:emp.nombre},emp,[other()]),false);
 assert.equal(scope.assigned({tecnico:emp.nombre},emp,[emp,null,[],{}]),true);
});

test('OT y empleado vacíos, arrays o datos sin identidad no autorizan nada',()=>{
 const emp=employee();for(const invalid of [null,undefined,[],true,'empleado',0]){
  assert.equal(scope.assigned(invalid,emp,[emp]),false);assert.equal(scope.assigned({tecnicoFbKey:emp.fbKey},invalid,[emp]),false);
 }
 for(const invalid of [{},{nombre:emp.nombre},{fbKey:{}},{fbKey:[],nombre:emp.nombre}])assert.equal(scope.assigned({tecnico:emp.nombre},invalid,[invalid]),false);
 assert.equal(scope.assigned({},emp,[emp]),false);assert.equal(scope.assigned({tecnicoNombre:''},emp,[emp]),false);
});

test('no usa nombres de objetos, arrays o booleanos como fallback',()=>{
 const emp=employee();for(const invalid of [{},[],true,false,17])assert.equal(scope.assigned({tecnico:invalid,tecnicoNombre:emp.nombre},emp,[emp]),false);
});

test('no toma claves ni nombres heredados de un prototipo como una asignación',()=>{
 const emp=employee();assert.equal(scope.assigned(Object.create({tecnicoFbKey:emp.fbKey,tecnico:emp.nombre}),emp,[emp]),false);
 assert.equal(scope.assigned({tecnicoFbKey:emp.fbKey},Object.create(emp),[emp]),false);
});

test('no modifica OT, empleado o directorio y todas las comprobaciones son locales',()=>{
 const emp=Object.freeze(employee()),ot=Object.freeze({tecnico:'TÉCNICO EJEMPLO'}),directory=Object.freeze([emp,Object.freeze(other())]);
 const before=JSON.stringify({ot,emp,directory});
 for(let i=0;i<5;i++)assert.equal(scope.assigned(ot,emp,directory),true);
 assert.equal(JSON.stringify({ot,emp,directory}),before);
});
