(function(root, factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SVClientReviewStatus=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var own=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
  var map=function(o){return !!o&&typeof o==='object'&&!Array.isArray(o);};
  var key=function(k){return typeof k==='string'&&k.length>0&&k.trim()===k;};
  // group.miembros: legacy records {fbKey?,id?}. decision follows the existing
  // {estado:'independientes',confirmadaManualmente:true} contract. No name matching.
  // Returns only {status,clienteKey?}; absent evidence is never a completed merge.
  function classify(group,index,structures,decision){
    var result=function(status,clienteKey){return clienteKey?{status:status,clienteKey:clienteKey}:{status:status};};
    if(!map(group)||!Array.isArray(group.miembros)||group.miembros.length<2||!map(index)||!map(structures))return result('review');
    var seen=new Set(), targets=[], traced=false, complete=true;
    for(var member of group.miembros){
      if(!map(member)||(!key(member.fbKey)&&!key(member.id)))return result('review');
      if((member.fbKey!==undefined&&!key(member.fbKey))||(member.id!==undefined&&!key(member.id)))return result('review');
      var legacy=member.fbKey||member.id;
      if(seen.has(legacy))return result('review');seen.add(legacy);
      var aliases=[member.fbKey,member.id].filter(key), entries=aliases.filter(function(a){return own(index,a);}).map(function(a){return index[a];});
      var backlinks=Object.keys(structures).filter(function(k){var s=structures[k];return map(s)&&((Array.isArray(s.legacyFbKeys)&&s.legacyFbKeys.includes(legacy))||(map(s.sedes)&&Object.values(s.sedes).some(function(row){return map(row)&&((key(member.fbKey)&&row.legacyFbKey===member.fbKey)||(key(member.id)&&row.legacyId===member.id));})));});
      if(!entries.length){if(backlinks.length)traced=true;complete=false;continue;}
      traced=true;
      var entry=entries[0];
      if(!map(entry)||!key(entry.clienteKey)||!key(entry.sedeKey)||entries.some(function(e){return !map(e)||e.clienteKey!==entry.clienteKey||e.sedeKey!==entry.sedeKey;}))return result('review');
      if(!own(structures,entry.clienteKey))return result('review');
      var structure=structures[entry.clienteKey];
      if(!map(structure)||structure.esquema!==1||!Array.isArray(structure.legacyFbKeys)||!structure.legacyFbKeys.every(key)||new Set(structure.legacyFbKeys).size!==structure.legacyFbKeys.length||!structure.legacyFbKeys.includes(legacy)||!map(structure.sedes)||!own(structure.sedes,entry.sedeKey))return result('review');
      var sede=structure.sedes[entry.sedeKey];
      if(!map(sede)||(key(member.fbKey)&&sede.legacyFbKey!==member.fbKey)||(key(member.id)&&sede.legacyId!==member.id)||backlinks.some(function(k){return k!==entry.clienteKey;}))return result('review');
      targets.push(entry.clienteKey);
    }
    var independent=map(decision)&&decision.estado==='independientes'&&decision.confirmadaManualmente===true;
    if(!traced)return result(independent?'independent':'pending');
    if(independent||!complete||targets.length!==group.miembros.length||new Set(targets).size!==1)return result('review');
    return result('unified',targets[0]);
  }
  return Object.freeze({classify:classify});
});
