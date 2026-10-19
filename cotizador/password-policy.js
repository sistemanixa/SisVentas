'use strict';
const GUARD = "(auth == null || (auth.token.svPasswordChangeRequired !== true && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && (!root.child('sv_access_resets').child(auth.uid).child('version').exists() || auth.token.svAccessVersion === root.child('sv_access_resets').child(auth.uid).child('version').val())))";
// Only a connection record already owned by this authenticated UID may be
// removed after revocation. This grants no reads, creations, or edits.
const PRESENCE_RETIRE_OWN = "auth != null && auth.uid === $uid && data.exists() && data.child('uid').val() === auth.uid && !newData.exists()";
function expressionShape(source) {
  const and=[],or=[];let depth=0,quote='',regex=false,characterClass=false,previous='',outerClose=-1,unsupported=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quote){if(c==='\\'){i++;continue;}if(c===quote)quote='';continue;}
    if(regex){if(c==='\\'){i++;continue;}if(c==='[')characterClass=true;else if(c===']')characterClass=false;else if(c==='/'&&!characterClass)regex=false;continue;}
    if(c==='"'||c==="'"){quote=c;previous=c;continue;}
    if(c==='/'&&(!previous||/[\(,=!&|?:]/.test(previous))){regex=true;continue;}
    if(c==='(')depth++;
    else if(c===')'){if(--depth<0)return null;if(depth===0&&outerClose<0)outerClose=i;}
    else if(depth===0){
      if(['?',':',',',';','`'].includes(c))unsupported=true;
      if(c==='&'&&source[i+1]==='&'){and.push(i);i++;}
      else if(c==='|'&&source[i+1]==='|'){or.push(i);i++;}
    }
    if(!/\s/.test(c))previous=c;
  }
  return depth||quote||regex?null:{and,or,outerClose,unsupported};
}
function unwrapExpression(source) {
  let value=source.trim(),shape=expressionShape(value);
  while(shape&&value[0]==='('&&shape.outerClose===value.length-1){value=value.slice(1,-1).trim();shape=expressionShape(value);}
  return {value,shape};
}
const UNWRAPPED_GUARD=unwrapExpression(GUARD).value;
function passwordGuardRequired(source,depth=0) {
  if(typeof source!=='string'||depth>100)return false;
  const {value,shape}=unwrapExpression(source);
  if(!shape||shape.unsupported)return false;
  if(value===UNWRAPPED_GUARD||value==='false')return true;
  function parts(indices){let begin=0;const result=[];for(const at of indices){result.push(value.slice(begin,at));begin=at+2;}result.push(value.slice(begin));return result;}
  if(shape.or.length)return parts(shape.or).every(part=>passwordGuardRequired(part,depth+1));
  if(shape.and.length)return parts(shape.and).some(part=>passwordGuardRequired(part,depth+1));
  return false;
}
function rulesProtectPasswords(policy) {
  const root = policy?.rules;
  if (!root || ![false,undefined,'false'].includes(root['.read']) || ![false,undefined,'false'].includes(root['.write'])) return false;
  function denied(node) { return node && Object.entries(node).every(([k,v]) => ['.read','.write'].includes(k) ? v===false || v==='false' : typeof v==='object' && denied(v)); }
  if (!denied(root.sv_access_resets) || !denied(root.sv_access_control)) return false;
  function secured(value,path,key) {
    if(value===false||value==='false')return true;
    if(typeof value!=='string')return false;
    if(passwordGuardRequired(value))return true;
    const prefix='('+PRESENCE_RETIRE_OWN+') || (';
    return key==='.write'&&path==='sv_chat_presencia/$uid/$session'&&value.startsWith(prefix)&&value.endsWith(')')&&passwordGuardRequired(value.slice(prefix.length,-1));
  }
  function walk(node,path='') {
    return Object.entries(node).every(([k,v]) => ['.read','.write'].includes(k) ? secured(v,path,k) : !v || typeof v!=='object' || walk(v,path?path+'/'+k:k));
  }
  return walk(root);
}
module.exports = {GUARD, PRESENCE_RETIRE_OWN, passwordGuardRequired, rulesProtectPasswords};
