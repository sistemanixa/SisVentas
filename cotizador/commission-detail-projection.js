'use strict';
// Read-only transport projection: keep original economic fields, omit documents
// that the commission detail never renders. Never use this DTO as a write source.
const omitted=new Set(['audit','historial','observaciones','notas','firmaCliente','firmaClienteUrl','firmas','comprobantes','adjuntos','archivos','fotos','imagenes','imagenUrl','imagenUrlOriginal','productoImagenUrl','fotoUrl','archivoUrl','adjuntoUrl','comprobanteUrl']);
function project(value){
 if(Array.isArray(value))return value.map(project);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!omitted.has(key)).map(([key,item])=>[key,project(item)]));
}
module.exports={project};
