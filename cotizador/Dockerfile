FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js ./
COPY commercial-response.js ./
COPY commercial-pages-model.js commercial-pages-projections.js native-payment-summary.js ./
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
COPY nissei.js ./
COPY compras-paraguay.js ./
COPY conversion-proveedor.js ./
COPY consulta-cache.js navegador-compartido.js ./

ENV NODE_ENV=production
CMD ["npm", "start"]

COPY ot-office-count.js ot-office-count-model.js ot-stock-consumption-model.js ./
COPY ot-closed-products.js ot-lifecycle.js ot-lifecycle-model.js ot-lifecycle-policy.js ot-material-rows-model.js ot-personal-scope.js ./

COPY sale-return-to-budget.js ./
