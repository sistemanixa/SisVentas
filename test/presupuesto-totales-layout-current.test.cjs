'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {render}=require('./helpers/budget-print-fixture.cjs');
for(const detail of [false,true])for(const image of [false,true])for(const long of [false,true])test('budget totals have independent columns and preserve saved amounts '+JSON.stringify({detail,image,long}),async()=>{
 const {html,model}=await render({detail,image,long,many:5});
 const summary=html.match(/<tfoot><tr><td class="ppto-summary-cell" colspan="(\d+)"><table class="ppto-totals" aria-label="Resumen del presupuesto"><tbody>([\s\S]*?)<\/tbody><\/table><\/td><\/tr><\/tfoot>/);
 assert.ok(summary,'One full-width footer contains the independent summary');assert.equal(Number(summary[1]),3+Number(image)+2*Number(detail));
 const rows=[...summary[2].matchAll(/<tr[^>]*>(.*?)<\/tr>/g)];assert.equal(rows.length,4);for(const row of rows){assert.equal((row[1].match(/<td /g)||[]).length,2);assert.match(row[1],/class="ppto-total-label"/);assert.match(row[1],/class="ppto-total-amount"/);assert.doesNotMatch(row[1],/colspan/);}
 assert.match(html,/\.ppto-totals \.ppto-total-amount\{[^}]*white-space:nowrap;overflow-wrap:normal;word-break:normal/);
 const money=n=>n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});for(const n of [model.subtotal,model.descuento,model.iva,model.total])assert.ok(summary[2].includes(money(n)),String(n));
 assert.equal(html.includes('P. unit.'),detail);assert.ok(html.includes('Condiciones ficticias preservadas.'));assert.ok(html.includes('Válido hasta: 2026-11-08'));assert.ok(html.includes('Equivalente:'));
 assert.equal((html.match(/class="ppto-summary-cell"/g)||[]).length,1);assert.doesNotMatch(summary[2],/Ganancia|Costo/);
});
test('download/share/native print retain a single existing source and complete PDF capture',async()=>{
 const {html}=await render();assert.match(html,/imprimirVistaPresupuesto\(this\)/);assert.match(html,/generarPdfPresupuesto\(\'descargar\',this\)/);assert.match(html,/generarPdfPresupuesto\(\'compartir\',this\)/);assert.match(html,/var blob=await crearPdfCompleto\(elementoCaptura,opciones\);if\(modo==="compartir"\)/);assert.match(html,/width:794px/);assert.match(html,/atomicSelectors:"\.info-box,\.tfoot-row,\.footer"/);
});
