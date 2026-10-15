'use strict';
const GUARD = "(auth == null || (auth.token.svPasswordChangeRequired !== true && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && (!root.child('sv_access_resets').child(auth.uid).child('version').exists() || auth.token.svAccessVersion === root.child('sv_access_resets').child(auth.uid).child('version').val())))";
function rulesProtectPasswords(policy) {
  const root = policy?.rules;
  if (!root || ![false,undefined,'false'].includes(root['.read']) || ![false,undefined,'false'].includes(root['.write'])) return false;
  function denied(node) { return node && Object.entries(node).every(([k,v]) => ['.read','.write'].includes(k) ? v===false || v==='false' : typeof v==='object' && denied(v)); }
  if (!denied(root.sv_access_resets) || !denied(root.sv_access_control)) return false;
  function walk(node) {
    return Object.entries(node).every(([k,v]) => ['.read','.write'].includes(k) ? v===false || v==='false' || typeof v==='string' && v.endsWith(' && '+GUARD) : !v || typeof v!=='object' || walk(v));
  }
  return walk(root);
}
module.exports = {GUARD, rulesProtectPasswords};
