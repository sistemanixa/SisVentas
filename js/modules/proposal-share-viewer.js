(function(){
 'use strict';
 const content=document.getElementById('share-content'),status=document.getElementById('share-status'),back=document.getElementById('share-index'),expiry=document.getElementById('share-expiry');
 const token=location.hash.slice(1),assets=new Set(['cerradura-camara','cerradura-teclado','portero-pantalla','portero-teclado','videovigilancia','portero-columna']);
 let payload=null,current=-1,page=0,pending=0,touch=null;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,fn)=>{const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;};
 const money=v=>Number(v).toLocaleString('es-AR',{style:'currency',currency:'ARS'});
 const image=(p,thumb=false)=>{if(!assets.has(p.scene?.asset))return null;const n=el('img');n.src='./assets/proposal-scenes/'+p.scene.asset+(thumb?'-thumb':'')+'.jpg';n.alt='Imagen ilustrativa de la propuesta';n.referrerPolicy='no-referrer';return n;};
 function fail(message){payload=null;current=-1;content.replaceChildren(el('h1','Propuestas no disponibles'),el('p',message,'sv-share-lead'));back.hidden=true;expiry.textContent='';status.textContent='';content.setAttribute('aria-busy','false');}
 function valid(){if(!payload||!Number.isSafeInteger(payload.expiresAt)||Date.now()>=payload.expiresAt){fail('El enlace venció. Pedí una presentación nueva.');return false;}return true;}
 function focus(){content.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 async function load(target=-1,nextPage=0){
  const request=++pending;status.textContent='Comprobando presentación…';content.setAttribute('aria-busy','true');
  try{if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('El enlace está incompleto. Pedí el QR nuevamente.');
   const response=await fetch('./api/proposal-shares/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(request!==pending)return;
   if(!response.ok||data.ok!==true||data.schema!==1||!Array.isArray(data.proposals)||!data.proposals.length||data.proposals.length>12)throw Error(data.message||data.mensaje||'El enlace venció o fue revocado. Pedí una presentación nueva.');
   payload=data;if(!valid())return;expiry.textContent='Disponible hasta '+new Date(data.expiresAt).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});status.textContent='';content.setAttribute('aria-busy','false');current=target>=0&&target<data.proposals.length?target:-1;page=current>=0?Math.max(0,Math.min(pages(data.proposals[current]).length-1,nextPage)):0;render();focus();
  }catch(error){if(request===pending)fail(error.name==='TimeoutError'?'No se pudo conectar. Volvé a abrir el enlace.':error.message||'No se pudo abrir la presentación.');}
 }
 function pages(p){const list=[{kind:'cover'},{kind:'intro'}];for(let i=0;i<p.items.length;i+=8)list.push({kind:'items',items:p.items.slice(i,i+8)});list.push({kind:'money'});return list;}
 function render(){if(!valid())return;content.replaceChildren();back.hidden=current<0;
  if(current<0){content.append(el('h1',payload.proposals[0].client),el('p','Elegí una propuesta para conocerla.','sv-share-lead'));const grid=el('div',undefined,'sv-share-grid');payload.proposals.forEach((p,i)=>{const card=button('',()=>load(i));card.className='sv-share-card';const art=image(p,true);if(art)card.append(art);const copy=el('span');copy.append(el('strong',p.title||p.scene.title),el('small',p.number+' · '+p.address),el('small','Ver propuesta →'));card.append(copy);grid.append(card);});content.append(grid);return;}
  const p=payload.proposals[current],all=pages(p),part=all[page],stage=el('div',undefined,'sv-share-stage'),slide=el('section',undefined,'sv-share-slide');stage.append(slide);slide.append(el('span','NIXA · '+p.number,'sv-share-kicker'));
  if(part.kind==='cover'){slide.classList.add('sv-share-cover');const art=image(p);if(art)slide.prepend(art);slide.append(el('h1',p.title||p.scene.title),el('p',p.scene.subtitle),el('p',p.client+'\n'+p.address));}
  else if(part.kind==='intro'){slide.append(el('h2','La propuesta'),el('p',p.overview),el('p',p.address,'sv-share-lead'));}
  else if(part.kind==='items'){slide.append(el('h2','Equipos y servicios'));const table=el('table'),head=el('tr');head.append(el('th','Descripción'),el('th','Cantidad'));table.append(head);for(const item of part.items){const row=el('tr');row.append(el('td',item.description),el('td',item.quantity));table.append(row);}slide.append(table);}
  else{slide.append(el('h2','Tu inversión'),el('p','Importes expresados en pesos argentinos.','sv-share-lead'));const table=el('table',undefined,'sv-share-money');for(const [label,value]of [['Subtotal',p.money.ars.subtotal],['Descuento '+p.money.discountPct+'%',-p.money.ars.discount],['IVA',p.money.ars.iva]]){const row=el('tr');row.append(el('td',label),el('td',money(value)));table.append(row);}const total=el('div',undefined,'sv-share-total');total.append(el('span','TOTAL'),el('strong',money(p.money.ars.total)));slide.append(table,total,el('p','Referencia: USD '+Number(p.money.usd.total).toLocaleString('es-AR',{maximumFractionDigits:2})+' · Dólar '+p.exchange.label+': '+money(p.exchange.rate),'sv-share-lead'));}
  const controls=el('div',undefined,'sv-share-controls'),prev=button('← Anterior',()=>step(-1)),next=button('Siguiente →',()=>step(1));prev.disabled=page===0;next.disabled=page===all.length-1;controls.append(prev,el('span',(page+1)+' / '+all.length),next);content.append(stage,controls);
 }
 function step(delta){if(!valid()||current<0)return;const length=pages(payload.proposals[current]).length;const next=Math.max(0,Math.min(length-1,page+delta));if(next!==page)load(current,next);}
 back.addEventListener('click',()=>load());
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&current>=0){e.preventDefault();load();}else if(current>=0&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();step(e.key==='ArrowRight'?1:-1);}});
 content.addEventListener('touchstart',e=>{const t=e.changedTouches?.[0];touch=t?{x:t.clientX,y:t.clientY}:null;},{passive:true});
 content.addEventListener('touchend',e=>{const t=e.changedTouches?.[0],start=touch;touch=null;if(!t||!start)return;const x=t.clientX-start.x,y=t.clientY-start.y;if(Math.abs(x)>70&&Math.abs(x)>Math.abs(y)*1.5)step(x<0?1:-1);},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){pending++;payload=null;content.replaceChildren();back.hidden=true;status.textContent='Presentación en pausa';}else load();});
 load();
})();
