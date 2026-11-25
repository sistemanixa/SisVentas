'use strict';
const crypto=require('node:crypto'),vm=require('node:vm');
const changes=require('./active-action-feedback-patch.json');
function extract(source,name){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 if(start<0)throw new Error('Missing action '+name);
 const ends=/^\}/gm;ends.lastIndex=start;
 for(let m;(m=ends.exec(source));){const text=source.slice(start,m.index+1);try{new vm.Script(text);return {start,text};}catch(_){}}
 throw new Error('Incomplete action '+name);
}
function apply(source){
 source=source.replace(/\r\n/g,'\n');
 for(const change of changes){const original=extract(source,change.name);
  if(crypto.createHash('sha256').update(original.text).digest('hex')!==change.beforeHash)throw new Error('Action changed; review required: '+change.name);
  source=source.slice(0,original.start)+change.after+source.slice(original.start+original.text.length);
 }
 return source;
}
module.exports={apply,extract,names:changes.map(c=>c.name)};
