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
 for(const k of ['chat','detalle','editar','crear','solicitudes'])r.sv_distribuidora_permisos[k]={'.validate':'newData.isBoolean()'};
 r.sv_distribuidora_permisos['$otro']={'.validate':false};
 const canEdit=dist+' && ('+permission('editar')+' || '+permission('crear')+')';
 r.sv_catalogo_proveedores={'.read':'('+admin+') || ('+canEdit+')','.write':admin};
 r.sisventas.contadores=r.sisventas.contadores||{};
 r.sisventas.contadores.codigoProducto={'.read':dist+' && '+permission('crear'),'.write':dist+' && '+permission('crear')+' && data.isNumber() && newData.isNumber() && newData.val() === data.val() + 1'};
 const category="newData.child('categoria').val() === 'COMPRAS PARAGUAY'";
 const product={'.read':dist+" && data.child('categoria').val() === 'COMPRAS PARAGUAY' && ("+permission('detalle')+' || '+permission('editar')+')',
 '.write':dist+' && newData.exists() && '+category+" && ((!data.exists() && "+permission('crear')+") || (data.child('categoria').val() === 'COMPRAS PARAGUAY' && "+permission('editar')+" && newData.child('codigo').val() === data.child('codigo').val()))",
 '.validate':role+" !== 'distribuidora' || (newData.hasChildren(['nombre','codigo','categoria']) && "+category+" && newData.child('esManoDeObra').val() !== true)"};
 const text=['nombre','marca','descripcion','codigo','categoria','estado','moneda','monedaVenta','monedaCarga','unidad','catalogoDescripcion','proveedor','proveedorFbKey','proveedorUrl','proveedorActualizado','dolarTipo','precioActualizadoOrigen','tcTipoGuardado','tcFecha'];
 const numbers=['iva','stock','stockMin','ventaARS','compraARS','ventaUSD','compraUSD','compra','venta','precioGremio','margenDeseado','metrosPorPresentacion','cantidadPorPresentacion','costoPresentacionArs','precioArsPublicado','costoRealArs','precioUsdReferencia','costoRealUsdReferencia','dolarUsado','precioActualizadoEn','tcGuardado'];
 const bools=['activo','esManoDeObra','catalogoVisible','catalogoDestacado'];
 function validate(k,rule){product[k]={'.validate':role+" !== 'distribuidora' || ("+rule+')'};}
 for(const k of text)validate(k,'newData.isString() && newData.val().length <= '+(['descripcion','catalogoDescripcion'].includes(k)?10000:2000));
 for(const k of numbers)validate(k,'newData.isNumber() && newData.val() >= 0');
 for(const k of bools)validate(k,'newData.isBoolean()');
 for(const k of ['codWeb','urlProveedor','imagenUrl'])validate(k,"newData.isString() && newData.val().length <= 2000000 && (newData.val() === '' || newData.val().beginsWith('https://') || newData.val().beginsWith('http://')"+(k==='imagenUrl'?" || newData.val().beginsWith('data:image/')":"")+")");
 for(const k of ['proveedores','garantiaConfig'])validate(k,'newData.hasChildren()');
 product.$otro={'.validate':role+" !== 'distribuidora'"};r.sisventas.productos.$producto=product;
 r.sv_distribuidora_auditoria={'.read':admin,'$registro':{'.write':dist+" && !data.exists() && newData.child('uid').val() === auth.uid",'.validate':"newData.hasChildren(['uid','producto','accion','fecha','campos'])",uid:{'.validate':'newData.isString()'},producto:{'.validate':'newData.isString()'},accion:{'.validate':"newData.val() === 'crear' || newData.val() === 'editar'"},fecha:{'.validate':'newData.isNumber() && newData.val() <= now + 300000 && newData.val() >= now - 300000'},campos:{'.validate':'newData.isString() && newData.val().length <= 1000'},'$otro':{'.validate':false}}};
 r.sv_chat_presencia=require('./chat-presence-rules.cjs').chatPresenceRules();
 Object.assign(r,require('./public-catalog-rules.cjs').publicCatalogRules());
 Object.assign(r,require('./catalog-request-rules.cjs').catalogRequestRules());
 require('./public-currency-rules.cjs').publicCurrencyRules(r);
 return out;
}
module.exports={permisosDistribuidora};
