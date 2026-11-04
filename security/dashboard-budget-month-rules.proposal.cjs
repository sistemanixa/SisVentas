'use strict';
// Extend ONLY the frozen standalone SDK proposal supplied by the caller. Never deploys.
function extendStandalone(base){
 const rules=structuredClone(base),tree=rules?.rules?.sv_dashboard_budget_proposal?.v1,header=tree?.read?.$uid?.['.read'],suffix=' && $uid === auth.uid';
 if(typeof header!=='string'||!header.endsWith(suffix)||rules.rules['.read']!==false||rules.rules['.write']!==false)throw Error('Expected restrictive standalone SDK rules');
 const allowed=header.slice(0,-suffix.length),own=allowed+" && $scope === 'u_' + auth.uid && $bucket.matches(/^[a-f0-9]{64}$/)";
 for(const name of ['months','monthProof']){if(tree[name])throw Error('Month rule already exists');tree[name]={$scope:{$bucket:{'.read':own}}};}
 if(tree.monthMembers)throw Error('Month members rule already exists');tree.monthMembers={$scope:{$bucket:{'.read':own+" && query.orderByKey === true && query.limitToFirst === 1 && query.limitToLast === null && query.startAt === null && query.endAt === null"}}};
 if(tree.coverage)throw Error('Coverage rule already exists');tree.coverage={scopeAbsenceIsZero:{'.read':allowed}};
 return rules;
}
module.exports={extendStandalone};
