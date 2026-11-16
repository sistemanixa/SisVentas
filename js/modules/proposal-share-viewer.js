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
 function pages(p){const list=[{kind:'cover'},{kind:'intro'}];for(let i=0;i<p.items.length;i+=8)list.push({kind:'items',items:p.items.slice(i,i+8)});list.push({kind:'money'});if(p.presentationClosing)list.push({...p.presentationClosing,kind:'engineering'});return list;}
 function documentPage(p,part){const img=image(p),page={...part,title:part.kind==='cover'?p.title||p.scene.title:part.kind==='intro'?p.scene.subtitle:part.kind==='items'?'Equipos y servicios':part.kind==='engineering'?part.title:'Tu inversión',subtitle:p.scene.subtitle,client:p.client,address:p.address,number:p.number,money:p.money,exchange:p.exchange};return window.SVProposalSlide.render({dto:p,record:{fecha:p.date},photoURL:img?.getAttribute('src')||'',overview:p.overview},page);}
 function render(){if(!valid())return;content.replaceChildren();back.hidden=current<0;
  if(current<0){content.append(el('h1',payload.proposals[0].client),el('p','Elegí una propuesta para conocerla.','sv-share-lead'));const grid=el('div',undefined,'sv-share-grid');payload.proposals.forEach((p,i)=>{const card=button('',()=>load(i));card.className='sv-share-card';const art=image(p,true);if(art)card.append(art);const copy=el('span');copy.append(el('strong',p.title||p.scene.title),el('small',p.number+' · '+p.address),el('small','Ver propuesta →'));card.append(copy);grid.append(card);});content.append(grid);return;}
  const p=payload.proposals[current],all=pages(p),wrapper=el('div',undefined,'sv-pd-dialog sv-share-document'),stage=el('div',undefined,'sv-pd-stage'),prev=button('‹',()=>step(-1)),next=button('›',()=>step(1));prev.className='sv-pd-page-nav sv-pd-page-prev';next.className='sv-pd-page-nav sv-pd-page-next';prev.setAttribute('aria-label','← Anterior');next.setAttribute('aria-label','Siguiente →');prev.disabled=page===0;next.disabled=page===all.length-1;stage.append(prev,documentPage(p,all[page]),next);wrapper.append(stage);const controls=el('div',undefined,'sv-share-controls');controls.append(el('span',(page+1)+' / '+all.length));content.append(wrapper,controls);
 }
 function step(delta){if(!valid()||current<0)return;const length=pages(payload.proposals[current]).length;const next=Math.max(0,Math.min(length-1,page+delta));if(next!==page)load(current,next);}
 back.addEventListener('click',()=>load());
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&current>=0){e.preventDefault();load();}else if(current>=0&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();step(e.key==='ArrowRight'?1:-1);}});
 content.addEventListener('touchstart',e=>{const t=e.changedTouches?.[0];touch=t?{x:t.clientX,y:t.clientY}:null;},{passive:true});
 content.addEventListener('touchend',e=>{const t=e.changedTouches?.[0],start=touch;touch=null;if(!t||!start)return;const x=t.clientX-start.x,y=t.clientY-start.y;if(Math.abs(x)>70&&Math.abs(x)>Math.abs(y)*1.5)step(x<0?1:-1);},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){pending++;payload=null;content.replaceChildren();back.hidden=true;status.textContent='Presentación en pausa';}else load();});
 load();
})();
