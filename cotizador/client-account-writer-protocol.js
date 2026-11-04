'use strict';
const CLAIM='svClientAccountsWriterVersion',VERSION=1;
// Sticky even if readiness/configuration is removed or an installation is partial.
const installed="(root.child('sv_client_accounts/v1').exists() || root.child('sv_client_accounts_config/ready').val() === true || root.child('sv_client_accounts_config/writerMode').val() === 'coordinated-v1')";
const gate='(!'+installed+' || auth.token.'+CLAIM+' === '+VERSION+')';
function reservedClaims(internalWriterVersion){return {[CLAIM]:internalWriterVersion===VERSION?VERSION:0};}
module.exports={CLAIM,VERSION,installed,gate,reservedClaims};
