(function(){
 'use strict';
 if(location.origin!=='http://127.0.0.1:8766')return;
 var busy=false;
 function mount(){
  if(location.hash.split('?')[0]!=='#/actualizadorprecios')return;
  var parent=document.getElementById('actualizador-precios-acciones')||document.getElementById('actualizador-precios-cuerpo');
  if(!parent||document.getElementById('tecnoprices-local-readonly'))return;
  var panel=document.createElement('div');panel.id='tecnoprices-local-readonly';panel.style.cssText='padding:12px;border:1px solid var(--border);border-radius:8px;flex-basis:100%';
  var button=document.createElement('button');button.className='btn';button.textContent='Consultar pendrive · sin guardar';button.type='button';
  var result=document.createElement('div');result.setAttribute('role','status');result.style.cssText='font-size:12px;margin-top:8px;white-space:pre-wrap';result.textContent='Consulta local de Tecnoprices. No modifica precios ni stock.';
  button.onclick=async function(){
   if(busy)return;busy=true;button.disabled=true;button.textContent='Consultando…';result.textContent='Consultando el pendrive en Tecnoprices…';
   try{
    var providers=typeof proveedoresData!=='undefined'?proveedoresData:[];
    var matches=(Array.isArray(providers)?providers:Object.values(providers||{})).filter(function(p){return p&&p.activo!==false&&String(p.nombre||'').trim().toLowerCase()==='tecnoprices';});
    if(matches.length!==1)throw Error('Primero cargá el proveedor Tecnoprices en el actualizador.');
    var p=matches[0],key=p.fbKey||p.key||p.id;
    if(!key)throw Error('No se encontró el identificador del proveedor.');
    if(typeof headersCotizadorProtegido!=='function')throw Error('La sesión todavía no está lista.');
    var serviceHeaders=new Headers(await headersCotizadorProtegido());
    var headers={'Content-Type':'application/json','Authorization':serviceHeaders.get('Authorization')||''};
    var response=await fetch('/tecnoprices/consultar',{method:'POST',headers:headers,body:JSON.stringify({proveedorKey:String(key),url:'https://www.tecnoprices.com/16337/pendrive-128gb-kingston-datatraveler-exodia-dtx-usb-32'})});
    var data=await response.json();if(!response.ok||data.ok!==true)throw Error(data.mensaje||'No se pudo completar la consulta local.');
    var quote=data.resultado||data;
    result.textContent='P-16337 · '+(quote.disponibilidadProveedor==='sin_stock'?'Sin stock':quote.disponibilidadProveedor==='disponible'?'Disponible':'Disponibilidad sin confirmar')+'\nPrecio consultado: '+new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(quote.precioArs)+'\nConsulta terminada. No se guardó ningún cambio.';
   }catch(error){result.textContent=error instanceof TypeError?'No se pudo conectar con la consulta local.':error.message;}
   finally{busy=false;button.disabled=false;button.textContent='Consultar pendrive · sin guardar';}
  };
  panel.append(button,result);parent.prepend(panel);
 }
 new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
 window.addEventListener('hashchange',mount);mount();
})();
