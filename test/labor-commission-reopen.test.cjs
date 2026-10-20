'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
function fixture(extra={}){
 const gasto={fecha:'2026-10-01',descripcion:'Comisión ficticia',tipo:'Comisión',tipoPagable:'comision',estado:'rechazado',monto:50,pct:5,gananciaBase:1000,empleadoId:'e',ventaFbKey:'v',legacyKey:'ctaemp/e/m',montoPagado:0};
 const move={tipo:'comision',estado:'rechazado',monto:50,pct:5,gananciaBase:1000,gastoFbKey:'g',montoPagado:0};
 const b=createBackend({gastos:{g:gasto,...extra},ctaemp:{e:{m:move}}}),p=b.page();p.refresh();
 p.context.setTimeout=()=>0;vm.runInContext(fs.readFileSync(require.resolve('../js/modules/commissions.js'),'utf8'),p.context);
 return {b,p,gasto,move};
}
test('rehabilitar confirma gasto y cuenta juntos, conserva importes y vuelve a pedir aprobación',async()=>{
 const {b,p}=fixture();await p.context.rehabilitarComision('g');
 assert.equal(b.commits.length,1);assert.equal(b.get('sisventas/gastos/g/estado'),'pendiente_aprobacion');assert.equal(b.get('sisventas/ctaemp/e/m/estado'),'pendiente_aprobacion');
 assert.equal(b.get('sisventas/gastos/g/monto'),50);assert.equal(b.get('sisventas/ctaemp/e/m/monto'),50);assert.equal(b.direct.length,0);assert.ok(p.messages.some(m=>m.startsWith('✓')));
});
test('pago concurrente antes del commit detiene la rehabilitación y conserva ambos pagos',async()=>{
 const {b,p}=fixture();let changed=false;b.setHook(()=>{if(changed)return;changed=true;Object.assign(b.state.sisventas.gastos.g,{estado:'pagado_parcial',montoPagado:20,pagos:{p:{monto:20,fecha:'2026-10-20'}}});Object.assign(b.state.sisventas.ctaemp.e.m,{estado:'pagado_parcial',montoPagado:20,pagos:{p:{monto:20,fecha:'2026-10-20'}}});});
 await p.context.rehabilitarComision('g');assert.equal(b.commits.length,0);assert.equal(b.get('sisventas/gastos/g/montoPagado'),20);assert.equal(b.get('sisventas/ctaemp/e/m/pagos/p/monto'),20);assert.ok(p.messages.some(m=>m.includes('cambió')));
});
test('vínculo modificado obliga a actualizar y no cambia la cuenta anterior',async()=>{
 const {b,p}=fixture();let changed=false;b.setHook(()=>{if(changed)return;changed=true;b.state.sisventas.gastos.g.legacyKey='ctaemp/e/otra';});
 await p.context.rehabilitarComision('g');assert.equal(b.commits.length,0);assert.equal(b.get('sisventas/ctaemp/e/m/estado'),'rechazado');
});
test('el rechazo del servidor conserva gasto y cuenta, sin aviso de éxito',async()=>{
 const {b,p}=fixture(),before=copy(b.state.sisventas);b.setRejectPatch(()=>{throw Object.assign(Error('Permiso ficticio retirado'),{statusCode:403});});
 await p.context.rehabilitarComision('g');assert.deepEqual(b.state.sisventas,before);assert.equal(b.commits.length,0);assert.ok(!p.messages.some(m=>m.startsWith('✓')));
});
test('la rehabilitación también respeta el máximo del grupo completo en el servidor',async()=>{
 const {b,p}=fixture({paid:{fecha:'2026-10-01',tipo:'Comisión',tipoPagable:'comision',ventaFbKey:'v',estado:'pagado',monto:80,montoPagado:80,pct:8}});
 await p.context.rehabilitarComision('g');assert.equal(b.commits.length,0);assert.equal(b.get('sisventas/gastos/g/estado'),'rechazado');assert.ok(p.messages.some(m=>m.includes('máximo')));
});
test('sin permiso no lee ni envía operaciones',async()=>{
 const {b,p}=fixture();p.context.tienePermiso=()=>false;const before=b.reads.length;await p.context.rehabilitarComision('g');assert.equal(b.commands.length,0);assert.equal(b.reads.length,before);
});
