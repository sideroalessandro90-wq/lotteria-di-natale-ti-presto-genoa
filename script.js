// Firebase configuration - Configurazione produzione
const firebaseConfig = {
  apiKey: "AIzaSyCkfRCcKPXLG4i2Iu6DVZQj5Gz_XciSpiY",
  authDomain: "abbonamentigenoa.firebaseapp.com",
  projectId: "abbonamentigenoa",
  storageBucket: "abbonamentigenoa.firebasestorage.app",
  messagingSenderId: "62498001959",
  appId: "1:62498001959:web:ae674e418db3190dac2a02",
  measurementId: "G-E6S3XV4K3D"
};

// Initialize Firebase
let db, auth;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  
  // 🔥 GESTIONE STATO AUTENTICAZIONE
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Utente autenticato:', user.email);
      // Carica profilo utente da Firestore se non già caricato
      if (!loggedInUser) {
        db.collection('users').doc(user.uid).get().then((doc) => {
          if (doc.exists) {
            loggedInUser = doc.data();
            SafeStorage.set('loggedInUser', loggedInUser);
            updateUIAfterLogin();
            
            // 🔄 Avvia sincronizzazione Firebase dopo autenticazione
            setTimeout(() => {
              syncFirebaseData().catch((err) => 
                console.log('⚠️ Sincronizzazione differita fallita:', err.message)
              );
            }, 1000); // Aspetta 1 sec per stabilizzare auth
          }
        });
      }
    } else {
      console.log('❌ Nessun utente autenticato');
      if (loggedInUser) {
        loggedInUser = null;
        SafeStorage.remove('loggedInUser');
        updateUIAfterLogout();
      }
    }
  });
  
  // Initialize Analytics - DISABILITATO per evitare errori API Key
  // if (typeof firebase.analytics !== 'undefined') {
  //   const analytics = firebase.analytics();
  // }
  
  console.log('✅ Firebase inizializzato correttamente');
} catch (error) {
  // Silenzioso - evita spam console
  console.log('📱 Applicazione in modalità offline');
  
  // Definisci fallback vuoti per evitare errori
  db = { 
    collection: () => ({ 
      add: () => Promise.resolve({ id: 'fallback' }),
      get: () => Promise.resolve({ docs: [] }),
      doc: () => ({ set: () => Promise.resolve(), get: () => Promise.resolve({ exists: false }) }),
      onSnapshot: () => () => {}
    })
  };
  auth = {
    createUserWithEmailAndPassword: () => Promise.reject(new Error('Modalità offline attiva')),
    signInWithEmailAndPassword: () => Promise.reject(new Error('Modalità offline attiva')),
    signOut: () => Promise.reject(new Error('Modalità offline attiva')),
    onAuthStateChanged: () => () => {}
  };
}

// ===============================
// TOAST NOTIFICATIONS WRAPPER
// ===============================

// Funzione wrapper per compatibilità con toast.js
function showToast(message, type = 'info', duration = 3000) {
  if (typeof window.toast !== 'undefined' && window.toast.show) {
    window.toast.show(type, message, duration);
  } else {
    // Fallback se toast.js non è caricato
    console.log(`[TOAST ${type.toUpperCase()}]: ${message}`);
    alert(message); // Fallback semplice
  }
}

// ===============================
// LOCALSTORAGE SAFE WRAPPER
// ===============================

// Wrapper sicuro per localStorage che gestisce tracking prevention
const SafeStorage = {
  // Memory fallback quando localStorage è bloccato
  memoryStorage: {},
  storageBlocked: false,
  warningShown: false,
  initialized: false,
  
  // 🚀 INIZIALIZZAZIONE UNA VOLTA SOLA
  _init() {
    if (this.initialized) return;
    this.initialized = true;
    
    // Test SINGOLO all'avvio per determinare disponibilità
    try {
      const testKey = '__init_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      this.storageBlocked = false;
    } catch (error) {
      this.storageBlocked = true;
      // Warning UNICO per tutta la sessione
      setTimeout(() => {
        showToast('🔒 Modalità privacy rilevata - dati temporanei in memoria', 'info', 4000);
      }, 1000);
    }
  },
  
  get: function(key, defaultValue = null) {
    // Inizializzazione lazy
    if (!this.initialized) this._init();
    
    // 🚀 ZERO TEST - usa flag iniziale
    if (this.storageBlocked) {
      const memValue = this.memoryStorage[key];
      return memValue !== undefined ? memValue : defaultValue;
    }
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      // Primo errore = attiva modalità memoria permanentemente
      this.storageBlocked = true;
      const memValue = this.memoryStorage[key];
      return memValue !== undefined ? memValue : defaultValue;
    }
  },
  
  set: function(key, value) {
    // Inizializzazione lazy
    if (!this.initialized) this._init();
    
    // 💾 SEMPRE salva in memoria come backup
    this.memoryStorage[key] = value;
    
    // 🚀 Se bloccato, EVITA localStorage completamente
    if (this.storageBlocked) {
      return true;
    }
    
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      // Primo errore = blocco permanente per sessione
      this.storageBlocked = true;
      return true;
    }
  },
  
  // 🔧 Alias per compatibilità con codice esistente
  setItem: function(key, value) {
    return this.set(key, value);
  },
  
  remove: function(key) {
    // 🗑️ Rimuovi da memoria sempre
    delete this.memoryStorage[key];
    
    // 🔧 Prova localStorage solo se disponibile
    if (!this.storageBlocked) {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        this.storageBlocked = true;
      }
    }
  },
  
  clear: function() {
    this.memoryStorage = {};
    if (!this.storageBlocked) {
      try {
        localStorage.clear();
      } catch (error) {
        this.storageBlocked = true;
      }
    }
  },
  
  // 🔧 Funzioni diagnostiche
  getStatus: function() {
    return {
      blocked: this.storageBlocked,
      memoryKeys: Object.keys(this.memoryStorage).length,
      memorySize: JSON.stringify(this.memoryStorage).length + ' bytes',
      mode: this.storageBlocked ? 'MEMORIA' : 'LOCALSTORAGE'
    };
  },
  
  // 🛠️ Reset completo (per debug)
  hardReset: function() {
    this.storageBlocked = false;
    this.initialized = false;
    this.warningShown = false;
    this.memoryStorage = {};
    this._init();
    return this.getStatus();
  },
  
  getItem: function(key) {
    return this.get(key, null);
  },
  
  remove: function(key) {
    try {
      if (this.storageBlocked) {
        delete this.memoryStorage[key];
        return true;
      }
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      delete this.memoryStorage[key];
      return true;
    }
  },
  
  // Funzione eliminata - causava spam Tracking Prevention
  isAvailable: function() {
    // Sempre disponibile in modalità memoria
    return true;
  },
  
  // Funzioni di utilità per gli array principali
  saveAbbonamenti: function(abbonamenti) {
    return this.set('abbonamenti', abbonamenti);
  },
  
  saveUsers: function(users) {
    return this.set('users', users);
  },
  
  saveLoggedInUser: function(user) {
    return this.set('loggedInUser', user);
  },
  
  // 🔍 Diagnostica Tracking Prevention per debug
  getStatus: function() {
    return {
      storageBlocked: this.storageBlocked,
      memoryKeys: Object.keys(this.memoryStorage).length,
      warningShown: this.warningShown,
      lastCheck: this.lastBlockedCheck ? new Date(this.lastBlockedCheck).toLocaleTimeString() : 'mai',
      memorySize: JSON.stringify(this.memoryStorage).length + ' bytes'
    };
  },
  
  // 🔄 Forza ri-test localStorage (utile per debug)
  retestStorage: function() {
    this.lastBlockedCheck = 0;
    const wasBlocked = this.storageBlocked;
    this.storageBlocked = false;
    const isBlocked = this._isStorageBlocked();
    
    console.log('🔍 Retest localStorage:', 
      isBlocked ? '🔒 BLOCCATO' : '✅ DISPONIBILE',
      wasBlocked !== isBlocked ? '(CAMBIO DI STATO)' : '(stesso stato)'
    );
    return !isBlocked;
  }
};

// ===================================
// 🔔 SISTEMA NOTIFICHE BROWSER NATIVE
// ===================================

// Stato permessi notifiche
let notificationPermission = 'default';

// Richiedi permessi notifiche
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Browser non supporta notifiche');
    return false;
  }

  if (Notification.permission === 'granted') {
    notificationPermission = 'granted';
    return true;
  }

  if (Notification.permission === 'denied') {
    notificationPermission = 'denied';
    return false;
  }

  // Richiedi permesso con UX friendly
  const permission = await Notification.requestPermission();
  notificationPermission = permission;
  
  if (permission === 'granted') {
    showToast('✅ Notifiche attivate! Ti avviseremo per nuovi messaggi', 'success');
    return true;
  } else {
    showToast('ℹ️ Notifiche disattivate. Puoi attivarle dalle impostazioni browser', 'info');
    return false;
  }
}

// Invia notifica browser
function sendBrowserNotification(title, body, icon = 'img/genoa.png', onclick = null) {
  // Check se utente ha permesso e preferenze attive
  if (!loggedInUser) return;
  
  const preferences = SafeStorage.get('userPreferences', {});
  const userPrefs = preferences[loggedInUser.username] || {};
  
  if (userPrefs.pushNotifications === false) {
    console.log('Notifiche disabilitate dall\'utente');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.log('Permessi notifiche non concessi');
    return;
  }

  // Check se finestra è attiva (no spam se utente sta già usando l'app)
  if (document.hasFocus()) {
    console.log('Utente attivo, skip notifica');
    return;
  }

  try {
    const notification = new Notification(title, {
      body: body,
      icon: icon,
      badge: 'img/genoa.png',
      tag: 'ti-presto-' + Date.now(), // Evita duplicati
      requireInteraction: false,
      silent: false
    });

    // Auto-close dopo 6 secondi
    setTimeout(() => {
      if (notification) notification.close();
    }, 6000);

    // Click handler
    if (onclick) {
      notification.onclick = function() {
        window.focus(); // Porta focus all'app
        onclick();
        notification.close();
      };
    } else {
      notification.onclick = function() {
        window.focus();
        notification.close();
      };
    }

  } catch (error) {
    console.log('Errore invio notifica:', error);
  }
}

// Helper: Controlla se notifiche sono attive per utente
function areNotificationsEnabled() {
  if (!loggedInUser) return false;
  
  const preferences = SafeStorage.get('userPreferences', {});
  const userPrefs = preferences[loggedInUser.username] || {};
  
  return Notification.permission === 'granted' && userPrefs.pushNotifications !== false;
}

// 🎯 Notifica altri utenti per nuovo abbonamento interessante
function notifyUsersAboutNewSubscription(nuovoAbbonamento) {
  if (!areNotificationsEnabled()) return;
  if (!nuovoAbbonamento || !nuovoAbbonamento.matchDesc) return;
  
  // Solo per utenti diversi dal publisher
  if (nuovoAbbonamento.utente === loggedInUser.username) return;
  
  // Notifica solo se è una partita "importante" (Serie A o derby)
  const matchName = nuovoAbbonamento.matchDesc.toLowerCase();
  const isImportantMatch = 
    matchName.includes('juventus') || 
    matchName.includes('milan') || 
    matchName.includes('inter') || 
    matchName.includes('napoli') || 
    matchName.includes('sampdoria') || 
    matchName.includes('lazio') || 
    matchName.includes('roma');
  
  if (isImportantMatch) {
    sendBrowserNotification(
      '🎫 Nuovo abbonamento disponibile!',
      `${nuovoAbbonamento.matchDesc} - Settore ${nuovoAbbonamento.settore}`,
      'img/genoa.png',
      () => {
        showSection('home');
        // Scroll alla card dell'abbonamento
        setTimeout(() => {
          const abbCard = document.querySelector(`[data-abbonamento-id="${nuovoAbbonamento.id}"]`);
          if (abbCard) {
            abbCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            abbCard.style.animation = 'pulse 2s ease-in-out';
          }
        }, 500);
      }
    );
  }
}

// ===================================
// FINE SISTEMA NOTIFICHE
// ===================================

// ===============================
// BROWSER COMPATIBILITY CHECK
// ===============================

// Controlla compatibilità browser e mostra avvisi se necessario
function checkBrowserCompatibility() {
  // Controllo localStorage
  if (!SafeStorage.isAvailable()) {
    console.warn('⚠️ LocalStorage bloccato dal browser (Tracking Prevention)');
    
    // Mostra avviso dopo il caricamento della pagina
    setTimeout(() => {
      showToast('⚠️ Il browser sta bloccando il salvataggio dati. Per un\'esperienza ottimale, disabilita il Tracking Prevention per questo sito.', 'warning', 8000);
    }, 3000);
    
    // Suggerimenti specifici per browser
    const userAgent = navigator.userAgent;
    let browserTip = '';
    
    if (userAgent.includes('Edge')) {
      browserTip = 'Edge: Impostazioni > Privacy > Prevenzione tracciamento > Eccezioni';
    } else if (userAgent.includes('Firefox')) {
      browserTip = 'Firefox: Scudo privacy > Impostazioni protezione avanzata';
    } else if (userAgent.includes('Safari')) {
      browserTip = 'Safari: Preferenze > Privacy > Impedisci il tracking tra siti';
    }
    
    if (browserTip) {
      setTimeout(() => {
        console.log(`💡 Suggerimento: ${browserTip}`);
      }, 5000);
    }
  }
  
  // Controllo Firebase
  if (typeof firebase === 'undefined') {
    console.warn('⚠️ Firebase CDN non caricato - funzionalità limitate');
  }
}

// ===============================
// EMAIL NOTIFICATIONS SERVICE
// ===============================

// EmailJS Configuration - Configurazione produzione
const EMAIL_CONFIG = {
  SERVICE_ID: 'gmail_service',               // Service ID reale da EmailJS
  USER_ID: 'fYg52dUw2C1J8jo5X',             // Public Key EmailJS reale  
  // Template IDs (devono corrispondere a quelli creati su EmailJS)
  TEMPLATES: {
    NEW_MESSAGE: 'template_new_message',    // Template messaggio chat
    WELCOME: 'template_welcome',            // Template benvenuto
    BOOKING_CREATED: 'template_booking',    // Template abbonamento
    DEAL_COMPLETED: 'template_deal'         // Template trattativa chiusa
  }
};

// Inizializza EmailJS
(function() {
  if (typeof emailjs !== 'undefined') {
    try {
      emailjs.init(EMAIL_CONFIG.USER_ID);
      console.log('✅ EmailJS inizializzato');
    } catch (error) {
      console.warn('⚠️ Errore inizializzazione EmailJS:', error.message);
    }
  } else {
    console.warn('⚠️ EmailJS CDN non caricato');
  }
})();

// Email Service Functions
const EmailService = {
  // Invia email per nuovo messaggio chat
  async sendNewMessageNotification(toUser, fromUser, message, matchName) {
    
    
    if (!toUser.email) {
      console.log('📧 Email destinatario non disponibile');
      return;
    }

    try {
      const templateParams = {
        to_name: toUser.nome || toUser.username,
        to_email: toUser.email,
        from_name: fromUser.nome || fromUser.username,
        message: message,
        match_name: matchName,
        site_url: window.location.origin,
        reply_url: `${window.location.origin}#chat`
      };

      const response = await emailjs.send(
        EMAIL_CONFIG.SERVICE_ID,
        EMAIL_CONFIG.TEMPLATES.NEW_MESSAGE,
        templateParams
      );

      console.log('📧 Email inviata:', response);
      return response;
    } catch (error) {
      console.warn('⚠️ Email non inviata (sviluppo):', error.message);
      return null;
    }
  },

  // Email di benvenuto per nuovi utenti
  async sendWelcomeEmail(user) {
    
    
    if (!user.email) return;

    try {
      const templateParams = {
        to_name: user.nome || user.username,
        to_email: user.email,
        username: user.username,
        site_url: window.location.origin,
        contact_email: 'dnagenoa@outlook.it'
      };

      const response = await emailjs.send(
        EMAIL_CONFIG.SERVICE_ID,
        EMAIL_CONFIG.TEMPLATES.WELCOME,
        templateParams
      );

      console.log('📧 Email benvenuto inviata:', response);
      return response;
    } catch (error) {
      console.warn('⚠️ Email benvenuto non inviata (sviluppo):', error.message);
      return null;
    }
  },

  // Notifica nuovo abbonamento disponibile
  async sendBookingCreatedNotification(booking) {
    
    
    try {
      // Invia al proprietario del sito per log
      const templateParams = {
        to_email: 'dnagenoa@outlook.it',
        user_name: booking.utente,
        match_desc: booking.matchDesc,
        settore: booking.settore,
        prezzo: booking.prezzo,
        timestamp: new Date().toLocaleString('it-IT'),
        site_url: window.location.origin
      };

      const response = await emailjs.send(
        EMAIL_CONFIG.SERVICE_ID,
        EMAIL_CONFIG.TEMPLATES.BOOKING_CREATED,
        templateParams
      );

      console.log('Notifica booking inviata:', response);
      return response;
    } catch (error) {
      console.error('Errore notifica booking:', error);
    }
  },

  // Test invio email
  async testEmail() {
    try {
      const response = await emailjs.send(
        EMAIL_CONFIG.SERVICE_ID,
        EMAIL_CONFIG.TEMPLATES.NEW_MESSAGE,
        {
          to_name: 'Test User',
          to_email: 'dnagenoa@outlook.it',
          from_name: 'Sistema Ti Presto',
          message: 'Questo è un test delle email notifications',
          match_name: 'Genoa - Test',
          site_url: window.location.origin
        }
      );
      
      showToast('📧 Email di test inviata con successo!', 'success');
      return response;
    } catch (error) {
      showToast('❌ Errore invio email di test', 'error');
      console.error('Test email fallito:', error);
    }
  }
};

// Firebase Helper Functions
const FirebaseService = {
  // Users
  async createUser(userData) {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(userData.email, userData.password);
      const user = userCredential.user;
      
      // Salva dati aggiuntivi in Firestore
      await db.collection('users').doc(user.uid).set({
        username: userData.username,
        nome: userData.nome,
        cognome: userData.cognome,
        email: userData.email,
        telefono: userData.telefono,
        dataNascita: userData.dataNascita,
        registrationDate: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      return user;
    } catch (error) {
      console.error('Errore creazione utente:', error);
      throw error;
    }
  },

  async loginUser(email, password) {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      return userCredential.user;
    } catch (error) {
      console.error('Errore login:', error);
      throw error;
    }
  },

  async getUserData(uid) {
    try {
      const doc = await db.collection('users').doc(uid).get();
      return doc.exists ? doc.data() : null;
    } catch (error) {
      console.error('Errore recupero dati utente:', error);
      throw error;
    }
  },

  // Abbonamenti
  async createAbbonamento(abbonamentoData) {
    try {
      const docRef = await db.collection('subscriptions').add({
        ...abbonamentoData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        disponibile: true
      });
      return docRef.id;
    } catch (error) {
      console.error('Errore creazione abbonamento:', error);
      throw error;
    }
  },

  async getAbbonamenti() {
    try {
      const snapshot = await db.collection('abbonamenti')
        .get();
      
      // Filtra disponibili lato client
      const disponibili = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(abbon => abbon.disponibile === true);
      
      return disponibili;
    } catch (error) {
      console.error('Errore recupero abbonamenti:', error);
      throw error;
    }
  },

  // Real-time listener per abbonamenti
  onAbbonamentoUpdates(callback) {
    return db.collection('abbonamenti')
      .onSnapshot(callback);
  }
};

// Variabili globali
let loggedInUser = SafeStorage.get('loggedInUser');
let users = SafeStorage.get('users', []);
let abbonamenti = SafeStorage.get('abbonamenti', []);

// 🔧 DEBOUNCE SISTEMA - Prevenzione chiamate multiple
let homeLoadingDebounce = null;
let isHomeLoading = false;
let lastHomeRender = 0;
const HOME_CACHE_DURATION = 2000; // Cache per 2 secondi

// Controllo disponibilità storage e avviso utente se bloccato
if (!SafeStorage.isAvailable()) {
  console.warn('⚠️ LocalStorage non disponibile - probabilmente bloccato dal browser');
  setTimeout(() => {
    showToast('⚠️ Attenzione: il browser sta bloccando il salvataggio dati. Controlla le impostazioni privacy.', 'warning');
  }, 2000);
}

// 🕐 Funzione cleanup trattative scadute (5h)
function cleanupExpiredTrattative() {
  const now = Date.now();
  let cleanupCount = 0;
  
  abbonamenti.forEach(abbon => {
    if (abbon.inTrattativa && abbon.trattativaExpiresAt && now > abbon.trattativaExpiresAt) {
      // Trattativa scaduta - reset a disponibile
      abbon.inTrattativa = false;
      abbon.buyerName = null;
      abbon.trattativaStartTime = null;
      abbon.trattativaExpiresAt = null;
      abbon.disponibile = true;
      cleanupCount++;
      
      console.log(`🕐 Trattativa scaduta per abbonamento ${abbon.id}`);
    }
  });
  
  if (cleanupCount > 0) {
    SafeStorage.set('abbonamenti', abbonamenti);
    console.log(`✅ ${cleanupCount} trattative scadute ripulite automaticamente`);
    
    // Aggiorna UI se necessario
    if (typeof loadHomeListings === 'function') {
      loadHomeListings();
    }
  }
}

// Avvia cleanup al caricamento e ogni 30 minuti
cleanupExpiredTrattative();
setInterval(cleanupExpiredTrattative, 30 * 60 * 1000); // Ogni 30 minuti

// 🔥 Funzione per sincronizzare Firebase con localStorage
async function syncFirebaseData() {
  try {
    console.log('🔄 Sincronizzazione dati Firebase...');
    
    // Verifica se Firebase è disponibile
    if (!db || typeof db.collection !== 'function') {
      console.log('⚠️ Firebase non disponibile - usando solo localStorage');
      return;
    }
    
    // 🔐 Verifica autenticazione prima di accedere ai dati
    if (!auth.currentUser) {
      console.log('⏳ Utente non ancora autenticato - skip sincronizzazione');
      return;
    }
    
    // Sincronizza abbonamenti
    const abbonSnapshot = await db.collection('abbonamenti').get();
    const firebaseAbbonamenti = [];
    abbonSnapshot.forEach((doc) => {
      firebaseAbbonamenti.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // 🔥 SINCRONIZZAZIONE COMPLETA (sostituisce localStorage)
    if (firebaseAbbonamenti.length === 0) {
      // Se Firebase è vuoto, pulisci anche localStorage
      console.log('🗑️ Firebase vuoto - pulendo localStorage');
      abbonamenti.splice(0); // Svuota array
    } else {
      // Sostituisci completamente con dati Firebase
      console.log('🔄 Sostituzione completa con dati Firebase');
      abbonamenti.splice(0, abbonamenti.length, ...firebaseAbbonamenti);
    }

    SafeStorage.set('abbonamenti', abbonamenti);
    console.log(`✅ Sincronizzati ${firebaseAbbonamenti.length} abbonamenti da Firebase`);
    console.log('✅ Firebase caricato in background');
    
    // 🔥 REAL-TIME LISTENER: Aggiornamenti automatici da altri dispositivi
    db.collection('abbonamenti').onSnapshot((snapshot) => {
      let hasChanges = false;
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const newAbbonamento = { id: change.doc.id, ...change.doc.data() };
          // Verifica se non è già presente (controlla sia ID che duplicati funzionali)
          const isDuplicate = abbonamenti.find(a => 
            a.id === newAbbonamento.id || 
            (a.utente === newAbbonamento.utente && 
             a.matchId === newAbbonamento.matchId && 
             a.settore === newAbbonamento.settore &&
             a.isLocalOnly) // Se esiste già un item locale dello stesso utente/partita/settore
          );
          
          if (!isDuplicate) {
            abbonamenti.push(newAbbonamento);
            hasChanges = true;
            console.log('🔥 Nuovo abbonamento real-time:', newAbbonamento.id);
          } else {
            console.log('⚠️ Duplicato evitato:', newAbbonamento.id, 'vs locale:', isDuplicate.id);
            // Se il duplicato era locale, sostituiscilo con quello Firebase
            if (isDuplicate.isLocalOnly) {
              const index = abbonamenti.findIndex(a => a.id === isDuplicate.id);
              if (index !== -1) {
                abbonamenti[index] = newAbbonamento; // Sostituisci locale con Firebase
                hasChanges = true;
                console.log('🔄 Sostituito locale con Firebase:', isDuplicate.id, '→', newAbbonamento.id);
              }
            }
          }
        }
        if (change.type === 'modified') {
          const updatedAbbonamento = { id: change.doc.id, ...change.doc.data() };
          const index = abbonamenti.findIndex(a => a.id === updatedAbbonamento.id);
          if (index !== -1) {
            abbonamenti[index] = updatedAbbonamento;
            hasChanges = true;
            console.log('🔄 Abbonamento aggiornato real-time:', updatedAbbonamento.id);
          }
        }
        if (change.type === 'removed') {
          const index = abbonamenti.findIndex(a => a.id === change.doc.id);
          if (index !== -1) {
            abbonamenti.splice(index, 1);
            hasChanges = true;
            console.log('🗑️ Abbonamento rimosso real-time:', change.doc.id);
          }
        }
      });
      
      if (hasChanges) {
        SafeStorage.set('abbonamenti', abbonamenti);
        // Aggiorna UI solo se nella homepage
        if (document.querySelector('.section.active')?.id === 'home') {
          console.log('🔄 Aggiornamento real-time homepage...');
          lastHomeRender = 0; // Reset cache
          loadHomeListings();
        }
        updateGlobalStats();
        updateProfileStats();
      }
    }, (error) => {
      console.log('⚠️ Errore real-time listener:', error.message);
    });
    
    // 🔄 RICARICA HOMEPAGE per mostrare dati aggiornati
    const currentSection = document.querySelector('.section.active')?.id;
    if (currentSection === 'home') {
      setTimeout(() => {
        lastHomeRender = 0; // Forza reload
        loadHomeListings();
        console.log('🏠 Homepage ricaricata con dati sincronizzati');
      }, 100);
    }
    
    // 🔔 Aggiorna badge trattative dopo sincronizzazione
    if (loggedInUser) {
      updateTrattativeNotifications();
    }
    
  } catch (error) {
    console.log('⚠️ Errore sincronizzazione Firebase:', error.message);
    console.log('📱 L\'applicazione continua a funzionare con localStorage');
    
    // 🔍 Debug dettagliato errore Firebase
    if (error.message.includes('Missing or insufficient permissions')) {
      console.log('');
      console.log('🚨 PROBLEMA FIREBASE PERMISSIONS:');
      console.log('👤 Utente autenticato:', firebase.auth().currentUser?.email || 'Nessuno');
      console.log('🔑 Auth UID:', firebase.auth().currentUser?.uid || 'N/A');
      console.log('🛡️ Firestore Security Rules sono troppo restrittive');
      console.log('');
      console.log('🔧 SOLUZIONE IMMEDIATA:');
      console.log('1. Vai su: https://console.firebase.google.com/project/tipresto-test/firestore/rules');
      console.log('2. Sostituisci le regole con:');
      console.log('   rules_version = \'2\';');
      console.log('   service cloud.firestore {');
      console.log('     match /databases/{database}/documents {');
      console.log('       match /{document=**} {');
      console.log('         allow read, write: if request.auth != null;');
      console.log('       }');
      console.log('     }');
      console.log('   }');
      console.log('3. Clicca "Pubblica" per applicare le regole');
      console.log('');
      console.log('🎯 Questo permetterà a tutti gli utenti autenticati di leggere/scrivere');
      console.log('');
    }
  }
}

// 🔥 Funzione per aggiornare un abbonamento su Firebase
async function updateAbbonamentoFirebase(abbonamento) {
  try {
    if (!db) {
      console.error('❌ Firebase non inizializzato!');
      throw new Error('Firebase non disponibile');
    }
    
    if (!auth.currentUser) {
      console.error('❌ Utente non autenticato per Firebase!');
      throw new Error('Utente non autenticato');
    }
    
    console.log('🔄 Aggiornamento Firebase per:', abbonamento.id);
    console.log('👤 Auth UID:', auth.currentUser.uid);
    console.log('📧 Auth Email:', auth.currentUser.email);
    console.log('🎫 Abbonamento utente:', abbonamento.utente);
    
    // 🔒 Aggiungi userId per security rules
    const firebaseData = {
      ...abbonamento,
      userId: auth.currentUser?.uid || abbonamento.userId,
      userEmail: auth.currentUser?.email || abbonamento.utente
    };
    
    await db.collection('subscriptions').doc(abbonamento.id).set(firebaseData, { merge: true });
    console.log('✅ Abbonamento aggiornato su Firebase:', abbonamento.id);
  } catch (error) {
    console.error('❌ Errore aggiornamento Firebase:', error);
    throw error;
  }
}

let currentChatAbbonamento = null;
let trattative = [];

const prezziSettore = {
  "Gradinata Nord": 25,
  "Gradinata Zena": 25,
  "Distinti Laterali": 30,
  "Distinti Centrali": 50,
  "Over 65 Distinti": 20,
  "Gradinata Laterale": 20,
  "Ridotto Gradinata": 15,
  "Over 65 Gradinata Zena": 15,
  "Ridotto Distinti": 20,
  "Ridotto Settore 6": 10,
  "Tribuna": 80
};

// Partite casa Genoa da mostrare nella select
const upcomingMatches = [
  {
    id: 1,
    description: "Genoa - Atalanta",
    date: "2025-12-21", // domenica 21 dicembre
    time: "20:45",
    homeTeamLogo: "img/genoa.png",
    awayTeamLogo: "img/atalanta.png"
  }
];

// Helpers per loghi locali
function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/(^-|-$)/g,'')
    .replace(/--+/g, '-'); // Aggiunto per gestire i trattini doppi
}
function getLogoSrcByTeamName(teamName){
  return `img/${slugify(teamName)}.png`;
}

// --- Sezioni ---
function showSection(id) {
  console.log(`Caricamento sezione: ${id}`);
  
  try {
    // Rimuovi active da tutte le sezioni
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
      target.classList.add('active');
      console.log(`Sezione ${id} attivata`);
    } else {
      console.error(`Elemento con id '${id}' non trovato`);
      return;
    }

    // Gestione stato attivo pulsanti navigazione
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    
    // Mappa sezioni -> pulsanti navigazione
    const sectionButtonMap = {
      'home': 'Home',
      'booking': 'Vendita Abbonamenti', 
      'profile': 'Profilo',
      'history': 'Storico',
      'mySubscription': 'Le tue Trattative',
      'contacts': 'Contatti'
    };
    
    // Trova e attiva il pulsante corrispondente
    if (sectionButtonMap[id]) {
      const activeButton = Array.from(document.querySelectorAll('nav button'))
        .find(btn => btn.textContent.includes(sectionButtonMap[id]));
      if (activeButton) {
        activeButton.classList.add('active');
      }
    }

    if (id === 'home') {
      loadHomeListings();
      loadStorico();
      displayNextMatch();
    } else if (id === 'booking') {
      populateMatchSelect();
      populateSectorSelect();
      updateBookingCounter();
    } else if (id === 'profile') {
      loadProfile();
    } else if (id === 'history') {
      loadStorico();
    } else if (id === 'mySubscription') {
      loadMySubscription();
      // 🔔 Aggiorna notifiche trattative quando si va nella sezione
      if (loggedInUser) {
        updateTrattativeNotifications();
      }
    }
  } catch (error) {
    console.error(`Errore nel caricamento della sezione ${id}:`, error);
  }
}

