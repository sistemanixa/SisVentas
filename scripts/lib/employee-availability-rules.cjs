'use strict';
function build(input){const rules=structuredClone(input),node=rules?.rules?.sisventas?.vacaciones;if(!node||typeof node!=='object')throw Error('Faltan reglas de vacaciones');const previous=node['.indexOn'];if(previous!==undefined&&typeof previous!=='string'&&!Array.isArray(previous))throw Error('Índices inválidos');node['.indexOn']=[...new Set([...(previous===undefined?[]:Array.isArray(previous)?previous:[previous]),'hasta'])];return rules;}
module.exports={build};
