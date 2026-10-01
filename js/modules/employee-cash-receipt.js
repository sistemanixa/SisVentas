(function(root){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cash=value=>String(value||'').trim().toLowerCase()==='efectivo';
  const employeeKey=g=>String(g.empleadoFbKey||g.empleadoId||(String(g.legacyKey||'').startsWith('ctaemp/')?g.legacyKey.split('/')[1]:'')||'');
  // El pago inicial de un gasto pagado por el técnico es su desembolso al
  // proveedor; no acredita una entrega de dinero de la empresa al empleado.
  function eligible(g,p){return !!(g&&p&&employeeKey(g)&&cash(p.medio)&&p.origen!=='alta_gasto'&&(!p.moneda||String(p.moneda).toUpperCase()==='ARS')&&!p.anulado&&String(p.estado||'').toLowerCase()!=='anulado'&&Number.isFinite(Number(p.monto))&&Number(p.monto)>0);}
  function model(g,key,p,token,employee,company){
    if(!eligible(g,p))throw Error('El recibo requiere un pago vigente en efectivo vinculado a un empleado.');
    employee=employee||{};company=company||{};
    const name=employee.nombre||g.empleadoNombre;
    if(!name)throw Error('Falta identificar al empleado que recibe el efectivo.');
    return {reference:'RE-'+key+'-'+token,employee:String(name),dni:String(employee.dni||''),
      employeeKey:employeeKey(g),amount:Number(p.monto),date:String(p.fecha||''),
      concept:String(g.descripcion||g.tipoPagable||'Pago a empleado'),period:String(g.periodoTrabajo||g.mes||''),
      company:String(company.nombre||'Nixa'),address:String(company.dir||''),cuit:String(company.cuit||''),
      operator:String(p.usuario||''),corrected:!!p.editadoTs};
  }
  function html(m){
    const date=/^\d{4}-\d{2}-\d{2}$/.test(m.date)?m.date.split('-').reverse().join('/'):m.date||'________________';
    const amount=m.amount.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
    return '<!doctype html><html lang="es"><meta charset="utf-8"><title>Recibo de efectivo</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#172334;background:white;margin:0;padding:28px}header{border-bottom:3px solid #25496c;padding-bottom:18px;display:flex;justify-content:space-between;gap:20px}h1{font-size:21px;margin:0 0 9px}h2{font-size:16px;margin:0 0 8px}p{line-height:1.6;overflow-wrap:anywhere}small{color:#526071}.reference{font-size:10px;overflow-wrap:anywhere}.amount{font-size:25px;background:#eef3f7;padding:18px;border:1px solid #d1dce5;margin:24px 0}.data{display:grid;grid-template-columns:1fr 1fr;gap:12px}.data p{margin:5px 0}.concept{white-space:pre-wrap;border-top:1px solid #cad4dd;padding-top:16px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px 30px;margin-top:70px}.line{border-top:1px solid #333;padding-top:8px;min-height:35px}footer{margin-top:40px;border-top:1px solid #ddd;padding-top:12px;font-size:11px}@media print{body{padding:0}.receipt{break-inside:avoid}}</style><body><article class="receipt"><header><div><h1>Comprobante de entrega de efectivo</h1><h2>'+esc(m.company)+'</h2><small>'+esc(m.address)+(m.cuit?'<br>CUIT: '+esc(m.cuit):'')+'</small></div><div><b>Fecha del pago</b><p>'+esc(date)+'</p></div></header><p class="reference">Referencia del pago: '+esc(m.reference)+(m.corrected?' · Pago corregido':'')+'</p><div class="data"><p><b>Empleado:</b><br>'+esc(m.employee)+'</p><p><b>DNI:</b><br>'+esc(m.dni||'____________________________')+'</p></div><div class="amount">Importe recibido: <b>$ '+esc(amount)+' ARS</b></div><p>Recibí de <b>'+esc(m.company)+'</b> la suma de <b>$ '+esc(amount)+' ARS en efectivo</b>, por el siguiente concepto:</p><p class="concept">'+esc(m.concept)+'</p>'+(m.period?'<p><b>Período:</b> '+esc(m.period)+'</p>':'')+'<div class="signatures"><div class="line">Firma de quien recibe</div><div class="line">Aclaración</div><div class="line">DNI</div><div class="line">Fecha de recepción: ____ / ____ / ________</div></div><footer>Medio de pago: efectivo · Registrado por: '+esc(m.operator||'Sistema')+'<br>Importe correspondiente exclusivamente al pago identificado en este comprobante.</footer></article></body></html>';
  }
  if(typeof module!=='undefined')module.exports={eligible,model,html};
  if(!root.document)return;
  const allowed=()=>typeof root.puedeAdministrarGastos==='function'&&root.puedeAdministrarGastos();
  function company(){const value=id=>document.getElementById(id)?.value||'';return {nombre:value('cfg-empresa-nombre'),dir:value('cfg-empresa-dir'),cuit:value('cfg-empresa-cuit')};}
  function entries(g){return Array.isArray(g.pagos)?g.pagos.map((p,i)=>['legacy_'+i,p]):Object.entries(g.pagos||{});}
  async function read(key,token){
    if(!allowed())throw Error('No tenés permiso para imprimir pagos a empleados.');
    if(!root.fbDB||!root.fbGet)throw Error('Se necesita conexión para verificar el pago antes de imprimir.');
    const g=(await root.fbGet(root.fbRef(root.fbDB,'sisventas/gastos/'+key))).val();
    if(!g)throw Error('El gasto ya no está disponible.');
    const p=entries(g).find(([k])=>k===token)?.[1];
    const employees=Object.values(root.empData||{}),emp=employees.find(e=>String(e.fbKey||e.id)===employeeKey(g));
    return model(g,key,p,token,emp,company());
  }
  function report(error){if(root.notify)root.notify(error.message||String(error));}
  async function preview(key,token){
    try{
      const receipt=await read(key,token);
      document.getElementById('employee-cash-receipt')?.remove();
      const dialog=document.createElement('dialog');dialog.id='employee-cash-receipt';
      dialog.style.cssText='width:min(900px,95vw);height:90vh;max-height:95vh;padding:16px;background:var(--bg2,#101b2e);color:var(--text,#fff);border:1px solid var(--border2);border-radius:14px';
      dialog.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px"><strong>Recibo de efectivo · '+esc(receipt.employee)+'</strong><div><button class="btn btn-primary" data-print>Imprimir / Guardar PDF</button> <button class="btn" data-close>Cerrar</button></div></div><p data-status role="status" style="margin:6px 0"></p><iframe title="Comprobante de entrega de efectivo" style="width:100%;height:calc(100% - 80px);border:0;background:white"></iframe>';
      document.body.appendChild(dialog);const frame=dialog.querySelector('iframe');frame.srcdoc=html(receipt);
      dialog.querySelector('[data-close]').onclick=()=>{dialog.close();dialog.remove();};dialog.addEventListener('cancel',()=>dialog.remove());
      dialog.querySelector('[data-print]').onclick=async event=>{
        const button=event.currentTarget,status=dialog.querySelector('[data-status]');button.disabled=true;
        try{const latest=await read(key,token);await new Promise(resolve=>{frame.onload=resolve;frame.srcdoc=html(latest);});frame.contentWindow.focus();frame.contentWindow.print();status.textContent='Podés imprimir o elegir Guardar como PDF en el diálogo de impresión.';}
        catch(error){status.textContent=error.message;}
        finally{button.disabled=false;}
      };
      dialog.showModal();
    }catch(error){report(error);}
  }
  function offer(g,key,p,token){
    if(!allowed()||!eligible(g,p))return;
    let panel=document.getElementById('employee-cash-receipts-ready');
    if(!panel){panel=document.createElement('section');panel.id='employee-cash-receipts-ready';panel.style.cssText='position:fixed;right:18px;bottom:18px;z-index:10030;width:min(420px,94vw);max-height:45vh;overflow:auto;padding:16px;border:1px solid var(--border2);border-radius:12px;background:var(--bg2,#101b2e);color:var(--text,#fff);box-shadow:0 8px 35px #0005';panel.innerHTML='<button class="btn btn-sm" style="float:right" aria-label="Cerrar avisos de recibos">×</button><strong>Recibos de efectivo disponibles</strong><p>También podés imprimirlos desde el historial de pagos.</p><div data-receipts></div>';panel.querySelector('button').onclick=()=>panel.remove();document.body.appendChild(panel);}
    const id=key+'/'+token;if(Array.from(panel.querySelectorAll('[data-receipt]')).some(b=>b.dataset.receipt===id))return;
    const button=document.createElement('button');button.className='btn btn-primary';button.style.cssText='display:block;width:100%;margin-top:8px;white-space:normal';button.dataset.receipt=id;
    button.textContent='Imprimir recibo · '+(g.empleadoNombre||'Empleado')+' · $ '+Number(p.monto).toLocaleString('es-AR',{minimumFractionDigits:2});button.onclick=()=>preview(key,token);panel.querySelector('[data-receipts]').appendChild(button);
  }
  // El comprobante sólo se ofrece después de que el circuito existente termina.
  // Ninguna operación de impresión vuelve a registrar pagos o movimientos.
  const sync=root._actualizarCtaEmpPorPagoGasto;
  if(typeof sync==='function')root._actualizarCtaEmpPorPagoGasto=async function(g,key,total,paid,state,medium,token,payment){
    const result=await sync.apply(this,arguments);try{offer(g,key,payment,token);}catch(error){console.warn('[Recibos]',error);}return result;
  };
  const history=root.verPagosGasto;
  if(typeof history==='function')root.verPagosGasto=function(key){
    const result=history.apply(this,arguments);if(!allowed())return result;
    const g=(root.gastosData||[]).find(x=>x.fbKey===key),body=document.getElementById('hpg-body');if(!g||!body)return result;
    const payments=root._gastoPagosArray(g);
    payments.forEach((p,i)=>{if(!eligible(g,p))return;const row=body.children[i];if(!row)return;const button=document.createElement('button');button.className='btn btn-sm';button.textContent='Imprimir recibo';button.onclick=()=>preview(key,p._key||'legacy_'+p._idx);row.lastElementChild.appendChild(button);});return result;
  };
  document.addEventListener('sisventas:session-ended',()=>{document.getElementById('employee-cash-receipt')?.remove();document.getElementById('employee-cash-receipts-ready')?.remove();});
  root.SVEmployeeCashReceipt={preview};
})(typeof window==='undefined'?globalThis:window);
