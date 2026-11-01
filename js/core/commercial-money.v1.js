(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SVCommercialMoney = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';

  function decimal(value) {
    const source = String(value);
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(source);
    if (!match) throw Error('Importe decimal inválido.');
    const exponent = Number(match[4] || 0);
    if (Math.abs(exponent) > 24 || source.length > 80) throw Error('Importe fuera de rango.');
    const numerator = BigInt(match[2] + (match[3] || '')) * (match[1] ? -1n : 1n);
    const scale = (match[3] || '').length - exponent;
    return scale < 0 ? { n: numerator * 10n ** BigInt(-scale), d: 1n }
      : { n: numerator, d: 10n ** BigInt(scale) };
  }
  function simplify(value) {
    let left = value.n < 0n ? -value.n : value.n, right = value.d;
    while (right) { const remainder = left % right; left = right; right = remainder; }
    return left ? { n: value.n / left, d: value.d / left } : { n: 0n, d: 1n };
  }
  const multiply = (a, b) => simplify({ n: a.n * b.n, d: a.d * b.d });
  const add = (a, b) => simplify({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
  const divide = (a, b) => {
    if (b.n === 0n) throw Error('No se puede dividir por cero.');
    const sign = b.n < 0n ? -1n : 1n;
    return simplify({ n: a.n * b.d * sign, d: a.d * b.n * sign });
  };
  const numeric = value => Number(value.n) / Number(value.d);
  function cents(value) {
    const negative = value.n < 0n;
    const absolute = negative ? -value.n : value.n;
    const scaled = absolute * 100n;
    const closed = (scaled * 2n + value.d) / (value.d * 2n);
    const signed = negative ? -closed : closed;
    if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) throw Error('Importe fuera de rango.');
    return Number(signed);
  }
  function isAmount(value) {
    try { const v=decimal(value); return v.n*100n%v.d===0n && Number.isSafeInteger(Number(v.n*100n/v.d)); } catch (_) { return false; }
  }
  const amount = value => cents(decimal(value)) / 100;
  const sum = values => cents(values.map(decimal).reduce(add, { n: 0n, d: 1n })) / 100;
  const product = (...values) => cents(values.map(decimal).reduce(multiply, { n: 1n, d: 1n })) / 100;
  const rawProduct = (...values) => numeric(values.map(decimal).reduce(multiply, { n: 1n, d: 1n }));
  const quantitySum = values => numeric(values.map(decimal).reduce(add, { n: 0n, d: 1n }));
  const quotient = (value, denominator) => cents(divide(decimal(value), decimal(denominator))) / 100;
  const percentage = (value, percent) => cents(divide(multiply(decimal(value), decimal(percent)), decimal(100))) / 100;

  function ratio(numerators,denominators) { return cents(denominators.map(decimal).reduce(divide,numerators.map(decimal).reduce(multiply,{n:1n,d:1n})))/100; }
  function line(quantity, price, percent = 0) {
    const discount = decimal(percent);
    if (discount.n < 0n || discount.n > 100n * discount.d) throw Error('Descuento inválido.');
    return cents(multiply(multiply(decimal(quantity), decimal(price)), {
      n: 100n * discount.d - discount.n, d: 100n * discount.d
    }));
  }
  function discount(centsValue, percent = 0) {
    const rate = decimal(percent);
    if (!Number.isSafeInteger(centsValue) || rate.n < 0n || rate.n > 100n * rate.d) throw Error('Subtotal inválido.');
    return cents({ n: BigInt(centsValue) * (100n * rate.d - rate.n), d: 10000n * rate.d });
  }
  function vat(centsValue) {
    if (!Number.isSafeInteger(centsValue)) throw Error('Subtotal inválido.');
    return cents({ n: BigInt(centsValue) * 21n, d: 10000n });
  }
  function allocate(total, weights) {
    const totalCents = cents(decimal(total));
    const sign = totalCents < 0 ? -1 : 1;
    const absolute = BigInt(Math.abs(totalCents));
    const values = weights.map(decimal);
    if (values.some(value => value.n < 0n)) throw Error('Proporción inválida.');
    const sumWeights = values.reduce(add, { n: 0n, d: 1n });
    if (sumWeights.n === 0n) {
      if (absolute !== 0n) throw Error('Faltan proporciones para distribuir el importe.');
      return weights.map(() => 0);
    }
    const portions = values.map((value, index) => {
      const part = divide(multiply({ n: absolute, d: 1n }, value), sumWeights);
      return { index, cents: part.n / part.d, remainder: part.n % part.d, denominator: part.d };
    });
    let remaining = absolute - portions.reduce((sum, value) => sum + value.cents, 0n);
    const priority = portions.slice().sort((a, b) => {
      const difference = b.remainder * a.denominator - a.remainder * b.denominator;
      return difference < 0n ? -1 : difference > 0n ? 1 : a.index - b.index;
    });
    for (const part of priority) { if (remaining === 0n) break; part.cents++; remaining--; }
    return portions.map(value => sign * Number(value.cents) / 100);
  }
  return Object.freeze({ decimal, cents, line, discount, vat, amount, sum, product, rawProduct, quantitySum, quotient, percentage, allocate, isAmount, ratio });
});
