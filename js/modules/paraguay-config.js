(function(){
  'use strict';
  var cargado=false, editado=false;
  function el(id){return document.getElementById('py-'+id);}
  function pintar(c){
    el('habilitado').checked=c.habilitado===true;

    el('estado').textContent=c.actualizadoEn?'Guardado el '+new Date(c.actualizadoEn).toLocaleString('es-AR'):'Se utiliza la cotización del dólar de SisVentas.';
  }
  window.guardarConversionParaguay=async function(){
    if(!window.tienePermiso('configuracion.editar')){notify('Solo el administrador puede cambiar la conversión');return;}
    if(!cargado){notify('Esperá a que termine de cargar la configuración');return;}
    var habilitado=el('habilitado').checked;
    var btn=el('guardar');btn.disabled=true;btn.textContent='Guardando…';
    try{
      await window.fbUpdate(window.fbRef(window.fbDB,'sisventas/config/comprasParaguay'),{habilitado,actualizadoEn:Date.now()});
      editado=false;el('estado').textContent='Configuración guardada en todos los dispositivos.';
      if(habilitado){
        el('estado').textContent='Guardado. Comprobando proveedores con conversión pendiente…';
        for(const p of (proveedoresData||[]).filter(p=>p.activo!==false&&p.conexionAutomatica?.estado==='requiere_conversion')) await window.verificarConexionProveedor(p.fbKey,false);
        el('estado').textContent='Configuración guardada. Revisá el resultado de los proveedores en el actualizador.';
      }
      notify('Conversión guardada');
    }catch(e){notify('No se pudo guardar: '+e.message);}finally{btn.disabled=false;btn.textContent='Guardar conversión';}
  };

  var travelFields=[['bus','Traslado MDP ↔ Buenos Aires · ARS'],['tolls','Peajes ida y vuelta · ARS'],['flight','Aéreo ida y vuelta · ARS'],['border','Iguazú ↔ Paraguay · ARS'],['airport','Aeropuerto ↔ hotel · ARS'],['cargo','Transporte de mercadería · ARS'],['packARS','Embalaje · ARS'],['night','Hotel por noche · ARS'],['food','Comida por día · ARS'],['other','Otros gastos de viaje · ARS']];
  var travelDirty=false,travelLoaded=false,travelRate=0;
  function montarGastos(){
    var host=document.getElementById('cfg-paraguay');if(!host||document.getElementById('py-travel-settings'))return;
    var card=document.createElement('div');card.id='py-travel-settings';card.className='card';card.style.marginTop='18px';
    var groups=[['Traslados','Ida y vuelta',['bus','tolls','flight','border','airport']],['Estadía','Tarifas por noche y por día',['night','food']],['Mercadería y adicionales','Costos del viaje y transporte',['cargo','packARS','other']]];
    card.innerHTML=`<style>
#py-travel-settings{padding:24px;max-width:1120px}#py-travel-settings h3{font-size:21px;margin:0 0 8px}#py-travel-settings .py-intro{color:var(--text3);line-height:1.6;margin:0 0 24px;max-width:780px}#py-travel-settings .py-cost-section{border:1px solid var(--border2);border-radius:14px;overflow:hidden;margin:16px 0}#py-travel-settings .py-cost-title{padding:14px 18px;background:var(--bg3);display:flex;justify-content:space-between;align-items:center;gap:12px}#py-travel-settings .py-cost-title small{color:var(--text3)}#py-travel-settings .py-cost-row{display:grid;grid-template-columns:minmax(180px,1.5fr) minmax(120px,1fr) 112px minmax(110px,1fr);align-items:center;gap:16px;padding:12px 18px;border-top:1px solid var(--border)}#py-travel-settings .py-cost-row>span{font-size:13px;font-weight:500}#py-travel-settings .py-cost-row input{width:100%;min-width:0;text-align:right;font-size:15px;font-variant-numeric:tabular-nums}#py-travel-settings .py-cost-row select{width:100%;min-width:0}#py-travel-settings .py-cost-row small{text-align:right;color:var(--text3);font-variant-numeric:tabular-nums}#py-travel-settings .py-cost-total{padding:20px 22px;border-radius:14px;background:linear-gradient(120deg,#183a38,#172a40);border:1px solid #37695c;margin-top:24px;display:grid;gap:10px;color:#e1f4ee}#py-travel-settings .py-cost-total b{font-size:26px;color:#8ce1b2;letter-spacing:-.5px}#py-travel-settings .py-cost-total small{color:#bdcec9}#py-travel-settings .py-cost-foot{display:flex;align-items:center;gap:18px;margin-top:20px}#py-travel-settings .py-cost-foot p{color:var(--text3);font-size:12px;line-height:1.5;margin:0}#py-travel-settings .py-cost-foot button{white-space:nowrap;padding:12px 20px}@media(max-width:650px){#py-travel-settings{padding:16px}#py-travel-settings .py-cost-row{grid-template-columns:minmax(0,1fr) 100px;gap:10px;padding:14px}#py-travel-settings .py-cost-row>span{grid-column:1/-1}#py-travel-settings .py-cost-row small{grid-column:1/-1;text-align:left}#py-travel-settings .py-cost-title{align-items:flex-start;flex-direction:column;gap:4px}#py-travel-settings .py-cost-foot{align-items:stretch;flex-direction:column}#py-travel-settings .py-cost-total b{font-size:22px}}
</style><h3>Costos generales de viaje</h3><p class="py-intro">Elegí la moneda de cada gasto. La conversión usa el dólar de SisVentas. Podés ajustar estos valores para cada compra desde el simulador.</p>`+groups.map(function(g){return '<section class="py-cost-section"><div class="py-cost-title"><strong>'+g[0]+'</strong><small>'+g[1]+'</small></div>'+g[2].map(function(key){var f=travelFields.find(x=>x[0]===key),label=f[1].replace(' · ARS','');return '<div class="py-cost-row"><span>'+label+'</span><input class="search-input" aria-label="'+label+'" type="number" min="0" step="0.01" data-travel-default="'+key+'" placeholder="Pendiente"><select class="search-input" aria-label="Moneda '+label+'" data-travel-currency="'+key+'"><option value="ARS">ARS · Pesos</option><option value="USD">USD · Dólares</option></select><small data-travel-equivalent="'+key+'"></small></div>';}).join('')+'</section>';}).join('')+'<div class="py-cost-total" data-travel-total></div><div class="py-cost-foot"><button class="btn btn-primary" data-save-travel>Guardar costos generales</button><p role="status" data-travel-status>Cargando costos…</p></div>';host.appendChild(card);
    function totals(){var q=typeof obtenerDolarReferenciaProducto==='function'?obtenerDolarReferenciaProducto():{},rate=travelRate||Number(q.valor)||0,total=0,missing=0,invalid=false;travelFields.forEach(function(f){var raw=card.querySelector('[data-travel-default="'+f[0]+'"]').value,currency=card.querySelector('[data-travel-currency="'+f[0]+'"]').value,v=Number(raw),hint=card.querySelector('[data-travel-equivalent="'+f[0]+'"]');if(raw===''){missing++;hint.textContent='Pendiente';return;}if(!Number.isFinite(v)||v<0){invalid=true;hint.textContent='Importe inválido';return;}if(currency==='USD'&&!rate)invalid=true;total+=currency==='USD'?v*rate:v;hint.textContent=rate?(currency==='USD'?'ARS '+(v*rate).toLocaleString('es-AR',{maximumFractionDigits:2}):'USD '+(v/rate).toLocaleString('es-AR',{maximumFractionDigits:2})):'Cotización pendiente';});card.querySelector('[data-travel-total]').innerHTML='<span>Total de referencia'+(missing?' · parcial':'')+'</span><b>'+(invalid?'Revisá los importes y la cotización':'ARS '+total.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}))+'</b><span>'+(rate?'USD '+(total/rate).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})+' · Dólar de referencia: ARS '+rate.toLocaleString('es-AR'):'Cotización pendiente')+'</span><small>Incluye 1 noche de hotel y 1 día de comida. Las cantidades reales se definen en el simulador.'+(missing?' '+missing+' gastos sin completar.':'')+'</small>';}
    card.addEventListener('input',function(){travelDirty=true;totals();});card.addEventListener('change',function(){travelDirty=true;totals();});window.fbOnValue(window.fbRef(window.fbDB,'sisventas/config/tipoCambio'),snap=>{var c=snap.val()||{};travelRate=Number(c[c.dolarConversion||'oficial']||c.oficial||c.blue||c.mep)||0;totals();});
    window.fbOnValue(window.fbRef(window.fbDB,'sisventas/config/comprasParaguay/costosViaje'),function(snap){travelLoaded=true;var data=snap.val()||{};if(!travelDirty)travelFields.forEach(function(f){card.querySelector('[data-travel-default="'+f[0]+'"]').value=data[f[0]]??'';card.querySelector('[data-travel-currency="'+f[0]+'"]').value=data.monedas?.[f[0]]==='USD'?'USD':'ARS';});totals();card.querySelector('[data-travel-status]').textContent='Los cambios generales se toman al abrir las compras activas. Las excepciones y compras cerradas conservan sus valores.';},function(){card.querySelector('[data-travel-status]').textContent='No se pudieron cargar los costos. Reintentá antes de guardar.';});
    card.querySelector('[data-save-travel]').onclick=async function(){if(!window.tienePermiso('configuracion.editar'))return notify('No tenés permiso para editar configuración');if(!travelLoaded)return;var data={monedas:{}};for(var f of travelFields){var value=card.querySelector('[data-travel-default="'+f[0]+'"]').value;if(value!==''&&(!Number.isFinite(Number(value))||Number(value)<0))return notify('Ingresá costos válidos, mayores o iguales a cero');data[f[0]]=value===''?'':Number(value);data.monedas[f[0]]=card.querySelector('[data-travel-currency="'+f[0]+'"]').value;}var btn=this;btn.disabled=true;try{await window.fbUpdate(window.fbRef(window.fbDB,'sisventas/config/comprasParaguay/costosViaje'),data);travelDirty=false;card.querySelector('[data-travel-status]').textContent='Costos generales guardados.';}catch(e){card.querySelector('[data-travel-status]').textContent='No se pudo guardar: '+e.message;}finally{btn.disabled=false;}};
  }
  function iniciar(){
    if(!window.fbDB||!window.fbOnValue||!window.fbAuth?.currentUser||!el('habilitado'))return setTimeout(iniciar,500);
    montarGastos();
    ['habilitado'].forEach(id=>el(id).addEventListener('input',()=>{editado=true;}));
    window.fbOnValue(window.fbRef(window.fbDB,'sisventas/config/tipoCambio'),snap=>{
      var c=snap.val()||{},tipo=c.dolarConversion||'oficial',valor=Number(c[tipo]||c.oficial||c.blue||c.mep||0);
      el('dolar').textContent=valor>0?'Dólar de SisVentas: '+tipo+' · $ '+valor.toLocaleString('es-AR')+' por USD':'Configurá el dólar de referencia en la sección Dólar de SisVentas.';
    });
    window.fbOnValue(window.fbRef(window.fbDB,'sisventas/config/guarani'),snap=>{var c=snap.val();if(c)mostrarGuarani(c);});
    actualizarGuaraniParaguay(false);
    window.fbOnValue(window.fbRef(window.fbDB,'sisventas/config/comprasParaguay'),snap=>{cargado=true;if(!editado)pintar(snap.val()||{});},()=>{el('estado').textContent='No se pudo cargar la configuración. Revisá tu conexión.';});
  }
  function mostrarGuarani(c){el('guarani').textContent='1 USD = '+Number(c.pygPorUsd).toLocaleString('es-AR')+' guaraníes · '+c.fecha+' · '+c.fuente;}
  window.actualizarGuaraniParaguay=async function(forzar=true){
    var btn=el('actualizar');btn.disabled=true;btn.textContent='Consultando…';
    try {
      const res=await fetch(SISVENTAS_FUNCTIONS.cotizadorProveedor+'/cotizacion-guarani',{method:'POST',headers:await headersCotizadorProtegido(),body:JSON.stringify({forzar}),signal:AbortSignal.timeout(20000)});
      const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.mensaje||'No se pudo actualizar');
      mostrarGuarani(data.cotizacion);
    }catch(e){el('guarani').textContent='No se pudo actualizar el guaraní: '+e.message;}
    finally{btn.disabled=false;btn.textContent='Actualizar guaraní desde la web';}
  };
  iniciar();
})();