// --- Autenticazione ---
async function login(event) {
  event.preventDefault();
  const email = document.getElementById('loginUsername').value.trim(); // ora usa email
  const password = document.getElementById('loginPassword').value;

  try {
    // 🔥 LOGIN CON FIREBASE AUTH
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const firebaseUser = userCredential.user;
    
    console.log('✅ Login Firebase riuscito:', firebaseUser.uid);
    
    // 📥 Recupera profilo utente da Firestore
    const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      loggedInUser = userData;
      
      // ✅ Salva su localStorage per compatibilità
      SafeStorage.set('loggedInUser', loggedInUser);
      
      showToast(`✅ Benvenuto ${userData.nome}!`, 'success');
      toggleModal(false);
      updateUIAfterLogin();
      
    } else {
      throw new Error('Profilo utente non trovato');
    }
    
  } catch (error) {
    // Silenzioso per evitare spam console
    
    // Gestisci errori specifici Firebase
    let errorMessage = 'Errore durante il login';
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'Utente non trovato';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Password errata';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email non valida';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'Account disabilitato';
    }
    
    showToast(errorMessage, 'error');
  }
}

async function register(event) {
  event.preventDefault();

  const username = document.getElementById('registerUsername').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerConfirmPassword').value;

  // Validazioni
  if(users.some(u => u.username === username)){
    alert('Username già esistente');
    return;
  }

  if(password !== confirmPassword){
    alert('Le password non coincidono');
    return;
  }

  // Controllo password: almeno un numero e un carattere speciale
  if(!/\d/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)){
    alert('La password deve contenere almeno un numero e un carattere speciale.');
    return;
  }

  // Controllo età: almeno 18 anni
  const dataNascita = document.getElementById('registerDataNascita').value;
  const oggi = new Date();
  const nascita = new Date(dataNascita);
  const anni = oggi.getFullYear() - nascita.getFullYear();
  const m = oggi.getMonth() - nascita.getMonth();
  const d = oggi.getDate() - nascita.getDate();
  let eta = anni;
  if (m < 0 || (m === 0 && d < 0)) eta--;
  if (eta < 18) {
    alert('Devi avere almeno 18 anni per registrarti.');
    return;
  }

  try {
    // 🔥 REGISTRAZIONE CON FIREBASE AUTH
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const firebaseUser = userCredential.user;
    
    console.log('✅ Utente Firebase creato:', firebaseUser.uid);

    const newUser = {
      uid: firebaseUser.uid, // 🔑 ID Firebase
      username,
      email,
      nome: document.getElementById('registerNome').value.trim(),
      cognome: document.getElementById('registerCognome').value.trim(),
      dataNascita: dataNascita,
      telefono: document.getElementById('registerTelefono').value.trim(),
      registrationDate: new Date().toISOString(),
      // 🌟 Sistema rating
      rating: {
        totalStars: 0,
        totalVotes: 0,
        averageRating: 0,
        ratings: [] // Array di { fromUser, stars, comment, date }
      },
      pendingRatings: [] // Rating in attesa dopo conclusione trattativa
    };

    // ✅ Salva su Firestore con UID come ID documento
    await db.collection('users').doc(firebaseUser.uid).set(newUser);
    console.log('✅ Profilo utente salvato su Firestore');

    // ✅ Salva anche su localStorage per compatibilità
    users.push({...newUser, password}); // localStorage include password
    SafeStorage.set('users', users);
    
    showToast('✅ Registrazione completata! Accesso automatico...', 'success');
    
    // Auto-login dopo registrazione
    SafeStorage.set('loggedInUser', newUser);
    updateUIAfterLogin();
    
    // 🔔 Richiedi permessi notifiche per nuovi utenti
    setTimeout(async () => {
      if ('Notification' in window) {
        await requestNotificationPermission();
      }
    }, 3000); // Aspetta 3 sec dopo registrazione
    
    toggleModal(false);
    
  } catch (error) {
    console.error('❌ Errore registrazione Firebase:', error);
    
    // Gestisci errori specifici Firebase
    let errorMessage = 'Errore durante la registrazione';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Email già registrata';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password troppo debole';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Email non valida';
    }
    
    showToast(errorMessage, 'error');
  }
}

function toggleModal(show = true) {
  const authModal = document.getElementById('authModal');
  if (!authModal) return;
  authModal.style.display = show ? 'flex' : 'none';
}

async function logout() {
  try {
    // 🔥 LOGOUT CON FIREBASE AUTH
    await auth.signOut();
    console.log('✅ Logout Firebase riuscito');
    
    // ✅ Pulisci stato locale
    loggedInUser = null;
    SafeStorage.remove('loggedInUser');
    
    showToast('✅ Logout effettuato', 'success');
    updateUIAfterLogout();
    showSection('home');
    toggleModal(true);
    
  } catch (error) {
    console.error('❌ Errore logout Firebase:', error);
    showToast('Errore durante il logout', 'error');
    
    // Fallback: logout locale comunque
    loggedInUser = null;
    SafeStorage.remove('loggedInUser');
    updateUIAfterLogout();
    showSection('home');
  }
}

// 🔔 SISTEMA NOTIFICHE TRATTATIVE AVANZATO
function updateTrattativeNotifications() {
  if (!loggedInUser) return;
  
  const badge = document.getElementById('mySubBadge');
  const trattativeBtn = document.getElementById('trattativeBtn');
  
  if (!badge || !trattativeBtn) return;
  
  // Conta trattative attive per l'utente corrente
  const mieTrattativeAttive = abbonamenti.filter(abbon => {
    // Trattative dove sono il venditore O il compratore
    const sonoVenditore = abbon.utente === loggedInUser.username && abbon.inTrattativa;
    const sonoCompratore = abbon.buyerName === loggedInUser.username && abbon.inTrattativa;
    return sonoVenditore || sonoCompratore;
  });
  
  const count = mieTrattativeAttive.length;
  console.log('🔔 Trattative attive per', loggedInUser.username + ':', count);
  
  // Aggiorna badge numerico
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-block';
    trattativeBtn.classList.add('has-active');
  } else {
    badge.style.display = 'none';
    trattativeBtn.classList.remove('has-active');
  }
  
  return count;
}

// 🚨 Attiva animazione lampeggiante per nuove trattative
function blinkTrattativeButton(duration = 5000) {
  const badge = document.getElementById('mySubBadge');
  if (badge) {
    badge.classList.add('blink');
    setTimeout(() => {
      badge.classList.remove('blink');
    }, duration);
  }
}

// 💫 Animazione zoom al login
function zoomTrattativeOnLogin() {
  const trattativeBtn = document.getElementById('trattativeBtn');
  if (trattativeBtn) {
    trattativeBtn.classList.add('zoom-login');
    setTimeout(() => {
      trattativeBtn.classList.remove('zoom-login');
    }, 800);
  }
}

// 📊 SISTEMA POPUP STATISTICHE SITO
function calculateSiteStats() {
  // Statistiche reali
  const totalUsers = users.length;
  const abbonTimentiInVendita = abbonamenti.filter(a => a.disponibile === true).length;
  const abbonTimentiVenduti = abbonamenti.filter(a => a.stato === 'venduto').length;
  
  // 🚀 Aggiungi numeri base per rendere le statistiche più impressionanti
  const baseUsers = 247; // Utenti base simulati
  const baseSellingBoost = 12; // Boost abbonamenti in vendita
  const baseSoldBoost = 89; // Boost vendite completate
  
  return {
    users: totalUsers + baseUsers,
    selling: abbonTimentiInVendita + baseSellingBoost,
    sold: abbonTimentiVenduti + baseSoldBoost
  };
}

function updateStatsDisplay(stats) {
  // Animazione conteggio incrementale
  animateCounter('statsUsersCount', stats.users, '👥');
  animateCounter('statsSellingCount', stats.selling, '🎫');  
  animateCounter('statsSoldCount', stats.sold, '✅');
}

function animateCounter(elementId, targetValue, icon) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  let currentValue = 0;
  const increment = Math.max(1, Math.floor(targetValue / 30)); // Più smooth
  const duration = 2000; // 2 secondi
  const stepTime = duration / (targetValue / increment);
  
  element.textContent = '0';
  
  const timer = setInterval(() => {
    currentValue += increment;
    if (currentValue >= targetValue) {
      currentValue = targetValue;
      clearInterval(timer);
      // Effetto finale con pulsazione
      element.style.transform = 'scale(1.1)';
      setTimeout(() => {
        element.style.transform = 'scale(1)';
      }, 200);
    }
    element.textContent = currentValue.toLocaleString('it-IT');
  }, Math.max(50, stepTime));
}

function showStatsModal() {
  const modal = document.getElementById('statsModal');
  if (!modal) return;
  
  // Calcola statistiche aggiornate
  const stats = calculateSiteStats();
  console.log('📊 Statistiche calcolate:', stats);
  
  // Mostra modal
  modal.style.display = 'flex';
  
  // Avvia animazioni contatori dopo un delay per l'effetto
  setTimeout(() => {
    updateStatsDisplay(stats);
  }, 300);
  
  // Salva che l'utente ha visto il popup (opzionale)
  if (loggedInUser) {
    const now = Date.now();
    SafeStorage.setItem(`lastStatsView_${loggedInUser.username}`, now);
  }
}

function closeStatsModal() {
  const modal = document.getElementById('statsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Controlla se mostrare il popup all'utente
function shouldShowStatsModal() {
  if (!loggedInUser) return false;
  
  // Mostra sempre al primo login
  const lastView = SafeStorage.getItem(`lastStatsView_${loggedInUser.username}`);
  if (!lastView) return true;
  
  // Mostra se sono passati più di 24 ore dall'ultima visualizzazione
  const now = Date.now();
  const daysSinceLastView = (now - parseInt(lastView)) / (1000 * 60 * 60 * 24);
  
  return daysSinceLastView >= 1; // 24 ore
}

function updateUIAfterLogin() {
  updateLoginLogoutButtons();
  const bell = document.getElementById('notificationBell');
  if (bell) {
    bell.style.display = 'flex';
    bell.style.opacity = '1';
    bell.style.cursor = 'pointer';
  }
  
  // 🔄 Avvia sincronizzazione Firebase dopo autenticazione
  syncFirebaseData();
  
  // 🌐 Abilita sync multi-device: forza refresh dopo login
  setTimeout(() => {
    if (document.querySelector('.section.active')?.id === 'home') {
      loadHomeListings(true);
    }
  }, 1000);
  
  // 🔔 Richiedi permessi notifiche (solo al primo login)
  const preferences = SafeStorage.get('userPreferences', {});
  const userPrefs = preferences[loggedInUser.username] || {};
  
  if (userPrefs.notificationPermissionAsked !== true && 'Notification' in window) {
    // Ritardo per UX migliore
    setTimeout(async () => {
      if (await requestNotificationPermission()) {
        // Salva che abbiamo chiesto i permessi
        preferences[loggedInUser.username] = {
          ...userPrefs,
          notificationPermissionAsked: true,
          pushNotifications: true
        };
        SafeStorage.set('userPreferences', preferences);
      }
    }, 2000); // Aspetta 2 sec dopo login
  }
  
  // Inizializza i messaggi letti per questo utente
  initUserReadMessages();
  updateNotificationCount();
  
  // 🔔 Aggiorna notifiche trattative
  const trattativeCount = updateTrattativeNotifications();
  
  // 🕐 Cleanup trattative scadute prima dei controlli
  cleanupExpiredTrattative();
  
  // 🔔 CONTROLLO TRATTATIVE ATTIVE PER VENDITORI  
  // Aspetta che gli abbonamenti siano caricati
  setTimeout(() => {
    if (abbonamenti && abbonamenti.length > 0) {
      checkActiveTrattativeForSeller();
    } else {
      console.log('⏳ Abbonamenti non ancora caricati, ritento...');
      setTimeout(() => checkActiveTrattativeForSeller(), 2000);
    }
  }, 1000);
  
  // ⭐ CONTROLLO RATING PENDENTI
  setTimeout(() => checkPendingRatingsForUser(), 1500);
  
  // 💫 Animazione zoom se ci sono trattative attive
  if (trattativeCount > 0) {
    setTimeout(() => zoomTrattativeOnLogin(), 500);
  }
  
  // 📊 Mostra popup statistiche se appropriato
  setTimeout(() => {
    if (shouldShowStatsModal()) {
      showStatsModal();
    }
  }, 1500); // Delay per permettere all'utente di orientarsi
  
  // 🎫 Controlla notifiche biglietto
  checkTicketNotifications();
  
  loadProfile();
  showSection('home');
}

function updateUIAfterLogout() {
  updateLoginLogoutButtons();
  const bell = document.getElementById('notificationBell');
  if (bell) {
    bell.style.display = 'flex';
    bell.style.opacity = '0.5';
    bell.style.cursor = 'not-allowed';
  }
  clearNotificationCount();
  clearProfileForm();
}

function updateLoginLogoutButtons() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (!loginBtn || !logoutBtn) return;
  if (loggedInUser) {
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
  } else {
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
  }
}

// --- PROFILO UTENTE MODERNO ---
function loadProfile() {
  if (!loggedInUser) {
    clearProfileForm();
    updateProfileUI();
    return;
  }
  
  // Carica i dati del form
  const map = {
    profileNome: loggedInUser.nome,
    profileCognome: loggedInUser.cognome,
    profileDataNascita: loggedInUser.dataNascita,
    profileEmail: loggedInUser.email,
    profileTelefono: loggedInUser.telefono
  };
  
  Object.entries(map).forEach(([id,val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  });
  
  // Aggiorna UI del profilo
  updateProfileUI();
  updateEmailVerificationBadge();
  loadUserPreferences();
}

function clearProfileForm() {
  ['profileNome','profileCognome','profileDataNascita','profileEmail','profileTelefono'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function updateProfileUI() {
  if (!loggedInUser) return;
  
  // Aggiorna iniziale avatar
  const initialEl = document.getElementById('userInitial');
  if (initialEl && loggedInUser.nome) {
    initialEl.textContent = loggedInUser.nome.charAt(0).toUpperCase();
  }
  
  // Aggiorna statistiche utente
  updateProfileStats();
}

function updateProfileStats() {
  if (!loggedInUser) {
    document.getElementById('userSubscriptions').textContent = '0';
    document.getElementById('userTransactions').textContent = '0';
    return;
  }
  
  // Conta abbonamenti attivi
  const userSubscriptions = abbonamenti.filter(a => 
    a.utente === loggedInUser.username && a.disponibile === true
  ).length;
  
  // Conta transazioni completate
  const userTransactions = abbonamenti.filter(a => {
    const isSeller = a.utente === loggedInUser.username;
    const isBuyer = a.buyerName === loggedInUser.username;
    const isCompleted = a.confermato || a.sellerConfirmed || !a.disponibile;
    return (isSeller || isBuyer) && isCompleted;
  }).length;
  
  document.getElementById('userSubscriptions').textContent = userSubscriptions;
  document.getElementById('userTransactions').textContent = userTransactions;
}

function updateEmailVerificationBadge() {
  const badge = document.getElementById('emailVerifiedBadge');
  if (!badge) return;
  
  if (!loggedInUser) {
    badge.style.display = 'none';
    return;
  }
  
  badge.style.display = 'inline-block';
  
  if (loggedInUser.emailVerificata) {
    badge.className = 'badge small verified';
    badge.textContent = '✓ Email Verificata';
  } else {
    badge.className = 'badge small unverified';
    badge.textContent = '⚠ Email Non Verificata';
  }
}

function saveProfile(event) {
  event.preventDefault();
  if (!loggedInUser) {
    showToast('Devi effettuare il login', 'error');
    return;
  }
  
  // Salva i dati del profilo
  loggedInUser.nome = document.getElementById('profileNome').value.trim();
  loggedInUser.cognome = document.getElementById('profileCognome').value.trim();
  loggedInUser.dataNascita = document.getElementById('profileDataNascita').value;
  loggedInUser.email = document.getElementById('profileEmail').value.trim();
  loggedInUser.telefono = document.getElementById('profileTelefono').value.trim();

  // Salva nel database locale
  const index = users.findIndex(u => u.username === loggedInUser.username);
  if (index !== -1) {
    users[index] = loggedInUser;
    SafeStorage.set('users', users);
  }
  
  // Salva preferenze
  saveUserPreferences();
  
  // Aggiorna UI
  updateProfileUI();
  updateEmailVerificationBadge();
  
  showToast('✅ Profilo aggiornato con successo!', 'success');
}

function resetProfile() {
  if (!loggedInUser) return;
  
  if (confirm('Sei sicuro di voler ripristinare i dati originali del profilo?')) {
    loadProfile();
    showToast('🔄 Profilo ripristinato', 'info');
  }
}

// Gestione preferenze utente
function loadUserPreferences() {
  if (!loggedInUser) return;
  
  const preferences = SafeStorage.get('userPreferences', {});
  const userPrefs = preferences[loggedInUser.username] || {};
  
  document.getElementById('emailNotifications').checked = userPrefs.emailNotifications !== false;
  document.getElementById('pushNotifications').checked = userPrefs.pushNotifications !== false;
}

function saveUserPreferences() {
  if (!loggedInUser) return;
  
  const preferences = SafeStorage.get('userPreferences', {});
  
  preferences[loggedInUser.username] = {
    emailNotifications: document.getElementById('emailNotifications').checked,
    pushNotifications: document.getElementById('pushNotifications').checked
  };
  
  SafeStorage.set('userPreferences', preferences);
}

// --- Contatore abbonamenti utente ---
function updateBookingCounter() {
  if (!loggedInUser) return;
  
  const abbonamentiUtente = abbonamenti.filter(a => a.utente === loggedInUser.username && a.disponibile === true);
  const countText = `${abbonamentiUtente.length}/4`;
  
  // Cerco se esiste già il contatore
  let counterElement = document.getElementById('bookingCounter');
  if (!counterElement) {
    // Creo il contatore se non esiste
    counterElement = document.createElement('div');
    counterElement.id = 'bookingCounter';
    counterElement.className = 'booking-counter';
    
    // Lo inserisco nell'header della sezione booking
    const bookingHeader = document.querySelector('.booking-title-section');
    if (bookingHeader) {
      bookingHeader.appendChild(counterElement);
    }
  }
  
  // Aggiorno il contenuto
  const statusClass = abbonamentiUtente.length >= 4 ? 'counter-full' : 'counter-available';
  counterElement.className = `booking-counter ${statusClass}`;
  counterElement.innerHTML = `
    <span class="counter-label">Abbonamenti in vendita:</span>
    <span class="counter-value">${countText}</span>
  `;
  
  // Disabilito il form se ha raggiunto il limite
  const bookingForm = document.getElementById('bookingForm');
  const submitButton = bookingForm?.querySelector('button[type="submit"]');
  
  if (abbonamentiUtente.length >= 4) {
    if (bookingForm) {
      bookingForm.style.opacity = '0.6';
      bookingForm.style.pointerEvents = 'none';
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="btn-icon">🚫</span><span class="btn-text">Limite Raggiunto</span>';
    }
  } else {
    if (bookingForm) {
      bookingForm.style.opacity = '1';
      bookingForm.style.pointerEvents = 'auto';
    }
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = '<span class="btn-icon">💰</span><span class="btn-text">Metti in Vendita</span>';
    }
  }
}

// --- Select partite & settori ---
function populateMatchSelect() {
  const select = document.getElementById('matchSelect');
  if (!select) return;
  select.innerHTML = '';
  
  // Tutte le partite sono disponibili (rimosso filtro Cremonese)
  const availableMatches = upcomingMatches;
  
  availableMatches.forEach(match => {
    const option = document.createElement('option');
    option.value = match.id;
    
    // Testo normale per tutte le partite - VENDITA ATTIVA
    option.textContent = `${match.description} - ${formatDate(match.date)} ore ${match.time}`;
    
    select.appendChild(option);
  });
  
  // Se non ci sono partite disponibili, mostra messaggio
  if (availableMatches.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Nessuna partita disponibile per la vendita al momento';
    option.disabled = true;
    select.appendChild(option);
  }
}

function populateSectorSelect() {
  const select = document.getElementById('sectorSelect');
  if (!select) return;
  
  // Aggiungi opzione placeholder
  select.innerHTML = '<option value="" disabled selected class="placeholder-option">🎯 Scegli il settore e visualizza il prezzo...</option>';
  
  Object.entries(prezziSettore).forEach(([settore, prezzo]) => {
    const option = document.createElement('option');
    option.value = settore;
    // Formatta il prezzo con virgola e decimali
    const prezzoFormattato = formatPriceWithComma(prezzo);
    option.textContent = `${settore} - € ${prezzoFormattato}`;
    option.className = 'sector-option';
    select.appendChild(option);
  });
}

// Funzione per formattare i prezzi con virgola italiana
function formatPriceWithComma(price) {
  if (typeof price !== 'number') {
    price = parseFloat(price) || 0;
  }
  return price.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateString){
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// --- Vendita abbonamento ---
function prenotaAbbonamento(event) {
  event.preventDefault();
  loggedInUser = SafeStorage.get('loggedInUser'); // Aggiorna loggedInUser
  if (!loggedInUser) {
    alert('Devi effettuare il login per mettere in vendita.');
    toggleModal(true);
    return;
  }

  // Controllo limite massimo abbonamenti per utente
  const abbonamentiUtente = abbonamenti.filter(a => a.utente === loggedInUser.username && a.disponibile === true);
  if (abbonamentiUtente.length >= 4) {
    alert('Hai raggiunto il limite massimo di 4 abbonamenti in vendita. Completa o annulla una vendita esistente per aggiungerne un altro.');
    return;
  }

  const matchId = document.getElementById('matchSelect').value;
  const settore = document.getElementById('sectorSelect').value;
  const match = upcomingMatches.find(m => m.id == matchId);

  if (!match) {
    alert('Seleziona una partita valida');
    return;
  }

  // Controlla se l'utente ha già messo in vendita un abbonamento per questa specifica partita e settore
  const abbonamentioDuplicato = abbonamenti.find(a => 
    a.utente === loggedInUser.username && 
    a.matchId == matchId && 
    a.settore === settore && 
    a.disponibile === true
  );
  
  if (abbonamentioDuplicato) {
    alert('Hai già messo in vendita un abbonamento per questa partita nello stesso settore.');
    return;
  }

  // Blocco vendite per Genoa - Juventus (solo in "Vendi il tuo abbonamento")
  if (/^\s*genoa\s*-\s*juventus\s*$/i.test((match.description || '').trim())) {
    alert('Le vendite per "Genoa - Juventus" non sono ancora aperte. Puoi visualizzare la partita, ma non è possibile mettere in vendita il tuo abbonamento in questa sezione.');
    return;
  }

  // 🔥 BIG MATCH: Genoa - Inter - VENDITA ATTIVA
  if (/^\s*genoa\s*-\s*inter\s*$/i.test((match.description || '').trim())) {
    // Messaggio di benvenuto per Genoa-Inter (solo una volta)
    if (!localStorage.getItem('genoaInterWelcomeShown')) {
      alert('🎉 GENOA-INTER È QUI! 🎉\n\nBenvenuto alla vendita del BIG MATCH più atteso dell\'anno!\n\nBuona fortuna con la tua vendita! ⚽🔥');
      localStorage.setItem('genoaInterWelcomeShown', 'true');
    }
  }

  // Memorizza i dati temporaneamente e apri il popup di conferma
  window.tempBookingData = {
    matchId: match.id,
    matchDesc: match.description,
    settore: settore
  };

  openConfirmBookingModal();
}

// Funzioni per gestire il modal di conferma abbonamento
function openConfirmBookingModal() {
  const modal = document.getElementById('confirmBookingModal');
  const phoneInput = document.getElementById('confirmPhone');
  const emailInput = document.getElementById('confirmEmail');
  const acceptRules = document.getElementById('acceptRules');
  const acceptPrivacy = document.getElementById('acceptPrivacy');
  const confirmBtn = document.getElementById('confirmBookingBtn');
  
  // Precompila i dati se disponibili nel profilo
  if (loggedInUser && loggedInUser.telefono) {
    phoneInput.value = loggedInUser.telefono;
  }
  if (loggedInUser && loggedInUser.email) {
    emailInput.value = loggedInUser.email;
  }
  
  // Reset checkbox
  acceptRules.checked = false;
  acceptPrivacy.checked = false;
  confirmBtn.disabled = true;
  
  // Validazione email
  function isValidEmail(email) {
    return email.includes('@') && email.trim().length > 5;
  }
  
  // Gestione abilitazione pulsante
  function updateConfirmButton() {
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();
    
    const phoneValid = phone.length >= 10;
    const emailValid = !email || isValidEmail(email); // email opzionale ma se inserita deve essere valida
    const hasContact = phoneValid || (email && isValidEmail(email)); // almeno uno dei due
    const rulesAccepted = acceptRules.checked;
    const privacyAccepted = acceptPrivacy.checked;
    
    confirmBtn.disabled = !(hasContact && emailValid && rulesAccepted && privacyAccepted);
  }
  
  phoneInput.addEventListener('input', updateConfirmButton);
  emailInput.addEventListener('input', updateConfirmButton);
  acceptRules.addEventListener('change', updateConfirmButton);
  acceptPrivacy.addEventListener('change', updateConfirmButton);
  
  // Gestione tasto Invio nei campi
  phoneInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!confirmBtn.disabled) {
        confirmBookingSubmission();
      }
    }
  });
  
  emailInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!confirmBtn.disabled) {
        confirmBookingSubmission();
      }
    }
  });
  
  modal.style.display = 'flex';
  
  // Focus sul campo vuoto
  setTimeout(() => {
    if (!phoneInput.value.trim() && !emailInput.value.trim()) {
      phoneInput.focus();
    } else if (!phoneInput.value.trim()) {
      phoneInput.focus();
    } else if (!emailInput.value.trim()) {
      emailInput.focus();
    }
  }, 100);
  
  // Gestione tasto Esc per chiudere
  const handleEscKey = function(e) {
    if (e.key === 'Escape') {
      closeConfirmBookingModal();
      document.removeEventListener('keydown', handleEscKey);
    }
  };
  document.addEventListener('keydown', handleEscKey);
}

function closeConfirmBookingModal() {
  const modal = document.getElementById('confirmBookingModal');
  modal.style.display = 'none';
  
  // Pulisci i dati temporanei
  delete window.tempBookingData;
}

function confirmBookingSubmission() {
  const phoneInput = document.getElementById('confirmPhone');
  const emailInput = document.getElementById('confirmEmail');
  const acceptPrivacy = document.getElementById('acceptPrivacy');
  
  const phone = phoneInput.value.trim();
  const email = emailInput.value.trim();
  
  // Validazione contatti
  const phoneValid = phone.length >= 10;
  const emailValid = email.includes('@') && email.length > 5;
  
  if (!phoneValid && !emailValid) {
    showToast('❌ Inserisci almeno un numero di telefono valido o un indirizzo email', 'error');
    return;
  }
  
  if (email && !emailValid) {
    showToast('❌ L\'indirizzo email inserito non è valido', 'error');
    return;
  }
  
  if (!acceptPrivacy.checked) {
    showToast('❌ Devi accettare l\'informativa sulla privacy', 'error');
    return;
  }
  
  if (!window.tempBookingData) {
    showToast('❌ Errore: dati abbonamento non trovati', 'error');
    closeConfirmBookingModal();
    return;
  }
  
  // Aggiorna i dati di contatto nel profilo utente
  let profileUpdated = false;
  if (loggedInUser) {
    if (loggedInUser.telefono !== phone) {
      loggedInUser.telefono = phone;
      profileUpdated = true;
    }
    if (loggedInUser.email !== email) {
      loggedInUser.email = email;
      profileUpdated = true;
    }
    
    if (profileUpdated) {
      const users = SafeStorage.get('users', []);
      const userIndex = users.findIndex(u => u.username === loggedInUser.username);
      if (userIndex !== -1) {
        users[userIndex].telefono = phone;
        users[userIndex].email = email;
        SafeStorage.set('users', users);
        SafeStorage.set('loggedInUser', loggedInUser);
      }
    }
  }
  
  // Crea l'abbonamento
  const nuovoAbbonamento = {
    utente: loggedInUser.username,
    matchId: window.tempBookingData.matchId,
    matchDesc: window.tempBookingData.matchDesc,
    settore: window.tempBookingData.settore,
    disponibile: true,
    messaggiChat: [],
    phoneConfirmed: phone || '',
    emailConfirmed: email || '',
    rulesAccepted: true,
    privacyAccepted: true,
    createdAt: new Date().toISOString()
  };

  // ✅ Salva SUBITO su localStorage (funziona sempre)
  const abbonamentoConId = {
    ...nuovoAbbonamento,
    id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    isLocalOnly: true // Flag per distinguere item locali da Firebase
  };
  
  abbonamenti.push(abbonamentoConId);
  SafeStorage.set('abbonamenti', abbonamenti);
  
  showToast('✅ Abbonamento messo in vendita con successo!', 'success');
  updateBookingCounter();
  updateProfileStats();
  
  // 🔔 Notifica altri utenti interessati (escluso chi pubblica)
  setTimeout(() => {
    notifyUsersAboutNewSubscription(abbonamentoConId);
  }, 1000);
  
  // 📊 Aggiorna statistiche per altri utenti
  updateGlobalStats();
  
  showSection('home');
  loadHomeListings();
  
  // 🎯 ANIMAZIONE SPETTACOLARE: Zooma il nuovo abbonamento appena inserito
  setTimeout(() => {
    console.log('🎆 Chiamando animazione per:', abbonamentoConId.id);
    animateNewListing(abbonamentoConId.id);
  }, 1500); // Aumentato timeout per assicurarci che loadHomeListings sia completa
  
  // 🔥 Firebase opzionale in background
  setTimeout(() => {
    try {
      console.log('🔥 Tentativo salvataggio Firebase...');
      firebase.firestore().collection('abbonamenti').add({
        ...nuovoAbbonamento,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: new Date()
      }).then((docRef) => {
        console.log('✅ Abbonamento sincronizzato su Firebase:', docRef.id);
        console.log('🎯 Verifica qui: https://console.firebase.google.com/project/tipresto-test/firestore/data');
      }).catch((error) => {
        console.log('⚠️ Firebase sync fallito:', error.message);
      });
    } catch (e) {
      console.log('⚠️ Firebase non disponibile:', e.message);
    }
  }, 200);
  
  // Chiudi il modal
  closeConfirmBookingModal();
  
  // Reset form
  document.getElementById('bookingForm').reset();
}

// Funzione per mostrare informazioni privacy
function showPrivacyInfo() {
  const privacyText = `
📋 INFORMATIVA PRIVACY - Ti Presto

🔒 Titolare del Trattamento:
Ti Presto - Piattaforma di scambio abbonamenti Genoa CFC

📧 Finalità del Trattamento:
- Gestione e pubblicazione annunci di scambio abbonamenti
- Facilitazione contatti tra tifosi per cessioni/acquisti
- Invio comunicazioni relative alle transazioni

📱 Dati Raccolti:
- Nome, cognome e dati di registrazione
- Numero di telefono e/o indirizzo email (almeno uno obbligatorio)
- Informazioni sugli abbonamenti inseriti

⚖️ Base Giuridica:
Consenso dell'interessato per finalità di contatto

🤝 Comunicazione Dati:
I tuoi dati di contatto verranno condivisi SOLO con i tifosi interessati al tuo abbonamento e previa tua autorizzazione diretta.

⏰ Conservazione:
I dati verranno conservati fino alla cancellazione dell'account o revoca del consenso.

🔐 Diritti dell'Interessato:
Hai diritto di accedere, rettificare, cancellare i tuoi dati o opporti al trattamento in qualsiasi momento.

Per esercitare i tuoi diritti o per informazioni: contatta il responsabile della piattaforma.
  `.trim();
  
  alert(privacyText);
}

