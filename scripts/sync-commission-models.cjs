'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const target=path.join(root,'cotizador/commercial-models');fs.mkdirSync(target,{recursive:true});
for(const name of ['identity-index','budget-read-model','sales-read-model'])fs.copyFileSync(path.join(root,'js/v3',name+'.js'),path.join(target,name+'.js'));
console.log('Modelos comerciales compartidos copiados al contexto del servidor.');
