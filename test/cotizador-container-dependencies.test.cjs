'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../cotizador');
test('la imagen del Cotizador incluye las dependencias locales de cada módulo copiado',()=>{
 const docker=fs.readFileSync(path.join(root,'Dockerfile'),'utf8'),included=new Set();
 for(const line of docker.split(/\r?\n/)){
  if(!/^COPY\s/.test(line))continue;
  const entries=line.trim().split(/\s+/).slice(1,-1);
  for(const entry of entries){
   if(entry.includes('*'))continue;
   const source=path.join(root,entry);
   if(fs.statSync(source).isDirectory()){
    for(const filename of fs.readdirSync(source,{recursive:true}))if(filename.endsWith('.js'))included.add(path.resolve(source,filename));
   }else if(entry.endsWith('.js'))included.add(path.resolve(source));
  }
 }
 const missing=[];
 for(const filename of included)for(const match of fs.readFileSync(filename,'utf8').matchAll(/require\(\s*['"](\.[^'"\r\n]+)['"]\s*\)/g)){
  const target=path.resolve(path.dirname(filename),match[1]);
  const resolved=[target,target+'.js',path.join(target,'index.js')].find(candidate=>fs.existsSync(candidate)&&fs.statSync(candidate).isFile());
  if(!resolved||!included.has(resolved))missing.push(path.relative(root,filename)+' -> '+match[1]);
 }
 assert.deepEqual(missing,[],'Faltan dependencias locales en COPY del contenedor');
});
