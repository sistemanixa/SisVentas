'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
fs.copyFileSync(path.join(root,'js/core/domain-read-policy.js'),path.join(root,'cotizador/domain-read-policy.js'));
console.log('Política comercial compartida copiada al contexto Docker de Cotizador.');
