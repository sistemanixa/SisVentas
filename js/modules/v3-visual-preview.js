(function(){
  'use strict';
  function sincronizarSelector(){
    var activo=document.documentElement.classList.contains('sv-v3-preview')?'v3':'classic';
    document.querySelectorAll('.sv-style-option').forEach(function(b){
      var seleccionado=b.dataset.style===activo;
      b.classList.toggle('is-selected',seleccionado);
      b.setAttribute('aria-pressed',seleccionado?'true':'false');
    });
  }
  function aplicarEstiloVisual(estilo){
    var moderno=estilo==='v3';
    document.documentElement.classList.toggle('sv-v3-preview',moderno);
    try{
      localStorage.setItem('sisventas_visual_style',moderno?'v3':'classic');
      if(moderno) sessionStorage.setItem('sisventas_visual_preview','v3');
      else sessionStorage.removeItem('sisventas_visual_preview');
    }catch(e){}
    try{
      var url=new URL(location.href);
      if(moderno) url.searchParams.set('preview','v3');
      else url.searchParams.delete('preview');
      history.replaceState(history.state,'',url.pathname+(url.search||'')+(url.hash||''));
    }catch(e){}
    sincronizarSelector();
  }
  window.aplicarEstiloVisual=aplicarEstiloVisual;
  function preparar(){
    var novedades=document.querySelector('.nav-item[onclick*="abrirHistorialActualizaciones"]');
    if(novedades && !novedades.dataset.v3Novedades){
      novedades.dataset.v3Novedades='1';
      var pill=document.createElement('span');
      pill.className='v3-release-pill';
      pill.textContent='V3';
      novedades.appendChild(pill);
    }
    if(typeof window.aplicarVersionSisVentas==='function') window.aplicarVersionSisVentas(document);
    var mensaje=document.getElementById('loading-msg');
    if(mensaje && /verificando sesión/i.test(mensaje.textContent||'')) mensaje.textContent='Preparando tu espacio de trabajo...';
    sincronizarSelector();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',preparar,{once:true});
  else preparar();
})();
