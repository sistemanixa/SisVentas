(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVCommercialFormData=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const pages=Object.freeze({
  venta:Object.freeze(['clientes','productos','ventas','empleados']),
  presupuesto:Object.freeze(['clientes','productos','presupuestos','empleados'])
 });
 function requirements(page){return pages[page]?pages[page].slice():null;}
 function loaders(page,available){const keys=requirements(page);if(!keys)return null;return keys.map(key=>{if(typeof available[key]!=='function')throw Error('No se pudo preparar la carga del formulario.');return available[key];});}
 return Object.freeze({pages,requirements,loaders});
});
