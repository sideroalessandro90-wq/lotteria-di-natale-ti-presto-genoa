// === LOTTERIA NATALE 2025 - SISTEMA FIREBASE COMPLETO ===
// Auto-inizializzazione Firebase + localStorage fallback
// Data: 11 dicembre 2025

console.log('🎄 Sistema lotteria Firebase avviato');

// Stato globale della lotteria
let lotteryState = {
  selectedNumbers: [],
  maxNumbers: 10,
  pricePerNumber: 5,
  totalNumbers: 90,
  soldNumbers: [], // Numeri venduti
  extractionDate: new Date('2025-12-24T18:30:00'),
  purchasedNumbers: [], // Acquisti effettuati
  isLoading: false
};

// Firebase references (inizializzate nell'HTML)
let db = null;
let lotteryRef = null;

// Premi della lotteria
const lotteryPrizes = [
  { place: 1, prize: 'Giacca a vento Mikeli', value: '€89,90', description: 'Giacca a vento ufficiale Mikeli' },
  { place: 2, prize: 'Giacca a vento Mequo', value: '€89,90', description: 'Giacca a vento ufficiale Mequo' },
  { place: 3, prize: 'Pallone da allenamento', value: '€29,90', description: 'Pallone ufficiale Genoa CFC' }
];

// === DATI PRE-VENDITE ===
const initialLotteryData = {
  soldNumbers: [6,10,16,4,28,66,9,57,8,89,29,22,69,13,35,59,90],
  purchasedNumbers: [
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
  lastUpdate: Date.now(),
  initialized: true
};

// === INIZIALIZZAZIONE FIREBASE AUTO ===

async function initializeFirebaseLottery() {
  try {
    if (!window.firebase || !window.firebase.firestore) {
      throw new Error('Firebase non disponibile');
    }
    
    db = window.firebase.firestore();
    lotteryRef = db.collection('lottery').doc('christmas2025');
    
    console.log('🔥 Connessione Firebase attiva');
    
    // Controlla se già esiste
    const doc = await lotteryRef.get();
    
    if (!doc.exists) {
      console.log('🎯 Primo accesso - Inizializzo Firebase con dati prevendite...');
      
      // Crea documento con dati iniziali
      await lotteryRef.set(initialLotteryData);
      console.log('✅ Firebase inizializzato con 17 numeri prevenduti!');
      
      // Aggiorna stato locale
      lotteryState.soldNumbers = initialLotteryData.soldNumbers;
      lotteryState.purchasedNumbers = initialLotteryData.purchasedNumbers;
    } else {
      console.log('🔄 Caricamento dati esistenti da Firebase...');
      const data = doc.data();
      
      lotteryState.soldNumbers = data.soldNumbers || [];
      lotteryState.purchasedNumbers = data.purchasedNumbers || [];
      console.log(`📊 Caricati ${lotteryState.soldNumbers.length} numeri venduti`);
    }
    
    // Avvia sync real-time
    startRealTimeSync();
    return true;
    
  } catch (error) {
    console.error('❌ Errore Firebase, uso localStorage:', error);
    loadLotteryFromLocalStorage();
    return false;
  }
}

// === SYNC REAL-TIME ===

function startRealTimeSync() {
  if (!lotteryRef) return;
  
  console.log('🔄 Sync real-time attivato');
  
  lotteryRef.onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      
      // Aggiorna stato solo se ci sono cambiamenti
      const oldCount = lotteryState.soldNumbers.length;
      lotteryState.soldNumbers = data.soldNumbers || [];
      lotteryState.purchasedNumbers = data.purchasedNumbers || [];
      
      const newCount = lotteryState.soldNumbers.length;
      
      if (newCount !== oldCount && typeof updateUI === 'function') {
        updateUI();
        if (typeof updatePurchasesList === 'function') {
          updatePurchasesList();
        }
        
        if (newCount > oldCount) {
          console.log(`🎯 Nuovi acquisti! Totale numeri: ${newCount}`);
          if (typeof showToast === 'function') {
            showToast(`Aggiornamento: ${newCount - oldCount} nuovi numeri venduti!`, 'info', 3000);
          }
        }
      }
    }
  }, (error) => {
    console.error('❌ Errore sync real-time:', error);
    if (typeof showToast === 'function') {
      showToast('Connessione Firebase persa, uso dati locali', 'warning');
    }
  });
}

