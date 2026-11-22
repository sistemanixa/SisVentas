'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Port=require('../cotizador/office-stock-reference-port'),Reference=require('../cotizador/office-stock-reference');
function fixture(mapped=true){
 const record={productKey:'canonical',inventoryKey:'legacy',receiptIdentityKey:'oldReceiptKey',revision:4};
 const data={
 'sisventas/ordenes_trabajo/ot':{materiales:[{productoKey:'oldMissingProduct',inventoryKey:'legacy',receiptIdentityKey:'oldReceiptKey'}]},
 'sisventas/productos/canonical':{codigo:'newCode',nombre:'Ficticio',activo:true},
 'sisventas/inventario_operativo/legacy':{general:10,reservado:2,costoReferenciaStock:17.875,rendicionesOT:{old:{revision:2}}},
 'sv_stock_reference_config':{schema:1,generation:'fixtureGeneration',inventoryKeys:['legacy'],ownersByInventory:{legacy:['canonical']},aliasOwners:['canonical'],receiptIdentityKey:'oldReceiptKey',coverage:{catalog:true,inventory:true,links:true,owners:true,receiptIdentity:true}}
 };
 if(mapped){data['sisventas/stock_vinculos/porProducto/canonical']=record;data['sisventas/stock_vinculos/porInventario/legacy']=structuredClone(record);}
 const reads=[],tracked=[],original={purpose:'ot',path:'sisventas/ordenes_trabajo/ot',selector:0},legacy={productKey:'oldMissingProduct',inventoryKey:'legacy',receiptIdentityKey:'oldReceiptKey'};
 const ports={
 read:async path=>{reads.push(path);return structuredClone(data[path]??null);},
 track:async(path,value)=>tracked.push([path,value]),
 identifyOriginal:async(source,selector)=>({productKey:source.materiales[selector].productoKey,inventoryKey:source.materiales[selector].inventoryKey,receiptIdentityKey:source.materiales[selector].receiptIdentityKey}),
 legacy:async()=>legacy
 };
 const loadCoverage=async({read})=>read('sv_stock_reference_config');
 return{data,reads,tracked,ports,original,legacy,resolve:Port.createReferenceResolver({enabled:true,loadCoverage})};
}
test('OFF preserves exact legacy result and performs zero extra reads or coverage calls',async()=>{const f=fixture(),result=await Port.createReferenceResolver({loadCoverage:()=>{throw Error('No coverage while OFF');}})(f.original,f.ports);assert.equal(result,f.legacy);assert.deepEqual(f.reads,[]);});
test('mapping absence preserves legacy identities and fields without requiring catalog lookup',async()=>{const f=fixture(false),result=await f.resolve(f.original,f.ports);for(const [name,value]of Object.entries(f.legacy))assert.equal(result[name],value);assert.equal(result.mapped,false);assert.equal(result.mappingRevision,0);assert.equal(f.reads.some(path=>path.startsWith('sisventas/productos/')),false);assert.ok(result.readSet.length>0);});
test('historical inverse resolves before failed old catalog lookup and keeps three distinct identities',async()=>{const f=fixture(),before=structuredClone(f.data);f.ports.legacy=async()=>{throw Error('Old catalog product missing');};const result=await f.resolve(f.original,f.ports);assert.equal(result.productKey,'canonical');assert.equal(result.inventoryKey,'legacy');assert.equal(result.receiptIdentityKey,'oldReceiptKey');assert.equal(result.mappingRevision,4);assert.equal(f.reads.includes('sisventas/productos/oldMissingProduct'),false);assert.ok(f.reads.includes('sisventas/productos/canonical'));assert.deepEqual(f.data,before);assert.equal(result.readSet.length,f.tracked.length);await Port.assertFresh(result.readSet,f.ports.read);});
for(const path of ['sisventas/ordenes_trabajo/ot','sisventas/inventario_operativo/legacy','sisventas/productos/canonical','sv_stock_reference_config','sisventas/stock_vinculos/porInventario/legacy'])test('readSet catches fresh CAS change at '+path,async()=>{const f=fixture(),result=await f.resolve(f.original,f.ports);f.data[path]={changed:true};await assert.rejects(Port.assertFresh(result.readSet,f.ports.read),error=>error.code==='SV_STOCK_REFERENCE_CONFLICT');});
test('client key hints or another domain path cannot override server original',async()=>{const f=fixture();await assert.rejects(f.resolve({...f.original,productKey:'forged'},f.ports));await assert.rejects(f.resolve({...f.original,path:'sisventas/productos/canonical'},f.ports));assert.equal(f.reads.length,0);});
test('dangling inverse never falls back to legacy',async()=>{const f=fixture();delete f.data['sisventas/stock_vinculos/porProducto/canonical'];await assert.rejects(f.resolve(f.original,f.ports),error=>error.code==='SV_STOCK_REFERENCE_MAPPING');});
test('denied mapping read or incomplete coverage is never interpreted as mapping absence',async()=>{const f=fixture(false),read=f.ports.read;f.ports.read=async path=>{if(path.includes('stock_vinculos'))throw Error('Denied fixture');return read(path);};await assert.rejects(f.resolve(f.original,f.ports),/Denied/);const other=fixture(false);other.data.sv_stock_reference_config.coverage.links=false;await assert.rejects(other.resolve(other.original,other.ports),error=>error.code==='SV_STOCK_REFERENCE_COVERAGE');});
test('stored original hash and historical identity cannot be replaced',async()=>{const f=fixture();await assert.rejects(f.resolve({...f.original,expectedOriginalHash:Reference.digest({different:true})},f.ports),error=>error.code==='SV_STOCK_REFERENCE_CONFLICT');f.data['sisventas/ordenes_trabajo/ot'].materiales[0].receiptIdentityKey='forged';await assert.rejects(f.resolve(f.original,f.ports),error=>error.code==='SV_STOCK_REFERENCE_IDENTITY');});
test('authoritative original document is accepted and verified, forged row hints are rejected',async()=>{const f=fixture(),record=structuredClone(f.data[f.original.path]),result=await f.resolve({...f.original,record},f.ports);assert.equal(result.productKey,'canonical');record.materiales[0].productoKey='forged';await assert.rejects(f.resolve({...f.original,record},f.ports),error=>error.code==='SV_STOCK_REFERENCE_CONFLICT');});
