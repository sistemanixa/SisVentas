(function () {
  'use strict';
  var pendientes = new Set();
  window.verificarConexionProveedor = async function(key, pedirUrl) {
    if (!key || pendientes.has(key)) return;
    var registrado=(proveedoresData || []).find(p=>p.fbKey===key);
    var url = registrado && registrado.conexionAutomatica && registrado.conexionAutomatica.urlPrueba || '';
    if (pedirUrl) {
      url = await svPrompt('URL exacta de un producto de este proveedor. Dejá vacío para usar un producto ya vinculado:');
      if (url === null) return;
    }
    pendientes.add(key);
    var botones=Array.from(document.querySelectorAll('[data-verificar-proveedor]')).filter(b=>b.dataset.verificarProveedor===key);
    botones.forEach(b=>{b.disabled=true;b.textContent='Verificando acceso y producto…';});
    notify('El bot está verificando el acceso y la ficha de prueba del proveedor');
    try {
      const res = await fetch(SISVENTAS_FUNCTIONS.cotizadorProveedor + '/verificar-proveedor', {method:'POST',headers:await headersCotizadorProtegido(),body:JSON.stringify({proveedorKey:key,url:url.trim()}),signal:AbortSignal.timeout(90000)});
      const data=await res.json();
      if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo verificar el proveedor');
      const p=(proveedoresData || []).find(p=>p.fbKey===key);
      if (p) p.conexionAutomatica=data.conexion;
      botones.forEach(function(b) {
        var tarjeta=b.parentElement;
        var resultado=tarjeta.querySelector('[data-resultado-conexion]');
        if (!resultado) { resultado=document.createElement('p'); resultado.dataset.resultadoConexion='1'; tarjeta.appendChild(resultado); }
        resultado.textContent=data.conexion.mensaje;
      });
      notify(data.conexion.mensaje);
      if (typeof renderModuloActualizadorPrecios==='function' && document.getElementById('page-actualizadorprecios').classList.contains('active')) renderModuloActualizadorPrecios();
    } catch(e) { notify('Verificación pendiente: ' + e.message); }
    finally { pendientes.delete(key); botones.forEach(b=>{b.disabled=false;b.textContent='Verificar conexión';}); }
  };
})();
