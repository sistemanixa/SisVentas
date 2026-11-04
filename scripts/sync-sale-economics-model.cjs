'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
for(const name of ['commercial-money.v1.js','sale-economics-model.v1.js'])fs.copyFileSync(path.join(root,'js/core',name),path.join(root,'cotizador/commercial-models',name));
