(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.SVBudgetConversionCosts = factory(root);
})(typeof window === 'object' ? window : null, function (root) {
  'use strict';
  function prepare(record) {
    const costs = root.SVSaleCosts;
    if (!costs || !record.items || typeof record.items !== 'object') throw new Error('No se pudieron preparar los costos de la venta.');
    const convert = item => {
      if (item.comisionCostoHistoricoPendiente !== true && costs.unit(item) !== null) return costs.capture(item);
      const product = root.obtenerProductoPorCodigoVenta(item.cod || item.codigo, item);
      if (!product) throw new Error('No se encontró el producto ' + (item.cod || item.codigo || item.desc || '') + ' para tomar su costo actual.');
      const clean = { ...item };
      for (const field of ['costoUnitarioCompra', 'costoTotalCompra', 'costoUnitario', 'costoCompra', 'compra', 'precioCompra', 'precio_compra', 'costoTotal', 'costo', 'costoUnitarioPresupuestado', 'costoUnitarioAntesPreparacion', 'comisionCostoHistoricoPendiente', 'costoCapturadoEn', 'costoOrigen', 'costoVersion']) delete clean[field];
      delete clean.costoUnitarioUSD;
      // Resolve from the current product, never from a stale quote exchange rate or reference cost.
      const value = root.precioGremioARSDesdeProducto(product);
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Revisá el costo actual de ' + (item.cod || item.codigo || item.desc || 'este producto') + '.');
      clean.costoUnitarioCompra = value;
      clean.costoOrigen = 'catalogo_al_convertir';
      clean.costoCapturadoEn = Date.now();
      return costs.capture(clean);
    };
    return { ...record, items: Array.isArray(record.items) ? record.items.map(convert) : Object.fromEntries(Object.entries(record.items).map(([key, item]) => [key, convert(item)])) };
  }
  return Object.freeze({ prepare });
});
