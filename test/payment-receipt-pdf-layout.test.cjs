'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readActiveApp}=require('./helpers/active-app');
const source=readActiveApp().source;
const start=source.indexOf('function imprimirRecibo()'),end=source.indexOf('\nfunction crearOT(',start);
assert.ok(start>=0&&end>start);
function receipt(payment={}){
 let html='';const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const c={window:{_ultimoPago:{fbKey:'p-ficticio',venta:'V-FICTICIA',cliente:'Cliente ficticio',fecha:'2026-10-22',medio:'Efectivo',monto:100,totalVenta:1000,saldoAnterior:650,saldoRestante:550,...payment},_ultimoPagoVenta:{},open:()=>({document:{write:s=>{html=s;},close(){}},location:{replace(){}}})},document:{getElementById:()=>({value:''})},logoImpresionActualUrl:()=>'',escapeHTML:esc,nombreClienteVigente:p=>p.cliente,formatoMedioPago:v=>v,notify:message=>{throw Error(message);},Blob,URL:{createObjectURL:()=> 'blob:ficticio',revokeObjectURL(){}},setTimeout(){}};
 vm.runInNewContext(source.slice(start,end)+'\nimprimirRecibo();',c);
 const script=html.match(/<script>(async function pdfRecibo[\s\S]+?)<\/script>/)?.[1];assert.ok(script);return{html,script};
}
function exporter({share=false,canShare=true,opener=true,missing=false,fail=false,decodeFails=false,payment={}}={}){
 const generated=receipt(payment),events=[],pdfBlob=new Blob(['fictitious complete PDF'],{type:'application/pdf'}),original={style:{minHeight:'297mm',height:'',margin:'20px auto'},actionsPresent:true};
 let clone;original.cloneNode=deep=>{assert.equal(deep,true);events.push('clone');return clone={style:{...original.style},content:payment.obs||'',querySelectorAll(selector){assert.equal(selector,'.acciones-recibo,[data-html2canvas-ignore]');return[{remove(){events.push('remove-actions');}}];}};};const button={disabled:false};
 const c={Promise,Blob,File:class{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options.type;}},document:{images:[{decode:async()=>{events.push('decode');if(decodeFails)throw Error('Fictitious missing logo');}}],getElementById:()=>missing?null:original,createElement:()=>({click(){events.push('anchor');},remove(){}}),body:{appendChild(){}}},navigator:share?{canShare:()=>canShare,share:async value=>{c.shared=value;events.push('share');}}:{},window:{opener:opener?{closed:false,_svDescargarBlobPresupuesto:async(blob,name)=>{c.download={blob,name};events.push('download');}}:null},URL:{createObjectURL:blob=>{c.anchorBlob=blob;return'blob:ficticio';},revokeObjectURL(){}},setTimeout(){},alert:message=>{(c.alerts??=[]).push(message);},html2pdf:()=>({set(options){c.options=options;return this;},from(element){c.element=element;return this;},async outputPdf(type){assert.equal(type,'blob');events.push('pdf');if(fail)throw Error('Fictitious PDF error');return pdfBlob;}})};
 vm.runInNewContext(generated.script,c);
 return{...generated,c,original,button,pdfBlob,events,get clone(){return clone;},run:()=>c.pdfRecibo(share,button)};
}
test('export removes A4 preview floor and actions only from a deep clone',async()=>{
 const f=exporter();await f.run();assert.equal(f.c.element,f.clone);assert.notEqual(f.c.element,f.original);
 assert.deepEqual(f.clone.style,{minHeight:'0',height:'auto',margin:'0',paddingBottom:'0',display:'block'});assert.deepEqual(f.original.style,{minHeight:'297mm',height:'',margin:'20px auto'});assert.equal(f.original.actionsPresent,true);
 assert.deepEqual(f.events,['decode','clone','remove-actions','pdf','download']);assert.equal(f.c.options.margin,0);assert.equal(f.c.options.jsPDF.format,'a4');assert.equal(f.button.disabled,false);
});
for(const share of [false,true])test((share?'share':'download')+' delivers the generated blob unchanged',async()=>{
 const f=exporter({share});await f.run();assert.equal(f.events.filter(e=>e==='pdf').length,1);
 if(share){assert.equal(f.c.shared.files[0].parts[0],f.pdfBlob);assert.equal(f.c.shared.files[0].type,'application/pdf');assert.equal(f.c.download,undefined);}else assert.equal(f.c.download.blob,f.pdfBlob);
});
test('unsupported sharing falls back to the same generated PDF and restores the button',async()=>{
 const f=exporter({share:true,canShare:false});await f.run();assert.equal(f.c.download.blob,f.pdfBlob);assert.match(f.c.alerts[0],/Se descargará/);assert.equal(f.button.disabled,false);
});
test('without opener download still uses the original full PDF blob',async()=>{
 const f=exporter({opener:false});await f.run();assert.equal(f.c.anchorBlob,f.pdfBlob);assert.ok(f.events.includes('anchor'));
});
test('long observations remain in the export clone without clipping or deleting PDF pages',async()=>{
 const obs='Observación ficticia larga. '.repeat(600),f=exporter({payment:{obs}});await f.run();assert.equal(f.clone.content,obs);assert.ok(f.html.includes(obs));assert.equal(f.clone.style.maxHeight,undefined);assert.equal(f.clone.style.overflow,undefined);assert.doesNotMatch(f.script,/deletePage|setPage|slice\(/);
});
test('print removes the A4 minimum while preserving natural height and hidden actions',()=>{
 const {html}=receipt();assert.match(html,/@media print\{[^}]+\}\.recibo\{margin:0;border:none;min-height:0;height:auto;padding-bottom:0;display:block\}/);assert.match(html,/\.acciones-recibo\{display:none\}/);assert.doesNotMatch(html,/max-height:|overflow:hidden/);
});
test('USD conversion and historical balances remain unchanged in the receipt',()=>{
 const {html}=receipt({moneda:'USD',montoUSD:10,tipoCambio:10,cotizacionTipo:'manual'});for(const text of ['USD 10,00','ARS/USD','$1.000,00 ARS','$550,00 ARS','Cotización aplicada'])assert.ok(html.includes(text),text);
});
for(const fault of ['missing','fail'])test(fault+' export failure restores its button and produces no download',async()=>{
 const f=exporter({[fault]:true});await f.run();assert.equal(f.button.disabled,false);assert.equal(f.c.download,undefined);assert.ok(f.c.alerts.length);
});
test('a failed logo decode does not prevent exporting the complete receipt',async()=>{
 const f=exporter({decodeFails:true});await f.run();assert.equal(f.c.download.blob,f.pdfBlob);assert.equal(f.button.disabled,false);
});
