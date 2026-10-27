'use strict';
// Read-only selection: no network, provider lookup or financial mutation.
const fail=(statusCode,code,message)=>Object.assign(Error(message||'El PDF no está disponible.'),{statusCode,code});
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const safeKey=v=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v)<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
function reference(kind,reference){
 if(!['factura','nota-credito','adicional','historial-factura','historial-nota-credito'].includes(kind))throw fail(400,'SV_FISCAL_REFERENCE');
 if(['factura','nota-credito'].includes(kind)){if(reference!==undefined&&reference!=='')throw fail(400,'SV_FISCAL_REFERENCE');return {kind};}
 if(kind==='adicional'){if(!safeKey(reference))throw fail(400,'SV_FISCAL_REFERENCE');return {kind,reference};}
 if(typeof reference!=='string'||!/^(0|[1-9]\d{0,3})$/.test(reference))throw fail(400,'SV_FISCAL_REFERENCE');return {kind,reference:Number(reference)};
}
function invoiceFor(raw,selector){
 const {kind,reference:id}=reference(selector?.kind,selector?.reference);
 if(kind==='factura')return raw?.factura;
 if(kind==='nota-credito')return raw?.notaCredito;
 if(kind==='adicional')return object(raw?.facturasAdicionales)&&Object.hasOwn(raw.facturasAdicionales,id)?raw.facturasAdicionales[id]:null;
 const entry=Array.isArray(raw?.historialFiscal)?raw.historialFiscal[id]:null;
 return kind==='historial-factura'?entry?.factura:entry?.notaCredito;
}
function safeSource(value){
 if(typeof value!=='string'||value.length>3*1024*1024)return null;
 if(/^data:/i.test(value)){
  const match=value.match(/^data:application\/(?:pdf|octet-stream);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if(!match||match[1].length%4!==0)return null;
  const bytes=Buffer.from(match[1],'base64');
  if(bytes.length>2*1024*1024||bytes.subarray(0,5).toString('ascii')!=='%PDF-')return null;
  return {data:'data:application/pdf;base64,'+bytes.toString('base64')};
 }
 if(value.length>16384||/[\x00-\x20\x7f]/.test(value))return null;
 try{const url=new URL(value);if(url.protocol!=='https:'||!url.hostname||url.username||url.password)return null;return {url:url.href};}catch(_){return null;}
}
function selectDocument(raw,selector){
 const invoice=invoiceFor(raw,selector);if(!object(invoice))throw fail(404,'SV_FISCAL_DOCUMENT_MISSING');
 const attachment=object(invoice.comprobante)?invoice.comprobante:null;
 const candidates=[attachment?.data,attachment?.url,invoice.comprobante_pdf_url,invoice.pdf_url,invoice.pdfUrl];
 let source;for(const value of candidates){source=safeSource(value);if(source)break;}
 if(!source){
  const snapshot=invoice.datos_fiscales,Schema=require('./commercial-public-schema');
  if(selector.kind==='factura'&&invoice.fuente!=='externa'&&invoice.manual!==true&&object(snapshot)&&snapshot.cae&&(!invoice.cae||String(invoice.cae)===String(snapshot.cae))&&Array.isArray(snapshot.detalle)&&snapshot.detalle.length&&Number.isFinite(Number(snapshot.total))&&Number(snapshot.total)>=0&&Schema.project(snapshot,Schema.FISCAL).complete){
   return {document:{render:'fiscal-snapshot',factura:Schema.project(invoice,Schema.INVOICE).value,nombre:'Copia-fiscal.pdf',tipo:'application/pdf'}};
  }
  throw fail(404,'SV_FISCAL_DOCUMENT_MISSING','Esta factura no conserva un PDF disponible.');
 }
 const name=String(attachment?.nombre||invoice.archivoNombre||'Factura.pdf').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g,'_').slice(0,160)||'Factura.pdf';
 return {document:{...source,nombre:name,tipo:'application/pdf'}};
}
module.exports={reference,invoiceFor,safeSource,selectDocument};
