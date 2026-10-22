(function(root,factory){
 'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){root.SVBonusGrant=api.create(root);root.abrirModalBonificacionEmpleado=root.SVBonusGrant.open;root.cerrarModalBonificacionEmpleado=root.SVBonusGrant.close;root.guardarBonificacionEmpleado=root.SVBonusGrant.save;}
})(typeof window==='object'?window:null,function(){
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 const failure=(message,code='SV_BONUS_BATCH_INPUT')=>Object.assign(new Error(message),{code,svLaborAttempted:false});
 const metadataFields=['bonificacionCantidad','bonificacionValorUnitario','bonificacionGrupoId','bonificacionDestinatarios','bonificacionGrupoTotal','bonificacionGrupoPersonas'];
 const immutable=['tipo','tipoPagable','estado','monto','fecha','periodoComputo','descripcion','motivo','empleadoId','empleadoFbKey','legacyKey','operacionId','bonificacionConceptoId','bonificacionConceptoNombre',...metadataFields];
 const active=employee=>employee&&employee.activo!==false&&String(employee.estado||'').toLowerCase()!=='inactivo';
 function same(actual,expected){return actual&&immutable.every(field=>field==='estado'||JSON.stringify(actual[field]??null)===JSON.stringify(expected[field]??null));}
 function validDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const day=new Date(value+'T12:00:00');return Number.isFinite(day.getTime())&&day.getFullYear()===Number(value.slice(0,4))&&day.getMonth()+1===Number(value.slice(5,7))&&day.getDate()===Number(value.slice(8,10));}
 function create(root){
  const Model=root.SVBonusQuantity,doc=root.document;let state=null,events=false;
  const node=id=>doc?.getElementById(id),allowed=()=>typeof root.tienePermiso==='function'&&root.tienePermiso('empleados.bonificar')&&!root._impersonacionOriginal;
  const money=value=>'$'+Number(value).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const escape=value=>root.escapeHTML(String(value??''));
  function contextCheck(check){if(!allowed()||typeof check!=='function'||!check())throw failure('La sesión o el permiso cambió. Volvé a abrir Bonificaciones.','SV_BONUS_ACCESS');}
  function operationId(){
   if(typeof root.crypto?.randomUUID==='function')return 'bono_'+root.crypto.randomUUID().replace(/-/g,'_');
   if(typeof root.crypto?.getRandomValues!=='function')throw failure('No se pudo identificar el guardado. Actualizá la aplicación.');
   return 'bono_'+Array.from(root.crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
  }
  function prepare(input){
   contextCheck(input.context);if(!validDay(input.fecha)||!root._bonificacionMesValido(input.periodoComputo))throw failure('Revisá la fecha y el mes de cómputo.');
   const motivo=String(input.motivo||'').trim();if(!motivo||motivo.length>500)throw failure('Indicá un motivo de hasta 500 caracteres.');
   const plan=Model.plan({empleados:input.empleados,valorUnitario:input.valorUnitario});
   const operation=input.operacionId;if(typeof operation!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(operation))throw failure('Volvé a abrir la bonificación para continuar.');
   const stamp=Date.now(),base={tipo:'bonificacion',estado:'aprobado',fecha:input.fecha,periodoComputo:input.periodoComputo,descripcion:'Bonificación · '+motivo,motivo,
    aprobadoPor:root.currentUser||'admin',aprobadoTs:stamp,usuario:root.currentUser||'admin',origenCarga:'manual_empleados',ts:stamp};
   if(input.concepto?.id){base.bonificacionConceptoId=String(input.concepto.id);base.bonificacionConceptoNombre=String(input.concepto.nombre||'');}
   const records=plan.items.map(item=>{
    const movementKey=Model.operationKey('bonificacion',[item.empleadoId,operation]),expenseKey=Model.operationKey('gasto_bonificacion',[item.empleadoId,operation]);
    const movementPath='sisventas/ctaemp/'+item.empleadoId+'/'+movementKey,expensePath='sisventas/gastos/'+expenseKey,employeePath='sisventas/empleados/'+item.empleadoId;
    const metadata=Model.metadata(item,operation,plan),movement={...base,...metadata,monto:item.monto,empleadoId:item.empleadoId,fbKey:movementKey,gastoFbKey:expenseKey,legacyKey:'ctaemp/'+item.empleadoId+'/'+movementKey,operacionId:operation};
    const expense=root._pagableGastoBase({fecha:base.fecha,tipo:'Variable',tipoPagable:'bonificacion',descripcion:base.descripcion,monto:item.monto,empleadoFbKey:item.empleadoId,legacyKey:movement.legacyKey,ts:stamp});
    Object.assign(expense,metadata,{estado:'aprobado',requiereAprobacion:false,aprobadoPor:base.aprobadoPor,aprobadoTs:stamp,movimientoCtaKey:movementKey,origen:'bonificacion',operacionId:operation,periodoComputo:base.periodoComputo,motivo});
    if(base.bonificacionConceptoId){expense.bonificacionConceptoId=base.bonificacionConceptoId;expense.bonificacionConceptoNombre=base.bonificacionConceptoNombre;}
    return {employeeId:item.empleadoId,movementPath,expensePath,employeePath,movement,expense};
   });
   return freeze({operation,plan,records,context:input.context});
  }
  async function register(attempt){
   contextCheck(attempt.context);if(!root.fbDB||typeof root.SVLaborWrites?.atomic!=='function')throw failure('No hay conexión segura para registrar la bonificación.');
   let replayed=false;
   const result=await root.SVLaborWrites.atomic({purpose:'employee-bonus-batch',paths:attempt.records.flatMap(row=>[row.movementPath,row.expensePath,row.employeePath]),build:function(values){
    contextCheck(attempt.context);const patch={};let existing=0;
    for(const row of attempt.records){
     const employee=values[row.employeePath],movement=values[row.movementPath],expense=values[row.expensePath];
     if(!active(employee))throw failure('Uno de los empleados ya no está activo. No se registró el grupo.','SV_BONUS_EMPLOYEE_UNAVAILABLE');
     if(movement||expense){
      if(!same(movement,row.movement)||!same(expense,row.expense)||movement.gastoFbKey!==row.expensePath.split('/').at(-1)||expense.movimientoCtaKey!==row.movementPath.split('/').at(-1))throw failure('El grupo ya existe parcialmente o tiene otro detalle. Se conservaron sus importes y pagos.','SV_BONUS_BATCH_CONFLICT');
      existing++;continue;
     }
     patch[row.movementPath]={...clone(row.movement),empleadoNombre:employee.nombre||''};patch[row.expensePath]={...clone(row.expense),empleadoNombre:employee.nombre||''};
    }
    if(existing){if(existing!==attempt.records.length)throw failure('El grupo no está completo. No se agregaron bonificaciones para evitar duplicados.','SV_BONUS_BATCH_CONFLICT');replayed=true;return;}
    return patch;
   }});
   if(result?.committed!==true&&!replayed)throw failure('No se confirmó el registro del grupo.','SV_BONUS_UNCONFIRMED');
   return {count:attempt.records.length,total:attempt.plan.total,replayed};
  }
  function selected(){return Array.from(node('bonificacion-destinatarios').querySelectorAll('[data-bonus-employee]')).filter(input=>input.checked).map(input=>({empleadoId:input.value,cantidad:input.closest('[data-bonus-row]').querySelector('[data-bonus-quantity]').value}));}
  function refresh(){
   if(!state)return;const rows=selected(),price=root.getMontoRaw(node('bonificacion-monto'));let plan=null;
   node('bonificacion-destinatarios').querySelectorAll('[data-bonus-row]').forEach(row=>{const checked=row.querySelector('[data-bonus-employee]').checked,quantity=row.querySelector('[data-bonus-quantity]'),subtotal=row.querySelector('[data-bonus-subtotal]');quantity.disabled=state.busy||!!state.attempt||!checked;subtotal.textContent='—';if(checked)try{subtotal.textContent=money(Model.line(quantity.value,price).monto);}catch(_){} });
   try{plan=Model.plan({empleados:rows,valorUnitario:price});}catch(_){}
   const summary=node('bonificacion-resumen');summary.textContent=plan?plan.items.length+' empleado'+(plan.items.length===1?'':'s')+' · '+plan.unidades.toLocaleString('es-AR',{maximumFractionDigits:3})+' unidades · Total '+money(plan.total):'Elegí los empleados e indicá unidades y valor por unidad.';
   return plan;
  }
  function setBusy(busy){
   if(!state)return;state.busy=busy;const modal=node('modal-bonificacion-empleado');modal.setAttribute('aria-busy',String(busy));
   modal.querySelectorAll('input,select,button').forEach(control=>{control.disabled=busy||!!state.attempt&&control.tagName!=='BUTTON';});
   const button=node('bonificacion-guardar');button.innerHTML=busy?'<i class="ti ti-loader-2 ti-spin" aria-hidden="true"></i> Registrando…':'<i class="ti ti-check"></i> '+(state.attempt?'Comprobar guardado':'Registrar bonificaciones');
   if(busy)modal.querySelector('.bonus-grant-modal')?.focus({preventScroll:true});
   refresh();
  }
  function open(){
   if(!allowed()){root.notify('No tenés permiso para dar bonificaciones.');return false;}if(state?.busy||state?.attempt&&!state.resolvedFailure){root.notify('Comprobá el guardado del grupo abierto antes de iniciar otro.');return false;}
   const context=root.svCapturarContextoOperacion?.();let operation;try{contextCheck(context);operation=operationId();}catch(error){root.notify(error.message);return false;}
   const modal=node('modal-bonificacion-empleado'),list=node('bonificacion-destinatarios');if(!modal||!list||!Model){root.notify('No se pudo cargar el formulario de bonificaciones. Actualizá la aplicación.');return false;}
   if(state)close(true);const seen=new Set();
   const employees=Object.values(root.empData||{}).filter(active).filter(employee=>{if(!employee.fbKey||seen.has(employee.fbKey))return false;seen.add(employee.fbKey);return true;}).sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));
   state={context,operation,busy:false,attempt:null,focus:doc.activeElement,overflow:doc.body.style.overflow};
   root._bonificacionEmpleadoContexto=context;root._bonificacionEmpleadoOperacionId=operation;root._bonificacionEmpleadoGuardando=false;root._bonificacionEmpleadoConcepto=null;
   const today=root.svFechaLocalISO();node('bonificacion-fecha').value=today;node('bonificacion-mes').value=today.slice(0,7);node('bonificacion-motivo').value='';root._setMontoInput(node('bonificacion-monto'),0);
   list.innerHTML=employees.map((employee,index)=>'<div class="bonus-grant-row" data-bonus-row><label class="bonus-grant-person"><input type="checkbox" data-bonus-employee value="'+escape(employee.fbKey)+'"><span>'+escape(employee.nombre||'Sin nombre')+'</span></label><label class="bonus-grant-units" for="bonificacion-cantidad-'+index+'"><span>Unidades</span><input type="text" inputmode="decimal" maxlength="14" id="bonificacion-cantidad-'+index+'" data-bonus-quantity value="1" disabled aria-label="Unidades para '+escape(employee.nombre||'el empleado')+'"></label><output data-bonus-subtotal aria-label="Importe de '+escape(employee.nombre||'el empleado')+'">—</output></div>').join('')||'<p>No hay empleados activos disponibles.</p>';
   node('bonificacion-error').textContent='';setBusy(false);modal.style.display='flex';doc.body.style.overflow='hidden';root.initMoneyInputsEn?.(modal);
   if(!events){events=true;modal.addEventListener('input',refresh);modal.addEventListener('change',refresh);modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}else if(event.key==='Tab'){const controls=Array.from(modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')).filter(control=>control.getClientRects().length);const first=controls[0],last=controls.at(-1);if(!first){event.preventDefault();modal.querySelector('.bonus-grant-modal')?.focus({preventScroll:true});}else if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}}});}
   root.svSincronizarPilaModales?.();node('bonificacion-monto').focus({preventScroll:true});return true;
  }
  function close(force=false){
   if(!state)return;if(!force&&(state.busy||state.attempt&&!state.resolvedFailure)){root.notify('Comprobá el guardado del grupo antes de cerrar.');return;}
   const previous=state;state=null;const modal=node('modal-bonificacion-empleado');if(modal){modal.style.display='none';modal.removeAttribute('aria-busy');}
   doc.body.style.overflow=previous.overflow;root._bonificacionEmpleadoGuardando=false;root._bonificacionEmpleadoContexto=null;root._bonificacionEmpleadoOperacionId='';root._bonificacionEmpleadoConcepto=null;
   root.svSincronizarPilaModales?.();if(previous.context()&&previous.focus?.isConnected)previous.focus.focus({preventScroll:true});
  }
  async function save(){
   const current=state;if(!current||current.busy)return;node('bonificacion-error').textContent='';
   try{contextCheck(current.context);if(!current.attempt)current.attempt=prepare({context:current.context,operacionId:current.operation,empleados:selected(),valorUnitario:root.getMontoRaw(node('bonificacion-monto')),fecha:node('bonificacion-fecha').value,periodoComputo:node('bonificacion-mes').value,motivo:node('bonificacion-motivo').value,concepto:root._bonificacionEmpleadoConcepto});}
   catch(error){node('bonificacion-error').textContent=error.message;return;}
   setBusy(true);root._bonificacionEmpleadoGuardando=true;
   try{
    const result=await register(current.attempt);if(state!==current||!current.context())return;
    current.busy=false;current.attempt=null;close();
    try{root.notify('✓ '+result.count+' bonificación'+(result.count===1?'':'es')+' registrada'+(result.count===1?'':'s')+' · '+money(result.total)+' · disponible'+(result.count===1?'':'s')+' para abonar en Gastos');}catch(_){}
   }catch(error){
    if(state!==current||!current.context())return;
    const conflict=error.code==='SV_BONUS_BATCH_CONFLICT';
    current.resolvedFailure=conflict&&(error.svLaborAttempted===false||error.statusCode===409)||error.code==='SV_CAS_CONFLICT'&&error.statusCode===409;
    if(!conflict&&(error.svLaborAttempted===false||[400,401,403].includes(error.statusCode)||error.code==='SV_LABOR_REJECTED'||error.code==='SV_BONUS_EMPLOYEE_UNAVAILABLE'&&error.statusCode===409)){current.attempt=null;current.operation=operationId();root._bonificacionEmpleadoOperacionId=current.operation;}
    node('bonificacion-error').textContent=error.message||'No se confirmó el guardado. Comprobá el mismo intento antes de repetirlo.';
   }finally{if(state===current&&current.context()){root._bonificacionEmpleadoGuardando=false;setBusy(false);}}
  }
  if(doc)for(const event of ['sisventas:session-ended','sisventas:role-changed','sisventas:page-changed'])doc.addEventListener(event,()=>close(true));
  return {prepare,register,open,close,save,refresh};
 }
 return {create,validDay};
});
