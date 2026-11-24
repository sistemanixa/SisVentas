'use strict';

const { digest } = require('./labor-guard');
const { prepareOrderDeletion, inventoryKey } = require('./purchase-order-delete-model');
const Money = require('./commercial-models/commercial-money');

const configPaths = Object.freeze([
  'sv_labor_config',
  'sv_operational_read_config',
  'sv_commercial_pages_config',
  'sv_client_accounts_config',
  'sv_client_history_config'
]);
const reviewFields = ['schema', 'orderKey', 'orderNumber', 'protectedOrderKey', 'protectedOrderNumber',
  'artifactSha256', 'rulesSha256', 'manifestSha256', 'configsSha256', 'reviewSha256', 'attribution'];
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isKey = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) &&
  !['__proto__', 'prototype', 'constructor'].includes(value);
const isOrderNumber = value => typeof value === 'string' && /^OC-[A-Z0-9-]{1,64}$/.test(value);
const exactFields = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const validAttribution = value => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length > 0 && Object.entries(value).every(([key, item]) => isKey(key) &&
    exactFields(item, ['quantity', 'evidenceSha256']) && Number.isFinite(item.quantity) &&
    item.quantity > 0 && isHash(item.evidenceSha256));
const blocked = (message, statusCode = 409) => Object.assign(Error(message), {
  code: 'SV_PURCHASE_DELETE_REVIEW_REQUIRED', statusCode
});

function configDigest(configs) {
  const [labor, , pages, , history] = configs;
  if (configs.length !== configPaths.length || configs.some(config => config?.schema !== 1 || config.ready !== true) ||
      labor.writerSchema !== 2 || ![undefined, false].includes(labor.sdkAdmissionPaused) ||
      pages.nativeCollectionsReady !== true || pages.nativeCollectionsSchema !== 1 || history.writerSchema !== 1 ||
      configs.slice(1).some(config => !isKey(config.generation))) {
    throw blocked('La configuración coordinada de Compras no está lista.', 503);
  }
  return digest(configs);
}

function draftReview({ order, protectedOrder, inventoryByKey, attribution }) {
  if (!isKey(order?.fbKey) || !isOrderNumber(order.numero) || order.estado !== 'borrador' ||
      order.ventaId || order.ventaFbKey || order.listaMaterialesId || order.legacyKey ||
      (order.recepciones != null && (!Array.isArray(order.recepciones) || order.recepciones.length)) ||
      !Array.isArray(order.items) || !order.items.length) {
    throw blocked('La orden no es un borrador independiente sin recepciones.');
  }
  if (!isKey(protectedOrder?.fbKey) || !isOrderNumber(protectedOrder.numero) ||
      protectedOrder.fbKey === order.fbKey || protectedOrder.numero === order.numero ||
      protectedOrder.estado !== 'recibida') {
    throw blocked('Falta comprobar la orden recibida que se debe conservar.');
  }

  const pending = new Map();
  for (const item of order.items) {
    const product = item?.productoKey || item?.codigo;
    const quantity = Number(item?.cantidadOrdenada ?? item?.cantidad);
    if (!product || !Number.isFinite(quantity) || quantity <= 0 || Number(item.cantidadRecibida ?? 0) !== 0) {
      throw blocked('Las unidades pendientes no se pudieron atribuir al borrador.');
    }
    const key = inventoryKey(product);
    pending.set(key, Money.quantitySum([pending.get(key) ?? 0, quantity]));
  }
  if (!validAttribution(attribution) ||
      Object.keys(attribution).length !== pending.size || [...pending].some(([key, quantity]) =>
        !Object.hasOwn(attribution, key) || attribution[key].quantity !== quantity)) {
    throw blocked('Falta la revisión de las cantidades En compra por producto.');
  }

  const result = prepareOrderDeletion({ order, inventoryByKey });
  const orderPath = `sisventas/ordenes/${order.fbKey}`;
  if (result.patch[orderPath] !== null || Object.keys(result.patch).length !== pending.size + 1) {
    throw blocked('El borrado cambiaría registros fuera del alcance revisado.');
  }
  for (const [key, quantity] of pending) {
    const original = inventoryByKey[key];
    const expected = { ...original, enCompra: Money.quantitySum([Number(original.enCompra), -quantity]) };
    if (digest(result.patch[`sisventas/inventario_operativo/${key}`]) !== digest(expected)) {
      throw blocked('El borrado cambiaría el stock físico o las reservas.');
    }
  }

  return { ...result, reviewSha256: digest({ order, protectedOrder, attribution, ...result }) };
}

function validReview(review) {
  return exactFields(review, reviewFields) && review.schema === 1 && isKey(review.orderKey) && isOrderNumber(review.orderNumber) &&
    isKey(review.protectedOrderKey) && isOrderNumber(review.protectedOrderNumber) &&
    review.orderKey !== review.protectedOrderKey && review.orderNumber !== review.protectedOrderNumber &&
    ['artifactSha256', 'rulesSha256', 'manifestSha256', 'configsSha256', 'reviewSha256'].every(key => isHash(review[key])) &&
    validAttribution(review.attribution);
}

function create({ env = process.env, runtime }) {
  let review;
  const source = env.PURCHASE_ORDER_DELETE_REVIEW_JSON;
  if (env.PURCHASE_ORDER_DELETE_READY === 'true' && typeof source === 'string' && source.length <= 16384) {
    try {
      const candidate = JSON.parse(source);
      if (validReview(candidate) && digest(candidate) === env.PURCHASE_ORDER_DELETE_REVIEW_SHA256) review = candidate;
    } catch {
      // An incomplete or malformed deployment configuration leaves the command closed.
    }
  }
  function configured() {
    if (!review) return false;
    const state = runtime();
    return state.coordinated === true && state.readOnly === false && state.commercialPages === true &&
      state.clientAccounts === true && state.clientHistory === true && state.operationalSummaries === true;
  }
  async function assertCurrent(read) {
    if (!configured() || configDigest(await Promise.all(configPaths.map(read))) !== review.configsSha256) {
      throw blocked('La configuración revisada de Compras cambió. El borrado sigue deshabilitado.', 503);
    }
  }
  function assertTarget(orderKey) {
    if (!review || orderKey !== review.orderKey) throw blocked('Esta orden no está incluida en la revisión de borrado.');
  }
  async function plan({ read, order, inventoryByKey }) {
    await assertCurrent(read);
    assertTarget(order.fbKey);
    const other = await read(`sisventas/ordenes/${review.protectedOrderKey}`);
    if (!other || order.numero !== review.orderNumber || other.numero !== review.protectedOrderNumber ||
        (other.fbKey != null && other.fbKey !== review.protectedOrderKey)) {
      throw blocked('Las órdenes no coinciden con la revisión de borrado.');
    }
    const result = draftReview({ order, protectedOrder: { ...other, fbKey: review.protectedOrderKey },
      inventoryByKey, attribution: review.attribution });
    if (result.reviewSha256 !== review.reviewSha256) {
      throw blocked('La orden, el inventario o la orden recibida cambiaron desde la revisión.');
    }
    return result;
  }
  return { configured, assertCurrent, assertTarget, plan };
}

module.exports = { create, configPaths, configDigest, draftReview, validReview };
