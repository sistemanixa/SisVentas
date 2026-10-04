(function(global){
  'use strict';
  var states={},generation=0,scheduled=false;
  var dependencies={
    dashboard:['clientes','productos','ventas','pagos'],
    productos:['productos'],catalogo:['productos'],actualizadorprecios:['productos','proveedores'],
    clientes:['clientes'],venta:['clientes','productos','ventas'],presupuesto:['clientes','productos','presupuestos'],
    detalle:['ventas','clientes','pagos'],cobranzas:['ventas','clientes','pagos'],
    gastos:['gastos','empleados'],comisiones:['gastos','empleados','ventas'],
    ordentrabajo:['ordenes_trabajo','clientes','productos'],
    balancecompra:['ventas','presupuestos','productos','proveedores'],ordenes:['productos','proveedores'],
    proveedores:['proveedores'],empleados:['empleados'],usuarios:['usuarios']
  };
  var labels={ordenes_trabajo:'órdenes de trabajo',pagos:'cobros'};
  function collection(reference){
    try{var path=new URL(String(reference)).pathname;if(/^\/sv_usuarios\/?$/.test(path))return 'usuarios';var match=path.match(/^\/sisventas\/([^/]+)\/?$/);return match?decodeURIComponent(match[1]):'';}catch(_){return '';}
  }
  function status(keys){
    var missing=keys.filter(function(k){return !states[k]||!states[k].ready;});
    var errors=keys.filter(function(k){return states[k]&&states[k].error;});
    return {ready:!missing.length,missing:missing,errors:errors};
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;render();});}
  function begin(reference){
    var key=collection(reference),epoch=generation,active=true;
    if(!key)return {ready:function(){},error:function(){},cancel:function(){}};
    if(!states[key])states[key]={ready:false,error:false};
    states[key].error=false;schedule();
    function finish(error){if(!active||epoch!==generation)return;states[key].error=error;if(!error)states[key].ready=true;schedule();}
    return {ready:function(){finish(false);},error:function(){finish(true);},cancel:function(){active=false;}};
  }
  function render(){
    Object.keys(dependencies).forEach(function(name){
      var page=document.getElementById('page-'+name);if(!page)return;
      var state=status(dependencies[name]),box=page.querySelector('[data-sv-data-status]');
      var show=!state.ready||state.errors.length>0;
      page.classList.toggle('sv-data-pending',!state.ready);
      page.setAttribute('aria-busy',String(!state.ready&&!state.errors.length));
      if(!show){if(box)box.remove();return;}
      if(!box){box=document.createElement('div');box.dataset.svDataStatus='1';box.className='sv-data-status';box.setAttribute('role','status');box.setAttribute('aria-live','polite');page.prepend(box);}
      box.classList.toggle('sv-data-error',!!state.errors.length);
      box.replaceChildren();
      var title=document.createElement('strong'),detail=document.createElement('span');
      title.textContent=state.errors.length?'No se pudieron cargar todos los datos':global.navigator.onLine===false?'Sin conexión. Esperando los datos…':'Cargando datos…';
      detail.textContent=state.errors.length?(state.ready?'Se conserva la información recibida. Revisá la conexión y volvé a intentar.':'No se puede determinar todavía si hay registros. Revisá la conexión y volvé a intentar.'):'Esperando '+state.missing.map(function(k){return labels[k]||k;}).join(', ')+'. La información aparecerá al completar la carga.';
      box.append(title,detail);
      var retry=document.createElement('button');retry.className='btn btn-sm';retry.textContent='Reintentar carga';retry.onclick=function(){global.location.reload();};box.append(retry);
    });
    document.dispatchEvent(new CustomEvent('sisventas:data-state-changed'));
  }
  function reset(){generation++;states={};schedule();}
  document.addEventListener('sisventas:session-ended',reset);
  document.addEventListener('sisventas:session-ready',schedule);
  document.addEventListener('sisventas:page-changed',schedule);
  document.addEventListener('DOMContentLoaded',function(){
    var style=document.createElement('style');style.textContent='.sv-data-pending{position:relative;min-height:260px}.sv-data-pending>:not([data-sv-data-status]){visibility:hidden;pointer-events:none}.sv-data-status{display:flex;flex-direction:column;gap:10px;padding:24px;margin-bottom:16px;border:1px solid var(--border2);border-radius:14px;background:var(--bg2);color:var(--text);line-height:1.6}.sv-data-status span{font-size:13px;color:var(--text3)}.sv-data-status button{align-self:flex-start}.sv-data-pending>.sv-data-status{position:absolute;inset:0 0 auto;z-index:2}.sv-data-status strong::before{content:"";display:inline-block;width:14px;height:14px;margin-right:10px;border:2px solid var(--border2);border-top-color:var(--blue);border-radius:50%;animation:spin 1s linear infinite}.sv-data-error strong::before{display:none}';document.head.append(style);schedule();
  });
  global.addEventListener('online',schedule);global.addEventListener('offline',schedule);
  global.SVDataReadiness={begin:begin,status:status,reset:reset,render:schedule};
})(window);
