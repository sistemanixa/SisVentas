'use strict';
const crypto = require('node:crypto');
const DefaultModel = require('./ot-unit-confirmation-model');
const {rulesProtectOTUnitConfirmation} = require('./ot-unit-confirmation-rules');
const {canonical, digest} = require('./labor-guard');
const INTERNAL = new Set(['admin','administrativo','vendedor','tecnico_vendedor','tecnico']);
const CONFIRM_DEFAULTS = new Set(['admin','administrativo','tecnico']);
const MANAGEMENT_DEFAULTS = new Set(['admin','administrativo','vendedor','tecnico_vendedor']);
const OT_ACTIONS = {
  crear:new Set(['admin','administrativo']),
  editar:new Set(['admin','administrativo','tecnico_vendedor','tecnico']),
  entregarMateriales:new Set(['admin','administrativo','vendedor']),
  rendirMateriales:INTERNAL,
  editarCredenciales:new Set(['admin','administrativo','tecnico']),
  editarDatosAdministrativos:MANAGEMENT_DEFAULTS
};
const OT_FIELDS = ['id','estado','origen','tipoVisita','reclamoKey','reclamoFbKey','reclamoId','ventaFbKey','ventaKey','ventaId','venta','clienteFbKey','clienteKey','cliente','dir','tecnicoFbKey','empleadoFbKey','tecnicoKey','tecnico','tecnicoNombre','materiales','fechaCierre','fechaCompletada'];
const EXISTING_FIELDS = ['origen','ventaFbKey','venta','otFbKey','productoFbKey','garantiaLinea','ventaItemKey','unidadIndice','serie','dir','fechaInstalacion','fechaInst','fechaEntrega','fechaInicioGarantia','fechaVenc','garantiaMeses','meses','estado','decision','manualConfirmado','garantiaEstado','garantiaInicio','serieObligatoria','fechaManual','revisionFuente','sourceItemDigest'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => value == null ? value : structuredClone(value);
const fail = (statusCode, message, code) => Object.assign(Error(message), {statusCode, ...(code ? {code} : {})});
const pick = (value, fields) => Object.fromEntries(fields.filter(name => Object.hasOwn(value || {}, name)).map(name => [name, clone(value[name])]));
const norm = value => typeof value === 'string' ? value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase() : '';
const labor = value => value?.esManoDeObra === true || value?.esManoDeObra === 1 || value?.esManoObra === true || String(value?.esManoDeObra || '').toLowerCase() === 'true' ||
  String(value?.categoria || value?.catId || value?.tipoProducto || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes('mano de obra') || /^mano de obra\b/.test(norm(value?.nombre || value?.descripcion || value?.desc));
function text(value, max = 2000) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value)) || String(value).length > max) throw fail(409,'Los campos de un renglón requieren revisión');
  return String(value);
}
function warranty(value) {
  if (value === null || value === undefined) return value;
  if (!object(value) || Object.keys(value).some(name => !['estado','meses','inicio','equipo','serie'].includes(name)) || Object.values(value).some(item => item !== null && !['string','number','boolean'].includes(typeof item))) throw fail(409,'Las condiciones históricas del renglón requieren revisión');
  return clone(value);
}

function moduleAllowed(config, name) {
  return object(config) && config.indiceVersion === 2 && object(config.indiceModulos) && config.indiceModulos[name] === true &&
    (config.bloqueados === undefined || object(config.bloqueados) || Array.isArray(config.bloqueados)) && !Object.values(config.bloqueados || {}).includes(name);
}
function actionAllowed(config, group, name, defaults, role) {
  if (config.acciones !== undefined && !object(config.acciones)) return false;
  const actions = config.acciones?.[group];
  if (actions !== undefined && !object(actions)) return false;
  return actions && Object.hasOwn(actions,name) ? actions[name] === true : defaults.has(role);
}
function same(a,b) { return canonical(a) === canonical(b); }
async function bounded(values, work, size = 8) {
  const result = [];
  for (let offset = 0; offset < values.length; offset += size) {
    const settled = await Promise.allSettled(values.slice(offset,offset+size).map(work));
    const error = settled.find(value => value.status === 'rejected');
    if (error) throw error.reason;
    result.push(...settled.map(value => value.value));
  }
  return result;
}
function localDate(now) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now()));
  return ['year','month','day'].map(type => parts.find(part => part.type === type).value).join('-');
}

