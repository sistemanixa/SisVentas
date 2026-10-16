'use strict';
const {createCommercialOwnership}=require('../../cotizador/commercial-ownership');
const {memoryDB}=require('./private-finance-fixtures.cjs');
function fixture(){const identities={admin:{rol:'admin',activo:true},a:{rol:'vendedor',activo:true},b:{rol:'administrativo',activo:true},tech:{rol:'tecnico',activo:true}};
 const users=Object.fromEntries(Object.entries(identities).map(([uid,i])=>[uid,{uid,nombre:'Persona '+uid,rol:i.rol,activo:true}]));
 const permissions=Object.fromEntries(['admin','vendedor','administrativo','tecnico'].map(r=>[r,{indiceVersion:2,indiceModulos:{venta:r!=='tecnico',detalle:r!=='tecnico',presupuesto:r!=='tecnico',cobranzas:r!=='tecnico'},acciones:{ventas:{verTodas:true}}}]));
 const sales={one:{id:'V-FICTICIA',creadaPor:'Persona a',total:100,fecha:'2026-10-01',ts:123,empleado:'Comisionado distinto'},converted:{id:'V-FICTICIA-2',presupuestoFbKey:'budget',usuario:'Persona b',total:200},other:{usuario:'Persona b',total:300},ambiguous:{usuario:'Desconocido',total:1}};
 const db=memoryDB({sv_usuarios:users,sv_chat_roles:identities,sv_permisos:permissions,sisventas:{ventas:sales,presupuestos:{budget:{creadoPor:'Persona a',empleadoUid:'a',fecha:'2026-09-01',total:200,audit:[{accion:'Creado dentro del límite',usuario:'Persona a'}]}}}});
 const api=createCommercialOwnership({db,auth:{verifyIdToken:async uid=>({uid})},enabled:true,now:()=>1000});
 const auth=(uid,domain='ventas',view)=>api.authorize({headers:{authorization:'Bearer '+uid}},domain,view);return {db,api,auth};
}

module.exports={fixture};
