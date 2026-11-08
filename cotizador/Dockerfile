FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js ./
COPY commercial-admission.js ./
COPY commercial-response.js ./
COPY commercial-pages-model.js commercial-pages-projections.js commercial-creator-latest.js native-payment-summary.js ./
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
COPY distributor-documents.js ./
COPY projects.js projects-model.js projects-list-store.js ./
COPY user-directory.js ./
COPY chat-operations.js ./
COPY chat-header-store.js ./
COPY user-access.js password-email.js password-policy.js ./
COPY oauth-authorization.js ./
COPY labor-calculations.js labor-operations.js labor-submissions.js labor-transaction.js ./
COPY sale-cost-correction.js sale-cost-correction-model.js ./
COPY labor-guard.js labor-index.js labor-rtdb-store.js labor-scoped-transaction.js labor-db.js labor-runtime.js labor-write-gateway.js labor-fence-policy.js labor-commission-limit.js ./
COPY ot-delivery-commit-protocol.js ot-delivery-attestation.js ot-material-state.js ./
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
COPY expense-removal-policy.js expense-removal-guard.js ./
COPY supplier-directory.js ./
COPY commission-calculations.js commission-operations.js commission-public-response.js ./
COPY commission-generation.js commission-generation-model.js commission-collection-proof.js commercial-ownership.js domain-read-policy.js ./
COPY commercial-models/ ./commercial-models/
COPY private-finance.js private-finance-model.js private-finance-storage.js ./
COPY catalog-request.js catalog-promotions.js ./
COPY ficha-producto.js ./
COPY proveedor-automatico.js ./
COPY tecnoprices-login.js ./
COPY commercial-delete-attestation.js commercial-delete-commit-protocol.js commercial-delete-runtime.js ./
COPY nissei.js ./
COPY compras-paraguay.js ./
COPY conversion-proveedor.js ./
COPY consulta-cache.js navegador-compartido.js ./

ENV NODE_ENV=production
CMD ["npm", "start"]

COPY ot-office-count.js ot-office-count-model.js ot-stock-consumption-model.js ./
COPY ot-rendition-stock-plan.js ./
COPY office-stock.js office-stock-model.js office-stock-policy.js ./
COPY ot-closed-products.js ot-lifecycle.js ot-delivery.js ot-delivery-model.js ot-lifecycle-model.js ot-lifecycle-policy.js ot-material-rows-model.js ot-personal-scope.js ./

COPY sale-return-to-budget.js ./

COPY sale-delete-http-adapter.js sale-delete-command.js sale-delete-relations.js sale-delete-fence.js sale-delete-activity.js ./

COPY purchase-order-delete.js purchase-order-delete-model.js ./

COPY ot-delete-command.js ot-delete-policy.js ot-delete-http-adapter.js ./

COPY client-history-access.js client-history-query.js client-history-http-adapter.js client-history-complete-page.js client-history-client.js ./

COPY sale-economics-validation.js sale-financial-dependencies-model.js sale-financial-dependencies-delta.js sale-financial-dependencies-projections.js sale-financial-dependencies-provider.js sale-financial-dependencies-protocol.js client-account-writer-protocol.js ./
