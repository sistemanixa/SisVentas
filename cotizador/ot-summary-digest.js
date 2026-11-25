'use strict';
const {digest}=require('./labor-guard'),{normalizeRtdb}=require('./payment-membership-index');
// Only the attachment manifest is unordered; material rows and path segments stay ordered.
function summaryDigest(summary){
 const value=normalizeRtdb(summary),paths=value?._svListAttachments;
 if(Array.isArray(paths)&&paths.every(path=>Array.isArray(path)&&path.length&&path.every(part=>typeof part==='string'))){
  value._svListAttachments=paths.slice().sort((a,b)=>{const x=JSON.stringify(a),y=JSON.stringify(b);return x<y?-1:x>y?1:0;});
 }
 return digest(value);
}
module.exports={summaryDigest};
