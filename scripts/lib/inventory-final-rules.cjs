'use strict';
const Combined=require('./inventory-combined-rules.cjs'),Installed=require('./inventory-installed-rules.cjs'),Preserve=require('./inventory-ledger-preservation-rules.cjs'),crypto=require('node:crypto');
function prepare(input,options){const base=Combined.prepare(input,options),sticky=Installed.prepare(base.rules,options),preserved=Preserve.prepare(sticky.rules,options);return{rules:preserved.rules,manifest:{schema:1,combined:base.manifest,installation:sticky.manifest,preservation:preserved.manifest,candidateDigest:crypto.createHash('sha256').update(JSON.stringify(preserved.rules)).digest('hex'),activated:false}};}
module.exports={prepare};
