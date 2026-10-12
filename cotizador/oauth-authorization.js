const crypto = require('node:crypto');
const fail = (statusCode, message) => Object.assign(new Error(message), {statusCode});
function createOAuthAuthorization({auth, db, now = Date.now}) {
  async function checkAdmin(uid) {
    const user = (await db.ref('sv_chat_roles/' + uid).get()).val();
    if (!user || user.activo !== true || user.rol !== 'admin') throw fail(403, 'Se requiere un administrador activo');
    const permissions = (await db.ref('sv_permisos/admin').get()).val();
    if (permissions?.bloqueados?.includes('configuracion')) throw fail(403, 'Configuración no habilitada');
  }
  async function authorize(req) {
    const match = String(req.headers.authorization || '').match(/^Bearer\s+([^\s]+)$/i);
    if (!match) throw fail(401, 'Sesión Firebase requerida');
    let identity;
    try {identity = await auth.verifyIdToken(match[1], true);} catch (_) {throw fail(401, 'Sesión Firebase inválida');}
    await checkAdmin(identity.uid);
    return identity.uid;
  }
  function stateRef(state) {
    const key = crypto.createHash('sha256').update(state).digest('hex');
    return db.ref('sv_server_oauth_states/mercadolibre/' + key);
  }
  async function register(state, uid) {
    await stateRef(state).set({uid, expiresAt: now() + 600000, consumed: false});
  }
  async function consume(state) {
    const ref = stateRef(state);
    const saved = (await ref.get()).val();
    if (!saved || saved.consumed || saved.expiresAt <= now()) throw fail(400, 'La autorización no es válida o ya fue utilizada');
    await checkAdmin(saved.uid);
    const result = await ref.transaction(current => {
      if (!current || current.uid !== saved.uid || current.consumed || current.expiresAt <= now()) return;
      return {...current, consumed: true, consumedAt: now()};
    });
    if (!result.committed) throw fail(400, 'La autorización ya fue utilizada');
    return saved.uid;
  }
  return {authorize, register, consume};
}
module.exports = {createOAuthAuthorization};
