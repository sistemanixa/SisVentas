'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto'),Overlay=require('../../cotizador/ot-ready-overlay');
function create({directory,manifest,otManifest,dependencies={},overlay=true}){
 const root=path.resolve(__dirname,'../../cotizador'),cache=new Map(),files=new Map();
 for(const file of [...manifest.files,...otManifest.files]){
  const name=file.name;if(typeof name!=='string'||name.includes('/')||!name.endsWith('.js')||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid reviewed runtime manifest');
  const bytes=fs.readFileSync(path.join(directory,name));if(crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Reviewed runtime source changed: '+name);files.set(name,bytes);
 }
 function load(name){if(cache.has(name))return cache.get(name).exports;if(Object.hasOwn(dependencies,name))return dependencies[name];
  const filename=path.join(root,name),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(name,mod);mod.require=specifier=>specifier.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(filename),specifier)).replaceAll('\\','/').replace(/\.js$/,'')+'.js'):Module.createRequire(filename)(specifier);
  const bytes=files.get(name)||fs.readFileSync(filename),source=overlay&&files.has(name)&&['ot-lifecycle.js','ot-delivery.js'].includes(name)?Overlay.apply(name,bytes):bytes;mod._compile(source.toString('utf8'),filename);return mod.exports;
 }
 return{load,verifiedFiles:[...files.keys()]};
}
module.exports={create};
