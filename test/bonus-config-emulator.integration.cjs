'use strict';
// Explicit opt-in only. Starts no emulator and uses no provider, ADC or SDK.
// FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9037 and SV_RULES_TEST_FILE must
// point at the reviewed expense-removal-only dc05032c... baseline.
const {test,before,beforeEach,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const host='127.0.0.1:9037',base='http://'+host,namespace='demo-bonus-config-proof',expected='dc05032cdfbcc5976a871d414f60b2920e709d248496474aff7c0d9b087df39a';
const sourceFile=process.env.SV_BONUS_RULES_TEST_FILE||process.env.SV_RULES_TEST_FILE;
const enabled=process.env.FIREBASE_DATABASE_EMULATOR_HOST===host&&!!sourceFile,opt={skip:!enabled,timeout:30000},clone=value=>structuredClone(value);
const configPath='/sisventas/config/bonificaciones';let rules,seed;
function jwt(uid,claims={}){
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),now=Math.floor(Date.now()/1000);
 return encode({alg:'none',typ:'JWT'})+'.'+encode({aud:namespace,iss:'https://securetoken.google.com/'+namespace,sub:uid,user_id:uid,iat:now-5,exp:now+300,firebase:{identities:{},sign_in_provider:'custom'},...claims})+'.';
}
async function request(method,path,value,{uid='admin',claims,owner=false,headers={},query={}}={}){
 const url=new URL(path+'.json',base);url.searchParams.set('ns',namespace);if(!owner&&uid)url.searchParams.set('auth',jwt(uid,claims));for(const [key,item]of Object.entries(query))url.searchParams.set(key,JSON.stringify(item));
 assert.equal(url.origin,base);assert.match(namespace,/^demo-/);
 const response=await fetch(url,{method,headers:{'Content-Type':'application/json',...(owner?{Authorization:'Bearer owner'}:{}),...headers},body:value===undefined?undefined:JSON.stringify(value),signal:AbortSignal.timeout(10000)}),text=await response.text();
 let body;try{body=text?JSON.parse(text):null;}catch{body=text;}
 return {status:response.status,body,etag:response.headers.get('etag')};
}
async function owner(method,path,value){const result=await request(method,path,value,{owner:true});assert.equal(result.status,200,JSON.stringify(result.body));return result.body;}
function roleConfig({configuration=false,expenses=false,own=false,edit=false}={}){return {indiceVersion:2,indiceRevision:1,bloqueados:[],indiceModulos:{configuracion:configuration,gastos:expenses,comisiones:false,tesoreria:false,reportes:false,rentabilidad:false,ctaemp:own,dashboard:own},acciones:{configuracion:{editar:edit},empleados:{verCuentas:false},dashboard:{metricasGlobales:false,miCuenta:own}}};}
function fixture(){
 const paid={monto:10.25,fecha:'2026-10-22',medio:'Transferencia',comprobante:{nombre:'Ficticio.pdf'}},bonus=(employee,monto)=>({tipo:'Variable',tipoPagable:'bonificacion',origen:'bonificacion',descripcion:'Bonificación ficticia',empleadoId:employee,empleadoFbKey:employee,monto,periodoComputo:'2026-10',estado:'aprobado'});
 return {sv_chat_roles:{admin:{rol:'admin',activo:true},tech:{rol:'tecnico',activo:true},office:{rol:'administrativo',activo:true},external:{rol:'distribuidor',activo:true}},sv_usuarios:{padmin:{uid:'admin',rol:'admin',activo:true},ptech:{uid:'tech',rol:'tecnico',activo:true,empleadoFbKey:'e'},poffice:{uid:'office',rol:'administrativo',activo:true}},sv_empleado_uid:{tech:{perfilFbKey:'ptech'}},sv_permisos:{admin:roleConfig({configuration:true,expenses:true,edit:true}),tecnico:roleConfig({own:true}),administrativo:roleConfig()},sisventas:{config:{version:'FICTICIO'},gastos:{bonus:bonus('e',25.75),paidBonus:{...bonus('e',10.25),montoPagado:10.25,estado:'pagado',pagos:{p:paid}},otherBonus:bonus('other',33.33),archivedBonus:{...bonus('e',15),bajaAdministrativa:{uid:'admin',usuario:'Admin ficticio',ts:1,auditKey:'ficticio'}},salary:{tipoPagable:'sueldo',descripcion:'Haber ficticio',empleadoId:'e',empleadoFbKey:'e',monto:500,montoPagado:100,pagos:{p:{...paid,monto:100}}},commission:{tipoPagable:'comision',empleadoId:'other',monto:20},legacyBonus:{origen:'bonificacion',descripcion:'Legacy ficticio sin tipo',empleadoId:'e',monto:5}},haberes:{e:{'2026_10':{sueldo:500,total:500,gastoFbKey:'salary'}}},ctaemp:{e:{salary:{tipo:'sueldo',monto:500,montoPagado:100,gastoFbKey:'salary'},bonus:{tipo:'bonificacion',monto:10.25,pagos:{p:paid},gastoFbKey:'paidBonus'}}},pagos:{p:{ventaFbKey:'sale',monto:72.34}},pagos_realizados:{batch:{monto:100,gastos:[{gastoFbKey:'salary',saldoPagado:100}]}},comisiones_generacion:{keep:{estado:'completada'}}}};
}
async function currentEtag(path=configPath,identity={}){const result=await request('GET',path,undefined,{...identity,headers:{'X-Firebase-ETag':'true'}});assert.equal(result.status,200,JSON.stringify(result.body));assert.ok(result.etag,'Real emulator must return an ETag');return result;}
const writeCas=(value,etag,identity={})=>request('PUT',configPath,value,{...identity,headers:{'If-Match':etag}});
function denied(result){assert.ok([401,403].includes(result.status),'Expected permission denial, got '+result.status);}
async function economicUnchanged(){const saved=await owner('GET','/sisventas');for(const branch of ['gastos','haberes','ctaemp','pagos','pagos_realizados','comisiones_generacion'])assert.deepEqual(saved[branch],seed.sisventas[branch],branch+' must remain unchanged');}
before(async()=>{
 if(!enabled)return;assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,host);
 const builder=require('../scripts/prepare-bonus-history-index.cjs'),source=JSON.parse(fs.readFileSync(sourceFile,'utf8'));assert.equal(builder.BASELINE_HASH,expected);assert.equal(builder.hash(source),expected);rules=builder.build(source,{expectedHash:expected});
 const comparable=clone(rules);comparable.rules.sisventas.gastos['.indexOn']=clone(source.rules.sisventas.gastos['.indexOn']);assert.deepEqual(comparable,source,'Only the reviewed index may change');assert.ok(rules.rules.sisventas.gastos['.indexOn'].includes('tipoPagable'));
 await owner('PUT','/.settings/rules',rules);
},{timeout:20000});
beforeEach(async()=>{if(enabled){seed=fixture();await owner('PUT','/',seed);}});
after(async()=>{if(enabled)await owner('DELETE','/');},{timeout:10000});
test('admin CRUD of reusable bonus configuration uses real CAS without changing salaries or payments',opt,async()=>{
 const absent=await currentEtag();assert.equal(absent.body,null);const original={modelo:{nombre:'Bono ficticio',monto:25.75,activo:true}},created=await writeCas(original,absent.etag);assert.equal(created.status,200,JSON.stringify(created.body));assert.deepEqual((await currentEtag()).body,original);
 const before=await currentEtag(),updated={modelo:{...original.modelo,nombre:'Bono revisado ficticio',monto:30.25}};assert.equal((await writeCas(updated,before.etag)).status,200);assert.deepEqual((await currentEtag()).body,updated);
 const present=await currentEtag();assert.equal((await writeCas(null,present.etag)).status,200);assert.equal((await currentEtag()).body,null);await economicUnchanged();
});
test('stale CAS does not overwrite another confirmed administrator edit',opt,async()=>{
 const initial={modelo:{nombre:'Bono ficticio',monto:10}};await owner('PUT',configPath,initial);const first=await currentEtag(),second=await currentEtag();assert.equal(first.etag,second.etag);
 const remote={modelo:{nombre:'Decisión concurrente ficticia',monto:12.5}};assert.equal((await writeCas(remote,second.etag)).status,200);const rejected=await writeCas({modelo:{nombre:'Vista anterior ficticia',monto:99}},first.etag);assert.equal(rejected.status,412);assert.deepEqual((await currentEtag()).body,remote);await economicUnchanged();
});
for(const change of ['permission','module','inactive','role','password-reset'])test('current '+change+' revocation before CAS rejects a previously valid admin token',opt,async()=>{
 const initial={modelo:{nombre:'Bono vigente ficticio',monto:10}};await owner('PUT',configPath,initial);const read=await currentEtag();
 if(change==='permission')await owner('PUT','/sv_permisos/admin/acciones/configuracion/editar',false);
 if(change==='module')await owner('PUT','/sv_permisos/admin/indiceModulos/configuracion',false);
 if(change==='inactive')await owner('PUT','/sv_chat_roles/admin/activo',false);
 if(change==='role')await owner('PUT','/sv_chat_roles/admin/rol','administrativo');
 if(change==='password-reset')await owner('PUT','/sv_access_resets/admin',{required:true,version:2});
 denied(await writeCas({modelo:{nombre:'No debe guardarse',monto:999}},read.etag));assert.deepEqual(await owner('GET',configPath),initial);await economicUnchanged();
});
test('configuration honors existing role defaults and explicit editing overrides without adding grants',opt,async()=>{
 const read=await currentEtag(),data={modelo:{nombre:'Bono ficticio',monto:15}};
 for(const uid of ['tech','office','external','unknown',null])denied(await writeCas(data,read.etag,{uid}));
 const allowed=roleConfig({configuration:true,edit:true});await owner('PUT','/sv_permisos/administrativo',allowed);
 assert.equal((await writeCas(data,read.etag,{uid:'office'})).status,200,'The pre-existing explicit configuration editing override is retained');
 assert.deepEqual(await owner('GET',configPath),data);await economicUnchanged();
});
test('indexed bonus query returns the complete exact type, including archived records, with no other expense types',opt,async()=>{
 const result=await request('GET','/sisventas/gastos',undefined,{query:{orderBy:'tipoPagable',equalTo:'bonificacion'}});assert.equal(result.status,200,JSON.stringify(result.body));const expectedRows=Object.fromEntries(Object.entries(seed.sisventas.gastos).filter(([,record])=>record.tipoPagable==='bonificacion'));assert.deepEqual(result.body,expectedRows);assert.deepEqual(Object.keys(result.body).sort(),['archivedBonus','bonus','otherBonus','paidBonus']);assert.equal(result.body.salary,undefined);assert.equal(result.body.commission,undefined);assert.equal(result.body.legacyBonus,undefined,'A type index does not backfill or reinterpret legacy origin-only records');await economicUnchanged();
});
test('a valid employee session cannot use the type query to leak other employees bonus history',opt,async()=>{
 const own=await request('GET','/sisventas/gastos',undefined,{uid:'tech',query:{orderBy:'empleadoId',equalTo:'e'}});assert.equal(own.status,200,JSON.stringify(own.body));assert.ok(own.body.bonus);assert.equal(own.body.otherBonus,undefined);
 const global=await request('GET','/sisventas/gastos',undefined,{uid:'tech',query:{orderBy:'tipoPagable',equalTo:'bonificacion'}});denied(global);assert.equal(global.body?.otherBonus,undefined);
 for(const uid of ['external','unknown',null])denied(await request('GET','/sisventas/gastos',undefined,{uid,query:{orderBy:'tipoPagable',equalTo:'bonificacion'}}));await economicUnchanged();
});