// 🚀 FUNZIONE DI AGGIORNAMENTO VELOCE BADGE
// 🎯 GESTIONE ANIMAZIONI BADGE AVANZATE
function applyBadgeAnimations() {
  // 🔧 RISPETTA LE PREFERENZE UTENTE PER ACCESSIBILITÀ
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    // Disabilita animazioni se l'utente preferisce movimento ridotto
    document.querySelectorAll('.badge-status').forEach(badge => {
      badge.style.animation = 'none';
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const badge = entry.target;
      if (entry.isIntersecting) {
        // Attiva animazioni solo quando il badge è visibile
        if (badge.classList.contains('status-available')) {
          badge.style.animationPlayState = 'running';
        } else if (badge.classList.contains('status-negotiation')) {
          badge.style.animationPlayState = 'running';
        } else if (badge.classList.contains('status-sold')) {
          badge.style.animationPlayState = 'running';
        }
      } else {
        // Pausa animazioni per migliorare performance
        badge.style.animationPlayState = 'paused';
      }
    });
  }, { threshold: 0.1 });

  // Osserva tutti i badge status
  document.querySelectorAll('.badge-status').forEach(badge => {
    observer.observe(badge);
  });
}

// 🚀 INIZIALIZZA ANIMAZIONI AL CARICAMENTO
document.addEventListener('DOMContentLoaded', function() {
  applyBadgeAnimations();
  
  // Test localStorage rimosso per evitare spam Tracking Prevention
  try {
    // Test già fatto da SafeStorage
    console.log('SafeStorage modalità:', SafeStorage.getStatus().mode);
  } catch (e) {
    console.warn('⚠️ LocalStorage bloccato dal browser');
    showToast('⚠️ Il browser ha bloccato la memorizzazione locale. I dati saranno temporanei.', 'info');
  }
});

// 🎯 ANIMAZIONE SPOTLIGHT per nuovo abbonamento
function animateNewListing(abbonamentoId) {
  console.log('🎯 Iniziando animazione per abbonamento:', abbonamentoId);
  
  // Salta alla homepage
  showSection('home');
  
  // Aspetta che il DOM sia aggiornato
  setTimeout(() => {
    console.log('🔍 Cercando elemento con ID:', abbonamentoId);
    const newListingElement = document.querySelector(`[data-abbonamento-id="${abbonamentoId}"]`);
    
    if (newListingElement) {
      console.log('✅ Elemento trovato, iniziando animazione');
      
      // Scroll smooth al nuovo elemento
      newListingElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Aggiungi classe per animazione spotlight
      newListingElement.classList.add('new-listing-spotlight');
      
      // Effetto zoom e glow
      setTimeout(() => {
        newListingElement.style.transition = 'all 0.8s ease';
        newListingElement.style.transform = 'scale(1.05)';
        newListingElement.style.boxShadow = '0 0 30px rgba(200, 16, 46, 0.8), 0 0 60px rgba(200, 16, 46, 0.4)';
        newListingElement.style.zIndex = '1000';
        newListingElement.style.position = 'relative';
        newListingElement.style.border = '3px solid #c8102e';
        newListingElement.style.borderRadius = '15px';
        newListingElement.style.backgroundColor = 'rgba(200, 16, 46, 0.05)';
        
        console.log('🎆 Effetti applicati!');
        
        // Rimuovi effetti dopo l'animazione
        setTimeout(() => {
          newListingElement.style.transition = 'all 0.5s ease';
          newListingElement.style.transform = '';
          newListingElement.style.boxShadow = '';
          newListingElement.style.zIndex = '';
          newListingElement.style.border = '';
          newListingElement.style.borderRadius = '';
          newListingElement.style.backgroundColor = '';
          newListingElement.classList.remove('new-listing-spotlight');
          console.log('🏁 Animazione completata');
        }, 3000);
      }, 800);
    } else {
      console.error('❌ Elemento non trovato con ID:', abbonamentoId);
      console.log('🔍 Elementi disponibili:', document.querySelectorAll('[data-abbonamento-id]'));
    }
  }, 1000); // Aumentato il timeout per dare più tempo al rendering
}

function updateBadgesOnly() {
  // Aggiorna solo i badge senza ricaricare tutto il contenuto
  const homeCards = document.querySelectorAll('[data-abbonamento-id]');
  homeCards.forEach(card => {
    const abbonId = card.getAttribute('data-abbonamento-id');
    const abbonamento = abbonamenti.find(a => a.id === abbonId);
    
    if (abbonamento) {
      // 🎯 AGGIORNA NUOVI BADGE STATUS ANIMATI
      const statusBadge = card.querySelector('.badge-status');
      if (statusBadge) {
        if (abbonamento.stato === 'venduto' || !abbonamento.disponibile) {
          statusBadge.className = 'badge-status status-sold';
          statusBadge.textContent = 'VENDUTO';
        } else if (abbonamento.inTrattativa) {
          statusBadge.className = 'badge-status status-negotiation';
          statusBadge.textContent = 'IN TRATTATIVA';
        } else {
          statusBadge.className = 'badge-status status-available';
          statusBadge.textContent = 'DISPONIBILE';
        }
      }
      
      // Legacy: Aggiorna anche il badge vecchio se presente
      const badge = card.querySelector('.badge');
      if (badge) {
        if (abbonamento.inTrattativa) {
          badge.textContent = 'In Trattativa';
          badge.className = 'badge bg-warning text-dark';
        } else if (abbonamento.disponibile) {
          badge.textContent = 'Disponibile';
          badge.className = 'badge bg-success';
        } else {
          badge.textContent = 'Venduto';
          badge.className = 'badge bg-danger';
        }
      }
      
      // Aggiorna anche il pulsante se presente
      const btn = card.querySelector('.btn-primary, .btn-warning, .btn-secondary');
      if (btn) {
        if (abbonamento.inTrattativa) {
          btn.textContent = 'In Trattativa';
          btn.className = 'btn btn-warning btn-sm';
          btn.disabled = true;
        } else if (abbonamento.disponibile) {
          btn.textContent = 'Acquista';
          btn.className = 'btn btn-primary btn-sm';
          btn.disabled = false;
        }
      }
    }
  });
  console.log('🚀 Badge aggiornati immediatamente');
}

// --- Home: lista ---
function loadHomeListings(forceRefresh = false) {
  // 🔧 CACHE TEMPORALE: Evita reload se fatto recentemente (saltabile con forceRefresh)
  const now = Date.now();
  if (!forceRefresh && now - lastHomeRender < HOME_CACHE_DURATION) {
    console.log('💾 Homepage in cache - skip reload');
    return;
  }
  
  if (forceRefresh) {
    console.log('🔄 Force refresh homepage per real-time update');
  }
  
  // 🔧 DEBOUNCE: Cancella chiamata precedente se ancora in corso
  if (homeLoadingDebounce) {
    clearTimeout(homeLoadingDebounce);
  }
  
  // 🚫 Previeni chiamate multiple concorrenti
  if (isHomeLoading) {
    console.log('🔄 loadHomeListings già in corso - skip');
    return;
  }
  
  homeLoadingDebounce = setTimeout(() => {
    isHomeLoading = true;
    console.log('🚀 Inizio caricamento homepage (debounced)');
    
    const container = document.getElementById('homeListings');
    if (!container) {
      isHomeLoading = false;
      return;
    }
    
    container.innerHTML = '<div class="loading">🔄 Caricamento abbonamenti...</div>';

    // 🎯 MODALITÀ SOLO localStorage (Firebase opzionale)
    console.log('📦 Caricamento abbonamenti da localStorage...');
    
    // Usa solo localStorage - più stabile e veloce
    const inVendita = abbonamenti.filter(a => a.disponibile === true);
    inVendita.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderHomeListings(inVendita);
    
    // 🔔 Aggiorna badge dopo caricamento localStorage
    if (loggedInUser) {
      setTimeout(() => updateTrattativeNotifications(), 100);
    }
    
    isHomeLoading = false;
    lastHomeRender = Date.now();
    console.log('✅ Homepage caricata con successo (cached per 2s)');
  }, 150); // Debounce di 150ms
  
  // Firebase opzionale in background (non blocca l'UI)
  setTimeout(() => {
    try {
      db.collection('subscriptions').get().then((querySnapshot) => {
        console.log('✅ Firebase caricato in background');
        // Sincronizza silenziosamente senza ricaricare UI
      }).catch(() => {
        console.log('⚠️ Firebase non disponibile - usando solo localStorage');
      });
    } catch (e) {
      console.log('⚠️ Firebase disabilitato');
    }
  }, 1000);
}

// 📅 Formatta data/ora per i badge degli abbonamenti
function formatInsertionDateTime(timestamp) {
  if (!timestamp || timestamp === 0) {
    return 'Data non disponibile';
  }
  
  try {
    const date = new Date(timestamp);
    
    // Verifica se la data è valida
    if (isNaN(date.getTime())) {
      return 'Data non valida';
    }
    
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Se è oggi, mostra solo l'ora
    if (diffDays <= 1 && date.toDateString() === now.toDateString()) {
      return `Oggi alle ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Se è ieri
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Ieri alle ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Se è questa settimana (meno di 7 giorni)
    if (diffDays <= 7) {
      const weekday = date.toLocaleDateString('it-IT', { weekday: 'long' });
      return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} alle ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Altrimenti data completa
    return date.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (error) {
    console.warn('Errore nel formato data:', error);
    return 'Data non disponibile';
  }
}

// 📊 Aggiorna statistiche globali del sito
function updateGlobalStats() {
  // Salva timestamp ultimo aggiornamento statistiche
  SafeStorage.setItem('lastStatsUpdate', Date.now());
  
  // Se il popup statistiche è aperto, aggiorna i numeri
  const modal = document.getElementById('statsModal');
  if (modal && modal.style.display === 'flex') {
    const stats = calculateSiteStats();
    setTimeout(() => {
      updateStatsDisplay(stats);
    }, 500);
  }
}

// Gestione click fuori dal modal per chiudere
window.addEventListener('click', function(event) {
  const statsModal = document.getElementById('statsModal');
  if (event.target === statsModal) {
    closeStatsModal();
  }
});

function renderHomeListings(inVendita) {
  const container = document.getElementById('homeListings');
  if (!container) return;
  
  // 🔧 PROTEZIONE ANTI-DUPLICATO
  if (container.hasAttribute('data-rendering')) {
    console.log('🚫 renderHomeListings già in corso - skip per evitare duplicati');
    return;
  }
  
  container.setAttribute('data-rendering', 'true');
  
  if(inVendita.length === 0){
    container.innerHTML = '<p class="no-listings">Nessun abbonamento in vendita al momento.</p>';
    container.removeAttribute('data-rendering');
    return;
  }
  
  // 🚀 Usa DocumentFragment per rendering più veloce
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  inVendita.forEach(abbon => {
    const prezzo = prezziSettore[abbon.settore] || 'N/A';
    
    // Determina se è in trattativa
    const haMessaggi = abbon.messaggiChat && abbon.messaggiChat.length > 0;
    const inTrattativa = abbon.inTrattativa === true || haMessaggi;
    
    // Estrai nomi squadre per i loghi
    const teamNames = abbon.matchDesc.split(' - ');
    const homeTeam = teamNames[0]?.trim();
    const awayTeam = teamNames[1]?.trim();

    const div = document.createElement('div');
    div.className = 'home-listing-item';
    // ⚡ Crea elementi DOM in modo sicuro (nessun template literal)
    div.className = 'home-listing-item';
    div.setAttribute('data-abbonamento-id', abbon.id);
    
    // Header
    const header = document.createElement('div');
    header.className = 'listing-header';
    
    const matchTeams = document.createElement('div');
    matchTeams.className = 'match-teams';
    
    // Logo home team
    if (homeTeam) {
      const homeImg = document.createElement('img');
      homeImg.src = getLogoSrcByTeamName(homeTeam);
      homeImg.alt = 'Logo ' + homeTeam;
      homeImg.className = 'team-logo';
      matchTeams.appendChild(homeImg);
    }
    
    // Match info
    const matchInfo = document.createElement('div');
    matchInfo.className = 'match-info';
    
    const matchTitle = document.createElement('h3');
    matchTitle.className = 'match-title';
    matchTitle.textContent = abbon.matchDesc;
    
    const matchDate = document.createElement('p');
    matchDate.className = 'match-date';
    matchDate.textContent = '29 settembre 2025 - 20:45';
    
    matchInfo.appendChild(matchTitle);
    matchInfo.appendChild(matchDate);
    matchTeams.appendChild(matchInfo);
    
    // Logo away team
    if (awayTeam) {
      const awayImg = document.createElement('img');
      awayImg.src = getLogoSrcByTeamName(awayTeam);
      awayImg.alt = 'Logo ' + awayTeam;
      awayImg.className = 'team-logo';
      matchTeams.appendChild(awayImg);
    }
    
    // Badges
    const badges = document.createElement('div');
    badges.className = 'listing-badges';
    
    const statusBadge = document.createElement('span');
    // 🎯 LOGICA AVANZATA STATI CON ANIMAZIONI
    if (abbon.stato === 'venduto' || !abbon.disponibile) {
      statusBadge.className = 'badge-status status-sold';
      statusBadge.textContent = 'VENDUTO';
    } else if (inTrattativa) {
      statusBadge.className = 'badge-status status-negotiation';
      statusBadge.textContent = 'IN TRATTATIVA';
    } else {
      statusBadge.className = 'badge-status status-available';
      statusBadge.textContent = 'DISPONIBILE';
    }
    badges.appendChild(statusBadge);
    
    header.appendChild(matchTeams);
    header.appendChild(badges);
    
    // Details
    const details = document.createElement('div');
    details.className = 'listing-details';
    
    const sectorPrice = document.createElement('div');
    sectorPrice.className = 'sector-price';
    
    const sectorBadge = document.createElement('span');
    sectorBadge.className = 'sector-badge';
    sectorBadge.textContent = abbon.settore;
    
    const priceBadge = document.createElement('span');
    priceBadge.className = 'price-badge';
    priceBadge.textContent = '€ ' + formatPriceWithComma(prezzo);
    
    sectorPrice.appendChild(sectorBadge);
    sectorPrice.appendChild(priceBadge);
    
    // 👤 Badge venditore con rating
    const cardSellerWrapper = document.createElement('div');
    cardSellerWrapper.className = 'card-seller-wrapper';
    cardSellerWrapper.style.marginBottom = '8px';
    
    const sellerLabel = document.createElement('small');
    sellerLabel.textContent = 'Pubblicato da:';
    sellerLabel.style.color = '#6c757d';
    sellerLabel.style.fontSize = '0.85em';
    sellerLabel.style.display = 'block';
    sellerLabel.style.marginBottom = '4px';
    
    const sellerBadge = createUserBadgeWithRating(abbon.ownerName || abbon.utente || 'Utente', true, 'homepage');
    sellerBadge.style.marginLeft = '10px';
    
    cardSellerWrapper.appendChild(sellerLabel);
    cardSellerWrapper.appendChild(sellerBadge);
    
    // 📅 Data e ora di inserimento
    const insertionDate = document.createElement('small');
    insertionDate.className = 'insertion-date';
    insertionDate.textContent = formatInsertionDateTime(abbon.timestamp);
    
    details.appendChild(sectorPrice);
    details.appendChild(cardSellerWrapper);
    details.appendChild(insertionDate);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'listing-actions';
    
    // Solo pulsante Contatta Venditore per UX semplificata
    const contactButton = document.createElement('button');
    contactButton.className = 'btn-primary btn-contact-seller';
    contactButton.textContent = ' CONTATTA VENDITORE';
    actions.appendChild(contactButton);
    
    // Assembla tutto
    div.appendChild(header);
    div.appendChild(details);
    div.appendChild(actions);
    
    // 🚀 Aggiungi al fragment invece che al DOM direttamente
    tempDiv.appendChild(div);
    
    // 🎯 Assegna l'ID in modo sicuro al bottone contatta venditore
    const contactBtn = div.querySelector('.btn-contact-seller');
    if (contactBtn) {
      contactBtn.setAttribute('data-id', abbon.id);
      contactBtn.addEventListener('click', function() {
        const id = this.getAttribute('data-id');
        console.log('📞 Bottone contatta venditore cliccato, ID:', id);
        handleContactSeller(id);
      });
    }
  });
  
  // 🚀 Un solo aggiornamento DOM alla fine per massima velocità
  container.innerHTML = '';
  container.appendChild(tempDiv);
  
  // 🔧 Rimuovi flag rendering completato
  container.removeAttribute('data-rendering');
  
  // 🎯 APPLICA ANIMAZIONI AI NUOVI BADGE
  setTimeout(applyBadgeAnimations, 100);
}

// --- Chat ---
let chatListener = null; // Listener per real-time chat

// 🔧 INIZIALIZZAZIONE SICURA CHAT
function initializeChatSafely(abbonamento) {
  if (!abbonamento.messaggiChat) {
    abbonamento.messaggiChat = [];
    console.log('🔧 Inizializzato array messaggiChat per abbonamento:', abbonamento.id);
  }
  return abbonamento;
}

// 🔧 MERGE INTELLIGENTE MESSAGGI (prevenzione duplicati)
function mergeMessagesIntelligently(localMessages, firebaseMessages) {
  if (!Array.isArray(localMessages)) localMessages = [];
  if (!Array.isArray(firebaseMessages)) firebaseMessages = [];
  
  const allMessages = [...localMessages, ...firebaseMessages];
  
  // Rimuovi duplicati basati su timestamp+sender+text
  const uniqueMessages = allMessages.filter((msg, index, arr) => {
    const key = `${msg.timestamp || 0}_${msg.sender || ''}_${(msg.text || '').substring(0, 50)}`;
    return arr.findIndex(m => {
      const mKey = `${m.timestamp || 0}_${m.sender || ''}_${(m.text || '').substring(0, 50)}`;
      return mKey === key;
    }) === index;
  });
  
  // Ordina per timestamp
  return uniqueMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

function openChatModal(abbonId) {
  console.log('💬 openChatModal chiamata con ID:', abbonId);
  console.log('👤 Utente loggato:', loggedInUser);
  
  if (!loggedInUser) {
    alert('Devi effettuare il login per aprire la chat.');
    toggleModal(true);
    return;
  }

  currentChatAbbonamento = abbonamenti.find(a => a.id === abbonId);
  console.log('🎫 Abbonamento per chat:', currentChatAbbonamento);
  
  if (!currentChatAbbonamento) {
    alert('Abbonamento non trovato');
    console.error('❌ Abbonamento non trovato per ID:', abbonId);
    return;
  }
  
  // 🔧 INIZIALIZZAZIONE SICURA
  currentChatAbbonamento = initializeChatSafely(currentChatAbbonamento);

  // 🔥 ATTIVA LISTENER REAL-TIME PER CHAT
  setupChatRealTimeListener(abbonId);

  // Apri direttamente la chat per ora (debug)
  console.log('🚀 Aprendo modal chat...');
  const modal = document.getElementById('chatModal');
  if (modal) {
    modal.classList.add('active');
    console.log('✅ Modal chat aperto');
    
    // 📱 Marca tutti i messaggi dell'altra persona come "read" per i loro mittenti
    markOtherUserMessagesAsRead();
    
    loadChatMessages();
  } else {
    console.error('❌ Modal chat non trovato!');
  }
}

// 📱 Marca i messaggi dell'altro utente come "read" dal loro punto di vista
function markOtherUserMessagesAsRead() {
  if (!currentChatAbbonamento || !loggedInUser || !currentChatAbbonamento.messaggiChat) {
    console.warn('⚠️ markOtherUserMessagesAsRead: dati non disponibili');
    return;
  }
  
  let hasChanges = false;
  
  currentChatAbbonamento.messaggiChat.forEach((msg, index) => {
    // Solo per messaggi che NON ho inviato io
    if (msg.sender !== loggedInUser.username) {
      // I miei messaggi vengono marcati come "read" dall'altro quando apre la chat
      if (msg.status !== 'read') {
        msg.status = 'read';
        msg.readAt = Date.now();
        hasChanges = true;
        console.log(`📱 Messaggio da ${msg.sender} marcato come read`);
      }
    }
  });
  
  if (hasChanges) {
    // Salva cambiamenti
    SafeStorage.setItem('abbonamenti', abbonamenti);
    
    // Update Firebase
    setTimeout(() => {
      try {
        updateAbbonamentoFirebase(currentChatAbbonamento).catch(() => {});
      } catch (e) {}
    }, 100);
  }
}

// 🔥 LISTENER REAL-TIME PER CHAT FIREBASE
function setupChatRealTimeListener(abbonId) {
  // Disconnetti listener precedente se esiste
  if (chatListener) {
    chatListener();
    chatListener = null;
  }

  try {
    // Listener real-time su documento abbonamento
    chatListener = db.collection('abbonamenti').doc(abbonId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          if (data.messaggiChat && currentChatAbbonamento) {
            // 🔧 MERGE INTELLIGENTE invece di sovrascrittura
            const currentLocal = currentChatAbbonamento.messaggiChat || [];
            const firebaseMessages = data.messaggiChat || [];
            const mergedMessages = mergeMessagesIntelligently(currentLocal, firebaseMessages);
            
            currentChatAbbonamento.messaggiChat = mergedMessages;
            
            // Aggiorna anche localStorage
            const localIndex = abbonamenti.findIndex(a => a.id === abbonId);
            if (localIndex !== -1) {
              abbonamenti[localIndex] = initializeChatSafely(abbonamenti[localIndex]);
              abbonamenti[localIndex].messaggiChat = mergedMessages;
              SafeStorage.set('abbonamenti', abbonamenti);
            }
            
            // Ricarica la chat se è aperta
            if (document.getElementById('chatModal').classList.contains('active')) {
              loadChatMessages();
              
              // 📱 Simula che l'altro utente abbia letto i miei messaggi recenti
              simulateMessageReading();
            }
            
            console.log('🔄 Chat aggiornata in real-time con merge intelligente');
          }
        }
      }, (error) => {
        console.warn('⚠️ Errore listener chat:', error);
      });
      
  } catch (error) {
    console.warn('⚠️ Impossibile attivare listener real-time:', error);
  }
}

// 🔥 Sincronizza messaggi chat specifici da Firebase
async function syncChatFromFirebase(abbonId) {
  try {
    const doc = await db.collection('subscriptions').doc(abbonId).get();
    if (doc.exists) {
      const firebaseData = doc.data();
      if (firebaseData.messaggiChat) {
        // 🔧 MERGE INTELLIGENTE
        const currentLocal = currentChatAbbonamento.messaggiChat || [];
        const firebaseMessages = firebaseData.messaggiChat || [];
        const mergedMessages = mergeMessagesIntelligently(currentLocal, firebaseMessages);
        
        currentChatAbbonamento.messaggiChat = mergedMessages;
        
        // Aggiorna anche l'array locale
        const localIndex = abbonamenti.findIndex(a => a.id === abbonId);
        if (localIndex !== -1) {
          abbonamenti[localIndex] = initializeChatSafely(abbonamenti[localIndex]);
          abbonamenti[localIndex].messaggiChat = mergedMessages;
          SafeStorage.set('abbonamenti', abbonamenti);
        }
      }
    }
  } catch (error) {
    console.error('❌ Errore sincronizzazione chat:', error);
  }
}

// 📱 SISTEMA SPUNTE WHATSAPP - Helper Functions
function getTickSymbol(status) {
  switch(status) {
    case 'sent': return '✓';
    case 'delivered': return '✓✓';
    case 'read': return '✓✓';
    default: return '✓';
  }
}

function getTickClass(status) {
  switch(status) {
    case 'sent': return 'tick-sent';
    case 'delivered': return 'tick-delivered';
    case 'read': return 'tick-read';
    default: return 'tick-sent';
  }
}

// Marca messaggio come consegnato
function markMessageAsDelivered(message, messageIndex) {
  if (message.status === 'sent') {
    message.status = 'delivered';
    message.deliveredAt = Date.now();
    
    // Salva su localStorage
    SafeStorage.setItem('abbonamenti', abbonamenti);
    
    // Update in Firebase
    setTimeout(() => {
      try {
        updateAbbonamentoFirebase(currentChatAbbonamento).catch(() => {});
      } catch (e) {}
    }, 100);
  }
}

// Marca messaggio come letto
function markMessageAsReadWhatsApp(message, messageIndex) {
  if (message.status !== 'read') {
    message.status = 'read';
    message.readAt = Date.now();
    
    // Salva su localStorage
    SafeStorage.setItem('abbonamenti', abbonamenti);
    
    // Update visivo immediato delle spunte
    updateMessageTicks(message, messageIndex);
    
    // Update in Firebase
    setTimeout(() => {
      try {
        updateAbbonamentoFirebase(currentChatAbbonamento).catch(() => {});
      } catch (e) {}
    }, 100);
  }
}

// Aggiorna visualmente le spunte
function updateMessageTicks(message, messageIndex) {
  const chatBox = document.getElementById('chatBox');
  if (!chatBox || !currentChatAbbonamento || !currentChatAbbonamento.messaggiChat) {
    console.warn('⚠️ updateMessageTicks: dati non disponibili');
    return;
  }
  
  const messageElements = chatBox.querySelectorAll('p.sent');
  let myMessageCount = 0;
  
  // Trova l'indice del mio messaggio tra tutti i miei messaggi
  for (let i = 0; i < currentChatAbbonamento.messaggiChat.length; i++) {
    const msg = currentChatAbbonamento.messaggiChat[i];
    if (msg.sender === loggedInUser.username) {
      if (i === messageIndex) {
        // Trova l'elemento corrispondente
        const messageElement = messageElements[myMessageCount];
        if (messageElement) {
          const tickElement = messageElement.querySelector('.tick-sent, .tick-delivered, .tick-read');
          if (tickElement) {
            tickElement.className = getTickClass(message.status);
            tickElement.textContent = getTickSymbol(message.status);
            tickElement.classList.add('tick-new'); // Animazione
            
            setTimeout(() => {
              tickElement.classList.remove('tick-new');
            }, 300);
          }
        }
        break;
      }
      myMessageCount++;
    }
  }
}

// 📱 Simula che l'altro utente legga i messaggi (in un'app reale verrebbe dal server)
function simulateMessageReading() {
  if (!currentChatAbbonamento || !loggedInUser || !currentChatAbbonamento.messaggiChat) {
    console.warn('⚠️ simulateMessageReading: dati non disponibili');
    return;
  }
  
  let hasChanges = false;
  
  // Prendi i miei messaggi che sono solo "delivered" e marcali come "read" dopo un delay
  currentChatAbbonamento.messaggiChat.forEach((msg, index) => {
    if (msg.sender === loggedInUser.username && msg.status === 'delivered') {
      // Simula lettura dopo 3-8 secondi (random per realismo)
      const delay = Math.random() * 5000 + 3000;
      
      setTimeout(() => {
        if (msg.status === 'delivered') {
          msg.status = 'read';
          msg.readAt = Date.now();
          
          // Salva cambiamenti
          SafeStorage.setItem('abbonamenti', abbonamenti);
          
          // Aggiorna visualmente
          updateMessageTicks(msg, index);
          
          // Firebase update
          setTimeout(() => {
            try {
              updateAbbonamentoFirebase(currentChatAbbonamento).catch(() => {});
            } catch (e) {}
          }, 100);
          
          console.log(`📱 Messaggio marcato come read dall'altro utente`);
        }
      }, delay);
    }
  });
}

function loadChatMessages() {
  console.log('📨 loadChatMessages chiamata');
  const chatBox = document.getElementById('chatBox');
  if (!chatBox) {
    console.error('❌ chatBox non trovato!');
    return;
  }
  chatBox.innerHTML = '';

  if (!currentChatAbbonamento) {
    console.error('❌ currentChatAbbonamento è null!');
    return;
  }
  
  // 🔧 INIZIALIZZAZIONE SICURA
  currentChatAbbonamento = initializeChatSafely(currentChatAbbonamento);
  
  if (!currentChatAbbonamento.messaggiChat) {
    console.error('❌ messaggiChat non inizializzato!');
    return;
  }
  
  console.log('💬 Caricando messaggi per:', currentChatAbbonamento.id);

  // Carica messaggi e segna quelli ricevuti come letti
  currentChatAbbonamento.messaggiChat.forEach((msg, index) => {
    // Assicurati che ogni messaggio abbia un timestamp
    if (!msg.timestamp) {
      msg.timestamp = Date.now() - (currentChatAbbonamento.messaggiChat.length - index) * 60000;
    }
    
    // 📱 Inizializza stati WhatsApp per messaggi legacy
    if (!msg.status) {
      msg.status = msg.sender === loggedInUser.username ? 'sent' : 'delivered';
    }
    
    const p = document.createElement('p');
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
    
    // Testo del messaggio
    const messageText = document.createElement('span');
    messageText.className = 'message-text';
    messageText.textContent = `${msg.sender}: ${msg.text}`;
    
    p.className = msg.sender === loggedInUser.username ? 'sent' : 'received';
    p.appendChild(messageText);
    
    // 📱 Aggiungi spunte e timestamp per messaggi inviati
    if (msg.sender === loggedInUser.username) {
      const statusContainer = document.createElement('div');
      statusContainer.className = 'message-status';
      
      // Timestamp
      const timestamp = document.createElement('span');
      timestamp.className = 'message-timestamp';
      timestamp.textContent = new Date(msg.timestamp).toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Spunte
      const ticks = document.createElement('span');
      ticks.className = getTickClass(msg.status);
      ticks.textContent = getTickSymbol(msg.status);
      
      statusContainer.appendChild(timestamp);
      statusContainer.appendChild(ticks);
      p.appendChild(statusContainer);
      
    } else {
      // Timestamp per messaggi ricevuti
      const timestamp = document.createElement('div');
      timestamp.className = 'message-timestamp-received';
      timestamp.textContent = new Date(msg.timestamp).toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      p.appendChild(timestamp);
    }
    
    chatBox.appendChild(p);
    
    // Segna i messaggi ricevuti come letti quando la chat viene aperta
    if (msg.sender !== loggedInUser.username) {
      markMessageAsRead(currentChatAbbonamento.id, index);
    } else {
      // Per i messaggi che ho inviato, marcali come "read" se l'altro utente li ha visti
      // Simula che vengano letti dopo un po' (in un'app reale verrebbe dal server)
      setTimeout(() => {
        if (msg.status === 'delivered') {
          markMessageAsReadWhatsApp(msg, index);
        }
      }, 2000 + index * 500); // Delay progressivo per realismo
    }
  });

  // Pulsanti fissi sotto la barra input
  const chatActions = document.getElementById('chatActions');
  if (chatActions) chatActions.innerHTML = '';

  if (
    loggedInUser &&
    currentChatAbbonamento.utente === loggedInUser.username &&
    currentChatAbbonamento.inTrattativa === true &&
    currentChatAbbonamento.buyerName
  ) {
    if (chatActions) {
      chatActions.innerHTML = `
        <button class="btn-accept" onclick="accettaProposta('${currentChatAbbonamento.id}')">Accetta</button>
        <button class="btn-reject" onclick="rifiutaProposta('${currentChatAbbonamento.id}')">Rifiuta</button>
      `;
    }
  }
  chatBox.scrollTop = chatBox.scrollHeight;
  
  // Aggiorna il contatore dopo aver segnato i messaggi come letti
  setTimeout(updateNotificationCount, 100);
}

