'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLaborGuard,parts,child,put}=require('../cotizador/labor-guard'),{createLaborBootstrap}=require('../cotizador/labor-bootstrap');
function setup(){let n=0,data={sisventas:{gastos:{g:{empleadoId:' e ',monto:10,fecha:'2026-10-01'}},hsextra_solicitudes:{r:{empFbKey:'e',mes:'2026-10',aportes:{a:{horas:2}}}},productos:{big:'x'.repeat(50000)}}};const calls={reads:[],patches:[]};const store={read:async p=>{calls.reads.push(p);return child(data,parts(p));},acquire:async lease=>{data=put(data,['sv_labor_guard'],lease);},abort:async()=>{delete data.sv_labor_guard;},commit:async patch=>{calls.patches.push(structuredClone(patch));for(const [p,v]of Object.entries(patch))data=put(data,parts(p),v);}};const guard=createLaborGuard({store,uuid:()=> 'bootstrap-'+(++n)});return {guard,calls,get data(){return data;}};}
test('preparación única crea sólo metadata y hashes, sin leer ni copiar ventas/fotos/CTA ni modificar negocio',async()=>{
 const f=setup(),before=JSON.stringify(f.data.sisventas),result=await createLaborBootstrap({guard:f.guard})();assert.equal(result.ready,true);assert.equal(result.source.gastos.records,1);assert.equal(JSON.stringify(f.data.sisventas),before);assert.ok(Object.keys(f.data.sv_labor_indexes).length);assert.equal(f.calls.patches.length,1);assert.ok(Object.keys(f.calls.patches[0]).every(key=>key.startsWith('sv_labor_')));assert.equal(f.calls.reads.includes('sisventas'),false);assert.equal(f.calls.reads.some(p=>p.includes('productos')),false);
});
test('una preparación repetida o sobredimensionada se rechaza antes del PATCH de metadata',async()=>{
 const f=setup();await createLaborBootstrap({guard:f.guard})();const before=JSON.stringify(f.data);await assert.rejects(createLaborBootstrap({guard:f.guard})(),{statusCode:409});assert.equal(JSON.stringify(f.data),before);assert.equal(f.calls.patches.length,1);
 const other=setup();await assert.rejects(createLaborBootstrap({guard:other.guard,maxIndexBytes:1})(),{statusCode:413});assert.equal(other.calls.patches.length,0);assert.equal(other.data.sv_labor_config,undefined);
});
