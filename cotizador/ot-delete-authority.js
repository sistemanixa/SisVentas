'use strict';
// Authentication reads remain fresh during final guard checks and expose no writes.
const {createBusinessAuth}=require('./user-access');
const {createLaborWriteGateway}=require('./labor-write-gateway');
function createOTDeleteAuthority({auth,readServer,guard,store,enabled=false}){
 if(typeof readServer!=='function'||typeof auth?.verifyIdToken!=='function')throw TypeError('Falta verificación de identidad OT.');
 const db=Object.freeze({ref(path){if(typeof path!=='string'||!/^sv_(access_resets|chat_roles)\/[A-Za-z0-9_-]{1,128}$/.test(path))throw Object.assign(Error('Lectura de identidad OT inválida.'),{statusCode:403});return Object.freeze({async get(){const value=structuredClone(await readServer(path));return Object.freeze({val:()=>structuredClone(value)});}});}});
 const business=createBusinessAuth(auth,db),{authorize}=createLaborWriteGateway({auth:business,db,guard,store,enabled});
 return Object.freeze({authorize});
}
module.exports={createOTDeleteAuthority};
