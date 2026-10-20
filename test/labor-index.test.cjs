'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Index=require('../cotizador/labor-index');
const {identity}=require('../cotizador/personal-expenses');
const {esComision,claveGrupo}=require('../cotizador/commission-calculations');
const expense=extra=>({fecha:'2026-10-19',descripcion:'Traslado ficticio',monto:123.45,tipo:'Variable',categoria:'Personal',empleadoId:'emp',medio:'Transferencia',...extra});
const request=extra=>({empFbKey:'emp',mes:'2026-10',estado:'pendiente',aportes:{ap_uno:{horas:2}},...extra});
const leaf=(domain,index,value,key)=>Index.bucketPath(domain,index,value)+'/'+key;
const refs=(flat,domain,index,value)=>Object.keys(flat).filter(path=>path.startsWith(Index.bucketPath(domain,index,value)+'/')).map(path=>path.split('/').at(-1)).sort();
function applyDelta(flat,delta){const result={...flat};for(const [path,value]of Object.entries(delta)){if(value===null)delete result[path];else result[path]=value;}return result;}

test('los índices son referencias SHA256 sin incluir datos financieros ni metadata de preparación',()=>{
 const record=expense({legacyKey:'ctaemp/emp/mov'}),flat=Index.indexEntries('gastos','clave ñ',record),expectedHash=crypto.createHash('sha256').update(JSON.stringify(identity(record))).digest('hex');
 assert.equal(Index.INDEX_ROOT,'sv_labor_indexes');assert.equal(Index.VERSION,1);
 assert.equal(flat['sv_labor_indexes/gastos/identity/'+expectedHash+'/clave ñ'],true);
 assert.ok(Object.keys(flat).every(path=>path.startsWith(Index.INDEX_ROOT+'/')&&path.split('/').length===5));
 assert.ok(Object.values(flat).every(value=>value===true));assert.ok(!JSON.stringify(flat).includes('Traslado ficticio'));
 assert.deepEqual(refs(flat,'gastos','legacyKey','ctaemp/emp/mov'),['clave ñ']);
});

test('la firma reutiliza el contrato actual de trim, centavos y tipos originales sin normalizar registros',()=>{
 const padded=expense({empleadoId:' emp ',descripcion:' Traslado ficticio ',monto:123.45001}),clean=expense(),numeric=expense({empleadoId:123}),string=expense({empleadoId:'123'}),boolean=expense({empleadoId:true});
 const source={gastos:{padded,clean,numeric,string,boolean}},before=structuredClone(source),flat=Index.buildIndex(source);
 assert.deepEqual(source,before);assert.deepEqual(refs(flat,'gastos','identity',identity(clean)),['clean','padded']);
 assert.deepEqual(refs(flat,'gastos','identity',identity(numeric)),['numeric','string']);
 assert.deepEqual(refs(flat,'gastos','identity',identity(boolean)),['boolean']);
 assert.notEqual(Index.bucketPath('gastos','identity',identity(clean)),Index.bucketPath('gastos','identity',identity(expense({monto:123.46}))));
});

test('firmas idénticas conservan todas las claves y se actualizan sin apropiarse de un gasto ajeno',()=>{
 const a=expense({usuarioUid:'actor-a'}),b=expense({usuarioUid:'actor-b'}),flat=Index.buildIndex({gastos:{a,b}});
 assert.deepEqual(refs(flat,'gastos','identity',identity(a)),['a','b']);
 const delta=Index.planIndexDelta([{domain:'gastos',key:'a',before:a,after:null}]),after=applyDelta(flat,delta);
 assert.deepEqual(refs(after,'gastos','identity',identity(b)),['b']);assert.equal(Object.keys(delta).length,1);
 assert.ok(Object.keys(delta).every(path=>path.endsWith('/a')));
});

