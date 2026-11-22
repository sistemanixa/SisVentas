'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{route}=require('../cotizador/purchase-inventory-admission');
const proof={schema:1,catalogBarrierVerified:true,legacySdkBlocked:true,purchaseWriterReady:true};
test('OFF or absent mapping preserves legacy selection without claiming coordinated readiness',()=>{a.equal(route(),'legacy');a.equal(route({enabled:false,mappingPresent:true}),'legacy');a.equal(route({enabled:true,mappingPresent:false}),'legacy');});
test('active mapping cannot fall back after incomplete barrier or SDK cut',()=>{for(const field of Object.keys(proof)){a.throws(()=>route({enabled:true,mappingPresent:true,proof:{...proof,[field]:false}}),{code:'SV_PURCHASE_INVENTORY_NOT_READY'});}a.throws(()=>route({enabled:true,mappingPresent:true}));a.equal(route({enabled:true,mappingPresent:true,proof}),'coordinated');});
