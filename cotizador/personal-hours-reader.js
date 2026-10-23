'use strict';
const crypto = require('node:crypto');
const INTERNAL = new Set(['admin','administrativo','vendedor','tecnico_vendedor','tecnico']);
const OWN_DEFAULTS = new Set(['administrativo','vendedor','tecnico_vendedor','tecnico']);
const FIELDS = ['empFbKey','estado','horas','fecha','mes'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const rtdbKey = value => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value,'utf8') <= 768 && !/[.#$\[\]\/\x00-\x1f\x7f]/.test(value);
const uidKey = value => rtdbKey(value) && value.length <= 128;
const fail = (statusCode, message, code) => Object.assign(Error(message), {statusCode, ...(code ? {code} : {})});
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).sort().map(name => JSON.stringify(name)+':'+stable(value[name])).join(',') + '}';
}
const digest = value => crypto.createHash('sha256').update(stable(value)).digest('hex');

function selection(req) {
  if (req?.method !== 'GET') throw fail(405, 'Método no permitido');
  if (typeof req.url !== 'string' || !req.url.startsWith('/')) throw fail(400, 'Solicitud de lectura inválida');
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/laboral/horas-propias' || url.hash) throw fail(400, 'Solicitud de lectura inválida');
  const params = [...url.searchParams];
  if (params.length > 1 || params.some(([name]) => name !== 'viewProfile')) throw fail(400, 'La lectura no admite esos parámetros');
  const viewProfile = params.length ? params[0][1] : null;
  if (viewProfile !== null && !rtdbKey(viewProfile)) throw fail(400, 'Perfil de vista inválido');
  const headers = req.headers || {};
  const length = headers['content-length'] ?? headers['Content-Length'];
  if (req.body !== undefined || headers['transfer-encoding'] || headers['Transfer-Encoding'] || length !== undefined && String(length).trim() !== '0') throw fail(400, 'La lectura no admite un cuerpo');
  return viewProfile;
}

function moduleAllowed(config, name) {
  if (!object(config) || config.indiceVersion !== 2 || !object(config.indiceModulos) || config.indiceModulos[name] !== true) return false;
  const blocked = config.bloqueados;
  return (blocked === undefined || object(blocked) || Array.isArray(blocked)) && !Object.values(blocked || {}).includes(name);
}
function actionAllowed(config, group, name, defaults, role) {
  if (config.acciones !== undefined && !object(config.acciones)) return false;
  const actions = config.acciones?.[group];
  if (actions !== undefined && !object(actions)) return false;
  return actions && Object.hasOwn(actions, name) ? actions[name] === true : defaults.has(role);
}
function dashboardAccess(authority) {
  return moduleAllowed(authority.config, 'dashboard') && actionAllowed(authority.config, 'dashboard', 'miCuenta', OWN_DEFAULTS, authority.role.rol);
}

function project(value, employeeId) {
  if (value === null) return [];
  if (typeof value !== 'object') throw fail(503, 'La consulta de horas no devolvió un detalle válido');
  const records = [];
  // DataSnapshot.val() can use an array for dense numeric Firebase keys.
  // Its own enumeration order, not forEach/index sorting, defines legacy sums.
  for (const recordKey of Object.keys(value)) {
    const row = value[recordKey];
    if (Array.isArray(value) && row === null) continue;
    if (!rtdbKey(recordKey) || !object(row) || row.empFbKey !== employeeId) throw fail(503, 'La consulta de horas requiere verificación');
    for (const name of ['estado','horas']) {
      const item = row[name];
      if (item !== undefined && item !== null && typeof item !== 'string' && !(typeof item === 'number' && Number.isFinite(item))) throw fail(503, 'El detalle de horas no es válido');
    }
    for (const name of ['fecha','mes']) if (row[name] !== undefined && row[name] !== null && typeof row[name] !== 'string') throw fail(503, 'La fecha de horas no es válida');
    records.push({key:recordKey, value:Object.fromEntries(FIELDS.filter(name => Object.hasOwn(row, name)).map(name => [name,row[name]]))});
  }
  return records;
}

