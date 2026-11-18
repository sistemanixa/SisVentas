(function(root,factory){const api=factory(root.document);if(typeof module==='object'&&module.exports)module.exports={create:factory};else root.SVProposalSlide=api;})(typeof window==='object'?window:globalThis,function(document){
 'use strict';
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
 const money=n=>'$ '+Number(n).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
 function slide(d,p){
  const section=node('section','sv-pd-slide'),copy=node('div','sv-pd-copy');section.append(copy);copy.append(node('strong','sv-pd-brand','NIXA'),node('p','','Tecnología para tu espacio'));
  if(p.kind==='cover'){section.classList.add('sv-pd-cover');const src=d.photoURL;if(src){const img=node('img','sv-pd-photo');img.src=src;img.alt='Imagen de la propuesta';img.referrerPolicy='no-referrer';section.prepend(img,node('div','sv-pd-fade'));}const line=node('span','sv-pd-cover-line');line.setAttribute('aria-hidden','true');const date=typeof d.record.fecha==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.record.fecha)?new Date(d.record.fecha+'T12:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'}):'';const heading=node('div','sv-pd-cover-heading sv-pd-text-region'),client=node('div','sv-pd-cover-details sv-pd-text-region');heading.append(node('h1','',p.title),node('p','sv-pd-subtitle',p.subtitle));client.append(node('p','sv-pd-cover-client',p.client),node('p','sv-pd-cover-address',p.address),node('p','sv-pd-cover-meta',p.number+'  |  Presentación'+(date?' · '+date:'')));copy.append(heading,line,client);}
  else if(p.kind==='intro'){section.classList.add('sv-pd-intro');const src=d.photoURL;if(src){const img=node('img','sv-pd-intro-photo');img.src=src;img.alt='Imagen ilustrativa';copy.append(img);}const text=node('div','sv-pd-intro-heading sv-pd-text-region');text.append(node('h2','',p.title),node('p','sv-pd-intro-text',d.overview));copy.append(node('small','sv-pd-kicker','LA PROPUESTA'),text,node('p','sv-pd-intro-address sv-pd-text-region',p.address));}
  else if(p.kind==='items'){section.classList.add('sv-pd-items');copy.append(node('h2','',p.title));const table=node('table'),head=node('tr');head.append(node('th','','Equipos y servicios'),node('th','','Cantidad'));table.append(head);for(const item of p.items){const row=node('tr');row.append(node('td','',item.description),node('td','',item.quantity));table.append(row);}const region=node('div','sv-pd-items-region sv-pd-text-region');region.append(table);copy.append(region);}
  else if(p.kind==='engineering'){section.classList.add('sv-pd-engineering');const text=node('div','sv-pd-engineering-text sv-pd-text-region');text.append(node('h2','',p.title));for(const [i,value]of p.paragraphs.entries())text.append(node('p','sv-pd-engineering-paragraph sv-pd-engineering-paragraph-'+i,value));copy.append(node('small','sv-pd-kicker','CONTINUIDAD DEL PROYECTO'),text);}
  else {section.classList.add('sv-pd-investment');copy.append(node('h2','',p.title),node('p','sv-pd-money-caption','Importes expresados en pesos argentinos'));const table=node('table');for(const [label,value]of [['Subtotal',p.money.ars.subtotal],['Descuento '+p.money.discountPct+'%',-p.money.ars.discount],['IVA',p.money.ars.iva]]){const row=node('tr');row.append(node('td','',label),node('td','',money(value)));table.append(row);}const total=node('div','sv-pd-total');total.append(node('span','sv-pd-total-label','TOTAL'),node('strong','sv-pd-total-value',money(p.money.ars.total)));copy.append(table,total,node('p','sv-pd-equivalent','Equivalencia de referencia: USD '+Number(p.money.usd.total).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})),node('p','sv-pd-exchange','Dólar '+p.exchange.label+' del sistema: '+money(p.exchange.rate)+' por USD'));}
  const foot=node('div','sv-pd-page-note');foot.append(node('span','',p.kind==='engineering'?'Trayectoria y acompañamiento técnico':'Imagen ilustrativa · Alcance según presupuesto'),node('span','',d.dto.number));section.append(foot);return section;
 }
 function fit(section){if(!section?.isConnected)return false;let complete=true;for(const region of section.querySelectorAll('.sv-pd-text-region')){region.style.setProperty('--sv-pd-fit','1');let factor=1;for(let i=0;i<24&&region.scrollHeight>region.clientHeight+1;i++){factor*=.92;region.style.setProperty('--sv-pd-fit',String(factor));}if(region.scrollHeight>region.clientHeight+1)complete=false;}return complete;}

 async function prepareCapture(section){
  if(!section?.isConnected)throw Error('La presentación se cerró.');
  const view=section.ownerDocument.defaultView;
  async function bounded(task,message){let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),15000);})]);}finally{clearTimeout(timer);}}
  if(document.fonts?.ready)await bounded(document.fonts.ready,'No se pudieron cargar las fuentes.');
  for(const img of section.querySelectorAll('img')){await bounded(img.decode(),'No se pudo cargar una imagen de la presentación.');if(!img.naturalWidth)throw Error('Falta una imagen de la presentación.');}
  const backgrounds=new Set();
  for(const n of [section,...section.querySelectorAll('*')])for(const part of [null,'::before','::after']){const value=view.getComputedStyle(n,part).backgroundImage;for(const match of value.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g))backgrounds.add(match[1]||match[2]||match[3]);}
  for(const src of backgrounds){const image=new view.Image();if(new URL(src,document.baseURI).origin!==new URL(document.baseURI).origin)image.crossOrigin='anonymous';image.src=src;await bounded(image.decode(),'No se pudo cargar el fondo de la presentación.');}
  if(!section.isConnected||!fit(section))throw Error('El texto no cabe en la presentación. Revisá su contenido.');
  // Freeze browser-resolved pixels before html2pdf moves the clone outside its
  // query container. Otherwise cqw/calc/var are reinterpreted by html2canvas.
  const nodes=[section,...section.querySelectorAll('*')],pseudo=[];
  const css=style=>Array.from(style).filter(key=>!key.startsWith('--')).map(key=>[key,style.getPropertyValue(key)]);
  const snapshots=nodes.map((n,i)=>{for(const part of ['::before','::after']){const st=view.getComputedStyle(n,part);if(st.content&&st.content!=='none'&&st.content!=='normal')pseudo.push('[data-sv-pdf-node="'+i+'"]'+part+'{'+css(st).map(([k,v])=>k+':'+v+'!important').join(';')+'}');}return css(view.getComputedStyle(n));});
  for(const img of section.querySelectorAll('img')){const st=view.getComputedStyle(img);if(st.objectFit!=='cover')continue;const w=img.clientWidth,h=img.clientHeight;if(!w||!h)continue;const canvas=document.createElement('canvas');canvas.width=Math.ceil(w*2);canvas.height=Math.ceil(h*2);const scale=Math.max(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;canvas.getContext('2d').drawImage(img,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);try{img.src=canvas.toDataURL('image/png');}catch{throw Error('No se pudo preparar una imagen para el PDF.');}await bounded(img.decode(),'No se pudo preparar una imagen para el PDF.');}
  nodes.forEach((n,i)=>{n.setAttribute('data-sv-pdf-node',String(i));for(const [key,value]of snapshots[i])n.style.setProperty(key,value,'important');});
  section.style.setProperty('container-type','normal','important');
  if(pseudo.length){const style=document.createElement('style');style.textContent=pseudo.join('\n');section.append(style);}
  return section;
 }
 function validateCapture(section){
  if(!section?.isConnected)throw Error('No se pudo preparar la página del PDF.');
  const box=section.getBoundingClientRect();if(!(box.width>0&&box.height>0))throw Error('La página del PDF no tiene tamaño válido.');
  for(const n of section.querySelectorAll('h1,h2,p,strong,small,td,th,.sv-pd-page-note span')){if(!n.getClientRects().length)continue;const r=n.getBoundingClientRect();if(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1)throw Error('La página del PDF tiene contenido fuera del encuadre.');}
  return true;
 }
 return Object.freeze({render:slide,fit,prepareCapture,validateCapture});
});
