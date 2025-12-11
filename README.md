# 🎄 Lotteria di Natale 2025 - Ti Presto Genoa CFC

> **Una lotteria natalizia premium con prodotti ufficiali Genoa CFC**

[![Netlify Status](https://api.netlify.com/api/v1/badges/placeholder/deploy-status)](https://lotteria-natale-genoa.netlify.app)

## 🎯 Panoramica

Lotteria di Natale 2025 dedicata ai tifosi del Genoa CFC con premi esclusivi e sistema di acquisto online integrato con PayPal.

### ✨ Caratteristiche

- **90 numeri interattivi** con selezione touch-friendly
- **Sistema prevendite** con 17 numeri già assegnati  
- **Pagamenti PayPal** sicuri e automatici
- **Design natalizio responsive** con animazioni neve
- **Firebase sync** + fallback localStorage
- **Lista acquisti in tempo reale**

## 🏆 Premi in Palio

| 🥇 **PRIMO PREMIO** | 🥈 **SECONDO PREMIO** | 🥉 **TERZO PREMIO** |
|:---:|:---:|:---:|
| ![Premio 1](img/1premio1.png) | ![Premio 2](img/2premio1.png) | ![Premio 3](img/3premio1.png) |
| **MIKELI GENOA**<br>Giacca imbottita da uomo<br>*Blue dk-red blaze*<br>**€149,00** | **MEQUO GENOA**<br>Pile con cappuccio slim<br>*Blue dk-red blaze*<br>**€79,00** | **20.3H GENOA**<br>Pallone allenamento<br>*White-red-blue dk-yellow*<br>**€30,00** |

### 💰 Riepilogo Premi
- **Totale valore premi:** €258,00
- **Prezzo per numero:** €5,00
- **Massimo numeri per persona:** 10
- **Estrazione:** 24 Dicembre 2025 ore 18:30

## 🚀 Deploy

### Netlify (Consigliato)
1. Collega questa repository a Netlify
2. Build command: `# nessuno (sito statico)`
3. Publish directory: `/`
4. Auto-deploy attivo ✅

### Deploy Manuale
```bash
# Clone repository
git clone https://github.com/sideroalessandro90-wq/lotteria-di-natale-ti-presto-genoa.git

# Apri index.html
# Nessun build richiesto - tutto client-side!
```

## 🛠️ Stack Tecnologico

- **HTML5 + CSS3** - Layout responsive e animazioni
- **JavaScript Vanilla** - Logica applicazione e interazioni
- **Firebase** - Database real-time (opzionale)
- **PayPal Standard** - Pagamenti sicuri
- **SVG** - Grafica vettoriale per premi

## 📱 Compatibilità

- ✅ **Desktop:** Chrome, Firefox, Safari, Edge
- ✅ **Mobile:** iOS Safari, Android Chrome
- ✅ **Tablet:** iPad, Android tablet
- ✅ **PWA ready:** Installabile come app

## 🔧 Configurazione PayPal

Per attivare i pagamenti, aggiorna in `index.html`:

```javascript
// Sostituisci con il tuo account PayPal
business: "TUO_EMAIL_PAYPAL",
// Aggiorna URL di ritorno
return: "https://tuo-dominio.netlify.app?lottery=success"
```

## 📊 Funzionalità Avanzate

### 🎲 Sistema Numeri
- **Griglia 90 numeri** generata dinamicamente
- **Stati visivi:** Disponibile (verde), Venduto (rosso), Selezionato (oro)
- **Validazione acquisti** contro numeri già venduti
- **Massimo 10 numeri** per transazione

### 💾 Gestione Dati
- **Prevendite hardcoded** (17 numeri già assegnati)
- **Firebase sync** per nuovi acquisti online
- **localStorage fallback** se Firebase non disponibile
- **Tracking prevention** gestito automaticamente

### 🎨 Design Premium
- **Colori Genoa CFC:** Navy (#002147) + Rosso (#c8102e) + Oro (#ffd700)
- **Font natalizi:** Mountains of Christmas + Montserrat
- **Animazioni:** Neve, hover effects, pulse
- **Responsive:** Grid ottimizzata per ogni dispositivo

## 📋 Lista Prevendite

| Nome | Numeri | Metodo | Totale |
|------|--------|--------|--------|
| Antonella Bruno | 6, 10, 16 | Contanti | €15 |
| Lina Galuppo | 4 | Contanti | €5 |
| Francesco Sidero | 28, 66 | Contanti | €10 |
| Rocco Palmisano | 9, 57 | Contanti | €10 |
| Francesca Dylan | 8 | Contanti | €5 |
| Laura Bruno | 89, 29 | Contanti | €10 |
| Carla (Mamma Federico) | 22 | Contanti | €5 |
| Manuela Giordano | 69 | Contanti | €5 |
| Francesco Petronelli | 13 | Contanti | €5 |
| Ylenia Tarantino | 35 | Contanti | €5 |
| Giada Sidero | 59 | Contanti | €5 |
| Sidero Alessandro | 90 | Contanti | €5 |

**Totale prevendite:** €105 (17 numeri)

## 🎄 Licenza

© 2025 Ti Presto - Scambio Abbonamenti Genoa CFC  
Tutti i diritti riservati.

---

**Forza Genoa! ⚽🔴🔵**

*Progetto realizzato con ❤️ per i tifosi rossoblù*