function createOTUnitConfirmation({auth, db, guard, enabled = false, custodyEnabled = false, model = DefaultModel, now = Date.now}) {
  if (typeof auth?.verifyIdToken !== 'function' || typeof db?.ref !== 'function' || typeof guard?.run !== 'function' || typeof model?.build !== 'function' || typeof model?.decision !== 'function') throw Error('Falta el circuito autenticado de unidades de OT');
  const key = value => model.key(value) && value === value.trim();
  const uidKey = value => key(value) && value.length <= 128;

  function request(req, body, method) {
    if (!enabled) throw fail(503,'La confirmación de equipos todavía no está habilitada');
    if (req?.method !== 'POST') throw fail(405,'Método no permitido');
    let url;
    try { if (typeof req.url !== 'string' || !req.url.startsWith('/')) throw Error(); url = new URL(req.url,'http://localhost'); }
    catch (_) { throw fail(400,'Solicitud de unidades inválida'); }
    if (url.pathname !== '/ot/unidades/'+method || url.search || url.hash) throw fail(400,'La confirmación no admite vistas ni parámetros adicionales');
    const fields = method === 'preparar' ? ['otKey'] : ['otKey','revision','fecha','units'];
    if (!object(body) || Object.keys(body).some(name => !fields.includes(name)) || !key(body.otKey)) throw fail(400,'Solicitud de unidades inválida');
    if (Buffer.byteLength(JSON.stringify(body)) > 200000) throw fail(413,'La confirmación supera el tamaño permitido');
    const token = String(req.headers?.authorization || req.headers?.Authorization || '').match(/^Bearer\s+(\S+)$/i);
    if (!token) throw fail(401,'Sesión requerida');
    return token[1];
  }
  async function verify(token) {
    let actor;
    try { actor = await auth.verifyIdToken(token,true); }
    catch (error) { throw fail(error.statusCode === 403 ? 403 : 401,error.statusCode === 403 ? 'Actualizá tu acceso y volvé a ingresar' : 'La sesión venció; volvé a ingresar'); }
    if (!object(actor) || !uidKey(actor.uid)) throw fail(401,'Sesión inválida');
    return actor;
  }
  async function read(path) {
    try {
      const value = (await db.ref(path).get()).val();
      if (value === undefined) throw Error();
      return clone(value);
    } catch (_) { throw fail(503,'No se pudo verificar la OT y sus condiciones'); }
  }
  async function authority(actor, intent = 'confirmar') {
    const [role,reset] = await Promise.all([read('sv_chat_roles/'+actor.uid),read('sv_access_resets/'+actor.uid)]);
    if (!object(role) || role.activo !== true || !INTERNAL.has(role.rol)) throw fail(403,'Usuario sin acceso a órdenes de trabajo');
    if (reset !== null && !object(reset) || actor.svPasswordChangeRequired === true || reset && (reset.required || reset.version !== actor.svAccessVersion)) throw fail(403,'Actualizá tu acceso y volvé a ingresar');
    const config = await read('sv_permisos/'+role.rol);
    if (!moduleAllowed(config,'ordentrabajo')) throw fail(403,'Tu rol no tiene acceso a órdenes de trabajo');
    if(intent==='confirmar'){
      if(!moduleAllowed(config,'equipos')||!actionAllowed(config,'equipos','confirmarInstalacion',CONFIRM_DEFAULTS,role.rol))throw fail(403,'Tu rol no permite confirmar equipos desde una OT');
    }else{
      const handover=actionAllowed(config,'ot','entregarMateriales',OT_ACTIONS.entregarMateriales,role.rol),returns=actionAllowed(config,'ot','rendirMateriales',OT_ACTIONS.rendirMateriales,role.rol);
      if(!['custodia','entregar','devolver','recibir'].includes(intent)||(intent==='custodia'?!handover&&!returns:intent==='devolver'?!returns:!handover))throw fail(403,'Tu rol no permite esa operación de custodia');
    }
    return {role,reset,config};
  }
  async function requireProtectedRules() {
    if (typeof db.getRulesJSON !== 'function') throw fail(503,'Falta verificar la protección obligatoria de las unidades');
    let rules;
    try { rules = await db.getRulesJSON(); }
    catch (_) { throw fail(503,'No se pudo verificar la protección de las unidades'); }
    if (!rulesProtectOTUnitConfirmation(rules)) throw fail(503,'Falta activar la protección obligatoria de las unidades');
  }
  async function selectedOT(otKey) {
    const paths = ['sisventas/ordenes_trabajo/','sisventas/ordenesTrabajo/'].map(prefix => prefix+otKey);
    const values = await Promise.all(paths.map(read));
    const matches = values.map((value,n) => ({value,path:paths[n]})).filter(row => row.value !== null);
    if (matches.length !== 1 || !object(matches[0].value)) throw fail(409,matches.length ? 'La OT tiene referencias ambiguas. Revisá su vínculo antes de continuar.' : 'La OT ya no está disponible');
    const selected = matches[0];
    if (selected.value.fbKey !== undefined && selected.value.fbKey !== otKey) throw fail(409,'La identidad de la OT requiere revisión');
    return {ot:selected.value,otPath:selected.path};
  }
  async function assigned(actor, current, ot) {
    const management = actionAllowed(current.config,'ot','editarDatosAdministrativos',MANAGEMENT_DEFAULTS,current.role.rol);
    if (management) return {management:true};
    const binding = await read('sv_empleado_uid/'+actor.uid);
    if (!object(binding) || !key(binding.perfilFbKey)) throw fail(403,'No se encontró un vínculo laboral verificado');
    const profile = await read('sv_usuarios/'+binding.perfilFbKey);
    if (!object(profile) || profile.uid !== actor.uid || profile.activo === false || !key(profile.empleadoFbKey) || profile.rol !== undefined && profile.rol !== current.role.rol) throw fail(403,'El vínculo laboral requiere revisión');
    const employee = await read('sisventas/empleados/'+profile.empleadoFbKey);
    if (!object(employee) || employee.activo === false || employee.fbKey !== undefined && employee.fbKey !== profile.empleadoFbKey) throw fail(403,'El empleado asignado no está verificado');
    const aliases = [profile.empleadoFbKey];
    for (const name of ['id','codigo']) {
      const value = employee[name];
      if (value === null || value === undefined || value === '') continue;
      if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) throw fail(403,'La identidad del empleado requiere revisión');
      aliases.push(String(value).trim());
    }
    let assignment;
    for (const name of ['tecnicoFbKey','empleadoFbKey','tecnicoKey']) {
      const value = ot[name];
      if (value === null || value === undefined || typeof value === 'string' && !value.trim()) continue;
      if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value)) || /[\x00-\x1f\x7f]/.test(String(value))) throw fail(403,'La asignación de la OT requiere revisión');
      assignment = {name,value:String(value).trim()};
      break;
    }
    // An exact-name query cannot prove uniqueness under the canonical accent /
    // spacing normalization. Without a verified key, retain the denial rather
    // than read the employee directory or assume a homonym owns the OT.
    if (!assignment) throw fail(403,'La OT necesita un técnico vinculado por su ficha. Pedí a administración que revise la asignación.','SV_OT_ASSIGNMENT_REVIEW');
    if (!aliases.includes(assignment.value)) throw fail(403,'Esta OT no está asignada a tu cuenta');
    return {management:false,binding,profile:pick(profile,['uid','rol','activo','empleadoFbKey']),employee:pick(employee,['fbKey','id','codigo','activo']),assignment};
  }
  function saleKey(ot) {
    const references = [];
    for (const name of ['ventaFbKey','ventaKey']) {
      const value = ot[name];
      if (value === null || value === undefined || value === '') continue;
      if (!key(value)) throw fail(409,'La referencia de venta de la OT requiere revisión');
      references.push(value);
    }
    if (new Set(references).size > 1) throw fail(409,'La OT tiene referencias de venta contradictorias');
    return references[0] || '';
  }
  function claim(ot) {
    return /reclamo|post.?venta/.test(norm(ot.origen)) || /reclamo|post.?venta/.test(norm(ot.tipoVisita)) || ['reclamoKey','reclamoFbKey','reclamoId'].some(name => ot[name] !== undefined && ot[name] !== null && ot[name] !== '');
  }
  async function projectedSale(sale, ot) {
    const source = sale ? sale.items : ot.materiales;
    if (source !== undefined && !object(source) && !Array.isArray(source)) throw fail(409,'Los renglones de la OT requieren revisión');
    const entries = Object.entries(source || {});
    if (entries.length > 500) throw fail(409,'La OT tiene demasiados renglones para una única confirmación');
    const items = Object.create(null),products = Object.create(null),productKeys = new Set();
    for (const [itemKey,item] of entries) {
      if (!key(itemKey) || !object(item)) throw fail(409,'Los renglones de la OT requieren revisión');
      const productKey = item.productoFbKey || item.prodFbKey || '';
      if (productKey && !key(productKey)) throw fail(409,'La identidad del producto requiere revisión');
      if (productKey) productKeys.add(productKey);
    }
    await bounded([...productKeys],async productKey => {
      const product = await read('sisventas/productos/'+productKey);
      if (product !== null && !object(product)) throw fail(409,'La clasificación del producto requiere revisión');
      products[productKey] = product ? pick(product,['esManoDeObra','esManoObra','categoria','catId','tipoProducto','nombre','descripcion','unidad','unidadMedida','unit']) : null;
    });
    for (const [itemKey,item] of entries) {
      const productKey = item.productoFbKey || item.prodFbKey || '';
      const product = products[productKey];
      const projected = {cod:text(item.cod ?? item.codigo),desc:text(item.desc ?? item.descripcion ?? item.nombre ?? item.producto),productoFbKey:productKey,
        unidad:text(item.unidad ?? item.unidadMedida ?? item.unit ?? product?.unidad ?? product?.unidadMedida ?? product?.unit,80),esManoDeObra:labor(item) || labor(product)};
      if (item.qty !== undefined) projected.qty = clone(item.qty);
      else if (item.cantidad !== undefined) projected.qty = clone(item.cantidad);
      else if (!sale && item.vendida !== undefined) projected.qty = clone(item.vendida);
      else if (!sale && item.entregada !== undefined) projected.qty = clone(item.entregada);
      else projected.qty = 1;
      if (typeof projected.qty !== 'string' && !(typeof projected.qty === 'number' && Number.isFinite(projected.qty))) throw fail(409,'La cantidad del renglón requiere revisión');
      // Current catalog data supplies classification only. Never copy current
      // warranty terms onto a legacy commercial line.
      if (sale && Object.hasOwn(item,'garantiaConfig')) projected.garantiaConfig = warranty(item.garantiaConfig);
      if (sale && Object.hasOwn(item,'garantiaLinea')) {
        const line = item.garantiaLinea;
        if (line !== null && !['string','number','boolean'].includes(typeof line)) throw fail(409,'La identidad histórica del renglón requiere revisión');
        projected.garantiaLinea = clone(line);
      }
      items[itemKey] = projected;
    }
    return {sale:{fbKey:sale?.fbKey || '',id:text(sale?.id || sale?.numero),items},products};
  }
  async function source(actor, otKey, intent = 'confirmar') {
    const current = await authority(actor,intent),selected = await selectedOT(otKey),assignment = await assigned(actor,current,selected.ot);
    if (claim(selected.ot)) throw fail(409,'Los reclamos conservan los equipos y garantías originales. Revisalos desde su ficha; este cierre no genera nuevas coberturas.','SV_OT_CLAIM_PRESERVED');
    const linked = saleKey(selected.ot);
    let sale = null;
    if (linked) {
      const value = await read('sisventas/ventas/'+linked);
      if (!object(value) || value.fbKey !== undefined && value.fbKey !== linked || value.anulada === true || value.anulado === true || ['anulada','anulado','cancelada','cancelado'].includes(norm(value.estado))) throw fail(409,'La venta vinculada ya no está disponible');
      sale = {...value,fbKey:linked};
    }
    const projected = await projectedSale(sale,selected.ot);
    const capabilities = {equipos:true,garantias:moduleAllowed(current.config,'garantias'),reviewOT:Object.entries(OT_ACTIONS).some(([name,defaults]) => actionAllowed(current.config,'ot',name,defaults,current.role.rol)),manualReview:current.role.rol === 'admin' && assignment.management === true && moduleAllowed(current.config,'productos') && actionAllowed(current.config,'productos','configurarGarantia',new Set(['admin','administrativo']),current.role.rol)};
    const basis = {uid:actor.uid,accessVersion:actor.svAccessVersion ?? null,current,assignment,otPath:selected.otPath,ot:pick(selected.ot,OT_FIELDS),sale,products:projected.products};
    const plan = model.build(projected.sale,{isLabor:item => item.esManoDeObra === true,unitOf:item => item.unidad});
    const manualUnits = [],manualEvidence = Object.create(null);
    if (sale && typeof model.canReviewManually === 'function') for (const unit of plan.units) {
      if (!model.canReviewManually(unit)) continue;
      // A valid, unique historical line keeps its old deterministic identity.
      // Missing identity is explicit per selected row; never infer it from code.
      const unique = key(unit.linea) && plan.units.filter(candidate => candidate.n === 0 && candidate.linea === unit.linea).length === 1;
      const canonicalKey = unique ? 'unidad_'+linked+'_'+unit.linea+'_'+unit.n : '';
      unit.manualKey = canonicalKey && key(canonicalKey) ? canonicalKey : 'unidad_otmanual_'+digest({saleKey:linked,itemKey:unit.itemKey,n:unit.n});
      unit.key = unit.manualKey;
      unit.sourceItemDigest = digest(sale.items[unit.itemKey]);
      // Prior delivered units can await installation. Their confirmed terms and
      // serial remain authoritative even though no warranty has started yet.
      for (const journal of Object.values(selected.ot.unidadesConfirmacion || {})) for (const previous of Object.values(journal?.units || {})) {
        if (!previous?.manual || previous.itemKey !== unit.itemKey || previous.n !== unit.n) continue;
        if (previous.key !== unit.manualKey || previous.sourceItemDigest !== unit.sourceItemDigest) throw fail(409,'La revisión histórica no coincide con su renglón. Revisala sin modificarla.','SV_OT_MANUAL_SOURCE');
        let checked;try { checked=model.manualUnit({...unit,config:null},previous.manual,localDate(now)); }catch(_){throw fail(409,'Las condiciones registradas requieren revisión. No se modificaron.','SV_OT_MANUAL_PRESERVED');}
        const knownTerms=pick(checked.config,['estado','meses','inicio','serie']),knownSerie=typeof previous.serie==='string'?previous.serie.trim():'';
        const identity=unit.itemKey+'\u0000'+unit.n,evidence={knownTerms,knownSerie};
        if(manualEvidence[identity]&&!same(manualEvidence[identity],evidence))throw fail(409,'Hay condiciones históricas contradictorias. No se modificaron.','SV_OT_MANUAL_PRESERVED');
        manualEvidence[identity]=evidence;unit.config={...(unit.config||{}),...knownTerms};unit.knownSerie=knownSerie;
      }
      const evidence=manualEvidence[unit.itemKey+'\u0000'+unit.n];
      manualUnits.push({itemKey:unit.itemKey,n:unit.n,key:unit.manualKey,...(evidence?clone(evidence):{})});
    }
    return {...selected,current,assignment,sale:projected.sale,fullSale:sale,capabilities,basis,revision:digest(basis),plan,manualUnits,manualEvidence,otKey};
  }
  async function existing(units, readValue = read, expectedSaleKey = '', expectedOTKey = '') {
    const records = Object.create(null);
    const keys = [...new Set(units.map(unit => unit.key).filter(Boolean))];
    await bounded(keys,async unitKey => {
      const [equipment,warranty] = await Promise.all(['equipos','garantias'].map(path => readValue('sisventas/'+path+'/'+unitKey)));
      if (equipment !== null && warranty !== null) throw fail(409,'Una unidad tiene registros en Equipos y Garantías. Requiere revisión sin duplicarlos.','SV_OT_UNIT_DUPLICATE');
      const value = equipment ?? warranty;
      if (value === null) return;
      if (!object(value)) throw fail(409,'Un registro existente de unidad requiere revisión');
      if (Object.values(pick(value,EXISTING_FIELDS)).some(field => field !== null && !['string','number','boolean'].includes(typeof field))) throw fail(409,'El resumen de una unidad existente requiere revisión');
      const unit = units.find(candidate => candidate.key === unitKey);
      if (value.ventaFbKey !== undefined && value.ventaFbKey !== expectedSaleKey || value.productoFbKey && unit?.item.productoFbKey && value.productoFbKey !== unit.item.productoFbKey || value.otFbKey && !key(value.otFbKey) || value.garantiaLinea !== undefined && value.garantiaLinea !== unit?.linea || value.ventaItemKey !== undefined && value.ventaItemKey !== unit?.itemKey || value.unidadIndice !== undefined && value.unidadIndice !== unit?.n) throw fail(409,'La identidad de una unidad existente contradice sus vínculos. Requiere revisión sin modificarla.','SV_OT_UNIT_IDENTITY');
      if (value.origen === 'venta_ot_manual_v1' && (value.otFbKey !== expectedOTKey || value.ventaFbKey !== expectedSaleKey || value.ventaItemKey !== unit?.itemKey || value.unidadIndice !== unit?.n || value.sourceItemDigest !== unit?.sourceItemDigest)) throw fail(409,'La unidad manual existente no coincide con la OT y su renglón de origen. No se modificó.','SV_OT_UNIT_IDENTITY');
      records[unitKey] = {path:equipment !== null ? 'equipos' : 'garantias',record:pick(value,EXISTING_FIELDS)};
    });
    return records;
  }
  async function assertCurrent(token, actor, previous, otKey) {
    const verified = await verify(token);
    if (verified.uid !== actor.uid || !same(verified.svAccessVersion ?? null,actor.svAccessVersion ?? null)) throw fail(409,'La sesión cambió. Volvé a preparar la OT.','SV_OT_CONTEXT_CHANGED');
    const next = await source(verified,otKey);
    if (next.revision !== previous.revision || !same(next.manualEvidence,previous.manualEvidence)) throw fail(409,'La OT, la venta o los permisos cambiaron. Volvé a revisar las unidades.','SV_OT_CONTEXT_CHANGED');
    return next;
  }
  async function prepare(req, body) {
    const token = request(req,body,'preparar'),actor = await verify(token),context = await source(actor,body.otKey);
    const saved = await existing(context.plan.units,read,context.sale.fbKey,body.otKey);
    await assertCurrent(token,actor,context,body.otKey);
    return {otKey:body.otKey,sale:context.sale,revision:context.revision,existing:saved,manualUnits:context.manualUnits,capabilities:context.capabilities,skip:context.plan.units.length === 0 && !context.plan.summaries.some(row => row.reason !== 'labor'),...(['instalado','en_instalacion'].includes(context.ot.unidadesEstadoInstalacion) ? {unidadesEstadoInstalacion:context.ot.unidadesEstadoInstalacion} : {})};
  }
  function submitted(body, context) {
    if (!/^[a-f0-9]{64}$/.test(body.revision || '') || body.revision !== context.revision) throw fail(409,'La OT, la venta o los permisos cambiaron. Volvé a preparar las unidades.','SV_OT_CONTEXT_CHANGED');
    if (!Array.isArray(body.units) || body.units.length > model.MAX_UNITS + 500 || !model.date(body.fecha) || body.fecha > localDate(now)) throw fail(400,'Ingresá una fecha efectiva válida y las unidades a confirmar');
    if (!context.plan.units.length && !context.plan.summaries.some(row => row.reason !== 'labor')) throw fail(400,'Esta OT no tiene unidades o renglones para confirmar');
    const seen = new Set();
    return body.units.map(value => {
      if (!object(value) || Object.keys(value).some(name => !['itemKey','n','decision','serie','ubicacion','manual'].includes(name)) || !key(value.itemKey) || value.n !== null && (!Number.isInteger(value.n) || value.n < 0)) throw fail(400,'La unidad enviada no es válida');
      const identity = value.itemKey+'\u0000'+value.n;
      if (seen.has(identity)) throw fail(400,'La misma unidad fue enviada más de una vez');
      seen.add(identity);
      let unit = context.plan.units.find(candidate => candidate.itemKey === value.itemKey && candidate.n === value.n);
      if (value.n === null) {
        const row = context.plan.summaries.find(candidate => candidate.itemKey === value.itemKey && candidate.reason !== 'labor');
        if (row) unit = {itemKey:row.itemKey,n:null,item:row.item,config:row.item.garantiaConfig || null,key:null,needsReview:true,reason:row.reason};
      }
      if (!unit) throw fail(400,'La unidad ya no pertenece a los renglones de esta OT');
      if (unit.knownSerie && text(value.serie).trim() !== unit.knownSerie) throw fail(409,'La serie ya confirmada se conserva. No se modificó.','SV_OT_MANUAL_PRESERVED');
      if (Object.hasOwn(value,'manual')) {
        if (!context.capabilities.manualReview) throw fail(403,'La revisión manual requiere administración y permiso vigente para configurar garantías.');
        if (!unit.manualKey || !model.canReviewManually(unit) || value.decision === 'pendiente') throw fail(400,'Esta unidad no admite una confirmación manual de condiciones.');
        try { unit = model.manualUnit(unit,value.manual,localDate(now)); }
        catch (error) { throw fail(400,error.message,'SV_OT_MANUAL_'+String(error.reason || 'INVALID').toUpperCase().replace(/-/g,'_')); }
      }
      if ((value.serie || '').length > 200 || (value.ubicacion || '').length > 1000) throw fail(400,'La serie o ubicación supera el tamaño permitido');
      let decision;
      try { decision = model.decision(unit,value,unit.manualReview?.fecha || body.fecha,localDate(now)); }
      catch (error) { throw fail(400,error.message,'SV_OT_UNIT_'+String(error.reason || 'INVALID').toUpperCase().replace(/-/g,'_')); }
      return {unit,decision};
    });
  }
  function record(unit, decision, context, actor, otKey, timestamp) {
    const name = unit.item.desc || unit.item.cod || '';
    const base = {origen:unit.manualReview ? 'venta_ot_manual_v1' : 'venta_ot_v2',ventaFbKey:context.sale.fbKey,venta:context.sale.id,otFbKey:otKey,productoFbKey:unit.item.productoFbKey || '',...(unit.linea !== undefined ? {garantiaLinea:unit.linea} : {}),ventaItemKey:unit.itemKey,unidadIndice:unit.n,cliente:text(context.ot.cliente || context.fullSale?.cliente),
      serie:decision.serie,dir:decision.ubicacion,descripcion:name,equipo:name,tecnico:text(context.ot.tecnico || context.ot.tecnicoNombre),estado:decision.decision === 'instalado' ? 'Instalado' : 'Vigente',decision:decision.decision,
      fechaInstalacion:decision.fechaInstalacion,fechaInst:decision.fechaInstalacion,fechaEntrega:decision.fechaEntrega,fechaInicioGarantia:decision.fechaInicioGarantia,fechaVenc:decision.fechaVenc,
      garantiaMeses:decision.meses,meses:decision.meses,condiciones:clone(unit.config),ts:timestamp,usuario:actor.uid,actorUid:actor.uid};
    if (unit.manualReview) Object.assign(base,{manualConfirmado:true,garantiaEstado:unit.manualReview.estado,garantiaInicio:unit.manualReview.inicio,serieObligatoria:unit.manualReview.serie,fechaManual:unit.manualReview.fecha,revisionFuente:context.revision,sourceItemDigest:unit.sourceItemDigest});
    return base;
  }
  async function confirm(req, body) {
    const token = request(req,body,'confirmar'),actor = await verify(token),context = await source(actor,body.otKey),selected = submitted(body,context);
    await requireProtectedRules();
    const operationDigest = digest({actorUid:actor.uid,body}),opId = 'ot_units_'+operationDigest;
    const guardActor = {uid:actor.uid,claims:{...actor,svOTUnitConfirmation:true},role:context.current.role.rol,permissionRevision:context.current.config.indiceRevision ?? null,permissionDigest:digest(context.current.config),mode:'user',opId,transportDigest:operationDigest,operation:'ot-unit-confirmation',input:body};
    const result = await guard.run(guardActor,async scope => {
      const locked = await assertCurrent(token,actor,context,body.otKey);
      if (locked.fullSale) {
        const guardedSale = await scope.get('sisventas/ventas/'+locked.sale.fbKey);
        if (!same(guardedSale,context.fullSale && (() => { const original=clone(context.fullSale); if (!Object.hasOwn(guardedSale || {},'fbKey')) delete original.fbKey; return original; })())) throw fail(409,'La venta cambió. Volvé a preparar las unidades.','SV_OT_CONTEXT_CHANGED');
      }
      const saved = await existing(locked.plan.units,path => scope.get(path),locked.sale.fbKey,body.otKey);
      const existingSeries = new Map(),submittedSeries = new Map();
      const seriesIdentity = value => String(value ?? '').trim().toLocaleUpperCase('es-AR');
      for (const [savedKey,value] of Object.entries(saved)) {
        const serial = seriesIdentity(value.record.serie);
        if (!serial) continue;
        if (!existingSeries.has(serial)) existingSeries.set(serial,new Set());
        existingSeries.get(serial).add(savedKey);
      }
      for (const {unit,decision} of selected) {
        if (unit.n === null || decision.decision === 'pendiente' || unit.key && saved[unit.key]) continue;
        const serial = seriesIdentity(decision.serie);
        if (!serial) continue;
        if (existingSeries.has(serial)) throw fail(409,'La serie ya figura en otra unidad de esta venta. Revisá los equipos antes de confirmar.','SV_OT_UNIT_SERIES_CONFLICT');
        if (submittedSeries.has(serial)) throw fail(400,'La misma serie fue ingresada en dos unidades. Revisá cada equipo antes de confirmar.','SV_OT_UNIT_SERIES_DUPLICATE');
        submittedSeries.set(serial,true);
      }
      const registered = [],preserved = Object.keys(saved),reviewed = [],reviews = [],patch = Object.create(null),timestamp = now();
      for (const {unit,decision} of selected) {
        if (unit.key && saved[unit.key]) {
          if (unit.manualReview) {
            const old = saved[unit.key].record,manual = unit.manualReview;
            if (old.manualConfirmado !== true || old.garantiaEstado !== manual.estado || old.meses !== (decision.cobertura ? manual.meses : 0) || old.garantiaInicio !== manual.inicio || old.serieObligatoria !== manual.serie || old.fechaManual !== manual.fecha || old.decision !== decision.decision || old.serie !== decision.serie || old.dir !== decision.ubicacion) throw fail(409,'La unidad ya tiene condiciones registradas. Conservá su ficha original sin cambiarlas.','SV_OT_MANUAL_PRESERVED');
          }
          continue;
        }
        const target = decision.needsReview || decision.decision === 'pendiente' ? null : decision.decision === 'instalado' ? 'equipos' : decision.cobertura ? 'garantias' : null;
        if (target) {
          if (!locked.capabilities[target]) throw fail(403,'Tu rol no permite registrar esa cobertura. No se modificó ninguna unidad.');
          patch['sisventas/'+target+'/'+unit.key] = record(unit,decision,locked,actor,body.otKey,timestamp);
          registered.push(unit.key);
        } else {
          if (!locked.capabilities.reviewOT) throw fail(403,'Tu rol no permite guardar la revisión técnica de la OT');
          const reviewKey = unit.key || 'revision_'+digest({itemKey:unit.itemKey,n:unit.n});
          reviews.push({itemKey:unit.itemKey,n:unit.n,key:unit.key || '',cantidad:unit.item.qty ?? unit.item.cantidad ?? 1,decision:decision.decision,serie:decision.serie,ubicacion:decision.ubicacion,fecha:decision.fecha,needsReview:decision.needsReview,reason:decision.reason || '',...(unit.manualReview?{manual:clone(unit.manualReview),sourceItemDigest:unit.sourceItemDigest}:{})});
          reviewed.push(reviewKey);
        }
      }
      if (reviews.length) {
        const reviewPath = locked.otPath+'/unidadesConfirmacion/'+opId;
        const previous = await scope.get(reviewPath);
        const journal = {revision:context.revision,fecha:body.fecha,actorUid:actor.uid,ts:timestamp,units:reviews};
        if (previous !== null) {
          if (!object(previous) || !same(pick(previous,['revision','fecha','actorUid','units']),pick(journal,['revision','fecha','actorUid','units']))) throw fail(409,'La revisión técnica ya cambió. Volvé a abrir la OT.');
        } else patch[reviewPath] = journal;
      }
      // Raw Admin reads deliberately bypass the guarded DB snapshot cache, but
      // never write. Writes below are committed as the real user under the
      // existing rules. Financial sale writers share this guard; direct SDK OT
      // writers do not, so this is a final check, not a global cross-node CAS.
      const final = await existing(locked.plan.units,read,locked.sale.fbKey,body.otKey);
      if (!same(saved,final)) throw fail(409,'Otra sesión confirmó o cambió una unidad. Volvé a revisar antes de repetir.','SV_OT_UNIT_CHANGED');
      await assertCurrent(token,actor,context,body.otKey);
      const decisions = new Map(selected.map(row => [row.unit.itemKey+'\u0000'+row.unit.n,row.decision]));
      const everyInstalled = locked.plan.units.every(unit => {
        const savedRecord = unit.key && saved[unit.key]?.record;
        if (savedRecord) return saved[unit.key].path === 'equipos' && !!model.date(savedRecord.fechaInstalacion) && savedRecord.fechaInstalacion <= localDate(now);
        return decisions.get(unit.itemKey+'\u0000'+unit.n)?.decision === 'instalado';
      }) && locked.plan.summaries.filter(row => row.reason !== 'labor').every(row => decisions.get(row.itemKey+'\u0000null')?.decision === 'instalado') && !locked.plan.issues.some(issue => ['too-many-units','invalid-item','invalid-quantity','invalid-sale'].includes(issue.reason));
      const estadoInst = everyInstalled ? 'instalado' : 'en_instalacion';
      if (locked.capabilities.reviewOT && locked.ot.unidadesEstadoInstalacion !== estadoInst) patch[locked.otPath+'/unidadesEstadoInstalacion'] = estadoInst;
      if (typeof scope.beforeCommit !== 'function') throw fail(503,'Falta verificar el contexto final del guardado de unidades');
      scope.beforeCommit(async () => {
        await requireProtectedRules();
        await assertCurrent(token,actor,context,body.otKey);
        const latest = await existing(locked.plan.units,read,locked.sale.fbKey,body.otKey);
        if (!same(saved,latest)) throw fail(409,'Otra sesión cambió una unidad antes de guardar. Volvé a prepararla.','SV_OT_UNIT_CHANGED');
      });
      await scope.update(patch);
      return {ok:true,otKey:body.otKey,registered,preserved,reviewed,estadoInst};
    });
    if (!object(result) || result.ok !== true || result.otKey !== body.otKey || !['instalado','en_instalacion'].includes(result.estadoInst)) throw fail(503,'La confirmación requiere una revisión de su acuse antes de repetirla');
    const normalized = {...result};
    for (const name of ['registered','preserved','reviewed']) {
      // RTDB removes empty arrays when persisting the guarded receipt. Keep the
      // HTTP contract stable on a replay without changing global serialization.
      const values = result[name] ?? [];
      if (!Array.isArray(values) || values.some(value => !key(value)) || new Set(values).size !== values.length) throw fail(503,'El detalle de la confirmación requiere revisión antes de repetirla');
      normalized[name] = values;
    }
    return normalized;
  }
  const custody=custodyEnabled?require('./ot-unit-custody').createOTUnitCustody({db,guard,verify,enabled:custodyEnabled,now,source:async(actor,otKey,intent)=>{
    const c=await source(actor,otKey,intent),role=c.current.role.rol,config=c.current.config;
    return {...c,custodyCapabilities:{historicalMapping:role==='admin',entregar:actionAllowed(config,'ot','entregarMateriales',OT_ACTIONS.entregarMateriales,role),devolver:actionAllowed(config,'ot','rendirMateriales',OT_ACTIONS.rendirMateriales,role),recibir:actionAllowed(config,'ot','entregarMateriales',OT_ACTIONS.entregarMateriales,role)}};
  }}):{prepare:async()=>{throw fail(503,'La custodia por serie todavía no está habilitada');},confirm:async()=>{throw fail(503,'La custodia por serie todavía no está habilitada');}};
  return Object.freeze({prepare,confirm,custodyPrepare:custody.prepare,custodyConfirm:custody.confirm});
}
module.exports = {createOTUnitConfirmation};
