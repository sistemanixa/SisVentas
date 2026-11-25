FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js ./
COPY commercial-admission.js ./
COPY commercial-response.js ./
COPY commercial-pages-model.js commercial-pages-projections.js commercial-creator-latest.js native-payment-summary.js ot-installation-display-delta.js ./
COPY dashboard-authority-policy-proposal.js dashboard-budget-projection-proposal.js dashboard-budget-incremental-plan-proposal.js ./
COPY dashboard-budget-activity-codec-proposal.js dashboard-budget-reader-proposal.js dashboard-budget-activity-reader-proposal.js dashboard-budget-notice-candidates-proposal.js ./
COPY dashboard-budget-writer-proposal.js dashboard-budget-read-view-augment-proposal.js dashboard-budget-sdk-dto-proposal.js ./
COPY dashboard-commercial-activity-proposal.js dashboard-commercial-activity-reader-proposal.js ./
COPY dashboard-rtdb-read-db.js ./
COPY client-history-model.js client-history-delta.js client-history-projections.js ./
COPY client-account-directory.js client-account-projection.js client-account-projections.js client-account-ledger.js ./
COPY client-account-embedded.js client-account-documents.js client-account-owner-evidence.js client-account-scope.js client-account-scope-plan.js ./
COPY commercial-collection-reader.js ./
COPY commission-event.js ./
COPY labor-commission-participant.js sale-commission-assignment.js commission-assignment-event.js commission-detail-projection.js commission-write-proof.js ./
COPY distributor-documents.js ./
COPY projects.js projects-model.js projects-list-store.js ./
COPY user-directory.js ./
COPY chat-operations.js ./
COPY chat-header-store.js ./
COPY user-access.js password-email.js password-policy.js ./
COPY tecnoprices-login.js budget-presentation-trial.js budget-presentation-trial-model.js ./
COPY oauth-authorization.js ./
COPY labor-calculations.js labor-operations.js labor-submissions.js labor-transaction.js ./
COPY sale-cost-correction.js sale-cost-correction-model.js ./
COPY labor-guard.js labor-index.js labor-rtdb-store.js labor-scoped-transaction.js labor-db.js labor-runtime.js labor-write-gateway.js labor-fence-policy.js labor-commission-limit.js ./
COPY ot-delivery-commit-protocol.js ot-delivery-attestation.js ot-material-state.js ot-physical-confirmation-model.js ot-general-consumption-exception.js ./
COPY ot-custody-held-authority.js client-account-operational-state.js ./
COPY operational-projections.js operational-read-model.js record-list-projections.js record-list-model.js ./
COPY labor-bonus-batch.js bonus-quantity-model.js ./
COPY labor-sac-batch.js payroll-legacy-sac-model.js ./
COPY labor-advance-discount.js ./
COPY employee-availability.js ./
COPY employee-directory.js ./
COPY personal-hours-reader.js ./
COPY personal-expenses.js ./
COPY bonus-payment.js bonus-payment-model.js expense-payment-adjustment.js ./
COPY admin-expense-create.js admin-expense-edit.js payment-membership-matcher.js payment-membership-index.js payment-snapshot.js payment-commands.js ./
COPY expense-clothing-link.js expense-clothing-model.js employee-resources.js employee-resources-policy.js employee-clothing-model.js expense-categories-model.js ./
COPY expense-removal-policy.js expense-removal-guard.js ./
COPY supplier-directory.js ./
COPY commission-calculations.js commission-operations.js commission-public-response.js ./
COPY commission-generation.js commission-generation-model.js commission-collection-proof.js commercial-ownership.js domain-read-policy.js ./
COPY commercial-models/ ./commercial-models/
COPY private-finance.js private-finance-model.js private-finance-storage.js ./
COPY catalog-request.js catalog-promotions.js ./
COPY ficha-producto.js ./
COPY proveedor-automatico.js ./
COPY nissei.js ./
COPY compras-paraguay.js ./
COPY conversion-proveedor.js ./
COPY consulta-cache.js navegador-compartido.js ./

ENV NODE_ENV=production
CMD ["npm", "start"]

COPY ot-office-count.js ot-office-count-model.js ot-stock-consumption-model.js ./
COPY ot-closed-products.js ot-lifecycle.js ot-delivery.js ot-delivery-model.js ot-lifecycle-model.js ot-lifecycle-policy.js ot-material-rows-model.js ot-personal-scope.js ./

