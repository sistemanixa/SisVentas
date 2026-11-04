'use strict';
const {ROOT}=require('./sale-financial-dependencies-model');
const CLAIM='svSaleFinancialWriterVersion',VERSION=1;
const installed="root.child('"+ROOT+"').exists()";
const gate='(!'+installed+' || auth.token.'+CLAIM+' === '+VERSION+')';
function reservedClaims(internalWriterVersion){return {[CLAIM]:internalWriterVersion===VERSION?VERSION:0};}
function allowsInstalledWriter(indexExists,claims){return !indexExists||claims?.[CLAIM]===VERSION;}
module.exports={CLAIM,VERSION,installed,gate,reservedClaims,allowsInstalledWriter};
