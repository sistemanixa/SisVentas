'use strict';
function permisosDistribuidora(base){
 const out=structuredClone(base),r=out.rules;
 const role="root.child('sv_chat_roles').child(auth.uid).child('rol').val()";
 const active="auth != null && root.child('sv_chat_roles').child(auth.uid).child('activo').val() === true";
 const dist=active+" && "+role+" === 'distribuidora'",admin=active+" && "+role+" === 'admin'";
 const permission=k=>"root.child('sv_distribuidora_permisos').child('"+k+"').val() === true";
 const chat="("+role+" !== 'distribuidora' || root.child('sv_distribuidora_permisos/chat').val() !== false)";
 for(const name of ['sv_chat','sv_chat_escribiendo'])for(const op of ['.read','.write'])r[name].$canal[op]='('+r[name].$canal[op]+') && '+chat;
 r.sv_chat_directorio['.read']='('+r.sv_chat_directorio['.read']+') && '+chat;
 r.sv_distribuidora_permisos={'.read':'('+admin+') || ('+dist+')','.write':admin};
 for(const k of ['chat','detalle','editar','crear'])r.sv_distribuidora_permisos[k]={'.validate':'newData.isBoolean()'};
 r.sv_distribuidora_permisos['$otro']={'.validate':false};
 const product={'.write':dist+' && '+permission('crear')+" && !data.exists() && newData.child('categoria').val() === 'COMPRAS PARAGUAY'",
 '.validate':role+" !== 'distribuidora' || (newData.hasChildren(['nombre','codigo','categoria']) && newData.child('categoria').val() === 'COMPRAS PARAGUAY')"};
 const types={nombre:'string',marca:'string',descripcion:'string',codWeb:'url',imagenUrl:'url',codigo:'string',categoria:'category',activo:'bool',estado:'string',moneda:'currency',iva:'number',ventaARS:'number'};
 for(const [k,type] of Object.entries(types)){
  let valid=type==='number'?'newData.isNumber() && newData.val() >= 0':type==='bool'?'newData.isBoolean()':type==='category'?"newData.val() === 'COMPRAS PARAGUAY'":type==='currency'?"newData.val() === 'ARS'":'newData.isString() && newData.val().length <= '+(k==='descripcion'?10000:2000);
  if(type==='url')valid+=" && (newData.val() === '' || newData.val().beginsWith('https://') || newData.val().beginsWith('http://'))";
  product[k]={'.validate':role+" !== 'distribuidora' || ("+valid+')'};
  if(['nombre','marca','descripcion','codWeb','imagenUrl'].includes(k))product[k]['.write']=dist+' && '+permission('editar')+" && data.parent().child('categoria').val() === 'COMPRAS PARAGUAY' && data.parent().child('activo').val() !== false && data.parent().child('estado').val() !== 'Inactivo' && data.parent().child('esManoDeObra').val() !== true && newData.exists()";
 }
 product.$otro={'.validate':role+" !== 'distribuidora'"};r.sisventas.productos.$producto=product;
 r.sv_distribuidora_auditoria={'.read':admin,'$registro':{'.write':dist+" && !data.exists() && newData.child('uid').val() === auth.uid",'.validate':"newData.hasChildren(['uid','producto','accion','fecha','campos'])",uid:{'.validate':'newData.isString()'},producto:{'.validate':'newData.isString()'},accion:{'.validate':"newData.val() === 'crear' || newData.val() === 'editar'"},fecha:{'.validate':'newData.isNumber() && newData.val() <= now + 300000 && newData.val() >= now - 300000'},campos:{'.validate':'newData.isString() && newData.val().length <= 1000'},'$otro':{'.validate':false}}};
 return out;
}
module.exports={permisosDistribuidora};
