'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync,spawnSync}=require('node:child_process');
const {stage,requires,MANIFEST,VENDOR_MANIFEST}=require('../scripts/stage-guarded-invoice-function.cjs');
const script=path.resolve(__dirname,'../scripts/stage-guarded-invoice-function.cjs');
const functionRoot='cloud-functions/emitir-factura';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function fixture(t,extra={}){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'sv-invoice-stage-')),source=path.join(base,'source'),destination=path.join(base,'bundle');fs.mkdirSync(source);
 t.after(()=>{const resolved=path.resolve(base),relative=path.relative(path.resolve(os.tmpdir()),resolved);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));assert.match(path.basename(resolved),/^sv-invoice-stage-/);fs.rmSync(resolved,{recursive:true,force:true});});
 const put=(name,value)=>{const target=path.join(source,...name.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
 const packageInfo={name:'fictitious-invoice',private:true,main:'index.js',dependencies:{'firebase-admin':'^12.1.0','firebase-functions':'^5.0.0'}};
 const files={
  [functionRoot+'/package.json']:JSON.stringify(packageInfo),
  [functionRoot+'/package-lock.json']:JSON.stringify({lockfileVersion:3,packages:{'':{name:packageInfo.name,dependencies:packageInfo.dependencies}}}),
  [functionRoot+'/index.js']:"require('firebase-functions/v2/https'); require('./service-auth.cjs'); require('./fiscal-model.cjs'); module.exports=require('./labor-bridge.cjs');\n",
  [functionRoot+'/service-auth.cjs']:"require('./security-storage.cjs'); module.exports={};\n",
  [functionRoot+'/security-storage.cjs']:"module.exports={usersPath:()=> 'fictitious'};\n",
  [functionRoot+'/fiscal-model.cjs']:"module.exports={round:value=>value};\n",
  [functionRoot+'/labor-bridge.cjs']:"const fs=require('node:fs'),path=require('node:path'); const vendored=fs.existsSync(path.join(__dirname,'vendor/labor/manifest.json')); module.exports={guard:vendored?require('./vendor/labor/labor-guard'):require('../../cotizador/labor-guard'),store:vendored?require('./vendor/labor/labor-rtdb-store'):require('../../cotizador/labor-rtdb-store')};\n",
  'cotizador/labor-guard.js':"const Index=require('./labor-index');const limit=require('./labor-commission-limit');module.exports={Index,limit};\n",
  'cotizador/labor-rtdb-store.js':"module.exports={guard:require('./labor-guard')};\n",
  'cotizador/labor-index.js':"module.exports={expense:require('./personal-expenses'),calcs:require('./commission-calculations')};\n",
  'cotizador/personal-expenses.js':"require('node:crypto');module.exports={identity:()=> 'fictitious'};\n",
  'cotizador/commission-calculations.js':"module.exports={paid:1};\n",
  'cotizador/labor-commission-limit.js':"module.exports={calcs:require('./commission-calculations')};\n",
  'cotizador/irrelevant-business.js':"throw Error('Should not be copied');\n",
  [functionRoot+'/README.md']:'Never deploy documentation',
  [functionRoot+'/test/not-deploy.test.cjs']:'throw Error("Never deploy tests")',
  'docs/private.md':'Not part of the bundle',
  '.gitignore':'node_modules/\n.env\n',
  ...extra
 };
 for(const [name,value]of Object.entries(files))put(name,value);
 const git=args=>execFileSync('git',['-c','core.hooksPath=.git/hooks','-c','commit.gpgsign=false',...args],{cwd:source,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
 git(['init','--quiet']);git(['config','core.autocrlf','false']);
 const commit=()=>{git(['add','--all']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Fictitious stage source']);return git(['rev-parse','HEAD']);};
 const expectedCommit=commit();return {base,source,destination,put,git,commit,expectedCommit,options:()=>({source,expectedCommit,destination})};
}
test('dry-run inventaría sólo deploy y cierre transitivo, sin crear destino ni ejecutar función',t=>{
 const f=fixture(t),result=stage(f.options());assert.equal(result.mode,'plan');assert.equal(fs.existsSync(f.destination),false);assert.equal(result.manifest.sourceCommit,f.expectedCommit);assert.match(result.manifestSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(result.manifest.files.map(file=>file.path),['fiscal-model.cjs','index.js','labor-bridge.cjs','package-lock.json','package.json','security-storage.cjs','service-auth.cjs','vendor/labor/commission-calculations.js','vendor/labor/labor-commission-limit.js','vendor/labor/labor-guard.js','vendor/labor/labor-index.js','vendor/labor/labor-rtdb-store.js','vendor/labor/manifest.json','vendor/labor/personal-expenses.js']);
 assert.deepEqual(result.manifest.externalPackages,{'firebase-functions':'^5.0.0'});
 for(const entry of result.manifest.files){assert.match(entry.sha256,/^[a-f0-9]{64}$/);assert.ok(entry.bytes>0);assert.ok(!/(README|not-deploy|irrelevant|docs|node_modules|\.env)/.test(entry.path));}
});
test('apply copia blobs revisados, manifiestos reproducibles y dependencias cargables sin el checkout',t=>{
 const f=fixture(t),plan=stage(f.options()),result=stage({...f.options(),apply:true});assert.equal(result.mode,'staged');assert.equal(result.manifestSha256,plan.manifestSha256);
 const manifestBytes=fs.readFileSync(path.join(f.destination,MANIFEST)),manifest=JSON.parse(manifestBytes);assert.equal(hash(manifestBytes),result.manifestSha256);assert.deepEqual(manifest,result.manifest);
 for(const file of manifest.files){const bytes=fs.readFileSync(path.join(f.destination,...file.path.split('/')));assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);if(file.source)assert.deepEqual(bytes,Buffer.from(execFileSync('git',['show',f.expectedCommit+':'+file.source],{cwd:f.source})));}
 const vendor=JSON.parse(fs.readFileSync(path.join(f.destination,VENDOR_MANIFEST)));assert.equal(vendor.sourceCommit,f.expectedCommit);assert.ok(vendor.files.every(file=>file.path.startsWith('vendor/labor/')));
 const bridge=require(path.join(f.destination,'labor-bridge.cjs'));assert.equal(bridge.guard.Index.expense.identity(),'fictitious');assert.equal(bridge.guard.limit.calcs.paid,1);assert.equal(bridge.store.guard,bridge.guard);
 assert.throws(()=>stage({...f.options(),apply:true}),/nuevo o vacío/);
});
test('rechaza SHA abreviado/distinto y checkout dirty, incluso cambios fuera del alcance y archivos no tracked',t=>{
 const f=fixture(t);assert.throws(()=>stage({...f.options(),expectedCommit:f.expectedCommit.slice(0,8)}),/SHA completo/);assert.throws(()=>stage({...f.options(),expectedCommit:'f'.repeat(40)}),/no coincide/);
 f.put('docs/private.md','Unrelated change');assert.throws(()=>stage(f.options()),/completamente limpio/);f.git(['checkout','--','docs/private.md']);
 f.put('untracked.txt','Unknown work');assert.throws(()=>stage(f.options()),/completamente limpio/);assert.equal(fs.existsSync(f.destination),false);
});
test('ignorados node_modules y .env nunca se inventarían ni leen',t=>{
 const f=fixture(t);f.put('node_modules/credential.json','fictional secret ignored');f.put('.env','FICTIONAL_SECRET=do-not-copy');
 const result=stage({...f.options(),apply:true});assert.ok(result.manifest.files.every(file=>!/(\.env|node_modules)/.test(file.path)));assert.equal(fs.existsSync(path.join(f.destination,'.env')),false);
});
test('destino requiere tmp privado fuera del checkout y un directorio nuevo/vacío',t=>{
 const f=fixture(t);assert.throws(()=>stage({...f.options(),destination:'relative/tmp/out'}),/ruta absoluta/);assert.throws(()=>stage({...f.options(),destination:path.join(f.source,'tmp','out')}),/fuera del checkout/);
 fs.mkdirSync(f.destination);assert.equal(stage(f.options()).mode,'plan');assert.equal(fs.readdirSync(f.destination).length,0);
 fs.writeFileSync(path.join(f.destination,'keep.txt'),'Existing work');assert.throws(()=>stage({...f.options(),apply:true}),/nuevo o vacío/);assert.equal(fs.readFileSync(path.join(f.destination,'keep.txt'),'utf8'),'Existing work');
});
test('el destino dentro de otro Git exige exclusión completa y rechaza archivos tracked',t=>{
 const f=fixture(t),container=path.join(f.base,'container');fs.mkdirSync(container);const git=args=>execFileSync('git',args,{cwd:container,encoding:'utf8',windowsHide:true}).trim();git(['init','--quiet']);
 const destination=path.join(container,'tmp','out');fs.mkdirSync(path.dirname(destination));assert.throws(()=>stage({...f.options(),destination}),/ignorado/);
 fs.writeFileSync(path.join(container,'.gitignore'),'tmp/\n');assert.equal(stage({...f.options(),destination}).mode,'plan');
 fs.mkdirSync(destination);fs.writeFileSync(path.join(destination,'tracked.txt'),'keep');git(['add','--force','tmp/out/tracked.txt']);fs.unlinkSync(path.join(destination,'tracked.txt'));assert.throws(()=>stage({...f.options(),destination}),/versionados/);
});
test('fuente con symlink tracked y destino junction no se atraviesan',t=>{
 const f=fixture(t),target=path.join(f.base,'real');fs.mkdirSync(target);const junction=path.join(f.base,'linked');
 fs.symlinkSync(target,junction,process.platform==='win32'?'junction':'dir');assert.throws(()=>stage({...f.options(),destination:path.join(junction,'out')}),/enlaces simbólicos/);assert.deepEqual(fs.readdirSync(target),[]);
 // Git index can represent a symlink without needing Windows symlink privilege.
 const symlinkBlob=execFileSync('git',['hash-object','-w','--stdin'],{cwd:f.source,input:'../../outside-secret.cjs',encoding:'utf8',windowsHide:true}).trim();
 f.git(['update-index','--cacheinfo','120000,'+symlinkBlob+','+functionRoot+'/fiscal-model.cjs']);f.git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Symlink fixture']);
 // Recreate its checked-out representation exactly as Git expects on Windows.
 fs.unlinkSync(path.join(f.source,functionRoot,'fiscal-model.cjs'));
 if(process.platform==='win32'){f.git(['config','core.symlinks','false']);fs.writeFileSync(path.join(f.source,functionRoot,'fiscal-model.cjs'),'../../outside-secret.cjs');}else fs.symlinkSync('../../outside-secret.cjs',path.join(f.source,functionRoot,'fiscal-model.cjs'));
 assert.throws(()=>stage({...f.options(),expectedCommit:f.git(['rev-parse','HEAD'])}),/archivo regular versionado/);
});
test('scanner ignora comentarios/cadenas/regex y rechaza loaders dinámicos o indirectos',()=>{
 assert.deepEqual(requires("// require('./secret.js')\n const text=\"require('./secret.js')\"; const pattern=/require\\('bad'\\)/; /* require('./bad') */ require('./real'); require('node:crypto');",'fixture'),['./real','node:crypto']);
 for(const source of ["require('./'+name)",'const load=require;','module.require("./other")',"module['require']('./other')","globalThis['requ'+'ire']('./other')","module.exports=()=>import('./missing.cjs')","eval('loader')","new Function('loader')",'require(`./${name}`)',"require('./\\u0073ecret')"]){assert.throws(()=>requires(source,'fixture'),/no soportada|ruta literal|dinámica/);}
});
test('una dependencia local ausente, fuera del paquete, secreta o npm no declarada falla antes de escribir',t=>{
 for(const extra of ["require('./missing');","require('../../docs/private.md');","require('./credential.json');","require('new-package');"]){
  const f=fixture(t,{[functionRoot+'/fiscal-model.cjs']:extra,[functionRoot+'/credential.json']:'{"fictitious":true}'});assert.throws(()=>stage(f.options()),/ausente|sale de su paquete|secretos|npm no declarada/);assert.equal(fs.existsSync(f.destination),false);
 }
});
test('closure laboral no escapa de cotizador y no acepta una función sin guard o lock incoherente',t=>{
 const outside=fixture(t,{'cotizador/personal-expenses.js':"module.exports=require('../cloud-functions/emitir-factura/fiscal-model.cjs');"});assert.throws(()=>stage(outside.options()),/sale de cotizador/);
 const plain=fixture(t,{[functionRoot+'/index.js']:"module.exports={};"});assert.throws(()=>stage(plain.options()),/sin guard/);
 const lock=fixture(t,{[functionRoot+'/package-lock.json']:'{"packages":{"":{"dependencies":{}}}}'});assert.throws(()=>stage(lock.options()),/package-lock/);
});
test('CLI por defecto sólo imprime plan y no instala, autentica ni despliega',t=>{
 const f=fixture(t),args=['--source',f.source,'--expected-commit',f.expectedCommit,'--destination',f.destination];const run=spawnSync(process.execPath,[script,...args],{encoding:'utf8',windowsHide:true});assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).mode,'plan');assert.equal(fs.existsSync(f.destination),false);
 const rejected=spawnSync(process.execPath,[script,...args,'--deploy'],{encoding:'utf8',windowsHide:true});assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/Argumento inválido/);
 const imported=spawnSync(process.execPath,['-e','require('+JSON.stringify(script)+')'],{encoding:'utf8',env:{...process.env,PATH:''},windowsHide:true});assert.equal(imported.status,0,imported.stderr);assert.equal(imported.stdout,'');assert.equal(fs.existsSync(f.destination),false);
});
test('los módulos reales actuales de función y labor forman un paquete autónomo sin npm adicional',t=>{
 const root=path.resolve(__dirname,'..'),extra={};
 for(const name of fs.readdirSync(path.join(root,functionRoot)))if(/\.(js|cjs|json)$/.test(name))extra[functionRoot+'/'+name]=fs.readFileSync(path.join(root,functionRoot,name));
 for(const name of ['sale-cost-correction.js','sale-cost-correction-model.js','labor-guard.js','labor-rtdb-store.js','labor-index.js','labor-commission-limit.js','labor-bonus-batch.js','bonus-quantity-model.js','labor-sac-batch.js','payroll-legacy-sac-model.js','labor-advance-discount.js','personal-expenses.js','commission-calculations.js','payment-membership-index.js','payment-membership-matcher.js','expense-removal-guard.js','expense-removal-policy.js','commercial-ownership.js','domain-read-policy.js'])extra['cotizador/'+name]=fs.readFileSync(path.join(root,'cotizador',name));
 const f=fixture(t,extra),result=stage({...f.options(),apply:true});
 for(const name of ['sale-cost-correction.js','sale-cost-correction-model.js','labor-guard.js','labor-rtdb-store.js','labor-index.js','labor-commission-limit.js','labor-bonus-batch.js','bonus-quantity-model.js','labor-sac-batch.js','payroll-legacy-sac-model.js','labor-advance-discount.js','personal-expenses.js','commission-calculations.js','payment-membership-index.js','payment-membership-matcher.js','expense-removal-guard.js','expense-removal-policy.js','commercial-ownership.js','domain-read-policy.js'])assert.ok(result.manifest.files.some(file=>file.path==='vendor/labor/'+name));
 assert.deepEqual(Object.keys(result.manifest.externalPackages),['firebase-admin','firebase-functions']);
 assert.equal(typeof require(path.join(f.destination,'labor-bridge.cjs')).createFiscalLaborBridge,'function');assert.equal(typeof require(path.join(f.destination,'vendor/labor/labor-guard.js')).createLaborGuard,'function');
 for(const file of result.manifest.files.filter(file=>/\.(js|cjs)$/.test(file.path)))new (require('node:vm').Script)(fs.readFileSync(path.join(f.destination,file.path),'utf8'),{filename:file.path});
});
