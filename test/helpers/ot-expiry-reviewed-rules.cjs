'use strict';
// Compile only immutable, reviewed Git blobs; never import another worktree's WIP.
const path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module'),{execFileSync}=require('node:child_process');
const base='3134eb50fb82f4185d0d667f5d3deec06cf9477e',cut='8c48e583272d507cd1ea14e1af753326f15a5c92',core='02ee4f6d03acbac48b9c431acb28e25e1b222498';
function prepare(raw,activationPins){
 const root=path.resolve(__dirname,'../..'),sources=new Map(),modules=new Map(),hashes={};
 const files={'scripts/lib/stock-link-rules.cjs':base,'scripts/lib/stock-link-scope-rules.cjs':base,'scripts/lib/stock-link-index-rules.cjs':base,'scripts/lib/catalog-write-fence-rules.cjs':base,'scripts/lib/stock-link-activation-rules.cjs':base,'scripts/lib/stock-order-metadata-rules.cjs':base,'scripts/lib/purchase-inventory-sdk-cut-rules.cjs':cut,'cotizador/labor-fence-policy.js':base,'cotizador/stock-link-activation-contract.js':core};
 for(const [relative,commit]of Object.entries(files)){const bytes=execFileSync('git',['show',commit+':'+relative],{cwd:root,windowsHide:true,timeout:10000});sources.set(path.resolve(root,relative),bytes);hashes[relative]={commit,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
 function load(filename){if(modules.has(filename))return modules.get(filename).exports;const bytes=sources.get(filename);if(!bytes)throw Error('Unreviewed builder dependency: '+path.relative(root,filename));const mod=new Module(filename,module);mod.filename=filename;modules.set(filename,mod);mod.require=specifier=>{if(specifier.startsWith('.'))return load(path.resolve(path.dirname(filename),specifier+(path.extname(specifier)?'':'.js')));if(specifier!=='node:crypto')throw Error('Unexpected builder dependency');return require(specifier);};mod._compile(bytes.toString(),filename);return mod.exports;}
 const link=load(path.resolve(root,'scripts/lib/stock-link-rules.cjs')).prepare(raw,{activationPins}).rules;
 const retired=load(path.resolve(root,'scripts/lib/purchase-inventory-sdk-cut-rules.cjs')).prepare(link,{activationPins});
 const result=load(path.resolve(root,'scripts/lib/stock-order-metadata-rules.cjs')).prepare(retired,{activationPins});return{rules:result.rules,hashes};
}
module.exports={prepare};
