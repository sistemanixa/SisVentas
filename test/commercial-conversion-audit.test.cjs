'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {readActiveApp}=require('./helpers/active-app');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs');
const moduleSource=fs.readFileSync('js/modules/commercial-document-controls.js','utf8');
const app=readActiveApp().source;
function context(){const c={window:null,document:{addEventListener(){}},currentUser:'Operador de prueba',currentUserUid:'operator',currentUserEmail:'',ventasList:[],FB_PATHS:{ventas:'sisventas/ventas',presupuestos:'sisventas/presupuestos'},escapeHTML:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')};c.window=c;c.SVSaleCosts=require('../js/core/sale-costs.v1.js').create(c);c.SVCommercialOwnership={author:p=>p.creadorOriginalNombre||p.creadoPor,clean:r=>r};vm.runInNewContext(moduleSource,c);return c;}
test('convertir preserva creador original y responsable aunque el operador y el comisionado sean distintos',()=>{
 const c=context(),p={id:'PP-DEMO',creadoPor:'Autor de prueba',creadorOriginalUid:'author',responsableUid:'assigned',responsableNombre:'Asignado de prueba',responsableRevision:2};
 const base={id:'V-DEMO',presupuestoFbKey:'budget',usuario:'Operador incorrecto',empleado:'Comisionado de prueba',total:123,items:[{cantidad:1}]};
 const before=JSON.stringify({p,base});const {venta,event}=c.SVCommercialDocument.conversion(p,base,{nombre:'Operador de prueba',uid:'operator'},1000);
 assert.equal(venta.usuario,'Autor de prueba');assert.equal(venta.creadaPor,'Autor de prueba');assert.equal(venta.creadorOriginalUid,'author');assert.equal(venta.responsableUid,'assigned');assert.equal(venta.convertidaPorUid,'operator');assert.equal(venta.empleado,base.empleado);assert.equal(venta.total,123);assert.equal(venta.ts,1000);assert.equal(event.actorUid,'operator');assert.equal(event.fecha,'1970-01-01T00:00:01.000Z');assert.match(event.accion,/PP-DEMO.*V-DEMO.*Autor de prueba/);assert.equal(JSON.stringify({p,base}),before);
});
function memory(initial){const root=structuredClone(initial);const read=p=>p.split('/').reduce((v,k)=>v?.[k],root)??null;const write=(p,v)=>{const keys=p.split('/');let o=root;for(const k of keys.slice(0,-1))o=o[k]??={};if(v===null)delete o[keys.at(-1)];else o[keys.at(-1)]=structuredClone(v);};return {root,ref:(_,p)=>p,get:async p=>({val:()=>structuredClone(read(p))}),update:async(p,data)=>{for(const [k,v]of Object.entries(data))write(p+'/'+k,v);},transaction:async(p,fn)=>{const next=fn(structuredClone(read(p)));if(next!==undefined)write(p,next);return {committed:next!==undefined,snapshot:{val:()=>structuredClone(read(p))}};}};}
test('conversión atómica guarda el mismo evento en venta y presupuesto; reintentar no duplica',async()=>{
 const c=context(),db=memory({sisventas:{ventas:{},presupuestos:{budget:{id:'PP-DEMO',creadorOriginalNombre:'Autor vigente',creadorOriginalUid:'author',responsableUid:'assigned',audit:[{accion:'Creado',usuario:'Autor vigente'}]}},contadores:{venta:9}}});
 Object.assign(c,{fbDB:{},fbRef:db.ref,fbGet:db.get,fbUpdate:db.update,fbRunTransaction:db.transaction});c.SVCommercialOwnership.prepare=async()=>({record:{}});
 const names=['_resultadoConversionPresupuestoExistente','_svCargaOperacion__convertirPresupuestoEnVentaAtomico'];
 const first=app.slice(app.indexOf('async function '+names[0]+'('),app.indexOf('// Comportamiento común',app.indexOf('async function '+names[0]+'(')));
 const second=app.slice(app.indexOf('async function '+names[1]+'('),app.indexOf('async function pptoAccion('));
 c._maxNumeroVentaLocal=()=>9;vm.runInNewContext(first+'\n'+second,c);
 const base={usuario:'Autor obsoleto',creadorOriginalUid:'stale',total:100,items:[],empleado:'Comisionado'};
 const acceptance={fecha:'16/10/2026 10:00',usuario:'Cliente aceptado',accion:'Cliente considerado visto y aceptado al convertir a venta'};
 const result=await c[names[1]]({fbKey:'budget',id:'PP-DEMO'},base,acceptance);
 const sale=db.root.sisventas.ventas.ppto_budget,budget=db.root.sisventas.presupuestos.budget;
 assert.equal(sale.creadorOriginalNombre,'Autor vigente');assert.equal(sale.creadorOriginalUid,'author');assert.equal(sale.convertidaPorUid,'operator');assert.equal(sale.responsableUid,'assigned');assert.deepEqual(sale.audit[0],budget.audit.at(-1));assert.equal(sale.audit[0].tipo,'conversion_presupuesto_venta');assert.equal(sale.audit[0].usuario,'Operador de prueba');assert.equal(budget.audit[1].usuario,'Cliente aceptado');assert.equal(result.ventaFbKey,'ppto_budget');
 await c[names[1]]({fbKey:'budget',id:'PP-DEMO'},base,acceptance);
 assert.equal(Object.keys(db.root.sisventas.ventas).length,1);assert.equal(db.root.sisventas.contadores.venta,10);assert.equal(budget.audit.length,3);assert.equal(sale.audit.length,1);
});
test('histórico: la venta muestra conversión de origen sin escribir datos ni inventar actor',async()=>{
 const {db,api,auth}=fixture();const source=db.root.sisventas.presupuestos.budget;source.id='PP-DEMO';source.audit.push({fecha:'14/10/2026 08:44',usuario:'Operador histórico',accion:'Cliente considerado visto y aceptado al convertir a venta'});
 const before=JSON.stringify(db.root),r=(await api.list(await auth('a'))).records.converted;
 assert.equal(r._svConversionAudit.usuario,'Operador histórico');assert.equal(r._svConversionAudit.fecha,'14/10/2026 08:44');assert.match(r._svConversionAudit.accion,/PP-DEMO.*Persona a.*Según auditoría/);assert.equal(JSON.stringify(db.root),before);assert.equal(r.audit,undefined);
 const c=context();const html=c.SVCommercialDocument.auditHTML(r);assert.match(html,/Operador histórico.*Conversión histórica/);
});
test('histórico ambiguo no inventa una conversión; evento explícito no se duplica',async()=>{
 const {db,api,auth}=fixture();const source=db.root.sisventas.presupuestos.budget;
 for(const name of ['Uno','Otro'])source.audit.push({fecha:'hoy',usuario:name,accion:'Cliente considerado visto y aceptado al convertir a venta'});
 assert.equal((await api.list(await auth('admin'))).records.converted._svConversionAudit,undefined);
 const c=context(),record={audit:{event:{tipo:'conversion_presupuesto_venta',accion:'Registrado',usuario:'Autor',fecha:'hoy'}},_svConversionAudit:{accion:'No duplicar'}};
 assert.equal(c.SVCommercialDocument.auditEntries(record).length,1);
});
test('auditoría muestra texto escapado y no muta el orden del historial',()=>{
 const c=context(),record={audit:[{fecha:'hoy',usuario:'<Autor>',accion:'<acción>'}]};const before=JSON.stringify(record),html=c.SVCommercialDocument.auditHTML(record);
 assert.ok(html.includes('&lt;Autor&gt;'));assert.ok(html.includes('&lt;acción&gt;'));assert.equal(JSON.stringify(record),before);
});
