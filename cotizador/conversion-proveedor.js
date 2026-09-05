'use strict';
function dolarSistema(config) {
  const tipo=config?.dolarConversion || 'oficial';
  const valor=parseFloat(config?.[tipo]) || parseFloat(config?.oficial) || parseFloat(config?.blue) || parseFloat(config?.mep) || 0;
  if(!(valor>0) || !Number.isFinite(valor)) throw new Error('Configurá el dólar de referencia en la sección Dólar de SisVentas');
  return valor;
}
function validarGuarani(datos) {
  if(datos?.base!=='USD'||datos?.quote!=='PYG'||!Number.isFinite(datos.rate)||datos.rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(datos.date)) throw new Error('La fuente no devolvió una cotización USD/PYG válida');
  const fecha=Date.parse(datos.date+'T00:00:00Z');
  if(!Number.isFinite(fecha)||fecha>Date.now()+86400000||Date.now()-fecha>7*86400000) throw new Error('La cotización del guaraní está fuera de vigencia');
  return {pygPorUsd:datos.rate,fecha:datos.date,fuente:'BCP vía Frankfurter',consultadoEn:Date.now()};
}
function convertirPrecioProveedor(resultado, config) {
  if (!resultado || !resultado.requiereConversion) return resultado;
  if (!config || config.habilitado !== true) throw new Error('Habilitá Compras en Paraguay en Configuración');
  const usd=Number(config.arsPorUsd), pyg=Number(config.pygPorUsd), original=Number(resultado.precioOriginal);
  if (!(usd>0) || !Number.isFinite(usd)) throw new Error('Configurá cuántos pesos cuesta un dólar en Compras en Paraguay');
  if (!(original>0) || !Number.isFinite(original)) throw new Error('Precio original inválido');
  if (!['USD','PYG'].includes(resultado.moneda)) throw new Error('Moneda de conversión no admitida');
  if (resultado.moneda==='PYG' && (!(pyg>0) || !Number.isFinite(pyg))) throw new Error('Configurá cuántos guaraníes equivalen a un dólar');
  const factor=resultado.moneda==='USD'?usd:usd/pyg;
  return {...resultado,monedaOriginal:resultado.moneda,moneda:'ARS',precioArs:Math.round(original*factor*100)/100,requiereConversion:false,sinIva:false,ivaOrigen:'incluido_por_defecto',conversion:{arsPorUsd:usd,...(resultado.moneda==='PYG'?{pygPorUsd:pyg}:{}),factor,configuradaEn:config.actualizadoEn||0,calculadaEn:Date.now()}};
}
module.exports={convertirPrecioProveedor,dolarSistema,validarGuarani};
