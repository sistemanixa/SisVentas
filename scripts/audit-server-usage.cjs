'use strict';
// Source inventory only: no network, credentials, writes or production calls.
const fs=require('node:fs'),path=require('node:path');
function inventory(root=path.resolve(__dirname,'..')){
 const active=new Set(),entries=['index.html','catalogo.html','personal-finance.html'];
 for(const name of entries){const file=path.join(root,name);if(!fs.existsSync(file))continue;for(const m of fs.readFileSync(file,'utf8').matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)){const src=m[1].split('?')[0].replace(/^\.\//,'');if(!/^https?:/.test(src)&&fs.existsSync(path.join(root,src)))active.add(src);}}
 const files=[];function walk(dir){if(!fs.existsSync(path.join(root,dir)))return;for(const f of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){if(['node_modules','.git'].includes(f.name))continue;const name=dir+'/'+f.name;if(f.isDirectory())walk(name);else if(/\.(?:js|cjs)$/.test(name))files.push(name);}}
 for(const dir of ['js/core','js/modules','cotizador','cloud-functions'])walk(dir);
 for(const file of active)if(!files.includes(file))files.push(file);
 const timerSites=[],serverReferences=[];
 for(const file of files){const text=fs.readFileSync(path.join(root,file),'utf8');text.split(/\r?\n/).forEach((line,i)=>{
  if(/\bsetInterval\s*\(/.test(line))timerSites.push({file,line:i+1,referencedByEntry:active.has(file),kind:'interval-needs-call-chain-review'});
  if(/cotizadorProveedor|\/laboral\/|\/comerciales\/|\/proyectos\/|\/chat\/mensaje|\/inventario\/contar-desde-ot/.test(line))serverReferences.push({file,line:i+1,referencedByEntry:active.has(file)});
 });}
 const router=fs.readFileSync(path.join(root,'cotizador/index.js'),'utf8'),routes=new Set();
 for(const m of router.matchAll(/pathname\s*===?\s*(['"])(\/[^'"\s]*)\1/g))routes.add(m[2]);
 for(const m of router.matchAll(/\[([^\]\n]*)\]\.includes\(pathname\)/g))for(const p of m[1].matchAll(/['"](\/[^'"]*)['"]/g))routes.add(p[1]);
 return {scope:'static-literal-inventory-not-runtime-proof',activeEntryScripts:active.size,activeApp:[...active].find(f=>/^js\/app\.v/.test(f)),literalRoutes:[...routes].sort(),timerSites,serverReferences,limits:['Dynamic routes, indirect imports and callback effects require manual tracing.','A timer site is not proof of network traffic.','Existing source does not prove deployment or activation.']};
}
if(require.main===module)process.stdout.write(JSON.stringify(inventory(),null,2)+'\n');
module.exports={inventory};
