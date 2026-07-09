/* v1.36.1 — Centro de diagnóstico y mantenimiento de base de datos */
var MNT_STATE = { analizado:false, integridadOK:false, pendientes:0, diag:null, inicializado:false };
function mntInicializar(){ if (MNT_STATE.inicializado) return; MNT_STATE.inicializado=true; mntLog('Centro de mantenimiento cargado.'); mntRenderMigraciones(null); }
function mntLog(msg){ var el=document.getElementById('mnt-console'); if(!el) return; var hora=new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); el.textContent+='['+hora+'] '+msg+'\n'; el.scrollTop=el.scrollHeight; }
function mntSetEstado(txt, cls){ var el=document.getElementById('mnt-estado-general'); if(!el) return; el.className='badge '+(cls||'b-amber'); el.textContent=txt; }
function mntSetText(id, txt){ var el=document.getElementById(id); if(el) el.textContent=txt; }
function mntObjCount(o){ return o && typeof o==='object' ? Object.keys(o).length : 0; }
function mntMoney(n){ return Math.round(parseFloat(n)||0); }
function mntVersion(){ return (window.APP_CONFIG && APP_CONFIG.VERSION) || (window.SISVENTAS_PWA_VERSION || 'v1'); }
function mntRequireAdmin(accion){ if(String(window.currentRole||'').toLowerCase()==='admin') return true; if(typeof notify==='function') notify('Solo el administrador puede ejecutar '+(accion||'esta accion')); return false; }
function mntFecha(f){ return (typeof _pagableNormFecha==='function') ? _pagableNormFecha(f) : (f||new Date().toISOString().slice(0,10)); }
function mntEmpByKey(empKey){ try { return (empData && Object.values(empData).find(function(e){ return String(e.fbKey||e.id||'')===String(empKey||''); })) || {}; } catch(e){ return {}; } }
function mntGastoExiste(gastos, tipoPagable, empKey, monto, fecha, semKey, legacyKey){
  if (typeof _pagableGastoExistente==='function') return !!_pagableGastoExistente(tipoPagable, empKey, monto, fecha, semKey, legacyKey);
  monto=mntMoney(monto); fecha=mntFecha(fecha);
  return (gastos||[]).some(function(g){ var desc=String(g.descripcion||'').toLowerCase(); var tipo=String(g.tipoPagable||'').toLowerCase(); var esTipo=tipo===tipoPagable||(tipoPagable==='aguinaldo'&&desc.indexOf('aguinaldo')>=0)||(tipoPagable==='hextra'&&(desc.indexOf('hs extra')>=0||desc.indexOf('horas extra')>=0))||(tipoPagable==='comision'&&desc.indexOf('comisi')>=0); if(!esTipo) return false; if(legacyKey&&String(g.legacyKey||'')===String(legacyKey)) return true; if(empKey&&(g.empleadoFbKey||g.empleadoId||'')&&String(g.empleadoFbKey||g.empleadoId)!==String(empKey)) return false; if(semKey&&g.semestre&&String(g.semestre)!==String(semKey)) return false; if(monto>0&&Math.abs(mntMoney(g.monto)-monto)>1) return false; return true; });
}
async function mntGet(path){ var snap=await window.fbGet(window.fbRef(window.fbDB,path)).catch(function(){return {val:function(){return null;}};}); return snap.val()||null; }
async function mntAnalizarBase(){
  if(!window.fbDB){ notify('Sin conexión Firebase'); return; }
  mntSetEstado('Analizando...','b-amber'); mntLog('Analizando base de datos...');
  var data=await Promise.all([mntGet('sisventas/gastos'),mntGet('sisventas/aguinaldos'),mntGet('sisventas/hsextra_solicitudes'),mntGet('sisventas/ctaemp'),mntGet('sisventas/migraciones'),mntGet('sisventas/empleados'),mntGet('sisventas/clientes'),mntGet('sisventas/productos'),mntGet('sisventas/ventas')]);
  var gastosObj=data[0]||{}, agu=data[1]||{}, hs=data[2]||{}, cta=data[3]||{}, migr=data[4]||{};
  var gastos=Object.keys(gastosObj).map(function(k){return Object.assign({fbKey:k},gastosObj[k]);});
  var aguTotal=0, aguPend=0, aguMigr=0;
  Object.keys(agu).forEach(function(empKey){ Object.keys(agu[empKey]||{}).forEach(function(semKey){ var r=agu[empKey][semKey]||{}; var monto=mntMoney(r.aguinaldo||r.monto||0); if(monto<=0) return; aguTotal++; var leg='aguinaldos/'+empKey+'/'+semKey; if(mntGastoExiste(gastos,'aguinaldo',empKey,monto,r.fecha,semKey,leg)) aguMigr++; else aguPend++; }); });
  var hsAprob=0, hsPend=0, hsMigr=0;
  Object.keys(hs).forEach(function(solKey){ var sol=hs[solKey]||{}; if(String(sol.estado||'').toLowerCase()!=='aprobado') return; var empKey=sol.empFbKey||sol.empleadoFbKey||sol.empleadoId||''; var monto=mntMoney(sol.monto||0); var leg='hsextra_solicitudes/'+solKey; hsAprob++; if(mntGastoExiste(gastos,'hextra',empKey,monto,sol.fecha,'',leg)) hsMigr++; else hsPend++; });
  var ctaPagables=0, ctaPend=0, ctaMigr=0, comPagables=0, comPend=0, comMigr=0;
  Object.keys(cta).forEach(function(empKey){ Object.keys(cta[empKey]||{}).forEach(function(mKey){ var m=cta[empKey][mKey]||{}; var tipo=String(m.tipo||'').toLowerCase(); var est=String(m.estado||'').toLowerCase(); if(tipo==='comision' && est!=='aprobado' && est!=='pagado_parcial' && est!=='pagado') return; if(tipo!=='hextra'&&tipo!=='aguinaldo'&&tipo!=='comision') return; var monto=mntMoney(m.monto||0); if(monto<=0) return; ctaPagables++; if(tipo==='comision') comPagables++; var leg='ctaemp/'+empKey+'/'+mKey; if(mntGastoExiste(gastos,tipo,empKey,monto,m.fecha,m.semestre||'',leg)) { ctaMigr++; if(tipo==='comision') comMigr++; } else { ctaPend++; if(tipo==='comision') comPend++; } }); });
  var pendientes=aguPend+hsPend+ctaPend;
  MNT_STATE={analizado:true,integridadOK:false,pendientes:pendientes,diag:{gastos:mntObjCount(gastosObj),aguTotal:aguTotal,aguPend:aguPend,aguMigr:aguMigr,hsAprob:hsAprob,hsPend:hsPend,hsMigr:hsMigr,ctaPagables:ctaPagables,ctaPend:ctaPend,ctaMigr:ctaMigr,comPagables:comPagables,comPend:comPend,comMigr:comMigr,migraciones:migr,empleados:mntObjCount(data[5]),clientes:mntObjCount(data[6]),productos:mntObjCount(data[7]),ventas:mntObjCount(data[8])}};
  mntSetText('mnt-kpi-gastos',MNT_STATE.diag.gastos); mntSetText('mnt-kpi-agu',aguTotal); mntSetText('mnt-kpi-hs',hsAprob); mntSetText('mnt-kpi-pend',pendientes);
  mntSetEstado(pendientes?'Requiere migración':'Base consistente',pendientes?'b-amber':'b-green');
  mntLog('Gastos: '+MNT_STATE.diag.gastos); mntLog('Aguinaldos legacy: '+aguTotal+' ('+aguPend+' pendientes, '+aguMigr+' ya migrados)'); mntLog('Horas extra aprobadas legacy: '+hsAprob+' ('+hsPend+' pendientes, '+hsMigr+' ya migradas)'); mntLog('Cuenta empleado legacy pagable: '+ctaPagables+' ('+ctaPend+' pendientes, '+ctaMigr+' ya migrados)'); mntLog('Comisiones legacy pagables: '+comPagables+' ('+comPend+' pendientes, '+comMigr+' ya migradas)');
  mntRenderMigraciones(migr); var btn=document.getElementById('mnt-btn-limpiar'); if(btn) btn.disabled=true;
}
function mntMigracionEstado(def, migr, diag){
  var m=migr[def.id]||{};
  var ok=String(m.estado||'').toLowerCase()==='ok';
  if(!MNT_STATE.analizado && !ok) return {cls:'b-amber',txt:'Sin analizar',sub:'—'};
  var total=def.total(diag||{});
  var pendientes=def.pend(diag||{});
  if(ok) return {cls:'b-green',txt:'Ejecutada',sub:m.fecha||'—'};
  if(pendientes>0) return {cls:'b-amber',txt:'Pendiente',sub:pendientes+' por migrar'};
  if(total>0) return {cls:'b-green',txt:'Ya cubierto',sub:'0 pendientes'};
  return {cls:'b-green',txt:'Sin pendientes',sub:'No aplica'};
}
function mntRenderMigraciones(migr){
  var box=document.getElementById('mnt-migraciones-lista'); if(!box) return;
  migr=migr||{};
  var diag=MNT_STATE.diag||{};
  var defs=[
    {id:'001-sac-gastos',label:'Aguinaldos legacy → Gastos',total:function(d){return d.aguTotal||0;},pend:function(d){return d.aguPend||0;}},
    {id:'002-horasextras-gastos',label:'Horas extra legacy → Gastos',total:function(d){return d.hsAprob||0;},pend:function(d){return d.hsPend||0;}},
    {id:'003-ctaemp-pagables-gastos',label:'Cuenta empleado pagable legacy → Gastos',total:function(d){return d.ctaPagables||0;},pend:function(d){return d.ctaPend||0;}},
    {id:'004-comisiones-gastos',label:'Comisiones aprobadas → Gastos',total:function(d){return d.comPagables||0;},pend:function(d){return d.comPend||0;}}
  ];
  box.innerHTML=defs.map(function(d){
    var e=mntMigracionEstado(d,migr,diag);
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:0.5px solid var(--border);border-radius:var(--radius);background:var(--bg3)"><div><div style="font-size:13px;font-weight:600;color:var(--text)">'+d.id+'</div><div style="font-size:12px;color:var(--text2)">'+d.label+'</div></div><div style="text-align:right"><span class="badge '+e.cls+'">'+e.txt+'</span><div style="font-size:11px;color:var(--text3);margin-top:4px">'+e.sub+'</div></div></div>';
  }).join('');
}
async function mntMigrarLegacy(){
  if(!mntRequireAdmin('migraciones de mantenimiento')) return;
  if(!window.fbDB){ notify('Sin conexión Firebase'); return; }
  if(!MNT_STATE.analizado) await mntAnalizarBase();
  mntSetEstado('Migrando...','b-amber'); mntLog('Iniciando migración controlada...'); var antes=Date.now();
  var creadosAntes=window._ultimaMigracionPagablesLegacy&&window._ultimaMigracionPagablesLegacy.creados?window._ultimaMigracionPagablesLegacy.creados:0;
  if(typeof _migracionPagablesLegacyEjecutada!=='undefined') _migracionPagablesLegacyEjecutada=false;
  if(typeof _migrarPagablesLegacyAGastos==='function') await _migrarPagablesLegacyAGastos();
  var comCreadas = 0;
  if (typeof _crearGastoComisionDesdeMovimiento === 'function') {
    var ctaCom = await mntGet('sisventas/ctaemp') || {};
    for (var empKeyCom of Object.keys(ctaCom)) {
      for (var movKeyCom of Object.keys(ctaCom[empKeyCom] || {})) {
        var movCom = ctaCom[empKeyCom][movKeyCom] || {};
        if (String(movCom.tipo||'').toLowerCase() !== 'comision') continue;
        var estCom = String(movCom.estado||'').toLowerCase();
        if (estCom !== 'aprobado' && estCom !== 'pagado_parcial' && estCom !== 'pagado') continue;
        var nuevoKeyCom = await _crearGastoComisionDesdeMovimiento(empKeyCom, movKeyCom, movCom).catch(function(){ return null; });
        if (nuevoKeyCom) comCreadas++;
      }
    }
    if (comCreadas) mntLog('Comisiones aprobadas migradas a Gastos: '+comCreadas);
  }
  var creados=window._ultimaMigracionPagablesLegacy&&typeof window._ultimaMigracionPagablesLegacy.creados==='number'?window._ultimaMigracionPagablesLegacy.creados:creadosAntes;
  creados += comCreadas;
  var usuario=currentUser||(currentUserData&&currentUserData.nombre)||'Admin'; var fecha=new Date().toISOString();
  var ver=mntVersion();
  await window.fbUpdate(window.fbRef(window.fbDB),{'sisventas/migraciones/001-sac-gastos':{estado:'OK',version:ver,fecha:fecha,usuario:usuario,registrosNuevos:creados},'sisventas/migraciones/002-horasextras-gastos':{estado:'OK',version:ver,fecha:fecha,usuario:usuario,registrosNuevos:creados},'sisventas/migraciones/003-ctaemp-pagables-gastos':{estado:'OK',version:ver,fecha:fecha,usuario:usuario,registrosNuevos:creados},'sisventas/migraciones/004-comisiones-gastos':{estado:'OK',version:ver,fecha:fecha,usuario:usuario,registrosNuevos:comCreadas}}).catch(function(e){mntLog('No se pudo guardar historial: '+e.message);});
  mntLog('Migración finalizada. Registros nuevos creados: '+creados+'. Tiempo: '+((Date.now()-antes)/1000).toFixed(2)+' s'); notify('✓ Migración finalizada'); await mntAnalizarBase();
}
async function mntVerificarIntegridad(){ if(!MNT_STATE.analizado) await mntAnalizarBase(); mntLog('Verificando integridad...'); var d=MNT_STATE.diag||{}; var issues=[]; if((d.aguPend||0)>0) issues.push('Aguinaldos sin gasto: '+d.aguPend); if((d.hsPend||0)>0) issues.push('Horas extra aprobadas sin gasto: '+d.hsPend); if((d.ctaPend||0)>0) issues.push('Movimientos de cuenta empleado sin gasto: '+d.ctaPend); if(!issues.length){MNT_STATE.integridadOK=true; mntSetEstado('Integridad OK','b-green'); var btn=document.getElementById('mnt-btn-limpiar'); if(btn) btn.disabled=false; mntLog('Integridad OK. La limpieza segura ya está habilitada.'); notify('✓ Integridad OK');} else {MNT_STATE.integridadOK=false; mntSetEstado('Integridad pendiente','b-amber'); var btn2=document.getElementById('mnt-btn-limpiar'); if(btn2) btn2.disabled=true; issues.forEach(mntLog); notify('Hay pendientes por migrar');} }