// === GESTIONE ACQUISTI ===

async function savePurchaseToFirebase(newPurchase) {
  try {
    if (!lotteryRef) {
      throw new Error('Firebase non inizializzato');
    }
    
    // Leggi stato attuale
    const doc = await lotteryRef.get();
    const currentData = doc.exists ? doc.data() : initialLotteryData;
    
    // Verifica che i numeri non siano già venduti
    const conflicts = newPurchase.numbers.filter(num => 
      currentData.soldNumbers.includes(num)
    );
    
    if (conflicts.length > 0) {
      if (typeof showToast === 'function') {
        showToast(`Numeri ${conflicts.join(', ')} già venduti!`, 'error');
      }
      return false;
    }
    
    // Aggiorna dati
    const updatedSoldNumbers = [...new Set([...currentData.soldNumbers, ...newPurchase.numbers])];
    const updatedPurchases = [...currentData.purchasedNumbers, newPurchase];
    
    // Salva su Firebase
    await lotteryRef.update({
      soldNumbers: updatedSoldNumbers,
      purchasedNumbers: updatedPurchases,
      lastUpdate: Date.now()
    });
    
    console.log('✅ Acquisto salvato su Firebase:', newPurchase);
    
    // Backup locale
    saveLotteryToLocalStorage();
    
    return true;
    
  } catch (error) {
    console.error('❌ Errore salvataggio Firebase:', error);
    
    // Fallback localStorage
    savePurchaseLocally(newPurchase);
    
    if (typeof showToast === 'function') {
      showToast('Salvato localmente (Firebase offline)', 'warning');
    }
    
    return false;
  }
}

// === FALLBACK LOCALSTORAGE ===

function loadLotteryFromLocalStorage() {
  const stored = localStorage.getItem('christmasLotteryState');
  if (stored) {
    try {
      const data = JSON.parse(stored);
      lotteryState.soldNumbers = data.soldNumbers || initialLotteryData.soldNumbers;
      lotteryState.purchasedNumbers = data.purchasedNumbers || initialLotteryData.purchasedNumbers;
    } catch (e) {
      lotteryState.soldNumbers = initialLotteryData.soldNumbers;
      lotteryState.purchasedNumbers = initialLotteryData.purchasedNumbers;
    }
  } else {
    lotteryState.soldNumbers = initialLotteryData.soldNumbers;
    lotteryState.purchasedNumbers = initialLotteryData.purchasedNumbers;
  }
  console.log(`💾 Caricati ${lotteryState.soldNumbers.length} numeri da localStorage`);
}

function saveLotteryToLocalStorage() {
  try {
    localStorage.setItem('christmasLotteryState', JSON.stringify({
      soldNumbers: lotteryState.soldNumbers,
      purchasedNumbers: lotteryState.purchasedNumbers,
      lastUpdate: Date.now()
    }));
  } catch (error) {
    console.error('❌ Errore localStorage:', error);
  }
}

function savePurchaseLocally(newPurchase) {
  // Aggiungi numeri venduti (rimuovi duplicati)
  lotteryState.soldNumbers = [...new Set([...lotteryState.soldNumbers, ...newPurchase.numbers])];
  
  // Aggiungi acquisto alla lista
  lotteryState.purchasedNumbers.push(newPurchase);
  
  // Salva su localStorage
  saveLotteryToLocalStorage();
  
  console.log('✅ Acquisto salvato localmente:', newPurchase);
}

