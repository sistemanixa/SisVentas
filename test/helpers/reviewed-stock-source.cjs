'use strict';
// Reverse only explicitly reviewed opt-in read changes; native hashes stay pinned.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const profiles=[require('../fixtures/reviewed-stock-order-source.json'),require('../fixtures/reviewed-stock-mapped-source.json')];
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function reverseReviewedStock(source){
 for(const profile of profiles.slice().reverse()){
  assert.equal(profile.schema,1);assert.equal(profile.file,'cotizador/office-stock.js');
  if(!source.includes(profile.marker))continue;
  const exact=sha(source)===profile.afterSha256,lines=source.split('\n');
  for(const hunk of profile.hunks.slice().reverse()){
   const offset=hunk.newLines.length?hunk.newStart-1:hunk.newStart;
   assert.deepEqual(lines.slice(offset,offset+hunk.newLines.length),hunk.newLines,'Reviewed Stock source hunk changed');
   lines.splice(offset,hunk.newLines.length,...hunk.oldLines);
  }
  source=lines.join('\n');if(exact)assert.equal(sha(source),profile.beforeSha256,'Reviewed Stock predecessor changed');
 }
 return source;
}
module.exports={reverseReviewedStock};
