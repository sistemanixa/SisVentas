(function (root) {
  'use strict';
  var activeUser = null, gateEpoch = 0;
  function close() {
    var modal = document.getElementById('sv-access-modal');
    if (modal) { modal.querySelectorAll('input').forEach(function (input) { input.value = ''; }); modal.remove(); }
  }
  function modal(title, detail) {
    close();
    var overlay = document.createElement('div');
    overlay.id = 'sv-access-modal';
    overlay.className = 'sv-access-overlay';
    overlay.innerHTML = '<section class="sv-access-dialog" role="dialog" aria-modal="true" aria-labelledby="sv-access-title">' +
      '<header><h2 id="sv-access-title"></h2><button class="btn btn-sm btn-icon" type="button" aria-label="Cerrar">×</button></header>' +
      '<p class="sv-access-detail"></p><div class="sv-access-body"></div><p class="sv-access-status" role="status" aria-live="polite"></p></section>';
    overlay.querySelector('h2').textContent = title;
    overlay.querySelector('.sv-access-detail').textContent = detail;
    overlay.querySelector('header button').onclick = close;
    document.body.appendChild(overlay);
    return overlay;
  }
  function status(overlay, text) { overlay.querySelector('.sv-access-status').textContent = text; }
  function busy(overlay, value) { overlay.querySelectorAll('button').forEach(function (button) { button.disabled = value; }); }
  async function endSession() {
    close(); activeUser = null; gateEpoch++;
    root._loginEnCurso = false;
    root._resetLoginBtn?.();
    await root.fbSignOut(root.fbAuth);
  }
  async function request(path, body, user) {
    if (!user || root.fbAuth?.currentUser !== user) throw Error('La sesión cambió; volvé a ingresar');
    var base = root.SISVENTAS_FUNCTIONS?.cotizadorProveedor;
    if (!base) throw Error('No se encontró el servicio de gestión de acceso');
    var token = await user.getIdToken();
    if (root.fbAuth.currentUser !== user) throw Error('La sesión cambió; volvé a ingresar');
    var response;
    try {
      response = await fetch(base + '/usuarios/acceso/' + path, {method: 'POST', cache: 'no-store',
        headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token}, body: JSON.stringify(body), signal: AbortSignal.timeout(25000)});
    } catch (_) { throw Error('No llegó la confirmación del servidor. Revisá el acceso antes de reintentar; no se repite automáticamente'); }
    var result;
    try { result = await response.json(); } catch (_) { throw Error('La gestión de acceso todavía no está disponible en este servidor'); }
    if (!response.ok || result.ok !== true) throw Error(result.mensaje || 'No se pudo completar la gestión de acceso');
    if (root.fbAuth.currentUser !== user) throw Error('La sesión cambió; cerrá esta ventana y volvé a ingresar');
    return result;
  }
  function adminAllowed() {
    return !root._impersonacionOriginal && root.currentRole === 'admin' && root.tienePermiso?.('usuarios.gestionarClave');
  }
  function open(profileKey, preferred) {
    if (!adminAllowed()) { root.notify?.('Solo un administrador con permiso puede gestionar el acceso'); return; }
    var profile = (root.usuariosData || []).find(function (item) { return item.fbKey === profileKey; });
    var user = root.fbAuth?.currentUser;
    if (!profile?.uid || !user || profile.uid === user.uid) { root.notify?.('Elegí otro usuario activo con cuenta de acceso'); return; }
    var overlay = modal('Gestionar acceso', (profile.nombre || profile.login || 'Usuario') + ' · ' + (profile.mail || 'Sin correo'));
    var body = overlay.querySelector('.sv-access-body');
    body.innerHTML = '<label for="sv-access-admin">Confirmá tu contraseña de administrador</label>' +
      '<input class="fi" id="sv-access-admin" type="password" autocomplete="current-password">' +
      '<p>La clave temporal dura 24 horas y exige elegir una nueva al ingresar. Se muestra una sola vez.</p>' +
      '<div class="sv-access-actions"><button class="btn btn-primary" type="button" data-action="temporal">Generar clave temporal</button>' +
      '<button class="btn" type="button" data-action="correo">Enviar restablecimiento por correo</button></div>';
    if (preferred === 'correo') status(overlay, 'El correo se envía a la dirección verificada de la cuenta.');
    body.querySelectorAll('[data-action]').forEach(function (button) {
      button.onclick = async function () {
        if (!adminAllowed()) { status(overlay, 'La sesión ya no permite gestionar acceso'); return; }
        var input = overlay.querySelector('#sv-access-admin'), password = input.value;
        if (!password) { status(overlay, 'Ingresá tu contraseña de administrador'); input.focus(); return; }
        var action = button.dataset.action;
        if (!await root.svConfirm(action === 'temporal' ? 'Se reemplazará la contraseña de este usuario y se cerrarán sus sesiones. ¿Continuar?' : '¿Enviar el correo de restablecimiento a este usuario?')) return;
        if (!overlay.isConnected || root.fbAuth.currentUser !== user || !adminAllowed()) return;
        busy(overlay, true); status(overlay, 'Verificando y solicitando al servidor…');
        try {
          if (!root.fbReauthenticate) throw Error('No está disponible la confirmación de acceso');
          try { await root.fbReauthenticate(user, password); }
          catch (_) { throw Error('No se pudo confirmar tu contraseña de administrador'); }
          finally { password = ''; input.value = ''; }
          if (!adminAllowed() || root.fbAuth.currentUser !== user) throw Error('La sesión cambió; volvé a ingresar');
          var result = await request(action, {profileKey: profileKey}, user);
          if (!overlay.isConnected) return;
          if (action === 'temporal') {
            body.innerHTML = '<label for="sv-access-temporary">Clave temporal · mostrada una sola vez</label><input class="fi" id="sv-access-temporary" type="password" readonly autocomplete="off">' +
              '<div class="sv-access-actions"><button class="btn" type="button" id="sv-access-reveal">Mostrar clave</button><button class="btn btn-primary" type="button" id="sv-access-done">Listo</button></div>';
            var temporary = body.querySelector('input'); temporary.value = result.password; result.password = '';
            body.querySelector('#sv-access-reveal').onclick = function () { temporary.type = temporary.type === 'password' ? 'text' : 'password'; this.textContent = temporary.type === 'password' ? 'Mostrar clave' : 'Ocultar clave'; };
            body.querySelector('#sv-access-done').onclick = close;
            status(overlay, 'Entregala por un canal privado. Al cerrar esta ventana no se podrá volver a consultar.');
          } else status(overlay, 'Correo de restablecimiento solicitado correctamente. Revisá también Spam.');
        } catch (error) { if (overlay.isConnected) status(overlay, error.message); }
        finally { password = ''; if (input.isConnected) input.value = ''; if (overlay.isConnected) busy(overlay, false); }
      };
    });
    body.querySelector('input').focus();
  }
  async function gate(user) {
    if (!user) return false;
    var epoch = ++gateEpoch;
    var result = await user.getIdTokenResult();
    if (epoch !== gateEpoch || root.fbAuth.currentUser !== user) return true;
    if (result.claims.svPasswordChangeRequired !== true) return false;
    if (activeUser === user && document.querySelector('#sv-access-modal [data-force-change]')) return true;
    root._bloquearInterfazSinSesion?.({limpiarCredenciales: true});
    activeUser = user;
    var overlay = modal('Elegí tu nueva contraseña', 'La clave temporal permite únicamente completar este paso. Después vas a ingresar con tu clave personal.');
    var body = overlay.querySelector('.sv-access-body');
    body.innerHTML = '<form data-force-change><label for="sv-access-new">Nueva contraseña</label><input class="fi" id="sv-access-new" type="password" autocomplete="new-password" minlength="12" maxlength="128" required>' +
      '<label for="sv-access-confirm">Repetir contraseña</label><input class="fi" id="sv-access-confirm" type="password" autocomplete="new-password" required>' +
      '<p>Entre 12 y 128 caracteres. Tiene que ser diferente de la clave temporal.</p><button class="btn btn-primary" type="submit">Guardar nueva contraseña</button></form>';
    overlay.querySelector('header button').setAttribute('aria-label', 'Cerrar sesión');
    overlay.querySelector('header button').onclick = async function () {
      try { await endSession(); } catch (_) { root.notify?.('No se pudo cerrar la sesión. Recargá antes de volver a ingresar.'); }
    };
    body.querySelector('form').onsubmit = async function (event) {
      event.preventDefault();
      var input = body.querySelector('#sv-access-new'), confirmation = body.querySelector('#sv-access-confirm');
      if (input.value.length < 12 || input.value.length > 128) { status(overlay, 'Usá entre 12 y 128 caracteres'); return; }
      if (input.value !== confirmation.value) { status(overlay, 'Las contraseñas no coinciden'); return; }
      busy(overlay, true); status(overlay, 'Actualizando contraseña…');
      try {
        await request('completar', {password: input.value}, user);
        input.value = ''; confirmation.value = '';
        await endSession();
        root.notify?.('Contraseña actualizada. Ingresá con tu nueva clave.');
      } catch (error) { if (overlay.isConnected) status(overlay, error.message); }
      finally { input.value = ''; confirmation.value = ''; if (overlay.isConnected) busy(overlay, false); }
    };
    body.querySelector('input').focus();
    return true;
  }
  root.SVUserAccess = {open: open, gate: gate, close: close};
  document.addEventListener('sisventas:session-ended', function () { activeUser = null; close(); });
})(window);
