(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVClientHistoryTimelineReader=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
 const domains=['ventas','pagos','presupuestos','ordenes_trabajo','reclamos','tickets','equipos'];
 const aborted=()=>Object.assign(Error('La consulta del historial cambió.'),{name:'AbortError'});
 function create({reader,allowedDomains}){
  if(typeof reader?.page!=='function'||typeof allowedDomains!=='function')throw Error('Falta la consulta del historial.');
  let epoch=0,state=null,pending=null;
  const reset=()=>{epoch++;state=null;pending=null;};
  async function page(accountId,{address=null,position=0}={}){
   const allowed=allowedDomains();if(!Array.isArray(allowed)||allowed.some(name=>!domains.includes(name))||new Set(allowed).size!==allowed.length||!allowed.length)throw Error('No hay registros autorizados para esta sección.');
   if(!Number.isSafeInteger(position)||position<0)throw Error('Página inválida.');
   const signature=JSON.stringify([accountId,address,allowed]);if(state?.signature!==signature){reset();state={signature,accountId,address,allowed,buffers:{},pages:[],snapshotRevision:null,generation:null,totalRows:0};}
   const selected=state,at=epoch,valid=()=>at===epoch&&state===selected&&JSON.stringify(allowedDomains())===JSON.stringify(allowed);
   if(selected.pages[position]){const verified=await reader.page(accountId,allowed[0],{address,cursor:null,expectedRevision:selected.buffers[allowed[0]].revision,expectedGeneration:selected.generation,expectedSnapshotRevision:selected.snapshotRevision});if(!valid())throw aborted();if(verified.snapshotRevision!==selected.snapshotRevision||verified.generation!==selected.generation)throw Error('El historial cambió. Volvé a actualizar.');return selected.pages[position];}
   if(position!==selected.pages.length)throw Error('Consultá primero la página anterior.');
   if(pending)return pending;
   const task=(async()=>{
    async function fill(domain){if(!valid())throw aborted();let buffer=selected.buffers[domain];if(buffer&&buffer.rows.length||buffer&&!buffer.hasMore)return;
     const result=await reader.page(accountId,domain,{address,cursor:buffer?.cursor||null,expectedRevision:buffer?.revision??null,expectedGeneration:selected.generation,expectedSnapshotRevision:selected.snapshotRevision});if(!valid())throw aborted();
     if(!Number.isSafeInteger(result.snapshotRevision)||result.snapshotRevision<1)throw Error('Falta verificar la revisión completa del historial.');if(selected.snapshotRevision===null){selected.snapshotRevision=result.snapshotRevision;selected.generation=result.generation;}else if(result.snapshotRevision!==selected.snapshotRevision||result.generation!==selected.generation)throw Error('El historial cambió. Volvé a actualizar.');
     if(!buffer){selected.totalRows+=result.totalRows;if(!Number.isSafeInteger(selected.totalRows))throw Error('El historial requiere revisión.');}
     selected.buffers[domain]={revision:result.revision,rows:result.rows.map(row=>({...row,sourceDomain:domain})),cursor:result.cursor,hasMore:result.hasMore};
    }
    if(!selected.generation){await fill(allowed[0]);for(let start=1;start<allowed.length;start+=3)await Promise.all(allowed.slice(start,start+3).map(fill));}
    const rows=[];while(rows.length<50){await Promise.all(allowed.filter(domain=>{const buffer=selected.buffers[domain];return !buffer||!buffer.rows.length&&buffer.hasMore;}).map(fill));if(!valid())throw aborted();
     const choices=allowed.filter(domain=>selected.buffers[domain]?.rows.length).sort((left,right)=>{const a=selected.buffers[left].rows[0],b=selected.buffers[right].rows[0];return a.sort<b.sort?-1:a.sort>b.sort?1:left<right?-1:1;});if(!choices.length)break;rows.push(selected.buffers[choices[0]].rows.shift());
    }
    if(!valid())throw aborted();const hasMore=allowed.some(domain=>{const buffer=selected.buffers[domain];return buffer.rows.length||buffer.hasMore;}),result={rows,totalRows:selected.totalRows,position,hasMore,snapshotRevision:selected.snapshotRevision,generation:selected.generation};selected.pages.push(result);return result;
   })();pending=task;
   try{return await task;}catch(error){if(at===epoch)reset();throw error;}finally{if(pending===task)pending=null;}
  }
  return Object.freeze({page,reset});
 }
 return Object.freeze({create});
});
