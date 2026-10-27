'use strict';
// Build an allowlisted Docker context. Never send .git, profiles, tmp or .local.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),target=path.resolve(process.argv[2]||'');
assert.ok(process.argv[2]&&target!==root&&!root.startsWith(target+path.sep),'Explicit external context required');
fs.mkdirSync(target,{recursive:true});assert.equal(fs.readdirSync(target).length,0,'Context must start empty');
const seen=new Set();
function copy(relative){if(seen.has(relative))return;seen.add(relative);assert.ok(/^(cotizador|scripts|js\/core|test)\//.test(relative)&&!relative.includes('..'),'Allowlisted source path');const file=path.join(root,relative),text=fs.readFileSync(file,'utf8'),out=path.join(target,relative);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,text);
 for(const match of text.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){let next=path.resolve(path.dirname(file),match[1]);if(!path.extname(next))next+='.js';assert.ok(next.startsWith(root+path.sep));copy(path.relative(root,next).replaceAll(path.sep,'/'));}}
for(const file of ['test/ot-unit-confirmation-rules.integration.cjs','test/isolated-ot/run.cjs','test/isolated-ot/rules-base.cjs'])copy(file);
fs.copyFileSync(path.join(root,'test/isolated-ot/Dockerfile'),path.join(target,'Dockerfile'));
console.log('Isolated context: '+seen.size+' reviewed source files; no credentials or production snapshot');
