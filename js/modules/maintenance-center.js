(function(root){
  'use strict';
  var report=null,pending=null,observer=null;
  function el(id){return root.document.getElementById(id);}
  function visible(){var panel=el('cfg-mantenimiento'),page=el('page-configuracion');return !!panel&&panel.style.display!=='none'&&(!page||page.classList.contains('active'));}
  function allowed(){var user=root.fbAuth&&root.fbAuth.currentUser;return !!user&&user.uid===root.currentUserUid&&root.currentRole==='admin'&&!root._impersonacionOriginal&&root.permisoModulo?.('configuracion')===true&&root.tienePermiso?.('auditoria.ver')===true;}
  function version(){var value=String(root.SISVENTAS_PWA_VERSION||root.APP_CONFIG?.VERSION||'');return /^v?\d+\.\d+\.\d+(?:-firebase)?$/.test(value)?value:'Sin confirmar';}
  function connection(){
    if(root.navigator?.onLine===false)return 'Sin conexión';
    var status=el('fb-status'),text=String(status?.textContent||'');
    if(/sincronizado/i.test(text))return 'Conectado';
    if(/reconect|comprobando|conectando/i.test(text))return 'Reconectando';
    if(/sin conexi|desconect|offline/i.test(text))return 'Sin conexión';
    return 'Sin confirmar';
  }
  function text(id,value){var node=el(id);if(node&&node.textContent!==value)node.textContent=value;}
  function clearReport(){report=null;var output=el('mnt-diagnostic-output');if(output){output.hidden=true;output.textContent='';}var button=el('mnt-diagnostic-download');if(button)button.disabled=true;text('mnt-diagnostic-status','');}
  function cancel(){if(pending){pending.controller.abort();pending=null;}clearReport();}
  function render(){
    if(!visible())return;
    text('mnt-current-version',version());text('mnt-current-connection',connection());text('mnt-current-session',allowed()?'Administrador':'Acceso no disponible');
    root.document.querySelectorAll('[data-mnt-action]').forEach(function(button){var page=button.dataset.mntPage;button.disabled=!allowed()||(page&&root.permisoModulo?.(page)!==true);});
    if(!allowed())cancel();
    if(!observer&&root.MutationObserver&&el('fb-status')){observer=new root.MutationObserver(function(){if(visible())render();});observer.observe(el('fb-status'),{childList:true,subtree:true,characterData:true});}
  }
  function context(){return {user:root.fbAuth?.currentUser,uid:root.currentUserUid,role:root.currentRole,db:root.fbDB,epoch:root._svOperacionesSesionEpoch,revision:root.PERMISOS_ROLES?.[root.currentRole]?.indiceRevision};}
  function current(c){return allowed()&&root.fbAuth?.currentUser===c.user&&root.currentUserUid===c.uid&&root.currentRole===c.role&&root.fbDB===c.db&&root._svOperacionesSesionEpoch===c.epoch&&root.PERMISOS_ROLES?.[c.role]?.indiceRevision===c.revision;}
  function notify(message){if(typeof root.notify==='function')root.notify(message);}
  async function open(page,review){
    if(!allowed()||root.permisoModulo?.(page)!==true){notify('No tenés permiso para abrir esta revisión.');return false;}
    if(pending)return false;
    var c=context(),state={controller:new root.AbortController(),page:page};pending=state;
    function valid(){return pending===state&&current(c)&&el('page-'+page)?.classList.contains('active')===true;}
    try{
      root.showPage(page);
      if(!review)return true;
      if(typeof root.SVDataReadiness?.waitForPage!=='function'){notify('No se pudo confirmar la carga de clientes.');return false;}
      var result=await root.SVDataReadiness.waitForPage(page,{signal:state.controller.signal,isCurrent:valid});
      if(!result.ready||!valid())return false;
      await root.abrirRevisionClientesDuplicados();return valid();
    }finally{if(pending===state)pending=null;}
  }
  function generate(){
    if(!visible()||!allowed())return false;
    var date=new Date(),stamp=date.toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'});
    report={context:context(),filename:date.toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}),text:['SisVentas · Diagnóstico de sesión','Fecha: '+stamp,'Versión: '+version(),'Conexión: '+connection(),'Sesión: Administrador','','Alcance: información de esta sesión. No comprueba saldos ni la integridad completa de la base.','No incluye datos de clientes, ventas ni pagos.'].join('\n')};
    var output=el('mnt-diagnostic-output');if(output){output.textContent=report.text;output.hidden=false;}
    var download=el('mnt-diagnostic-download');if(download)download.disabled=false;
    text('mnt-diagnostic-status','Diagnóstico generado. Podés descargarlo para soporte.');return true;
  }
  function download(){
    if(!report||!visible()||!current(report.context)){clearReport();return false;}
    var url=root.URL.createObjectURL(new root.Blob([report.text],{type:'text/plain;charset=utf-8'})),anchor=root.document.createElement('a');
    anchor.href=url;anchor.download='sisventas-diagnostico-'+report.filename+'.txt';root.document.body.appendChild(anchor);
    try{anchor.click();}finally{anchor.remove();root.setTimeout(function(){root.URL.revokeObjectURL(url);},0);}return true;
  }
  root.mntInicializar=render;
  root.SVMaintenanceCenter=Object.freeze({initialize:render,openClients:function(){return open('clientes',true);},openExpenses:function(){return open('gastos',false);},openSales:function(){return open('detalle',false);},generate:generate,download:download});
  root.document.addEventListener('sisventas:configuration-tab-changed',function(event){if(event.detail?.tab==='mantenimiento')render();else cancel();});
  root.document.addEventListener('sisventas:page-changed',function(event){if(event.detail?.page!=='configuracion'&&report)clearReport();if(pending&&event.detail?.page!==pending.page)cancel();});
  root.document.addEventListener('sisventas:session-ended',cancel);
  root.document.addEventListener('sisventas:role-changed',function(){cancel();render();});
  root.document.addEventListener('sisventas:session-ready',function(){cancel();render();});
})(window);
