(function(){
  'use strict';
  var cargado=false, editado=false;
  function el(id){return document.getElementById('py-'+id);}
  function pintar(c){
    el('habilitado').checked=c.habilitado===true;

    el('estado').textContent=c.actualizadoEn?'Guardado el '+new Date(c.actualizadoEn).toLocaleString('es-AR'):'Se utiliza la cotización del dólar de SisVentas.';
  }
  window.guardarConversionParaguay=async function(){
    if(currentRole!=='admin'){notify('Solo el administrador puede cambiar la conversión');return;}
    if(!cargado){notify('Esperá a que termine de cargar la configuración');return;}
    var habilitado=el('habilitado').checked;
    var btn=el('guardar');btn.disabled=true;btn.textContent='Guardando…';
    try{
      await window.fbSet(window.fbRef(window.fbDB,'sisventas/config/comprasParaguay'),{habilitado,actualizadoEn:Date.now()});
      editado=false;el('estado').textContent='Configuración guardada en todos los dispositivos.';
      if(habilitado){
        el('estado').textContent='Guardado. Comprobando proveedores con conversión pendiente…';
        for(const p of (proveedoresData||[]).filter(p=>p.activo!==false&&p.conexionAutomatica?.estado==='requiere_conversion')) await window.verificarConexionProveedor(p.fbKey,false);
        el('estado').textContent='Configuración guardada. Revisá el resultado de los proveedores en el actualizador.';
      }
      notify('Conversión guardada');
    }catch(e){notify('No se pudo guardar: '+e.message);}finally{btn.disabled=false;btn.textContent='Guardar conversión';}
  };
  function iniciar(){
    if(!window.fbDB||!window.fbOnValue||!window.fbAuth?.currentUser||!el('habilitado'))return setTimeout(iniciar,500);
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
