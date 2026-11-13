'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('js/app.v3.10.32.js','utf8'),moduleSource=fs.readFileSync('js/modules/commissions.js','utf8');
function fn(source,name,indent=''){const start=source.indexOf('async function '+name+'(');return source.slice(start,source.indexOf('\n'+indent+'}',start)+indent.length+2);}
test('Comisión manual rechaza venta deshabilitada o sin marca antes de calcular o escribir',async()=>{
 for(const value of [false,undefined]){const notices=[],ctx={_comisionManualGuardando:false,window:{tienePermiso:()=>true},_comisionManualEmpleadoSeleccionado:()=>({fbKey:'e'}),_comisionManualResolverVenta:()=>({comisionHabilitada:value}),document:{getElementById:()=>({value:'v'})},notify:x=>notices.push(x)};
 vm.runInNewContext(fn(app,'guardarComisionManualVenta'),ctx);await ctx.guardarComisionManualVenta();assert.match(notices[0],/Habilitá la comisión/);assert.equal(ctx._comisionManualGuardando,false);}
});
test('Generación automática rechaza las mismas ventas sin abrir una escritura',async()=>{
 for(const value of [false,undefined]){const ctx={window:{fbDB:{}},Promise};vm.runInNewContext(fn(app,'generarComisionesVenta'),ctx);assert.equal((await ctx.generarComisionesVenta({comisionHabilitada:value},100)).length,0);}
});
test('Agregar participante también requiere habilitación explícita en la venta',async t=>{
 const {fixture}=require('./helpers/commissions-participant-native-fixture.cjs');const f=await fixture(t);
 await f.page.evaluate(async()=>{fixtureSale.comisionHabilitada=false;await actualizarDetalleComision()});await f.page.selectOption('#com-nuevo-empleado','e2');await f.page.fill('#com-nuevo-pct','10');await f.page.evaluate(()=>agregarParticipanteComision());
 const trace=await f.report();assert.ok(trace.notices.some(m=>/Habilitá la comisión/.test(m)));assert.equal(trace.creates,0);assert.equal(trace.redistributions,0);
});

test('Las nuevas comisiones automáticas incluyen trazabilidad sin alterar montos',()=>{const fragment=fn(app,'generarComisionesVenta');assert.match(fragment,/origenCarga: 'automatica_venta'/);assert.match(fragment,/usuarioCarga: currentUser/);assert.match(fragment,/monto:\s+monto/);});