test('grupos de comisión usan la misma prioridad, conversión String y clave real que el listado actual',()=>{
 const records={
  numeric:expense({tipoPagable:'comision',ventaFbKey:123,ventaId:'ignorada'}),
  text:expense({tipo:'Comisión',ventaFbKey:'123'}),
  boolean:expense({origen:'comision',ventaId:true}),
  fallback:expense({tipoPagable:'comision',ventaFbKey:0,ventaId:'V-1'}),
  absent:expense({tipoPagable:'comision',fbKey:'clave-interna-vieja'}),
  ordinary:expense({ventaId:'123'})
 },flat=Index.buildIndex({gastos:records});
 for(const [key,record]of Object.entries(records)){
  const group=claveGrupo({...record,fbKey:key});
  assert.equal(Object.hasOwn(flat,leaf('gastos','commissionGroup',group,key)),esComision(record));
 }
 assert.deepEqual(refs(flat,'gastos','commissionGroup','123'),['numeric','text']);
 assert.deepEqual(refs(flat,'gastos','commissionGroup','true'),['boolean']);
 assert.deepEqual(refs(flat,'gastos','commissionGroup','sinventa:absent'),['absent']);
 assert.deepEqual(refs(flat,'gastos','commissionGroup','clave-interna-vieja'),[]);
});

test('legacyKey conserva igualdad exacta y sus duplicados sin recortar espacios ni convertir números',()=>{
 const records={a:expense({legacyKey:'hsextra_solicitudes/a'}),b:expense({legacyKey:'hsextra_solicitudes/a'}),padded:expense({legacyKey:' hsextra_solicitudes/a '}),numeric:expense({legacyKey:123})},flat=Index.buildIndex({gastos:records});
 assert.deepEqual(refs(flat,'gastos','legacyKey','hsextra_solicitudes/a'),['a','b']);
 assert.deepEqual(refs(flat,'gastos','legacyKey',' hsextra_solicitudes/a '),['padded']);
 assert.deepEqual(refs(flat,'gastos','legacyKey','123'),[]);
});

test('aporteId global conserva duplicados y estados históricos usando sólo claves propias',()=>{
 const inherited={ap_heredado:{horas:1}},aportes=Object.assign(Object.create(inherited),{ap_duplicado:{horas:2},ap_falso:false});
 const records={a:request({aportes,estado:'aprobado'}),b:request({empFbKey:'otro',mes:'2020-01',estado:'rechazado',aportes:{ap_duplicado:{horas:3}}})};
 const flat=Index.buildIndex({hsextra_solicitudes:records});
 assert.deepEqual(refs(flat,'hsextra_solicitudes','aporteId','ap_duplicado'),['a','b']);
 assert.deepEqual(refs(flat,'hsextra_solicitudes','aporteId','ap_falso'),['a']);
 assert.deepEqual(refs(flat,'hsextra_solicitudes','aporteId','ap_heredado'),[]);
});

test('empleado y mes conserva tipo exacto, espacios, fallback de fecha y todos los estados',()=>{
 const records={pending:request(),approved:request({estado:'aprobado'}),rejected:request({estado:'rechazado'}),padded:request({empFbKey:' emp '}),numeric:request({empFbKey:123}),text:request({empFbKey:'123'}),boolean:request({empFbKey:true}),date:request({mes:'',fecha:'2026-10-05'}),spaces:request({mes:' 2026-10'})},flat=Index.buildIndex({hsextra_solicitudes:records});
 assert.deepEqual(refs(flat,'hsextra_solicitudes','employeeMonth',['emp','2026-10']),['approved','date','pending','rejected']);
 assert.deepEqual(refs(flat,'hsextra_solicitudes','employeeMonth',[' emp ','2026-10']),['padded']);
 assert.deepEqual(refs(flat,'hsextra_solicitudes','employeeMonth',[123,'2026-10']),['numeric']);
 assert.deepEqual(refs(flat,'hsextra_solicitudes','employeeMonth',['123','2026-10']),['text']);
 assert.deepEqual(refs(flat,'hsextra_solicitudes','employeeMonth',[true,'2026-10']),['boolean']);
 assert.deepEqual(refs(flat,'hsextra_solicitudes','employeeMonth',['emp',' 2026-1']),['spaces']);
});

