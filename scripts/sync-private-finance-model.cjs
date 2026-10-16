'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
fs.copyFileSync(path.join(root,'cotizador/private-finance-model.js'),path.join(root,'js/core/private-finance-model.js'));
console.log('Modelo puro de Gastos personales sincronizado; sin datos ni red.');
