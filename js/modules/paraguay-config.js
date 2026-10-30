(function(){
  'use strict';
  var cargado=false, editado=false, contextoActivo=null, stops=[], epoch=0;
  function el(id){return document.getElementById('py-'+id);}
  function contexto(){var user=window.fbAuth?.currentUser,uid=window.currentUserUid,e=epoch,valid=window.svCapturarContextoOperacion?.();return function(){return e===epoch&&!!user&&user===window.fbAuth?.currentUser&&uid===window.currentUserUid&&(!valid||valid());};}
  function escuchar(path,next,error){var valid=contextoActivo;stops.push(window.fbOnValue(window.fbRef(window.fbDB,path),function(snap){if(valid?.())next(snap);},function(e){if(valid?.()&&error)error(e);}));}
  function detener(){epoch++;contextoActivo=null;stops.splice(0).forEach(function(stop){try{stop();}catch(_){}});cargado=false;editado=false;document.getElementById('py-travel-settings')?.remove();if(el('habilitado'))el('habilitado').checked=false;['estado','dolar','guarani'].forEach(function(id){if(el(id))el(id).textContent='';});if(el('guardar')){el('guardar').disabled=false;el('guardar').textContent='Guardar conversión';}if(el('actualizar')){el('actualizar').disabled=false;el('actualizar').textContent='Actualizar guaraní';}}
  function marcarEditado(){editado=true;}
  function pintar(c){
    el('habilitado').checked=c.habilitado===true;

    el('estado').textContent=c.actualizadoEn?'Guardado el '+new Date(c.actualizadoEn).toLocaleString('es-AR'):'Se utiliza la cotización del dólar de SisVentas.';
  }
  window.guardarConversionParaguay=async function(){
    if(!window.tienePermiso('configuracion.editar')){notify('Solo el administrador puede cambiar la conversión');return;}
    if(!cargado||!contextoActivo?.()){notify('Esperá a que termine de cargar la configuración');return;}
    var valid=contextoActivo;
    var habilitado=el('habilitado').checked;
    var btn=el('guardar');btn.disabled=true;btn.textContent='Guardando…';
    try{
      await window.fbUpdate(window.fbRef(window.fbDB,'sisventas/config/comprasParaguay'),{habilitado,actualizadoEn:Date.now()});
      if(!valid())return;
      editado=false;el('estado').textContent='Configuración guardada en todos los dispositivos.';
      if(habilitado){
        el('estado').textContent='Guardado. Comprobando proveedores con conversión pendiente…';
        for(const p of (proveedoresData||[]).filter(p=>p.activo!==false&&p.conexionAutomatica?.estado==='requiere_conversion')) {if(!valid())return;await window.verificarConexionProveedor(p.fbKey,false);}
        if(!valid())return;
        el('estado').textContent='Configuración guardada. Revisá el resultado de los proveedores en el actualizador.';
      }
      notify('Conversión guardada');
    }catch(e){if(valid())notify('No se pudo guardar: '+e.message);}finally{if(valid()){btn.disabled=false;btn.textContent='Guardar conversión';}}
  };

  function iniciar(){
    if(!document.getElementById('cfg-paraguay')?.getClientRects().length||!window.permisoModulo?.('configuracion')||!window.fbDB||!window.fbOnValue||!window.fbAuth?.currentUser||!el('habilitado'))return;
    if(contextoActivo?.())return;
    detener();contextoActivo=contexto();
    if(!contextoActivo())return;
    try {
    el('habilitado').addEventListener('input',marcarEditado);
    escuchar('sisventas/config/tipoCambio',snap=>{
      var c=snap.val()||{},tipo=c.dolarConversion||'oficial',valor=Number(c[tipo]||c.oficial||c.blue||c.mep||0);
      el('dolar').textContent=valor>0?'1 USD = $ '+valor.toLocaleString('es-AR')+' · '+tipo:'Configurá el dólar de referencia en la sección Dólar de SisVentas.';
    });
    escuchar('sisventas/config/guarani',snap=>{var c=snap.val();if(c)mostrarGuarani(c);});
    escuchar('sisventas/config/comprasParaguay',snap=>{cargado=true;if(!editado)pintar(snap.val()||{});},()=>{el('estado').textContent='No se pudo cargar la configuración. Revisá tu conexión.';});
    } catch (_) { detener();el('estado').textContent='No se pudo cargar la configuración. Volvé a abrir esta sección.'; }
  }
  function mostrarGuarani(c){el('guarani').textContent='1 USD = '+Number(c.pygPorUsd).toLocaleString('es-AR')+' PYG';el('guarani').title=(c.fecha||'')+' · '+(c.fuente||'');}
  window.actualizarGuaraniParaguay=async function(forzar=true){
    if(!contextoActivo?.())return;
    var valid=contextoActivo;
    var btn=el('actualizar');btn.disabled=true;btn.textContent='Consultando…';
    try {
      const headers=await headersCotizadorProtegido();if(!valid())return;
      const res=await fetch(SISVENTAS_FUNCTIONS.cotizadorProveedor+'/cotizacion-guarani',{method:'POST',headers,body:JSON.stringify({forzar}),signal:AbortSignal.timeout(20000)});
      const data=await res.json();if(!res.ok||!data.ok)throw new Error(data.mensaje||'No se pudo actualizar');
      if(!valid())return;
      mostrarGuarani(data.cotizacion);
    }catch(e){if(valid())el('guarani').textContent='No se pudo actualizar el guaraní: '+e.message;}
    finally{if(valid()){btn.disabled=false;btn.textContent='Actualizar guaraní';}}
  };
  ['sisventas:page-changed','sisventas:session-ready','sisventas:role-changed','firebase-ready'].forEach(function(name){document.addEventListener(name,iniciar);});
  document.addEventListener('sisventas:session-ended',detener);
  document.addEventListener('click',function(event){if(event.target?.closest?.('#page-configuracion'))queueMicrotask(iniciar);});
  iniciar();
})();
