'use strict';
// Identity checks must read current authorization metadata, not the business
// transaction's staging scope, which is deliberately closed during commit.
const Access=require('./user-access');
const Gateway=require('./labor-write-gateway');
function create({auth,db,enabled=false}={}){
 if(typeof auth?.verifyIdToken!=='function'||typeof db?.ref!=='function'||typeof enabled!=='boolean')throw TypeError('Falta la verificación de identidad.');
 const metadata=Object.freeze({ref(path){
  if(typeof path!=='string'||!/^sv_(?:access_resets|chat_roles|permisos)\/[^/.#$\[\]\x00-\x1f\x7f]{1,128}$/.test(path))throw Object.assign(Error('La autorización sólo consulta metadatos de acceso.'),{statusCode:403});
  return Object.freeze({async get(){const snapshot=await db.ref(path).get();return Object.freeze({val:()=>structuredClone(snapshot.val())});}});
 }});
 return Gateway.createLaborWriteGateway({auth:Access.createBusinessAuth(auth,metadata),db:metadata,enabled}).authorize;
}
module.exports={create};