COPY sale-return-to-budget.js ./

COPY sale-delete-http-adapter.js sale-delete-command.js sale-delete-relations.js sale-delete-fence.js sale-delete-activity.js ./

COPY purchase-order-delete.js purchase-order-delete-model.js purchase-order-delete-review.js purchase-manual-delete-review.js ./

COPY ot-delete-command.js ot-delete-policy.js ot-delete-http-adapter.js ./
COPY office-stock.js office-stock-policy.js office-stock-model.js office-stock-money.js ot-delete-authority.js ot-delete-operational-contract.js ot-delete-linked-plan.js ot-delete-operational-runtime.js ./

COPY client-history-access.js client-history-query.js client-history-http-adapter.js client-history-complete-page.js client-history-client.js ./

COPY sale-economics-validation.js sale-financial-dependencies-model.js sale-financial-dependencies-delta.js sale-financial-dependencies-projections.js sale-financial-dependencies-provider.js sale-financial-dependencies-protocol.js client-account-writer-protocol.js ./

# Closed local dependencies of the typed inventory and purchase entrypoints.
COPY employee-resources-http.js initial-inventory-model.js initial-inventory-reference.js inventory-absence-evidence.js inventory-bootstrap-model.js ./
COPY inventory-code-pins.js inventory-cohort-contract.js inventory-cohort-runtime.js inventory-command-http.js inventory-installation-contract.js ./
COPY inventory-reference-runtime.js office-stock-canonical-locator.js office-stock-catalog-coverage.js office-stock-directed-coverage.js office-stock-explicit-reference.js ./
COPY office-stock-link-command.js office-stock-link-plan.js office-stock-link-policy.js office-stock-order-policy.js office-stock-order-projections.js ./
COPY office-stock-order.js office-stock-reference-io.js office-stock-reference-port.js office-stock-reference.js purchase-action-models.js ./
COPY purchase-actions.js purchase-command-host.js purchase-create-reference-port.js purchase-document-model.js purchase-generation-dispatch.js ./
COPY purchase-initial-inventories.js purchase-inventory-command.js purchase-inventory-history.js purchase-inventory-linked-plan.js purchase-inventory-linked-sources.js ./
COPY purchase-inventory-model.js purchase-inventory-order-plan.js purchase-inventory-policy.js purchase-inventory-reference-port.js purchase-joint-generation-model.js ./
COPY purchase-joint-order-plan.js purchase-joint-reserve-model.js purchase-legacy-import-model.js purchase-linked-edit-model.js purchase-list-edit-model.js ./
COPY purchase-list-generation-command.js purchase-list-generation-model.js purchase-list-lifecycle-model.js purchase-list-reserve-model.js purchase-manual-create-command.js ./
COPY purchase-manual-create-model.js purchase-manual-edit-model.js purchase-numbering-protocol.js purchase-numbering.js purchase-order-actions-model.js ./
COPY purchase-order-edit-plan.js purchase-preparation-availability.js purchase-preparation-cancel-model.js purchase-preparation-model.js purchase-receipt-fx.js ./
COPY purchase-receipt-reconcile-model.js purchase-route-contract.js purchase-source-cost-protocol.js purchase-source-cost-validator.js purchase-stock-generation-model.js ./
COPY purchase-typed-delete-command.js purchase-typed-delete-model.js purchase-wire-envelope.js stock-link-activation-contract.js ./
COPY purchase-current-pending-model.js purchase-current-pending-baseline.js purchase-current-pending-command.js purchase-current-pending-scan.js purchase-current-pending-sources.js ./

COPY ot-command-http.js ot-inventory-model.js ot-inventory-policy.js ot-inventory-wire-policy.js ot-inventory.js ./
COPY ot-metadata-model.js ot-metadata-policy.js ot-metadata.js ot-native-write-protocol.js ot-note-native-policy.js ot-office-count-policy.js ./
COPY ot-physical-write-policy.js ot-standalone-close-model.js ot-standalone-delivery-model.js ot-stock-source-authority.js ot-structure-model.js ./
COPY ot-structure-policy.js ot-structure.js ot-summary-digest.js ot-warehouse-receipt.js ot-warehouse-stock.js ./
COPY ot-standalone-destinations.js ot-material-edit-policy.js ot-material-native-policy.js ot-related-adapters.js ./
COPY ot-delete-inventory-cohort.js ./
