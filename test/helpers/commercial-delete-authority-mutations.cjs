'use strict';
const history='sv_client_history/v1/coverage/all',accounts='sv_client_accounts/v1/coverage/all',pages='sv_commercial_pages/v1/coverage',membership='sv_labor_indexes/paymentRefs_v1/coverage',financial='sv_sale_financial_dependencies/v1/coverage';
module.exports=[
 ['history-ready',history+'/ventas/ready',false],['history-schema',history+'/ventas/schema',0],['history-generation',history+'/ventas/generation','revoked-generation'],['history-revision',history+'/ventas/revision',999],
 ['history-records-negative',history+'/ventas/records',-1],['history-original-negative',history+'/ventas/originalRecords',-1],['history-unlinked-negative',history+'/ventas/unlinkedRecords',-1],['history-sales-count-mismatch',history+'/ventas/originalRecords',99],['history-payments-count-mismatch',history+'/pagos/originalRecords',99],
 ['owner-manifest',accounts+'/ownerManifest',0],['owner-evidence',accounts+'/ownerEvidenceVersion',0],['account-sales-count-mismatch',accounts+'/salesRecords',99],['account-payment-count-mismatch',accounts+'/paymentRecords',99],
 ['membership-matcher',membership+'/matcherHash','f'.repeat(64)],['membership-digest',membership+'/buildDigest','f'.repeat(64)],['membership-payment-count',membership+'/paymentCount',99],['membership-too-many-relations',membership+'/membershipCount',99],
 ['financial-source-format',financial+'/sources/gastos','invalid'],['financial-negative-count',financial+'/counts/gastos',-1],['pages-negative-sales',pages+'/sales',-1],['pages-negative-payments',pages+'/payments',-1]
];