test('delta sólo cambia referencias modificadas y coincide con reconstruir el índice completo',()=>{
 const before={gastos:{a:expense({tipoPagable:'comision',ventaId:'V-1',legacyKey:'ctaemp/emp/a'}),remove:expense()},hsextra_solicitudes:{r:request()}};
 const after=structuredClone(before);after.gastos.a={...after.gastos.a,monto:200,ventaFbKey:'V-2',legacyKey:'ctaemp/otro/a'};delete after.gastos.remove;
 after.gastos.new=expense();after.hsextra_solicitudes.r={...after.hsextra_solicitudes.r,empFbKey:'otro',mes:'2026-11',aportes:{ap_dos:{horas:4}}};
 const changes=[{domain:'gastos',key:'a',before:before.gastos.a,after:after.gastos.a},{domain:'gastos',key:'remove',before:before.gastos.remove,after:null},{domain:'gastos',key:'new',after:after.gastos.new},{domain:'hsextra_solicitudes',key:'r',before:before.hsextra_solicitudes.r,after:after.hsextra_solicitudes.r}];
 const saved=structuredClone(changes),delta=Index.planIndexDelta(changes);
 assert.deepEqual(applyDelta(Index.buildIndex(before),delta),{...Index.buildIndex(after)});assert.deepEqual(changes,saved);
 assert.ok(Object.values(delta).every(value=>value===null||value===true));
});

test('colecciones RTDB representadas como arrays conservan las claves numéricas y omiten hijos null',()=>{
 const g=expense({tipoPagable:'comision'}),r=request(),flat=Index.buildIndex({gastos:[g,null,expense()],hsextra_solicitudes:[null,r]});
 assert.deepEqual(refs(flat,'gastos','identity',identity(g)),['0','2']);
 assert.deepEqual(refs(flat,'gastos','commissionGroup','sinventa:0'),['0']);
 assert.deepEqual(refs(flat,'hsextra_solicitudes','aporteId','ap_uno'),['1']);
 assert.ok(!Object.keys(flat).some(path=>path.startsWith('sv_labor_indexes/gastos/')&&path.endsWith('/1')));
});

test('pagos, aprobación y adjuntos sin cambio de identidad no reescriben referencias ni históricos',()=>{
 const before=expense({tipoPagable:'comision',ventaId:'V-1'}),after={...before,pagos:{p:{monto:50}},montoPagado:50,estado:'pagado_parcial',aprobadoPor:'Administración',fotoBase64:'imagen ficticia'};
 assert.equal(Object.keys(Index.planIndexDelta([{domain:'gastos',key:'a',before,after}])).length,0);
 const old=request(),approved={...old,estado:'aprobado',gastoFbKey:'a'};
 assert.equal(Object.keys(Index.planIndexDelta([{domain:'hsextra_solicitudes',key:'r',before:old,after:approved}])).length,0);
});

test('eliminar el último miembro sólo elimina hojas y no toca preparación, recibos ni progreso',()=>{
 const record=expense({tipoPagable:'comision',ventaId:'V-1',legacyKey:'ctaemp/emp/a'}),flat=Index.indexEntries('gastos','last',record),delta=Index.planIndexDelta([{domain:'gastos',key:'last',before:record,after:null}]);
 assert.deepEqual(applyDelta(flat,delta),{});assert.equal(Object.keys(delta).length,3);
 assert.ok(Object.keys(delta).every(path=>path.startsWith('sv_labor_indexes/gastos/')&&path.endsWith('/last')));
 assert.ok(Object.values(delta).every(value=>value===null));
});

test('nombres especiales de claves no contaminan objetos y rutas inválidas fallan antes de producir parches',()=>{
 const flat=Index.indexEntries('gastos','__proto__',expense());assert.equal(Object.keys(flat).length,1);assert.equal(Object.values(flat)[0],true);
 for(const key of ['',42,'a/b','a.b','a\x00b','a\x7fb','ñ'.repeat(385)])assert.throws(()=>Index.indexEntries('gastos',key,expense()),{statusCode:400});
 for(const domain of ['ventas','constructor','__proto__'])assert.throws(()=>Index.indexEntries(domain,'a',expense()),{statusCode:400});
 assert.throws(()=>Index.bucketPath('gastos','constructor','a'),{statusCode:400});assert.throws(()=>Index.bucketPath('gastos','identity',undefined),{statusCode:400});
 assert.throws(()=>Index.indexEntries('gastos','a',[]),{statusCode:400});assert.throws(()=>Index.buildIndex({gastos:1}),{statusCode:400});
 assert.throws(()=>Index.planIndexDelta([{domain:'gastos',key:'a'},{domain:'gastos',key:'a'}]),{statusCode:400});
});
