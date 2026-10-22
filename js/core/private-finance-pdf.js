(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVPrivateFinancePDF=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 function decimal(s){s=String(s).trim();if(!/^-?(?:\d+(?:\.\d{3})*|\d+),\d{2}$/.test(s))return null;const negative=s[0]==='-';const parts=s.replace('-','').replaceAll('.','').split(',');const value=Number(BigInt(parts[0])*100n+BigInt(parts[1]));return Number.isSafeInteger(value)&&value<=1e13?(negative?-value:value):null;}
 const iso=s=>{const m=String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return null;const d=m[3]+'-'+m[2]+'-'+m[1],dt=new Date(d+'T12:00:00Z');return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===d?d:null;};
 const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 function sectionDate(value){
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return iso(value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4));
  const m=value.match(/^(\d{2})[/-]([\p{L}\d]+)[/-](\d{2}|\d{4})$/u);if(!m)return null;
  const months={ene:'01',jan:'01',feb:'02',mar:'03',abr:'04',apr:'04',may:'05',jun:'06',jul:'07',ago:'08',aug:'08',sep:'09',set:'09',oct:'10',nov:'11',dic:'12',dec:'12'},month=/^\d{2}$/.test(m[2])?m[2]:months[normalized(m[2]).slice(0,3)],year=m[3].length===4?m[3]:(Number(m[3])>=70?'19':'20')+m[3];
  return month?iso(m[1]+'/'+month+'/'+year):null;
 }
 function debitEvidence(pages){
  const proofs=[];
  pages.forEach((content,index)=>{
   let active=false,pending=null;
   function flush(){
    if(!pending)return;const matches=[...pending.text.matchAll(/(?:^|\s)(-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})(?=\s|$)/g)];
    if(matches.length===1){const last=matches[0],end=last.index+last[0].length,after=pending.text.slice(end).trim(),amount=decimal(last[1]),description=pending.text.slice(0,last.index).replace(/(?:ARS|USD|U\$S|US\$|\$)\s*$/i,'').trim();
     if(pending.date&&description&&amount>0&&/^(?:ARS|USD|U\$S|US\$)?$/i.test(after))proofs.push({date:pending.date,description,amount,page:index+1,section:'Débitos automáticos'});
    }pending=null;
   }
   for(const raw of content.split(/\r?\n/)){
    const line=raw.trim().replace(/\s+/g,' ');if(!line)continue;
    if(/^debitos?\s+(?:automaticos?|directos?)\s*:?$/i.test(line.normalize('NFD').replace(/[\u0300-\u036f]/g,''))){flush();active=true;continue;}
    if(!active)continue;
    if(/^(?:compras|cuotas|pagos|resumen|saldo|saldos|subtotal|total|detalle|intereses|impuestos|informacion|percepciones|tasas)\b/i.test(line.normalize('NFD').replace(/[\u0300-\u036f]/g,''))){flush();active=false;continue;}
    const entry=line.match(/^(\d{4}-\d{2}-\d{2}|\d{2}[/-](?:\d{2}|[\p{L}]{3,12})[/-]\d{2,4})(?:\s+|$)(.*)$/u);
    if(entry){flush();pending={date:sectionDate(entry[1]),text:entry[2]};}else if(pending)pending.text+=' '+line;
   }flush();
  });return proofs;
 }
 function classifyAutomaticDebits(reading,proofs=[]){
  const matches=(m,p)=>m.page===p.page&&m.date===p.date&&m.amount===p.amount&&normalized(m.concept).length>=4&&normalized(p.description).startsWith(normalized(m.concept))&&/^\d*$/.test(normalized(p.description).slice(normalized(m.concept).length));
  return {...reading,movements:reading.movements.map(m=>{
   if(m.kind!=='Consumo')return m;
   const evidence=proofs.filter(p=>matches(m,p));if(evidence.length!==1)return m;
   if(reading.movements.filter(candidate=>matches(candidate,evidence[0])).length!==1)return m;
   return {...m,kind:'Débito a confirmar',classificationSource:'PDF · sección de débitos automáticos'};
  })};
 }

 // Contraste local con rótulos y columnas explícitos; nunca ajusta para forzar una suma.

 function currencyReferences(positionedPages=[]){
  const proofs=[];
  positionedPages.forEach((items,page)=>{
   const rows=[];for(const item of items){if(!item.str?.trim())continue;const y=Math.round(item.transform[5]);let row=rows.find(r=>Math.abs(r.y-y)<2);if(!row)rows.push(row={y,items:[]});row.items.push(item);}
   const headers=rows.map(r=>{const pesos=r.items.find(i=>/^PESOS$/i.test(i.str.trim())),usd=r.items.find(i=>/^D[OÓ]LARES$/i.test(i.str.trim()));return pesos&&usd&&usd.transform[4]>pesos.transform[4]?{left:pesos.transform[4]-40,boundary:(pesos.transform[4]+pesos.width+usd.transform[4])/2}:null;}).filter(Boolean);
   if(!headers.length||headers.some(h=>Math.abs(h.boundary-headers[0].boundary)>3))return;
   const columns=headers[0];
   for(const row of rows){const sorted=row.items.sort((a,b)=>a.transform[4]-b.transform[4]),line=sorted.map(i=>i.str).join(' ').replace(/\s+/g,' ').trim(),m=line.match(/^(\d{2}-[A-Za-z]+-\d{2})\s+(.+?)\s*\(\s*[A-Z]{2,3}\s*,\s*(ARS|USD)\s*,\s*([\d.,]+)\s*\)/i);if(!m)continue;
    const date=sectionDate(m[1]),reference=decimal(m[4]);if(!date||reference==null)continue;
    const charges=sorted.filter(i=>i.transform[4]>=columns.left&&decimal(i.str.trim())!=null).map(i=>({amount:decimal(i.str.trim()),currency:i.transform[4]+i.width/2>columns.boundary?'USD':'ARS'}));
    if(charges.length===1)proofs.push({date,concept:m[2].trim(),referenceCurrency:m[3].toUpperCase(),reference,charge:charges[0],page:page+1,original:line});
   }
  });return proofs;
 }

 function statementEvidence(pages,positionedPages=[]){
  const proof={pages:pages.length,penalties:[],dates:[],openings:[],netOpenings:[],usdOpenings:[],creditType:null,references:currencyReferences(positionedPages)};
  pages.forEach((content,i)=>{
   let year='',month='';const lines=content.split(/\r?\n/),hasColumns=/PESOS\s+D[OÓ]LARES/i.test(content);
   for(const raw of lines){const line=raw.trim().replace(/\s+/g,' '),plain=line.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const gross=line.match(/^(?:\d{2}\/[\p{L}]+\s+)?Total a pagar del periodo anterior\s+\$\s*([\d.,]+)$/iu),net=line.match(/^Saldo del periodo anterior\s+\$\s*([\d.,]+)$/i);
    const columns=hasColumns&&line.match(/^SALDO ANTERIOR\s+([\d.,]+)\s+([\d.,]+)$/i);if(columns&&decimal(columns[2])!=null)proof.usdOpenings.push({value:decimal(columns[2]),original:line,page:i+1,origin:'PDF'});
    if(gross&&decimal(gross[1])!=null)proof.openings.push({value:decimal(gross[1]),original:line,page:i+1});
    if(net&&decimal(net[1])!=null)proof.netOpenings.push({value:decimal(net[1]),original:line,page:i+1});
    if(/^Tarjeta de cr[eé]dito$/i.test(line))proof.creditType={value:'Crédito',original:line,page:i+1,origin:'PDF'};
    const shortDate=plain.match(/^(\d{2})\/([A-Za-z]+)\s+(.+)$/);
    if(shortDate){const d=sectionDate(shortDate[1]+'/'+shortDate[2]+'/2000'),a=shortDate[3].match(/(-?)\$\s*([\d.,]+)\s*$/);if(d&&a&&decimal(a[2])!=null)proof.dates.push({dayMonth:d.slice(5),page:i+1,amount:(a[1]?-1:1)*decimal(a[2]),line:shortDate[3],original:line});}
    const dated=plain.match(/^(\d{2})\s+([A-Za-z]+)\.?\s+(\d{2})\s+(.+)$/);
    let day,rest;
    if(dated){const d=sectionDate(dated[3]+'/'+dated[2]+'/'+dated[1]);if(!d)continue;year=d.slice(0,4);month=d.slice(5,7);day=dated[3];rest=dated[4];}
    else {const continued=plain.match(/^(\d{2})\s+(.+)$/);if(!continued||!year)continue;day=continued[1];rest=continued[2];}
    const date=iso(day+'/'+month+'/'+year);if(!date)continue;
    const penalty=rest.match(/^(PUNIT\.?\s+PAG\.?\s*MIN\.?\s*ANTERIOR)\s+\$\s+([\d.,]+)\s+([\d.,]+)$/i);
    if(penalty&&decimal(penalty[2])!=null&&decimal(penalty[3])!=null)proof.penalties.push({concept:penalty[1],base:decimal(penalty[2]),amount:decimal(penalty[3]),currency:'ARS',date,page:i+1,original:line});
    const amount=rest.match(/([\d.,]+)(-?)$/);if(amount){const value=decimal(amount[1]);if(value!=null)proof.dates.push({date,page:i+1,amount:amount[2]?-value:value,line:rest,original:line});}
   }
  });return proof;
 }
 function reconcileEvidence(reading,proof={}){
  const result={...reading,...(Number.isInteger(proof.pages)&&proof.pages>0?{pages:proof.pages}:{}),fields:{...reading.fields},movements:reading.movements.map(m=>({...m})),warnings:[...(reading.warnings||[])]};
  for(const p of proof.references||[]){
   const matching=m=>m.page===p.page&&m.date===p.date&&normalized(m.concept).startsWith(normalized(p.concept));
   const charged=result.movements.filter(m=>matching(m)&&m.currency===p.charge.currency&&m.amount===p.charge.amount);
   const phantom=result.movements.filter(m=>matching(m)&&m.currency===p.referenceCurrency&&m.amount===p.reference);
   if(charged.length===1&&phantom.length===1&&charged[0]!==phantom[0])result.movements=result.movements.filter(m=>m!==phantom[0]);
  }
  for(const p of proof.penalties||[]){
   const key=normalized(p.concept),match=m=>m.page===p.page&&normalized(m.concept).replace(/usd$/,'')===key;
   const candidates=result.movements.filter(match);
   if(!candidates.length||candidates.some(m=>![p.base,p.amount].includes(m.amount))||candidates.length>2||new Set(candidates.map(m=>m.currency)).size!==candidates.length)continue;
   result.movements=result.movements.filter(m=>!match(m));result.movements.push({...candidates[0],date:p.date,currency:p.currency,amount:p.amount,kind:'Interés',concept:p.concept,dateSource:'documento',amountSource:{page:p.page,original:p.original,origin:'PDF · columna de importe'}});
  }
  for(const m of result.movements){
   const matches=(proof.dates||[]).filter(p=>p.page===m.page&&p.amount===m.amount&&normalized(p.line).includes(normalized(m.concept)));
   if(matches.length===1&&(matches[0].date||m.date?.slice(5)===matches[0].dayMonth)){m.date=matches[0].date||m.date;m.dateSource='documento';m.dateEvidence={date:m.date,page:matches[0].page,original:matches[0].original};}
  }
  const usdOpenings=proof.usdOpenings||[];if(!result.fields.previousUSD&&usdOpenings.length===1)result.fields.previousUSD={...usdOpenings[0]};
  const opening=proof.openings||[],net=proof.netOpenings||[],prior=result.fields.previous;
  if(opening.length===1&&prior&&[opening[0].value,...net.map(p=>p.value)].includes(prior.value)){
   const p=opening[0],header=m=>m.currency==='ARS'&&m.amount===p.value&&normalized(m.concept)==='totalapagardelperiodoanterior';
   result.fields.previous={...p,origin:'PDF · saldo inicial antes de pagos'};result.movements=result.movements.filter(m=>!header(m));
  }
  if(!result.fields.brand&&proof.creditType&&normalized(result.fields.bank?.value)==='mercadopago')result.fields.brand={...proof.creditType};
  return result;
 }

 // El año ausente se resuelve contra el ciclo, no contra una suposición de la IA.
 function calendar(reading,referenceDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
  const result=structuredClone(reading),fields=result.fields||{},explicit=f=>!!f&&/(?:\b(?:19|20)\d{2}\b|\b\d{2}[/-][\p{L}\d]+[/-]\d{2}\b|\b\d{2}\s+[\p{L}]+\.?\s+\d{2}\b)/u.test(f.original||'');
  const p=fields.period?.value,close=fields.close?.value,due=fields.due?.value;
  if(!close||!/^\d{4}-\d{2}-\d{2}$/.test(close))return result;
  const anchor=p||close.slice(0,7),month=Number(anchor.slice(5,7)),currentYear=Number(referenceDate.slice(0,4)),currentMonth=Number(referenceDate.slice(5,7));
  const printed=explicit(fields.period)?Number(p?.slice(0,4)):explicit(fields.close)?Number(close.slice(0,4))+(Number(close.slice(5,7))>month?1:0):explicit(fields.due)?Number(due.slice(0,4))-(Number(due.slice(5,7))<month?1:0):null;
  const year=printed??currentYear-(month>currentMonth?1:0),closeYear=year-(Number(close.slice(5,7))>month?1:0);
  const atYear=(value,y)=>{const next=String(y)+value.slice(4);if(!iso(next.slice(8,10)+'/'+next.slice(5,7)+'/'+next.slice(0,4)))throw Error('La fecha del resumen no es válida para su año. Revisá el original.');return next;};
  const set=(key,value)=>{if(fields[key]&&fields[key].value!==value){if(explicit(fields[key]))throw Error('Las fechas impresas del resumen no coinciden. Revisá el original.');fields[key]={...fields[key],value,inferred:true,unit:'Año según el ciclo del resumen'};}};
  set('close',atYear(close,closeYear));
  if(p)set('period',String(year)+p.slice(4));
  if(due)set('due',atYear(due,closeYear+(due.slice(5)<close.slice(5)?1:0)));
  for(const key of ['nextClose','nextDue']){const f=fields[key];if(!f||explicit(f))continue;const anchor=key==='nextDue'&&fields.nextClose?fields.nextClose.value:fields.close.value;set(key,atYear(f.value,Number(anchor.slice(0,4))+(f.value.slice(5)<anchor.slice(5)?1:0)));}

  result.movements=(result.movements||[]).map(m=>{
   if(!m.date)return m;
   // Los años explícitos de cada movimiento nunca se sustituyen.
   const original=m.dateEvidence?.original||'';
   if(/^(?:\d{4}-\d{2}-\d{2}|\d{2}[/-][\p{L}\d]+[/-]\d{2,4}\b|\d{2}\s+[\p{L}]+\.?\s+\d{2}\b|\d{1,2}\s+de\s+[\p{L}]+\s+de\s+\d{4}\b)/u.test(original))return m;
   const afterCloseMonth=Number(m.date.slice(5,7))>Number(close.slice(5,7));
   const next=m.dateSource==='cierre'?fields.close.value:atYear(m.date,closeYear-(afterCloseMonth?1:0));
   return {...m,date:next,...(m.dateEvidence?{dateEvidence:{...m.dateEvidence,date:next}}:{})};
  });
  return result;
 }
 // Sólo rótulos explícitos. No deduce un próximo cierre a partir de una fecha suelta.
 function cycleEvidence(pages,anchor){
  const found={nextClose:[],nextDue:[]},warnings=[],ambiguous=[];
  const months={enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',setiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
  pages.forEach((page,i)=>{const lines=page.split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' '));for(let n=0;n<lines.length;n++){
   const m=lines[n].normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/^(?:fecha (?:de )?)?proxim[oa]\s+(cierre|vencimiento)\s*:?\s*(.*)$/i);if(!m)continue;
   const raw=m[2]||lines[n+1]||'',key=m[1].toLowerCase()==='cierre'?'nextClose':'nextDue';let value=sectionDate(raw),inferred=false;
   if(!value){const d=raw.toLowerCase().match(/^(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?$/);if(d&&months[d[2]]){const year=d[3]||anchor?.slice(0,4);if(year){value=iso(d[1].padStart(2,'0')+'/'+months[d[2]]+'/'+year);inferred=!d[3];}}}
   if(value)found[key].push({value,original:lines[n]+(!m[2]?' '+raw:''),page:i+1,origin:'PDF',...(inferred?{inferred:true}:{} )});
  }});
  const fields={};for(const key of ['nextClose','nextDue']){const values=found[key];if(new Set(values.map(x=>x.value)).size>1){ambiguous.push(key);warnings.push('Hay fechas diferentes para '+key+'; revisá el próximo ciclo.');}else if(values.length)fields[key]=values[0];}
  for(const key of ['nextClose','nextDue']){const f=fields[key],base=key==='nextDue'&&fields.nextClose?fields.nextClose.value:anchor;if(f?.inferred&&base)f.value=String(Number(base.slice(0,4))+(f.value.slice(5)<base.slice(5)?1:0))+f.value.slice(4);}
  return {fields,warnings,ambiguous};
 }
 function mergeCycleEvidence(reading,evidence){
  const out=structuredClone(reading);out.fields||={};out.warnings||=[];
  for(const key of ['nextClose','nextDue']){const local=evidence?.fields?.[key],ai=out.fields[key];if(evidence?.ambiguous?.includes(key)){delete out.fields[key];}else if(local&&ai&&local.value!==ai.value){delete out.fields[key];out.warnings.push('El próximo ciclo difiere del texto del PDF; revisalo manualmente.');}else if(local)out.fields[key]=local;}
  out.warnings.push(...(evidence?.warnings||[]));return out;
 }
 function parse(pages,positionedPages=[]){
  const result={fields:{},movements:[],warnings:[],pages:pages.length,automaticDebits:debitEvidence(pages),statementEvidence:statementEvidence(pages,positionedPages)},ambiguous=new Set();
  const labels={previous:/^saldo anterior(?: (?:ars|pesos))?\s*[:$]*\s*(-?[\d.,]+)$/i,total:/^saldo (?:actual|al cierre)(?: (?:ars|pesos))\s*[:$]*\s*(-?[\d.,]+)$/i,usd:/^saldo (?:actual|al cierre) (?:usd|d[oó]lares)\s*[:$]*\s*(-?[\d.,]+)$/i,minimum:/^pago m[ií]nimo(?: (?:ars|pesos))?\s*[:$]*\s*([\d.,]+)$/i,close:/^(?:fecha de )?cierre\s*:?\s*(\d{2}\/\d{2}\/\d{4})$/i,due:/^(?:fecha de )?vencimiento\s*:?\s*(\d{2}\/\d{2}\/\d{4})$/i,period:/^per[ií]odo\s*:?\s*(\d{4}-(?:0[1-9]|1[0-2]))$/i,tem:/^tem\s*:?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%$/i};
  labels.tna=/^tna\s*:?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%$/i;labels.cft=/^cft(?:ea)?\s*:?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%$/i;
  pages.forEach((content,page)=>{for(const raw of content.split(/\r?\n/)){const line=raw.trim().replace(/\s+/g,' ');for(const [key,re]of Object.entries(labels)){const m=line.match(re);if(!m||ambiguous.has(key))continue;let value=['close','due'].includes(key)?iso(m[1]):key==='period'?m[1]:['tem','tna','cft'].includes(key)?Number(m[1].replace(',','.')):decimal(m[1]);if(value==null)continue;if(result.fields[key]&&result.fields[key].value!==value){result.warnings.push('Hay valores diferentes para '+key+'; revisar contra el original');ambiguous.add(key);delete result.fields[key];continue;}result.fields[key]={value,original:raw,page:page+1,origin:'PDF',unit:key==='tem'?'Porcentaje mensual':key==='tna'?'Porcentaje nominal anual':key==='cft'?'Porcentaje; periodicidad a confirmar en el PDF':''};}
   const movement=line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(ARS|USD)\s+(-?[\d.,]+)$/);if(movement){const amount=decimal(movement[4]),date=iso(movement[1]);if(amount!=null&&date)result.movements.push({date,concept:movement[2],currency:movement[3],amount,page:page+1,kind:/pago/i.test(movement[2])&&amount<0?'Pago del período anterior':/seguro/i.test(movement[2])?'Débito a confirmar':/inter[eé]s/i.test(movement[2])?'Interés':/impuesto|percepci[oó]n|iva/i.test(movement[2])?'Impuesto':'Consumo',origin:'PDF'});}
  }});
  result.cycleEvidence=cycleEvidence(pages,result.fields.close?.value);Object.assign(result.fields,result.cycleEvidence.fields);result.warnings.push(...result.cycleEvidence.warnings);
  result.warnings.push('Extracción conservadora: los campos no reconocidos quedan pendientes. Revisá saldos y movimientos; no es un lector universal de bancos.');return result;
 }
 async function open(bytes){
  const pdfjs=await import('../vendor/pdfjs/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',typeof document==='object'?document.currentScript?.src||new URL('js/core/private-finance-pdf.js',location.href):'http://localhost/').href;
  return pdfjs.getDocument({data:new Uint8Array(bytes.slice(0)),isEvalSupported:false,useSystemFonts:true,stopAtErrors:true}).promise;
 }
 async function extract(bytes){
  const pdf=await open(bytes);
  try{if(pdf.numPages>150)throw Error('El PDF supera 150 páginas');const pages=[],positionedPages=[];for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),content=await p.getTextContent(),lines=[];positionedPages.push(content.items);let y=null,line=[];for(const item of content.items){if(!('str'in item))continue;const next=Math.round(item.transform[5]);if(y!=null&&Math.abs(y-next)>3){lines.push(line.join(' '));line=[];}line.push(item.str);y=next;if(item.hasEOL){lines.push(line.join(' '));line=[];y=null;}}if(line.length)lines.push(line.join(' '));pages.push(lines.join('\n'));}const result=parse(pages,positionedPages);if(!pages.some(p=>p.trim().length>30))result.warnings.unshift('No hay texto suficiente: archivo escaneado u OCR necesario. Completá manualmente.');return result;}finally{await pdf.destroy();}
 }
 return {cycleEvidence,mergeCycleEvidence,decimal,parse,extract,open,debitEvidence,classifyAutomaticDebits,statementEvidence,reconcileEvidence,currencyReferences,calendar};
});
