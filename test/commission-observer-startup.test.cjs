'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('cotizador/index.js','utf8');
const start=source.indexOf('if (require.main === module) {'),end=source.indexOf('\nmodule.exports =',start);
assert.ok(start>=0&&end>start,'Debe existir el arranque real de Cotizador');
const startup=source.slice(start,end);
function fixture(env,{main=true}={}){
 const calls=[],module={exports:{}},require=()=>assert.fail('No cargar dependencias ni credenciales');require.main=main?module:{};
 const blocked=new Proxy({},{get:()=>assert.fail('No consultar Auth ni base de datos en la prueba de arranque')});
 const context={module,require,process:{env:{...env}},PORT:8882,db:blocked,auth:blocked,fetch:assert.fail,setInterval:assert.fail,setTimeout:assert.fail,
  commissionGeneration:{start:()=>calls.push('observer')},server:{listen(port,ready){assert.equal(port,8882);calls.push('listen');ready();}},console:{log(){}}};
 return {calls,run:()=>vm.runInNewContext(startup,context)};
}

test('eventos habilitados y variable del observador omitida no inician observador por reloj',()=>{
 const f=fixture({COMMISSION_GENERATION_ENABLED:'true',COMMISSION_EVENT_ENABLED:'true'});f.run();assert.deepEqual(f.calls,['listen']);
});

test('false explícito conserva el arranque sólo por eventos',()=>{
 const f=fixture({COMMISSION_GENERATION_ENABLED:'true',COMMISSION_EVENT_ENABLED:'true',COMMISSION_OBSERVER_ENABLED:'false'});f.run();assert.deepEqual(f.calls,['listen']);
});

test('únicamente true explícito permite compatibilidad con el observador',()=>{
 for(const events of [undefined,'true','false']){
  const env={COMMISSION_GENERATION_ENABLED:'true',COMMISSION_OBSERVER_ENABLED:'true'};if(events!==undefined)env.COMMISSION_EVENT_ENABLED=events;
  const f=fixture(env);f.run();assert.deepEqual(f.calls,['observer','listen']);
 }
});

test('valores vacíos, inválidos o booleanos no activan el observador aunque eventos esté habilitado',()=>{
 for(const value of ['', 'TRUE', 'True', '1', 'false ', true, false]){
  const f=fixture({COMMISSION_GENERATION_ENABLED:'true',COMMISSION_EVENT_ENABLED:'true',COMMISSION_OBSERVER_ENABLED:value});f.run();assert.deepEqual(f.calls,['listen']);
 }
});

test('generación activa sin eventos ni observador explícito falla cerrada antes de escuchar',()=>{
 for(const observer of [undefined,'false','','invalid','TRUE'])for(const events of [undefined,'false','invalid']){
  const env={COMMISSION_GENERATION_ENABLED:'true'};if(observer!==undefined)env.COMMISSION_OBSERVER_ENABLED=observer;if(events!==undefined)env.COMMISSION_EVENT_ENABLED=events;
  const f=fixture(env);assert.throws(f.run,/No se puede detener el observador sin habilitar el receptor de eventos/);assert.deepEqual(f.calls,[]);
 }
});

test('generación apagada u omitida no necesita observador ni eventos para arrancar servidor',()=>{
 for(const generation of [undefined,'false']){
  const env={};if(generation!==undefined)env.COMMISSION_GENERATION_ENABLED=generation;
  const f=fixture(env);f.run();assert.deepEqual(f.calls,['listen']);
 }
});

test('importar Cotizador no inicia observador ni servidor, aun con true explícito',()=>{
 const f=fixture({COMMISSION_GENERATION_ENABLED:'true',COMMISSION_OBSERVER_ENABLED:'true'},{main:false});f.run();assert.deepEqual(f.calls,[]);
});