function closeDatiVenditaModal() {
  const modal = document.getElementById('datiVenditaModal');
  if (modal) modal.style.display = 'none';
}

function closeChatModal() {
  console.log('📋 Chiusura modal chat');
  
  try {
    // 🔥 DISCONNETTI LISTENER REAL-TIME
    if (chatListener) {
      chatListener();
      chatListener = null;
      console.log('🔄 Listener chat disconnesso');
    }
    
    // Salva i dati dell'abbonamento in localStorage se presenti
    if (currentChatAbbonamento) {
      // Aggiorna l'array abbonamenti con i dati correnti
      const index = abbonamenti.findIndex(a => a.id === currentChatAbbonamento.id);
      if (index !== -1) {
        abbonamenti[index] = { ...abbonamenti[index], ...currentChatAbbonamento };
        localStorage.setItem('abbonamenti', JSON.stringify(abbonamenti));
        console.log('✅ Dati chat salvati in localStorage');
      }
    }
    
    const modal = document.getElementById('chatModal');
    if (modal) {
      modal.classList.remove('active');
    }
    
    // Pulisci le variabili
    currentChatAbbonamento = null;
    
    // Pulisci interfaccia
    const chatActions = document.getElementById('chatActions');
    if (chatActions) {
      chatActions.innerHTML = '';
    }
    
    console.log('✅ Modal chat chiuso e pulito');
    
  } catch (error) {
    console.error('❌ Errore nella chiusura chat:', error);
    // Forza la chiusura anche in caso di errore
    currentChatAbbonamento = null;
    const modal = document.getElementById('chatModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }
}

// --- STORICO PRENOTAZIONI MODERNO ---
let currentFilter = 'all';

function loadStorico() {
  const container = document.getElementById('storicoList');
  if (!container) return;

  if (!loggedInUser) {
    container.innerHTML = `
      <div class="storico-empty">
        <div class="storico-empty-icon">🔐</div>
        <h3>Login Richiesto</h3>
        <p>Effettua il login per vedere lo storico delle tue prenotazioni</p>
      </div>
    `;
    updateStoricoStats(0);
    return;
  }

  const meName = loggedInUser.username;

  // Partecipazioni dove sono venditore o acquirente
  const mine = (abbonamenti || []).filter(a => {
    const isSeller = (a.utente && a.utente === meName);
    const isBuyer  = (a.buyerName && a.buyerName === meName);
    return isSeller || isBuyer;
  });

  // Solo trattative concluse: venduto/confermato da entrambe le parti
  const concluded = mine.filter(a => {
    const stato = (a.stato || '').toLowerCase();
    const bothConfirmed = a.confermato === true || a.sellerConfirmed === true && a.buyerConfirmed === true;
    const sold = stato === 'venduto' || stato === 'confermato';
    const notAvailableSold = a.disponibile === false;
    return bothConfirmed || sold || notAvailableSold;
  });

  // Aggiorna statistiche
  updateStoricoStats(concluded.length);

  if (concluded.length === 0) {
    container.innerHTML = `
      <div class="storico-empty">
        <div class="storico-empty-icon">📋</div>
        <h3>Nessuna Transazione</h3>
        <p>Non hai ancora completato nessuna trattativa.<br/>
        Inizia a vendere o comprare abbonamenti!</p>
      </div>
    `;
    return;
  }

  // Ordina per data più recente
  concluded.sort((x,y)=> (y.lastPurchaseAt||y.timestamp||0) - (x.lastPurchaseAt||x.timestamp||0));

  // Applica filtro
  let filteredResults = concluded;
  if (currentFilter === 'vendite') {
    filteredResults = concluded.filter(a => a.utente === meName);
  } else if (currentFilter === 'acquisti') {
    filteredResults = concluded.filter(a => a.buyerName === meName);
  }

  renderStoricoItems(filteredResults, meName);
}

function renderStoricoItems(transactions, meName) {
  const container = document.getElementById('storicoList');
  
  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="storico-empty">
        <div class="storico-empty-icon">🔍</div>
        <h3>Nessun Risultato</h3>
        <p>Nessuna transazione trovata per il filtro selezionato.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  
  transactions.forEach(abbon => {
    const prezzo = prezziSettore[abbon.settore] || abbon.prezzo || '0';
    const label = abbon.matchDesc || 'Partita';
    const isVendita = (abbon.utente === meName);
    const role = isVendita ? 'vendita' : 'acquisto';
    const roleText = isVendita ? 'Venduto' : 'Acquistato';
    
    // Formatta la data
    const timestamp = abbon.lastPurchaseAt || abbon.timestamp || Date.now();
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const div = document.createElement('div');
    div.className = `storico-item ${role}`;
    
    // Header
    const header = document.createElement('div');
    header.className = 'storico-item-header';
    
    const matchInfo = document.createElement('div');
    matchInfo.className = 'match-info';
    
    const matchTitle = document.createElement('h3');
    matchTitle.className = 'match-title';
    matchTitle.textContent = `⚽ ${label}`;
    
    const matchDetails = document.createElement('p');
    matchDetails.className = 'match-details';
    matchDetails.textContent = `Settore ${abbon.settore || 'N/D'}`;
    
    matchInfo.appendChild(matchTitle);
    matchInfo.appendChild(matchDetails);
    
    const transactionBadge = document.createElement('div');
    transactionBadge.className = `transaction-badge ${role}`;
    transactionBadge.textContent = roleText;
    
    header.appendChild(matchInfo);
    header.appendChild(transactionBadge);
    
    // Body
    const body = document.createElement('div');
    body.className = 'storico-item-body';
    
    // Prezzo
    const priceGroup = document.createElement('div');
    priceGroup.className = 'info-group';
    priceGroup.innerHTML = `
      <span class="info-label">💰 Prezzo</span>
      <span class="info-value price-value">€ ${formatPriceWithComma(prezzo)}</span>
    `;
    
    // Data
    const dateGroup = document.createElement('div');
    dateGroup.className = 'info-group';
    dateGroup.innerHTML = `
      <span class="info-label">📅 Data</span>
      <span class="info-value date-value">${dateStr}</span>
    `;
    
    // Ora
    const timeGroup = document.createElement('div');
    timeGroup.className = 'info-group';
    timeGroup.innerHTML = `
      <span class="info-label">⏰ Ora</span>
      <span class="info-value date-value">${timeStr}</span>
    `;
    
    // Utente con rating
    const userGroup = document.createElement('div');
    userGroup.className = 'info-group';
    
    const userLabel = document.createElement('span');
    userLabel.className = 'info-label';
    userLabel.textContent = isVendita ? '👤 Acquirente' : '👤 Venditore';
    
    const userValue = document.createElement('span');
    userValue.className = 'info-value';
    
    const username = isVendita ? (abbon.buyerName || 'N/D') : (abbon.utente || 'N/D');
    if (username !== 'N/D') {
      const userBadge = createUserBadgeWithRating(username, true, 'storico', abbon.id);
      userValue.appendChild(userBadge);
    } else {
      userValue.textContent = 'N/D';
    }
    
    userGroup.appendChild(userLabel);
    userGroup.appendChild(userValue);
    
    body.appendChild(priceGroup);
    body.appendChild(dateGroup);
    body.appendChild(timeGroup);
    body.appendChild(userGroup);
    
    div.appendChild(header);
    div.appendChild(body);
    
    container.appendChild(div);
  });
}

function updateStoricoStats(count) {
  const totalEl = document.getElementById('totalTransactions');
  if (totalEl) {
    totalEl.textContent = count;
  }
}

// Sistema di filtri
function initStoricoFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Rimuovi active da tutti
      filterBtns.forEach(b => b.classList.remove('active'));
      
      // Aggiungi active al clickato
      btn.classList.add('active');
      
      // Aggiorna filtro corrente
      currentFilter = btn.dataset.filter;
      
      // Ricarica lista
      loadStorico();
    });
  });
}

// Inizializza filtri quando la pagina è pronta
document.addEventListener('DOMContentLoaded', () => {
  initStoricoFilters();
});

function loadStoricoList() {
  const container = document.getElementById('storicoList');
  if (!container) return;
  container.innerHTML = '';

  if (!loggedInUser) {
    container.innerHTML = '<p>Devi effettuare il login per vedere lo storico.</p>';
    return;
  }

  // Filtra abbonamenti venduti o acquistati andati a buon fine
  const storico = abbonamenti.filter(a =>
    a.stato === 'venduto' &&
    (a.utente === loggedInUser.username || a.buyerName === loggedInUser.username)
  );

  if (storico.length === 0) {
    container.innerHTML = '<p>Nessun abbonamento venduto o acquistato.</p>';
    return;
  }

  storico.forEach(abbon => {
    // Data e ora della vendita/acquisto (usa la proprietà abbon.dataVendita se presente, altrimenti mostra "Data non disponibile")
    const dataVendita = abbon.dataVendita ? abbon.dataVendita : 'Data non disponibile';
    const tipo = abbon.utente === loggedInUser.username ? 'Vendita' : 'Acquisto';
    const controparte = tipo === 'Vendita' ? abbon.buyerName : abbon.utente;
    
    // Crea elemento DOM invece di innerHTML per includere rating
    const storicoItem = document.createElement('div');
    storicoItem.className = 'storico-item';
    
    const matchTitle = document.createElement('strong');
    matchTitle.textContent = abbon.matchDesc;
    storicoItem.appendChild(matchTitle);
    storicoItem.appendChild(document.createElement('br'));
    
    // Container per tipo e controparte
    const tipoContainer = document.createElement('div');
    tipoContainer.style.display = 'flex';
    tipoContainer.style.alignItems = 'center';
    tipoContainer.style.gap = '10px';
    tipoContainer.style.marginBottom = '5px';
    
    const tipoSpan = document.createElement('span');
    tipoSpan.textContent = `${tipo} - `;
    tipoContainer.appendChild(tipoSpan);
    
    if (controparte) {
      const controporteBadge = createUserBadgeWithRating(controparte, true);
      tipoContainer.appendChild(controporteBadge);
    }
    
    storicoItem.appendChild(tipoContainer);
    
    const insertionSpan = document.createElement('span');
    insertionSpan.className = 'insertion-date';
    insertionSpan.textContent = formatInsertionDateTime(abbon.timestamp);
    storicoItem.appendChild(insertionSpan);
    storicoItem.appendChild(document.createElement('br'));
    
    const dataVenditaSpan = document.createElement('span');
    dataVenditaSpan.textContent = `Data vendita: ${dataVendita}`;
    storicoItem.appendChild(dataVenditaSpan);
    
    container.appendChild(storicoItem);
  });
}

// --- Il tuo abbonamento ---
function loadMySubscription() {
  // 🔔 Aggiorna badge trattative quando si accede alla sezione
  updateTrattativeNotifications();
  
  const container = document.getElementById('mySubscriptionContent');
  if (!container) return;

  if (!loggedInUser) {
    container.innerHTML = '<p>Devi effettuare il login per vedere le tue trattative.</p>';
    return;
  }

  // Trattative dove sei venditore
  const mieVendite = abbonamenti.filter(a => a.utente === loggedInUser.username && a.disponibile === true);

  // Trattative dove sei acquirente
  const mieAcquisti = abbonamenti.filter(a => a.buyerName === loggedInUser.username && a.inTrattativa === true && a.disponibile === true);

  container.innerHTML = '';

  // Sezioni venditore
  mieVendite.forEach(abbon => {
    const prezzo = prezziSettore[abbon.settore] || 'N/A';
    
    // Determina lo stato e il badge
    const haMessaggi = abbon.messaggiChat && abbon.messaggiChat.length > 0;
    const inTrattativa = abbon.inTrattativa === true || haMessaggi;
    const badgeClass = inTrattativa ? 'badge-trattativa' : 'badge-vendita';
    const badgeText = inTrattativa ? 'IN TRATTATIVA' : 'IN VENDITA';
    
    container.innerHTML += `
      <div class="abbo-card">
        <div class="card-header">
          <h3>${abbon.matchDesc}</h3>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        <p>Settore: ${abbon.settore} - Prezzo: € ${formatPriceWithComma(prezzo)}</p>
        <p class="insertion-date">${formatInsertionDateTime(abbon.timestamp)}</p>
        <p class="role-indicator"><strong>Ruolo:</strong> Venditore</p>
        <div class="row-actions">
          <button class="btn-open-chat" onclick="openChatModal('${abbon.id}')">Chat</button>
          <button class="btn-cancel-sale" onclick="annullaTrattativa('${abbon.id}')">Annulla/Cancella</button>
        </div>
      </div>
    `;
  });

  // Sezioni acquirente
  mieAcquisti.forEach(abbon => {
    const prezzo = prezziSettore[abbon.settore] || 'N/A';
    
    container.innerHTML += `
      <div class="abbo-card">
        <div class="card-header">
          <h3>${abbon.matchDesc}</h3>
          <span class="badge badge-trattativa">IN TRATTATIVA</span>
        </div>
        <p>Settore: ${abbon.settore} - Prezzo: € ${formatPriceWithComma(prezzo)}</p>
        <p class="insertion-date">${formatInsertionDateTime(abbon.timestamp)}</p>
        <p class="role-indicator"><strong>Ruolo:</strong> Acquirente</p>
        <div class="row-actions">
          <button class="btn-open-chat" onclick="openChatModal('${abbon.id}')">Chat</button>
          <button class="btn-cancel-sale" onclick="annullaAcquisto('${abbon.id}')">Annulla acquisto</button>
        </div>
      </div>
    `;
  });

  if (container.innerHTML === '') {
    container.innerHTML = '<p>Nessuna trattativa aperta al momento.</p>';
  }
}

// --- SISTEMA NOTIFICHE AVANZATO ---
let notificationDropdownOpen = false;
let userReadMessages = SafeStorage.get('userReadMessages', {});

// Inizializza i messaggi letti per l'utente corrente
function initUserReadMessages() {
  if (!loggedInUser) return;
  if (!userReadMessages[loggedInUser.username]) {
    userReadMessages[loggedInUser.username] = {};
  }
}

// Segna un messaggio come letto
function markMessageAsRead(abbonamentoId, messageIndex) {
  if (!loggedInUser) return;
  initUserReadMessages();
  
  if (!userReadMessages[loggedInUser.username][abbonamentoId]) {
    userReadMessages[loggedInUser.username][abbonamentoId] = [];
  }
  
  if (!userReadMessages[loggedInUser.username][abbonamentoId].includes(messageIndex)) {
    userReadMessages[loggedInUser.username][abbonamentoId].push(messageIndex);
    SafeStorage.set('userReadMessages', userReadMessages);
    updateNotificationCount();
  }
}

// Controlla se un messaggio è già letto
function isMessageRead(abbonamentoId, messageIndex) {
  if (!loggedInUser) return false;
  initUserReadMessages();
  
  const userMessages = userReadMessages[loggedInUser.username][abbonamentoId];
  return userMessages && userMessages.includes(messageIndex);
}

// Conta i messaggi non letti
function getUnreadCount() {
  if (!loggedInUser) return 0;
  
  let count = 0;
  abbonamenti.forEach(abbon => {
    if (!abbon.messaggiChat) return;
    
    abbon.messaggiChat.forEach((msg, index) => {
      // Conta solo messaggi ricevuti (non inviati dall'utente corrente) e non letti
      if (msg.sender !== loggedInUser.username && !isMessageRead(abbon.id, index)) {
        count++;
      }
    });
  });
  
  return count;
}

// Aggiorna il contatore delle notifiche
function updateNotificationCount() {
  if (!loggedInUser) return;

  const notificationBadge = document.getElementById('notificationCount');
  const count = getUnreadCount();

  if (count > 0) {
    notificationBadge.textContent = count > 99 ? '99+' : count;
    notificationBadge.classList.add('show');
  } else {
    notificationBadge.classList.remove('show');
  }
  
  // Aggiorna anche la lista delle notifiche se è aperta
  if (notificationDropdownOpen) {
    populateNotificationList();
  }
}

// Pulisce il contatore
function clearNotificationCount() {
  const notificationBadge = document.getElementById('notificationCount');
  if (notificationBadge) {
    notificationBadge.classList.remove('show');
    notificationBadge.textContent = '';
  }
}

// Apri/chiudi dropdown notifiche
function openNotifications() {
  if (!loggedInUser) {
    alert('Devi effettuare il login per aprire le notifiche.');
    toggleModal(true);
    return;
  }

  const dropdown = document.getElementById('notificationDropdown');
  notificationDropdownOpen = !notificationDropdownOpen;
  
  if (notificationDropdownOpen) {
    dropdown.style.display = 'block';
    populateNotificationList();
    // Chiudi se si clicca fuori
    setTimeout(() => {
      document.addEventListener('click', closeNotificationsOnClickOutside);
    }, 100);
  } else {
    dropdown.style.display = 'none';
    document.removeEventListener('click', closeNotificationsOnClickOutside);
  }
}

// Chiudi dropdown se si clicca fuori
function closeNotificationsOnClickOutside(event) {
  const bell = document.getElementById('notificationBell');
  const dropdown = document.getElementById('notificationDropdown');
  
  if (!bell.contains(event.target) && !dropdown.contains(event.target)) {
    dropdown.style.display = 'none';
    notificationDropdownOpen = false;
    document.removeEventListener('click', closeNotificationsOnClickOutside);
  }
}

// Popola la lista delle notifiche
function populateNotificationList() {
  const notificationList = document.getElementById('notificationList');
  
  // Raccogli tutti i messaggi con metadati
  let allNotifications = [];
  
  abbonamenti.forEach(abbon => {
    if (!abbon.messaggiChat || abbon.messaggiChat.length === 0) return;
    
    abbon.messaggiChat.forEach((msg, index) => {
      // Solo messaggi ricevuti (non inviati dall'utente corrente)
      if (msg.sender !== loggedInUser.username) {
        const isRead = isMessageRead(abbon.id, index);
        allNotifications.push({
          abbonamento: abbon,
          message: msg,
          messageIndex: index,
          isRead: isRead,
          timestamp: msg.timestamp || Date.now()
        });
      }
    });
  });
  
  // Ordina per timestamp (più recenti prima)
  allNotifications.sort((a, b) => b.timestamp - a.timestamp);
  
  if (allNotifications.length === 0) {
    notificationList.innerHTML = '<div class="no-notifications">Nessun nuovo messaggio</div>';
    return;
  }
  
  // Crea HTML per le notifiche
  let html = '';
  allNotifications.forEach(notif => {
    const timeString = formatNotificationTime(notif.timestamp);
    const isUnread = !notif.isRead;
    
    html += `
      <div class="notification-item ${isUnread ? 'unread' : ''}" 
           onclick="openChatFromNotification('${notif.abbonamento.id}', ${notif.messageIndex})">
        <div class="notification-item-header">
          <h4 class="notification-match">${notif.abbonamento.matchDesc}</h4>
          <span class="notification-time">${timeString}</span>
        </div>
        <p class="notification-message">
          <span class="notification-sender">${notif.message.sender}:</span>
          ${truncateMessage(notif.message.text, 60)}
        </p>
      </div>
    `;
  });
  
  notificationList.innerHTML = html;
}

// Apri chat da notifica e segna come letta
function openChatFromNotification(abbonamentoId, messageIndex) {
  const abbon = abbonamenti.find(a => a.id === abbonamentoId);
  if (!abbon) return;
  
  // Segna il messaggio come letto
  markMessageAsRead(abbonamentoId, messageIndex);
  
  // Apri la chat
  currentChatAbbonamento = abbon;
  document.getElementById('chatModal').classList.add('active');
  loadChatMessages();
  
  // Chiudi il dropdown
  document.getElementById('notificationDropdown').style.display = 'none';
  notificationDropdownOpen = false;
  document.removeEventListener('click', closeNotificationsOnClickOutside);
}

// Segna tutti i messaggi come letti
function markAllAsRead() {
  if (!loggedInUser) return;
  
  abbonamenti.forEach(abbon => {
    if (!abbon.messaggiChat) return;
    
    abbon.messaggiChat.forEach((msg, index) => {
      if (msg.sender !== loggedInUser.username) {
        markMessageAsRead(abbon.id, index);
      }
    });
  });
  
  updateNotificationCount();
  populateNotificationList();
}

// Formatta il tempo per le notifiche
function formatNotificationTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'Adesso';
  if (minutes < 60) return `${minutes}m fa`;
  if (hours < 24) return `${hours}h fa`;
  if (days < 7) return `${days}g fa`;
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

