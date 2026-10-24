(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SVCommissionPresentation=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  // Presentation only. No financial values, payments, percentages or historic
  // descriptions are changed. Consumers use textContent or their HTML escape.
  var TYPES=new Set(['comision','bonificacion','sueldo','aguinaldo','hextra','hs_extra','horas_extra','adelanto','cargo','transporte','materiales','gasto_empresa','otro']);
  var GENERIC=new Set(['variable','fijo','compra','gasto']);
  var IDS=['ventaId','numeroVenta','ventaNumero','saleId'];
  var CLIENTS=['cliente','clienteNombre','nombreCliente','clientName'];
  var DESCRIPTIONS=['descripcion','desc','detalle'];
  function ownText(record,key){
    if(!record||typeof record!=='object'||Array.isArray(record))return '';
    try{var descriptor=Object.getOwnPropertyDescriptor(record,key);return descriptor&&typeof descriptor.value==='string'?descriptor.value.trim():'';}
    catch(_){return '';}
  }
  function type(value){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[ \t]+/g,'_');}
  function legacyDescription(record){
    for(var key of DESCRIPTIONS){var value=ownText(record,key);if(value)return value;}
    return '';
  }
  function isCommission(record){
    var payable=type(ownText(record,'tipoPagable'));if(payable)return payable==='comision';
    var explicit=type(ownText(record,'tipo'));if(TYPES.has(explicit))return explicit==='comision';
    var origin=type(ownText(record,'origen'));if(origin)return origin==='comision';
    // Generic Gastos categories are not CTA discriminants. A strict historical
    // sale-code prefix may identify those records, never an arbitrary mention.
    if(explicit)return GENERIC.has(explicit)&&!!strictLegacySaleId(record);
    return /^Comisi[oó]n(?:$|[ \t·:|—–])/i.test(legacyDescription(record));
  }
  function id(value){
    if(value.startsWith('#'))value=value.slice(1);
    return value.length<=64&&/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/.test(value)?value:'';
  }
  function strictLegacySaleId(record){
    // Only the strict historical sale-code prefix is read. Never reuse the
    // remaining description, infer a client, or infer any financial value.
    var match=/^Comisi[oó]n venta #?([A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*)(?=$|[ \t]*(?:[·|—–]|\r?\n))/i.exec(legacyDescription(record));
    return match?id(match[1]):'';
  }
  function saleId(record){
    for(var key of IDS){var value=ownText(record,key);if(value){var valid=id(value);if(valid)return valid;}}
    return isCommission(record)?strictLegacySaleId(record):'';
  }
  function clientName(record){
    for(var key of CLIENTS){
      var value=ownText(record,key);
      if(value&&value.length<=240&&!/[\x00-\x1f\x7f<>\u202a-\u202e\u2066-\u2069]/.test(value))return value.replace(/ {2,}/g,' ');
    }
    return '';
  }
  function caption(record){
    var sale=saleId(record);if(!sale)return 'Comisión';
    var client=clientName(record);
    return 'Comisión · Venta #'+sale+(client?' · '+client:'');
  }
  return Object.freeze({isCommission:isCommission,caption:caption,saleId:saleId,clientName:clientName});
});
