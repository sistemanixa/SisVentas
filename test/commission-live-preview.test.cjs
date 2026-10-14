const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('editar porcentaje actualiza importe individual y resumen sin guardar; pagados permanecen fijos',()=>{
  const src=fs.readFileSync('js/modules/commissions.js','utf8');
  const amount={dataset:{base:'559132.18'},textContent:''};
  const paidAmount={dataset:{base:'559132.18'},textContent:'pagado'};
  const input={value:'10',disabled:false};
  const rows=[{dataset:{estado:'pendiente_aprobacion'},querySelector:s=>s.includes('pct')?input:amount},{dataset:{estado:'pagado'},querySelector:s=>s.includes('pct')?{value:'5',disabled:true}:paidAmount}];
  const els={'com-resumen-margen':{dataset:{neto:'1875862.4',ganancia:'559132.18',max:'25'},style:{}},'com-resumen-reparto':{style:{}},'com-resumen-monto':{},'com-nuevo-pct':{value:''}};
  const ctx={document:{getElementById:id=>els[id],querySelectorAll:()=>rows},moneda:n=>n};vm.createContext(ctx);
  vm.runInContext(src.slice(src.indexOf('  function actualizarResumenMargenComision(){'),src.indexOf('  function abrirVentaDesdeComisiones()')),ctx);
  ctx.actualizarResumenMargenComision();assert.equal(amount.textContent,55913.22);assert.equal(paidAmount.textContent,'pagado');
  input.value='15';ctx.actualizarResumenMargenComision();assert.equal(amount.textContent,83869.83);assert.equal(els['com-resumen-monto'].textContent,559132.18*.2);
});
