'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),O=require('../scripts/lib/combined-accounts-clothing-overlay.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('composition rejects an unreviewed native image or source hashes',()=>{assert.throws(()=>O.derive({}),/explicit|Exactly|source|hash/i);assert.throws(()=>O.derive({baseImage:'unreviewed'}),/Unexpected/);});
test('reviewed four-file derivation preserves every other inherited runtime file',{skip:!process.env.SV_COMBINED_NATIVE_BASE},()=>{
 const base=process.env.SV_COMBINED_NATIVE_BASE,baselines={},sources={},expectedSourceHashes={};for(const n of O.NAMES){baselines[n]=fs.readFileSync(path.join(base,n));sources[n]=fs.readFileSync(path.join(__dirname,'../cotizador',n));expectedSourceHashes[n]=sha(sources[n]);}
 const before=Object.fromEntries(O.NAMES.map(n=>[n,sha(baselines[n])])),result=O.derive({baselines,sources,expectedBaseHashes:O.BASE_HASHES,expectedSourceHashes,baseImage:O.BASE_IMAGE});
 assert.deepEqual(Object.keys(result.files).sort(),[...O.NAMES].sort());assert.match(result.files['index.js'].toString(),/employeeResourcesHTTP/);assert.match(result.files['labor-rtdb-store.js'].toString(),/employeeResourcesCommitVersion:1/);assert.match(result.files['labor-rtdb-store.js'].toString(),/readQuery/);
 for(const n of O.NAMES){assert.equal(sha(baselines[n]),before[n]);assert.equal(result.manifest.files[n].payloadSha256,sha(result.files[n]));}
 const oldOutput=result.files['index.js'];assert.throws(()=>O.derive({baselines:{...baselines,'index.js':oldOutput},sources,expectedBaseHashes:O.BASE_HASHES,expectedSourceHashes,baseImage:O.BASE_IMAGE}),/hash/);
});
