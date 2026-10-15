'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/traslado-nube-manifest.json'),'utf8'));
for(const entry of manifest.files){
  const file=path.resolve(root,entry.path);
  if(!file.startsWith(root+path.sep))throw Error('Ruta fuera del checkout');
  const text=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
  const digest=crypto.createHash('sha256').update(text,'utf8').digest('hex');
  if(digest!==entry.sha256Lf||Buffer.byteLength(text,'utf8')!==entry.bytesLf)throw Error('No coincide artefacto: '+entry.path);
}
console.log('OK: '+manifest.files.length+' artefactos coinciden con el manifest (UTF-8, fin de línea LF).');
