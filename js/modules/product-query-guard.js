(function(){
  'use strict';
  var activo=false;
  // Navigation is allowed. The editor validates product identity and field
  // fingerprint before applying a late response (cotizacionProductoSigueActiva).
  window.svBloquearSalidaCotizacion=function(){return false;};
  ['cotizarPreciosProveedores','completarProductoDesdeUrl','confirmarIdentidadProveedorCotizacion'].forEach(function(nombre){
    var original=window[nombre];if(typeof original!=='function')return;
    window[nombre]=async function(){
      if(activo){window.notify('Ya hay una consulta de producto en curso. Podés seguir usando otros módulos.');return;}
      activo=true;window._svConsultaProductoEnCurso=true;
      try{return await original.apply(this,arguments);}
      finally{activo=false;window._svConsultaProductoEnCurso=false;}
    };
  });
  window.addEventListener('beforeunload',function(e){
    var masivo=document.getElementById('modal-actualizador-precios');
    if(!activo&&!(masivo&&masivo.dataset.ejecutando==='1'))return;
    e.preventDefault();e.returnValue='';
  });
})();