// Tronca messaggio per anteprima
function truncateMessage(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// "Il mio abbonamento" cliccabile
const ticketSection = document.getElementById('ticket');
if(ticketSection){
  ticketSection.onclick = () => showSection('mySubscription');
}

// -------- PROSSIMA PARTITA IN CASA CON COUNTDOWN --------
function displayNextMatch() {
  const nextMatchSection = document.getElementById('nextMatchSection');
  if (!nextMatchSection) return;
  
  const match = getNextHomeMatch();
  
  if (!match) {
    nextMatchSection.style.display = 'none';
    return;
  }

  nextMatchSection.style.display = 'block';

  // Precarica i loghi locali dalla cartella /img basandosi sui nomi delle squadre nella descrizione
  const [homeName, awayName] = (match.description || '').split('-').map(s => s.trim());
  const localUrls = [getLogoSrcByTeamName(homeName || 'genoa'), getLogoSrcByTeamName(awayName || '')];

  ['homeTeamLogo','awayTeamLogo'].forEach((id, idx) => {
    const el = document.getElementById(id);
    if (el) {
      const url = localUrls[idx];
      const img = new Image();
      img.onload = () => { el.style.backgroundImage = `url(${url})`; };
      img.onerror = () => { el.style.backgroundImage = ''; };
      img.src = url;
    }
  });
  // Descrizione partita con evidenziazione BIG MATCH per Genoa-Inter
  const descEl = document.getElementById('matchDescription');
  if (descEl) {
    // 🔥 Evidenzia BIG MATCH Genoa-Inter
    if (/^\s*genoa\s*-\s*inter\s*$/i.test(match.description.trim())) {
      descEl.innerHTML = `🔥⚽ <span style="color: #c8102e; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">BIG MATCH:</span> ${match.description} 🎄🔥`;
      
      // Aggiungi classe speciale per styling extra
      nextMatchSection.classList.add('big-match-inter');
      
      // Effetto speciale per il countdown
      const countdownEl = document.getElementById('countdown');
      if (countdownEl) {
        countdownEl.style.background = 'linear-gradient(45deg, #c8102e, #ffd700)';
        countdownEl.style.boxShadow = '0 0 20px rgba(200,16,46,0.5), 0 0 40px rgba(255,215,0,0.3)';
        countdownEl.style.animation = 'pulse 2s infinite';
      }
    } else {
      descEl.textContent = match.description;
      // Rimuovi classe speciale se non è Genoa-Inter
      nextMatchSection.classList.remove('big-match-inter');
    }
  }

  // Data e ora leggibile
  const dtText = `${formatDate(match.date)} ore ${match.time}`;
  const dtEl = document.getElementById('matchDateTime');
  if (dtEl) dtEl.textContent = dtText;

  // Avvia countdown
  startCountdown(match.date, match.time);
  
  // Aggiorna anche la sezione statica "PROSSIMA PARTITA IN CASA"
  updateUpcomingMatchSection(match);
}

// Aggiorna la sezione "PROSSIMA PARTITA IN CASA" (quella statica in basso)
function updateUpcomingMatchSection(match) {
  if (!match) return;
  
  const teamsEl = document.querySelector('.upcoming-teams');
  const datetimeEl = document.querySelector('.upcoming-datetime');
  const rightLogoEl = document.querySelector('.upcoming-team-right img');
  
  if (teamsEl) {
    teamsEl.textContent = match.description.replace(' - ', ' - ').toUpperCase();
  }
  
  if (datetimeEl) {
    const dateFormatted = formatDate(match.date);
    datetimeEl.textContent = `${dateFormatted} ore ${match.time}`;
  }
  
  if (rightLogoEl) {
    const awayTeam = match.description.split(' - ')[1]?.trim();
    if (awayTeam) {
      rightLogoEl.src = getLogoSrcByTeamName(awayTeam);
      rightLogoEl.alt = `Logo ${awayTeam}`;
    }
  }
}

function getNextHomeMatch() {
  const now = new Date();
  const sorted = upcomingMatches.slice().sort((a,b) => new Date(a.date) - new Date(b.date));
  
  for(const match of sorted){
    const matchDateTime = new Date(match.date + "T" + match.time + ":00");
    if(matchDateTime > now) {
      console.log(`🏟️ Prossima partita: ${match.description} - ${match.date} ${match.time}`);
      return match;
    }
  }
  return null;
}

let countdownInterval = null;

function startCountdown(dateStr, timeStr){
  if(countdownInterval){
    clearInterval(countdownInterval);
  }
  const countdownEl = document.getElementById('countdown');
  function update(){
    const now = new Date();
    const target = new Date(dateStr + "T" + timeStr + ":00");
    const diff = target - now;

    if(diff <= 0){
      if (countdownEl) countdownEl.textContent = "Partita in corso o già giocata";
      clearInterval(countdownInterval);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    if (countdownEl) countdownEl.textContent = `${days}g ${hours}h ${minutes}m ${seconds}s`;
  }
  update();
  countdownInterval = setInterval(update, 1000);
}

// --- Init affidabile ---
function initApp(){
  updateLoginLogoutButtons();
  
  // Mostra sempre la campanella
  const bell = document.getElementById('notificationBell');
  if (bell) {
    bell.style.display = 'flex';
    
    if(loggedInUser){
      updateNotificationCount();
      bell.style.opacity = '1';
      bell.style.cursor = 'pointer';
    } else {
      // Campanella visibile ma disabilitata quando non loggati
      bell.style.opacity = '0.5';
      bell.style.cursor = 'not-allowed';
      clearNotificationCount();
    }
  }
  
  if(!loggedInUser) {
    toggleModal(true); // mostra login all'apertura se non loggato
  }
  
  populateMatchSelect();
  populateSectorSelect();
  displayNextMatch();
}

// Avvio appena il DOM è pronto
document.addEventListener('DOMContentLoaded', initApp);

// --- Data/Ora live in header ---
function updateLiveDateTime(){
  const el = document.getElementById('liveDateTime');
  if(!el) return;
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(now);
  const timeStr = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(now);
  el.textContent = `${dateStr} - ${timeStr}`;
}

// --- Controllo timeout trattative (24 ore) ---
function checkTrattativeTimeout() {
  console.log('🕒 Controllo timeout trattative in corso...');
  
  const now = Date.now();
  const TIMEOUT_24H = 24 * 60 * 60 * 1000; // 24 ore in millisecondi
  let modificati = false;
  
  abbonamenti.forEach((abbon, index) => {
    // Controlla solo abbonamenti in trattativa con timestamp valido
    if (abbon.inTrattativa && abbon.trattativaStartTime) {
      const tempoTrascorso = now - abbon.trattativaStartTime;
      
      if (tempoTrascorso > TIMEOUT_24H) {
        // Controlla se ci sono messaggi nella chat
        const hasMessages = abbon.messaggiChat && abbon.messaggiChat.length > 0;
        
        if (!hasMessages) {
          console.log(`⏰ Timeout per abbonamento ${abbon.id} - nessun messaggio in 24h`);
          
          // Reset dello stato
          abbon.inTrattativa = false;
          abbon.buyerName = null;
          abbon.trattativaStartTime = null;
          abbon.messaggiChat = [];
          
          modificati = true;
          
          // Mostra notifica se la sezione abbonamenti è attiva
          if (document.querySelector('.section.active')?.id === 'abbonamenti-section') {
            showToast(`L'abbonamento per ${abbon.matchDesc} è tornato disponibile (timeout 24h)`, 'info');
          }
        }
      }
    }
  });
  
  if (modificati) {
    SafeStorage.setItem('abbonamenti', abbonamenti);
    console.log('💾 Abbonamenti aggiornati dopo timeout check');
    
    // Aggiorna la UI se siamo nella sezione abbonamenti
    if (document.querySelector('.section.active')?.id === 'abbonamenti-section') {
      displayAbbonamenti();
    }
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  updateLiveDateTime();
  setInterval(updateLiveDateTime, 1000);
  
  // Controllo timeout ogni 5 minuti
  checkTrattativeTimeout(); // Controllo iniziale
  setInterval(checkTrattativeTimeout, 5 * 60 * 1000); // Ogni 5 minuti
  
  // 🔔 Aggiorna notifiche trattative ogni 2 minuti (se loggato) - ridotto per performance
  setInterval(() => {
    if (loggedInUser) {
      updateTrattativeNotifications();
    }
  }, 120000); // Ogni 2 minuti invece di 30 secondi
});

// Handler acquisto locale
window.handleAcquista = function(id){
  console.log('🎯 handleAcquista chiamata con ID:', id);
  console.log('👤 Utente loggato:', loggedInUser);
  console.log('📦 Abbonamenti disponibili:', abbonamenti.length);
  
  if (!loggedInUser) {
    alert('Devi effettuare il login per aprire la trattativa.');
    toggleModal(true);
    return;
  }
  
  const abbon = abbonamenti.find(a => a.id === id);
  console.log('🎫 Abbonamento trovato:', abbon);
  if (!abbon) {
    console.error('❌ Abbonamento non trovato per ID:', id);
    return;
  }
  
  // 🔧 INIZIALIZZAZIONE SICURA CHAT
  const safAbbon = initializeChatSafely(abbon);
  
  // Se non sei già in trattativa
  if (!safAbbon.buyerName) {
    safAbbon.buyerName = loggedInUser.username;
    safAbbon.inTrattativa = true;
    safAbbon.trattativaStartTime = Date.now(); // 🕒 Salva timestamp
    safAbbon.trattativaExpiresAt = Date.now() + (5 * 60 * 60 * 1000); // 5 ore
    
    // 🚀 AGGIORNAMENTO UI IMMEDIATO
    SafeStorage.setItem('abbonamenti', abbonamenti);
    
    // 🚀 Aggiorna badge immediatamente (senza attendere il re-render completo)
    updateBadgesOnly();
    
    // 🔄 Aggiorna tutte le sezioni contemporaneamente
    const updatePromises = [Promise.resolve(loadHomeListings())];
    
    // Aggiorna anche la sezione abbonamenti se attiva
    const activeSection = document.querySelector('.section.active');
    if (activeSection?.id === 'abbonamenti-section') {
      updatePromises.push(Promise.resolve(displayAbbonamenti()));
    }
    
    updatePromises.push(Promise.resolve(aggiornaTrattative()));
    
    Promise.all(updatePromises).then(() => {
      console.log('🚀 UI aggiornata per nuova trattativa');
      
      // 🔔 Aggiorna notifiche trattative e attiva lampeggiamento
      updateTrattativeNotifications();
      blinkTrattativeButton(3000);
      
      openChatModal(id);
    });
    
    // Firebase opzionale in background (non blocca)
    setTimeout(() => {
      try {
        updateAbbonamentoFirebase(abbon).catch(() => {});
      } catch (e) {}
    }, 50); // 🚀 Ridotto da 100ms a 50ms per maggiore reattività
  } else {
    openChatModal(id);
    aggiornaTrattative();
  }
};

// Handler contatto venditore
window.handleContactSeller = function(id) {
  console.log('📞 handleContactSeller chiamata con ID:', id);
  
  if (!loggedInUser) {
    showToast('❌ Devi effettuare il login per contattare il venditore', 'error');
    toggleModal(true);
    return;
  }
  
  const abbon = abbonamenti.find(a => a.id === id);
  if (!abbon) {
    showToast('❌ Abbonamento non trovato', 'error');
    return;
  }
  
  if (abbon.utente === loggedInUser.username) {
    showToast('❌ Non puoi contattare te stesso!', 'error');
    return;
  }
  
  // 🔧 INIZIALIZZAZIONE SICURA TRATTATIVA 
  const safAbbon = initializeChatSafely(abbon);
  
  // Se non sei già in trattativa, avvia la trattativa (ma NON apre chat)
  if (!safAbbon.buyerName) {
    safAbbon.buyerName = loggedInUser.username;
    safAbbon.inTrattativa = true;
    safAbbon.trattativaStartTime = Date.now();
    safAbbon.trattativaExpiresAt = Date.now() + (5 * 60 * 60 * 1000); // 5 ore
    
    // 🚀 AGGIORNAMENTO UI IMMEDIATO
    SafeStorage.setItem('abbonamenti', abbonamenti);
    
    // 🚀 Aggiorna badge immediatamente
    updateBadgesOnly();
    
    // 🔄 Aggiorna tutte le sezioni contemporaneamente
    const updatePromises = [Promise.resolve(loadHomeListings())];
    
    // Aggiorna anche la sezione abbonamenti se attiva
    const activeSection = document.querySelector('.section.active');
    if (activeSection?.id === 'abbonamenti-section') {
      updatePromises.push(Promise.resolve(displayAbbonamenti()));
    }
    
    updatePromises.push(Promise.resolve(aggiornaTrattative()));
    
    Promise.all(updatePromises).then(() => {
      console.log('🚀 UI aggiornata per nuovo contatto venditore');
      
      // 🔔 Aggiorna notifiche trattative
      updateTrattativeNotifications();
      blinkTrattativeButton(3000);
    });
    
    // Firebase opzionale in background
    setTimeout(() => {
      try {
        updateAbbonamentoFirebase(abbon).catch(() => {});
      } catch (e) {}
    }, 50);
  }
  
  // 📞 APRI SEMPRE SOLO IL MODAL CONTATTI (non la chat)
  openContactSellerModal(abbon);
};

// Funzioni modal contatta venditore
function openContactSellerModal(abbonamento) {
  console.log('🔍 Apertura modal contatta venditore per:', abbonamento);
  
  const modal = document.getElementById('contactSellerModal');
  const sellerName = document.getElementById('contactSellerName');
  const sellerMatch = document.getElementById('contactSellerMatch');
  const sellerRating = document.getElementById('contactSellerRating');
  const contactOptions = document.getElementById('contactOptions');
  
  // Verifica che tutti gli elementi esistano
  if (!modal || !sellerName || !sellerMatch || !sellerRating || !contactOptions) {
    console.error('❌ Elementi modal non trovati:', {
      modal: !!modal,
      sellerName: !!sellerName, 
      sellerMatch: !!sellerMatch,
      sellerRating: !!sellerRating,
      contactOptions: !!contactOptions
    });
    return;
  }
  
  // Popola i dettagli del venditore
  sellerName.textContent = abbonamento.utente;
  sellerMatch.textContent = `${abbonamento.matchDesc} - Settore: ${abbonamento.settore}`;
  console.log('✅ Dati venditore popolati:', abbonamento.utente, abbonamento.matchDesc);
  
  // 🌟 Popola il rating del venditore
  sellerRating.innerHTML = '';
  const sellerRatingDisplay = createStarsDisplay(
    ...Object.values(getUserRating(abbonamento.utente)),
    true // compact version
  );
  sellerRating.appendChild(sellerRatingDisplay);
  
  // Popola le opzioni di contatto
  contactOptions.innerHTML = '';
  console.log('📞 Popolando opzioni contatto:', {
    phone: abbonamento.phoneConfirmed,
    email: abbonamento.emailConfirmed
  });
  
  let hasContact = false;
  
  // Telefono
  if (abbonamento.phoneConfirmed && abbonamento.phoneConfirmed.trim()) {
    const phoneOption = createContactOption('📱', 'Telefono', abbonamento.phoneConfirmed, `tel:${abbonamento.phoneConfirmed}`);
    contactOptions.appendChild(phoneOption);
    hasContact = true;
  }
  
  // Email
  if (abbonamento.emailConfirmed && abbonamento.emailConfirmed.trim()) {
    const emailOption = createContactOption('📧', 'Email', abbonamento.emailConfirmed, `mailto:${abbonamento.emailConfirmed}`);
    contactOptions.appendChild(emailOption);
    hasContact = true;
  }
  
  // Se non ci sono contatti disponibili
  if (!hasContact) {
    contactOptions.innerHTML = `
      <div class="contact-option-modern" style="justify-content: center; text-align: center; padding: 24px; border: 2px dashed #ffc107; background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);">
        <div class="contact-icon-modern" style="background: linear-gradient(135deg, #ff9800 0%, #f57f17 100%);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        </div>
        <div class="contact-details-modern" style="text-align: center;">
          <span class="contact-label-modern" style="color: #e65100;">Nessun contatto diretto</span>
          <span style="color: #bf360c; font-weight: 500; font-size: 0.95em; display: block; margin-top: 4px;">
            Utilizza la chat interna per avviare una trattativa
          </span>
        </div>
      </div>
    `;
  }
  
  // Memorizza l'ID abbonamento per la funzione di trattativa
  modal.setAttribute('data-abbonamento-id', abbonamento.id);
  
  modal.style.display = 'flex';
}

function createContactOption(icon, label, value, href) {
  const option = document.createElement('div');
  option.className = 'contact-option-modern';
  
  // Determina l'icona SVG basata sul tipo
  let svgIcon = '';
  if (label === 'Telefono') {
    svgIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </svg>`;
  } else if (label === 'Email') {
    svgIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>`;
  }
  
  option.innerHTML = `
    <div class="contact-icon-modern">${svgIcon}</div>
    <div class="contact-details-modern">
      <span class="contact-label-modern">${label}</span>
      <a href="${href}" class="contact-value-modern">${value}</a>
    </div>
    <button class="contact-action-modern" onclick="window.open('${href}', '_blank')" title="Apri ${label}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
      </svg>
    </button>
  `;
  
  return option;
}

function closeContactSellerModal() {
  const modal = document.getElementById('contactSellerModal');
  modal.style.display = 'none';
  modal.removeAttribute('data-abbonamento-id');
}

function openChatAlternative() {
  const modal = document.getElementById('contactSellerModal');
  const abbonamentoId = modal.getAttribute('data-abbonamento-id');
  
  if (abbonamentoId) {
    closeContactSellerModal();
    handleAcquista(abbonamentoId);
  }
}

// Trattative
function apriTrattativa(partita) {
  // Aggiungi la trattativa solo se non già presente
  if (!trattative.includes(partita)) {
    trattative.push(partita);
    aggiornaTrattative();
  }
  // Mostra badge aggiornato
  document.getElementById('mySubBadge').style.display = 'inline-block';
  document.getElementById('mySubBadge').textContent = trattative.length;
}

function aggiornaTrattative() {
  const container = document.getElementById('mySubscriptionContent');
  container.innerHTML = '';
  trattative.forEach((t) => {
    const div = document.createElement('div');
    div.className = 'trattativa-item';
    div.textContent = t;
    container.appendChild(div);
  });
}

function annullaTrattativa(id) {
  console.log('🗑️ annullaTrattativa chiamata con ID:', id);
  console.log('🔥 Firebase db disponibile:', !!db);
  
  // � Cancella SUBITO da localStorage (funziona sempre)
  abbonamenti = abbonamenti.filter(a => a.id !== id);
  localStorage.setItem('abbonamenti', JSON.stringify(abbonamenti));
  
  loadHomeListings();
  loadMySubscription();
  updateBookingCounter();
  alert('Trattativa annullata e abbonamento cancellato.');
  
  // Firebase opzionale in background
  setTimeout(() => {
    try {
      db.collection('abbonamenti').doc(id).delete().catch(() => {});
    } catch (e) {}
  }, 100);
}

function annullaAcquisto(id) {
  const abbon = abbonamenti.find(a => a.id === id);
  if (!abbon) return;
  
  // Rimuovi solo la trattativa dell'acquirente
  if (abbon.buyerName === loggedInUser.username) {
    abbon.buyerName = null;
    abbon.inTrattativa = false;
    
    // 🔥 Aggiorna Firebase
    updateAbbonamentoFirebase(abbon).then(() => {
      console.log('✅ Trattativa annullata su Firebase');
    }).catch(err => {
      console.error('❌ Errore aggiornamento Firebase:', err);
    });
    
    localStorage.setItem('abbonamenti', JSON.stringify(abbonamenti));
    loadMySubscription();
    updateBookingCounter();
    alert('Hai annullato la trattativa.');
  }
}

function accettaProposta(id) {
  const abbon = abbonamenti.find(a => a.id === id);
  if (!abbon) return;
  
  // Aggiorna stato abbonamento
  abbon.stato = 'venduto';
  abbon.disponibile = false;
  abbon.inTrattativa = false;
  abbon.trattativaStartTime = null; // 🕒 Reset timestamp
  abbon.sellerConfirmed = true;
  
  // L'acquirente è già stato impostato quando ha iniziato la chat
  if (abbon.buyerName && abbon.buyerName !== loggedInUser.username) {
    showToast(`🎫 Proposta accettata! Ora inserisci i tuoi dati di contatto per ${abbon.buyerName}.`, 'success');
  } else {
    showToast('🎉 Proposta accettata!', 'success');
  }
  
  // 🎉 EFFETTO CELEBRATIVO per vendita completata
  const statusBadges = document.querySelectorAll(`[data-abbonamento-id="${abbon.id}"] .badge-status`);
  statusBadges.forEach(badge => {
    badge.classList.add('status-sold');
    badge.classList.remove('status-available', 'status-negotiation');
    badge.textContent = 'VENDUTO';
    
    // Effetto celebrativo temporaneo
    badge.style.transform = 'scale(1.2)';
    badge.style.filter = 'brightness(1.3)';
    setTimeout(() => {
      badge.style.transform = '';
      badge.style.filter = '';
    }, 1000);
  });
  
  // 🚀 AGGIORNAMENTO UI IMMEDIATO (prima del salvataggio)
  SafeStorage.setItem('abbonamenti', abbonamenti);
  
  // 🚀 Aggiorna badge immediatamente (senza attendere il re-render completo)
  updateBadgesOnly();
  
  // 🔄 Aggiorna tutte le sezioni contemporaneamente
  const updatePromises = [
    Promise.resolve(loadHomeListings()),
    Promise.resolve(loadMySubscription())
  ];
  
  // Aggiorna anche la sezione abbonamenti se attiva
  const activeSection = document.querySelector('.section.active');
  if (activeSection?.id === 'abbonamenti-section') {
    updatePromises.push(Promise.resolve(displayAbbonamenti()));
  }
  
  // Aggiorna stats
  updatePromises.push(Promise.resolve(updateProfileStats()));
  
  // Esegue tutti gli aggiornamenti UI in parallelo
  Promise.all(updatePromises).then(() => {
    console.log('🚀 UI aggiornata immediatamente');
    
    // 🔔 Aggiorna conteggio trattative
    updateTrattativeNotifications();
    
    // 🔥 Aggiorna Firebase in background (non blocca la UI)
    updateAbbonamentoFirebase(abbon).then(() => {
      console.log('✅ Proposta accettata su Firebase');
    }).catch(err => {
      console.error('❌ Errore aggiornamento Firebase:', err);
    });
    
    // Apre modal dati vendita
    showSection('mySubscription');
    openDatiVenditaModal(abbon);
  });
  
  closeChatModal();
}

function rifiutaProposta(id) {
  const abbon = abbonamenti.find(a => a.id === id);
  if (!abbon) return;
  
  abbon.buyerName = null;
  abbon.inTrattativa = false;
  abbon.trattativaStartTime = null; // 🕒 Reset timestamp
  
  // 🚀 AGGIORNAMENTO UI IMMEDIATO (prima del salvataggio)
  SafeStorage.setItem('abbonamenti', abbonamenti);
  
  // 🔄 Aggiorna tutte le sezioni contemporaneamente
  const updatePromises = [
    Promise.resolve(loadHomeListings()),
    Promise.resolve(loadMySubscription())
  ];
  
  // Aggiorna anche la sezione abbonamenti se attiva
  const activeSection = document.querySelector('.section.active');
  if (activeSection?.id === 'abbonamenti-section') {
    updatePromises.push(Promise.resolve(displayAbbonamenti()));
  }
  
  // Esegue tutti gli aggiornamenti UI in parallelo
  Promise.all(updatePromises).then(() => {
    console.log('🚀 UI aggiornata immediatamente');
    
    // 🔔 Aggiorna conteggio trattative
    updateTrattativeNotifications();
    
    // 🔥 Aggiorna Firebase in background (non blocca la UI)
    updateAbbonamentoFirebase(abbon).then(() => {
      console.log('✅ Proposta rifiutata su Firebase');
    }).catch(err => {
      console.error('❌ Errore aggiornamento Firebase:', err);
    });
  });
  
  alert('Hai rifiutato la proposta. La trattativa è stata annullata.');
  closeChatModal();
}

// Nuove funzioni per inviare dati di vendita
function openDatiVenditaModal(abbon) {
  const modal = document.getElementById('datiVenditaModal');
  if (!modal) return;
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close" onclick="closeDatiVenditaModal()">×</span>
      <h2>Invia i tuoi dati all'acquirente</h2>
      <p>Per accordarti sul pagamento, invia i tuoi dati di contatto e scegli il metodo di pagamento preferito:</p>
      <form id="datiVenditaForm">
        <label>Email:</label>
        <input type="email" id="datiVenditaEmail" value="${loggedInUser.email}" required />
        
        <label>Telefono:</label>
        <input type="text" id="datiVenditaTelefono" value="${loggedInUser.telefono}" required />
        
        <label>Come vuoi ricevere il pagamento?</label>
        <select id="metodoPagamento" required>
          <option value="">-- Seleziona metodo di pagamento --</option>
          <option value="paypal">💰 PayPal</option>
          <option value="bonifico">🏦 Bonifico bancario</option>
          <option value="postepay">💳 Ricarica Postepay</option>
        </select>
        
        <button type="submit" class="btn-accept" style="background:#2ecc40;color:#fff;">Invia dati</button>
      </form>
    </div>
  `;
  modal.style.display = 'flex';

  document.getElementById('datiVenditaForm').onsubmit = function(e) {
    e.preventDefault();
    const email = document.getElementById('datiVenditaEmail').value;
    const telefono = document.getElementById('datiVenditaTelefono').value;
    const metodoPagamento = document.getElementById('metodoPagamento').value;
    
    // Mappa dei metodi di pagamento con descrizioni più dettagliate
    const metodiPagamento = {
      'paypal': '💰 PayPal',
      'bonifico': '🏦 Bonifico bancario', 
      'postepay': '💳 Ricarica Postepay'
    };
    
    const metodoPagamentoTesto = metodiPagamento[metodoPagamento] || metodoPagamento;
    
    // Salva i dati del venditore per l'acquirente (sistema ticket)
    if (abbon.buyerName) {
      const venditoreData = {
        telefono: telefono,
        email: email,
        paymentData: `${metodoPagamentoTesto} - ${email}`
      };
      
      savePurchaseToHistory(
        `${loggedInUser.nome} ${loggedInUser.cognome}`, 
        abbon, 
        venditoreData
      );
    }
    
    abbon.messaggiChat.push({
      sender: loggedInUser.username,
      text: `📋 Dati per il pagamento:
📧 Email: ${email}
📱 Telefono: ${telefono}
💰 Metodo di pagamento preferito: ${metodoPagamentoTesto}

Contattami per finalizzare la transazione!`
    });
    localStorage.setItem('abbonamenti', JSON.stringify(abbonamenti));
    closeDatiVenditaModal();
    alert('Dati inviati all\'acquirente tramite chat!');
    
    // ✅ Assicuriamoci che currentChatAbbonamento sia ancora valido prima di caricare i messaggi
    if (currentChatAbbonamento && currentChatAbbonamento.id === abbon.id) {
      loadChatMessages();
    } else {
      console.log('💬 Chat chiusa, non carico messaggi');
    }
  };
}

function closeDatiVenditaModal() {
  const modal = document.getElementById('datiVenditaModal');
  if (modal) modal.style.display = 'none';
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  if (!input || !currentChatAbbonamento || !loggedInUser) return;
  const text = input.value.trim();
  if (!text) return;
  
  // 🔧 INIZIALIZZAZIONE SICURA
  currentChatAbbonamento = initializeChatSafely(currentChatAbbonamento);
  
  const newMessage = {
    sender: loggedInUser.username,
    senderUID: loggedInUser.uid || loggedInUser.username, // Fallback UID
    text: text,
    timestamp: Date.now(),
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // ID univoco per prevenire duplicati
    // 📱 STATI WHATSAPP
    status: 'sent', // sent -> delivered -> read
    deliveredAt: null,
    readAt: null
  };
  
  // 🔧 CONTROLLO DUPLICATI prima di aggiungere
  const isDuplicate = currentChatAbbonamento.messaggiChat.some(msg => 
    msg.timestamp === newMessage.timestamp && 
    msg.sender === newMessage.sender && 
    msg.text === newMessage.text
  );
  
  if (!isDuplicate) {
    // Aggiungi messaggio locale
    // 🛡️ Inizializza messaggiChat se undefined
    if (!currentChatAbbonamento.messaggiChat) {
      currentChatAbbonamento.messaggiChat = [];
    }
    
    currentChatAbbonamento.messaggiChat.push(newMessage);
    
    // 🔔 NOTIFICA BROWSER per nuovo messaggio (se non è il mittente)
    if (newMessage.utente !== loggedInUser.username && areNotificationsEnabled()) {
      sendBrowserNotification(
        `💬 Nuovo messaggio da ${newMessage.utente}`,
        newMessage.testo.length > 50 ? newMessage.testo.substring(0, 50) + '...' : newMessage.testo,
        'img/genoa.png',
        () => {
          // Click notifica: apri chat
          showSection('trattative');
          setTimeout(() => {
            const tButton = document.querySelector(`[onclick="toggleTrattativa('${currentChatAbbonamento.id}')"]`);
            if (tButton) tButton.click();
          }, 500);
        }
      );
    }
    
    // ✅ Salva SUBITO su localStorage
    localStorage.setItem('abbonamenti', JSON.stringify(abbonamenti));
  } else {
    console.log('🚫 Messaggio duplicato evitato');
  }
  
  // 🔥 SALVATAGGIO FIREBASE (opzionale, singolo tentativo)
  if (db && db.collection && !isDuplicate) {
    try {
      await db.collection('abbonamenti').doc(currentChatAbbonamento.id).update({
        messaggiChat: firebase.firestore.FieldValue.arrayUnion(newMessage),
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Messaggio salvato su Firebase`);
    } catch (error) {
      console.log('📱 Firebase non disponibile, messaggio salvato localmente');
      // Non spam di errori - l'app funziona comunque
    }
  }
  
  input.value = '';
  loadChatMessages();
  updateNotificationCount();
  
  // 🔔 Aggiorna notifiche trattative (nuovo messaggio)
  updateTrattativeNotifications();
  
  // 📱 PROGRESSIONE STATI WHATSAPP
  // Simula delivery dopo 1 secondo
  setTimeout(() => {
    const messageIndex = currentChatAbbonamento.messaggiChat.length - 1;
    const lastMessage = currentChatAbbonamento.messaggiChat[messageIndex];
    if (lastMessage && lastMessage.status === 'sent') {
      markMessageAsDelivered(lastMessage, messageIndex);
      // Aggiorna UI
      setTimeout(() => loadChatMessages(), 100);
    }
  }, 1000);
  
  // 📧 Invia email notification al destinatario
  try {
    const recipientUsername = currentChatAbbonamento.utente === loggedInUser.username 
      ? currentChatAbbonamento.buyerName 
      : currentChatAbbonamento.utente;
    
    const recipient = users.find(u => u.username === recipientUsername);
    
    if (recipient && recipient.email) {
      EmailService.sendNewMessageNotification(
        recipient,
        loggedInUser,
        text,
        currentChatAbbonamento.matchDesc
      ).then(() => {
        console.log('📧 Email notification inviata');
      }).catch(err => {
        console.log('⚠️ Email notification fallita:', err);
      });
    }
  } catch (error) {
    console.log('Errore email notification:', error);
  }
}

// Inizializzazione del sito quando il DOM è caricato
document.addEventListener('DOMContentLoaded', () => {
  console.log('Inizializzazione sito Ti Presto...');
  
  // � Controllo compatibilità browser
  checkBrowserCompatibility();
  
  // �🔥 Sincronizza dati Firebase
  // syncFirebaseData(); // Ora gestita dopo autenticazione
  
  // Inizializza UI
  updateLoginLogoutButtons();
  
  // Se c'è un utente loggato, aggiorna l'interfaccia
  if (loggedInUser) {
    updateUIAfterLogin();
  } else {
    updateUIAfterLogout();
  }
  
  // Mostra la sezione home di default
  showSection('home');
  
  // Avvia aggiornamento data/ora
  updateLiveDateTime();
  setInterval(updateLiveDateTime, 1000);
  
  // Controllo timeout ogni 5 minuti
  checkTrattativeTimeout(); // Controllo iniziale
  setInterval(checkTrattativeTimeout, 5 * 60 * 1000); // Ogni 5 minuti
  
  console.log('Sito inizializzato correttamente!');
});

// Funzione per aggiornare data e ora in tempo reale
function updateLiveDateTime() {
  const now = new Date();
  const dateTimeElement = document.getElementById('liveDateTime');
  if (dateTimeElement) {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    dateTimeElement.textContent = now.toLocaleDateString('it-IT', options);
  }
}

// 🕒 Controllo timeout trattative (24 ore)
function checkTrattativeTimeout() {
  if (!abbonamenti || abbonamenti.length === 0) return;
  
  const now = Date.now();
  const TIMEOUT_24H = 24 * 60 * 60 * 1000; // 24 ore in millisecondi
  let hasChanges = false;
  
  abbonamenti.forEach(abbon => {
    // Controlla solo abbonamenti in trattativa
    if (abbon.inTrattativa && abbon.trattativaStartTime) {
      const timeElapsed = now - abbon.trattativaStartTime;
      
      // Se sono passate 24 ore senza messaggi, resetta la trattativa
      if (timeElapsed > TIMEOUT_24H) {
        // Controlla se ci sono stati messaggi nella chat
        const hasMessages = abbon.messaggiChat && abbon.messaggiChat.length > 0;
        
        if (!hasMessages) {
          console.log(`⏰ Timeout trattativa per abbonamento ${abbon.id} - reset automatico`);
          
          // Reset trattativa
          abbon.inTrattativa = false;
          abbon.buyerName = null;
          abbon.trattativaStartTime = null;
          hasChanges = true;
          
          // Mostra notifica se l'utente è il venditore
          if (loggedInUser && abbon.utente === loggedInUser.username) {
            showToast(`⏰ Trattativa per ${abbon.matchDesc} (${abbon.settore}) scaduta e riattivata`, 'info', 5000);
          }
        }
      }
    }
  });
  
  // Salva modifiche se ci sono stati cambiamenti
  if (hasChanges) {
    SafeStorage.set('abbonamenti', abbonamenti);
    
    // Aggiorna UI se siamo nella home
    const homeSection = document.getElementById('home');
    if (homeSection && homeSection.classList.contains('active')) {
      loadHomeListings();
    }
    
    // Aggiorna anche la sezione abbonamenti se attiva
    const mySubscriptionSection = document.getElementById('mySubscription');
    if (mySubscriptionSection && mySubscriptionSection.classList.contains('active')) {
      loadMySubscription();
    }
  }
}

// Event listener per tasto Enter nella chat e inizializzazione preferenze
document.addEventListener('DOMContentLoaded', function() {
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
  }
  
  // Inizializza i toggle delle preferenze
  const toggles = document.querySelectorAll('.toggle-switch input');
  toggles.forEach(toggle => {
    toggle.addEventListener('change', function() {
      if (loggedInUser) {
        saveUserPreferences();
        const prefName = this.id.replace('Notifications', '');
        const status = this.checked ? 'attivate' : 'disattivate';
        showToast(`🔔 Notifiche ${prefName} ${status}`, 'info');
      }
    });
  });
  
  // ESC key closes modals
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      // Find any open modal and close it
      const modals = document.querySelectorAll('.modal');
      modals.forEach(modal => {
        if (modal.style.display === 'flex') {
          modal.style.display = 'none';
          modal.onclick = null;
        }
      });
      
      // Also hide cookie banner if open
      const banner = document.getElementById('cookieBanner');
      if (banner && banner.style.display !== 'none') {
        hideCookieBanner();
      }
    }
  });
  
  // Check cookie consent after page load
  setTimeout(checkCookieConsent, 500);
});

// ===============================
// GDPR & PRIVACY FUNCTIONS
// ===============================

// Cookie Management
const CookieManager = {
    // Cookie categories configuration
    categories: {
        essential: {
            name: 'Cookie Essenziali',
            required: true,
            description: 'Necessari per il funzionamento base del sito',
            cookies: ['user-session', 'auth-token', 'csrf-protection']
        },
        functional: {
            name: 'Cookie Funzionali',
            required: false,
            description: 'Migliorano l\'esperienza utente con funzioni aggiuntive',
            cookies: ['theme-preference', 'language-setting', 'layout-config']
        },
        analytics: {
            name: 'Cookie Analytics',
            required: false,
            description: 'Ci aiutano a capire come viene utilizzato il sito',
            cookies: ['ga-tracking', 'page-views', 'user-behavior']
        },
        marketing: {
            name: 'Cookie Marketing',
            required: false,
            description: 'Utilizzati per personalizzare annunci e contenuti',
            cookies: ['ad-preferences', 'social-media', 'retargeting']
        }
    },

    // Get current consent status
    getConsent: function() {
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) return null;
        try {
            return JSON.parse(consent);
        } catch {
            return null;
        }
    },

    // Save consent preferences
    saveConsent: function(preferences) {
        const consent = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            preferences: preferences
        };
        localStorage.setItem('cookieConsent', JSON.stringify(consent));
        this.applyCookieSettings(preferences);
    },

    // Apply cookie settings based on consent
    applyCookieSettings: function(preferences) {
        // Essential cookies are always enabled
        preferences.essential = true;

        // Clean up non-consented cookies
        for (const [category, allowed] of Object.entries(preferences)) {
            if (!allowed && this.categories[category]) {
                this.categories[category].cookies.forEach(cookie => {
                    this.deleteCookie(cookie);
                });
            }
        }

        // Log consent for audit trail
        console.log('Cookie preferences applied:', preferences);
    },

    // Delete a specific cookie
    deleteCookie: function(name) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/';
    },

    // Check if consent is needed
    needsConsent: function() {
        const consent = this.getConsent();
        return !consent || this.isConsentExpired(consent);
    },

    // Check if consent has expired (1 year)
    isConsentExpired: function(consent) {
        if (!consent || !consent.timestamp) return true;
        const consentDate = new Date(consent.timestamp);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return consentDate < oneYearAgo;
    }
};

// Show cookie banner if needed
function checkCookieConsent() {
    if (CookieManager.needsConsent()) {
        showCookieBanner();
    }
}

// Show cookie banner
function showCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    if (banner) {
        banner.style.display = 'block';
    }
}

// Hide cookie banner
function hideCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    if (banner) {
        banner.style.display = 'none';
    }
}

// Accept all cookies
function acceptAllCookies() {
    const allCategories = {};
    Object.keys(CookieManager.categories).forEach(category => {
        allCategories[category] = true;
    });
    
    CookieManager.saveConsent(allCategories);
    hideCookieBanner();
    
    showToast('Tutte le impostazioni dei cookie sono state accettate', 'success');
}

// Reject non-essential cookies
function rejectCookies() {
    const essentialOnly = {};
    Object.keys(CookieManager.categories).forEach(category => {
        essentialOnly[category] = CookieManager.categories[category].required;
    });
    
    CookieManager.saveConsent(essentialOnly);
    hideCookieBanner();
    
    showToast('Accettati solo i cookie essenziali', 'info');
}

// Generic modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        
        // Add click outside to close functionality
        modal.onclick = function(e) {
            if (e.target === modal) {
                closeModal(modalId);
            }
        };
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.onclick = null; // Remove event listener
    }
}

// Show cookie settings modal
function showCookieSettings() {
    hideCookieBanner();
    
    // Populate current settings
    const consent = CookieManager.getConsent();
    const preferences = consent ? consent.preferences : {};
    
    Object.keys(CookieManager.categories).forEach(category => {
        const toggle = document.getElementById(`cookie-${category}`);
        if (toggle) {
            toggle.checked = preferences[category] !== false;
            // Disable essential cookies toggle
            if (CookieManager.categories[category].required) {
                toggle.disabled = true;
                toggle.checked = true;
            }
        }
    });
    
    openModal('cookieSettingsModal');
}

// Save cookie preferences from modal
function saveCookiePreferences() {
    const preferences = {};
    
    Object.keys(CookieManager.categories).forEach(category => {
        const toggle = document.getElementById(`cookie-${category}`);
        if (toggle) {
            preferences[category] = toggle.checked;
        }
    });
    
    CookieManager.saveConsent(preferences);
    closeModal('cookieSettingsModal');
    
    showToast('Preferenze cookie salvate con successo', 'success');
}

// Privacy Policy Functions
function showPrivacyPolicy() {
    openModal('privacyPolicyModal');
}

