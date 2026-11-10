'use strict';
// Installation is display metadata. An exactly unchanged economic row needs
// neither a totals read nor a zero-sum rewrite of balances and monthly metrics.
const same=(a,b)=>require('./labor-guard').canonical(a)===require('./labor-guard').canonical(b);
function plan(changes,M){
 if(!Array.isArray(changes)||!changes.length)return null;const patch={};
 for(const c of changes){const a=c?.before,b=c?.after;
  if(c?.kind!=='sales'||!M.key(c.key)||!a||!b||a.key!==c.key||b.key!==c.key||!M.key(b.sort)||typeof b.installation!=='string'||b.installation.length>60)return null;
  const economic=row=>Object.fromEntries(Object.entries(row).filter(([k])=>k!=='installation'));
  if(!same(economic(a),economic(b)))return null;
  patch[M.ROOT+'/records/sales/'+c.key]=b;
  for(const scope of M.scopes(b.ownerUid))patch[M.ROOT+'/pages/'+scope+'/sales/'+b.sort]=b;
 }
 return patch;
}
module.exports={plan};
