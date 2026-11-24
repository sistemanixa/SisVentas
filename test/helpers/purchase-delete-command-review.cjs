'use strict';

const { prepareOrderDeletion } = require('../../cotizador/purchase-order-delete-model');

// Characterize the existing command independently of the deployment review.
module.exports = {
  configured: () => true,
  assertCurrent: async () => {},
  assertTarget: () => {},
  plan: prepareOrderDeletion
};
