const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/app.v3.6.3.js'), 'utf8');
const context = {window:{},esProductoManoDeObra: p => !!p.esManoDeObra};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function iaReglasInstalacion('), source.indexOf('async function iaPrepararPresupuestoGuiado(')), context);
function rules(nombre, categoria, qty=2) { return context.iaReglasInstalacion([{p:{nombre,categoria},qty}]); }
test('TVI propone cable por metro, pares de balun, fuente e instalación por cámara',()=>{
  const r=rules('Cámara TVI','BULLET HIKVISION TVI');
  assert.equal(r.find(x=>x.id==='utp').qty,40);
  assert.equal(r.find(x=>x.id==='utp').codigo,'P-50709');
  assert.equal(r.find(x=>x.id==='balun').qty,2);
  assert.equal(r.find(x=>x.id==='fuente').codigo,'P-11249');
  assert.equal(r.find(x=>x.id==='camara').qty,2);
});
test('Wi-Fi usa paralelo y no UTP ni balun',()=>{
  const r=rules('Cámara Wi-Fi','CAMARAS IP');
  assert.equal(r.find(x=>x.id==='paralelo').qty,40);
  assert.equal(r.some(x=>x.id==='utp'||x.id==='balun'),false);
});
test('PoE no agrega fuente individual',()=>assert.equal(rules('Cámara IP PoE','CAMARAS IP').some(x=>x.id==='fuente'),false));
test('Videoportero multiplica cable y dispositivos por kit',()=>{
  const r=rules('Kit video portero frente y pantalla','VIDEO PORTERO',2);
  assert.equal(r.find(x=>x.id==='utp').qty,100);
  assert.equal(r.find(x=>x.id==='video').qty,4);
  assert.equal(r.find(x=>x.id==='red').qty,2);
});
test('Alarma inalámbrica solo propone mano de obra y pide cantidad del kit',()=>{
  const r=rules('Kit alarma inalámbrica','GARNET');assert.equal(r.length,1);assert.equal(r[0].confirmar,true);
});
test('Accesorios y mano de obra no generan nuevas instalaciones',()=>{
  assert.equal(rules('Fuente cámara','FUENTES CAMARAS/ UPS').length,0);
  assert.equal(context.iaReglasInstalacion([{p:{nombre:'Instalar cámara',categoria:'CAMARAS IP',esManoDeObra:true},qty:1}]).length,0);
});