// === GESTIONE PAGAMENTI ===

function handleLotteryPaymentReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.has('lottery')) {
    const paymentStatus = urlParams.get('lottery');
    const savedPaymentData = localStorage.getItem('lotteryPaymentData');
    
    if (paymentStatus === 'success' && savedPaymentData) {
      try {
        const paymentData = JSON.parse(savedPaymentData);
        
        console.log('✅ Ritorno da PayPal - Pagamento completato:', paymentData);
        
        const purchaseRecord = {
          numbers: [...paymentData.numbers],
          buyerName: paymentData.buyer.name,
          timestamp: paymentData.timestamp,
          method: 'PayPal',
          total: paymentData.total
        };
        
        // Prova Firebase prima, poi localStorage
        savePurchaseToFirebase(purchaseRecord);
        
        // Reset
        if (typeof window.selectedNumbers !== 'undefined') {
          window.selectedNumbers = [];
        }
        localStorage.removeItem('lotteryPaymentData');
        
        // Mostra successo
        if (typeof showToast === 'function') {
          showToast(
            `🎄 Pagamento completato!\nNumeri acquistati: ${paymentData.numbers.join(', ')}\nTutti gli utenti vedranno l'aggiornamento!`, 
            'success', 
            8000
          );
        }
        
        // Aggiorna UI
        if (typeof updateUI === 'function') {
          setTimeout(updateUI, 500);
        }
        if (typeof updatePurchasesList === 'function') {
          setTimeout(updatePurchasesList, 500);
        }
        
        // Pulisci URL
        const cleanUrl = window.location.href.split('?')[0];
        window.history.replaceState({}, document.title, cleanUrl);
        
      } catch (error) {
        console.error('❌ Errore processing ritorno PayPal:', error);
        if (typeof showToast === 'function') {
          showToast('Errore nella conferma del pagamento. Contatta il supporto.', 'error');
        }
      }
      
    } else if (paymentStatus === 'cancelled') {
      console.log('⚠️ Pagamento PayPal annullato');
      
      localStorage.removeItem('lotteryPaymentData');
      
      if (typeof showToast === 'function') {
        showToast('Pagamento annullato. I numeri restano disponibili.', 'info', 4000);
      }
      
      // Pulisci URL
      const cleanUrl = window.location.href.split('?')[0];
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }
}

// === SAFE STORAGE WRAPPER ===

const safeStorage = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }
};

// === ESPOSIZIONE GLOBALE ===

if (typeof window !== 'undefined') {
  window.lotteryState = lotteryState;
  window.initializeFirebaseLottery = initializeFirebaseLottery;
  window.savePurchaseToFirebase = savePurchaseToFirebase;
  window.loadLotteryFromLocalStorage = loadLotteryFromLocalStorage;
  window.savePurchaseLocally = savePurchaseLocally;
  window.handleLotteryPaymentReturn = handleLotteryPaymentReturn;
  window.safeStorage = safeStorage;
}

console.log('🎄 Sistema Lotteria Firebase + localStorage ready!');

// === FUNZIONI GESTIONE DATI ===

// Carica dati lottery da localStorage
function loadLotteryFromLocalStorage() {
  const stored = localStorage.getItem('christmasLotteryState');
  if (stored) {
    try {
      const data = JSON.parse(stored);
      lotteryState.soldNumbers = data.soldNumbers || initialLotteryData.soldNumbers;
      lotteryState.purchasedNumbers = data.purchasedNumbers || initialLotteryData.purchasedNumbers;
    } catch (e) {
      // Fallback ai dati iniziali
      lotteryState.soldNumbers = initialLotteryData.soldNumbers;
      lotteryState.purchasedNumbers = initialLotteryData.purchasedNumbers;
    }
  } else {
    // Prima volta - usa dati iniziali
    lotteryState.soldNumbers = initialLotteryData.soldNumbers;
    lotteryState.purchasedNumbers = initialLotteryData.purchasedNumbers;
  }
  console.log(`💾 Caricati ${lotteryState.soldNumbers.length} numeri venduti da localStorage`);
}

