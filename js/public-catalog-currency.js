(function(){
 'use strict';
 const base='https://nixa-sisventas-default-rtdb.firebaseio.com/sisventas/config/tipoCambio/';
 let selected='USD',rate=0,type='',loading=false,lastState='';
 try{selected=localStorage.getItem('sv-public-currency')==='ARS'?'ARS':'USD';}catch(_){}
 const box=document.createElement('div');box.className='currency-selector';
 box.innerHTML='<div role="group" aria-label="Moneda de precios"><button class="btn" data-currency="USD">US$</button><button class="btn" data-currency="ARS">Pesos</button></div><small role="status">Consultando cotización…</small>';
 document.querySelector('header').after(box);
 const format=n=>Number(n).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
 const api=window.SVPublicCurrency={get code(){return selected==='ARS'&&rate>0?'ARS':'USD';},money(n){return api.code==='ARS'?'ARS $ '+format(n*rate):'US$ '+format(n);}};
 function update(){box.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.currency===api.code));b.disabled=b.dataset.currency==='ARS'&&!rate;});box.querySelector('small').textContent=rate?'Dólar '+type+' · US$ 1 = ARS $ '+format(rate):'Cotización no disponible · precios en USD';const state=api.code+':'+rate;if(state!==lastState){lastState=state;window.dispatchEvent(new Event('catalog-currency-change'));}}
 async function read(key){const r=await fetch(base+key+'.json',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return r.json();}
 async function refresh(){if(loading||document.hidden)return;loading=true;try{const configured=await read('dolarConversion');type=['oficial','blue','mep'].includes(configured)?configured:'oficial';const value=Number(await read(type));if(!(Number.isFinite(value)&&value>0))throw Error();rate=value;update();}catch(_){rate=0;update();}finally{loading=false;}}
 box.onclick=e=>{const b=e.target.closest('[data-currency]');if(!b||b.disabled)return;selected=b.dataset.currency;try{localStorage.setItem('sv-public-currency',selected);}catch(_){}update();};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('focus',refresh);setInterval(refresh,60000);refresh();
})();
