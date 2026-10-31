(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVRecordListModel=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const domains=Object.freeze(['ordenes_trabajo','reclamos','gastos']);
 const index='sisventas/listados_resumen',employeeIndex=index+'/gastos_empleado',revision='_svListRevision',operation='_svListOperation';
 const media=Object.freeze(['fotoBase64','evidenciaUrl','fotoUrl','audioUrl','archivoUrl','archivoData','firmaBase64','firmaUrl','firmaTecnicoUrl','imagenBase64','pdfBase64']);
 const omitted=Object.freeze({ordenes_trabajo:['fotos','fotosTecnico','fotosVisita','evidenciasFotos','evidencias','imagenes','adjuntos','archivos','notas','notasTecnico','historial','auditoria','firma','firmaTecnico','credenciales'],reclamos:['evidencias','adjuntos'],gastos:['auditoria','audit']});
 const key=k=>typeof k==='string'&&k.length>0&&k.length<=768&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(k)&&!['__proto__','constructor','prototype'].includes(k);
 const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
function otEstadoNormalizado(ot) {
  var estado = String(ot && typeof ot === 'object' ? (ot.estado || ot.estadoOT || ot.estadoOrden || '') : (ot || ''))
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return estado;
}

function otEstaCerrada(ot) {
  return [
    'completada','completado','con_observaciones',
    'finalizada','finalizado','cerrada','cerrado','terminada','terminado'
  ].indexOf(otEstadoNormalizado(ot)) >= 0;
}

function otFirmaUrl(ot) {
  if (!ot || typeof ot !== 'object') return '';
  var firma = ot.firmaClienteUrl || ot.firmaUrl || ot.firmaURL ||
    ot.firmaBase64 || ot.firmaCliente || ot.firma || '';
  if (firma && typeof firma === 'object') {
    firma = firma.url || firma.downloadURL || firma.dataUrl || firma.base64 || '';
  }
  return String(firma || '').trim();
}

function otFotoUrlDeNota(nota) {
  if (!nota) return '';
  if (typeof nota === 'string' && /^(?:https?:|data:image\/|blob:)/i.test(nota)) return nota;
  if (typeof nota !== 'object') return '';
  var fotoAnidada = nota.foto && typeof nota.foto === 'object' ? nota.foto : null;
  var imagenAnidada = nota.imagen && typeof nota.imagen === 'object' ? nota.imagen : null;
  var archivoAnidado = nota.archivo && typeof nota.archivo === 'object' ? nota.archivo : null;
  var adjuntoAnidado = nota.adjunto && typeof nota.adjunto === 'object' ? nota.adjunto : null;
  return String(
    nota.fotoUrl || nota.urlFoto || nota.imagenUrl || nota.imageUrl ||
    nota.downloadURL || nota.fotoBase64 || nota.imagenBase64 ||
    nota.archivoUrl || nota.adjuntoUrl || nota.mediaUrl ||
    nota.photoURL || nota.photoUrl || nota.src || nota.url ||
    (typeof nota.foto === 'string' ? nota.foto : '') ||
    (typeof nota.imagen === 'string' ? nota.imagen : '') ||
    (typeof nota.archivo === 'string' ? nota.archivo : '') ||
    (typeof nota.adjunto === 'string' ? nota.adjunto : '') ||
    (fotoAnidada && (fotoAnidada.url || fotoAnidada.fotoUrl || fotoAnidada.downloadURL || fotoAnidada.src)) ||
    (imagenAnidada && (imagenAnidada.url || imagenAnidada.imagenUrl || imagenAnidada.downloadURL || imagenAnidada.src)) ||
    (archivoAnidado && (archivoAnidado.url || archivoAnidado.archivoUrl || archivoAnidado.downloadURL || archivoAnidado.src)) ||
    (adjuntoAnidado && (adjuntoAnidado.url || adjuntoAnidado.adjuntoUrl || adjuntoAnidado.downloadURL || adjuntoAnidado.src)) ||
    ''
  ).trim();
}

function otNotasNormalizadas(ot) {
  var origen = ot && ot.notasTecnico;
  var notas = [];
  if (Array.isArray(origen)) {
    notas = origen.map(function(nota, indice) {
      if (!nota) return null;
      return typeof nota === 'object'
        ? Object.assign({ _arrayIndex:indice }, nota)
        : { _arrayIndex:indice, texto:String(nota || '') };
    }).filter(Boolean);
  } else if (origen && typeof origen === 'object') {
    notas = Object.keys(origen).sort(function(a, b) {
      var notaA = origen[a] || {}, notaB = origen[b] || {};
      return (parseInt(notaA.ts, 10) || 0) - (parseInt(notaB.ts, 10) || 0);
    }).map(function(key) {
      var nota = origen[key];
      if (!nota) return null;
      return typeof nota === 'object'
        ? Object.assign({ _firebaseKey:key }, nota)
        : { _firebaseKey:key, texto:String(nota || '') };
    }).filter(Boolean);
  }
  notas = notas.map(function(nota) {
    var normalizada = typeof nota === 'object'
      ? Object.assign({}, nota)
      : { texto:String(nota || '') };
    var fotoUrl = otFotoUrlDeNota(nota);
    if (fotoUrl) normalizada.fotoUrl = fotoUrl;
    return normalizada;
  });

  // Compatibilidad con OTs que guardaron evidencias en colecciones separadas.
  [
    ot && ot.fotos,
    ot && ot.fotosTecnico,
    ot && ot.fotosVisita,
    ot && ot.evidenciasFotos,
    ot && ot.evidencias,
    ot && ot.imagenes,
    ot && ot.adjuntos,
    ot && ot.archivos
  ].forEach(function(coleccion) {
    var fotos = Array.isArray(coleccion) ? coleccion : Object.values(coleccion || {});
    fotos.forEach(function(foto) {
      var url = otFotoUrlDeNota(foto);
      if (!url || notas.some(function(nota){ return otFotoUrlDeNota(nota) === url; })) return;
      var datos = foto && typeof foto === 'object' ? foto : {};
      notas.push({
        texto: datos.texto || datos.descripcion || datos.titulo || 'Foto de la OT',
        autor: datos.autor || datos.usuario || 'Técnico',
        rol: datos.rol || 'tecnico',
        ts: parseInt(datos.ts || datos.fechaTs || datos.timestamp, 10) || 0,
        fotoUrl: url,
        fotoStoragePath: datos.fotoStoragePath || datos.storagePath || '',
        _fotoLegacy: true
      });
    });
  });
  return notas;
}

function otResumenDocumental(ot) {
  ot = ot || {};
  if (!otEstaCerrada(ot)) return { completo:true, faltantes:[], fotos:0, firma:false };
  var notas = typeof otNotasNormalizadas === 'function' ? otNotasNormalizadas(ot) : [];
  var fotos = notas.filter(function(nota) {
    return typeof otFotoUrlDeNota === 'function' && !!otFotoUrlDeNota(nota);
  }).length;
  var firma = typeof otFirmaUrl === 'function' && !!otFirmaUrl(ot);
  var conformidad = String(ot.conformidadCliente || ot.conformidad || '').trim();
  var nombreCliente = String(ot.nombreConformidad || ot.firmaNombreCliente || ot.nombreClienteFirma || '').trim();
  var observaciones = String(ot.observacionesCierre || ot.actaObservaciones || ot.obsTecnico || '').trim();
  var faltantes = [];
  if (!fotos) faltantes.push('fotos');
  if (!firma) faltantes.push('firma');
  if (!conformidad) faltantes.push('conformidad');
  if (!nombreCliente) faltantes.push('aclaración');
  if (!observaciones) faltantes.push('observaciones del acta');
  return {
    completo:faltantes.length === 0,
    faltantes:faltantes,
    fotos:fotos,
    firma:firma
  };
}

 const documental=otResumenDocumental;
 function summary(domain,record){
  if(!domains.includes(domain)||!record||typeof record!=='object'||Array.isArray(record))throw Error('Registro de listado inválido');
  const attachments=[];
  function walk(value,path,depth){
   if(depth>8)throw Error('Registro demasiado profundo para el listado');
   if(value===null||['boolean','number','string'].includes(typeof value)){
    if(typeof value==='number'&&!Number.isFinite(value))throw Error('Número inválido');
    if(typeof value==='string'&&/^data:[^,]+[,;]/i.test(value)){attachments.push(path);return undefined;}
    return value;
   }
   if(!value||typeof value!=='object')throw Error('Dato de listado inválido');
   if(Array.isArray(value))return value.map((child,i)=>walk(child,path.concat(String(i)),depth+1)??null);
   const out={};for(const [field,child]of Object.entries(value)){
    if(!key(field))throw Error('Campo inválido');
    if((depth===0&&field==='fbKey')||field==='_svListSummary'||field==='_svListAttachments')continue;
    if(media.includes(field)||(depth===0&&omitted[domain].includes(field))){if(child!==null&&child!==false&&child!=='')attachments.push(path.concat(field));continue;}
    const next=walk(child,path.concat(field),depth+1);if(next!==undefined)out[field]=next;
   }return out;
  }
  const out=walk(record,[],0);out[revision]=Number(record[revision])||0;out._svListSummary=true;
  if(domain==='ordenes_trabajo')out._svListDocumental=documental(record);
  if(attachments.length)out._svListAttachments=attachments;
  return out;
 }
 const publicFields=Object.freeze(["ts","fecha","vencimiento","fechaPago","fechaImputacion","periodoTrabajo","tipo","categoria","monto","montoPagado","medio","proveedor","empleadoId","empleadoFbKey","empleadoNombre","esFijoBase","recurrenciaActiva","tipoPagable","origen","legacyKey","movimientoCtaKey","gastoFbKey","gastoKey","saldoPagadoLegacy","estado","reembolsado","montoCompensado","adelantoCompensado","sueldoBase","sueldoBruto","bonificacion","mes","periodoDescuento","periodoComputo","requiereAprobacion","aprobadoPor","aprobadoTs","fechaAprobacion","ventaId","numeroVenta","ventaNumero","ventaFbKey","cliente","clienteNombre","bonificacionCantidad","bonificacionValorUnitario","bonificacionConceptoId","bonificacionConceptoNombre","bonificacionGrupoId"]),paymentFields=Object.freeze(["monto","fecha","ts","medio","anulado","estado","editadoTs"]);
 function isCommission(row){const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return ['tipoPagable','origen','tipo'].some(k=>norm(row?.[k])==='comision')||['pct','pctOriginal','gananciaBase','baseGanancia','porcentaje'].some(k=>row?.[k]!=null);}
 function publicExpense(row){if(!isCommission(row))return summary('gastos',row);const out={_svListSummary:true,[revision]:Number(row?.[revision])||0};if(row?.[operation]!=null)out[operation]=row[operation];
  for(const field of publicFields)if(row?.[field]!=null&&['string','number','boolean'].includes(typeof row[field]))out[field]=row[field];
  if(Object.hasOwn(row||{},'bajaAdministrativa'))out.bajaAdministrativa=true;
  const id=String(row?.ventaId||row?.numeroVenta||row?.ventaNumero||''),client=String(row?.cliente||row?.clienteNombre||'');out.descripcion=isCommission(row)?'Comisión venta #'+id+(client?' · '+client:''):String(row?.descripcion||row?.desc||'');
  for(const field of ['pagos','compensaciones','adelantosAplicados'])if(row?.[field]&&typeof row[field]==='object'){const safe={};for(const [key,value]of Object.entries(row[field])){if(!key||!value||typeof value!=='object')continue;const entry={};for(const k of paymentFields.concat(['gastoFbKey','periodoDescuento','periodoComputo','mes']))if(value[k]!=null&&['string','number','boolean'].includes(typeof value[k]))entry[k]=value[k];if(Object.keys(entry).length)safe[key]=entry;}if(Object.keys(safe).length)out[field]=safe;}
  return out;
 }
 function requireComplete(record){if(record?._svListSummary===true)throw Error('Abrí el detalle antes de guardar este registro.');return record;}
 function complete(domain,record){requireComplete(record);return summary(domain,record);}
 function path(v){let p=String(v?.toString?v.toString():v||'');if(/^https?:\/\//.test(p))p=decodeURIComponent(new URL(p).pathname);return p.replace(/^\/+|\/+$/g,'');}
 function recordPath(v){const p=path(v).split('/');return p[0]==='sisventas'&&domains.includes(p[1])&&key(p[2])?p.slice(0,3).join('/'):null;}
 function plan(source,before,after,id){const p=recordPath(source);if(p!==path(source))throw Error('Seleccioná un registro concreto.');const domain=p.split('/')[1],target=index+'/'+domain+'/'+p.split('/')[2];if(after===null)return {[p]:null,[target]:null,...(domain==='gastos'?{[employeeIndex+'/'+p.split('/')[2]]:null}:{})};requireComplete(after);const old=before?.[revision]??0;if(!Number.isSafeInteger(old)||old<0||old>=Number.MAX_SAFE_INTEGER)throw Error('Revisión de listado inválida');if(after[revision]!=null&&after[revision]!==old)throw Error('El registro cambió. Volvé a abrir el detalle antes de guardar.');const value=clone(after);if(!Object.hasOwn(before||{},'fbKey'))delete value.fbKey;delete value._svListSummary;delete value._svListAttachments;delete value._svListDocumental;value[revision]=old+1;value[operation]=id||'fixture-'+(old+1);return {[p]:value,[target]:summary(domain,value),...(domain==='gastos'?{[employeeIndex+'/'+p.split('/')[2]]:publicExpense(value)}:{})};}
 function parseIndex(domain,value){if(!domains.includes(domain))throw Error('Dominio de listado inválido');const meta=value?._svCoverage;if(meta?.schema!==1||meta.ready!==true||!Number.isSafeInteger(meta.baselineCount)||meta.baselineCount<0||!/^[a-f0-9]{64}$/.test(meta.sourceHash||''))throw Error('El listado todavía no está preparado.');const out={};for(const [id,row]of Object.entries(value))if(id!=='_svCoverage'){if(!key(id)||!row||!Number.isSafeInteger(row[revision])||row[revision]<0||row._svListSummary!==true)throw Error('Resumen incompleto');out[id]=clone(row);}return out;}
 return Object.freeze({domains,index,employeeIndex,publicFields,paymentFields,publicExpense,isCommission,revision,operation,media,omitted,key,path,recordPath,clone,summary,complete,requireComplete,plan,parseIndex,documental});
});