// Salva dati lottery su localStorage
function saveLotteryToLocalStorage() {
  try {
    localStorage.setItem('christmasLotteryState', JSON.stringify({
      soldNumbers: lotteryState.soldNumbers,
      purchasedNumbers: lotteryState.purchasedNumbers,
      lastUpdate: Date.now()
    }));
    console.log('💾 Dati lotteria salvati su localStorage');
  } catch (error) {
    console.error('❌ Errore salvataggio localStorage:', error);
  }
}

// Salva nuovo acquisto
function savePurchaseLocally(newPurchase) {
  // Aggiungi numeri venduti (rimuovi duplicati)
  lotteryState.soldNumbers = [...new Set([...lotteryState.soldNumbers, ...newPurchase.numbers])];
  
  // Aggiungi acquisto alla lista
  lotteryState.purchasedNumbers.push(newPurchase);
  
  // Salva su localStorage
  saveLotteryToLocalStorage();
  
  console.log('✅ Acquisto salvato localmente:', newPurchase);
}

// Apre modal lotteria semplice
function openChristmasLottery() {
  createLotteryModal();
  
  const modal = document.getElementById('christmasLotteryModal');
  if (modal) {
    modal.style.display = 'flex';
    
    // Carica stato lotteria da localStorage
    loadLotteryFromLocalStorage();
    
    // Genera la griglia dopo un breve delay
    setTimeout(() => {
      generateLotteryBoard();
      updateLotteryUI();
      
      console.log('🎯 Lotteria aperta - modalità semplice!');
    }, 100);
  }
}

// Gestione return PayPal semplificata
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
        
        // Salva localmente (sistema semplice)
        savePurchaseLocally(purchaseRecord);
        console.log('💾 Acquisto salvato localmente');
        
        // Reset selezione
        lotteryState.selectedNumbers = [];
        
        // Pulisci dati temporanei  
        safeStorage.set('lotteryPaymentData', ''); // Rimuovi dati
        
        // Mostra successo
        showToast(
          `🎄 Pagamento completato con successo!\n\nNumeri acquistati: ${paymentData.numbers.join(', ')}\n\nI tuoi numeri sono ora riservati!`, 
          'success', 
          8000
        );
        
        // Aggiorna UI se lottery aperta
        if (document.getElementById('christmasLotteryModal')?.style.display === 'flex') {
          generateLotteryBoard();
          updatePurchasedNumbersList();
        }
        
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

// === INIZIALIZZAZIONE LOTTERIA ===

// Inizializza quando il DOM è pronto
function initLottery() {
  loadLotteryFromLocalStorage(); // Carica dati iniziali
  handleLotteryPaymentReturn(); // Gestisci return da PayPal
}

// Rendi la funzione accessibile globalmente per l'HTML
if (typeof window !== 'undefined') {
  window.openChristmasLottery = openChristmasLottery;
}

console.log('🎄 Sistema Lotteria Natale 2025 - Modalità Semplice caricato!');

// === NOTE IMPLEMENTAZIONE ===
/*
COME INTEGRARE NEL SITO:

1. Include questo file dopo script.js principale
2. Aggiungi al HTML: onclick="openChristmasLottery()" 
3. Assicurati che esistano le funzioni helper:
   - createLotteryModal()
   - generateLotteryBoard()
   - updateLotteryUI()
   - showToast()
   - safeStorage

DATI PREVENDITE:
- 17 numeri già venduti in contanti
- Totale incassato: €85 (contanti)
- Estrazione: 24 dicembre 2025

SISTEMA:
- Solo localStorage (no sync)
- PayPal Standard integration
- UI responsiva e premium design
*/