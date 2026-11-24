'use strict';

const Cut = require('./commercial-cut-evidence.cjs');
const Review = require('../../cotizador/purchase-order-delete-review');
const { digest } = require('../../cotizador/labor-guard');

// Pure preparation. Input contains the reviewed original snapshots and hashes
// of the private evidence attributing each pending quantity to this order.
function prepare({ cutManifest, configs, order, protectedOrder, inventoryByKey, attribution }) {
  const evidence = Cut.validate(cutManifest);
  const plan = Review.draftReview({ order, protectedOrder, inventoryByKey, attribution });
  const review = {
    schema: 1,
    artifactSha256: cutManifest.candidate.artifactSha256,
    rulesSha256: cutManifest.candidate.rulesSha256,
    manifestSha256: evidence.manifestSha256,
    configsSha256: Review.configDigest(Review.configPaths.map(path => configs[path])),
    orderKey: order.fbKey,
    orderNumber: order.numero,
    protectedOrderKey: protectedOrder.fbKey,
    protectedOrderNumber: protectedOrder.numero,
    attribution: structuredClone(attribution),
    reviewSha256: plan.reviewSha256
  };
  const reviewJson = JSON.stringify(review);
  if (!Review.validReview(review) || reviewJson.length > 16384) throw Error('La revisión de borrado de Compras está incompleta.');
  return {
    reviewJson,
    reviewSha256: digest(review),
    inventoryChanges: Object.entries(attribution).map(([key, { quantity }]) => ({ key, pendingChange: -quantity })),
    activationAuthorized: false
  };
}

module.exports = { prepare };