function mntNormDupTxt(v){
  return String(v||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[–—]/g,'-')
    .replace(/\s*-\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}/g,'')
    .replace(/\s*-\s*(\d{4}-\d{2}|\d{2}\/\d{4})/g,'')
    .replace(/\s+/g,' ')
    .trim();
}
function mntMesGasto(g){
  var f=mntFecha(g&&g.fecha); if(/^\d{4}-\d{2}/.test(f)) return f.slice(0,7);
  return String((g&&g.mes)||'').slice(0,7);
}
function mntEsFijoDuplicable(g){
  if(!g) return false;
  var tipo=String(g.tipo||'').toLowerCase();
  var desc=String(g.descripcion||'').toLowerCase();
  return !!(g.esFijoBase || tipo.indexOf('fijo')>=0 || desc.indexOf('gasto fijo')>=0 || desc.indexOf('haber ')===0 || desc.indexOf('sueldo')>=0 || desc.indexOf('alquiler')>=0);
}
function mntDupKeyGastoFijo(g){
  var mes=mntMesGasto(g);
  var monto=Math.round(parseFloat(g.monto)||0);
  var desc=mntNormDupTxt(g.descripcion||'');
  var cat=mntNormDupTxt(g.categoria||'');
  var emp=String(g.empleadoFbKey||g.empleadoId||'');
  return [mes,monto,cat,emp,desc].join('|');
}
function mntSetDupBadge(n){
  var b=document.getElementById('mnt-dup-fijos-count');
  if(!b) return;
  b.className='badge '+(n>0?'b-red':'b-green');
  b.textContent=n>0 ? (n+' duplicado(s)') : 'Sin duplicados';
}
function mntRenderDuplicadosGastosFijos(grupos){
  var box=document.getElementById('mnt-dup-fijos-lista'); if(!box) return;
  grupos=grupos||[];
  if(!grupos.length){ box.innerHTML='<div style="font-size:13px;color:var(--green);padding:12px;text-align:center">No se detectaron duplicados de gastos fijos.</div>'; return; }
  box.innerHTML=grupos.map(function(gr,i){
    var keep=gr.keep||{}; var dups=gr.dups||[];
    return '<div style="border:0.5px solid var(--border);border-radius:var(--radius);background:var(--bg3);padding:10px 12px">'+
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">'+
        '<div style="min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text);overflow-wrap:anywhere">'+escapeHTML(keep.descripcion||'Gasto fijo')+'</div>'+ 
        '<div style="font-size:12px;color:var(--text2);margin-top:3px">Mes '+escapeHTML(mntMesGasto(keep)||'—')+' · $'+(Math.round(parseFloat(keep.monto)||0)).toLocaleString('es-AR')+' · '+(dups.length+1)+' registros</div></div>'+ 
        '<span class="badge b-red">Borra '+dups.length+'</span>'+ 
      '</div>'+ 
      '<div style="font-size:11px;color:var(--text3);margin-top:8px">Conserva: '+escapeHTML(keep.fbKey||'—')+' · Copias: '+dups.map(function(x){return escapeHTML(x.fbKey||'');}).join(', ')+'</div>'+ 
    '</div>';
  }).join('');
}
async function mntAnalizarDuplicadosGastosFijos(){
  if(!mntRequireAdmin('auditoria de duplicados')) return;
  if(!window.fbDB){ notify('Sin conexión Firebase'); return; }
  mntLog('Buscando duplicados de gastos fijos...');
  var gastosObj=await mntGet('sisventas/gastos')||{};
  var gastos=Object.keys(gastosObj).map(function(k){return Object.assign({fbKey:k},gastosObj[k]);});
  var mapa={};
  gastos.forEach(function(g){
    if(!mntEsFijoDuplicable(g)) return;
    var mes=mntMesGasto(g); if(!mes) return;
    var monto=Math.round(parseFloat(g.monto)||0); if(monto<=0) return;
    var key=mntDupKeyGastoFijo(g); if(!mapa[key]) mapa[key]=[]; mapa[key].push(g);
  });
  var grupos=[];
  Object.keys(mapa).forEach(function(k){
    var arr=mapa[k]; if(arr.length<2) return;
    arr.sort(function(a,b){ return (parseFloat(a.ts)||0)-(parseFloat(b.ts)||0) || String(a.fbKey||'').localeCompare(String(b.fbKey||'')); });
    grupos.push({key:k,keep:arr[0],dups:arr.slice(1)});
  });
  window._mntDuplicadosGastosFijos=grupos;
  var cant=grupos.reduce(function(s,g){return s+(g.dups?g.dups.length:0);},0);
  mntSetDupBadge(cant); mntRenderDuplicadosGastosFijos(grupos);
  var btn=document.getElementById('mnt-btn-eliminar-dup-fijos'); if(btn) btn.disabled = cant<=0;
  mntLog('Duplicados de gastos fijos detectados: '+cant+' copia(s) en '+grupos.length+' grupo(s).');
  notify(cant ? ('Detectados '+cant+' duplicado(s)') : 'Sin duplicados de gastos fijos');
}
async function mntEliminarDuplicadosGastosFijos(){
  if(!mntRequireAdmin('eliminacion de duplicados')) return;
  var grupos=window._mntDuplicadosGastosFijos||[];
  var keys=[]; grupos.forEach(function(g){ (g.dups||[]).forEach(function(x){ if(x.fbKey) keys.push(x.fbKey); }); });
  if(!keys.length){ notify('No hay duplicados para eliminar'); return; }
  if(!confirm('Se eliminarán '+keys.length+' copia(s) duplicada(s) de gastos fijos. Se conserva siempre el registro más antiguo de cada grupo. ¿Continuar?')) return;
  var clave=prompt('Escribí DUPLICADOS para confirmar:'); if(clave!=='DUPLICADOS'){ notify('Eliminación cancelada'); return; }
  mntLog('Eliminando duplicados de gastos fijos: '+keys.length+'...');
  var updates={}; keys.forEach(function(k){ updates['sisventas/gastos/'+k]=null; });
  await window.fbUpdate(window.fbRef(window.fbDB),updates).then(function(){
    mntLog('Duplicados eliminados: '+keys.length);
    return window.fbUpdate(window.fbRef(window.fbDB,'sisventas/mantenimiento/duplicados_fijos/'+Date.now()),{version:mntVersion(),fecha:new Date().toISOString(),usuario:currentUser||'Admin',borrados:keys.length,keys:keys});
  }).catch(function(e){ mntLog('Error eliminando duplicados: '+e.message); notify('Error: '+e.message); });
  notify('✓ Duplicados fijos eliminados');
  await mntAnalizarDuplicadosGastosFijos();
  if(typeof fbCargarGastos==='function') fbCargarGastos();
}

