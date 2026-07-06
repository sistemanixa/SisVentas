// FUNCIONES DE LOGIN — ejecutan ANTES del HTML

window.togglePassVis = function() {
  var inp = document.getElementById('l-pass');
  var ico = document.getElementById('ico-show-pass');
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    if (ico) ico.className = 'ti ti-eye-off';
  } else {
    inp.type = 'password';
    if (ico) ico.className = 'ti ti-eye';
  }
};

window.iniciarLoginConFeedback = function() {
  var btn = document.getElementById('btn-login');
  var ico = document.getElementById('ico-login-btn');
  var txt = document.getElementById('txt-login-btn');
  var err = document.getElementById('login-error');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.8'; }
  if (ico) { ico.className = 'ti ti-loader-2'; ico.style.animation = 'spin 1s linear infinite'; }
  if (txt) txt.textContent = ' Verificando...';
  if (err) err.style.display = 'none';
  window.iniciarLogin();
};

window._resetLoginBtn = function() {
  var btn = document.getElementById('btn-login');
  var ico = document.getElementById('ico-login-btn');
  var txt = document.getElementById('txt-login-btn');
  if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  if (ico) { ico.className = 'ti ti-login'; ico.style.animation = ''; }
  if (txt) txt.textContent = ' Ingresar';
};

window.iniciarLogin = function() {
  var err = document.getElementById('login-error');
  if (typeof window.doLogin === 'function') {
    window.doLogin();
    return;
  }
  var intentos = 0;
  var fired = false;
  var onReady = function() {
    if (fired) return;
    fired = true;
    document.removeEventListener('firebase-ready', onReady);
    clearInterval(iv);
    if (typeof window.doLogin === 'function') window.doLogin();
  };
  document.addEventListener('firebase-ready', onReady);
  var iv = setInterval(function() {
    intentos++;
    if (typeof window.doLogin === 'function') {
      clearInterval(iv);
      if (!fired) { fired = true; document.removeEventListener('firebase-ready', onReady); window.doLogin(); }
    } else if (intentos > 150) {
      clearInterval(iv);
      if (!fired) {
        fired = true;
        window._resetLoginBtn();
        if (err) { err.textContent = 'No se pudo conectar. Recargá la página.'; err.style.display = 'block'; }
      }
    }
  }, 100);
};

// Restaurar modo oscuro guardado
try {
  if (localStorage.getItem('nixa_dark') === '1') document.documentElement.classList.add('dark-mode');
} catch(e) {}
