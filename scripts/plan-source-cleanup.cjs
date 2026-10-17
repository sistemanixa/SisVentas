'use strict';
// Solo inventaría archivos versionados. No borra ni modifica el checkout.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function plan(){
 const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).split('\0').filter(Boolean);
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const active=index.match(/src="\.\/js\/(app\.v\d+\.\d+\.\d+\.js)"/)?.[1];
 if(!active)throw Error('No se identifica la aplicación activa');
 const applications=files.filter(p=>/^js\/app\.v\d+\.\d+\.\d+\.js$/.test(p));
 const markers=files.filter(p=>/^js\/core\/version\.v\d+\.\d+\.\d+\.js$/.test(p));
 const historicalTests=files.filter(p=>/^test\/(?:incremental-|release-).*\.test\.(?:js|cjs)$/.test(p)||p==='test/v3-architecture.test.js');
 const versions=applications.concat(markers),excluded=new Set(versions);
 const number=p=>p.match(/\.v(\d+)\.(\d+)\.(\d+)\.js$/).slice(1).map(Number);
 const compare=(a,b)=>{const x=number(a),y=number(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
 const retainedReleases=applications.filter(p=>compare(p,active)<=0).sort((a,b)=>compare(b,a)).slice(0,3);
 const keep=new Set(retainedReleases.concat(retainedReleases.map(p=>p.replace('js/app.','js/core/version.')))),releaseKeep=new Set(keep);
 const references=new Map();
 for(const p of files){
  if(excluded.has(p)||/^(?:docs|security)\//.test(p)||! /\.(?:[cm]?js|ps1|html|json|ya?ml)$/.test(p))continue;
  const text=fs.readFileSync(path.join(root,p),'utf8');
  for(const match of text.matchAll(/(?:app|version)\.v\d+\.\d+\.\d+\.js/g)){
   if(!references.has(match[0]))references.set(match[0],new Set());references.get(match[0]).add(p);
  }
 }
 // Conservar el par aplicación/marcador cuando cualquiera tenga un consumidor,
 // incluso si una prueba construye el segundo nombre en forma dinámica.
 for(const p of versions)if(references.has(path.basename(p))){keep.add(p);keep.add(p.startsWith('js/app.')?p.replace('js/app.','js/core/version.'):p.replace('js/core/version.','js/app.'));}
 const removableVersions=versions.filter(p=>compare(p,active)<0&&!keep.has(p)&&!references.has(path.basename(p)));
 // También las pruebas históricas conservan sus dependencias: esta limpieza
 // solo retira versiones huérfanas; nunca reduce la cobertura de pruebas.
 const remove=removableVersions;
 for(const p of remove){const target=path.resolve(root,p),relative=path.relative(root,target);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Ruta de limpieza fuera del checkout');}
 return {base:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),active:'js/'+active,retainedReleases,remove,bytes:remove.reduce((n,p)=>n+fs.statSync(path.join(root,p)).size,0),historicalTestsPreserved:historicalTests.length,retainedForReferences:versions.filter(p=>!remove.includes(p)&&!releaseKeep.has(p)).map(p=>{const partner=p.startsWith('js/app.')?p.replace('js/app.','js/core/version.'):p.replace('js/core/version.','js/app.');return {path:p,requiredBy:[...(references.get(path.basename(p))||references.get(path.basename(partner))||[])]};})};
}
if(require.main===module){const result=plan();console.log(JSON.stringify(process.argv.includes('--json')?result:{base:result.base,active:result.active,retainedReleases:result.retainedReleases,removableFiles:result.remove.length,bytes:result.bytes,historicalTestsPreserved:result.historicalTestsPreserved,retainedForReferences:result.retainedForReferences.length},null,2));}
module.exports={plan};
