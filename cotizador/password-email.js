'use strict';
// Firebase sends its standard reset email. No reset link/temporary password is
// returned to an admin, written to RTDB, or sent to a caller-selected mailbox.
function createPasswordEmail({apiKey, fetchImpl = fetch}) {
  return async function sendResetEmail(email) {
    if (!apiKey) throw Object.assign(Error('El correo de recuperación no está configurado en el servidor'), {statusCode: 503});
    let response;
    try {
      response = await fetchImpl('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=' + encodeURIComponent(apiKey), {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({requestType: 'PASSWORD_RESET', email}), signal: AbortSignal.timeout(15000)
      });
    } catch (_) { throw Object.assign(Error('No se pudo solicitar el correo. Revisá la conexión e intentá nuevamente'), {statusCode: 503}); }
    if (!response.ok) throw Object.assign(Error('Firebase no pudo enviar el correo. Revisá la configuración de recuperación'), {statusCode: 503});
  };
}
module.exports = {createPasswordEmail};
