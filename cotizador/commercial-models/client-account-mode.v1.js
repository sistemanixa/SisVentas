(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVClientAccountMode=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
const WRITER='coordinated-v1';
function classify(config,{installed=false}={}){
 if(config==null)return Object.freeze({state:installed?'paused':'legacy',coordinated:installed,ready:false});
 if(typeof config!=='object'||Array.isArray(config)||typeof config.ready!=='boolean'||config.writerMode!==undefined&&config.writerMode!==WRITER)throw Error('Esta versión no puede abrir las cuentas. Actualizá SisVentas.');
 const coordinated=config.ready||config.writerMode===WRITER||installed;
 if(coordinated&&(config.schema!==1||typeof config.generation!=='string'||!config.generation||config.generation.length>160))throw Error('Esta versión no puede abrir las cuentas. Actualizá SisVentas.');
 return Object.freeze({state:config.ready?'active':coordinated?'paused':'legacy',coordinated,ready:config.ready,generation:config.generation});
}
return Object.freeze({WRITER,classify});
});
