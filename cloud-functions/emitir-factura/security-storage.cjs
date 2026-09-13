'use strict';
// Activar junto con la migración de usuarios y el frontend, no antes.
exports.usersPath=function(){return process.env.SV_SECURITY_STORAGE_V2==='true'?'sv_usuarios':'sisventas/usuarios';};
