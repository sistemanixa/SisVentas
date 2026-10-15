'use strict';
const crypto = require('node:crypto');
const {rulesProtectPasswords} = require('./password-policy');
const fail = (statusCode, message) => Object.assign(Error(message), {statusCode});
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const passwordDigest = (password, salt) => crypto.scryptSync(password, salt, 32).toString('hex');

// Private RTDB state, never a password/profile field. Also rejects tokens issued
// before a reset after the password has been changed and the gate reopened.
async function assertAccessReady(db, token) {
  const state = (await db.ref('sv_access_resets/' + token.uid).get()).val();
  if (token.svPasswordChangeRequired === true || (state && (state.required || state.version !== token.svAccessVersion))) {
    throw fail(403, 'Tenés que actualizar tu contraseña y volver a ingresar');
  }
}
function createBusinessAuth(auth, db) {
  return {async verifyIdToken(token) {
    const identity = await auth.verifyIdToken(token, true);
    await assertAccessReady(db, identity);
    return identity;
  }};
}

function createUserAccess({auth, db, sendResetEmail, enabled = false, now = Date.now}) {
  async function identity(req) {
    if (!enabled) throw fail(503, 'Gestión de acceso pendiente de habilitación segura en el servidor');
    const match = String(req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i);
    if (!match) throw fail(401, 'Sesión requerida');
    try { return await auth.verifyIdToken(match[1], true); }
    catch (_) { throw fail(401, 'La sesión venció; volvé a ingresar'); }
  }
  async function administrator(req) {
    const actor = await identity(req);
    await assertAccessReady(db, actor);
    const role = (await db.ref('sv_chat_roles/' + actor.uid).get()).val();
    const cfg = (await db.ref('sv_permisos/admin').get()).val() || {};
    if (role?.activo !== true || role.rol !== 'admin' || Object.values(cfg.bloqueados || {}).includes('usuarios') || cfg.acciones?.usuarios?.gestionarClave === false) {
      throw fail(403, 'Solo un administrador con permiso puede gestionar el acceso');
    }
    // A stolen old admin session cannot issue credentials. Reauthentication is
    // explicit in the UI; the password is sent only to Firebase Auth.
    if (!Number.isFinite(actor.auth_time) || now() / 1000 - actor.auth_time > 300) {
      throw fail(401, 'Confirmá nuevamente tu contraseña de administrador');
    }
    return actor;
  }
  async function target(actor, profileKey) {
    if (!key(profileKey)) throw fail(400, 'Usuario inválido');
    const profile = (await db.ref('sv_usuarios/' + profileKey).get()).val();
    if (!profile || !key(profile.uid) || profile.activo === false) throw fail(400, 'No se encontró un usuario activo vinculado');
    if (profile.uid === actor.uid) throw fail(400, 'Para tu propia cuenta usá el cambio de contraseña personal');
    const role = (await db.ref('sv_chat_roles/' + profile.uid).get()).val();
    if (role?.activo !== true || role.rol !== profile.rol) throw fail(400, 'El acceso y la ficha no coinciden');
    const matches = (await db.ref('sv_usuarios').orderByChild('uid').equalTo(profile.uid).get()).val() || {};
    if (Object.keys(matches).length !== 1) throw fail(409, 'La identidad tiene fichas duplicadas; requiere revisión');
    let user;
    try { user = await auth.getUser(profile.uid); }
    catch (_) { throw fail(400, 'No se encontró la cuenta de acceso'); }
    const state = (await db.ref('sv_access_resets/' + profile.uid).get()).val();
    if (user.disabled && !(state?.required && state.disabledByReset && state.phase === 'failed')) throw fail(400, 'La cuenta está deshabilitada');
    if (!user.email || String(user.email).toLowerCase() !== String(profile.mail || '').toLowerCase()) throw fail(409, 'El correo de la ficha no coincide con la cuenta de acceso');
    return {uid: profile.uid, user};
  }
  async function limit(actor, uid) {
    const result = await db.ref('sv_access_control/limits/' + actor.uid + '/' + uid).transaction(current => {
      if (current && now() - current.at < 60000) return;
      return {at: now()};
    });
    if (!result.committed) throw fail(429, 'Esperá un minuto antes de volver a solicitarlo');
  }
  async function audit(action, actor, uid, version) {
    await db.ref('sv_access_control/audit').push().set({action, actor: actor.uid, target: uid, at: now(), ...(version ? {version} : {})});
  }
  async function temporary(req, body) {
    const actor = await administrator(req);
    // A flag alone must never enable resets against unprotected live data.
    // Check the effective rules on EVERY temporary reset, without changing them.
    if (!db.getRulesJSON || !rulesProtectPasswords(await db.getRulesJSON())) throw fail(503, 'Falta verificar la protección obligatoria de contraseñas en las reglas del servidor');
    const account = await target(actor, body.profileKey);
    await limit(actor, account.uid);
    const ref = db.ref('sv_access_resets/' + account.uid);
    const version = crypto.randomBytes(24).toString('hex');
    const password = crypto.randomBytes(15).toString('base64url') + '!7aA';
    const salt = crypto.randomBytes(16).toString('hex');
    const result = await ref.transaction(current => {
      if (['preparing', 'completing'].includes(current?.phase)) return;
      return {required: true, phase: 'preparing', version, issuedAt: now(), expiresAt: now() + 86400000,
        actor: actor.uid, salt, digest: passwordDigest(password, salt), disabledByReset: true};
    });
    if (!result.committed) throw fail(409, 'Ya hay una actualización de acceso en curso');
    try {
      // Gate closes BEFORE Auth changes. Disable briefly so no login can acquire
      // the new version claim while the previous password still works.
      await auth.updateUser(account.uid, {disabled: true});
      await auth.revokeRefreshTokens(account.uid);
      await auth.setCustomUserClaims(account.uid, {...account.user.customClaims, svAccessVersion: version, svPasswordChangeRequired: true});
      await auth.updateUser(account.uid, {password});
      await audit('temporary-password', actor, account.uid, version);
      await auth.updateUser(account.uid, {disabled: false});
      await ref.update({phase: 'ready'});
      return {password, expiresAt: result.snapshot.val().expiresAt}; // only this response; never logged/persisted
    } catch (_) {
      await ref.update({phase: 'failed'}).catch(() => {});
      throw fail(503, 'No se pudo completar el cambio de acceso. La cuenta permanece protegida; reintentá desde Usuarios');
    }
  }
  async function email(req, body) {
    const actor = await administrator(req), account = await target(actor, body.profileKey);
    if (account.user.disabled) throw fail(409, 'Completá primero la recuperación de la cuenta protegida');
    await limit(actor, account.uid);
    // Uses the AUTH email found by UID, never an address provided by the caller.
    await sendResetEmail(account.user.email);
    await audit('reset-email', actor, account.uid);
    return {sent: true};
  }
  async function complete(req, body) {
    const actor = await identity(req);
    if (actor.firebase?.sign_in_provider !== 'password') throw fail(403, 'Ingresá con tu clave temporal');
    const role = (await db.ref('sv_chat_roles/' + actor.uid).get()).val();
    if (role?.activo !== true) throw fail(403, 'Acceso inactivo');
    const password = body.password;
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw fail(400, 'Usá entre 12 y 128 caracteres');
    const ref = db.ref('sv_access_resets/' + actor.uid);
    const before = (await ref.get()).val();
    if (!before?.required || before.phase !== 'ready' || actor.svAccessVersion !== before.version || before.expiresAt < now()) throw fail(403, 'La clave temporal venció o fue reemplazada. Pedí una nueva');
    if (crypto.timingSafeEqual(Buffer.from(passwordDigest(password, before.salt), 'hex'), Buffer.from(before.digest, 'hex'))) throw fail(400, 'Elegí una clave diferente de la temporal');
    const lock = await ref.transaction(current => {
      // The SDK may call this first with an empty local cache even after get().
      // Propose the already-verified, CLOSED state; the server retries against
      // its actual version. A missing node is restored closed, never opened.
      const value = current || before;
      return value.version === before.version && value.required && value.phase === 'ready' ? {...value, phase: 'completing'} : undefined;
    });
    if (!lock.committed) throw fail(409, 'El acceso cambió. Volvé a ingresar');
    try {
      const user = await auth.getUser(actor.uid);
      if (user.disabled) throw Error('disabled');
      await auth.updateUser(actor.uid, {password});
      await auth.revokeRefreshTokens(actor.uid);
      await auth.setCustomUserClaims(actor.uid, {...user.customClaims, svPasswordChangeRequired: false});
      await audit('password-completed', actor, actor.uid, before.version);
      // Keep version to deny tokens from BEFORE the reset, even after completion.
      await ref.set({required: false, version: before.version, completedAt: now()});
      return {completed: true, signInAgain: true};
    } catch (_) {
      await ref.update({phase: 'failed'}).catch(() => {});
      throw fail(503, 'No se pudo completar el cambio. El acceso sigue protegido; pedí una nueva clave temporal');
    }
  }
  return {temporary, email, complete};
}
module.exports = {createUserAccess, createBusinessAuth, assertAccessReady};
