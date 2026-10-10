    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
    import { getDatabase, ref, set, get, push, onValue, update, remove, onDisconnect, serverTimestamp, query, orderByChild, orderByKey, equalTo, startAt, endAt, runTransaction }
      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
    import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
             createUserWithEmailAndPassword, updatePassword, sendPasswordResetEmail,
             signInWithEmailAndPassword as reSignIn }
      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
    import { getStorage, ref as storageRef, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject }
      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

    // Capturar errores JS globales para debug
    window.addEventListener('error', function(event) {
      console.error('[JS ERROR]', event.message, 'en línea', event.lineno, event.filename, event.error || '');
    });
    const firebaseConfig = {
      apiKey: "AIzaSyCw8Q4-fUA69iWFkDuy8qEkEcOGHOjFsto",
      authDomain: "nixa-sisventas.firebaseapp.com",
      databaseURL: "https://nixa-sisventas-default-rtdb.firebaseio.com",
      projectId: "nixa-sisventas",
      storageBucket: "nixa-sisventas.firebasestorage.app",
      messagingSenderId: "171899432710",
      appId: "1:171899432710:web:47d7d4da42c07166983887"
    };

    const fbApp  = initializeApp(firebaseConfig);
    const fbDB   = getDatabase(fbApp);
    const fbAuth = getAuth(fbApp);
    const fbStorage = getStorage(fbApp);

    window.fbApp         = fbApp;
    window.fbDB          = fbDB;
    window.fbAuth        = fbAuth;
    window.fbRef         = ref;
    window.fbSet         = set;
    window.fbGet         = get;
    window.fbPush        = push;
    // Todas las suscripciones de datos quedan registradas. Al cerrar sesion
    // deben cancelarse en bloque: ocultar la pantalla no alcanza, porque un
    // listener activo conserva y puede volver a pintar datos del usuario.
    const fbValueListeners = new Set();
    window.fbOnValue = function(...args) {
      const load = window.SVDataReadiness?.begin(args[0]?.ref || args[0]);
      const callback = args[1];
      if (typeof callback === 'function') args[1] = function(snapshot) {
        try { const result = callback(snapshot); Promise.resolve(result).then(() => load?.ready(), () => load?.error()); return result; }
        catch (error) { load?.error(); throw error; }
      };
      const errorCallback = typeof args[2] === 'function' ? args[2] : null;
      const options = errorCallback ? args[3] : args[2];
      args[2] = function(error) { load?.error(); if(errorCallback)errorCallback(error); else console.error('[Datos] No se pudo cargar la suscripción', error); };
      if(options)args[3]=options;
      let unsubscribe;
      try { unsubscribe = onValue(...args); } catch(error) { load?.error(); throw error; }
      const trackedUnsubscribe = function() {
        try { unsubscribe(); }
        finally { load?.cancel(); fbValueListeners.delete(trackedUnsubscribe); }
      };
      fbValueListeners.add(trackedUnsubscribe);
      return trackedUnsubscribe;
    };
    window.fbStopAllValueListeners = function() {
      const listeners = Array.from(fbValueListeners);
      fbValueListeners.clear();
      listeners.forEach(function(unsubscribe) {
        try { unsubscribe(); } catch (error) {
          console.warn('[Auth] No se pudo cancelar una suscripcion', error);
        }
      });
    };
    window.fbUpdate      = update;
    window.fbRemove      = remove;
    window.fbOnDisconnect = onDisconnect;
    window.fbServerTimestamp = serverTimestamp;
    window.fbOrderByKey  = orderByKey;
    window.fbQuery       = query;
    window.fbOrderByChild = orderByChild;
    window.fbEqualTo = equalTo;
    window.fbStartAt     = startAt;
    window.fbEndAt       = endAt;
    window.fbRunTransaction = runTransaction;
    window.fbSignIn      = signInWithEmailAndPassword;
    window.fbSignOut     = signOut;
    window.fbOnAuth = function(auth, callback, errorCallback) {
      let authEpoch = 0;
      return onAuthStateChanged(auth, async function(user) {
        const epoch = ++authEpoch;
        try {
          const prepared = window.svPrepararRutasSeguridad ? await window.svPrepararRutasSeguridad(user) : undefined;
          if (epoch !== authEpoch) return;
          // No entregar a la UI una preparación que ya pertenece a otra sesión.
          if (prepared && window.svPreparacionSeguridadVigente && !window.svPreparacionSeguridadVigente(prepared, user)) return;
          callback(user, prepared);
        } catch (error) {
          if (epoch !== authEpoch) return;
          console.warn('[Auth] No se pudo verificar la ubicación de acceso', error);
          if (errorCallback) errorCallback(error);
          else if (window.notify) window.notify('No se pudo verificar el acceso. Revisá la conexión y recargá.');
        }
      }, errorCallback);
    };
    window.fbCreateUser  = createUserWithEmailAndPassword;
    // Mantener la sesión administrativa al dar de alta otra identidad.
    const secondaryAuth = getAuth(initializeApp(firebaseConfig, 'user-administration'));
    window.fbCreateUserManaged = async function(email,password) {
      try { return await createUserWithEmailAndPassword(secondaryAuth,email,password); }
      finally { await signOut(secondaryAuth); }
    };
    window.fbResetPass   = sendPasswordResetEmail;
    window.fbUpdatePass  = updatePassword;
    window.fbStorage     = fbStorage;
    window.fbStorageRef  = storageRef;
    window.fbUploadBytes = uploadBytes;
    window.fbUploadBytesResumable = uploadBytesResumable;
    window.fbGetDownloadURL = getDownloadURL;
    window.fbDeleteObject = deleteObject;

    window.firebaseReady = true;
    document.dispatchEvent(new Event('firebase-ready'));