// Data Export Function
function exportUserData() {
    if (!currentUser) {
        showToast('Devi essere autenticato per esportare i tuoi dati', 'error');
        return;
    }

    try {
        // Gather all user data
        const userData = {
            profile: {
                username: currentUser.username,
                nome: currentUser.nome,
                cognome: currentUser.cognome,
                email: currentUser.email,
                telefono: currentUser.telefono,
                dataNascita: currentUser.dataNascita,
                registrationDate: currentUser.registrationDate || 'N/D'
            },
            subscriptions: abbonamenti.filter(abb => abb.utente === currentUser.username),
            cookieConsent: CookieManager.getConsent(),
            exportDate: new Date().toISOString(),
            dataVersion: '1.0'
        };

        // Create downloadable file
        const dataBlob = new Blob([JSON.stringify(userData, null, 2)], 
            { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `ti-presto-data-${currentUser.username}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(downloadUrl);
        
        showToast('I tuoi dati sono stati esportati con successo', 'success');
        
    } catch (error) {
        console.error('Error exporting user data:', error);
        showToast('Errore durante l\'esportazione dei dati', 'error');
    }
}

// Account Deletion Function  
function deleteAccount() {
    if (!currentUser) {
        showToast('Devi essere autenticato per eliminare l\'account', 'error');
        return;
    }

    const confirmDelete = confirm(`
        ATTENZIONE: Eliminazione Account
        
        Stai per eliminare permanentemente il tuo account "${currentUser.username}".
        
        Questa azione:
        • Eliminerà tutti i tuoi dati personali
        • Rimuoverà tutti i tuoi annunci di abbonamenti  
        • Non potrà essere annullata
        
        Sei sicuro di voler procedere?
    `);

    if (!confirmDelete) return;

    const finalConfirm = confirm(`
        CONFERMA FINALE
        
        Digita "ELIMINA" nel prossimo prompt per confermare l'eliminazione dell'account.
        
        Procedere?
    `);

    if (!finalConfirm) return;

    const deleteConfirmation = prompt('Digita "ELIMINA" per confermare l\'eliminazione definitiva dell\'account:');
    
    if (deleteConfirmation !== 'ELIMINA') {
        showToast('Eliminazione annullata - testo di conferma errato', 'info');
        return;
    }

    try {
        // Remove user subscriptions
        abbonamenti = abbonamenti.filter(abb => abb.utente !== currentUser.username);
        localStorage.setItem('abbonamenti', JSON.stringify(abbonamenti));
        
        // Remove user account
        users = users.filter(user => user.username !== currentUser.username);
        localStorage.setItem('users', JSON.stringify(users));
        
        // Clear user session
        localStorage.removeItem('currentUser');
        currentUser = null;
        
        // Clear cookie consent for this user
        localStorage.removeItem('cookieConsent');
        
        // Update UI
        updateLoginStatus();
        showSection('home');
        
        showToast('Account eliminato con successo. Tutti i tuoi dati sono stati rimossi.', 'success');
        
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast('Errore durante l\'eliminazione dell\'account', 'error');
    }
}

// Privacy utility functions
function getPrivacyCompliantDate(date) {
    return date ? new Date(date).toLocaleDateString('it-IT') : 'N/D';
}

// Debug function to test cookie banner (remove in production)
function testCookieBanner() {
    localStorage.removeItem('cookieConsent');
    showCookieBanner();
}

// Make debug function available in console
window.testCookieBanner = testCookieBanner;

// 🎫 =======================================
// SISTEMA TICKET NOTIFICHE
// =======================================

/**
 * Controlla le notifiche ticket e aggiorna l'icona
 */
function checkTicketNotifications() {
  const ticketIcon = document.getElementById('ticketNotification');
  if (!ticketIcon) return;
  
  const purchaseHistory = JSON.parse(localStorage.getItem('purchaseHistory') || '[]');
  const badge = ticketIcon.querySelector('.ticket-badge');
  
  if (purchaseHistory.length > 0) {
    // Attiva l'icona e mostra badge
    ticketIcon.classList.add('has-data');
    badge.textContent = purchaseHistory.length;
    badge.classList.add('visible');
    
    // Anima l'icona se ci sono nuovi acquisti
    if (purchaseHistory.some(p => !p.viewed)) {
      ticketIcon.classList.add('new-notification');
    }
  } else {
    // Disattiva l'icona
    ticketIcon.classList.remove('has-data', 'new-notification');
    badge.classList.remove('visible');
  }
}

/**
 * Aggiorna il badge del ticket con il conteggio
 */
function updateTicketBadge() {
  try {
    const purchaseHistory = JSON.parse(localStorage.getItem('purchaseHistory') || '[]');
    const unviewedCount = purchaseHistory.filter(p => !p.viewed).length;
    
    const ticketIcon = document.getElementById('ticketNotification');
    if (ticketIcon) {
      const badge = ticketIcon.querySelector('.ticket-badge');
      if (badge) {
        if (unviewedCount > 0) {
          badge.textContent = unviewedCount;
          badge.classList.add('visible');
          ticketIcon.classList.add('new-notification');
        } else {
          badge.classList.remove('visible');
          ticketIcon.classList.remove('new-notification');
        }
      }
    }
    
    console.log('🔔 Badge ticket aggiornato:', unviewedCount, 'non visualizzati');
  } catch (error) {
    console.error('❌ Errore aggiornamento badge ticket:', error);
  }
}

/**
 * Rimuove un biglietto dal modal e dalla cronologia
 */
function removeTicketFromModal(ticketIndex) {
  console.log('🗑️ Rimozione biglietto indice:', ticketIndex);
  
  try {
    const purchaseHistory = JSON.parse(localStorage.getItem('purchaseHistory') || '[]');
    
    if (ticketIndex >= 0 && ticketIndex < purchaseHistory.length) {
      // Rimuovi il biglietto dall'array
      const removedTicket = purchaseHistory.splice(ticketIndex, 1)[0];
      
      // Salva la cronologia aggiornata
      localStorage.setItem('purchaseHistory', JSON.stringify(purchaseHistory));
      
      // Aggiorna il modal
      openTicketModal();
      
      // Aggiorna notifiche e badge
      setTimeout(() => {
        checkTicketNotifications();
        updateTicketBadge();
      }, 100);
      
      showToast(`Biglietto per ${removedTicket.match} rimosso`, 'success');
      
      console.log('✅ Biglietto rimosso con successo');
    } else {
      console.error('❌ Indice biglietto non valido:', ticketIndex);
    }
    
  } catch (error) {
    console.error('❌ Errore rimozione biglietto:', error);
    showToast('Errore nella rimozione del biglietto', 'error');
  }
}

/**
 * Apre il modal con i biglietti degli acquisti
 */
function openTicketModal() {
  console.log('🎫 Apertura modal biglietti');
  
  try {
    const modal = document.getElementById('ticketModal');
    const ticketList = document.getElementById('ticketList');
    
    if (!modal || !ticketList) {
      console.error('❌ Elementi modal biglietti non trovati');
      return;
    }
    
    const purchaseHistory = JSON.parse(localStorage.getItem('purchaseHistory') || '[]');
    
    if (purchaseHistory.length === 0) {
      ticketList.innerHTML = `
        <div class="ticket-empty">
          <div class="ticket-empty-icon">🎫</div>
          <h3>Nessun biglietto</h3>
          <p>Non hai ancora effettuato acquisti.<br>I tuoi biglietti appariranno qui.</p>
        </div>
      `;
    } else {
      ticketList.innerHTML = purchaseHistory.map((purchase, index) => `
        <div class="ticket-item" data-ticket-id="${index}">
          <div class="ticket-match">
            🏟️ ${purchase.match}
          </div>
          <div class="ticket-details">
            <strong>Settore:</strong> ${purchase.settore}<br>
            <strong>Data acquisto:</strong> ${new Date(purchase.timestamp).toLocaleString('it-IT')}<br>
            <strong>Venditore:</strong> ${purchase.venditoreName}
          </div>
          <div class="ticket-contacts">
            ${purchase.telefono ? `<button class="contact-chip phone" onclick="copyToClipboard('${purchase.telefono}', 'Telefono')">📞 ${purchase.telefono}</button>` : ''}
            ${purchase.email ? `<button class="contact-chip email" onclick="copyToClipboard('${purchase.email}', 'Email')">✉️ ${purchase.email}</button>` : ''}
            ${purchase.paymentData ? `<button class="contact-chip payment" onclick="copyToClipboard('${purchase.paymentData}', 'Dati pagamento')">💳 ${purchase.paymentData}</button>` : ''}
          </div>
          <div class="ticket-seller">
            Contatta il venditore per finalizzare l'acquisto
          </div>
          <button class="ticket-remove" onclick="removeTicketFromModal(${index})" title="Rimuovi biglietto">
            🗑️ Rimuovi
          </button>
        </div>
      `).join('');
      
      // Segna come visualizzati IMMEDIATAMENTE
      const updatedHistory = purchaseHistory.map(p => ({ ...p, viewed: true }));
      localStorage.setItem('purchaseHistory', JSON.stringify(updatedHistory));
      
      // Aggiorna l'interfaccia immediatamente
      setTimeout(() => {
        checkTicketNotifications();
        updateTicketBadge();
      }, 50);
    }
    
    // Anima l'apertura del modal
    modal.style.display = 'flex';
    setTimeout(() => {
      const content = modal.querySelector('.ticket-modal-content');
      if (content) {
        content.style.animation = 'ticketZoom 0.3s ease-out';
      }
    }, 10);
    
  } catch (error) {
    console.error('❌ Errore apertura modal biglietti:', error);
    showToast('Errore nel caricamento dei biglietti', 'error');
  }
}

/**
 * Elimina un biglietto specifico dalla cronologia
 */
function deleteTicket(ticketId) {
  // Conferma eliminazione con stile personalizzato
  const confirmed = confirm('🎫 Eliminare questo biglietto?\n\nI dati di contatto del venditore verranno rimossi definitivamente.');
  
  if (!confirmed) return;
  
  const history = JSON.parse(localStorage.getItem('purchaseHistory') || '[]');
  const updatedHistory = history.filter(ticket => ticket.id !== ticketId);
  
  // Anima la rimozione
  const ticketElement = document.querySelector(`[data-ticket-id="${ticketId}"]`);
  if (ticketElement) {
    ticketElement.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    ticketElement.style.transform = 'translateX(100%) scale(0.8)';
    ticketElement.style.opacity = '0';
    
    setTimeout(() => {
      // Aggiorna localStorage
      localStorage.setItem('purchaseHistory', JSON.stringify(updatedHistory));
      
      // Ricarica il modal
      openTicketModal();
      
      // Aggiorna l'icona
      checkTicketNotifications();
      
      // Mostra feedback
      showToast('🗑️ Biglietto eliminato con successo', 'success');
    }, 400);
  } else {
    // Fallback se l'elemento non viene trovato
    localStorage.setItem('purchaseHistory', JSON.stringify(updatedHistory));
    openTicketModal();
    checkTicketNotifications();
    showToast('🗑️ Biglietto eliminato', 'success');
  }
}

/**
 * Copia testo negli appunti con notifica toast
 */
function copyToClipboard(text, type) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${type} copiato: ${text}`, 'success');
    }).catch(() => {
      fallbackCopyToClipboard(text, type);
    });
  } else {
    fallbackCopyToClipboard(text, type);
  }
}

/**
 * Fallback per copia negli appunti
 */
function fallbackCopyToClipboard(text, type) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    showToast(`${type} copiato: ${text}`, 'success');
  } catch (err) {
    showToast(`Errore copia ${type.toLowerCase()}`, 'error');
  }
  
  document.body.removeChild(textArea);
}

/**
 * Salva un acquisto nella cronologia
 */
function savePurchaseToHistory(venditoreName, abbonamento, venditoreData) {
  // Costruisce i dati del venditore ricevuti dall'acquirente
  const purchase = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    match: abbonamento.matchDesc || abbonamento.match,
    settore: abbonamento.settore,
    venditoreName: venditoreName,
    acquirenteName: loggedInUser?.nome + ' ' + loggedInUser?.cognome || 'Utente Corrente',
    // Questi sono i dati del VENDITORE che l'acquirente riceve
    telefono: venditoreData?.telefono || '333-1234567',
    email: venditoreData?.email || venditoreName.toLowerCase().replace(' ', '') + '@email.com',
    paymentData: venditoreData?.paymentData || 'IBAN: IT60 X054 2811 1010 0000 0123 456',
    viewed: false
  };
  
  const history = JSON.parse(localStorage.getItem('purchaseHistory') || '[]');
  history.push(purchase);
  localStorage.setItem('purchaseHistory', JSON.stringify(history));
  
  // Aggiorna immediatamente l'icona
  checkTicketNotifications();
  
  console.log('💳 Dati venditore salvati nella cronologia:', purchase);
  showToast(`🎫 Ricevuti dati di contatto da ${venditoreName}!`, 'success');
}



/**
 * Chiude il modal dei biglietti e aggiorna l'interfaccia
 */
function closeTicketModal() {
  console.log('🎫 Chiusura modal biglietti');
  
  try {
    const ticketModal = document.getElementById('ticketModal');
    if (ticketModal) {
      // Animazione di chiusura
      const content = ticketModal.querySelector('.ticket-modal-content');
      if (content) {
        content.style.animation = 'ticketZoomOut 0.2s ease-in';
      }
      
      // Chiudi dopo animazione
      setTimeout(() => {
        ticketModal.style.display = 'none';
        
        // Aggiorna notifiche e badge dopo chiusura
        setTimeout(() => {
          checkTicketNotifications();
          updateTicketBadge();
        }, 100);
      }, 200);
    }
  } catch (error) {
    console.error('❌ Errore nella chiusura modal biglietti:', error);
    // Fallback: chiudi comunque il modal
    const ticketModal = document.getElementById('ticketModal');
    if (ticketModal) {
      ticketModal.style.display = 'none';
    }
  }
}

// 🎫 Event Listeners per il sistema ticket
document.addEventListener('DOMContentLoaded', function() {
  // Chiudi modal ticket cliccando fuori
  const ticketModal = document.getElementById('ticketModal');
  if (ticketModal) {
    ticketModal.addEventListener('click', function(e) {
      if (e.target === ticketModal) {
        closeTicketModal();
      }
    });
    
    // Chiudi con tasto Esc
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && ticketModal.style.display === 'flex') {
        closeTicketModal();
      }
    });
  }
  
  // Inizializza le notifiche ticket
  setTimeout(checkTicketNotifications, 1000);
});

// 🔔 SISTEMA TRATTATIVE E RATING

// Controlla trattative attive per venditori
function checkActiveTrattativeForSeller() {
  console.log('🔍 checkActiveTrattativeForSeller chiamata per:', loggedInUser?.username);
  
  if (!loggedInUser) {
    console.log('❌ Nessun utente loggato');
    return;
  }
  
  console.log('📦 Totale abbonamenti da verificare:', abbonamenti.length);
  
  // Debug: mostra tutti gli abbonamenti dell'utente
  const userAbbonamenti = abbonamenti.filter(abbon => abbon.utente === loggedInUser.username);
  console.log('👤 Abbonamenti utente:', userAbbonamenti.length);
  
  // Debug dettagliato per ogni abbonamento
  userAbbonamenti.forEach(abbon => {
    console.log(`📋 Abbonamento ${abbon.id}:`, {
      inTrattativa: abbon.inTrattativa,
      buyerName: abbon.buyerName,
      concluded: abbon.concluded,
      matchDesc: abbon.matchDesc,
      disponibile: abbon.disponibile
    });
  });
  
  // Trova trattative attive dove l'utente è il venditore
  const activeTrattativeVenditore = abbonamenti.filter(abbon => 
    abbon.utente === loggedInUser.username && 
    abbon.inTrattativa && 
    abbon.buyerName &&
    !abbon.concluded
  );
  
  // Trova trattative attive dove l'utente è il compratore
  const activeTrattativeCompratore = abbonamenti.filter(abbon => 
    abbon.buyerName === loggedInUser.username && 
    abbon.inTrattativa &&
    !abbon.concluded
  );
  
  console.log('🔔 Trattative attive come VENDITORE:', activeTrattativeVenditore.length);
  console.log('🛒 Trattative attive come COMPRATORE:', activeTrattativeCompratore.length);
  
  if (activeTrattativeVenditore.length > 0) {
    console.log('✅ Mostro popup trattative VENDITORE');
    showActiveTrattativePopup(activeTrattativeVenditore);
  } else if (activeTrattativeCompratore.length > 0) {
    console.log('ℹ️ Sei compratore in trattative attive - nessun popup venditore da mostrare');
  } else {
    console.log('ℹ️ Nessuna trattativa attiva da mostrare');
  }
}

// 🧪 FUNZIONE TEST PER DEBUG
window.testTrattativePopup = function() {
  console.log('🧪 Test manuale popup trattative');
  
  if (!loggedInUser) {
    console.log('❌ Effettua prima il login');
    return;
  }
  
  // Forza il controllo delle trattative
  checkActiveTrattativeForSeller();
  
  // Crea trattativa di test se non esistono
  const testTrattative = abbonamenti.filter(abbon => 
    abbon.utente === loggedInUser.username && !abbon.concluded
  );
  
  if (testTrattative.length > 0) {
    // Simula una trattativa attiva per test
    testTrattative[0].inTrattativa = true;
    testTrattative[0].buyerName = 'TestBuyer';
    testTrattative[0].concluded = false;
    
    console.log('🎭 Trattativa di test creata:', testTrattative[0]);
    showActiveTrattativePopup([testTrattative[0]]);
  } else {
    console.log('❌ Nessun abbonamento disponibile per test');
  }
};

  console.log('🧪 FUNZIONI DEBUG DISPONIBILI:');
  console.log('   📋 debugTrattative() - Analisi trattative utente');
  console.log('   🎭 simuleVenditore() - Simula trattativa per test popup');
  console.log('   🔒 debugStorage() - Diagnostica Tracking Prevention');
  console.log('   🛠️ fixTrackingPrevention() - Tenta risoluzione blocco storage');
  console.log('   🔔 testBadgeVenditore() - Testa badge notifiche venditore');
  console.log('   🔄 syncNow() - Forza sincronizzazione Firebase');
  console.log('   🔥 debugFirebasePermissions() - Diagnostica problemi Firebase');
  
  // 🔥 NUOVA FUNZIONE: Debug Firebase Permissions
  window.debugFirebasePermissions = function() {
    console.log('🔥 === DEBUG FIREBASE PERMISSIONS ===');
    
    if (!firebase.auth().currentUser) {
      console.log('❌ PROBLEMA: Utente non autenticato');
      console.log('💡 Soluzione: Effettua login prima di usare Firebase');
      return;
    }
    
    const user = firebase.auth().currentUser;
    console.log('👤 Utente autenticato:', user.email);
    console.log('🔑 UID:', user.uid);
    console.log('✅ Email verificata:', user.emailVerified);
    
    // Test scrittura Firestore
    console.log('🧪 Test scrittura Firestore...');
    firebase.firestore().collection('test').doc('permissions').set({
      test: true,
      timestamp: new Date(),
      userId: user.uid
    }).then(() => {
      console.log('✅ SCRITTURA RIUSCITA: Firebase permissions OK');
    }).catch((error) => {
      console.log('❌ SCRITTURA FALLITA:', error.message);
      console.log('');
      console.log('🛡️ POSSIBILI CAUSE:');
      console.log('1. Security Rules troppo restrittive');
      console.log('2. Progetto Firebase non configurato correttamente');
      console.log('3. API key non valida');
      console.log('');
      console.log('🔧 SOLUZIONI:');
      console.log('1. Vai su Firebase Console > Firestore > Rules');
      console.log('2. Verifica che le regole permettano scrittura per utenti autenticati');
      console.log('3. Regola base: allow read, write: if request.auth != null;');
    });
  };
  
  // Funzione debug per sincronizzazione immediata  
  window.syncNow = async function() {
    console.log('🔄 Sincronizzazione Firebase forzata...');
    await syncFirebaseData();
    console.log('✅ Sincronizzazione completata');
  };// 🔍 FUNZIONE DEBUG STATO ABBONAMENTI
window.debugTrattative = function() {
  console.log('🔍 DEBUG STATO TRATTATIVE');
  console.log('👤 Utente loggato:', loggedInUser?.username);
  console.log('📦 Totale abbonamenti:', abbonamenti.length);
  
  if (!loggedInUser) {
    console.log('❌ Nessun utente loggato');
    return;
  }
  
  // Abbonamenti dell'utente
  const userAbbonamenti = abbonamenti.filter(a => a.utente === loggedInUser.username);
  console.log('📋 Abbonamenti utente:', userAbbonamenti.length);
  
  // Analisi dettagliata
  userAbbonamenti.forEach((abbon, index) => {
    const status = {
      id: abbon.id,
      match: abbon.matchDesc,
      settore: abbon.settore,
      inTrattativa: abbon.inTrattativa,
      buyerName: abbon.buyerName,
      concluded: abbon.concluded,
      disponibile: abbon.disponibile
    };
    console.log(`${index + 1}. ${abbon.matchDesc}:`, status);
  });
  
  // Filtro trattative attive
  const activeTrattative = abbonamenti.filter(abbon => 
    abbon.utente === loggedInUser.username && 
    abbon.inTrattativa && 
    abbon.buyerName &&
    !abbon.concluded
  );
  
  console.log('🔔 Trattative attive filtrate:', activeTrattative);
  
  if (activeTrattative.length > 0) {
    console.log('✅ Dovrebbe apparire popup!');
  } else {
    console.log('❌ Nessuna trattativa attiva - popup non mostrato');
  }
};

// 🧪 FUNZIONE PER SIMULARE TRATTATIVA VENDITORE
window.simuleVenditore = function() {
  console.log('🎭 Simulazione trattativa venditore');
  
  if (!loggedInUser) {
    console.log('❌ Effettua prima il login');
    return;
  }
  
  // Trova un abbonamento dell'utente
  const userAbbonamenti = abbonamenti.filter(abbon => 
    abbon.utente === loggedInUser.username && !abbon.concluded
  );
  
  if (userAbbonamenti.length > 0) {
    const abbon = userAbbonamenti[0];
    
    // Simula trattativa attiva
    abbon.inTrattativa = true;
    abbon.buyerName = 'TestCompratore123';
    abbon.concluded = false;
    abbon.trattativaStartTime = Date.now();
    abbon.trattativaExpiresAt = Date.now() + (5 * 60 * 60 * 1000); // 5h
    
    console.log('✅ Trattativa simulata:', {
      id: abbon.id,
      match: abbon.matchDesc,
      buyerName: abbon.buyerName,
      inTrattativa: abbon.inTrattativa
    });
    
    // Aggiorna storage
    SafeStorage.set('abbonamenti', abbonamenti);
    
    // Testa popup
    checkActiveTrattativeForSeller();
    
    console.log('🎯 Ora fai logout e login per vedere il popup al login!');
  } else {
    console.log('❌ Nessun abbonamento disponibile per simulazione');
  }
};

// 🔒 FUNZIONE DEBUG TRACKING PREVENTION
window.debugStorage = function() {
  console.log('🔒 DEBUG SAFESTORAGE & TRACKING PREVENTION');
  console.log('━'.repeat(50));
  
  const status = SafeStorage.getStatus();
  console.log('📊 Stato SafeStorage:', status);
  
  console.log('\n🧪 Test localStorage diretto:');
  try {
    const testKey = '__debug_test_' + Date.now();
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    console.log('✅ localStorage FUNZIONA normalmente');
  } catch (e) {
    console.log('🔒 localStorage BLOCCATO:', e.message);
  }
  
  console.log('\n💾 Dati in memoria:', 
    Object.keys(SafeStorage.memoryStorage).length, 'chiavi');
  
  if (Object.keys(SafeStorage.memoryStorage).length > 0) {
    console.log('🔑 Chiavi in memoria:');
    Object.keys(SafeStorage.memoryStorage).forEach(key => {
      const size = JSON.stringify(SafeStorage.memoryStorage[key]).length;
      console.log(`   ${key}: ${size} bytes`);
    });
  }
  
  console.log('\n🔄 Comandi disponibili:');
  console.log('   SafeStorage.retestStorage() - Ri-testa localStorage');
  console.log('   debugStorage() - Questo comando');
  console.log('   fixTrackingPrevention() - Tenta fix automatico');
};

// 🛠️ FUNZIONE TENTATIVO FIX TRACKING PREVENTION  
window.fixTrackingPrevention = function() {
  console.log('🛠️ TENTATIVO FIX TRACKING PREVENTION');
  console.log('━'.repeat(40));
  
  // Reset stato SafeStorage
  SafeStorage.storageBlocked = false;
  SafeStorage.warningShown = false;
  SafeStorage.lastBlockedCheck = 0;
  
  console.log('🔄 Reset stato SafeStorage...');
  
  // Test immediato
  const available = SafeStorage.retestStorage();
  
  if (available) {
    console.log('✅ localStorage ora disponibile!');
    console.log('💾 Sincronizzando dati dalla memoria...');
    
    // Copia dati da memoria a localStorage
    let synced = 0;
    for (const [key, value] of Object.entries(SafeStorage.memoryStorage)) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        synced++;
      } catch (e) {
        console.log(`❌ Errore sync ${key}:`, e.message);
      }
    }
    
    console.log(`✅ Sincronizzate ${synced} chiavi in localStorage`);
    showToast('✅ Tracking Prevention risolto! Dati sincronizzati.', 'success');
  } else {
    console.log('❌ localStorage ancora bloccato');
    console.log('💡 Suggerimenti:');
    console.log('   1. Disabilita Tracking Prevention per questo sito');
    console.log('   2. Controlla impostazioni privacy del browser');
    console.log('   3. Prova modalità incognito/privata');
    
    showToast('⚠️ Tracking Prevention ancora attivo. Consulta la console per suggerimenti.', 'warning');
  }
};

// 🔔 FUNZIONE DEBUG BADGE VENDITORE
window.testBadgeVenditore = function() {
  console.log('🔔 TEST BADGE NOTIFICHE VENDITORE');
  console.log('━'.repeat(40));
  
  if (!loggedInUser) {
    console.log('❌ Effettua prima il login');
    return;
  }
  
  console.log('👤 Utente:', loggedInUser.username);
  
  // Trova abbonamenti dell'utente
  const userAbbonamenti = abbonamenti.filter(a => a.utente === loggedInUser.username);
  console.log('📋 Abbonamenti utente:', userAbbonamenti.length);
  
  if (userAbbonamenti.length === 0) {
    console.log('❌ Nessun abbonamento per testare. Crea prima un abbonamento.');
    return;
  }
  
  // Prendi il primo abbonamento disponibile
  const targetAbbon = userAbbonamenti.find(a => a.disponibile && !a.concluded) || userAbbonamenti[0];
  
  console.log('🎯 Abbonamento target:', targetAbbon.matchDesc);
  
  // Simula nuovo compratore
  const compratoreFittizio = 'TestBuyer_' + Date.now();
  targetAbbon.buyerName = compratoreFittizio;
  targetAbbon.inTrattativa = true;
  targetAbbon.disponibile = true;
  targetAbbon.concluded = false;
  
  // Aggiungi messaggio di test
  if (!targetAbbon.messaggiChat) targetAbbon.messaggiChat = [];
  targetAbbon.messaggiChat.push({
    sender: compratoreFittizio,
    text: 'Ciao, sono interessato al tuo abbonamento! 🎫',
    timestamp: Date.now()
  });
  
  // Salva modifiche
  SafeStorage.set('abbonamenti', abbonamenti);
  
  console.log('✅ Trattativa simulata:');
  console.log('   Venditore:', targetAbbon.utente);
  console.log('   Compratore:', targetAbbon.buyerName);
  console.log('   Match:', targetAbbon.matchDesc);
  console.log('   In trattativa:', targetAbbon.inTrattativa);
  
  // Forza aggiornamento badge
  updateTrattativeNotifications();
  
  // Lampeggia il bottone
  blinkTrattativeButton(5000);
  
  console.log('🎯 RISULTATO:');
  console.log('   Controlla il badge "Le tue Trattative"');
  console.log('   Dovrebbe mostrare il numero 1 e lampeggiare');
  console.log('   Per rimuovere: annulla la trattativa dalla sezione');
};

// Pop-up trattative attive per venditori
function showActiveTrattativePopup(trattative) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '9999';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px; width: 90%;">
      <div class="modal-header" style="background: linear-gradient(135deg, #c8102e 0%, #8b0e24 100%); color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 1.4em;">🔔 Trattative in Corso</h2>
      </div>
      <div class="modal-body" style="padding: 20px;">
        <p style="margin-bottom: 20px; color: #002147; font-weight: 600;">
          Hai <strong>${trattative.length}</strong> trattativ${trattative.length === 1 ? 'a' : 'e'} attiv${trattative.length === 1 ? 'a' : 'e'}. 
          Ricorda di concludere le vendite o le trattative scadranno automaticamente.
        </p>
        <div id="trattativeList">
          ${trattative.map(t => `
            <div class="trattativa-item" style="padding: 15px; background: #f8f9fa; border-radius: 10px; margin-bottom: 10px; border-left: 4px solid #c8102e;">
              <div style="font-weight: 600; color: #002147; margin-bottom: 5px;">
                ${t.matchDesc} - ${t.settore}
              </div>
              <div style="font-size: 0.9em; color: #6c757d; margin-bottom: 10px;">
                Interessato: <strong>${t.buyerName}</strong>
              </div>
              <div style="display: flex; gap: 10px;">
                <button onclick="concludeTrattativa('${t.id}')" class="btn" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 0.85em;">
                  ✅ Concludi Vendita
                </button>
                <button onclick="cancelTrattativa('${t.id}')" class="btn" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 0.85em;">
                  ❌ Annulla
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="modal-footer" style="padding: 15px 20px; text-align: right;">
        <button onclick="this.closest('.modal').remove()" class="btn-secondary" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer;">
          Chiudi
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Funzioni azioni trattative
window.concludeTrattativa = function(abbonamentoId) {
  const abbon = abbonamenti.find(a => a.id === abbonamentoId);
  if (!abbon) return;
  
  // Segna come conclusa
  abbon.concluded = true;
  abbon.concludedAt = Date.now();
  abbon.disponibile = false;
  
  SafeStorage.set('abbonamenti', abbonamenti);
  
  // Chiudi popup
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
  
  // Apri rating per venditore
  openRatingModal(abbon.buyerName, abbonamentoId, 'venditore');
  
  // Aggiungi rating pendente per acquirente
  addPendingRatingForUser(abbon.buyerName, loggedInUser.username, abbonamentoId);
  
  showToast('✅ Trattativa conclusa! Ora valuta l\'acquirente.', 'success');
};

window.cancelTrattativa = function(abbonamentoId) {
  const abbon = abbonamenti.find(a => a.id === abbonamentoId);
  if (!abbon) return;
  
  // Reset trattativa
  abbon.inTrattativa = false;
  abbon.buyerName = null;
  abbon.trattativaStartTime = null;
  abbon.trattativaExpiresAt = null;
  abbon.disponibile = true;
  
  SafeStorage.set('abbonamenti', abbonamenti);
  
  // Chiudi popup
  const modal = document.querySelector('.modal');
  if (modal) modal.remove();
  
  showToast('🔄 Trattativa annullata, abbonamento di nuovo disponibile', 'info');
  
  // Aggiorna UI
  if (typeof loadHomeListings === 'function') {
    loadHomeListings();
  }
};

// Sistema rating pendenti
function addPendingRatingForUser(username, fromUser, abbonamentoId) {
  const users = SafeStorage.get('users', []);
  const userIndex = users.findIndex(u => u.username === username);
  
  if (userIndex !== -1) {
    if (!users[userIndex].pendingRatings) {
      users[userIndex].pendingRatings = [];
    }
    
    users[userIndex].pendingRatings.push({
      fromUser,
      abbonamentoId,
      date: new Date().toISOString()
    });
    
    SafeStorage.set('users', users);
  }
}

// Controlla rating pendenti per utente
function checkPendingRatingsForUser() {
  if (!loggedInUser || !loggedInUser.pendingRatings || loggedInUser.pendingRatings.length === 0) return;
  
  // Mostra rating per il primo pendente
  const pending = loggedInUser.pendingRatings[0];
  openRatingModal(pending.fromUser, pending.abbonamentoId, 'acquirente');
}

// Modal rating 5 stelle
function openRatingModal(otherUser, abbonamentoId, userRole) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '9999';
  
  const isVenditore = userRole === 'venditore';
  const title = isVenditore ? 'Valuta l\'Acquirente' : 'Valuta il Venditore';
  const description = isVenditore ? 
    `Come è andata la vendita con <strong>${otherUser}</strong>?` :
    `Come è andata l\'acquisto da <strong>${otherUser}</strong>?`;
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; width: 90%;">
      <div class="modal-header" style="background: linear-gradient(135deg, #c8102e 0%, #8b0e24 100%); color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 1.3em;">⭐ ${title}</h2>
      </div>
      <div class="modal-body" style="padding: 30px; text-align: center;">
        <p style="margin-bottom: 25px; color: #002147; font-weight: 600;">
          ${description}
        </p>
        
        <div class="rating-stars" style="font-size: 2.5em; margin-bottom: 20px; cursor: pointer;">
          <span class="star" data-rating="1">☆</span>
          <span class="star" data-rating="2">☆</span>
          <span class="star" data-rating="3">☆</span>
          <span class="star" data-rating="4">☆</span>
          <span class="star" data-rating="5">☆</span>
        </div>
        
        <div style="margin-bottom: 20px;">
          <textarea id="reviewText" placeholder="Scrivi una recensione (opzionale)" 
                    style="width: 100%; height: 80px; padding: 10px; border: 2px solid #ddd; border-radius: 8px; resize: vertical;"></textarea>
        </div>
        
        <div style="display: flex; gap: 15px; justify-content: center;">
          <button onclick="submitRating(${abbonamentoId}, '${otherUser}', '${userRole}')" 
                  id="submitRatingBtn" disabled
                  style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: not-allowed; opacity: 0.6;">
            Invia Valutazione
          </button>
          <button onclick="skipRating('${abbonamentoId}', '${userRole}')" 
                  style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer;">
            Salta per Ora
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Sistema stelle interactive
  let selectedRating = 0;
  const stars = modal.querySelectorAll('.star');
  const submitBtn = modal.querySelector('#submitRatingBtn');
  
  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      selectedRating = index + 1;
      updateStars(selectedRating);
      submitBtn.disabled = false;
      submitBtn.style.cursor = 'pointer';
      submitBtn.style.opacity = '1';
    });
    
    star.addEventListener('mouseenter', () => {
      updateStars(index + 1, true);
    });
  });
  
  modal.querySelector('.rating-stars').addEventListener('mouseleave', () => {
    updateStars(selectedRating);
  });
  
  function updateStars(rating, isHover = false) {
    stars.forEach((star, index) => {
      if (index < rating) {
        star.textContent = '★';
        star.style.color = isHover ? '#ffa500' : '#c8102e';
      } else {
        star.textContent = '☆';
        star.style.color = '#ddd';
      }
    });
  }
  
  // Funzioni globali per i bottoni
  window.submitRating = function(abbonamentoId, otherUser, userRole) {
    const reviewText = modal.querySelector('#reviewText').value;
    saveRating(selectedRating, reviewText, otherUser, abbonamentoId, userRole);
    modal.remove();
    
    if (userRole === 'acquirente') {
      removePendingRating(abbonamentoId);
    }
    
    showToast('⭐ Grazie per la tua valutazione!', 'success');
  };
  
  window.skipRating = function(abbonamentoId, userRole) {
    modal.remove();
    
    if (userRole === 'acquirente') {
      removePendingRating(abbonamentoId);
    }
    
    showToast('📝 Potrai valutare in seguito dalla tua area personale', 'info');
  };
}

