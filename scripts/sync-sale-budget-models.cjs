'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),target=path.join(root,'cotizador/commercial-models');
fs.mkdirSync(target,{recursive:true});
for(const name of ['commercial-money.v1.js','sale-budget-transition.v1.js','purchase-receipt-costs.v1.js'])fs.copyFileSync(path.join(root,'js/core',name),path.join(target,name));
