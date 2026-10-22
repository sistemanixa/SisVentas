'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const Index=require('../cotizador/payment-membership-index');
const {functionSource}=require('./helpers/app-functions.cjs');
const oracle={};vm.createContext(oracle);vm.runInContext(['_svTxtClave','_svVentaClaves','_svRegistroPerteneceVenta'].map(functionSource).join('\n'),oracle);
const generation='synthetic-generation';
const build=payments=>Index.buildIndex(payments,{generation,ready:true});
function apply(flat,delta){const result={...flat};for(const [key,value]of Object.entries(delta)){if(value===null)delete result[key];else result[key]=value;}return result;}
function candidates(flat,sale){const paths=new Set(Index.queryPaths(sale));return Array.from(new Set(Object.keys(flat).filter(path=>paths.has(path.slice(0,path.lastIndexOf('/')))).map(path=>path.slice(path.lastIndexOf('/')+1)))).sort();}
function matched(flat,sale,payments){return candidates(flat,sale).filter(key=>Index.belongsToSale(payments[key],sale));}
function change(key,before,after){return{key,before,after,reverseBefore:Index.reverseMetadata(key,before)};}
test('MATCHER_HASH y resultados son idénticos al compilar fuente LF o CRLF',()=>{
 const fs=require('node:fs'),Module=require('node:module'),filename=require.resolve('../cotizador/payment-membership-matcher'),source=fs.readFileSync(filename,'utf8').replace(/\r\n?/g,'\n'),versions=[source,source.replace(/\n/g,'\r\n')].map(text=>{const m=new Module(filename,module);m.filename=filename;m._compile(text,filename);return m.exports;});
 assert.equal(versions[0].MATCHER_HASH,versions[1].MATCHER_HASH);assert.equal(versions[0].MATCHER_HASH,Index.MATCHER_HASH);
 for(const sale of [{fbKey:'technical',id:'V-0001'},{idOriginal:'OLD/007'}])for(const payment of [{ventaFbKey:'technical'},{ventaId:'OT/0001'},{venta:'OLD/007'},{ventaKey:'other',venta:'V-0001'}])assert.equal(versions[0].belongsToSale(payment,sale),versions[1].belongsToSale(payment,sale));
});
test('el matcher conserva prioridad técnica, aliases originales y ceros significativos',()=>{
 const sale={fbKey:'key',ventaKey:'otherKey',id:'V-0001',idOriginal:'OLD/07'};
 for(const field of Index.TECHNICAL_FIELDS){assert.equal(Index.belongsToSale({[field]:'key'},sale),true);assert.equal(Index.belongsToSale({[field]:'wrong',venta:'V-0001'},sale),false);}
 for(const field of Index.BUSINESS_FIELDS){assert.equal(Index.belongsToSale({[field]:'OT / 0001'},sale),true);assert.equal(Index.belongsToSale({[field]:'OLD/07'},sale),true);assert.equal(Index.belongsToSale({[field]:'1'},sale),false);}
 assert.equal(Index.belongsToSale({ventaId:0},{id:'0'}),false);assert.equal(Index.belongsToSale({ventaId:false},{id:'false'}),false);assert.equal(Index.belongsToSale({ventaId:true},{id:'true'}),true);
});
test('índice sintético equivale al matcher activo para todos los campos/tipos y aliases ambiguos',()=>{
 let state=20261021;const random=n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n;};
 const sales=Array.from({length:48},(_,i)=>({fbKey:'sale_'+i,id:'V-'+String(i%12).padStart(4,'0'),idOriginal:'ANTES/'+i%9,numeroOriginal:i%3?'':'000'+i,ventaKey:i%4?'':'extra_'+i}));
 const fields=[...Index.TECHNICAL_FIELDS,...Index.BUSINESS_FIELDS],values=['',' ','sale_0','sale_47','sale_other','V-0001','#V-0001','OT / 0001','ANTES/1','0001','1',0,1,false,null,' ñ-0001 ',true,'V-001','V-0000'];
 const payments={};for(let i=0;i<1700;i++){const payment={monto:(i+1)/100,anulado:i%7===0};for(let j=0;j<1+random(4);j++)payment[fields[random(fields.length)]]=values[random(values.length)];payments['payment_'+i]=payment;}
 const flat=build(payments).patch;
 for(const sale of sales){const expected=Object.keys(payments).filter(key=>oracle._svRegistroPerteneceVenta(payments[key],sale)).sort();assert.deepEqual(matched(flat,sale,payments),expected);for(const payment of Object.values(payments))assert.equal(Index.belongsToSale(payment,sale),oracle._svRegistroPerteneceVenta(payment,sale));}
});
test('no elige una venta canónica y conserva membresía de anulados y registros sin referencias',()=>{
 const payments={annulled:{ventaId:'V-0001',anulado:true},ambiguous:{venta:'OT/0001'},emptyRefs:{monto:1},technical:{ventaKey:'exact',ventaId:'V-0001'}},flat=build(payments).patch;
 assert.deepEqual(matched(flat,{fbKey:'x',id:'V-0001'},payments),['ambiguous','annulled']);assert.deepEqual(matched(flat,{fbKey:'y',id:'OT/0001'},payments),['ambiguous','annulled']);
 assert.equal(flat[Index.reversePath('emptyRefs')].tokenPaths.length,0);assert.equal(flat[Index.COVERAGE_PATH].paymentCount,4);assert.equal(flat[Index.reversePath('technical')].hasTechnicalRefs,true);assert.ok(flat[Index.reversePath('technical')].tokenPaths.every(path=>path.startsWith('technical/')));
});
test('metadatos no contienen importes/adjuntos y digest conserva tipos de relación',()=>{
 const a=Index.reverseMetadata('a',{ventaId:'1',monto:20,adjunto:'secreto ficticio'}),b=Index.reverseMetadata('b',{ventaId:1,monto:50});assert.notEqual(a.relationDigest,b.relationDigest);assert.deepEqual(a.tokenPaths,b.tokenPaths);assert.ok(!JSON.stringify(a).includes('secreto'));assert.equal(Index.reverseMetadata('a',{ventaId:'1',monto:999}).relationDigest,a.relationDigest);assert.equal(Index.reverseMetadata('a',{ventaId:'1',anulado:true}).relationDigest,a.relationDigest);
});
test('constructor determinista, no muta negocio y nunca habilita ready por defecto',()=>{
 const p={b:{venta:'V-2',monto:1},a:{ventaFbKey:'k',monto:2}},before=structuredClone(p),a=Index.buildIndex(p,{generation}),b=Index.buildIndex({a:p.a,b:p.b},{generation});assert.deepEqual(a,b);assert.deepEqual(p,before);assert.equal(a.coverage.ready,false);assert.throws(()=>Index.validateCoverage(a.coverage),{code:'SV_PAYMENT_INDEX_INVALID'});assert.deepEqual(Index.validateCoverage(a.coverage,{requireReady:false}),a.coverage);
});
test('deltas completos equivalen a reconstruir para alta/relación/tipo/anulación/adjunto/borrado',()=>{
 let payments={a:{ventaId:'V-001',monto:1},b:{ventaKey:'key',monto:2}},state=build(payments),sequence=0;
 const edits=[['c',{ventaNumero:'OT/001',anulado:true}],['a',{ventaId:'V-001',ventaOrigenFbKey:'key',monto:1}],['b',{ventaKey:'key',monto:2,anulado:true}],['c',{ventaNumero:'OT/001',anulado:true,adjunto:{nombre:'doc.pdf'}}],['a',{ventaOrigenFbKey:12,monto:1}],['b',null],['c',{}]];
 for(const [key,after]of edits){const before=payments[key]??null,result=Index.planIndexDelta([change(key,before,after)],{coverage:state.coverage});const next=Index.normalizeRecord(after);if(next===null)delete payments[key];else payments[key]=next;sequence++;const expected=Index.buildIndex(payments,{generation,ready:true,sequence});assert.deepEqual(apply(state.patch,result.patch),{...expected.patch});assert.equal(result.coverage.sequence,sequence);state={patch:apply(state.patch,result.patch),coverage:result.coverage};}
});
test('delta de importe/anulado/adjunto mantiene relaciones y aun confirma secuencia una vez',()=>{
 const payment={ventaKey:'key',monto:1},initial=build({p:payment}),result=Index.planIndexDelta([change('p',payment,{...payment,monto:2,anulado:true,comprobante:'doc'})],{coverage:initial.coverage});assert.deepEqual(Object.keys(result.patch),[Index.COVERAGE_PATH]);assert.equal(result.coverage.buildDigest,initial.coverage.buildDigest);assert.equal(result.coverage.sequence,1);assert.equal(result.coverage.paymentCount,1);
});
test('batch incrementa secuencia una vez; claves repetidas y metadata ausente/corrupta fallan cerradas',()=>{
 const initial=build({a:{venta:'V-1'}});const result=Index.planIndexDelta([change('a',{venta:'V-1'},null),change('b',null,{venta:'V-2'})],{coverage:initial.coverage});assert.equal(result.coverage.sequence,1);assert.equal(result.coverage.paymentCount,1);
 assert.throws(()=>Index.planIndexDelta([change('a',{venta:'V-1'},null),change('a',{venta:'V-1'},null)],{coverage:initial.coverage}),{statusCode:400});
 for(const reverseBefore of [undefined,null,{...initial.patch[Index.reversePath('a')],relationDigest:'0'.repeat(64)}])assert.throws(()=>Index.planIndexDelta([{key:'a',before:{venta:'V-1'},after:null,reverseBefore}],{coverage:initial.coverage}),{code:'SV_PAYMENT_INDEX_INVALID'});
 assert.throws(()=>Index.planIndexDelta([{key:'a',before:null,after:{venta:'V-1'}}],{coverage:initial.coverage}),{statusCode:400});
});
test('cobertura rechaza schema/matcher/counters/digest/secuencia inválidos y no infiere ready',()=>{
 const {coverage}=build({p:{venta:'V-1'}});for(const patch of [{ready:false},{schema:2},{matcherHash:'0'.repeat(64)},{paymentCount:-1},{sequence:1.5},{buildDigest:'0'.repeat(64)},{generation:'bad'},{extra:true}])assert.throws(()=>Index.validateCoverage({...coverage,...patch}),{code:'SV_PAYMENT_INDEX_INVALID'});
 assert.throws(()=>Index.planIndexDelta([change('p',{venta:'V-1'},null)],{coverage:{...coverage,sequence:Number.MAX_SAFE_INTEGER}}),{code:'SV_PAYMENT_INDEX_INVALID'});
});
test('patch puntual descubre claves por hijos sin raíz ni índice fabricado',()=>{
 assert.deepEqual(Index.paymentKeysForPatch({'sisventas/pagos/z/monto':2,'sisventas/pagos/a':null,'sisventas/pagos/z/adjunto/nombre':'doc','sisventas/ventas/v/saldo':1}),['a','z']);
 for(const path of ['sisventas','sisventas/pagos','sisventas/pagos/','sv_labor_indexes',Index.COVERAGE_PATH,'sisventas/pagos/a/../b'])assert.throws(()=>Index.paymentKeysForPatch({[path]:null}),{statusCode:400});
});
test('semántica RTDB de borrados elimina registro vacío y mantiene arrays de referencias',()=>{
 assert.equal(Index.normalizeRecord({monto:null,adjunto:{nombre:null}}),null);assert.equal(Index.reverseMetadata('a',{}),null);const record=Index.normalizeRecord({ventaId:{0:'V',1:1},venta:null});assert.deepEqual(record.ventaId,['V',1]);assert.ok(!Object.hasOwn(record,'venta'));assert.equal(Index.paymentReferences(record).businessExact[0],'V,1');
 const safe=JSON.parse('{"__proto__":{"safe":true},"venta":"V-1"}'),meta=Index.indexEntries('__proto__',safe);assert.ok(Object.hasOwn(meta,Index.reversePath('__proto__')));assert.equal({}.safe,undefined);
 for(const value of [NaN,Infinity,undefined,()=>{},1n])assert.throws(()=>Index.normalizeRecord({venta:value}),{statusCode:400});const circular={};circular.venta=circular;assert.throws(()=>Index.normalizeRecord(circular),{statusCode:400});
});
test('referencias JSON contenedor conservan la coerción String publicada sin prototipos inventados',()=>{
 for(const reference of [{demo:'x'},['V',1],{'10':'V'},true,12]){const payment={ventaId:reference,monto:1},sales=[{id:'[object Object]'},{id:'V,1'},{id:'true'},{id:'12'}],flat=build({p:payment}).patch;for(const sale of sales)assert.equal(matched(flat,sale,{p:payment}).includes('p'),oracle._svRegistroPerteneceVenta(payment,sale));}
});
