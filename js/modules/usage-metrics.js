(function(){
'use strict';
var _usoUsuariosCache = null;
var _usoUsuariosCargando = false;
function formatearDuracionUso(ms) {
  var minutos = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  if (minutos < 60) return minutos + ' min';
  var horas = Math.floor(minutos / 60);
  var resto = minutos % 60;
  return horas + ' h' + (resto ? ' ' + resto + ' min' : '');
}
function nombreUsuarioUso(registro, clave) {
  var email = String((registro && registro.email) || '').toLowerCase();
  var usuario = (window.usuariosData || []).find(function(u) {
    var mail = String(u.mail || (u.login && u.login.includes('@') ? u.login : (u.login || '') + '@sistemanixa.com')).toLowerCase();
    return (email && mail === email) || String(u.uid || '') === String(clave || '');
  });
  return (usuario && (usuario.nombre || usuario.login)) || (registro && (registro.nombre || registro.email)) || 'Usuario sin identificar';
}
function renderMetricasUsoUsuarios(datos, periodo) {
  var grafico = document.getElementById('usuarios-uso-grafico');
  if (!grafico) return;
  var ahora = new Date();
  var desde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  if (periodo !== 'hoy') desde.setDate(desde.getDate() - (Math.max(1, parseInt(periodo, 10) || 7) - 1));
  var desdeKey = desde.getFullYear() + '_' + String(desde.getMonth() + 1).padStart(2, '0') + '_' + String(desde.getDate()).padStart(2, '0');
  var acumulado = {};
  Object.keys(datos || {}).forEach(function(dia) {
    if (dia < desdeKey) return;
    Object.keys(datos[dia] || {}).forEach(function(usuarioKey) {
      Object.values((datos[dia] || {})[usuarioKey] || {}).forEach(function(sesion) {
        if (!sesion) return;
        var identidad = String(sesion.uid || usuarioKey || sesion.email || 'sin_usuario');
        if (!acumulado[identidad]) acumulado[identidad] = { activoMs:0, inactivoMs:0, registro:sesion, clave:usuarioKey };
        acumulado[identidad].activoMs += Math.max(0, Number(sesion.activoMs) || 0);
        acumulado[identidad].inactivoMs += Math.max(0, Number(sesion.inactivoMs) || 0);
        acumulado[identidad].registro = sesion;
      });
    });
  });
  var filas = Object.values(acumulado).map(function(item) {
    item.nombre = nombreUsuarioUso(item.registro, item.clave);
    return item;
  }).filter(function(item){ return item.activoMs > 0 || item.inactivoMs > 0; })
    .sort(function(a,b){ return b.activoMs - a.activoMs; });
  var totalActivo = filas.reduce(function(s, x){ return s + x.activoMs; }, 0);
  var totalInactivo = filas.reduce(function(s, x){ return s + x.inactivoMs; }, 0);
  var maximo = Math.max.apply(null, [1].concat(filas.map(function(x){ return Math.max(x.activoMs, x.inactivoMs); })));
  var elActivo = document.getElementById('usuarios-uso-activo');
  var elInactivo = document.getElementById('usuarios-uso-inactivo');
  var elLider = document.getElementById('usuarios-uso-lider');
  var elLiderTiempo = document.getElementById('usuarios-uso-lider-tiempo');
  if (elActivo) elActivo.textContent = formatearDuracionUso(totalActivo);
  if (elInactivo) elInactivo.textContent = formatearDuracionUso(totalInactivo);
  if (elLider) elLider.textContent = filas.length ? filas[0].nombre : '—';
  if (elLiderTiempo) elLiderTiempo.textContent = filas.length ? formatearDuracionUso(filas[0].activoMs) + ' de uso activo' : 'sin datos todavía';
  if (!filas.length) {
    grafico.innerHTML = '<div class="usuarios-uso-vacio">La medición comenzará a completarse con el uso de esta versión.</div>';
    return;
  }
  grafico.innerHTML = filas.map(function(item) {
    var pctActivo = Math.max(1, Math.round(item.activoMs / maximo * 100));
    var pctInactivo = Math.max(1, Math.round(item.inactivoMs / maximo * 100));
    return '<div class="usuarios-uso-fila">' +
      '<div class="usuarios-uso-nombre" title="' + escapeHTML(item.nombre) + '">' + escapeHTML(item.nombre) + '</div>' +
      '<div class="usuarios-uso-barras"><div class="usuarios-uso-pista" title="Activo: ' + formatearDuracionUso(item.activoMs) + '"><div class="usuarios-uso-barra activo" style="width:' + pctActivo + '%"></div></div>' +
      '<div class="usuarios-uso-pista" title="Sin interacción: ' + formatearDuracionUso(item.inactivoMs) + '"><div class="usuarios-uso-barra inactivo" style="width:' + pctInactivo + '%"></div></div></div>' +
      '<div class="usuarios-uso-tiempo"><span style="color:var(--green)">Activo ' + formatearDuracionUso(item.activoMs) + '</span><br><span style="color:var(--amber)">Sin interacción ' + formatearDuracionUso(item.inactivoMs) + '</span></div></div>';
  }).join('');
}
var _usoUsuariosSolicitud = 0;
function cargarMetricasUsoUsuarios(periodo) {
  periodo = String(periodo || (document.getElementById('usuarios-uso-periodo') || {}).value || '7');
  if (!window.fbDB || !window.fbGet) return;
  var solicitud = ++_usoUsuariosSolicitud;
  var uid = currentUserUid;
  var ahora = new Date();
  var desde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  var dias = periodo === 'hoy' ? 1 : Math.min(30, Math.max(1, parseInt(periodo, 10) || 7));
  desde.setDate(desde.getDate() - dias + 1);
  function clave(d) { return d.getFullYear() + '_' + String(d.getMonth()+1).padStart(2,'0') + '_' + String(d.getDate()).padStart(2,'0'); }
  _usoUsuariosCargando = true;
  var consulta = window.fbQuery(window.fbRef(window.fbDB, 'sisventas/uso_usuarios'), window.fbOrderByKey(), window.fbStartAt(clave(desde)), window.fbEndAt(clave(ahora)));
  return window.fbGet(consulta).then(function(snap) {
    if (solicitud !== _usoUsuariosSolicitud || uid !== currentUserUid) return;
    _usoUsuariosCache = snap.val() || {};
    renderMetricasUsoUsuarios(_usoUsuariosCache, periodo);
  }).catch(function() {
    if (solicitud !== _usoUsuariosSolicitud || uid !== currentUserUid) return;
    var grafico = document.getElementById('usuarios-uso-grafico');
    if (grafico) grafico.innerHTML = '<div class="usuarios-uso-vacio">No se pudieron cargar las métricas de uso.</div>';
  }).finally(function(){ if (solicitud === _usoUsuariosSolicitud) _usoUsuariosCargando = false; });
}
window.SVUsageMetrics = {cargar:cargarMetricasUsoUsuarios};
})();
