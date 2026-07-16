    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
    import { getDatabase, ref, set, get, push, onValue, update, remove, onDisconnect, serverTimestamp, query, orderByChild, startAt, endAt, runTransaction }
      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
    import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
             createUserWithEmailAndPassword, updatePassword, sendPasswordResetEmail,
             signInWithEmailAndPassword as reSignIn }
      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
    import { getStorage, ref as storageRef, uploadBytes, getDownloadURL }
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

    window.fbDB          = fbDB;
    window.fbAuth        = fbAuth;
    window.fbRef         = ref;
    window.fbSet         = set;
    window.fbGet         = get;
    window.fbPush        = push;
    window.fbOnValue     = onValue;
    window.fbUpdate      = update;
    window.fbRemove      = remove;
    window.fbOnDisconnect = onDisconnect;
    window.fbRemove     = remove;
    window.fbServerTimestamp = serverTimestamp;
    window.fbQuery       = query;
    window.fbOrderByChild = orderByChild;
    window.fbStartAt     = startAt;
    window.fbEndAt       = endAt;
    window.fbRunTransaction = runTransaction;
    window.fbSignIn      = signInWithEmailAndPassword;
    window.fbSignOut     = signOut;
    window.fbOnAuth      = onAuthStateChanged;
    window.fbCreateUser  = createUserWithEmailAndPassword;
    window.fbResetPass   = sendPasswordResetEmail;
    window.fbUpdatePass  = updatePassword;
    window.fbStorage     = fbStorage;
    window.fbStorageRef  = storageRef;
    window.fbUploadBytes = uploadBytes;
    window.fbGetDownloadURL = getDownloadURL;

    window.firebaseReady = true;
    document.dispatchEvent(new Event('firebase-ready'));
