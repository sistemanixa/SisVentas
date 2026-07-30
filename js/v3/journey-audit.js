(function (root, factory) {
  var domain = typeof module === 'object' && module.exports
    ? require('./domain-store.js')
    : root.SisVentas.V3.DomainStore;
  var api = factory(domain);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.SisVentas = root.SisVentas || {};
    root.SisVentas.V3 = root.SisVentas.V3 || {};
    root.SisVentas.V3.JourneyAudit = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (domain) {
  'use strict';

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function records(value) {
    return Array.isArray(value) ? value : [];
  }

  function first(record, fields) {
    var index;
    for (index = 0; index < fields.length; index += 1) {
      if (text(record && record[fields[index]])) return text(record[fields[index]]);
    }
    return '';
  }

  function sameTechnical(left, right) {
    return !!left && !!right && text(left.fbKey) === text(right.fbKey);
  }

  function relationIssue(kind, moduleName, stage, source, resolution, expectedKey, actualKey) {
    return Object.freeze({
      kind: kind,
      module: moduleName,
      stage: stage,
      sourceFbKey: text(source && source.fbKey),
      sourceBusinessId: text(source && (source.id || source.numero || source.nro || source.codigo)),
      matchedBy: text(resolution && resolution.matchedBy),
      reference: text(resolution && resolution.key),
      expectedKey: text(expectedKey),
      actualKey: text(actualKey)
    });
  }

  function budgetSaleReference(budget) {
    var technical = first(budget, ['ventaGeneradaFbKey', 'ventaFbKey', 'ventaKey']);
    var business = first(budget, ['ventaGeneradaId', 'ventaId', 'idVenta', 'venta']);
    if (!technical && !business) return null;
    return {
      ventaFbKey: technical,
      ventaId: business
    };
  }

  function hasBudgetReference(sale) {
    return !!first(sale, [
      'presupuestoFbKey', 'presupuestoKey', 'presupuestoId', 'idPresupuesto',
      'presupuesto', 'nroPresupuesto', 'numeroPresupuesto'
    ]);
  }

  function hasSaleReference(record) {
    return !!first(record, [
      'ventaFbKey', 'ventaKey', 'ventaId', 'idVenta', 'venta', 'nroVenta', 'numeroVenta'
    ]);
  }

  function auditBudgetToSale(store, budgets, issues) {
    records(budgets).forEach(function (budget) {
      var reference = budgetSaleReference(budget);
      if (!reference) return;
      var saleResolution = store.resolveSale(reference);
      if (saleResolution.status !== 'found') {
        issues.push(relationIssue(
          saleResolution.status === 'ambiguous' ? 'ambiguous-relation' : 'missing-relation',
          'presupuestos',
          'presupuesto-venta',
          budget,
          saleResolution
        ));
        return;
      }
      var sale = saleResolution.value;
      if (!hasBudgetReference(sale)) return;
      var budgetResolution = store.resolveBudget(sale);
      if (budgetResolution.status !== 'found' || !sameTechnical(budget, budgetResolution.value)) {
        issues.push(relationIssue(
          'crossed-relation',
          'presupuestos',
          'presupuesto-venta-presupuesto',
          budget,
          budgetResolution,
          budget.fbKey,
          budgetResolution.value && budgetResolution.value.fbKey
        ));
      }
    });
  }

  function auditSaleToBudget(store, sales, issues) {
    records(sales).forEach(function (sale) {
      if (!hasBudgetReference(sale)) return;
      var budgetResolution = store.resolveBudget(sale);
      if (budgetResolution.status !== 'found') {
        issues.push(relationIssue(
          budgetResolution.status === 'ambiguous' ? 'ambiguous-relation' : 'missing-relation',
          'presupuestos',
          'venta-presupuesto',
          sale,
          budgetResolution
        ));
        return;
      }
      var budgetReference = budgetSaleReference(budgetResolution.value);
      if (!budgetReference) return;
      var saleResolution = store.resolveSale(budgetReference);
      if (saleResolution.status !== 'found' || !sameTechnical(sale, saleResolution.value)) {
        issues.push(relationIssue(
          'crossed-relation',
          'presupuestos',
          'venta-presupuesto-venta',
          sale,
          saleResolution,
          sale.fbKey,
          saleResolution.value && saleResolution.value.fbKey
        ));
      }
    });
  }

  function auditPayments(store, payments, issues) {
    records(payments).forEach(function (payment) {
      if (!hasSaleReference(payment)) {
        issues.push(relationIssue('missing-reference', 'ventasPagos', 'pago-venta', payment));
        return;
      }
      var resolution = store.resolveSale(payment);
      if (resolution.status !== 'found') {
        issues.push(relationIssue(
          resolution.status === 'ambiguous' ? 'ambiguous-relation' : 'missing-relation',
          'ventasPagos',
          'pago-venta',
          payment,
          resolution
        ));
        return;
      }
      var paymentClient = first(payment, ['clienteFbKey', 'clienteKey']);
      var saleClient = first(resolution.value, ['clienteFbKey', 'clienteKey']);
      if (paymentClient && saleClient && paymentClient !== saleClient) {
        issues.push(relationIssue(
          'crossed-client',
          'ventasPagos',
          'pago-venta-cliente',
          payment,
          resolution,
          saleClient,
          paymentClient
        ));
      }
    });
  }

  function auditWorkOrders(store, workOrders, issues) {
    records(workOrders).forEach(function (workOrder) {
      if (!hasSaleReference(workOrder)) return;
      var resolution = store.resolveSale(workOrder);
      if (resolution.status !== 'found') {
        issues.push(relationIssue(
          resolution.status === 'ambiguous' ? 'ambiguous-relation' : 'missing-relation',
          'ordenesTrabajo',
          'ot-venta',
          workOrder,
          resolution
        ));
        return;
      }
      var workOrderClient = first(workOrder, ['clienteFbKey', 'clienteKey']);
      var saleClient = first(resolution.value, ['clienteFbKey', 'clienteKey']);
      if (workOrderClient && saleClient && workOrderClient !== saleClient) {
        issues.push(relationIssue(
          'crossed-client',
          'ordenesTrabajo',
          'ot-venta-cliente',
          workOrder,
          resolution,
          saleClient,
          workOrderClient
        ));
      }
    });
  }

  function run(data) {
    data = data || {};
    var store = new domain.DomainStore(data);
    var issues = [];
    auditBudgetToSale(store, data.presupuestos, issues);
    auditSaleToBudget(store, data.ventas, issues);
    auditPayments(store, data.pagos, issues);
    auditWorkOrders(store, data.ordenesTrabajo, issues);

    function ready(moduleName) {
      return !issues.some(function (entry) { return entry.module === moduleName; });
    }

    return Object.freeze({
      ready: issues.length === 0,
      gates: Object.freeze({
        presupuestos: ready('presupuestos'),
        ventasPagos: ready('ventasPagos'),
        ordenesTrabajo: ready('ordenesTrabajo')
      }),
      counts: Object.freeze({
        presupuestos: records(data.presupuestos).length,
        ventas: records(data.ventas).length,
        pagos: records(data.pagos).length,
        ordenesTrabajo: records(data.ordenesTrabajo).length
      }),
      issues: Object.freeze(issues.slice())
    });
  }

  return {
    run: run,
    budgetSaleReference: budgetSaleReference,
    hasBudgetReference: hasBudgetReference,
    hasSaleReference: hasSaleReference
  };
});
