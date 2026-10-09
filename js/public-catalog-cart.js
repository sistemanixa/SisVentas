(function(){
'use strict';
const KEY='sv-public-cart-v1',DRAFT='sv-public-request-v1',ENDPOINT='https://nixa-sisventas-default-rtdb.firebaseio.com/sv_catalogo_solicitudes/';
let cart={},busy=false,step=1,pending=null,contact={nombre:'',lista:'',telefono:'',email:''};
try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');for(const [id,p] of Object.entries(saved).slice(0,40))if(p&&Number.isInteger(p.qty)&&p.qty>0&&p.qty<=999)cart[id]=p;}catch(_){}
try{pending=JSON.parse(sessionStorage.getItem(DRAFT)||'null');}catch(_){}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>window.SVPublicCurrency?window.SVPublicCurrency.money(n):'US$ '+Number(n).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
const button=document.createElement('button');button.className='btn cart-toggle';button.type='button';document.querySelector('header').append(button);
const dialog=document.createElement('dialog');dialog.className='public-cart';dialog.setAttribute('aria-labelledby','cart-title');document.body.append(dialog);
let opener;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(cart));}catch(_){}update();}
function update(){const n=Object.values(cart).reduce((s,p)=>s+p.qty,0);button.textContent='Mi lista ('+n+')';button.setAttribute('aria-label','Abrir carrito, '+n+' productos');}
window.addEventListener('catalog-currency-change',()=>{if(dialog.open&&step===1&&!busy)render();});
function remember(){dialog.querySelectorAll('[data-contact]').forEach(i=>contact[i.name]=i.value);}
function message(text){dialog.querySelector('[data-message]').textContent=text;}
function close(){if(busy)return;remember();dialog.close();opener?.focus();}
function render(){const rows=Object.entries(cart),unknown=rows.some(([,p])=>!(p.precioUSD>0));dialog.innerHTML='<div class="cart-head"><div><span class="eyebrow">'+(step===1?'1 · REVISÁ LOS PRODUCTOS':'2 · TUS DATOS')+'</span><h2 id="cart-title">'+(step===1?'Tu lista de productos':'Enviar tu lista')+'</h2></div><button class="btn" type="button" data-close aria-label="Cerrar carrito">✕</button></div>'+(step===1?(!rows.length?'<p class="cart-empty">Tu lista está vacía. Agregá productos del catálogo.</p>':'<div class="cart-items">'+rows.map(([id,p])=>'<article class="cart-row"><div><strong>'+esc(p.nombre)+'</strong><p>'+ (p.precioUSD>0?money(p.precioUSD)+' por unidad':'Precio a consultar')+'</p></div><label>Cantidad<input type="text" inputmode="numeric" data-qty="'+esc(id)+'" value="'+p.qty+'" aria-label="Cantidad de '+esc(p.nombre)+'"></label><button type="button" class="btn cart-delete" data-remove="'+esc(id)+'" aria-label="Eliminar '+esc(p.nombre)+'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button></article>').join('')+'</div><div class="cart-total">'+(unknown?'Subtotal con precio':'Total de referencia')+'<strong>'+money(rows.reduce((s,[,p])=>s+(Number(p.precioUSD)||0)*p.qty,0))+'</strong></div><p class="cart-note">'+(unknown?'Hay productos con precio a consultar. ':'')+'Confirmaremos disponibilidad y precio al contactarte.</p><button class="btn cart-primary" type="button" data-next>Continuar con mis datos →</button>'):'<form data-request><label>Nombre de la lista<input data-contact name="lista" maxlength="100" required autocomplete="off" value="'+esc(contact.lista)+'" placeholder="Por ejemplo: Equipos para casa"></label><label>Tu nombre<input data-contact name="nombre" maxlength="100" required autocomplete="name" value="'+esc(contact.nombre)+'"></label><label>Teléfono / WhatsApp<input data-contact name="telefono" type="tel" maxlength="40" autocomplete="tel" value="'+esc(contact.telefono)+'"></label><label>Correo electrónico<input data-contact name="email" type="email" maxlength="160" autocomplete="email" value="'+esc(contact.email)+'"></label><p class="cart-note">Dejá al menos un teléfono o un correo. Usaremos esos datos para responder esta solicitud.</p><label class="cart-trap" aria-hidden="true">Sitio web<input name="website" tabindex="-1" autocomplete="off"></label><div class="cart-actions"><button type="button" class="btn" data-back>← Productos</button><button class="btn cart-primary" type="submit">Enviar lista</button></div></form>')+'<p data-message role="status"></p>';
 dialog.querySelector('[data-close]').onclick=close;
 dialog.querySelector('[data-next]')?.addEventListener('click',()=>{step=2;render();dialog.querySelector('input')?.focus();});
 dialog.querySelector('[data-back]')?.addEventListener('click',()=>{remember();step=1;render();});
 dialog.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{delete cart[b.dataset.remove];persist();render();});
 dialog.querySelectorAll('[data-qty]').forEach(i=>i.onchange=()=>{if(!/^\d{1,3}$/.test(i.value)||+i.value<1){i.value=cart[i.dataset.qty].qty;message('Usá una cantidad entera entre 1 y 999.');return;}cart[i.dataset.qty].qty=+i.value;persist();render();});
 dialog.querySelector('form')?.addEventListener('submit',send);
}
async function send(e){e.preventDefault();if(busy)return;remember();const data=Object.fromEntries(Object.entries(contact).map(([k,v])=>[k,v.trim()]));if(!data.nombre||!data.lista||(!data.telefono&&!data.email)){message('Completá tu nombre, el nombre de la lista y un teléfono o correo.');return;}if(e.target.website.value)return;
 const contenido=JSON.stringify(Object.entries(cart).map(([id,p])=>({id,nombre:String(p.nombre).slice(0,250),cantidad:p.qty,precioUSD:Number(p.precioUSD)||0})));
 const body={...data,contenido};const signature=JSON.stringify(body);
 if(!pending||pending.signature!==signature)pending={id:crypto.randomUUID(),signature,payload:{...body,creadaEn:Date.now()}};
 try{sessionStorage.setItem(DRAFT,JSON.stringify(pending));}catch(_){}
 busy=true;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=true);message('Enviando lista…');
 try{const r=await fetch(ENDPOINT+pending.id+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify(pending.payload),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('send');
 const code=pending.id.slice(0,8).toUpperCase();cart={};persist();pending=null;try{sessionStorage.removeItem(DRAFT);}catch(_){}contact={nombre:'',lista:'',telefono:'',email:''};dialog.innerHTML='<div class="cart-success"><span aria-hidden="true">✓</span><h2 id="cart-title">Recibimos tu lista</h2><p>Nos pondremos en contacto con vos para confirmar los productos.</p><p>Solicitud '+esc(code)+'</p><button class="btn cart-primary" data-done>Seguir viendo productos</button></div>';dialog.querySelector('[data-done]').onclick=close;
 }catch(_){message('No pudimos confirmar el envío. Tu lista está conservada; volvé a intentar.');dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false);}finally{busy=false;}
}
button.onclick=()=>{opener=document.activeElement;step=1;render();dialog.showModal();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();else remember();});
window.SVPublicCart={add(id,p){if(busy)return;if(!cart[id]&&Object.keys(cart).length>=40){button.click();message('Podés incluir hasta 40 productos distintos por lista.');return;}cart[id]={nombre:p.nombre,precioUSD:Number(p.precioUSD)||0,qty:Math.min(999,(cart[id]?.qty||0)+1)};persist();const n=cart[id].qty;document.querySelector('[data-cart-notice]').textContent='Agregado a tu lista: '+p.nombre+' ('+n+')';},count(id){return cart[id]?.qty||0;}};
const notice=document.createElement('div');notice.className='cart-notice';notice.dataset.cartNotice='';notice.setAttribute('role','status');document.querySelector('header').after(notice);update();
})();
