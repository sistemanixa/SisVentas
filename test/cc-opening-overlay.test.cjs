'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const Patch=require('../cotizador/cc-opening-overlay/attach.cjs');
const source=process.env.SV_CC_SERVER_SOURCE,index=process.env.SV_CC_SERVER_INDEX;
function completeFunction(text,marker){
 const start=text.indexOf(marker);assert(start>=0);const endings=/^\s?\}/gm;endings.lastIndex=start;
 for(let match;(match=endings.exec(text));){const candidate=text.slice(start,match.index+match[0].length);try{new(require('node:vm').Script)(candidate);return candidate;}catch{}}
 assert.fail('Incomplete function: '+marker);
}
test('CC overlay rejects unknown input rather than replacing server functions',()=>{
 for(const name of Object.keys(Patch.BASE))assert.throws(()=>Patch.apply(name,'unknown source'),/baseline changed/);
 assert.throws(()=>Patch.apply('labor-runtime.js','unknown source'),/baseline changed/);
 const docker=fs.readFileSync(require.resolve('../cotizador/cc-opening-overlay/Dockerfile'),'utf8');
 assert(!/^(ENV|ENTRYPOINT|CMD|USER|EXPOSE) /m.test(docker));assert.equal(docker.split('\n').filter(s=>s.startsWith('COPY ')).length,1);
});
test('exact deployed baseline retains write/auth functions while changing only the list read pool',{skip:!source||!index},async()=>{
 const original=fs.readFileSync(source,'utf8'),entry=fs.readFileSync(index,'utf8'),patched=Patch.apply('commercial-ownership.js',original),patchedIndex=Patch.apply('index.js',entry);
 assert.equal(patchedIndex.replace('listReadConcurrency:16,',''),entry);
 for(const marker of ['function validateCommercialActor(','async function mutate(','async function authorizedRecord(']){
  assert.equal(completeFunction(patched,marker),completeFunction(original,marker));
 }
 const mod=new Module(source,module);mod.filename=path.resolve(__dirname,'../cotizador/commercial-ownership.js');mod.paths=Module._nodeModulePaths(path.dirname(mod.filename));mod._compile(patched,mod.filename);
 const {db}=require('./helpers/commercial-ownership-fixtures.cjs').fixture(),api=mod.exports.createCommercialOwnership({db,auth:{verifyIdToken:async uid=>({uid})},enabled:true,listReadConcurrency:16});
 const actor=await api.authorize({headers:{authorization:'Bearer a'}},'ventas'),result=await api.list(actor);
 assert.deepEqual(Object.keys(result.records),['one','converted']);assert.equal(result.records.converted._svOwnerUid,'a');assert.equal(result.records.converted._svOriginalAuthor.name,'Persona a');
 await assert.rejects(api.authorize({headers:{authorization:'Bearer tech'}},'ventas'),{statusCode:403});
});
