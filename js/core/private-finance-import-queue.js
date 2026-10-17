(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVPrivateFinanceImportQueue=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 function create({scan,changed=()=>{},limit=20}){
  const entries=[];let running=false,closed=false,sequence=0;
  const emit=()=>{if(!closed)changed(entries);};
  function complete(entry,status){entry.status=status;entry.resolve?.(entry);entry.resolve=null;emit();}
  async function pump(){
   if(running||closed)return;running=true;
   try{while(!closed){const entry=entries.find(e=>e.status==='waiting');if(!entry)break;
    entry.controller=new AbortController();entry.status='reading';emit();
    let abort;const cancelled=new Promise(resolve=>{abort=()=>resolve(null);entry.controller.signal.addEventListener('abort',abort,{once:true});});
    try{const result=await Promise.race([Promise.resolve().then(()=>scan(entry,entry.controller.signal)),cancelled]);if(!closed&&entry.status==='reading'){entry.result=result;complete(entry,'ready');}}
    catch(error){if(!closed&&entry.status==='reading'){entry.error=error.message||'No se pudo leer el archivo';complete(entry,'error');}}
    finally{entry.controller.signal.removeEventListener('abort',abort);entry.controller=null;}
   }}finally{running=false;}
  }
  function add(files){
   if(closed)return Promise.resolve([]);const input=[...files];if(entries.length+input.length>limit)throw Error('Podés cargar hasta '+limit+' PDF por tanda.');
   const added=input.map(file=>{const entry={id:'pdf-'+(++sequence),file,name:file.name,status:'waiting',result:null,error:''};entry.done=new Promise(resolve=>entry.resolve=resolve);entries.push(entry);return entry;});emit();pump();return Promise.all(added.map(e=>e.done));
  }
  function cancel(id){const entry=entries.find(e=>e.id===id);if(!entry||!['waiting','reading'].includes(entry.status))return;entry.controller?.abort();complete(entry,'cancelled');}
  function retry(id){const entry=entries.find(e=>e.id===id);if(!entry||!['error','cancelled','ready'].includes(entry.status)||closed)return Promise.resolve();entry.error='';entry.status='waiting';entry.done=new Promise(resolve=>entry.resolve=resolve);emit();pump();return entry.done;}
  function remove(id){const entry=entries.find(e=>e.id===id);if(!entry)return;cancel(id);entries.splice(entries.indexOf(entry),1);emit();}
  function destroy(){closed=true;for(const entry of entries){entry.controller?.abort();entry.resolve?.(entry);entry.file=entry.result=null;}entries.length=0;}
  return {entries,add,cancel,retry,remove,destroy,cancelPending(){for(const e of entries.slice())cancel(e.id);}};
 }
 return {create};
});
