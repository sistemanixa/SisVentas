    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
    import { getDatabase, goOffline, goOnline, ref, set, get, push, onValue, update, remove, onDisconnect, serverTimestamp, query, orderByChild, orderByKey, equalTo, startAt, endAt, limitToFirst, runTransaction }
      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
    import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
             createUserWithEmailAndPassword, updatePassword, sendPasswordResetEmail,
             signInWithEmailAndPassword as reSignIn, EmailAuthProvider, reauthenticateWithCredential }
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

    function svTrackedDatabaseWrite(action, pushNeedsValue) {
      return function(...args) {
        if (pushNeedsValue && (args.length < 2 || args[1] === undefined)) return action(...args);
        const release = window.SVForegroundSession?.holdDatabase?.();
        try {
          const result = action(...args);
          // Conservar el Promise/ThenableReference original del SDK. Ocultar la
          // pantalla no interrumpe una escritura que el usuario ya inició.
          Promise.resolve(result).then(()=>release?.(),()=>release?.());
          return result;
        } catch(error) { release?.(); throw error; }
      };
    }
    window.fbApp         = fbApp;
    window.fbDB          = fbDB;
    window.fbGoOffline   = goOffline;
    window.fbGoOnline    = goOnline;
    window.SVForegroundSession?.syncDatabase?.();
    window.fbAuth        = fbAuth;
    window.fbRef         = ref;
    window.fbSet         = svTrackedDatabaseWrite(set);
    window.fbGet         = get;
    window.fbPush        = svTrackedDatabaseWrite(push, true);
    // Todas las suscripciones de datos quedan registradas. Al cerrar sesion
    // deben cancelarse en bloque: ocultar la pantalla no alcanza, porque un
    // listener activo conserva y puede volver a pintar datos del usuario.
    const fbValueListeners = new Set();
    window.fbOnValue = function(...args) {
      let active = true;
      const load = window.SVDataReadiness?.begin(args[0]?.ref || args[0]);
      let unsubscribe;
      const trackedUnsubscribe = function() {
        if (!active) return;
        active = false;
        try { unsubscribe?.(); }
        finally { load?.cancel(); fbValueListeners.delete(trackedUnsubscribe); }
      };
      const errorCallback = typeof args[2] === 'function' ? args[2] : null;
      const options = errorCallback ? args[3] : args[2];
      let deliveredOnce = false;
      const callback = args[1];
      if (typeof callback === 'function') args[1] = function(snapshot) {
        if (!active || (options?.onlyOnce && deliveredOnce)) return;
        deliveredOnce = true;
        const finish = state => { if (!active) return; load?.[state](); if (options?.onlyOnce) trackedUnsubscribe(); };
        try { const result = callback(snapshot); Promise.resolve(result).then(() => finish('ready'), () => finish('error')); return result; }
        catch (error) { finish('error'); throw error; }
      };
      args[2] = function(error) {
        if(!active)return;
        load?.error();
        // SDK cancellation is terminal. Remove its readiness source before a
        // user retries, retaining the error until a fresh source is started.
        try { trackedUnsubscribe(); } catch(cleanup) { console.warn('[Datos] No se pudo liberar la suscripción cancelada',cleanup); }
        if(errorCallback)errorCallback(error); else console.error('[Datos] No se pudo cargar la suscripción', error);
      };
      if(options)args[3]=options;
      try { unsubscribe = onValue(...args); } catch(error) { load?.error(); trackedUnsubscribe(); try { if(errorCallback)errorCallback(error); } finally { throw error; } }
      if(active)fbValueListeners.add(trackedUnsubscribe);
      else unsubscribe?.();
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
    window.fbUpdate      = svTrackedDatabaseWrite(update);
    window.fbRemove      = svTrackedDatabaseWrite(remove);
    window.fbOnDisconnect = onDisconnect;
    window.fbServerTimestamp = serverTimestamp;
    window.fbOrderByKey  = orderByKey;
    window.fbQuery       = query;
    window.fbOrderByChild = orderByChild;
    window.fbEqualTo = equalTo;
    window.fbLimitToFirst = limitToFirst;
    window.fbStartAt     = startAt;
    window.fbEndAt       = endAt;
    window.fbRunTransaction = svTrackedDatabaseWrite(runTransaction);
    window.fbSignIn      = signInWithEmailAndPassword;
    window.fbSignOut     = signOut;
    // El SDK responde antes de terminar la verificación protegida del perfil.
    // La pantalla no debe confundir esa espera con ausencia de respuesta Auth.
    let authStateReceived = false;
    window.fbAuthStateReceived = function(){ return authStateReceived; };
    window.fbOnAuth = function(auth, callback, errorCallback) {
      // El plazo pertenece a una preparación visible. Al ocultarse se cancela
      // esa preparación, incluido su GET, y se verifica de nuevo al regresar.
      window.svVerificarAccesoVisible ||= async function(user, {signal, prepared} = {}) {
        const cancelled = () => Object.assign(Error('La preparación fue cancelada'), {name:'AbortError'});
        const visible = () => window.SVForegroundSession ? window.SVForegroundSession.isVisible() : document.hidden !== true;
        const check = () => { if(signal?.aborted || window.fbAuth?.currentUser !== user) throw cancelled(); };
        const waitVisible = () => {
          if(window.SVForegroundSession) return window.SVForegroundSession.waitVisible({signal});
          if(visible()) return Promise.resolve();
          return new Promise((resolve,reject)=>{
            const clear=()=>{document.removeEventListener('visibilitychange',changed);signal?.removeEventListener('abort',abort);};
            const changed=()=>{if(visible()){clear();resolve();}},abort=()=>{clear();reject(cancelled());};
            document.addEventListener('visibilitychange',changed);signal?.addEventListener('abort',abort,{once:true});
            if(signal?.aborted)abort();else changed();
          });
        };
        const abortable = (task, currentSignal) => {
          if(currentSignal.aborted) return Promise.reject(cancelled());
          let abort;
          const stopped = new Promise((_,reject) => { abort=()=>reject(cancelled());currentSignal.addEventListener('abort',abort,{once:true}); });
          return Promise.race([Promise.resolve(task),stopped]).finally(()=>currentSignal.removeEventListener('abort',abort));
        };
        for(;;) {
          check();
          if(!visible()) prepared=undefined;
          await waitVisible();
          check();
          try { if(window.SVUserAccess && await window.SVUserAccess.gate(user)) return {blocked:true}; }
          catch(error) { check();if(!visible()){prepared=undefined;continue;}throw error; }
          check();
          if(!visible()){prepared=undefined;continue;}
          if(prepared && (!window.svPreparacionSeguridadVigente || window.svPreparacionSeguridadVigente(prepared,user))) return {prepared};
          const controller=new AbortController();let paused=false,ended=false;
          const pause=()=>{if(!visible()){paused=true;controller.abort();}};
          const end=()=>{ended=true;controller.abort();};
          const abort=()=>controller.abort();
          document.addEventListener('visibilitychange',pause);
          document.addEventListener('sisventas:foreground-paused',pause);
          document.addEventListener('sisventas:session-ended',end);
          signal?.addEventListener('abort',abort,{once:true});
          try {
            check();pause();
            if(controller.signal.aborted) throw cancelled();
            const task=abortable(window.svPrepararRutasSeguridad?.(user,{signal:controller.signal}),controller.signal);
            prepared=window.SVSessionRecovery?.deadline ? await window.SVSessionRecovery.deadline(task) : await task;
            check();
            if(!visible()){prepared=undefined;continue;}
            if(prepared && window.svPreparacionSeguridadVigente && !window.svPreparacionSeguridadVigente(prepared,user)) throw cancelled();
            return {prepared};
          } catch(error) {
            controller.abort();prepared=undefined;check();
            if(ended) throw cancelled();
            if(paused) continue;
            throw error;
          } finally {
            document.removeEventListener('visibilitychange',pause);
            document.removeEventListener('sisventas:foreground-paused',pause);
            document.removeEventListener('sisventas:session-ended',end);
            signal?.removeEventListener('abort',abort);
          }
        }
      };
      let authEpoch = 0;
      let waitingController = null;
      const unsubscribe = onAuthStateChanged(auth, async function(user) {
        authStateReceived = true;
        const epoch = ++authEpoch;
        waitingController?.abort();
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        waitingController = controller;
        try {
          // Android puede restaurar el documento aun con la pantalla bloqueada.
          // No iniciar perfil, permisos o datos hasta volver a primer plano.
          const result=user ? await window.svVerificarAccesoVisible(user,{signal:controller?.signal}) : {prepared:await window.svPrepararRutasSeguridad?.(null)};
          if (epoch !== authEpoch || result.blocked) return;
          const prepared=result.prepared;
          callback(user, prepared);
        } catch (error) {
          if (epoch !== authEpoch || controller?.signal.aborted || error?.name === 'AbortError') return;
          console.warn('[Auth] No se pudo verificar la ubicación de acceso', error);
          if (errorCallback) errorCallback(error);
          else if (window._svOfrecerRecuperacionCarga?.(error,user)) return;
          else if (window._cancelarAutenticacionParcial && user) window._cancelarAutenticacionParcial(error.message || 'No se pudo verificar el acceso.');
          else if (window.notify) window.notify('No se pudo verificar el acceso. Revisá la conexión y recargá.');
        }
      }, errorCallback);
      return function(){authEpoch++;waitingController?.abort();unsubscribe?.();};
    };
    window.fbCreateUser  = createUserWithEmailAndPassword;
    // Mantener la sesión administrativa al dar de alta otra identidad.
    const secondaryAuth = getAuth(initializeApp(firebaseConfig, 'user-administration'));
    window.fbCreateUserManaged = async function(email,password) {
      try { return await createUserWithEmailAndPassword(secondaryAuth,email,password); }
      finally { await signOut(secondaryAuth); }
    };
    window.fbReauthenticate = function(user,password) { return reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password)); };
    window.fbResetPass   = sendPasswordResetEmail;
    window.fbUpdatePass  = updatePassword;
    window.fbStorage     = fbStorage;
    window.fbStorageRef  = storageRef;
    window.fbUploadBytes = uploadBytes;
    window.fbUploadBytesResumable = uploadBytesResumable;
    window.fbGetDownloadURL = getDownloadURL;
    window.fbDeleteObject = deleteObject;

    if(!window.SVLaborWrites) throw Error('No se pudo preparar el guardado seguro');
    window.SVLaborWrites.install({sdk:{set:window.fbSet,update:window.fbUpdate,push:window.fbPush,remove:window.fbRemove,runTransaction:window.fbRunTransaction,get,ref}});
    window.firebaseReady = true;
    document.dispatchEvent(new Event('firebase-ready'));
