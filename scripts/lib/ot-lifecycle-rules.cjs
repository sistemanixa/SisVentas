'use strict';
// Candidate generator only; no remote reads or writes. Call against reviewed rules.
const {fence,userActor}=require('../../cotizador/labor-fence-policy');
const closed=v=>v===undefined||v===false||v==='false';
function build(input){
 const out=structuredClone(input),r=out?.rules,s=r?.sisventas;
 if(!r||!s||!closed(r['.write'])||!closed(s['.write']))throw Error('Una concesión padre requiere revisión.');
 if(!s.ventas||!s.ordenes_trabajo||!r.sv_labor_config)throw Error('Faltan las reglas explícitas del circuito.');
 const wildcard=Object.keys(s.ventas).filter(k=>k.startsWith('$'));if(wildcard.length!==1)throw Error('No se identificó la regla de venta.');const key=wildcard[0],row=s.ventas[key];
 const profile="root.child('sv_chat_roles').child(auth.uid)",cfg="root.child('sv_permisos').child(auth.token.svOTLifecycleRole)",ot="root.child('sisventas/ordenes_trabajo').child(auth.token.svOTLifecycleOTKey)";
 const capability="auth.token.svOTLifecycleVersion === 1 && root.child('sv_labor_config/otLifecycleVersion').val() === 1 && "+key+" === auth.token.svOTLifecycleSaleKey && "+ot+".child('ventaFbKey').val() === "+key+" && (data.parent().child('otId').val() === auth.token.svOTLifecycleOTKey || (root.child('sisventas/ordenes_trabajo').child(data.parent().child('otId').val()).child('ventaFbKey').val() === "+key+" && root.child('sisventas/ordenes_trabajo').child(data.parent().child('otId').val()).child('ventaId').val() === data.parent().child('id').val() && root.child('sisventas/listados_resumen/ordenes_trabajo').child(auth.token.svOTLifecycleOTKey).child('ventaFbKey').val() === "+key+")) && "+profile+".child('activo').val() === true && "+profile+".child('rol').val() === auth.token.svOTLifecycleRole && "+cfg+".child('indiceRevision').val() === auth.token.svOTLifecyclePermissionRevision && "+cfg+".child('indiceVersion').val() === 2 && "+cfg+".child('indiceModulos/ordentrabajo').val() === true && auth.token.svPasswordChangeRequired !== true && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && (!root.child('sv_access_resets').child(auth.uid).child('version').exists() || auth.token.svAccessVersion === root.child('sv_access_resets').child(auth.uid).child('version').val())";
 const permission="(auth.token.svOTLifecycleKind === 'close' || (auth.token.svOTLifecycleKind === 'return' && ("+cfg+".child('acciones/ot/entregarMateriales').val() === true || (!"+cfg+".child('acciones/ot/entregarMateriales').exists() && (auth.token.svOTLifecycleRole === 'admin' || auth.token.svOTLifecycleRole === 'administrativo')))) || (auth.token.svOTLifecycleKind === 'custody' && ("+cfg+".child('acciones/ot/rendirMateriales').val() === true || (!"+cfg+".child('acciones/ot/rendirMateriales').exists() && (auth.token.svOTLifecycleRole === 'admin' || auth.token.svOTLifecycleRole === 'administrativo' || auth.token.svOTLifecycleRole === 'tecnico' || auth.token.svOTLifecycleRole === 'tecnico_vendedor')))))";
 const allowedPermission='('+permission+") || (auth.token.svOTLifecycleKind === 'stockrepair' && ("+cfg+".child('acciones/ot/ajustarStockOficina').val() === true || (!"+cfg+".child('acciones/ot/ajustarStockOficina').exists() && auth.token.svOTLifecycleRole === 'admin')))";
 for(const field of ['estadoInst','audit']){
  row[field]||={};const existing=row[field]['.write'];if(existing!==undefined&&typeof existing!=='string'&&typeof existing!=='boolean')throw Error('Regla de venta no reconocida.');
  const final=field==='estadoInst'?"newData.isString() && (newData.val() === 'instalado' || newData.val() === 'en_instalacion')":"newData.exists()";
  row[field]['.write']='('+String(existing??false)+') || ('+fence(4,userActor)+' && '+capability+' && ('+allowedPermission+') && '+final+')';
 }
 r.sv_labor_config.otLifecycleVersion={'.validate':'newData.val() === 1'};
 for(const [domain,field]of [['empleados','nombre'],['productos','codigo']])if(s[domain]){const old=s[domain]['.indexOn']||[];if(!Array.isArray(old)&&typeof old!=='string')throw Error('Índice no reconocido.');s[domain]['.indexOn']=[...new Set([...(Array.isArray(old)?old:[old]),field])];}
 return out;
}
module.exports={build};
