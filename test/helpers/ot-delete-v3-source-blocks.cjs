'use strict';
// Exact LF blocks: reverse changes in reverse order with replaceAll.
module.exports=[
  {
    "path": "cotizador/ot-delete-operational-contract.js",
    "beforeSha256": "0f0a0dbf741e7180b36e85399e6d407380bd4e521851cb1fbf33f569e1d223dd",
    "afterSha256": "bb9b205470f5f0f9cea54f76d86f5b62400b4afaac9ec00e9e3860946c6a622b",
    "changes": [
      {
        "before": "const accountPinFields=pinFields.concat(['accountsGeneration','accountsConfigSha256','minimumAccountsRevision']);",
        "after": "const accountPinFields=pinFields.concat(['accountsGeneration','accountsConfigSha256','minimumAccountsRevision']);\nconst inventoryPinFields=accountPinFields.concat(['inventoryGeneration','inventoryContractDigest','inventoryPinsSha256','historyGeneration','historyConfigSha256','minimumHistoryRevision','financialGeneration','minimumFinancialRevision']);",
        "count": 1
      },
      {
        "before": "p?.schema===2&&exact(p,accountPinFields)&&text(p.accountsGeneration)",
        "after": "(p?.schema===2&&exact(p,accountPinFields)||p?.schema===3&&exact(p,inventoryPinFields)&&text(p.inventoryGeneration)&&hash(p.inventoryContractDigest)&&hash(p.inventoryPinsSha256)&&text(p.historyGeneration)&&hash(p.historyConfigSha256)&&Number.isSafeInteger(p.minimumHistoryRevision)&&p.minimumHistoryRevision>=1&&text(p.financialGeneration)&&Number.isSafeInteger(p.minimumFinancialRevision)&&p.minimumFinancialRevision>=1)&&text(p.accountsGeneration)",
        "count": 1
      },
      {
        "before": "function runtimeReady(r,pins){return r?.coordinated",
        "after": "function runtimeReady(r,pins){if(pins?.schema===3)return r?.coordinated===true&&r.readOnly===false&&r.commercialPages===true&&r.operationalSummaries===true&&r.clientHistory===true&&r.clientAccounts===true&&r.saleFinancialDependencies===true;return r?.coordinated",
        "count": 1
      },
      {
        "before": "function createVerifier({publicKey,pins,now=Date.now}={}){",
        "after": "function createVerifier({publicKey,pins,inventoryCohort,now=Date.now}={}){",
        "count": 1
      },
      {
        "before": "if(validPins(pins)){key=crypto.createPublicKey(publicKey);",
        "after": "if(validPins(pins)&&(pins.schema!==3||require('./ot-delete-inventory-cohort').isAuthority(inventoryCohort))){key=crypto.createPublicKey(publicKey);",
        "count": 1
      },
      {
        "before": " async function verify({operation,read,exists,runtime}={}){",
        "after": " async function preparedLinkedState(read,pages,commercial){\n  const historyPaths=['sv_client_history_config','sv_client_history/v1/state','sv_client_history/v1/coverage/all','sv_sale_financial_dependencies/v1/coverage'],values=await Promise.all(historyPaths.map(read)),[config,state,coverage,financial]=values;\n  if(config?.schema!==1||config.ready!==true||config.writerSchema!==1||config.generation!==expected.historyGeneration||digest(config)!==expected.historyConfigSha256||state?.schema!==1||state.ready!==true||state.dependencyManifest!==1||state.generation!==config.generation||!Number.isSafeInteger(state.revision)||state.revision<expected.minimumHistoryRevision)throw fail();\n  const accounts=await require('./client-account-operational-state').verify({read,pins:expected,pages,commercialConfig:commercial}),accountCoverage=await read('sv_client_accounts/v1/coverage/all');\n  for(const domain of require('./client-history-model').domains){const item=coverage?.[domain];if(item?.schema!==1||item.ready!==true||item.generation!==config.generation||!Number.isSafeInteger(item.revision)||item.revision<1||item.revision>state.revision||!Number.isSafeInteger(item.records)||item.records<0||!Number.isSafeInteger(item.originalRecords)||item.originalRecords<0||item.originalRecords>item.records)throw fail();}\n  if(coverage.ventas.originalRecords!==accountCoverage.salesRecords||coverage.pagos.originalRecords!==accountCoverage.paymentRecords)throw fail();\n  const validFinancial=require('./sale-financial-dependencies-model').validateCoverage(financial);\n  if(validFinancial.generation!==expected.financialGeneration||validFinancial.revision<expected.minimumFinancialRevision)throw fail();\n  return {history:values,accounts};\n }\n async function verify({operation,read,exists,runtime}={}){",
        "count": 1
      },
      {
        "before": "marker.capability!==(expected.schema===2?'ot-delete-operational-accounts-v2':'ot-delete-operational-v1')",
        "after": "marker.capability!==(expected.schema===3?'ot-delete-operational-inventory-v3':expected.schema===2?'ot-delete-operational-accounts-v2':'ot-delete-operational-v1')",
        "count": 1
      },
      {
        "before": "   // Parent absence is mandatory: missing config/state is NOT an empty tree.",
        "after": "   const inventoryState=expected.schema===3?await inventoryCohort.capture({read,pins:expected,now:at}):null;\n   const linkedState=expected.schema===3?await preparedLinkedState(read,coverage,pages):null;\n   // Parent absence remains mandatory for the original v1/v2 contracts.",
        "count": 1
      },
      {
        "before": "for(const p of ABSENT.filter(p=>expected.schema!==2||!p.startsWith('sv_client_accounts')))if(await exists(p)!==false)return null;",
        "after": "for(const p of (expected.schema===3?[]:ABSENT.filter(p=>expected.schema!==2||!p.startsWith('sv_client_accounts'))))if(await exists(p)!==false)return null;",
        "count": 2
      },
      {
        "before": "   const proof=Object.freeze({schema:1,operation:'otDelete'",
        "after": "   if(expected.schema===3&&(digest(await inventoryCohort.capture({read,pins:expected,now:now()}))!==digest(inventoryState)||digest(await preparedLinkedState(read,after[3],after[2]))!==digest(linkedState)))return null;\n   const proof=Object.freeze({schema:1,operation:'otDelete'",
        "count": 1
      },
      {
        "before": "verificationKind:'signed-ot-operational-cut-v1'",
        "after": "...(expected.schema===3?{inventoryState}:{}),verificationKind:expected.schema===3?'signed-ot-inventory-cut-v3':'signed-ot-operational-cut-v1'",
        "count": 1
      },
      {
        "before": "fresh.cohortSha256!==proof.cohortSha256)throw fail();",
        "after": "fresh.cohortSha256!==proof.cohortSha256||digest(fresh.inventoryState)!==digest(proof.inventoryState))throw fail();",
        "count": 1
      },
      {
        "before": " async function projectedPlan({actor,lease,patch,readFresh,existsFresh,runtime}){",
        "after": " const expectedSchema=()=>expected?.schema;\n async function projectedPlan({actor,lease,patch,readFresh,existsFresh,runtime}){",
        "count": 1
      },
      {
        "before": "  if(runtime.clientAccounts===true)await require('./client-account-projections').augment({patch:expected,raw,get});",
        "after": "  if(runtime.clientAccounts===true&&expectedSchema()!==3)await require('./client-account-projections').augment({patch:expected,raw,get});",
        "count": 1
      },
      {
        "before": "  for(const check of checks)await check({readFresh});",
        "after": "  if(expectedSchema()===3){await require('./client-account-projections').augment({patch:expected,raw,get});await require('./client-account-scope-plan').augment({actor,patch:expected,raw});await require('./client-history-projections').augment({patch:expected,raw,get,enabled:true});await require('./sale-financial-dependencies-projections').augment({patch:expected,raw,get,exists:existsFresh});}\n  for(const check of checks)await check({readFresh});",
        "count": 1
      }
    ]
  },
  {
    "path": "cotizador/ot-delete-operational-runtime.js",
    "beforeSha256": "103f938f1bb94c998277d418ec0d744fa2f7097373cd97a4b76a85ff0893b23b",
    "afterSha256": "fa6ae51f63b28cc4dadf3567d09aa83bdad64eadd1c457a5cb9f6bf4295cccb4",
    "changes": [
      {
        "before": "function create({env=process.env,read,exists,runtime,now=Date.now}={}){",
        "after": "function create({env=process.env,read,exists,runtime,inventoryCohort,now=Date.now}={}){",
        "count": 1
      },
      {
        "before": "{publicKey:env.OT_DELETE_OPERATIONAL_PUBLIC_KEY,pins,now}",
        "after": "{publicKey:env.OT_DELETE_OPERATIONAL_PUBLIC_KEY,pins,inventoryCohort,now}",
        "count": 1
      }
    ]
  }
];
