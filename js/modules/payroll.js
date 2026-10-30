/* ══════════════════════════════════════════════════════════════════════════════
   v20.362 — Fuente única definitiva para SAC y Horas Extra
   - Gastos queda como única fuente real de registros pagables.
   - Las ramas legacy se migran una sola vez a Gastos.
   - El alta nueva de SAC y aprobación de Hs Extra ya NO escribe en aguinaldos/ctaemp.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
  function _sv348Today(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function _sv348Arr(obj){
    return Object.keys(obj || {}).map(function(k){ var v = obj[k] || {}; if (v && typeof v === 'object' && !v.fbKey) v.fbKey = k; return v; });
  }
  function _sv348Norm(v){ return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function _sv348EmpleadoSeleccionado(key){
    if (window.aguSelKeys322 && typeof window.aguSelKeys322.has === 'function') return window.aguSelKeys322.has(key);
    var chk = document.querySelector('.agu-check-322[data-key="' + String(key || '').replace(/"/g,'\\"') + '"]');
    return !chk || chk.checked;
  }
  function _sv348EsSacGasto(g, empKey, semKey, semLbl){
    if (!g || g.anulado === true || _sv348Norm(g.estado) === 'anulado') return false;
    var emp = String(g.empleadoFbKey || g.empleadoId || g.empFbKey || '');
    if (String(empKey || '') && emp && emp !== String(empKey || '')) return false;
    var tp = _sv348Norm(g.tipoPagable || '');
    var desc = _sv348Norm(g.descripcion || g.concepto || '');
    var cat = _sv348Norm(g.categoria || '');
    var esSac = tp === 'aguinaldo' || desc.indexOf('aguinaldo') >= 0 || desc.indexOf('sac') >= 0;
    if (!esSac || (cat && cat !== 'personal' && desc.indexOf('aguinaldo') < 0 && desc.indexOf('sac') < 0)) return false;
    if (String(g.semestre || '') === String(semKey || '')) return true;
    return semLbl && desc.indexOf(_sv348Norm(semLbl)) >= 0;
  }
  function _sv348ExisteSacEnGastos(empleados, semKey, semLbl){
    var keys = new Set((empleados || []).map(function(e){ return String(e.fbKey || ''); }));
    return (window.gastosData || gastosData || []).some(function(g){
      var emp = String(g.empleadoFbKey || g.empleadoId || g.empFbKey || '');
      return keys.has(emp) && _sv348EsSacGasto(g, emp, semKey, semLbl);
    });
  }

  // Gastos debe mostrar solamente gastos reales; los legacy se migran a registros reales.
  window.gastosFiltradosActuales = function() {
    var fTipo   = (document.getElementById('gas-f-tipo')||{}).value   || '';
    var fEstado = (document.getElementById('gas-f-estado')||{}).value || '';
    var fMes    = (document.getElementById('gas-f-mes')||{}).value;
    if (fMes === undefined) fMes = 'mes';
    var inp = document.querySelector('#gasto-list input.search-input');
    var fBusq = inp ? String(inp.value||'').toLowerCase() : '';
    var hoyD = new Date();
    var mesActual = hoyD.toISOString().slice(0,7);
    var mes3m = (function(){ var d=new Date(hoyD); d.setMonth(d.getMonth()-2); return d.toISOString().slice(0,7); })();
    var anioActual = String(hoyD.getFullYear());
    return (window.gastosData || gastosData || []).filter(function(g){
      if(typeof window.svGastoCoincideCategoria==='function'&&!window.svGastoCoincideCategoria(g))return false;var origenCobertura=window._svSalaryExpenseFilter;if(origenCobertura&&!window.SVSalaryCoverage.businessTotal({item:g},[origenCobertura.category],origenCobertura.period).lines.length)return false;
      var tipoNorm   = normalizarTipoGasto(g);
      var estadoNorm = normalizarEstadoGasto(g);
      var matchTipo   = !fTipo   || tipoNorm === fTipo;
      var matchEstado = !fEstado || estadoNorm === fEstado;
      var txt = ((g.descripcion||'') + ' ' + (g.categoria||'') + ' ' + (g.semestre||'') + ' ' + (g.empleadoNombre||'')).toLowerCase();
      var matchBusq   = !fBusq || txt.includes(fBusq);
      var matchMes = true;
      var f = (typeof _normFechaGasto === 'function') ? _normFechaGasto(g.fecha) : (g.fecha || '');
      if (fMes === 'mes') matchMes = f.slice(0,7) === mesActual;
      else if (fMes === '3m') matchMes = f.slice(0,7) >= mes3m;
      else if (fMes === 'anio') matchMes = f.slice(0,4) === anioActual;
      var matchKpiVence = true;
      if (window._filtroGastosKpiVence) {
        var venc = g.vencimiento || '';
        matchKpiVence = venc >= window._filtroGastosKpiVence.desde && venc <= window._filtroGastosKpiVence.hasta;
      }
      var matchKpiReembolso = true;
      if (window._filtroGastosKpiReembolso) {
        matchKpiReembolso = !!(g.empleadoId && normalizarEstadoGasto(g) !== 'pagado' && !g.reembolsado);
      }
      return matchTipo && matchEstado && matchBusq && matchMes && matchKpiVence && matchKpiReembolso;
    });
  };

  document.addEventListener('sisventas:payroll-modal-opened',function(){
    setTimeout(function(){
      var viejo = document.getElementById('agu-fecha-box-347');
      if (viejo) viejo.remove();
      var fecha = document.getElementById('agu-fecha');
      if (fecha && !fecha.value) fecha.value = _sv348Today();
    }, 20);
  });

function calculateSources(empleados, habData, anio, sem, maximum, cargos) {
  var mesesSem = _mesesDelSemestre(anio, sem);
  // El máximo queda fijado por el formulario antes de comparar las fuentes.
  var maxVal = parseFloat(String(maximum || '').replace(/\./g,'').replace(',','.')) || 0;

  return empleados.map(function(e) {
    var historial = habData[e.fbKey] || {};
    var mejorSueldo = 0;
    var mesesConDatos = 0;
    mesesSem.forEach(function(mesISO) {
      var mesKey = mesISO.replace('-','_');
      var reg = historial[mesKey];
      if (reg && reg.sueldo) {
        mesesConDatos++;
        if (reg.sueldo > mejorSueldo) mejorSueldo = reg.sueldo;
      }
    });
    if (mejorSueldo === 0) {
      var cargoInfo = e.cargoId ? cargos[e.cargoId] : null;
      mejorSueldo = cargoInfo ? Math.round((parseFloat(cargoInfo.valorHora)||0) * 8 * (parseFloat(cargoInfo.diasMes)||0)) : 0;
    }
    var mesesTrabajados = _mesesTrabajadosEnSemestre(e.fechaIngreso, anio, sem);
    var aguinaldoTotal = Math.round(((mejorSueldo / 12) * mesesTrabajados) * 100) / 100;

    // Aplicar límite máximo
    var aguinaldo = aguinaldoTotal;
    var limitado = false;
    if (maxVal > 0 && aguinaldoTotal > maxVal) {
      aguinaldo = maxVal;
      limitado = true;
    }
    var pct = aguinaldoTotal > 0 ? Math.round(aguinaldo / aguinaldoTotal * 1000) / 10 : 100;

    var fmt = function(n) {
      return (n % 1 === 0)
        ? n.toLocaleString('es-AR')
        : n.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
    };

    return {
      e: e,
      mejorSueldo: mejorSueldo,
      mesesConDatos: mesesConDatos,
      mesesTrabajados: mesesTrabajados,
      aguinaldoTotal: aguinaldoTotal,
      aguinaldo: aguinaldo,
      aguinaldoDisplay: fmt(aguinaldo),
      aguinaldoTotalDisplay: fmt(aguinaldoTotal),
      limitado: limitado,
      pct: pct
    };
  });
}

  async function saveSources(capture,semKey,fechaGasto,semLbl,operacionKey,permitirDuplicado){
    if(!window.fbDB||typeof window.SVLaborWrites?.atomic!=='function'||!window.SVPayrollSourceSnapshot)throw Object.assign(new Error('Actualizá la aplicación para registrar los haberes con sus fuentes actuales.'),{svLaborAttempted:false});
    var sourcePlan=window.SVPayrollSourceSnapshot.plan({employeeIds:capture.employees.map(function(e){return e.fbKey;}),employees:Object.fromEntries(capture.employees.map(function(e){return [e.fbKey,e];})),haberes:capture.haberes,year:capture.period.year,half:capture.period.half,budget:128});
    var stamp=Date.now(),created=0,lastRows=[];
    var result=await window.SVLaborWrites.atomic({paths:sourcePlan.paths,purpose:'employee-sac-batch',build:function(values){
      window.SVPayrollSemester.assertConfirmation(capture);
      var actual=window.SVPayrollSourceSnapshot.materialize(sourcePlan,values);
      var rows=calculateSources(actual.employees,actual.haberes,capture.period.year,capture.period.half,capture.maximum,actual.cargos),gastos=values['sisventas/gastos']||{},updates={};
      created=0;lastRows=rows;
      rows.forEach(function(row,index){
        if(!(parseFloat(row.aguinaldo)>0)||!row.e?.fbKey)return;
        var key=_claveOperacionConcurrente('aguinaldo',permitirDuplicado?[row.e.fbKey,semKey,operacionKey]:[row.e.fbKey,semKey]);
        if(gastos[key])return;
        var exists=Object.keys(gastos).some(function(id){var g=gastos[id]||{};return String(g.tipoPagable||'').toLowerCase()==='aguinaldo'&&String(g.empleadoFbKey||g.empleadoId||'')===String(row.e.fbKey)&&String(g.semestre||'')===String(semKey);});
        if(exists&&!permitirDuplicado)return;
        var next=_pagableGastoBase({fecha:fechaGasto,tipo:'Fijo',tipoPagable:'aguinaldo',descripcion:'Aguinaldo '+(row.e.nombre||'')+' — '+semLbl,monto:row.aguinaldo,medio:'Transferencia',empleadoFbKey:row.e.fbKey,empleadoNombre:row.e.nombre||'',semestre:semKey,mejorSueldo:row.mejorSueldo,legacyKey:'sac/'+row.e.fbKey+'/'+semKey,ts:stamp+index});
        gastos[key]=next;updates['sisventas/gastos/'+key]=next;created++;
      });
      return created?updates:undefined;
    }});
    return {committed:true,unchanged:!result?.committed,count:result?.committed?created:0,rows:lastRows,readScope:sourcePlan.readScope};
  }
  window.SVPayrollFinancial=Object.freeze({calculate:calculateSources,save:saveSources});

  window.confirmarRegistroAguinaldo = async function(){
    if (window._aguinaldoGuardando) { notify('Ya se está registrando el aguinaldo'); return; }
    if (!window.tienePermiso('empleados.registrarHaberes')) { notify('Sin permiso para registrar aguinaldos'); return; }
    if (!window.fbDB) { notify('Sin conexión'); return; }
    var sel = document.getElementById('agu-sem-sel');
    var actual = (typeof _semestreActual === 'function') ? _semestreActual() : { anio: new Date().getFullYear(), sem: (new Date().getMonth() < 6 ? 1 : 2) };
    var partes = sel ? String(sel.value || '').split('-') : [String(actual.anio), String(actual.sem)];
    var anio = parseInt(partes[0], 10);
    var sem  = parseInt(partes[1], 10);
    var semKey = anio + '_S' + sem;
    var semLbl = (sem === 1 ? '1er semestre' : '2do semestre') + ' ' + anio;
    var fechaInp = document.getElementById('agu-fecha');
    var fechaGasto = (fechaInp && fechaInp.value) ? fechaInp.value : _sv348Today();
    var captura;
    try { captura=window.SVPayrollSemester.captureConfirmation(); }
    catch(error){notify(error.message);return;}
    var empleados=captura.employees;
    if (!empleados.length) { notify('Seleccioná al menos un empleado'); return; }
    window._aguinaldoGuardando = true;
    window.SVPayrollSemester.saving(captura,true);
    try {
      var permitirDuplicado = false;
      if (_sv348ExisteSacEnGastos(empleados, semKey, semLbl)) {
        if (!await window.svConfirm('Ya existe aguinaldo registrado en Gastos para uno o más empleados en ' + semLbl + '. Si está mal, eliminá ese gasto. ¿Registrar de nuevo de todas formas?')) return;
        permitirDuplicado = true;
      }

      var editor = document.getElementById('modal-aguinaldo');
      var operacionKey = editor && editor.dataset.aguinaldoOperacion;
      if (!operacionKey) {operacionKey='sac_'+Date.now()+'_'+Math.random().toString(36).slice(2,9);if(editor)editor.dataset.aguinaldoOperacion=operacionKey;}
      window.SVPayrollSemester.assertConfirmation(captura);
      var resultado = await saveSources(captura,semKey,fechaGasto,semLbl,operacionKey,permitirDuplicado);
      var contador = resultado.count;
      if (!resultado || !resultado.committed) throw new Error('No se pudo confirmar el aguinaldo');
      if(!window.SVPayrollSemester.confirmed(captura))return;
      window.SVPayrollSemester.close(true);
      notify(contador?'✓ Aguinaldo de ' + semLbl + ' registrado en Gastos con fecha ' + fechaGasto + ' (' + contador + ' empleados)':'No se generaron nuevos gastos: revisá los importes y los aguinaldos ya registrados.');
      if (contador && typeof registrarActividad === 'function') registrarActividad('Aguinaldo registrado en Gastos', semLbl + ' — ' + contador + ' empleados');
    } catch(err) {
      if(window.SVPayrollSemester.confirmed(captura)){if(err?.code===window.SVPayrollSourceSnapshot?.REPLAN_CODE)window.SVPayrollSemester.invalidate(captura,err.message);notify('Error al registrar aguinaldo: ' + (err && err.message ? err.message : err));}
    } finally { window._aguinaldoGuardando = false; window.SVPayrollSemester.saving(captura,false); }
  };
})();

/* Lectura semestral explícita. Cada modal conserva su contexto y descarta respuestas retiradas. */
(function(root){
 'use strict';
 var doc=root.document,state=null,sequence=0;
 var clone=function(value){return JSON.parse(JSON.stringify(value));};
 function error(message,code){return Object.assign(new Error(message),{code:code||'SV_PAYROLL_INCOMPLETE'});}
 function allowed(){return !!root.tienePermiso?.('empleados.registrarHaberes')&&!root._impersonacionOriginal;}
 function employees(){return Object.values(root.empData||{}).filter(function(e){return e&&e.activo!==false;}).map(function(e){if(typeof e.fbKey!=='string'||!e.fbKey||/[\x00-\x20.#$\[\]\/]/.test(e.fbKey)||['__proto__','constructor','prototype'].indexOf(e.fbKey)>=0)throw error('Hay un empleado con una referencia inválida.');return clone(e);});}
 function employeeSignature(value){return JSON.stringify({employees:value,cargos:value.map(function(e){return [e.cargoId||'',root.CARGOS_DATA?.[e.cargoId]??null];})});}
 function semester(){var value=String(doc.getElementById('agu-sem-sel')?.value||'');if(!/^\d{4}-[12]$/.test(value)||Number(value.slice(0,4))<1000)throw error('Elegí un semestre válido.');return {value:value,year:Number(value.slice(0,4)),half:Number(value.slice(5)),months:root._mesesDelSemestre(Number(value.slice(0,4)),Number(value.slice(5))).map(function(month){return month.replace('-','_');})};}
 function current(target){return !!target&&state===target&&!target.closed&&allowed()&&target.context()&&target.modal.isConnected!==false&&doc.getElementById('modal-aguinaldo')===target.modal;}
 function check(target){if(!current(target))throw error('La sesión o la ventana cambió. Volvé a abrir Aguinaldo.','SV_PAYROLL_CANCELLED');}
 function foreground(){return doc.hidden!==true&&!['hidden','prerender'].includes(doc.visibilityState)&&root.SVForegroundSession?.isVisible?.()!==false;}
 function readCapabilities(){if(!foreground())throw error('Volvé a esta ventana y pulsá Reintentar para comprobar el semestre.');if(root.navigator?.onLine===false)throw error('Se necesita conexión para comprobar el semestre.');if(!root.fbDB||typeof root.fbRef!=='function'||typeof root.fetch!=='function'||typeof root.AbortController!=='function')throw error('Actualizá la aplicación para comprobar el semestre de forma segura.');var user=root.fbAuth?.currentUser,uid=root.currentUserUid;if(!user||user.uid!==uid||typeof user.getIdToken!=='function')throw error('Verificá tu sesión antes de comprobar el semestre.');return {user:user,uid:uid};}
 async function readSemester(ids,period,valid,target){
  var auth=readCapabilities(),controller=new root.AbortController(),timer=root.setTimeout(function(){controller.abort();},20000),result=Object.create(null),cursor=0,aborted=false;
  target.aborts.add(controller);
  function checkRead(){valid();if(!foreground())throw error('La lectura se pausó al ocultar la ventana. Pulsá Reintentar al volver.','SV_PAYROLL_PAUSED');if(controller.signal.aborted||root.fbAuth?.currentUser!==auth.user||root.currentUserUid!==auth.uid)throw error('La conexión o la sesión cambió. Volvé a comprobar el semestre.','SV_PAYROLL_CANCELLED');}
  try{
   checkRead();var token;try{token=await Promise.race([auth.user.getIdToken(),new Promise(function(_,reject){controller.signal.addEventListener('abort',function(){reject(error('No se pudo verificar la sesión para comprobar el semestre.'));},{once:true});})]);}catch(_){throw error('No se pudo verificar la sesión para comprobar el semestre.');}
   checkRead();if(typeof token!=='string'||!token)throw error('No se pudo verificar la sesión para comprobar el semestre.');
   async function worker(){while(!aborted){checkRead();var index=cursor++;if(index>=ids.length)return;var id=ids[index],destination;try{destination=new URL(root.fbRef(root.fbDB,'sisventas/haberes/'+id).toString().replace(/\/$/,'')+'.json');if(destination.protocol!=='https:')throw error('La conexión a los haberes no es segura.');destination.searchParams.set('auth',token);destination.searchParams.set('orderBy',JSON.stringify('$key'));destination.searchParams.set('startAt',JSON.stringify(period.months[0]));destination.searchParams.set('endAt',JSON.stringify(period.months[5]));var response;try{response=await root.fetch(destination.href,{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});}catch(_){throw error('No se pudo comprobar el semestre en el servidor. Revisá la conexión y reintentá.');}checkRead();if(!response.ok)throw error(response.status===401||response.status===403?'No tenés acceso para comprobar los haberes del semestre.':'El servidor no pudo comprobar el semestre completo.');var source;try{source=await response.json();}catch(_){throw error('El servidor no devolvió un semestre válido.');}checkRead();if(source!==null&&(typeof source!=='object'||Array.isArray(source)))throw error('El servidor no devolvió un semestre válido.');var selected=Object.create(null);period.months.forEach(function(month){if(source&&Object.hasOwn(source,month))selected[month]=clone(source[month]);});result[id]=selected;}catch(failure){aborted=true;controller.abort();throw failure;}}}
   await Promise.all(Array.from({length:Math.min(6,ids.length)},worker));checkRead();return result;
  }finally{root.clearTimeout(timer);target.aborts.delete(controller);}
 }
 function selectedKeys(){var keys=root.SVPayrollSelector?.selectedKeys?.();if(!Array.isArray(keys))throw error('No se pudo verificar la selección de empleados.');return keys;}
 function inputSignature(){return JSON.stringify([semester().value,String(doc.getElementById('agu-maximo')?.value||''),String(doc.getElementById('agu-fecha')?.value||''),selectedKeys().slice().sort()]);}
 function confirmButton(target){return target.modal.querySelector('button[onclick*="confirmarRegistroAguinaldo"]');}
 function status(target,message,isError){if(!current(target))return;var body=doc.getElementById('agu-tabla-body'),total=doc.getElementById('agu-total-lbl');if(body)body.innerHTML='<p role="'+(isError?'alert':'status')+'" style="padding:16px;color:var(--text3)">'+root.escapeHTML(message)+'</p>'+(isError?'<button type="button" class="btn btn-sm" onclick="recalcularAguinaldo()">Reintentar</button>':'');if(total)total.textContent='—';var button=confirmButton(target);if(button)button.disabled=true;}
 function paint(target){check(target);if(!target.snapshot||target.loadedKey!==semester().value+'|'+employeeSignature(employees()))return false;var period=semester(),rows=root._calcularFilasAguinaldo(target.employees,target.snapshot,period.year,period.half),body=doc.getElementById('agu-tabla-body'),total=doc.getElementById('agu-total-lbl');if(body)body.innerHTML=root._renderTablaAguinaldo(rows);if(total)total.textContent='$'+Math.round(rows.reduce(function(sum,row){return sum+row.aguinaldo;},0)).toLocaleString('es-AR');root.SVPayrollSelector.apply();var button=confirmButton(target);if(button)button.disabled=false;return true;}
 async function recalculate(){
  var target=state;if(!target)return false;try{check(target);if(target.saving)return false;var period=semester(),active=employees(),key=period.value+'|'+employeeSignature(active);if(target.loadedKey===key&&target.snapshot){paint(target);return true;}if(target.pendingKey===key&&target.pending)return target.pending;
   var generation=++sequence;target.generation=generation;target.aborts.forEach(function(controller){controller.abort();});target.aborts.clear();target.pendingKey=key;target.snapshot=null;target.loadedKey='';status(target,'Cargando datos del semestre…',false);
   function valid(){check(target);if(target.generation!==generation||semester().value!==period.value||employeeSignature(employees())!==employeeSignature(active))throw error('La selección del semestre o los empleados cambió. Volvé a cargar el semestre.','SV_PAYROLL_STALE');}
   var promise=readSemester(active.map(function(e){return e.fbKey;}),period,valid,target).then(function(data){valid();target.snapshot=data;target.employees=active;target.loadedKey=key;paint(target);return true;}).catch(function(failure){if(current(target)&&target.generation===generation){target.snapshot=null;target.loadedKey='';status(target,failure.code==='SV_PAYROLL_STALE'?failure.message:'No se pudo cargar el semestre completo. '+failure.message,true);}return false;}).finally(function(){if(state===target&&target.generation===generation){target.pending=null;target.pendingKey='';}});
   target.pending=promise;return promise;
  }catch(failure){if(current(target))status(target,failure.message,true);else if(state===target)close(true);return false;}
 }
 function attach(modal){if(state)close(true);if(!['reset','apply','selectedKeys'].every(function(name){return typeof root.SVPayrollSelector?.[name]==='function';}))throw error('Actualizá la aplicación para verificar la selección de empleados.');if(!allowed())throw error('Sin permiso para registrar aguinaldos.');var context=root.svCapturarContextoOperacion?.();if(typeof context!=='function'||!context())throw error('Verificá tu sesión para continuar.');state={modal:modal,context:context,generation:++sequence,loadedKey:'',pendingKey:'',snapshot:null,pending:null,saving:false,closed:false,employees:[],aborts:new Set(),overflow:doc.body.style.overflow,focus:doc.activeElement};doc.body.style.overflow='hidden';root.SVPayrollSelector.reset();root.svSincronizarPilaModales?.();modal.setAttribute('role','dialog');modal.setAttribute('aria-label','Registrar aguinaldo');modal.setAttribute('aria-modal','true');modal.setAttribute('tabindex','-1');modal.setAttribute('data-sv-escape-owner','true');modal.addEventListener('keydown',function(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}else if(event.key==='Tab'){var controls=Array.from(modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')).filter(function(control){return control.getClientRects().length;});var first=controls[0],last=controls[controls.length-1];if(!controls.length){event.preventDefault();modal.focus({preventScroll:true});}else if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}}});doc.getElementById('agu-sem-sel')?.focus({preventScroll:true});return recalculate();}
 function close(force){var target=state;if(!target)return;if(target.saving&&!force){root.notify('Se está registrando el aguinaldo. Esperá la confirmación.');return;}target.closed=true;target.generation=++sequence;target.aborts.forEach(function(controller){controller.abort();});target.aborts.clear();state=null;target.modal.remove();doc.body.style.overflow=target.overflow;root.svSincronizarPilaModales?.();if(target.context()&&target.focus?.isConnected)target.focus.focus({preventScroll:true});}
 function captureConfirmation(){var target=state;check(target);if(target.saving||!target.snapshot||target.pending||target.loadedKey!==semester().value+'|'+employeeSignature(employees()))throw error('Esperá a que termine de cargar el semestre antes de registrar.');var active=employees(),keys=selectedKeys(),chosen=active.filter(function(e){return keys.indexOf(e.fbKey)>=0;});if(!chosen.length)throw error('Seleccioná al menos un empleado');if(new Set(keys).size!==keys.length||keys.some(function(key){return !chosen.some(function(e){return e.fbKey===key;});}))throw error('Cambió la selección de empleados. Volvé a revisar el semestre.');return {target:target,employees:chosen,haberes:clone(target.snapshot),maximum:String(doc.getElementById('agu-maximo')?.value||''),period:semester(),input:inputSignature(),employeeSignature:employeeSignature(active)};}
 function assertConfirmation(capture){check(capture.target);if(inputSignature()!==capture.input||employeeSignature(employees())!==capture.employeeSignature)throw error('Cambió el semestre, la selección o los datos del empleado. No se registró el aguinaldo.','SV_PAYROLL_STALE');}
 function invalidate(capture,message){if(state!==capture.target)return;capture.target.snapshot=null;capture.target.loadedKey='';status(capture.target,message||'Los datos cambiaron. Volvé a cargar el semestre.',true);}
 function saving(capture,value){var target=capture.target;if(state!==target)return;if(!current(target)){close(true);return;}target.saving=value;var primary=confirmButton(target);if(primary){target.primaryHTML??=primary.innerHTML;var animation=typeof root.matchMedia==='function'&&root.matchMedia('(prefers-reduced-motion: reduce)').matches?'none':'spin .8s linear infinite';primary.setAttribute('aria-busy',String(value));primary.innerHTML=value?'<span aria-hidden="true" style="display:inline-block;width:14px;height:14px;flex:0 0 14px;box-sizing:border-box;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:'+animation+'"></span> Comprobando y registrando…':target.primaryHTML;}target.modal.setAttribute('aria-busy',String(value));target.modal.querySelectorAll('input,select,button').forEach(function(control){control.disabled=value;});if(value)target.modal.focus({preventScroll:true});if(!value){try{if(target.snapshot&&target.loadedKey===semester().value+'|'+employeeSignature(employees()))paint(target);else status(target,'El semestre cambió. Volvé a cargarlo antes de registrar.',true);}catch(failure){status(target,failure.message,true);}}}
 function confirmed(capture){return current(capture.target);}
 function pauseReads(){var target=state;if(!target||foreground()||target.saving||!target.pending&&!target.aborts.size)return;target.generation=++sequence;target.aborts.forEach(function(controller){controller.abort();});target.aborts.clear();target.pending=null;target.pendingKey='';target.snapshot=null;target.loadedKey='';status(target,'La lectura se pausó al ocultar la ventana. Pulsá Reintentar al volver.',true);}
 doc.addEventListener('visibilitychange',pauseReads);doc.addEventListener('sisventas:foreground-paused',function(){var target=state;if(!target||target.saving)return;target.generation=++sequence;target.aborts.forEach(function(controller){controller.abort();});target.aborts.clear();target.pending=null;target.pendingKey='';target.snapshot=null;target.loadedKey='';status(target,'La lectura se pausó. Pulsá Reintentar al volver.',true);});
 for(var name of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed'])doc.addEventListener(name,function(){close(true);});
 root.SVPayrollSemester=Object.freeze({attach:attach,recalculate:recalculate,close:close,captureConfirmation:captureConfirmation,assertConfirmation:assertConfirmation,invalidate:invalidate,saving:saving,confirmed:confirmed});
 root.recalcularAguinaldo=recalculate;root.cerrarModalAguinaldo=function(){close(false);};
})(window);

window.abrirModalAguinaldo = async function() {
  if(window._aguinaldoGuardando){notify('Se está registrando el aguinaldo. Esperá la confirmación.');return;}
  if (!window.tienePermiso('empleados.registrarHaberes')) { notify('Solo el administrador puede registrar aguinaldos'); return; }
  if (!window.fbDB) { notify('Sin conexión'); return; }
  var empleados = Object.values(empData||{}).filter(function(e){ return e.activo !== false; });
  if (!empleados.length) { notify('No hay empleados activos'); return; }

  var actual = _semestreActual();

  var habData = {};

  var filas = [];
  var totalGeneral = filas.reduce(function(s,f){ return s + f.aguinaldo; }, 0);

  Array.from(document.querySelectorAll('#modal-aguinaldo')).forEach(function(prev){ prev.remove(); });

  var overlay = document.createElement('div');
  overlay.id = 'modal-aguinaldo';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px';

  overlay.innerHTML =
    '<div class="sac-dialog" style="background:var(--bg2);border-radius:var(--radius-lg);width:100%;max-width:720px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.4)">' +
      '<div class="sac-header" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:0.5px solid var(--border);flex-shrink:0">' +
        '<div>' +
          '<div style="font-weight:700;font-size:15px"><i class="ti ti-gift" style="margin-right:8px;color:var(--amber)"></i>Registrar aguinaldo (SAC)</div>' +
          '<div style="font-size:12px;color:var(--text3);margin-top:2px">Mejor sueldo del semestre ÷ 12 × meses trabajados — se generará un gasto en categoría Personal por cada empleado</div>' +
        '</div>' +
        '<button aria-label="Cerrar aguinaldo" onclick="cerrarModalAguinaldo()" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:20px;padding:4px"><i class="ti ti-x"></i></button>' +
      '</div>' +
      '<div style="padding:12px 20px;border-bottom:0.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
        '<label style="font-size:13px;color:var(--text2);white-space:nowrap">Semestre a liquidar:</label>' +
        '<select id="agu-sem-sel" onchange="recalcularAguinaldo()" style="padding:6px 10px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:13px;font-family:inherit">' +
          _opcionesSemestre(actual) +
        '</select>' +
        '<label style="font-size:13px;color:var(--text2);white-space:nowrap">Fecha del gasto:</label>' +
        '<input type="date" id="agu-fecha" value="' + svFechaLocalISO() + '" style="padding:6px 10px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:13px;font-family:inherit">' +
        '<div class="sac-maximum" style="display:flex;align-items:center;gap:8px;margin-left:auto">' +
          '<label style="font-size:13px;color:var(--text2);white-space:nowrap">Máximo por empleado:</label>' +
          '<input type="text" id="agu-maximo" placeholder="Sin límite" oninput="recalcularAguinaldo()" ' +
            'style="width:130px;padding:6px 10px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:13px;font-family:inherit;text-align:right">' +
        '</div>' +
      '</div>' +
      '<div id="agu-tabla-body" style="overflow-y:auto;flex:1;padding:12px 20px">' +
        '<p role="status" style="padding:16px;color:var(--text3)">Cargando datos del semestre…</p>' +
      '</div>' +
      '<div class="sac-footer" style="padding:14px 20px;border-top:0.5px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:space-between">' +
        '<div style="font-size:14px"><span style="color:var(--text3)">Total a registrar:</span> <strong style="font-size:16px" id="agu-total-lbl">$' + totalGeneral.toLocaleString('es-AR') + '</strong></div>' +
        '<button class="btn btn-primary" onclick="confirmarRegistroAguinaldo()"><i class="ti ti-check"></i> Confirmar y registrar gastos</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  overlay.addEventListener('mousedown', function(e){ if(e.target===overlay) window.cerrarModalAguinaldo(); });
  try{return await window.SVPayrollSemester.attach(overlay);}
  catch(error){overlay.remove();notify(error.message);return false;}
};
