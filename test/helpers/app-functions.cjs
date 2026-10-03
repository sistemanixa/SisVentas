const vm=require('node:vm');
const {source}=require('./active-app').readActiveApp();
function functionSource(name){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 if(start<0)throw new Error('Falta función activa '+name);
 const ends=/^\}/gm;ends.lastIndex=start;
 for(let m;(m=ends.exec(source));){const text=source.slice(start,m.index+1);try{new vm.Script(text);return text;}catch(_){}}
 throw new Error('Función incompleta '+name);
}
function load(context,names){if(!vm.isContext(context))vm.createContext(context);for(const name of names)vm.runInContext(functionSource(name),context);return context;}
module.exports={functionSource,load};
