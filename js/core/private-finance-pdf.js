(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVPrivateFinancePDF=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 function decimal(s){s=String(s).trim();if(!/^-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}$/.test(s))return null;const negative=s[0]==='-';const parts=s.replace('-','').replaceAll('.','').split(',');const value=Number(BigInt(parts[0])*100n+BigInt(parts[1]));return Number.isSafeInteger(value)&&value<=1e13?(negative?-value:value):null;}
 const iso=s=>{const m=String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return null;const d=m[3]+'-'+m[2]+'-'+m[1],dt=new Date(d+'T12:00:00Z');return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===d?d:null;};
 function parse(pages){
  const result={fields:{},movements:[],warnings:[],pages:pages.length},ambiguous=new Set();
  const labels={previous:/^saldo anterior(?: (?:ars|pesos))?\s*[:$]*\s*(-?[\d.,]+)$/i,total:/^saldo (?:actual|al cierre)(?: (?:ars|pesos))\s*[:$]*\s*(-?[\d.,]+)$/i,usd:/^saldo (?:actual|al cierre) (?:usd|d[oó]lares)\s*[:$]*\s*(-?[\d.,]+)$/i,minimum:/^pago m[ií]nimo(?: (?:ars|pesos))?\s*[:$]*\s*([\d.,]+)$/i,close:/^(?:fecha de )?cierre\s*:?\s*(\d{2}\/\d{2}\/\d{4})$/i,due:/^(?:fecha de )?vencimiento\s*:?\s*(\d{2}\/\d{2}\/\d{4})$/i,period:/^per[ií]odo\s*:?\s*(\d{4}-(?:0[1-9]|1[0-2]))$/i,tem:/^tem\s*:?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%$/i};
  labels.tna=/^tna\s*:?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%$/i;labels.cft=/^cft(?:ea)?\s*:?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%$/i;
  pages.forEach((content,page)=>{for(const raw of content.split(/\r?\n/)){const line=raw.trim().replace(/\s+/g,' ');for(const [key,re]of Object.entries(labels)){const m=line.match(re);if(!m||ambiguous.has(key))continue;let value=['close','due'].includes(key)?iso(m[1]):key==='period'?m[1]:['tem','tna','cft'].includes(key)?Number(m[1].replace(',','.')):decimal(m[1]);if(value==null)continue;if(result.fields[key]&&result.fields[key].value!==value){result.warnings.push('Hay valores diferentes para '+key+'; revisar contra el original');ambiguous.add(key);delete result.fields[key];continue;}result.fields[key]={value,original:raw,page:page+1,origin:'PDF',unit:key==='tem'?'Porcentaje mensual':key==='tna'?'Porcentaje nominal anual':key==='cft'?'Porcentaje; periodicidad a confirmar en el PDF':''};}
   const movement=line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(ARS|USD)\s+(-?[\d.,]+)$/);if(movement){const amount=decimal(movement[4]),date=iso(movement[1]);if(amount!=null&&date)result.movements.push({date,concept:movement[2],currency:movement[3],amount,page:page+1,kind:/pago/i.test(movement[2])&&amount<0?'Pago del período anterior':/seguro/i.test(movement[2])?'Débito a confirmar':/inter[eé]s/i.test(movement[2])?'Interés':/impuesto|percepci[oó]n|iva/i.test(movement[2])?'Impuesto':'Consumo',origin:'PDF'});}
  }});
  result.warnings.push('Extracción conservadora: los campos no reconocidos quedan pendientes. Revisá saldos y movimientos; no es un lector universal de bancos.');return result;
 }
 async function open(bytes){
  const pdfjs=await import('../vendor/pdfjs/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.min.mjs',typeof document==='object'?document.currentScript?.src||new URL('js/core/private-finance-pdf.js',location.href):'http://localhost/').href;
  return pdfjs.getDocument({data:new Uint8Array(bytes.slice(0)),isEvalSupported:false,useSystemFonts:true,stopAtErrors:true}).promise;
 }
 async function extract(bytes){
  const pdf=await open(bytes);
  try{if(pdf.numPages>150)throw Error('El PDF supera 150 páginas');const pages=[];for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),content=await p.getTextContent(),lines=[];let y=null,line=[];for(const item of content.items){if(!('str'in item))continue;const next=Math.round(item.transform[5]);if(y!=null&&Math.abs(y-next)>3){lines.push(line.join(' '));line=[];}line.push(item.str);y=next;if(item.hasEOL){lines.push(line.join(' '));line=[];y=null;}}if(line.length)lines.push(line.join(' '));pages.push(lines.join('\n'));}const result=parse(pages);if(!pages.some(p=>p.trim().length>30))result.warnings.unshift('No hay texto suficiente: archivo escaneado u OCR necesario. Completá manualmente.');return result;}finally{await pdf.destroy();}
 }
 return {decimal,parse,extract,open};
});
