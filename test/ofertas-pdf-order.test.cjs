const {test}=require('node:test'),assert=require('node:assert/strict');
const {pdfEntries}=require('../js/modules/paraguay-shopping-access');
const entry=(name,brand,price,reference)=>({p:{nombre:name,marca:brand,ventaARS:price,iva:0,proveedores:reference?[{nombre:'Mercado Libre',precio:reference}]:[]},qty:2});
test('destacados sólo si el ahorro supera 30%, ordenados de mayor a menor',()=>{const input=[entry('Exacto','Sony',700,1000),entry('Mayor','JBL',600,1000),entry('Límite','Sony',699.99,1000),entry('Máximo','Apple',500,1000)];const rows=pdfEntries(input);assert.deepEqual(rows.map(r=>r.p.nombre),['Máximo','Mayor','Límite','Exacto']);assert.deepEqual(rows.map(r=>r.featured),[true,true,true,false]);assert.equal(input[0].p.nombre,'Exacto');assert.ok(rows.every(r=>r.qty===2));});
test('resto agrupado por marca, sin duplicar productos ni incluir falsos destacados',()=>{const input=[entry('Z','sony',1000),entry('A',' APPLE ',1000),entry('N','',1000),entry('B','Sony',1100,1000)];const rows=pdfEntries(input);assert.deepEqual(rows.map(r=>r.group),['APPLE','SONY','SONY','SIN MARCA']);assert.ok(rows.every(r=>!r.featured));assert.equal(new Set(rows.map(r=>r.p)).size,4);});
test('comparación utiliza venta final con IVA y descarta proveedor sin stock',()=>{const p=entry('Con IVA','JBL',600,1000);p.p.iva=21;assert.equal(pdfEntries([p])[0].featured,false);p.p.iva=0;p.p.proveedores[0].disponibilidadProveedor='sin_stock';assert.equal(pdfEntries([p])[0].featured,false);});
test('destacados terminan antes de comenzar las marcas en otra hoja',()=>{
 const {pdfPages}=require('../js/modules/paraguay-shopping-access');
 for(const [featured,regular] of [[4,23],[5,5],[6,2],[0,7],[7,0],[0,0]]){
  const rows=Array.from({length:featured+regular},(_,i)=>({id:i,featured:i<featured}));
  const pages=pdfPages(rows);
  assert.equal(pages.length,Math.ceil(featured/5)+Math.ceil(regular/5));
  assert.ok(pages.every(page=>page.length>0&&page.length<=5&&page.every(e=>e.featured===page[0].featured)));
  assert.deepEqual(pages.flat(),rows);
 }
});
test('cada marca comienza en hoja nueva y continúa de a cinco sin páginas vacías',()=>{
 const {pdfPages}=require('../js/modules/paraguay-shopping-access');
 const rows=[...Array.from({length:4},()=>({featured:true,group:'Destacados'})),...Array.from({length:7},()=>({featured:false,group:'APPLE'})),{featured:false,group:'JBL'},{featured:false,group:'SONY'}];
 const pages=pdfPages(rows);assert.deepEqual(pages.map(p=>p.length),[4,5,2,1,1]);assert.ok(pages.every(p=>p.every(e=>e.group===p[0].group)));assert.deepEqual(pages.flat(),rows);
});
