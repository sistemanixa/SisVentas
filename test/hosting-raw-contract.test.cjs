'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {sha256,verifyRawArtifact,loadVerifiedRawArtifact}=require('../scripts/lib/hosting-raw-contract.cjs');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sv-hosting-raw-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'js'));fs.writeFileSync(path.join(root,'index.html'),'a\nb');fs.writeFileSync(path.join(root,'js/a.js'),'let a=1;');
 const names=['index.html','js/a.js'],config={headers:[]},sourceCommit='a'.repeat(40);
 const manifest={schema:1,kind:'hosting-raw-byte-contract',sourceCommit,configSha256:sha256(Buffer.from(JSON.stringify(config))),files:names.map(name=>{const b=fs.readFileSync(path.join(root,name));return {path:name,bytes:b.length,sha256:sha256(b)};})};
 return {root,names,config,sourceCommit,manifest};
}
test('RAW bytes are snapshotted, not reread after verification',t=>{const f=fixture(t),b=verifyRawArtifact(f);fs.writeFileSync(path.join(f.root,'js/a.js'),'changed');assert.equal(b.get('js/a.js').toString(),'let a=1;');});
test('CRLF drift fails even when normalized source is equal',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.root,'index.html'),'a\r\nb');assert.throws(()=>verifyRawArtifact(f),/Bytes RAW/);});
test('missing, extra, duplicate and traversal paths fail closed',t=>{const f=fixture(t);for(const names of [['index.html'],[...f.names,'js/extra.js'],['index.html','index.html'],['../index.html','js/a.js']])assert.throws(()=>verifyRawArtifact({...f,names}));const m=structuredClone(f.manifest);m.files[0].path='../index.html';assert.throws(()=>verifyRawArtifact({...f,manifest:m}),/Ruta/);});
test('raw mutation, absent file, source and config drift reject',t=>{const f=fixture(t);assert.throws(()=>verifyRawArtifact({...f,sourceCommit:'b'.repeat(40)}));assert.throws(()=>verifyRawArtifact({...f,config:{headers:[1]}}));fs.writeFileSync(path.join(f.root,'js/a.js'),'let a=2;');assert.throws(()=>verifyRawArtifact(f),/Bytes RAW/);fs.unlinkSync(path.join(f.root,'js/a.js'));assert.throws(()=>verifyRawArtifact(f),/ENOENT/);});
test('manifest itself must match separately reviewed hash',t=>{const f=fixture(t),manifestPath=path.join(f.root,'contract.json');fs.writeFileSync(manifestPath,JSON.stringify(f.manifest));const expectedManifestSha256=sha256(fs.readFileSync(manifestPath));assert.equal(loadVerifiedRawArtifact({...f,manifestPath,expectedManifestSha256}).size,2);assert.throws(()=>loadVerifiedRawArtifact({...f,manifestPath,expectedManifestSha256:'0'.repeat(64)}),/Hash/);assert.throws(()=>loadVerifiedRawArtifact({...f,manifestPath}),/expected-raw/);});
test('publisher preflight happens before credentials and compression uses validated buffers',()=>{const s=fs.readFileSync(path.join(__dirname,'../scripts/deploy-secure-hosting.cjs'),'utf8');assert.ok(s.indexOf('loadVerifiedRawArtifact({')<s.indexOf('token=accessToken();'));assert.match(s,/gzipSync\(rawBuffers.get\(name\)\)/);assert.doesNotMatch(s,/gzipSync\(fs.readFileSync/);});
