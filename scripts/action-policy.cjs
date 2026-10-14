'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/modules/action-permissions.js'),'utf8');
const marker='window.SISVENTAS_PERMISOS_ACCION = PERMISOS_ACCION;';
const prefix=source.slice(0,source.indexOf(marker)+marker.length)+'\n})();';
const ctx={window:{}};vm.runInNewContext(prefix,ctx);module.exports=ctx.window.SISVENTAS_PERMISOS_ACCION;