function createPersonalHoursReader({auth, db}) {
  if (typeof auth?.verifyIdToken !== 'function' || typeof db?.ref !== 'function') throw Error('Falta el lector autenticado de horas propias');
  async function readValue(path) {
    try {
      const snapshot = await db.ref(path).get();
      if (typeof snapshot?.val !== 'function') throw Error('Snapshot inválido');
      const value = snapshot.val();
      if (value === undefined) throw Error('Snapshot incompleto');
      return value;
    } catch (_) { throw fail(503, 'No se pudo verificar la cuenta o sus horas'); }
  }
  async function authority(uid) {
    const role = await readValue('sv_chat_roles/'+uid);
    if (!object(role) || role.activo !== true || !INTERNAL.has(role.rol)) throw fail(403, 'Usuario sin acceso a horas personales');
    const config = await readValue('sv_permisos/'+role.rol);
    if (!object(config) || config.indiceVersion !== 2) throw fail(403, 'Los permisos actuales requieren verificación');
    return {role, config};
  }
  async function context(actor, viewProfile) {
    const reset = await readValue('sv_access_resets/'+actor.uid);
    if (reset !== null && !object(reset) || actor.svPasswordChangeRequired === true || reset && (reset.required || reset.version !== actor.svAccessVersion)) throw fail(403, 'Actualizá tu acceso y volvé a ingresar');
    const current = await authority(actor.uid);
    let targetUid = actor.uid, targetAuthority = current, profile, profileKey;
    if (viewProfile !== null) {
      const admin = new Set(['admin']);
      if (current.role.rol !== 'admin' || !moduleAllowed(current.config,'usuarios') || !actionAllowed(current.config,'usuarios','impersonar',admin,'admin')
        || !moduleAllowed(current.config,'ctaemp') || !actionAllowed(current.config,'empleados','autorizarHoras',admin,'admin')) throw fail(403, 'No tenés acceso a esa vista de horas');
      profileKey = viewProfile;
      profile = await readValue('sv_usuarios/'+profileKey);
      if (!object(profile) || !uidKey(profile.uid)) throw fail(403, 'El perfil de vista no está verificado');
      targetUid = profile.uid;
      targetAuthority = targetUid === actor.uid ? current : await authority(targetUid);
    }
    const binding = await readValue('sv_empleado_uid/'+targetUid);
    if (!object(binding) || !rtdbKey(binding.perfilFbKey) || viewProfile !== null && binding.perfilFbKey !== viewProfile) throw fail(403, 'No se encontró un vínculo laboral verificado');
    profileKey = binding.perfilFbKey;
    if (!profile) profile = await readValue('sv_usuarios/'+profileKey);
    if (!object(profile) || profile.uid !== targetUid || profile.activo === false || !rtdbKey(profile.empleadoFbKey)
      || profile.rol !== undefined && profile.rol !== targetAuthority.role.rol || !dashboardAccess(targetAuthority)) throw fail(403, 'No tenés acceso a esa cuenta personal');
    return {actorUid:actor.uid,reset,current,targetUid,targetAuthority,binding,profileKey,profile,employeeId:profile.empleadoFbKey};
  }
  async function read(req) {
    const viewProfile = selection(req);
    const token = String(req.headers?.authorization || req.headers?.Authorization || '').match(/^Bearer\s+(\S+)$/i);
    if (!token) throw fail(401, 'Sesión requerida');
    let actor;
    try { actor = await auth.verifyIdToken(token[1], true); }
    catch (error) { throw fail(error.statusCode === 403 ? 403 : 401, error.statusCode === 403 ? 'Actualizá tu acceso y volvé a ingresar' : 'La sesión venció; volvé a ingresar'); }
    if (!object(actor) || !uidKey(actor.uid)) throw fail(401, 'Sesión inválida');
    const before = await context(actor, viewProfile);
    let source;
    try { source = (await db.ref('sisventas/hsextra_solicitudes').orderByChild('empFbKey').equalTo(before.employeeId).get()).val(); }
    catch (_) { throw fail(503, 'No se pudieron consultar tus horas'); }
    const records = project(source, before.employeeId);
    const after = await context(actor, viewProfile);
    if (digest(after) !== digest(before)) throw fail(409, 'La cuenta o sus permisos cambiaron. Volvé a consultar.', 'SV_PERSONAL_HOURS_CONTEXT_CHANGED');
    return {employeeId:before.employeeId,records};
  }
  return Object.freeze({read});
}
module.exports = {createPersonalHoursReader, project};
