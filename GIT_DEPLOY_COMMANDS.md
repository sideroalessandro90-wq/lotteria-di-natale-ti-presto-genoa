# 🎄 GIT DEPLOY COMMANDS - LOTTERIA NATALE 2025 🎄

## 📋 COMANDI PER DEPLOY SOLO LOTTERIA

### 🔧 PREPARAZIONE
```bash
# 1. Assicurati di essere nella directory giusta
cd /path/to/abbonamentigenoa

# 2. Verifica stato git
git status

# 3. Verifica branch corrente (dovrebbe essere main)
git branch
```

### 📤 DEPLOY COMANDI

#### **OPZIONE 1: Add specifici file lotteria**
```bash
# Add solo i file modificati per la lotteria
git add index.html
git add script.js  
git add style.css
git add "img/locandina lotteria.png"
git add toast.js
git add pw-simple.js

# Commit con messaggio descrittivo
git commit -m "🎄 FEATURE: Lotteria di Natale 2025 completa

- ✅ Sistema griglia 90 numeri interattiva
- ✅ PayPal Standard integration con importi variabili  
- ✅ Return URL automatico configurato
- ✅ Locandina integrata nel modal
- ✅ Validazione form real-time
- ✅ Responsive design mobile/desktop
- ✅ Persistenza localStorage e backup
- 🎯 Pronto per produzione

Fixes: #lottery-payment-calculation
Tested: ✅ All functions working"

# Push al repository
git push origin main
```

#### **OPZIONE 2: Commit tutto (se non ci sono altri file modificati)**
```bash
# Add tutti i file
git add .

# Commit
git commit -m "🎄 Lotteria di Natale 2025 - Deploy completo"

# Push
git push origin main
```

### 🔍 VERIFICA POST-DEPLOY

#### **Check status dopo push**
```bash
# Verifica push completato
git log --oneline -5

# Verifica remote sync
git status
```

#### **File da verificare su server**
- [ ] `index.html` (banner lotteria visibile)
- [ ] `script.js` (funzioni lotteria caricate)  
- [ ] `style.css` (styling lotteria applicato)
- [ ] `img/locandina lotteria.png` (immagine accessibile)
- [ ] Return URLs PayPal funzionanti

### 🚨 ROLLBACK (se necessario)
```bash
# Se qualcosa va storto, rollback veloce
git log --oneline -5
git reset --hard HEAD~1
git push --force origin main
```

### 📱 TEST POST-DEPLOY

#### **Checklist produzione**
1. **Apri** https://tiprestogenoa.it
2. **Clicca** "Partecipa alla Lotteria" 
3. **Verifica** modal si apre correttamente
4. **Seleziona** 3 numeri
5. **Compila** form dati
6. **Testa** calcolo prezzo (deve essere 15€)
7. **Prova** redirect PayPal (non completare)
8. **Verifica** return URL redirect al sito

### ⏰ TIMING DEPLOY

**Orario consigliato**: 20:00-22:00 (basso traffico)
**Durata stimata**: 2-3 minuti  
**Downtime**: Nessuno (update trasparente)

### 📞 SUPPORTO POST-DEPLOY

**Se tutto funziona**: ✅ Sistema attivo
**Se ci sono problemi**: 
- Controlla console browser (F12)
- Verifica PayPal return URLs
- Check file `locandina lotteria.png`

---
🎯 **READY TO DEPLOY!** 
Tutti i test sono stati completati con successo.