async function mntLimpiarLegacy(){
  if(!mntRequireAdmin('limpieza legacy')) return;
  if(!MNT_STATE.integridadOK){ notify('Primero verificá integridad OK'); return; }
  if(!confirm('Vas a limpiar estructuras antiguas ya migradas. No se borrarán solicitudes pendientes ni rechazadas. ¿Continuar?')) return;
  var clave=prompt('Escribí LIMPIAR para confirmar la limpieza definitiva:'); if(clave!=='LIMPIAR'){ notify('Limpieza cancelada'); return; }
  mntSetEstado('Limpiando...','b-amber'); mntLog('Iniciando limpieza segura de legacy migrado...'); var borrados=0;

  var gastosObj=await mntGet('sisventas/gastos')||{};
  var gastos=Object.keys(gastosObj).map(function(k){return Object.assign({fbKey:k},gastosObj[k]);});

  var agu=await mntGet('sisventas/aguinaldos')||{};
  var aguPend=[];
  Object.keys(agu).forEach(function(empKey){Object.keys(agu[empKey]||{}).forEach(function(semKey){
    var r=agu[empKey][semKey]||{}; var monto=mntMoney(r.aguinaldo||r.monto||0); if(monto<=0) return;
    var leg='aguinaldos/'+empKey+'/'+semKey;
    if(!mntGastoExiste(gastos,'aguinaldo',empKey,monto,r.fecha,semKey,leg)) aguPend.push(leg);
  });});
  if(!aguPend.length && Object.keys(agu).length){
    await window.fbRemove(window.fbRef(window.fbDB,'sisventas/aguinaldos')).then(function(){borrados++; mntLog('Eliminado: /sisventas/aguinaldos');}).catch(function(e){mntLog('No se pudo borrar aguinaldos: '+e.message);});
  } else if(aguPend.length){
    mntLog('No se borró /sisventas/aguinaldos: hay '+aguPend.length+' registro(s) sin gasto real.');
  }

  var hs=await mntGet('sisventas/hsextra_solicitudes')||{};
  var hsUpdates={}, hsOmitidas=0;
  Object.keys(hs).forEach(function(k){
    var sol=hs[k]||{};
    if(String(sol.estado||'').toLowerCase()!=='aprobado') return;
    var empKey=sol.empFbKey||sol.empleadoFbKey||sol.empleadoId||'';
    var monto=mntMoney(sol.monto||0);
    var leg='hsextra_solicitudes/'+k;
    var existeGasto = !!(sol.gastoFbKey||sol.migradoAGastos) || mntGastoExiste(gastos,'hextra',empKey,monto,sol.fecha,'',leg);
    if(existeGasto) hsUpdates['sisventas/hsextra_solicitudes/'+k]=null;
    else hsOmitidas++;
  });
  if(Object.keys(hsUpdates).length){
    await window.fbUpdate(window.fbRef(window.fbDB),hsUpdates).then(function(){borrados+=Object.keys(hsUpdates).length; mntLog('Eliminadas horas extra aprobadas migradas: '+Object.keys(hsUpdates).length);});
  }
  if(hsOmitidas) mntLog('Horas extra aprobadas conservadas por no tener gasto real: '+hsOmitidas);

  var cta=await mntGet('sisventas/ctaemp')||{}; var ctaUpdates={}, ctaOmitidos=0;
  Object.keys(cta).forEach(function(empKey){Object.keys(cta[empKey]||{}).forEach(function(mKey){
    var m=cta[empKey][mKey]||{}; var tipo=String(m.tipo||'').toLowerCase(); if(tipo!=='hextra'&&tipo!=='aguinaldo') return;
    var monto=mntMoney(m.monto||0); if(monto<=0) return;
    var leg='ctaemp/'+empKey+'/'+mKey;
    var existeGasto=!!(m.gastoFbKey||m.migradoAGastos)||mntGastoExiste(gastos,tipo,empKey,monto,m.fecha,m.semestre||'',leg);
    if(existeGasto) ctaUpdates['sisventas/ctaemp/'+empKey+'/'+mKey]=null; else ctaOmitidos++;
  });});
  if(Object.keys(ctaUpdates).length){
    await window.fbUpdate(window.fbRef(window.fbDB),ctaUpdates).then(function(){borrados+=Object.keys(ctaUpdates).length; mntLog('Eliminados movimientos ctaemp legacy migrados: '+Object.keys(ctaUpdates).length);});
  }
  if(ctaOmitidos) mntLog('Movimientos ctaemp conservados por no tener gasto real: '+ctaOmitidos);

  await window.fbUpdate(window.fbRef(window.fbDB,'sisventas/mantenimiento/limpiezas/'+Date.now()),{version:mntVersion(),fecha:new Date().toISOString(),usuario:currentUser||'Admin',borrados:borrados});
  mntLog('Limpieza finalizada. Elementos removidos: '+borrados); notify('✓ Limpieza legacy finalizada'); await mntAnalizarBase();
}










