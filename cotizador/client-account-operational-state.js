'use strict';
const {digest}=require('./labor-guard'),Mode=require('./commercial-models/client-account-mode.v1');
const fail=()=>{throw Object.assign(Error('Falta la cobertura coordinada de cuentas para la operación de OT.'),{code:'SV_CLIENT_ACCOUNTS_INCOMPLETE',statusCode:503});};
const count=v=>Number.isSafeInteger(v)&&v>=0;
async function verify({read,pins,pages,commercialConfig}){
 const paths=['sv_client_accounts_config','sv_client_accounts/v1/coverage/all','sv_client_accounts/v1/totals/all','sv_client_accounts/v1/ownerEvidence'];
 const [config,coverage,totals,evidence]=await Promise.all(paths.map(read));
 if(config?.schema!==1||config.ready!==true||config.writerMode!==Mode.WRITER||config.scopeBootstrapVersion!==1||config.generation!==pins.accountsGeneration||digest(config)!==pins.accountsConfigSha256)fail();
 if(coverage?.schema!==1||coverage.ready!==true||coverage.generation!==config.generation||!Number.isSafeInteger(coverage.revision)||coverage.revision<pins.minimumAccountsRevision||coverage.ownerManifest!==1||coverage.ownerEvidenceVersion!==1||!['salesRecords','paymentRecords'].every(k=>count(coverage[k])))fail();
 if(totals?.schema!==1||totals.generation!==config.generation||totals.revision!==coverage.revision||!['accounts','debtors','totalCents','paidCents','balanceCents','salesRecords','paymentRecords'].every(k=>count(totals[k]))||totals.totalCents-totals.paidCents!==totals.balanceCents||totals.debtors>totals.accounts||totals.accounts>totals.salesRecords||totals.salesRecords!==coverage.salesRecords||totals.paymentRecords!==coverage.paymentRecords)fail();
 if(evidence?.schema!==1||evidence.ready!==true||evidence.generation!==config.generation||evidence.revision!==coverage.revision||evidence.salesRecords!==coverage.salesRecords)fail();
 if(commercialConfig?.nativeCollectionsReady!==true||commercialConfig.nativeCollectionsSchema!==1||pages?.nativeCollectionsSchema!==1||pages.sales!==coverage.salesRecords||pages.payments!==coverage.paymentRecords)fail();
 return Object.freeze({generation:config.generation,revision:coverage.revision,configurationSha256:digest(config),coverageSha256:digest(coverage),totalsSha256:digest(totals),ownerEvidenceSha256:digest(evidence)});
}
module.exports={verify};
