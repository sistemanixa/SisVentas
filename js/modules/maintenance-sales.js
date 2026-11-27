(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVMaintenanceSales=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),key=v=>typeof v==='string'&&v.length>0&&v.length<=768&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
 const abort=()=>Object.assign(Error('La revisión cambió.'),{name:'AbortError'}),copy=v=>JSON.parse(JSON.stringify(v));
 function create({reader,read,history,valid,onProgress=()=>{}}={}){
  if(typeof reader?.page!=='function'||typeof reader?.totals!=='function'||typeof read!=='function'||typeof history!=='function'||typeof valid!=='function'||typeof onProgress!=='function')throw TypeError('Faltan lectores de revisión autorizados.');
  let running=null,snapshot=null;
  async function execute(){
   let reads=0,total=0,checked=0,pin=null,failed=false;const results=[],historyMemo=new Map(),pointMemo=new Map();
   snapshot=()=>copy({kind:'sales',complete:false,partial:true,checked,total,results,reads});
   const check=()=>{if(valid()!==true)throw abort();};
   let activeIO=0;const waitingIO=[];
   async function io(work){check();if(activeIO>=6)await new Promise(resolve=>waitingIO.push(resolve));else activeIO++;try{check();reads++;const answer=await work();check();return answer;}finally{const next=waitingIO.shift();if(next)next();else activeIO--;}}
   function progress(){check();onProgress({kind:'sales',complete:false,checked,total,reads});}
   function issue(result,text,incomplete=false){result.status=incomplete?'unavailable':result.status==='ok'?'review':result.status;result.issues.push(text);}
   function checkPin(value){if(!Number.isSafeInteger(value?.revision)||value.revision<1||typeof value.generation!=='string'||!value.generation||pin&&(value.revision!==pin.revision||value.generation!==pin.generation))throw Error('La cobertura cambió.');if(!pin)pin={revision:value.revision,generation:value.generation};}
   function counts(value){checkPin(value);if(!plain(value.totals)||!['sales','payments'].every(k=>Number.isSafeInteger(value.totals[k])&&value.totals[k]>=0))throw Error('Faltan cantidades completas.');return{sales:value.totals.sales,payments:value.totals.payments};}
   function point(path){if(!/^sisventas\/(clientes|ordenes_trabajo|presupuestos|pagos)\/[^/]+$/.test(path)||!key(path.split('/')[2]))throw Error('Referencia inválida.');if(!pointMemo.has(path))pointMemo.set(path,io(()=>read(path)));return pointMemo.get(path);}
   function saleHistory(id){
    if(!key(id))throw Error('Venta inválida.');
    if(!historyMemo.has(id))historyMemo.set(id,io(()=>history(id)).then(value=>{
     const h=value?.paymentHistory,r=value?.record;if(value?.ok!==true||!plain(r)||r.fbKey!=null&&r.fbKey!==id||value.fbKey!=null&&value.fbKey!==id||h?.schema!==1||h.complete!==true||!['global','embedded','legacy'].includes(h.source)||!Array.isArray(h.payments)||typeof h.paidAmount!=='number'||!Number.isFinite(h.paidAmount)||h.paidAmount<0)throw Error('Historial incompleto.');
     const seen=new Set();for(const p of h.payments){if(!plain(p)||typeof p.monto!=='number'||!Number.isFinite(p.monto)||p.monto<0||typeof p.hasReceipt!=='boolean'||h.source==='global'&&(!key(p.fbKey)||seen.has(p.fbKey)))throw Error('Cobros incompletos.');if(h.source==='global')seen.add(p.fbKey);}
     if(h.source==='legacy'&&h.payments.length)throw Error('Historial contradictorio.');return{record:r,history:h,globalIds:seen};
    }));return historyMemo.get(id);
   }
   const fields=(row,names)=>[...new Set(names.map(n=>row[n]).filter(v=>v!==undefined&&v!==null&&v!==''))];
   async function links(result,sale,id){
    const specs=[{label:'cliente',domain:'clientes',technical:['clienteFbKey','clienteKey'],legacy:['clienteId','idCliente','cliente','clienteNombre']},{label:'OT',domain:'ordenes_trabajo',technical:['otKey','otFbKey','ordenTrabajoKey','ordenTrabajoFbKey'],legacy:['otId','otNumero','ordenTrabajoId','ot']},{label:'presupuesto',domain:'presupuestos',technical:['presupuestoFbKey','presupuestoKey'],legacy:['presupuestoId','presupuesto','pptoId']}];
    const settled=await Promise.allSettled(specs.map(async spec=>{check();const refs=fields(sale,spec.technical);
     if(!refs.length){if(fields(sale,spec.legacy).length)issue(result,'Referencia histórica de '+spec.label+' sin clave técnica verificable.',true);return;}
     if(refs.length!==1||!key(refs[0])){issue(result,'Claves de '+spec.label+' inválidas o contradictorias.');return;}
     let original;try{original=await point('sisventas/'+spec.domain+'/'+refs[0]);}catch(error){check();issue(result,'No se pudo verificar '+spec.label+'.',true);return;}
     if(original===null){issue(result,'No existe el '+spec.label+' declarado.');return;}if(!plain(original)||original._svListSummary||original._svPagedSummary||original.fbKey!=null&&original.fbKey!==refs[0]){issue(result,'Original de '+spec.label+' incompleto.',true);return;}
     if(spec.domain!=='clientes'){
      const back=fields(original,['ventaFbKey','ventaKey','ventaGeneradaFbKey','ventaOrigenFbKey']);if(back.some(v=>v!==id))issue(result,spec.label+' apunta a otra venta.');
      if(!back.length&&fields(original,['ventaId','venta','idVenta','numeroVenta']).length)issue(result,'Contravínculo histórico de '+spec.label+' sin clave técnica verificable.',true);
      const ownClient=fields(sale,['clienteFbKey','clienteKey']),otherClient=fields(original,['clienteFbKey','clienteKey']);if(ownClient.length===1&&otherClient.some(v=>v!==ownClient[0]))issue(result,'Cliente distinto en '+spec.label+'.');
      if(ownClient.length===1&&!otherClient.length&&fields(original,['clienteId','idCliente','cliente','clienteNombre']).length)issue(result,'Cliente histórico de '+spec.label+' sin clave técnica verificable.',true);
     }
     result.checks.push('Original de '+spec.label+' consultado por clave técnica.');
    }));const rejected=settled.find(job=>job.status==='rejected');if(rejected)throw rejected.reason;
   }
   async function saleResult(row,result){const answer=await saleHistory(row.key);result.checks.push('Venta original e historial autorizados por servidor.');if(answer.history.source==='legacy'&&answer.history.paidAmount>0)issue(result,'El saldo histórico no tiene detalle individual de cobros.',true);await links(result,answer.record,row.key);}
   async function paymentResult(row,result){
    let saleKey=row.saleKey;if(!saleKey){const original=await point('sisventas/pagos/'+row.key);if(original===null){issue(result,'El cobro enumerado ya no existe.');return;}if(!plain(original)||original._svListSummary||original._svPagedSummary){issue(result,'Original del cobro incompleto.',true);return;}
     const refs=fields(original,['ventaFbKey','ventaKey','ventaGeneradaFbKey','ventaOrigenFbKey']);if(refs.length!==1||!key(refs[0])){issue(result,'Cobro sin vínculo técnico inequívoco con una venta.');return;}saleKey=refs[0];
    }
    if(!key(saleKey)){issue(result,'Clave de venta del cobro inválida.');return;}const answer=await saleHistory(saleKey);
    if(answer.history.source!=='global'||!answer.globalIds.has(row.key)){issue(result,'El historial autorizado no confirma este cobro global.');return;}
    result.checks.push('Identidad exacta del cobro confirmada por historial servidor, incluidos anulados.');
   }
   async function batch(kind,rows){let at=0;const workers=Array.from({length:Math.min(6,rows.length)},async()=>{for(;;){check();const n=at++;if(n>=rows.length)return;const row=rows[n],result={key:row.key,label:(kind==='sales'?'Venta ':'Cobro ')+String(row.number||row.saleNumber||row.key),status:'ok',issues:[],checks:[]};try{if(kind==='sales')await saleResult(row,result);else await paymentResult(row,result);}catch(error){check();issue(result,'No se pudo completar la lectura autorizada del registro.',true);}check();results.push(result);checked++;progress();}});const settled=await Promise.allSettled(workers);const rejected=settled.find(s=>s.status==='rejected');if(rejected)throw rejected.reason;}
   try{
    check();const expected=counts(await io(()=>reader.totals()));total=expected.sales+expected.payments;progress();
    for(const kind of ['sales','payments']){let cursor=null,count=0;const seen=new Set();
     for(;;){const page=await io(()=>reader.page(kind,{cursor,expectedRevision:pin.revision,take:50,filters:{},scopeName:'all',...(kind==='payments'?{native:true}:{})}));checkPin(page);
      if(!Array.isArray(page.rows)||page.rows.length>50||typeof page.hasMore!=='boolean')throw Error('Página incompleta.');
      for(const row of page.rows){if(!plain(row)||!key(row.key)||seen.has(row.key))throw Error('Identidad de página inválida.');seen.add(row.key);}
      count+=page.rows.length;if(count>expected[kind])throw Error('Cantidad de página contradictoria.');await batch(kind,page.rows);
      if(!page.hasMore)break;if(!page.rows.length||typeof page.cursor!=='string'||!page.cursor||page.cursor===cursor)throw Error('No se pudo confirmar el final del listado.');cursor=page.cursor;
     }if(count!==expected[kind])throw Error('Faltan registros del listado.');
    }
    const after=counts(await io(()=>reader.totals()));if(after.sales!==expected.sales||after.payments!==expected.payments)throw Error('La cobertura cambió.');check();
   }catch(error){failed=true;}
   return{kind:'sales',...(failed&&checked>0?{partial:true,interrupted:true}:{}),complete:!failed&&checked===total&&!results.some(r=>r.status==='unavailable'),checked,total,results,reads};
  }
  return Object.freeze({snapshot(){return snapshot?snapshot():null;},run(){if(running)return running;running=execute().finally(()=>{running=null;});return running;}});
 }
 return Object.freeze({create});
});
