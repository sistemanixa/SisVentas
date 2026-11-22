'use strict';
// Load the reviewed core from immutable Git objects, without editing another checkout.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),local=fs.existsSync(path.join(root,'cotizador/office-stock-link-command.js')),revision=local?'working-tree':'dd111977a48029c46f5f8b995155ebb180471d87';
function forRevision(requested){const ref=local?'working-tree':requested,cache=new Map();
function load(file){
 const name=path.posix.normalize(file);if(name.startsWith('../')||name.startsWith('/'))throw Error('Outside frozen fixture');if(cache.has(name))return cache.get(name).exports;
 if(local)return require(path.join(root,name));
 const source=execFileSync('git',['show',ref+':'+name],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024}),module={exports:{}};cache.set(name,module);
 const localRequire=request=>{if(!request.startsWith('.'))return require(request);const target=path.posix.normalize(path.posix.join(path.posix.dirname(name),request));return load(path.posix.extname(target)?target:target+'.js');};
 if(name.endsWith('.json'))module.exports=JSON.parse(source);else vm.runInThisContext(Module.wrap(source),{filename:ref+':'+name})(module.exports,localRequire,module,path.join(root,name),path.dirname(path.join(root,name)));return module.exports;
}
return{load,revision:ref};}
module.exports={...forRevision(revision),forRevision};
