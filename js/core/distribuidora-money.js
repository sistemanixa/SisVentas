(function(root){
  'use strict';
  // Formato de presentación: no modifica los importes ni su moneda de origen.
  function amount(value,currency='USD'){
    const decimals=currency==='USD'?0:2;
    return Number(value||0).toLocaleString('es-AR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
  }
  function saleAmounts(price,iva,rate){
    const tax=Number(iva==null?21:iva),exchange=Number(rate);
    if(!Number.isFinite(tax)||tax<0)return {ars:0,usd:0};
    const round=n=>Math.round(n*100)/100;
    if(price?.monedaOrigen==='USD'&&Number(price.precioOrigen)>0){
      const usd=round(Number(price.precioOrigen)*(1+tax/100));
      return {usd,ars:exchange>0&&Number.isFinite(exchange)?round(usd*exchange):0};
    }
    const net=Number(price?.precioARS),ars=Number.isFinite(net)&&net>0?round(net*(1+tax/100)):0;
    return {ars,usd:ars>0&&exchange>0&&Number.isFinite(exchange)?round(ars/exchange):0};
  }
  const api={amount,saleAmounts};
  if(typeof module!=='undefined')module.exports=api;
  root.SVDistribuidoraMoney=api;
})(typeof window==='undefined'?{}:window);
