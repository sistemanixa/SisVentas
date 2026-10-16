'use strict';
// Docker solo copia su contexto. La fuente canónica también se sirve al navegador.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
fs.copyFileSync(path.join(root,'js/core/projects-model.js'),path.join(root,'cotizador/projects-model.js'));
console.log('Modelo de Proyectos sincronizado con Cotizador.');