// Salva rating nel profilo utente
function saveRating(stars, review, targetUsername, abbonamentoId, fromRole) {
  const users = SafeStorage.get('users', []);
  const targetUserIndex = users.findIndex(u => u.username === targetUsername);
  
  if (targetUserIndex !== -1) {
    const targetUser = users[targetUserIndex];
    
    // Inizializza sistema rating se non esiste
    if (!targetUser.totalStars) targetUser.totalStars = 0;
    if (!targetUser.totalVotes) targetUser.totalVotes = 0;
    if (!targetUser.ratings) targetUser.ratings = [];
    
    // Aggiungi nuovo rating
    const newRating = {
      stars,
      review: review.trim(),
      from: loggedInUser.username,
      fromRole,
      abbonamentoId,
      date: new Date().toISOString()
    };
    
    targetUser.ratings.push(newRating);
    targetUser.totalStars += stars;
    targetUser.totalVotes += 1;
    targetUser.averageRating = (targetUser.totalStars / targetUser.totalVotes).toFixed(1);
    
    SafeStorage.set('users', users);
    
    // Aggiorna loggedInUser se è lo stesso utente
    if (loggedInUser.username === targetUsername) {
      loggedInUser = targetUser;
    }
  }
}

// Rimuovi rating pendente
function removePendingRating(abbonamentoId) {
  if (!loggedInUser.pendingRatings) return;
  
  const index = loggedInUser.pendingRatings.findIndex(p => p.abbonamentoId === abbonamentoId);
  if (index !== -1) {
    loggedInUser.pendingRatings.splice(index, 1);
    
    // Aggiorna localStorage
    const users = SafeStorage.get('users', []);
    const userIndex = users.findIndex(u => u.username === loggedInUser.username);
    if (userIndex !== -1) {
      users[userIndex] = loggedInUser;
      SafeStorage.set('users', users);
    }
  }
}

// ⭐ DISPLAY RATING PUBBLICO

// Recupera rating utente per username
function getUserRating(username) {
  const users = SafeStorage.get('users', []);
  const user = users.find(u => u.username === username);
  
  if (!user || !user.totalVotes || user.totalVotes === 0) {
    return { averageRating: 0, totalVotes: 0 };
  }
  
  return {
    averageRating: parseFloat(user.averageRating || 0),
    totalVotes: user.totalVotes
  };
}

// Crea elemento stelle per display rating
function createStarsDisplay(rating, totalVotes, isCompact = false) {
  const container = document.createElement('div');
  container.className = isCompact ? 'stars-display-compact' : 'stars-display';
  container.style.display = 'inline-flex';
  container.style.alignItems = 'center';
  container.style.gap = '3px';
  
  // Container stelle
  const starsContainer = document.createElement('span');
  starsContainer.className = 'stars-container';
  starsContainer.style.color = '#c8102e';
  starsContainer.style.fontSize = isCompact ? '0.85em' : '1em';
  
  // Crea 5 stelle
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.textContent = i <= rating ? '★' : '☆';
    star.style.color = i <= rating ? '#c8102e' : '#ddd';
    starsContainer.appendChild(star);
  }
  
  container.appendChild(starsContainer);
  
  // Aggiungi numero rating e voti se ci sono voti
  if (totalVotes > 0) {
    const ratingText = document.createElement('span');
    ratingText.className = 'rating-text';
    ratingText.style.fontSize = isCompact ? '0.75em' : '0.85em';
    ratingText.style.color = '#6c757d';
    ratingText.style.marginLeft = '5px';
    ratingText.textContent = `${rating.toFixed(1)} (${totalVotes})`;
    container.appendChild(ratingText);
  } else {
    const noRatingText = document.createElement('span');
    noRatingText.className = 'no-rating-text';
    noRatingText.style.fontSize = isCompact ? '0.7em' : '0.8em';
    noRatingText.style.color = '#aaa';
    noRatingText.style.marginLeft = '5px';
    noRatingText.textContent = 'Nuovo utente';
    container.appendChild(noRatingText);
  }
  
  return container;
}

// Badge utente con rating
function createUserBadgeWithRating(username, isCompact = false, context = 'homepage', abbonamentoId = null) {
  const container = document.createElement('div');
  container.className = isCompact ? 'user-badge-compact' : 'user-badge';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '8px';
  container.style.cursor = 'pointer';
  container.style.transition = 'all 0.2s ease';
  
  // Nome utente
  const usernameSpan = document.createElement('span');
  usernameSpan.className = 'username-text';
  usernameSpan.style.fontWeight = '600';
  usernameSpan.style.color = '#002147';
  usernameSpan.textContent = username;
  
  // Rating stelle
  const userRating = getUserRating(username);
  const starsDisplay = createStarsDisplay(userRating.averageRating, userRating.totalVotes, isCompact);
  
  container.appendChild(usernameSpan);
  container.appendChild(starsDisplay);
  
  // 🎯 Click handler differenziato per contesto
  container.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (context === 'homepage') {
      // HOMEPAGE: Solo visualizzazione rating
      openRatingViewModal(username);
    } else if (context === 'storico' && abbonamentoId) {
      // STORICO: Voto attivo se non già votato
      openStoricoRatingModal(username, abbonamentoId);
    }
  });
  
  // Hover effect
  container.addEventListener('mouseenter', function() {
    this.style.backgroundColor = 'rgba(200, 16, 46, 0.1)';
    this.style.borderRadius = '8px';
    this.style.padding = '2px 6px';
  });
  
  container.addEventListener('mouseleave', function() {
    this.style.backgroundColor = 'transparent';
    this.style.padding = '0';
  });
  
  return container;
}

