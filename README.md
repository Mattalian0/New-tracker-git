# New Project Diet v2.3

PWA statica per piano alimentare, tracker macro, generazione pasti e gestione database alimenti.

## Novita v2.3

- Modularizzazione in `css/styles.css`, `js/foods-db.js` e `js/app.js`
- Dashboard iniziale con riepilogo giornaliero
- Setup guidato iniziale
- Azioni rapide
- Backup export/import JSON
- Lista spesa automatica dal piano settimanale
- Auto adjust calorie basato sul trend peso settimanale
- Template pasti salvabili e riutilizzabili
- Copia Piano Giornaliero nel Tracker Manuale
- Usa Tracker Manuale come Piano Giornaliero
- Template giornata completa salvabili e caricabili
- Sostituzioni equivalenti anche nel Tracker Manuale
- Campo modificabile per kcal OFF rispetto agli ON
- Generazione piani ON/OFF con tolleranza kcal ±50
- Dashboard con profilo, giorni ON settimanali e target ON/OFF modificabili
- Setup guidato rimosso: profilo e giorni ON gestiti direttamente in Dashboard
- Target kcal Piano Giornaliero basato sui macro manuali ON/OFF
- Piano Settimanale editabile con chart macro per giornata aperta
- Sostituzioni ed eliminazione alimento/pasto nel Piano Settimanale
- Import giornaliero da singolo giorno settimanale ed export PDF settimana
- Aggiunta alimento, spostamento tra pasti e copia giorno nel Piano Settimanale
- Import alimenti da barcode Open Food Facts e OCR etichetta con conferma manuale
- Service worker aggiornato per cache dei nuovi asset

## Pubblicazione GitHub Pages

Carica tutti i file di questa cartella nella root del repository e abilita GitHub Pages da `Settings > Pages`.

La app resta completamente statica: non richiede backend, build step o dipendenze esterne.

## Struttura

```text
index.html
css/styles.css
js/foods-db.js
js/app.js
manifest.json
sw.js
icons/
README.md
```

## Backup dati

Da `Gestione Alimenti` o dalla dashboard puoi esportare/importare un backup JSON con profilo, tracker, alimenti, calendario, piani settimanali e template.
