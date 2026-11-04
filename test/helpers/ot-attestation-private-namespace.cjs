'use strict';
// Offline local composition and a NEW namespace on an already-running emulator.
// Never discovers remote rules, launches/stops a process, installs or deploys.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline={file:'C:/SisVentas/tmp/stage1-integral-plan/rules-observed-final.private.json',sha256:'dee40945c7224f449a1f460193c268796341bd97e3c82c8e00ea236385be1fb7'};
function compose(){
 const files=['scripts/lib/commercial-write-cut-rules.cjs','scripts/lib/ot-delivery-fence.cjs','scripts/lib/ot-delivery-attestation-rules.cjs'].map(f=>path.join(root,f));
 const builders=files.map(f=>({file:f,sha256:hash(fs.readFileSync(f)),prepare:require(f).prepare}));
 const dependencies=new Set();function visit(mod){if(!mod||dependencies.has(mod.filename))return;const relative=path.relative(root,mod.filename);assert(!relative.startsWith('..')&&!path.isAbsolute(relative),'Builders must stay in this checkout');dependencies.add(mod.filename);for(const child of mod.children)visit(child);}
 files.forEach(f=>visit(require.cache[require.resolve(f)]));
 const frozen=Object.fromEntries([...dependencies].sort().map(f=>[f,hash(fs.readFileSync(f))]));
 function assertFrozen(){assert.equal(hash(fs.readFileSync(baseline.file)),baseline.sha256,'Historical baseline drift');for(const [file,sha256]of Object.entries(frozen))assert.equal(hash(fs.readFileSync(file)),sha256,'Builder/dependency drift: '+file);for(const b of builders)assert.equal(hash(fs.readFileSync(b.file)),b.sha256,'Builder changed while loading');}
 assertFrozen();let rules=JSON.parse(fs.readFileSync(baseline.file,'utf8'));for(const b of builders){assert.equal(typeof b.prepare,'function');rules=b.prepare(rules);}assertFrozen();
 return{rules,assertFrozen,evidence:{scope:'historical-local-baseline + commercial-write-cut-rules + ot-delivery-fence + ot-delivery-attestation-rules',baseline,builders:builders.map(({file,sha256})=>({file,exportName:'prepare',sha256})),dependencies:frozen,candidateSha256:hash(JSON.stringify(rules)),remoteRulesVerified:false,productionChanged:false,ttlValidated:false}};
}
async function open(candidate,{port,dependenciesPackage='C:/SisVentas/tmp/firebase-security-tools/package.json'}={}){
 assert.equal(port,9046,'Only the explicitly designated existing loopback emulator');assert(path.isAbsolute(dependenciesPackage));
 await new Promise((resolve,reject)=>{const socket=net.connect({host:'127.0.0.1',port});const done=e=>{socket.destroy();e?reject(e):resolve();};socket.setTimeout(2000,()=>done(Error('Existing emulator timeout')));socket.once('error',()=>done(Error('Existing emulator unavailable; do not start/stop another owner’s process')));socket.once('connect',()=>done());});
 candidate.assertFrozen();const dependency=createRequire(dependenciesPackage),testing=dependency('@firebase/rules-unit-testing'),sdk=dependency('firebase/database');
 const projectId='demo-otatt-'+crypto.randomBytes(8).toString('hex');
 const environment=await testing.initializeTestEnvironment({projectId,database:{host:'127.0.0.1',port,rules:JSON.stringify(candidate.rules)}});candidate.assertFrozen();
 return{environment,sdk,projectId,evidence:{...candidate.evidence,emulator:'127.0.0.1:'+port,projectId}};
}
module.exports={compose,open};
