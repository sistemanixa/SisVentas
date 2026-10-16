'use strict';
const fs=require('fs'),{rulesProtectPasswords}=require('../cotizador/password-policy');
function build(input){
 if(!rulesProtectPasswords(input))throw Error('La base debe conservar el guard de acceso');
 const out=structuredClone(input);if(out.rules['.read']&&out.rules['.read']!=='false')throw Error('Lectura padre insegura');
 // El servicio utiliza Admin SDK con proyección por lista de campos permitidos.
 // Conservar escrituras/índice/validaciones existentes; cerrar todas las lecturas.
 const users=out.rules.sv_usuarios;if(!users)throw Error('No existe colección protegida');
 function deny(node){for(const [k,v]of Object.entries(node))if(k==='.read')node[k]=false;else if(v&&typeof v==='object')deny(v);}
 deny(users);users['.read']=false;return out;
}
if(require.main===module){const [from,to]=process.argv.slice(2);if(!from||!to||!to.endsWith('.candidate.json'))throw Error('Uso offline: base.json salida.candidate.json');fs.writeFileSync(to,JSON.stringify(build(JSON.parse(fs.readFileSync(from,'utf8'))),null,2)+'\n');}
module.exports={build};
