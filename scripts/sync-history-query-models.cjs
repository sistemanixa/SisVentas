'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
for(const name of ['client-history-audience.v1.js','domain-read-policy.js','ot-personal-scope.js'])fs.copyFileSync(path.join(root,'js/core',name),path.join(root,'cotizador/commercial-models',name));
