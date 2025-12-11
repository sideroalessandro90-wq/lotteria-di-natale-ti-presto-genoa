# 🔥 Regole Firebase per Lotteria di Natale

## 📋 Regole Firestore da Aggiornare

Per permettere il funzionamento della lotteria, aggiorna le regole in **Firebase Console > Firestore Database > Regole**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Regole esistenti per altre collezioni (mantieni autenticazione)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Regole speciali per la lotteria (accesso pubblico)
    match /lottery/{document} {
      // Permetti lettura pubblica per vedere numeri venduti
      allow read: if true;
      
      // Permetti scrittura solo per acquisti validi
      allow write: if request.resource.data.keys().hasAll(['numbers', 'buyerName', 'timestamp', 'method', 'total'])
                   && request.resource.data.numbers is list
                   && request.resource.data.numbers.size() <= 10
                   && request.resource.data.numbers.size() > 0
                   && request.resource.data.total == request.resource.data.numbers.size() * 5;
    }
  }
}
```

## 🎯 Cosa Permettono Queste Regole

### ✅ **Lettura Pubblica**
- Chiunque può vedere i numeri già venduti
- Sincronizzazione in tempo reale per tutti

### ✅ **Scrittura Controllata**  
- Solo acquisti con struttura dati corretta
- Massimo 10 numeri per acquisto
- Prezzo verificato (numeri * €5)
- Campi obbligatori validati

### 🛡️ **Sicurezza Mantenuta**
- Altre collezioni richiedono ancora autenticazione
- Validazione automatica dei dati lotteria
- Prevenzione spam e manipolazioni

## 📍 **Come Applicare**

1. Vai su **Firebase Console**
2. **Firestore Database** > **Regole**  
3. Sostituisci le regole attuali con quelle sopra
4. Clicca **"Pubblica"**

⚠️ **IMPORTANTE**: Queste regole permettono accesso pubblico SOLO alla collezione "lottery"!