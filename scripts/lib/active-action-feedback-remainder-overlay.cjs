'use strict';
const crypto=require('node:crypto');
const {extract}=require('./active-action-feedback-overlay.cjs');
const changes=require('./active-action-feedback-remainder-patch.json');
const modules=require('./active-action-feedback-module-patch.json');
const hash=source=>crypto.createHash('sha256').update(source).digest('hex');
function apply(source){
 source=source.replace(/\r\n/g,'\n');
 for(const change of changes){const old=extract(source,change.name);if(old.text===change.after)continue;
  if(hash(old.text)!==change.beforeHash)throw Error('Action changed; review required: '+change.name);
  source=source.slice(0,old.start)+change.after+source.slice(old.start+old.text.length);
 }
 return source;
}
function applyModule(file,source){
 source=source.replace(/\r\n/g,'\n');const change=modules.find(entry=>entry.file===file);
 if(change&&hash(source)===change.afterHash)return source;
 if(!change||hash(source)!==change.beforeHash||source.split(change.before).length!==2)throw Error('Module changed; review required: '+file);
 return source.replace(change.before,change.after);
}
module.exports={apply,applyModule,names:changes.map(change=>change.name),modules:modules.map(change=>change.file)};