// 🔍 MODAL VISUALIZZAZIONE RATING (Homepage)
function openRatingViewModal(username) {
  const userRating = getUserRating(username);
  const users = SafeStorage.get('users', []);
  const user = users.find(u => u.username === username);
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; text-align: center;">
      <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
      <h3 style="color: #002147; margin-bottom: 20px;">📊 Profilo Utente</h3>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <div style="font-size: 1.2em; font-weight: bold; color: #002147; margin-bottom: 10px;">
          👤 ${username}
        </div>
        
        <div style="margin-bottom: 15px;">
          ${createStarsDisplay(userRating.averageRating, userRating.totalVotes, false).outerHTML}
        </div>
        
        <div style="color: #6c757d; font-size: 0.9em;">
          ${userRating.totalVotes > 0 ? 
            `Media: ${userRating.averageRating.toFixed(1)}/5 stelle<br/>Basata su ${userRating.totalVotes} recensioni` :
            'Utente nuovo, nessuna recensione ancora'}
        </div>
      </div>
      
      ${user && user.ratings && user.ratings.length > 0 ? `
        <div style="text-align: left; max-height: 200px; overflow-y: auto;">
          <h4 style="color: #002147; margin-bottom: 10px;">💬 Ultime Recensioni:</h4>
          ${user.ratings.slice(-3).reverse().map(r => `
            <div style="background: white; padding: 10px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid #c8102e;">
              <div style="font-size: 0.85em; color: #6c757d; margin-bottom: 5px;">
                ${createStarsDisplay(r.stars, 1, true).outerHTML} - da ${r.from}
              </div>
              ${r.review ? `<div style="font-size: 0.9em;">${r.review}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <div style="margin-top: 20px;">
        <button onclick="this.closest('.modal').remove()" 
                style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer;">
          ✅ Chiudi
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Click fuori per chiudere
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });
}

// ⭐ MODAL VOTO RATING (Storico)
function openStoricoRatingModal(username, abbonamentoId) {
  if (!loggedInUser) {
    showToast('❌ Devi essere loggato per votare', 'error');
    return;
  }
  
  if (username === loggedInUser.username) {
    showToast('❌ Non puoi votare te stesso', 'error');
    return;
  }
  
  // Controlla se ha già votato per questo abbonamento
  if (hasAlreadyVotedForTransaction(abbonamentoId, username)) {
    showToast('✅ Hai già votato questo utente per questa transazione', 'info');
    return;
  }
  
  const userRating = getUserRating(username);
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; text-align: center;">
      <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
      <h3 style="color: #002147; margin-bottom: 20px;">⭐ Vota Utente</h3>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
        <div style="font-size: 1.1em; font-weight: bold; color: #002147; margin-bottom: 10px;">
          👤 ${username}
        </div>
        
        <div style="margin-bottom: 15px; font-size: 0.9em; color: #6c757d;">
          ${userRating.totalVotes > 0 ? 
            `Rating attuale: ${userRating.averageRating.toFixed(1)}/5 (${userRating.totalVotes} voti)` :
            'Primo voto per questo utente'}
        </div>
        
        <div style="margin-bottom: 20px;">
          <div style="font-size: 1.1em; margin-bottom: 10px; color: #002147;">La tua valutazione:</div>
          <div class="rating-stars" style="font-size: 2em; gap: 5px; display: flex; justify-content: center;">
            <span class="star" data-rating="1" style="cursor: pointer; color: #ddd;">★</span>
            <span class="star" data-rating="2" style="cursor: pointer; color: #ddd;">★</span>
            <span class="star" data-rating="3" style="cursor: pointer; color: #ddd;">★</span>
            <span class="star" data-rating="4" style="cursor: pointer; color: #ddd;">★</span>
            <span class="star" data-rating="5" style="cursor: pointer; color: #ddd;">★</span>
          </div>
        </div>
        
        <textarea id="reviewText" placeholder="Commento opzionale..." 
                  style="width: 100%; height: 60px; border: 1px solid #ddd; border-radius: 8px; padding: 8px; resize: none;"></textarea>
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="submitRatingBtn" disabled 
                style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: not-allowed; opacity: 0.6;">
          ⭐ Invia Voto
        </button>
        <button onclick="this.closest('.modal').remove()" 
                style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer;">
          ❌ Annulla
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Sistema stelle interactive
  let selectedRating = 0;
  const stars = modal.querySelectorAll('.star');
  const submitBtn = modal.querySelector('#submitRatingBtn');
  const reviewTextarea = modal.querySelector('#reviewText');
  
  stars.forEach((star, index) => {
    star.addEventListener('mouseenter', function() {
      for (let i = 0; i <= index; i++) {
        stars[i].style.color = '#c8102e';
      }
      for (let i = index + 1; i < stars.length; i++) {
        stars[i].style.color = '#ddd';
      }
    });
    
    star.addEventListener('click', function() {
      selectedRating = index + 1;
      submitBtn.disabled = false;
      submitBtn.style.cursor = 'pointer';
      submitBtn.style.opacity = '1';
      
      // Mantieni stelle selezionate
      for (let i = 0; i <= index; i++) {
        stars[i].style.color = '#c8102e';
      }
      for (let i = index + 1; i < stars.length; i++) {
        stars[i].style.color = '#ddd';
      }
    });
  });
  
  // Reset hover quando esce dal container
  modal.querySelector('.rating-stars').addEventListener('mouseleave', function() {
    if (selectedRating === 0) {
      stars.forEach(star => star.style.color = '#ddd');
    }
  });
  
  // Submit rating
  submitBtn.addEventListener('click', function() {
    if (selectedRating > 0) {
      const review = reviewTextarea.value.trim();
      saveStoricoRating(selectedRating, review, username, abbonamentoId);
      modal.remove();
    }
  });
  
  // Click fuori per chiudere
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.remove();
  });
}

// 🔒 CONTROLLO ANTI-SPAM VOTI
function hasAlreadyVotedForTransaction(abbonamentoId, targetUsername) {
  const abbonamento = abbonamenti.find(a => a.id == abbonamentoId);
  if (!abbonamento || !abbonamento.ratings) return false;
  
  // Controlla se l'utente corrente ha già votato il target per questo abbonamento
  return abbonamento.ratings.some(r => 
    r.fromUser === loggedInUser.username && r.targetUser === targetUsername
  );
}

// 💾 SALVA RATING STORICO
function saveStoricoRating(stars, review, targetUsername, abbonamentoId) {
  // Salva nel profilo utente target
  const users = SafeStorage.get('users', []);
  const targetUserIndex = users.findIndex(u => u.username === targetUsername);
  
  if (targetUserIndex !== -1) {
    const targetUser = users[targetUserIndex];
    
    // Inizializza sistema rating se non esiste
    if (!targetUser.totalStars) targetUser.totalStars = 0;
    if (!targetUser.totalVotes) targetUser.totalVotes = 0;
    if (!targetUser.ratings) targetUser.ratings = [];
    
    // Aggiungi nuovo rating
    const newRating = {
      stars,
      review: review,
      from: loggedInUser.username,
      abbonamentoId,
      date: new Date().toISOString()
    };
    
    targetUser.ratings.push(newRating);
    targetUser.totalStars += stars;
    targetUser.totalVotes += 1;
    targetUser.averageRating = (targetUser.totalStars / targetUser.totalVotes);
    
    SafeStorage.set('users', users);
    
    // Marca abbonamento come votato
    const abbonamentoIndex = abbonamenti.findIndex(a => a.id == abbonamentoId);
    if (abbonamentoIndex !== -1) {
      if (!abbonamenti[abbonamentoIndex].ratings) {
        abbonamenti[abbonamentoIndex].ratings = [];
      }
      
      abbonamenti[abbonamentoIndex].ratings.push({
        fromUser: loggedInUser.username,
        targetUser: targetUsername,
        stars,
        review,
        date: new Date().toISOString()
      });
      
      SafeStorage.set('abbonamenti', abbonamenti);
    }
    
    showToast(`⭐ Voto inviato a ${targetUsername}! Grazie per il feedback`, 'success');
    
    // Aggiorna UI
    if (typeof loadStorico === 'function') {
      setTimeout(() => loadStorico(), 300);
    }
    
    console.log(`⭐ Rating salvato: ${stars} stelle per ${targetUsername}`);
  } else {
    showToast('❌ Errore nel salvare il voto', 'error');
  }
}

// 🚀 ===== SISTEMA PREMIUM BOOST ===== 

// PayPal Configuration
const PAYPAL_PAYMENT_URL = 'https://www.paypal.com/ncp/payment/BPQRYXFPZ84K8';

// Boost Checkbox Handler
function onBoostCheckboxChange() {
  const boostCheckbox = document.getElementById('premiumBoost');
  const sellButton = document.getElementById('sellButton');
  
  if (boostCheckbox && boostCheckbox.checked) {
    // ✨ Premium mode
    sellButton.innerHTML = '<span class="btn-icon">💳</span><span class="btn-text">Paga €1,79 e Pubblica Premium</span>';
    sellButton.classList.add('premium-mode');
  } else {
    // 📝 Standard mode
    sellButton.innerHTML = '<span class="btn-icon">💰</span><span class="btn-text">Metti in Vendita</span>';
    sellButton.classList.remove('premium-mode');
  }
}

// Show Boost Info Modal
function showBoostInfo(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  document.getElementById('boostInfoModal').style.display = 'flex';
}

// Open PayPal Modal
function openPayPalModal() {
  // Popola dati del pagamento
  populatePaymentSummary();
  
  // Mostra modal
  document.getElementById('paypalModal').style.display = 'flex';
}

// Close PayPal Modal
function closePayPalModal() {
  document.getElementById('paypalModal').style.display = 'none';
}

// Popola Payment Summary
function populatePaymentSummary() {
  const matchSelect = document.getElementById('matchSelect');
  const sectorSelect = document.getElementById('sectorSelect');
  
  if (matchSelect && sectorSelect) {
    const selectedMatchText = matchSelect.options[matchSelect.selectedIndex]?.text || 'Partita selezionata';
    const selectedSectorText = sectorSelect.options[sectorSelect.selectedIndex]?.text || 'Settore selezionato';
    
    document.getElementById('paymentMatchTitle').textContent = selectedMatchText;
    document.getElementById('paymentSectorInfo').textContent = selectedSectorText;
  }
}

// Handle PayPal Submit
function handlePayPalSubmit() {
  // Salva dati abbonamento temporaneamente per il return
  const formData = collectBookingFormData();
  if (formData) {
    formData.isPremium = true;
    formData.premiumTimestamp = Date.now();
    sessionStorage.setItem('pendingPremiumListing', JSON.stringify(formData));
    
    console.log('💳 Dati abbonamento salvati per PayPal:', formData);
    showToast('💳 Redirect a PayPal...', 'info');
  }
}

// Collect Form Data
function collectBookingFormData() {
  const matchSelect = document.getElementById('matchSelect');
  const sectorSelect = document.getElementById('sectorSelect');
  
  if (!matchSelect.value || !sectorSelect.value) {
    showToast('❌ Completa tutti i campi richiesti', 'error');
    return null;
  }
  
  return {
    utente: loggedInUser?.username || 'Utente',
    matchId: matchSelect.value,
    matchDesc: matchSelect.options[matchSelect.selectedIndex].text,
    settore: sectorSelect.options[sectorSelect.selectedIndex].text,
    disponibile: true,
    timestamp: Date.now()
  };
}

// Handle Payment Success Return
function handlePaymentReturn() {
  // Controlla se siamo tornati da PayPal
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment_status');
  const paymentId = urlParams.get('payment_id');
  
  if (paymentStatus === 'Completed' || window.location.pathname.includes('payment-success')) {
    // Recupera dati abbonamento salvati
    const pendingListing = sessionStorage.getItem('pendingPremiumListing');
    
    if (pendingListing) {
      try {
        const listingData = JSON.parse(pendingListing);
        
        // Pubblica come premium
        publishPremiumListing(listingData, paymentId);
        
        // Pulisci session storage
        sessionStorage.removeItem('pendingPremiumListing');
        
        // Mostra success
        showPaymentSuccessMessage();
        
        // Redirect alla homepage dopo 3 secondi
        setTimeout(() => {
          window.location.href = '#home';
          highlightNewestPremium();
        }, 3000);
        
      } catch (error) {
        console.error('❌ Errore parsing dati premium:', error);
        showToast('❌ Errore nel completare l\'inserimento premium', 'error');
      }
    }
  }
}

// Publish Premium Listing
function publishPremiumListing(listingData, paymentId = null) {
  // Aggiungi ID unico
  listingData.id = Date.now().toString();
  listingData.isPremium = true;
  listingData.paymentId = paymentId;
  listingData.premiumTimestamp = Date.now();
  
  // Aggiungi ai local abbonamenti
  abbonamenti.unshift(listingData); // Premium va in cima
  SafeStorage.set('abbonamenti', abbonamenti);
  
  // Sync con Firebase se disponibile
  if (db && auth.currentUser) {
    try {
      db.collection('abbonamenti').add({
        ...listingData,
        userId: auth.currentUser.uid,
        isLocalOnly: false
      }).then((docRef) => {
        console.log('✅ Premium abbonamento salvato su Firebase:', docRef.id);
      }).catch((error) => {
        console.log('⚠️ Errore Firebase, salvato solo localmente:', error.message);
      });
    } catch (error) {
      console.log('⚠️ Firebase non disponibile, salvato solo localmente');
    }
  }
  
  console.log('🔥 Abbonamento Premium pubblicato:', listingData);
}

// Show Payment Success Message
function showPaymentSuccessMessage() {
  // Crea modal success custom
  const successModal = document.createElement('div');
  successModal.className = 'modal';
  successModal.style.display = 'flex';
  successModal.style.justifyContent = 'center';
  successModal.style.alignItems = 'center';
  successModal.style.zIndex = '10000';
  
  successModal.innerHTML = `
    <div class="modal-content" style="text-align:center; max-width:400px; padding:30px;">
      <div class="success-animation" style="font-size:4em; margin-bottom:20px;">✅</div>
      <h2 style="color:#c8102e; margin-bottom:15px;">Pagamento Completato!</h2>
      <p style="margin-bottom:20px;">Il tuo abbonamento è stato pubblicato come <strong>Premium</strong></p>
      
      <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin:20px 0;">
        <div style="margin:5px 0;"><span>🔥</span> Sempre in TOP</div>
        <div style="margin:5px 0;"><span>✅</span> Badge Verificato</div>
        <div style="margin:5px 0;"><span>📈</span> 3x Più Visualizzazioni</div>
      </div>
      
      <div style="font-size:0.9em; color:#6c757d; margin-top:15px;">
        Redirect alla homepage tra <span id="countdown">3</span> secondi...
      </div>
    </div>
  `;
  
  document.body.appendChild(successModal);
  
  // Countdown
  let count = 3;
  const countdownEl = document.getElementById('countdown');
  const countdownInterval = setInterval(() => {
    count--;
    if (countdownEl) countdownEl.textContent = count;
    if (count <= 0) {
      clearInterval(countdownInterval);
      document.body.removeChild(successModal);
    }
  }, 1000);
}

// Highlight Newest Premium
function highlightNewestPremium() {
  setTimeout(() => {
    const premiumListings = document.querySelectorAll('.abbonamento-card.premium-listing');
    if (premiumListings.length > 0) {
      const newest = premiumListings[0];
      newest.scrollIntoView({ behavior: 'smooth', block: 'center' });
      newest.style.animation = 'premiumHighlight 3s ease-in-out';
      
      setTimeout(() => {
        newest.style.animation = '';
      }, 3000);
    }
  }, 500);
}

// Modified prenotaAbbonamento function to handle premium
const originalPrenotaAbbonamento = window.prenotaAbbonamento;
window.prenotaAbbonamento = function(event) {
  event.preventDefault();
  
  // Check se boost è selezionato
  const boostCheckbox = document.getElementById('premiumBoost');
  
  if (boostCheckbox && boostCheckbox.checked) {
    // 🔥 Flow Premium - Apri PayPal
    const formData = collectBookingFormData();
    if (formData) {
      openPayPalModal();
    }
  } else {
    // 📝 Flow Standard - Usa funzione originale
    if (originalPrenotaAbbonamento) {
      originalPrenotaAbbonamento(event);
    }
  }
};

// Modified loadAbbonamenti to handle premium sorting and display
const originalLoadAbbonamenti = window.loadAbbonamenti;
window.loadAbbonamenti = function() {
  // Chiama funzione originale
  if (originalLoadAbbonamenti) {
    originalLoadAbbonamenti();
  }
  
  // Applica premium sorting e styling
  setTimeout(() => {
    applyPremiumSorting();
    applyPremiumStyling();
  }, 100);
};

// Apply Premium Sorting
function applyPremiumSorting() {
  const container = document.querySelector('.abbonamenti-grid');
  if (!container) return;
  
  const cards = Array.from(container.children);
  
  // Sort: Premium first, then by timestamp
  cards.sort((a, b) => {
    const aIsPremium = a.dataset.isPremium === 'true';
    const bIsPremium = b.dataset.isPremium === 'true';
    
    if (aIsPremium && !bIsPremium) return -1;
    if (!aIsPremium && bIsPremium) return 1;
    
    // Se entrambi premium o entrambi standard, ordina per timestamp
    const aTimestamp = parseInt(a.dataset.timestamp) || 0;
    const bTimestamp = parseInt(b.dataset.timestamp) || 0;
    
    return bTimestamp - aTimestamp;
  });
  
  // Re-append sorted cards
  cards.forEach(card => container.appendChild(card));
}

// Apply Premium Styling
function applyPremiumStyling() {
  const abbonamenti = SafeStorage.get('abbonamenti') || [];
  
  document.querySelectorAll('.abbonamento-card').forEach(card => {
    const abbonamentoId = card.dataset.id;
    const abbonamento = abbonamenti.find(a => a.id === abbonamentoId);
    
    if (abbonamento && abbonamento.isPremium) {
      // Aggiungi classe premium
      card.classList.add('premium-listing');
      card.dataset.isPremium = 'true';
      
      // Aggiungi premium badge se non presente
      if (!card.querySelector('.premium-badge')) {
        const badge = document.createElement('div');
        badge.className = 'premium-badge';
        badge.innerHTML = '✨ UTENTE PREMIUM';
        card.appendChild(badge);
        
        // Aggiungi verified badge
        const verifiedBadge = document.createElement('div');
        verifiedBadge.className = 'verified-badge';
        verifiedBadge.innerHTML = '<span class="verified-icon">✓</span> Account Verificato';
        
        // Inserisci dopo il titolo
        const titleElement = card.querySelector('.abbonamento-title, .card-title, h3');
        if (titleElement && titleElement.parentNode) {
          titleElement.parentNode.insertBefore(verifiedBadge, titleElement.nextSibling);
        }
      }
    }
  });
}

// Initialize Payment Return Handler
document.addEventListener('DOMContentLoaded', function() {
  // Check per payment return
  handlePaymentReturn();
  
  // Setup boost checkbox se presente
  const boostCheckbox = document.getElementById('premiumBoost');
  if (boostCheckbox) {
    boostCheckbox.addEventListener('change', onBoostCheckboxChange);
  }
});

// CSS Animation per highlight
const style = document.createElement('style');
style.textContent = `
  @keyframes premiumHighlight {
    0%, 100% { transform: scale(1); box-shadow: 0 8px 25px rgba(255,215,0,0.2); }
    50% { transform: scale(1.03); box-shadow: 0 12px 35px rgba(255,215,0,0.4); }
  }
`;
document.head.appendChild(style);

console.log('🚀 Sistema Premium Boost inizializzato');

// ================================
// 🎄 SISTEMA LOTTERIA DI NATALE 2025
// ================================

// === CONFIGURAZIONE FIREBASE LOTTERY SYNC ===
const lotteryFirebaseConfig = {
  apiKey: "AIzaSyCOsWKsJLmkw5hf3MNzs8s3Nr6xqrbtw2M",
  authDomain: "ti-presto-abbonamenti.firebaseapp.com",
  projectId: "ti-presto-abbonamenti",
  storageBucket: "ti-presto-abbonamenti.firebasestorage.app",
  messagingSenderId: "527075945552",
  appId: "1:527075945552:web:9c8b7c1f5b2a8a9c1a2b3c"
};

// Storage sicuro anti-tracking (silenzioso)
const safeStorage = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      // Silenzioso - non logghiamo errori tracking prevention
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      // Silenzioso - gestione tracking prevention senza spam
      return false;
    }
  }
};

// Inizializza Firebase per lottery
let lotteryDB = null;
let lotteryRef = null;

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(lotteryFirebaseConfig);
  }
  lotteryDB = firebase.firestore();
  lotteryRef = lotteryDB.collection('lottery').doc('numbers');
  console.log('🔥 Firebase lottery configurato!');
} catch (error) {
  // Silenzioso - Firebase potrebbe non essere disponibile
  lotteryDB = null;
  lotteryRef = null;
}

// Stato globale della lotteria (sincronizzato con Firebase)
let lotteryState = {
  selectedNumbers: [],
  maxNumbers: 10,
  pricePerNumber: 5,
  totalNumbers: 90,
  soldNumbers: [], // Sincronizzato con Firebase
  extractionDate: new Date('2025-12-24T18:30:00'),
  purchasedNumbers: [], // Sincronizzato con Firebase
  isLoading: false
};

// Premi della lotteria
const lotteryPrizes = [
  { place: 1, prize: 'Giacca a vento Mikeli', value: '€89,90', description: 'Giacca a vento ufficiale Mikeli' },
  { place: 2, prize: 'Giacca a vento Mequo', value: '€89,90', description: 'Giacca a vento ufficiale Mequo' },
  { place: 3, prize: 'Pallone da allenamento', value: '€29,90', description: 'Pallone ufficiale Genoa CFC' }
];

// === FUNZIONI FIREBASE SYNC ===

// Dati iniziali lotteria (numeri pre-venduti in contanti)
const initialLotteryData = {
  soldNumbers: [5,25,36,6,10,16,4,28,66,9,57,8,89,29,22,69,13,35,59,90],
  purchasedNumbers: [
    { numbers: [5,25,36], buyerName: "Carlo Carletti", timestamp: Date.now(), method: "PayPal", total: 15 },
    { numbers: [6,10,16], buyerName: "Antonella Bruno", timestamp: Date.now(), method: "Contanti", total: 15 },
    { numbers: [4], buyerName: "Lina Galuppo", timestamp: Date.now(), method: "Contanti", total: 5 },
    { numbers: [28,66], buyerName: "Francesco Sidero", timestamp: Date.now(), method: "Contanti", total: 10 },
    { numbers: [9,57], buyerName: "Rocco Palmisano", timestamp: Date.now(), method: "Contanti", total: 10 },
    { numbers: [8], buyerName: "Francesca Dylan", timestamp: Date.now(), method: "Contanti", total: 5 },
    { numbers: [89,29], buyerName: "Laura Bruno", timestamp: Date.now(), method: "Contanti", total: 10 },
    { numbers: [22], buyerName: "Carla (Mamma Federico)", timestamp: Date.now(), method: "Contanti", total: 5 },
    { numbers: [69], buyerName: "Manuela Giordano", timestamp: Date.now(), method: "Contanti", total: 5 },
    { numbers: [13], buyerName: "Francesco Petronelli", timestamp: Date.now(), method: "Contanti", total: 5 },
    { numbers: [35], buyerName: "Ylenia Tarantino", timestamp: Date.now(), method: "Contanti", total: 5 },
    { numbers: [59], buyerName: "Giada Sidero", timestamp: Date.now(), method: "Contanti", total: 5 },
    { numbers: [90], buyerName: "Sidero Alessandro", timestamp: Date.now(), method: "Contanti", total: 5 }
  ],
  lastUpdate: Date.now()
};

// Inizializza Firebase Lottery
async function initLotteryFirebase() {
  if (!lotteryRef) {
    // Silenzioso fallback
    loadLotteryFromLocalStorage();
    return;
  }

  try {
    const doc = await lotteryRef.get();
    if (!doc.exists) {
      console.log('🎯 Inizializzo Firebase con dati lottery...');
      await lotteryRef.set(initialLotteryData);
    }
    
    // Avvia sync real-time
    startLotterySync();
    console.log('✅ Firebase lottery sync attivo!');
  } catch (error) {
    console.error('❌ Errore Firebase init:', error);
    loadLotteryFromLocalStorage();
  }
}

// Sincronizzazione real-time
function startLotterySync() {
  if (!lotteryRef) return;
  
  lotteryRef.onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      console.log('🔄 Sync lottery:', data.soldNumbers?.length || 0, 'numeri');
      
      lotteryState.soldNumbers = data.soldNumbers || [];
      lotteryState.purchasedNumbers = data.purchasedNumbers || [];
      
      // Aggiorna UI se modal è aperta
      if (document.getElementById('christmasLotteryModal')?.style.display === 'flex') {
        generateLotteryBoard();
        updatePurchasedNumbersList();
      }
    }
  }, (error) => {
    // Silenzioso fallback a localStorage
    loadLotteryFromLocalStorage();
  });
}

// Salva acquisto su Firebase
async function savePurchaseToFirebase(newPurchase) {
  if (!lotteryRef) {
    // Silenzioso fallback
    savePurchaseToLocalStorage(newPurchase);
    return false;
  }

  try {
    const doc = await lotteryRef.get();
    const data = doc.exists ? doc.data() : initialLotteryData;
    
    const updatedSoldNumbers = [...new Set([...data.soldNumbers, ...newPurchase.numbers])];
    const updatedPurchases = [...data.purchasedNumbers, newPurchase];
    
    await lotteryRef.update({
      soldNumbers: updatedSoldNumbers,
      purchasedNumbers: updatedPurchases,
      lastUpdate: Date.now()
    });
    
    console.log('✅ Acquisto salvato su Firebase!');
    return true;
  } catch (error) {
    // Silenzioso fallback 
    savePurchaseToLocalStorage(newPurchase);
    return false;
  }
}

// Fallback localStorage sicuro
function loadLotteryFromLocalStorage() {
  const stored = safeStorage.get('lotterySync');
  if (stored) {
    try {
      const data = JSON.parse(stored);
      lotteryState.soldNumbers = data.soldNumbers || initialLotteryData.soldNumbers;
      lotteryState.purchasedNumbers = data.purchasedNumbers || initialLotteryData.purchasedNumbers;
    } catch (e) {
      // Fallback silenzioso per dati corrotti
      lotteryState.soldNumbers = initialLotteryData.soldNumbers;
      lotteryState.purchasedNumbers = initialLotteryData.purchasedNumbers;
    }
  } else {
    lotteryState.soldNumbers = initialLotteryData.soldNumbers;
    lotteryState.purchasedNumbers = initialLotteryData.purchasedNumbers;
  }
  console.log('💾 Dati caricati da localStorage');
}

function savePurchaseToLocalStorage(newPurchase) {
  lotteryState.soldNumbers = [...new Set([...lotteryState.soldNumbers, ...newPurchase.numbers])];
  lotteryState.purchasedNumbers.push(newPurchase);
  
  const success = safeStorage.set('lotterySync', JSON.stringify({
    soldNumbers: lotteryState.soldNumbers,
    purchasedNumbers: lotteryState.purchasedNumbers
  }));
  
  if (success) {
    console.log('💾 Salvato su localStorage');
  }
  // Silenzioso se storage bloccato
}

// === FUNZIONI FIREBASE LOTTERY SYNC ===

// Inizializza Firebase Lottery con dati predefiniti
async function initializeLotteryFirebase() {
  try {
    const doc = await lotteryRef.get();
    if (!doc.exists) {
      console.log('🎯 Inizializzo Firebase con dati lottery iniziali...');
      await lotteryRef.set(initialLotteryData);
      console.log('✅ Firebase lottery inizializzato!');
    }
    startLotterySync();
  } catch (error) {
    console.error('❌ Errore inizializzazione Firebase:', error);
    // Fallback a localStorage se Firebase non funziona
    loadLotteryFromLocalStorage();
  }
}

// Sincronizzazione real-time con Firebase
function startLotterySync() {
  lotteryRef.onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      console.log('🔄 Aggiornamento lottery da Firebase:', data);
      
      lotteryState.soldNumbers = data.soldNumbers || [];
      lotteryState.purchasedNumbers = data.purchasedNumbers || [];
      
      // Aggiorna UI se modal lottery è aperta
      if (document.getElementById('lotteryModal').style.display === 'flex') {
        updateLotteryBoard();
        updatePurchasedNumbersList();
      }
      
      console.log(`🎯 ${data.soldNumbers?.length || 0} numeri sincronizzati`);
    }
  }, (error) => {
    console.error('❌ Errore sync Firebase:', error);
    loadLotteryFromLocalStorage();
  });
}

// Salva acquisto su Firebase
async function savePurchaseToFirebase(newPurchase) {
  try {
    const doc = await lotteryRef.get();
    const currentData = doc.exists ? doc.data() : initialLotteryData;
    
    // Aggiorna numeri venduti
    const updatedSoldNumbers = [...new Set([...currentData.soldNumbers, ...newPurchase.numbers])];
    
    // Aggiungi nuovo acquisto
    const updatedPurchases = [...currentData.purchasedNumbers, newPurchase];
    
    await lotteryRef.update({
      soldNumbers: updatedSoldNumbers,
      purchasedNumbers: updatedPurchases,
      lastUpdate: Date.now()
    });
    
    console.log('✅ Acquisto salvato su Firebase:', newPurchase);
    return true;
  } catch (error) {
    console.error('❌ Errore salvataggio Firebase:', error);
    return false;
  }
}

// Fallback localStorage
function loadLotteryFromLocalStorage() {
  const stored = localStorage.getItem('lotteryState');
  if (stored) {
    const data = JSON.parse(stored);
    lotteryState.soldNumbers = data.soldNumbers || initialLotteryData.soldNumbers;
    lotteryState.purchasedNumbers = data.purchasedNumbers || initialLotteryData.purchasedNumbers;
  } else {
    lotteryState.soldNumbers = initialLotteryData.soldNumbers;
    lotteryState.purchasedNumbers = initialLotteryData.purchasedNumbers;
  }
}

// Salva su localStorage come backup
function saveLotteryToLocalStorage() {
  localStorage.setItem('lotteryState', JSON.stringify({
    soldNumbers: lotteryState.soldNumbers,
    purchasedNumbers: lotteryState.purchasedNumbers
  }));
}

// Inizializza lotteria
function initChristmasLottery() {
  loadLotteryState();
  console.log('🎄 Sistema Lotteria di Natale 2025 inizializzato');
}

// Carica stato lotteria
function loadLotteryState() {
  try {
    const saved = localStorage.getItem('christmasLotteryState');
    if (saved) {
      const savedState = JSON.parse(saved);
      lotteryState = { ...lotteryState, ...savedState };
    }
  } catch (error) {
    console.error('❌ Errore caricamento stato lotteria:', error);
  }
}

// Salva stato lotteria
function saveLotteryState() {
  try {
    localStorage.setItem('christmasLotteryState', JSON.stringify(lotteryState));
  } catch (error) {
    console.error('❌ Errore salvataggio stato:', error);
  }
}

// Apre modal lotteria con Firebase sync
function openChristmasLottery() {
  createLotteryModal();
  
  const modal = document.getElementById('christmasLotteryModal');
  if (modal) {
    modal.style.display = 'flex';
    
    // Inizializza Firebase sync se non già fatto
    if (!window.lotteryFirebaseInitialized) {
      initLotteryFirebase();
      window.lotteryFirebaseInitialized = true;
    }
    
    // Genera la griglia dopo un breve delay
    setTimeout(() => {
      generateLotteryBoard();
      updateLotteryUI();
      
      console.log('🎯 Lottery aperta - Firebase sync attivo!');
      console.log('🎯 Lottery aperta - Firebase sync attivo!');
    }, 100);
  }
}

// Crea il modal della lotteria
function createLotteryModal() {
  if (document.getElementById('christmasLotteryModal')) {
    return; // Modal già creato
  }
  
  const modalHTML = `
    <div id="christmasLotteryModal" class="modal" style="display: none; z-index: 10000;">
      <div class="lottery-modal-content" style="
        background: white;
        border-radius: 20px;
        padding: 0;
        max-width: 95vw;
        max-height: 95vh;
        width: 1000px;
        overflow: hidden;
        position: relative;
      ">
        <!-- Header -->
        <div style="
          background: linear-gradient(135deg, #c8102e 0%, #002147 100%);
          color: white;
          padding: 25px;
          text-align: center;
          position: relative;
        ">
          <span class="close" onclick="closeModal('christmasLotteryModal')" style="
            position: absolute;
            top: 15px;
            right: 20px;
            color: white;
            font-size: 28px;
            cursor: pointer;
          ">×</span>
          
          <h2 style="margin: 0; font-size: 2rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
            🎄 LOTTERIA DI NATALE 2025 🎄
          </h2>
          <p style="margin: 10px 0 0 0; opacity: 0.95;">
            Scegli i tuoi numeri fortunati • €5 per numero • Estrazione 24 Dicembre
          </p>
        </div>

        <!-- Contenuto scrollabile -->
        <div class="lottery-content" style="
          max-height: calc(95vh - 200px);
          overflow-y: auto;
          padding: 25px;
        ">
          <!-- Locandina Lotteria -->
          <div style="text-align: center; margin-bottom: 25px;">
            <img src="img/locandina lotteria.png" alt="Locandina Lotteria Natale 2025" style="
              max-width: 100%;
              height: auto;
              border-radius: 15px;
              box-shadow: 0 8px 25px rgba(0,0,0,0.2);
              border: 3px solid #c8102e;
            " />
          </div>

          <!-- Griglia Numeri e Lista Acquisti -->
          <div class="lottery-grid-container" style="display: flex; gap: 25px; margin-bottom: 25px; align-items: flex-start;">
            
            <!-- Griglia Numeri (Sinistra) -->
            <div style="flex: 1; min-width: 400px;">
              <h3 style="color: #002147; margin-bottom: 15px;">Seleziona i tuoi numeri (max ${lotteryState.maxNumbers})</h3>
              <div id="lotteryBoard" style="
                display: grid;
                grid-template-columns: repeat(10, 1fr);
                gap: 8px;
                max-width: 600px;
                margin: 0 auto;
              "></div>
            </div>
            
            <!-- Lista Numeri Acquistati (Destra) -->
            <div style="flex: 0 0 300px; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 12px; padding: 20px;">
              <h3 style="color: #002147; margin: 0 0 15px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                🎯 <span>Numeri Acquistati</span>
              </h3>
              
              <div id="purchasedNumbersList" style="
                max-height: 300px;
                overflow-y: auto;
                background: white;
                border-radius: 8px;
                padding: 10px;
                border: 1px solid #dee2e6;
              ">
                <p style="text-align: center; color: #6c757d; font-style: italic; margin: 20px 0;">
                  Nessun numero acquistato ancora...
                </p>
              </div>
              
              <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 8px; font-size: 0.85rem; color: #1565c0;">
                💡 <strong>Legenda:</strong><br>
                🔵 Selezionato • 🔘 Disponibile • ⚫ Venduto
              </div>
            </div>
            
          </div>

          <!-- Numeri Selezionati -->
          <div id="selectedNumbersDisplay" style="
            background: #e8f5e8;
            border: 2px solid #28a745;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 25px;
            text-align: center;
            display: none;
          ">
            <h4 style="margin: 0 0 10px 0; color: #155724;">I tuoi numeri:</h4>
            <div id="selectedNumbersList" style="font-size: 1.2rem; font-weight: bold;"></div>
          </div>

          <!-- Form Dati Acquirente -->
          <div class="buyer-form" style="
            background: white;
            border: 2px solid #dee2e6;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 25px;
          ">
            <h3 style="margin: 0 0 20px 0; color: #002147;">📝 I tuoi dati</h3>
            
            <div style="display: grid; gap: 15px;">
              <div>
                <label for="buyerName" style="display: block; margin-bottom: 5px; font-weight: bold;">Nome e Cognome *</label>
                <input type="text" id="buyerName" placeholder="Mario Rossi" required style="
                  width: 100%;
                  padding: 12px;
                  border: 2px solid #dee2e6;
                  border-radius: 8px;
                  font-size: 1rem;
                ">
              </div>
              
              <div>
                <label for="buyerEmail" style="display: block; margin-bottom: 5px; font-weight: bold;">Email *</label>
                <input type="email" id="buyerEmail" placeholder="mario.rossi@email.com" required style="
                  width: 100%;
                  padding: 12px;
                  border: 2px solid #dee2e6;
                  border-radius: 8px;
                  font-size: 1rem;
                ">
              </div>
              
              <div>
                <label for="buyerPhone" style="display: block; margin-bottom: 5px; font-weight: bold;">Telefono *</label>
                <input type="tel" id="buyerPhone" placeholder="+39 333 1234567" required style="
                  width: 100%;
                  padding: 12px;
                  border: 2px solid #dee2e6;
                  border-radius: 8px;
                  font-size: 1rem;
                ">
              </div>
            </div>
          </div>

          <!-- Checkout -->
          <div id="lotteryCheckout" style="
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border-radius: 15px;
            padding: 20px;
            text-align: center;
            display: none;
          ">
            <h3 style="margin: 0 0 15px 0;">💳 Procedi al Pagamento</h3>
            <div style="font-size: 1.5rem; font-weight: bold; margin-bottom: 15px;">
              Totale: <span id="checkoutAmount">€0,00</span>
            </div>
            <button id="paypalCheckoutBtn" class="lottery-checkout-btn" disabled style="
              background: #0070ba;
              color: white;
              border: none;
              padding: 15px 30px;
              font-size: 1.2rem;
              font-weight: bold;
              border-radius: 25px;
              cursor: pointer;
              transition: all 0.3s ease;
              opacity: 0.6;
            ">
              📝 Completa i dati per continuare
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Setup event listeners
  setupLotteryEventListeners();
}

// Setup event listeners
function setupLotteryEventListeners() {
  document.addEventListener('click', handleLotteryClicks);
}

// Gestisce click nella lotteria
function handleLotteryClicks(event) {
  const target = event.target;
  
  // Click su numero
  if (target.classList.contains('lottery-number') && !target.classList.contains('sold')) {
    const number = parseInt(target.textContent);
    toggleNumberSelection(number);
  }
  
  // Pulsante checkout
  if (target.id === 'paypalCheckoutBtn' && !target.disabled) {
    processLotteryPayment();
  }
}

// Genera griglia numeri
function generateLotteryBoard() {
  const board = document.getElementById('lotteryBoard');
  if (!board) return;
  
  board.innerHTML = '';
  
  for (let i = 1; i <= lotteryState.totalNumbers; i++) {
    const numberBtn = document.createElement('div');
    numberBtn.className = 'lottery-number';
    numberBtn.textContent = i;
    
    // Determina lo stato del numero
    const isSold = lotteryState.soldNumbers.includes(i);
    const isSelected = lotteryState.selectedNumbers.includes(i);
    
    numberBtn.style.cssText = `
      aspect-ratio: 1;
      background: ${isSold ? '#6c757d' : isSelected ? '#28a745' : '#f8f9fa'};
      color: ${isSold || isSelected ? 'white' : '#333'};
      border: 2px solid ${isSold ? '#6c757d' : isSelected ? '#28a745' : '#dee2e6'};
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: ${isSold ? 'not-allowed' : 'pointer'};
      font-weight: bold;
      transition: all 0.3s ease;
      font-size: 0.9rem;
      opacity: ${isSold ? '0.8' : '1'};
    `;
    
    if (isSold) {
      numberBtn.classList.add('sold');
      numberBtn.title = 'Numero venduto';
      // Aggiungi icona venduto
      numberBtn.innerHTML = `${i}<span style="position: absolute; font-size: 0.6em; color: white;">✓</span>`;
      numberBtn.style.position = 'relative';
    }
    
    board.appendChild(numberBtn);
  }
  
  console.log(`🔍 Griglia aggiornata: ${lotteryState.soldNumbers.length} numeri venduti (grigi)`, lotteryState.soldNumbers);
}

// Toggle selezione numero
function toggleNumberSelection(number) {
  if (lotteryState.soldNumbers.includes(number)) {
    showToast('Questo numero è già stato venduto', 'error');
    return;
  }
  
  const index = lotteryState.selectedNumbers.indexOf(number);
  
  if (index === -1) {
    // Aggiungi numero
    if (lotteryState.selectedNumbers.length >= lotteryState.maxNumbers) {
      showToast(`Puoi selezionare al massimo ${lotteryState.maxNumbers} numeri`, 'warning');
      return;
    }
    lotteryState.selectedNumbers.push(number);
  } else {
    // Rimuovi numero
    lotteryState.selectedNumbers.splice(index, 1);
  }
  
  saveLotteryState();
  updateLotteryUI();
}

// Aggiorna UI lotteria
function updateLotteryUI() {
  generateLotteryBoard();
  
  const selectedDisplay = document.getElementById('selectedNumbersDisplay');
  const selectedList = document.getElementById('selectedNumbersList');
  
  if (lotteryState.selectedNumbers.length > 0) {
    selectedDisplay.style.display = 'block';
    selectedList.textContent = lotteryState.selectedNumbers.sort((a, b) => a - b).join(', ');
  } else {
    selectedDisplay.style.display = 'none';
  }
  
  updateCheckoutState();
  updatePurchasedNumbersList(); // Aggiorna sempre la lista acquisti
}

// Aggiorna stato checkout
function updateCheckoutState() {
  const checkout = document.getElementById('lotteryCheckout');
  const checkoutBtn = document.getElementById('paypalCheckoutBtn');
  const checkoutAmount = document.getElementById('checkoutAmount');
  
  console.log('🔍 updateCheckoutState chiamata - elementi DOM:', {
    checkout: !!checkout,
    checkoutBtn: !!checkoutBtn,
    checkoutAmount: !!checkoutAmount
  });
  
  if (!checkout || !checkoutBtn || !checkoutAmount) {
    console.log('❌ Alcuni elementi DOM mancanti, riprovo tra 100ms');
    setTimeout(updateCheckoutState, 100);
    return;
  }
  
  const selectedCount = lotteryState.selectedNumbers.length;
  const totalAmount = selectedCount * lotteryState.pricePerNumber;
  const isFormValid = validateBuyerForm(false);
  
  console.log('🔍 Stato checkout:', {
    numeriSelezionati: selectedCount,
    importoTotale: totalAmount,
    formValido: isFormValid,
    pulsanteAbilitato: selectedCount > 0 && isFormValid
  });
  
  if (selectedCount > 0) {
    checkout.style.display = 'block';
    checkoutAmount.textContent = `€${totalAmount},00`;
    
    const canCheckout = selectedCount > 0 && isFormValid;
    checkoutBtn.disabled = !canCheckout;
    
    if (canCheckout) {
      checkoutBtn.innerHTML = `💳 Paga con PayPal - €${totalAmount},00`;
      checkoutBtn.style.opacity = '1';
      console.log('✅ Pulsante PayPal ABILITATO');
    } else {
      checkoutBtn.innerHTML = '📝 Completa i dati per continuare';
      checkoutBtn.style.opacity = '0.6';
      console.log('⏳ Pulsante PayPal in attesa dati form');
    }
  } else {
    checkout.style.display = 'none';
    console.log('🔄 Nessun numero selezionato, checkout nascosto');
  }
}

// Valida form acquirente
function validateBuyerForm(showErrors = true) {
  const name = document.getElementById('buyerName');
  const email = document.getElementById('buyerEmail');
  const phone = document.getElementById('buyerPhone');
  
  if (!name || !email || !phone) {
    console.log('⚠️ Elementi form non trovati:', {name: !!name, email: !!email, phone: !!phone});
    return false;
  }
  
  const nameValid = name.value.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
  const phoneValid = phone.value.trim().length >= 8;
  
  const isValid = nameValid && emailValid && phoneValid;
  
  console.log('🔍 Validazione form:', {
    nome: nameValid ? '✅' : `❌ (${name.value.trim().length}/2)`,
    email: emailValid ? '✅' : '❌',
    telefono: phoneValid ? '✅' : `❌ (${phone.value.trim().length}/8)`,
    tuttoValido: isValid ? '✅' : '❌'
  });
  
  if (showErrors && !isValid) {
    let errorMsg = 'Correggi i seguenti campi:\n';
    if (!nameValid) errorMsg += '• Nome (minimo 2 caratteri)\n';
    if (!emailValid) errorMsg += '• Email (formato non valido)\n';
    if (!phoneValid) errorMsg += '• Telefono (minimo 8 caratteri)\n';
    showToast(errorMsg.trim(), 'warning');
  }
  
  return isValid;
}

// Aggiorna la lista dei numeri acquistati visualizzata
function updatePurchasedNumbersList() {
  const listContainer = document.getElementById('purchasedNumbersList');
  if (!listContainer) return;
  
  if (!lotteryState.purchasedNumbers || lotteryState.purchasedNumbers.length === 0) {
    listContainer.innerHTML = `
      <p style="text-align: center; color: #6c757d; font-style: italic; margin: 20px 0;">
        Nessun numero acquistato ancora...
      </p>
    `;
    return;
  }
  
  // Raggruppa i numeri per acquirente e ordina per timestamp
  const sortedPurchases = [...lotteryState.purchasedNumbers].sort((a, b) => b.timestamp - a.timestamp);
  
  const purchasesHTML = sortedPurchases.map(purchase => {
    // Ordina i numeri numericamente
    const sortedNumbers = [...purchase.numbers].sort((a, b) => a - b);
    const numbersText = sortedNumbers.join(', ');
    
    // Formato data/ora
    const date = new Date(purchase.timestamp);
    const timeStr = date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit', 
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `
      <div style="
        border-bottom: 1px solid #e9ecef;
        padding: 8px 0;
        margin-bottom: 8px;
      ">
        <div style="font-weight: bold; color: #002147; margin-bottom: 2px;">
          👤 ${purchase.buyerName}
        </div>
        <div style="color: #c8102e; font-weight: 500; margin-bottom: 2px;">
          🎯 Numeri: ${numbersText}
        </div>
        <div style="font-size: 0.75rem; color: #6c757d;">
          🕐 ${timeStr}
        </div>
      </div>
    `;
  }).join('');
  
  listContainer.innerHTML = purchasesHTML;
}

// Processa pagamento lotteria
function processLotteryPayment() {
  if (!validateBuyerForm()) {
    return;
  }
  
  const name = document.getElementById('buyerName').value.trim();
  const email = document.getElementById('buyerEmail').value.trim();
  const phone = document.getElementById('buyerPhone').value.trim();
  
  const totalAmount = lotteryState.selectedNumbers.length * lotteryState.pricePerNumber;
  
  // DEBUG: Controllo calcolo importo
  console.log('🔍 DEBUG CALCOLO IMPORTO:');
  console.log('➤ Numeri selezionati:', lotteryState.selectedNumbers.length);
  console.log('➤ Prezzo per numero:', lotteryState.pricePerNumber);
  console.log('➤ Totale calcolato:', totalAmount);
  console.log('➤ Numeri selezionati:', lotteryState.selectedNumbers);
  
  // Dati per PayPal
  const paymentData = {
    type: 'christmas-lottery',
    numbers: [...lotteryState.selectedNumbers],
    amount: totalAmount,
    buyer: { name, email, phone },
    timestamp: Date.now()
  };
  
  // Salva dati per il ritorno da PayPal
  localStorage.setItem('lotteryPaymentData', JSON.stringify(paymentData));
  
  // Crea e invia form PayPal con return URL
  createPayPalForm(paymentData);
}

// Crea form PayPal con return URL automatico
function createPayPalForm(paymentData) {
  // Rimuovi form esistente se presente
  const existingForm = document.getElementById('lotteryPayPalForm');
  if (existingForm) {
    existingForm.remove();
  }
  
  // DEBUG: Controllo dati PayPal
  console.log('🔍 DEBUG FORM PAYPAL:');
  console.log('➤ Amount nel paymentData:', paymentData.amount);
  console.log('➤ Type of amount:', typeof paymentData.amount);
  console.log('➤ Amount formattato per PayPal:', parseFloat(paymentData.amount).toFixed(2));
  console.log('➤ Quantità (numero di numeri):', paymentData.numbers.length);
  console.log('➤ Numeri:', paymentData.numbers);
  console.log('➤ PaymentData completo:', paymentData);
  
  // URL di ritorno automatico - dominio reale
  const returnUrl = 'https://www.tiprestogenoa.it/index.html?lottery=success';
  const cancelUrl = 'https://www.tiprestogenoa.it/index.html?lottery=cancelled';
  
  // PROVA CON QUANTITÀ invece di amount variabile (se PayPal form è configurato a 5€ fisso)
  const numberOfNumbers = paymentData.numbers.length;
  
  // Crea form PayPal Standard per importi variabili
  const formHTML = `
    <form id="lotteryPayPalForm" action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_self">
      <input type="hidden" name="cmd" value="_xclick" />
      <input type="hidden" name="business" value="sideroalessandro90@gmail.com" />
      <input type="hidden" name="item_name" value="Lotteria Natale 2025 - Numeri: ${paymentData.numbers.join(', ')}" />
      <input type="hidden" name="item_number" value="LOTTERY_${Date.now()}" />
      <input type="hidden" name="amount" value="${paymentData.amount}" />
      <input type="hidden" name="quantity" value="1" />
      <input type="hidden" name="currency_code" value="EUR" />
      <input type="hidden" name="return" value="${returnUrl}" />
      <input type="hidden" name="cancel_return" value="${cancelUrl}" />
      <input type="hidden" name="custom" value="${JSON.stringify(paymentData).replace(/"/g, '&quot;')}" />
      <input type="submit" value="Reindirizzamento a PayPal..." style="display: none;" />
    </form>
  `;
  
  document.body.insertAdjacentHTML('beforeend', formHTML);
  
  // DEBUG: Verifica tutti i campi del form prima dell'invio
  setTimeout(() => {
    const form = document.getElementById('lotteryPayPalForm');
    if (form) {
      console.log('🔍 DEBUG FORM PAYPAL - CAMPI INVIATI:');
      const formData = new FormData(form);
      for (let [key, value] of formData.entries()) {
        console.log(`➤ ${key}: ${value}`);
      }
      console.log('➤ Numero di numeri selezionati:', numberOfNumbers);
    }
  }, 100);
  
  showToast('Reindirizzamento a PayPal...', 'info');
  
  // Invia automaticamente il form
  setTimeout(() => {
    document.getElementById('lotteryPayPalForm').submit();
  }, 1000);
}

// Chiude modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

// Gestisce ritorno automatico da PayPal
function handleLotteryPaymentReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Controlla se torniamo da PayPal con il nuovo parametro
  if (urlParams.has('lottery')) {
    const paymentStatus = urlParams.get('lottery');
    
    // Recupera dati pagamento salvati
    const savedPaymentData = safeStorage.get('lotteryPaymentData');
    
    if (paymentStatus === 'success' && savedPaymentData) {
      try {
        const paymentData = JSON.parse(savedPaymentData);
        
        console.log('✅ Ritorno da PayPal - Pagamento completato:', paymentData);
        
        // Crea oggetto acquisto
        const purchaseRecord = {
          numbers: [...paymentData.numbers],
          buyerName: paymentData.buyer.name,
          timestamp: paymentData.timestamp,
          method: 'PayPal',
          total: paymentData.total
        };
        
        // Salva su Firebase (sync automatico)
        savePurchaseToFirebase(purchaseRecord).then(saved => {
          if (saved) {
            console.log('🔥 Acquisto sincronizzato con Firebase');
          } else {
            console.log('💾 Acquisto salvato in localStorage');
          }
          
          // Reset selezione
          lotteryState.selectedNumbers = [];
          
          // Pulisci dati temporanei  
          safeStorage.set('lotteryPaymentData', ''); // Rimuovi dati
          
          // Mostra successo
          showToast(
            `🎄 Pagamento completato con successo!\n\nNumeri acquistati: ${paymentData.numbers.join(', ')}\n\nI tuoi numeri sono ora riservati per tutti!`, 
            'success', 
            8000
          );
          
          // Aggiorna UI se lottery aperta
          if (document.getElementById('christmasLotteryModal')?.style.display === 'flex') {
            generateLotteryBoard();
            updatePurchasedNumbersList();
          }
        });
        
        // Rimuovi parametri URL
        const cleanUrl = window.location.href.split('?')[0];
        window.history.replaceState({}, document.title, cleanUrl);
        
      } catch (error) {
        console.error('❌ Errore processing ritorno PayPal:', error);
        showToast('Errore nella conferma del pagamento. Contatta il supporto.', 'error');
      }
      
    } else if (paymentStatus === 'cancelled') {
      console.log('⚠️ Pagamento PayPal annullato dall\'utente');
      
      // Pulisci dati temporanei
      localStorage.removeItem('lotteryPaymentData');
      
      showToast('Pagamento annullato. I numeri restano disponibili.', 'info', 4000);
      
      // Rimuovi parametri URL
      const cleanUrl = window.location.href.split('?')[0];
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }
}

// Salva acquisto lotteria su Firebase
function saveLotteryPurchase(data) {
  try {
    if (typeof addDoc === 'function' && typeof collection === 'function') {
      addDoc(collection(db, 'lottery_purchases'), {
        ...data,
        createdAt: new Date()
      }).then(() => {
        console.log('✅ Acquisto lotteria salvato su Firebase');
      }).catch(error => {
        console.error('❌ Errore salvataggio acquisto:', error);
      });
    }
  } catch (error) {
    console.error('❌ Firebase non disponibile:', error);
  }
}

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
  initChristmasLottery();
  handleLotteryPaymentReturn();
});

// Rendi la funzione accessibile globalmente per l'HTML
window.openChristmasLottery = openChristmasLottery;

console.log('🎄 Sistema Lotteria di Natale 2025 caricato!');

