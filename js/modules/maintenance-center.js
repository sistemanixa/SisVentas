(function(root){
  'use strict';
  var report=null,pending=null,reviews=[],reviewContext=null;
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
  function cancel(){if(pending){pending.controller.abort();pending=null;}reviews=[];reviewContext=null;clearReport();text('mnt-review-results','');text('mnt-review-progress','');var cancelButton=el('mnt-review-cancel');if(cancelButton)cancelButton.hidden=true;}
  function render(){
    if(!visible())return;
    root.document.querySelectorAll('[data-mnt-action]').forEach(function(button){var page=button.dataset.mntPage;button.disabled=!allowed()||(page&&root.permisoModulo?.(page)!==true);});
    if(!allowed())cancel();
  }
  function context(){return {user:root.fbAuth?.currentUser,uid:root.currentUserUid,role:root.currentRole,db:root.fbDB,epoch:root._svOperacionesSesionEpoch,revision:root.PERMISOS_ROLES?.[root.currentRole]?.indiceRevision};}
  function current(c){return allowed()&&root.fbAuth?.currentUser===c.user&&root.currentUserUid===c.uid&&root.currentRole===c.role&&root.fbDB===c.db&&root._svOperacionesSesionEpoch===c.epoch&&root.PERMISOS_ROLES?.[c.role]?.indiceRevision===c.revision;}
  function notify(message){if(typeof root.notify==='function')root.notify(message);}
  async function open(page,review){
    if(!allowed()||root.permisoModulo?.(page)!==true){notify('No tenés permiso para abrir esta revisión.');return false;}
    if(pending)return false;
    var c=context(),state={controller:new root.AbortController(),page:review?'configuracion':page};pending=state;
    function valid(){return pending===state&&current(c)&&(review?visible():el('page-'+page)?.classList.contains('active')===true);}
    try{
      if(!review){root.showPage(page);return true;}
      if(typeof root.svCargarDatosDePaginaActual!=='function'){notify('No se pudo preparar la revisión de clientes.');return false;}
      root.svCargarDatosDePaginaActual(page);
      if(typeof root.SVDataReadiness?.waitForPage!=='function'){notify('No se pudo confirmar la carga de clientes.');return false;}
      var result=await root.SVDataReadiness.waitForPage(page,{signal:state.controller.signal,isCurrent:valid});
      if(!result.ready||!valid())return false;
      await root.abrirRevisionClientesDuplicados();return valid();
    }finally{if(pending===state)pending=null;}
  }
  function paintReview(result){
    var host=el('mnt-review-results');if(!host)return;
    var section=root.document.createElement('section'),heading=root.document.createElement('h3'),summary=root.document.createElement('p');
    section.className='mnt-review-result';heading.textContent=result.kind==='expenses'?'Gastos':'Ventas y cobros';
    var issues=result.results.filter(function(row){return row.status!=='ok';});
    summary.textContent=result.checked+' de '+result.total+' revisados · '+issues.length+' requieren atención'+(result.partial?' · Informe parcial · '+Math.max(0,result.total-result.checked)+' pendientes':result.complete?' · Recorrido terminado':' · Revisión incompleta');
    section.appendChild(heading);section.appendChild(summary);
    var checkedList=root.document.createElement('details'),checkedTitle=root.document.createElement('summary'),checkedBody=root.document.createElement('p');checkedTitle.textContent='Qué se comprobó';checkedBody.textContent=Array.from(new Set(result.results.flatMap(function(row){return row.checks||[];}))).join(' · ');checkedList.appendChild(checkedTitle);checkedList.appendChild(checkedBody);section.appendChild(checkedList);
    var scope=root.document.createElement('p');scope.className='mnt-center-note';scope.textContent='Se comprobaron vínculos explícitos. No es una conciliación de importes ni una certificación de toda la base.';section.appendChild(scope);
    var list=root.document.createElement('div'),offset=0,more=root.document.createElement('button');more.type='button';more.className='btn btn-sm';
    function next(){issues.slice(offset,offset+30).forEach(function(row){var item=root.document.createElement('details'),title=root.document.createElement('summary'),body=root.document.createElement('p');title.textContent=String(row.label||'Registro sin número')+' · '+(row.status==='unavailable'?'No comprobable':'Requiere revisión');body.textContent=row.issues.join(' · ');item.appendChild(title);item.appendChild(body);list.appendChild(item);});offset+=30;more.hidden=offset>=issues.length;more.textContent='Mostrar más hallazgos';}
    more.onclick=next;next();section.appendChild(list);section.appendChild(more);host.appendChild(section);
  }
  async function runReview(kind){
    var page=kind==='expenses'?'gastos':'detalle';
    if(pending||!visible()||!allowed()||root.permisoModulo?.(page)!==true)return false;
    if(kind==='sales'&&root.permisoModulo?.('cobranzas')!==true){notify('La revisión requiere acceso a cobros.');return false;}
    var c=context(),state={controller:new root.AbortController(),page:'configuracion'};pending=state;
    var cancelButton=el('mnt-review-cancel');if(cancelButton)cancelButton.hidden=false;
    function valid(){return pending===state&&!state.controller.signal.aborted&&root.document.hidden!==true&&root.navigator?.onLine!==false&&current(c)&&visible()&&root.permisoModulo?.(page)===true&&(kind!=='sales'||root.permisoModulo?.('cobranzas')===true);}
    function assert(){if(!valid())throw Object.assign(Error('La revisión se canceló.'),{name:'AbortError'});}
    function key(value){return typeof value==='string'&&value.length>0&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);}
    async function read(path){
      assert();var parts=String(path).split('/'),domain=parts[1],validPath=path==='sv_record_list_config'||path==='sisventas/listados_resumen/gastos'||path==='sisventas/listados_resumen/gastos/_svCoverage'||(parts[0]==='sisventas'&&((['gastos','empleados','hsextra_solicitudes','clientes','ordenes_trabajo','presupuestos','pagos'].includes(domain)&&parts.length===3&&key(parts[2]))||(['ctaemp','aguinaldos'].includes(domain)&&parts.length===4&&key(parts[2])&&key(parts[3]))));
      if(!validPath)throw Error('Referencia fuera del alcance de esta revisión.');
      var payrollPoint=domain==='ctaemp'||domain==='aguinaldos';
      if(payrollPoint){if(root.permisoModulo?.('ctaemp')!==true||root.tienePermiso?.('empleados.verCuentas')!==true)throw Object.assign(Error('Referencia laboral no autorizada.'),{code:'permission-denied'});}
      else if(typeof root.svPuedeLeerDominio==='function'&&domain!=='listados_resumen'&&parts[0]==='sisventas'&&root.svPuedeLeerDominio(domain)!==true)throw Object.assign(Error('No hay permiso para comprobar esta referencia.'),{code:'permission-denied'});
      var value;if(domain==='presupuestos')value=(await root.SVCommercialOwnership.request('presupuestos','registro/'+encodeURIComponent(parts[2]))).record;else value=(await root.fbGet(root.fbRef(c.db,path))).val();assert();return value;
    }
    var loading=root.SVDataReadiness?.beginSource('maintenanceReview','maintenance/'+kind),reader=null;
    function progress(value){if(!valid())return;var checked=Number.isSafeInteger(value.checked)?value.checked:0,total=Number.isSafeInteger(value.total)?value.total:0;text('mnt-review-progress',(kind==='expenses'?'Revisando gastos':'Revisando ventas y cobros')+'… '+checked+(total?' de '+total:''));}
    try{
      progress({checked:0,total:0});var audit;
      if(kind==='expenses')audit=root.SVMaintenanceExpenses.create({read:read,valid:valid,onProgress:progress});
      else{
        reader=root.SVCommercialPagesReader.create({sdk:{ref:root.fbRef,get:root.fbGet,query:root.fbQuery,orderByKey:root.fbOrderByKey,startAt:root.fbStartAt,limitToFirst:root.fbLimitToFirst},capture:function(){return {uid:c.uid,role:c.role,auth:c.user,db:c.db,permissionRevision:c.revision,route:'configuracion',hidden:!valid(),viewing:!!root._impersonacionOriginal,online:root.navigator?.onLine!==false,canReadPayments:root.permisoModulo?.('cobranzas')===true};}});
        audit=root.SVMaintenanceSales.create({reader:reader,read:read,history:async function(id){assert();if(!key(id))throw Error('Referencia de venta inválida.');var result=await root.SVCommercialOwnership.request('ventas','registro/'+encodeURIComponent(id)+'?para=pagos');assert();return result;},valid:valid,onProgress:progress});
      }
      state.stop=function(){if(state.userCancelled)return;state.userCancelled=true;var partial=audit.snapshot?.();state.controller.abort();if(current(c)&&visible()&&root.document.hidden!==true){if(partial&&partial.checked>0){if(reviewContext&&!current(reviewContext))reviews=[];reviewContext=c;reviews=reviews.filter(function(old){return old.kind!==kind;});reviews.push(partial);text('mnt-review-results','');reviews.forEach(paintReview);generate();}text('mnt-review-progress','Revisión cancelada. '+(partial?partial.checked+' de '+partial.total+' revisados. ':'')+'El informe conserva los resultados disponibles. No se modificaron registros.');}if(cancelButton)cancelButton.hidden=true;};
      var result=await audit.run();assert();if(reviewContext&&!current(reviewContext))reviews=[];reviewContext=c;reviews=reviews.filter(function(old){return old.kind!==kind;});reviews.push(result);text('mnt-review-results','');reviews.forEach(paintReview);generate();loading?.ready();text('mnt-review-progress',result.complete?'Revisión terminada. No se modificaron registros.':'La revisión quedó incompleta. Consultá los hallazgos.');return true;
    }catch(error){if(error.name==='AbortError')loading?.cancel();else loading?.error();if(!state.userCancelled&&pending===state&&current(c)&&visible())text('mnt-review-progress',error.name==='AbortError'?'Revisión cancelada. No se modificaron registros.':'No se pudo completar esta revisión. No se modificaron registros.');return false;}
    finally{reader?.reset();if(pending===state){pending=null;if(cancelButton)cancelButton.hidden=true;}}
  }
  function generate(){
    if(!visible()||!allowed()||!reviews.length||!reviewContext||!current(reviewContext))return false;
    var date=new Date(),stamp=date.toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'});
    var lines=['SisVentas · Informe de mantenimiento','Fecha: '+stamp,'Versión: '+version(),'Conexión: '+connection(),''];
    reviews.forEach(function(result){lines.push(result.kind==='expenses'?'GASTOS':'VENTAS Y COBROS',result.partial?'INFORME PARCIAL · REVISIÓN CANCELADA':result.complete?'Recorrido terminado dentro del alcance indicado.':'REVISIÓN INCOMPLETA',result.checked+' de '+result.total+' registros revisados.','Comprobaciones: '+Array.from(new Set(result.results.flatMap(function(row){return row.checks||[];}))).join(' · '));result.results.filter(function(row){return row.status!=='ok';}).forEach(function(row){lines.push(String(row.label||'Registro sin número')+': '+row.issues.join(' · '));});lines.push('');});
    lines.push('Alcance: vínculos explícitos y fuentes consultadas en esta revisión. No certifica saldos, contabilidad ni la ausencia de otros vínculos. No modificó registros.');
    report={context:context(),filename:date.toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'}),text:lines.join('\n')};
    var output=el('mnt-diagnostic-output');if(output){output.textContent=report.text;output.hidden=false;}
    var download=el('mnt-diagnostic-download');if(download)download.disabled=false;
    text('mnt-diagnostic-status','Informe actualizado con el alcance y los hallazgos de las revisiones.');return true;
  }
  function download(){
    if(!report||!visible()||!current(report.context)){clearReport();return false;}
    var url=root.URL.createObjectURL(new root.Blob([report.text],{type:'text/plain;charset=utf-8'})),anchor=root.document.createElement('a');
    anchor.href=url;anchor.download='sisventas-mantenimiento-'+report.filename+'.txt';root.document.body.appendChild(anchor);
    try{anchor.click();}finally{anchor.remove();root.setTimeout(function(){root.URL.revokeObjectURL(url);},0);}return true;
  }
  root.mntInicializar=render;
  root.SVMaintenanceCenter=Object.freeze({initialize:render,openClients:function(){return open('clientes',true);},openExpenses:function(){return runReview('expenses');},openSales:function(){return runReview('sales');},cancelReview:function(){if(pending?.stop)pending.stop();else pending?.controller.abort();},generate:generate,download:download});
  root.document.addEventListener('sisventas:configuration-tab-changed',function(event){if(event.detail?.tab==='mantenimiento')render();else cancel();});
  root.document.addEventListener('sisventas:page-changed',function(event){if(event.detail?.page!=='configuracion'&&report)clearReport();if(pending&&event.detail?.page!==pending.page)cancel();});
  root.document.addEventListener('sisventas:session-ended',cancel);
  root.document.addEventListener('sisventas:role-changed',function(){cancel();render();});
  root.document.addEventListener('sisventas:session-ready',function(){cancel();render();});
  root.document.addEventListener('visibilitychange',function(){if(root.document.hidden)cancel();});
})(window);
