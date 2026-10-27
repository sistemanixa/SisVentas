(function(root,factory){'use strict';const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;if(root)root.SVBonusPaymentModel=model;})(typeof window==='object'?window:null,function(){
 'use strict';
 const fields=['monto','montoPagado','saldoPagadoLegacy','estado','requiereAprobacion','bajaAdministrativa','pagos','empleadoId','empleadoFbKey','legacyKey','movimientoCtaKey','tipoPagable','origen','periodoComputo','bonificacionCantidad','bonificacionValorUnitario','bonificacionGrupoId','bonificacionDestinatarios','bonificacionGrupoTotal','bonificacionGrupoPersonas'];
 const isBonus=row=>!!row&&String(row.tipoPagable||row.origen||'').toLowerCase()==='bonificacion';
 function revisionData(row){return Object.fromEntries(fields.map(key=>[key,row?.[key]??null]));}
 return {isBonus,revisionData};
});
