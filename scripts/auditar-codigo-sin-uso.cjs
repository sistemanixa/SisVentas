const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const active=index.match(/src="\.\/(js\/app\.v[\d.]+\.js)"/)[1];
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):e.name.endsWith('.js')?[dir+'/'+e.name]:[]);}
const files=[active,...walk('js/modules'),...walk('js/v3'),...walk('js/core').filter(f=>!f.includes('/version.v')),...fs.readdirSync(root).filter(f=>f.endsWith('.html'))];
const sources=files.map(file=>({file,text:fs.readFileSync(path.join(root,file),'utf8')}));
const counts=new Map();for(const {text}of sources)for(const name of text.match(/[A-Za-z_$][\w$]*/g)||[])counts.set(name,(counts.get(name)||0)+1);
const candidates=[];for(const {file,text}of sources)for(const m of text.matchAll(/^(?:async )?function ([\w$]+)\(/gm))if(counts.get(m[1])===1)candidates.push({file,name:m[1],line:text.slice(0,m.index).split('\n').length});
console.log(JSON.stringify({active,files:files.length,scope:'Aplicación activa, módulos iniciales y diferidos, núcleo, V3 y entradas HTML; excluye instantáneas históricas de app/version.',warning:'Los candidatos son para revisión; no prueban que una función sea eliminable. Verificar referencias dinámicas y contratos de integración.',candidates},null,2));

