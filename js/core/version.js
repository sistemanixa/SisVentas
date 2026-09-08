// SisVentas PWA version publicada.
window.SISVENTAS_PWA_VERSION = 'v3.4.7';
(function(){
  function mostrarVersion(){
    ['s-version-el','login-version-lbl','loading-version','up-version'].forEach(function(id){
      var el=document.getElementById(id);
      if(el) el.textContent=window.SISVENTAS_PWA_VERSION;
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mostrarVersion,{once:true});
  else mostrarVersion();
})();
