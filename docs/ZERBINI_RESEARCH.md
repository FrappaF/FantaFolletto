# Foto degli zerbini — ricerca e proposta

Ricerca del **17 novembre 2026**, basata sui piani e sulla documentazione ufficiale consultati in questa data.

**Stato aggiornato: Supabase scelto, migrazione applicata e frontend pubblicato il 17 novembre 2026.** La ricerca sotto conserva il confronto che ha portato alla scelta. Requisiti e stato reale fanno riferimento a [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Revisione richiesta il 17 novembre

Il flusso iniziale descritto sotto è superato dalla richiesta di semplicità: un solo selettore, seguito da anteprima con griglia di ritaglio trascinabile/ridimensionabile, didascalia e «Carica foto». Un comando «Cambia foto» integrato nel riquadro usa lo stesso selettore, conserva didascalia e annullamento e azzera la griglia per la nuova foto valida. Rimosse le scelte di dimensione/data, i contatori del peso e i controlli esterni di ritaglio/rotazione. Standard 1600 px e giornata corrente italiana sono automatici al salvataggio. Nessuna modifica a Storage o database; revisione pubblicata con commit `2e11429` e deploy automatico riuscito alle 12:26 italiane del 17 novembre. I dati e i file esistenti sono preservati.

## Implementazione iniziale del 17 novembre 2026

- Presenti editor (scelta/scatto, rotazione, ritaglio, 1600/1280 px, WebP/JPEG e confronto del peso), galleria con miniature e apertura della foto, data/didascalia, rimozione e barra Oggi/Record/Premi/Raccolte. Le stesse raccolte sono disponibili nell’admin; nessun effetto sui punti.
- Nessuna nuova dipendenza applicativa. Editor e raccolte si caricano su richiesta; Canvas usa una superficie di lavoro limitata. HEIC usa la decodifica del browser: se non disponibile viene richiesto un JPEG, senza upload dell’originale.
- `src/photos/` contiene modello, elaborazione, IndexedDB, coda/sincronizzazione e trasporto Supabase. Blob e richieste si salvano insieme, separati per demo/progetto/account. Lettura e coda autonome evitano di appesantire lo snapshot degli episodi e fermarne gli invii. L’export admin include i metadati nella voce `doormats`, senza file binari.
- Migrazione `supabase/migrations/20261117105839_doormat_photos.sql`: metadati, bucket privato, RLS, prenotazione idempotente, finalizzazione dopo i due oggetti e rimozione con traccia. Percorsi autore/UUID/digest; nessun upsert o sovrascrittura. Le letture usano JWT e Blob temporanei, quindi la CSP aggiunge solo `blob:` alle immagini. Nessun URL pubblico o firmato persistito.
- I file pendenti restano in IndexedDB; dopo la conferma vengono liberati e le immagini si scaricano su richiesta. Non si promette l’intera galleria offline. Le rimozioni in attesa ritentano la pulizia dei due file; nessun processo pianificato aggiunto.
- Superati 115 test, build demo/produzione e PWA. Test SQL in PGlite con Storage simulato su ruoli, percorsi, finalizzazione e rimozione; test del trasporto/coda con timeout, digest e pulizia interrotta. Prova Chromium con immagine fittizia da 5,6 MB: 151 kB a 1600×1200 prima del ritaglio; verificati rotazione, ritaglio, riapertura e rimozione, layout a 320/393/430/768 px nei due temi, senza overflow o errori JavaScript.

**Attivazione del 17 novembre:** migrazione applicata al servizio e RPC/RLS ospitate verificate con rollback; frontend pubblicato con commit `bf54120` e deploy automatico `9112e657-0b1f-4cac-aba7-d1e094235c6a`, riuscito alle 11:03:22 UTC. Nessuna prova di upload Auth/Storage effettivo, Safari/Home o HEIC su iPhone reale. Esito del rilascio in ACTIVATION.md; manutenzione e backup in [OPERATIONS.md](OPERATIONS.md). I paragrafi seguenti conservano la ricerca iniziale: le differenze rispetto alla proposta sono descritte qui sopra.

Controllo Chromium aggiuntivo: un JPEG con orientamento EXIF 6 viene elaborato nel verso corretto (1200×1600 px); nella copia ricodificata non sono presenti EXIF o tag di orientamento. Un file HEIC fittizio illeggibile mantiene il salvataggio disabilitato e permette di scegliere una nuova foto. Quest’ultima prova verifica il recupero dall’errore, non la compatibilità con un HEIC reale.

## Raccomandazione

Per FantaFolletto partire da **Supabase Storage Free con elaborazione nel browser prima dell’upload**. Account, ruoli, SDK e database sono già presenti: si aggiunge lo spazio per le immagini allo stesso servizio. Un bucket privato mantiene la raccolta accessibile ai due account autorizzati.

Se si preferisce delegare anche l’elaborazione al provider, **ImageKit** è la prima alternativa: quote separate e facili da valutare. **Cloudinary** offre strumenti più ricchi, ma il consumo a crediti è meno immediato. Per il volume di un diario personale, le tre opzioni sono plausibili entro il gratuito; la durata effettiva dipende da numero, peso e consultazioni delle foto.

## Provider confrontati

| Soluzione | Piano gratuito verificato | Elaborazione immagini | Impatto su questa app |
| --- | --- | --- | --- |
| **Supabase Storage** | 1 GB di file; 5 GB/mese di egress non in cache e 5 GB/mese in cache, con contatori distinti | Il ridimensionamento gestito richiede Pro o superiore. Sul Free elaborare prima dell’invio | Riutilizza autenticazione e SDK esistenti; bucket privato e policy per i due ruoli |
| **ImageKit — Forever free** | 3 GB di storage e 20 GB/mese di banda | Ottimizzazione, ridimensionamento e trasformazioni inclusi con limiti del piano | Nuovo account e integrazione; firma degli upload e degli accessi protetti da un endpoint server |
| **Cloudinary — Free** | 25 crediti mensili condivisi fra storage, banda e trasformazioni | Ridimensionamento, compressione, conversioni e strumenti di upload/editor | Nuovo account e integrazione; firma lato server per gli upload e gestione della consegna autenticata |

Per Cloudinary un credito equivale a 1 GB di storage **oppure** 1 GB di banda immagini **oppure** 1000 trasformazioni ordinarie. I consumi si sommano: non sono tre quote indipendenti da 25. Le varianti generate occupano spazio e possono consumare trasformazioni.

Le quote Supabase sono condivise a livello di organizzazione secondo le regole del servizio; l’egress comprende anche altri servizi dell’app. I due contatori di banda non costituiscono 10 GB liberamente intercambiabili. Resta la possibile sospensione del progetto Free dopo una settimana di inattività. Su ImageKit il superamento di una quota gratuita ferma la funzionalità corrispondente. Prevedere un messaggio recuperabile a quota esaurita, senza passaggi automatici a un piano a pagamento.

Con i provider esterni, il login Supabase non protegge da solo gli URL delle immagini: configurare la consegna privata/autenticata e la firma lato server. Una chiave privata non può essere inserita nel frontend Vite. Questo lavoro aggiuntivo pesa più della differenza fra le quote per il volume previsto.

Fonti: [prezzi Supabase](https://supabase.com/pricing), [egress Supabase](https://supabase.com/docs/guides/storage/serving/bandwidth), [trasformazioni Supabase](https://supabase.com/docs/guides/storage/serving/image-transformations), [bucket privati](https://supabase.com/docs/guides/storage/buckets/fundamentals), [prezzi ImageKit](https://imagekit.io/plans/), [quote ImageKit](https://imagekit.io/docs/how-pricing-works), [upload ImageKit React](https://imagekit.io/docs/integration/react), [sicurezza ImageKit](https://imagekit.io/docs/media-delivery-basic-security), [prezzi Cloudinary](https://cloudinary.com/pricing), [crediti Cloudinary](https://cloudinary.com/documentation/billing_and_plans), [upload Cloudinary](https://cloudinary.com/documentation/upload_images), [accesso ai media Cloudinary](https://cloudinary.com/documentation/control_access_to_media).

## Flusso di caricamento ed elaborazione

1. Da Zerbini, «Aggiungi foto»: scegliere dalla libreria oppure scattare, mantenendo disponibili entrambe le opzioni su iPhone.
2. Anteprima con **ritaglio facoltativo e rotazione**. Conservare le proporzioni se non si sceglie un ritaglio: le scritte degli zerbini non devono venire tagliate automaticamente.
3. Ridimensionamento e compressione automatici; scelta semplice «Standard» (lato lungo 1600 px) o «Leggera» (1280 px), senza ingrandire gli originali piccoli. Mostrare peso originale e finale prima del salvataggio.
4. Aggiungere eventualmente una didascalia e una data, proposta sulla giornata italiana corrente. Nessuna posizione geografica necessaria.
5. Salvare sul telefono il risultato ottimizzato e la richiesta, poi caricare quando la connessione è disponibile. Distinguere «Salvata sul telefono», «In caricamento», «Sincronizzata» e gli errori recuperabili.

Baseline tecnica da validare con foto reali:

| Parametro | Proposta |
| --- | --- |
| Formato salvato | WebP se l’encoder è disponibile; altrimenti JPEG, verificando il MIME effettivo del risultato |
| Qualità iniziale | Circa 0,8, da regolare in base a peso e leggibilità delle scritte |
| Peso foto | Obiettivo 200–400 kB; limite proposto 1 MB dopo l’elaborazione |
| Miniatura | Lato lungo 400 px, obiettivo 20–40 kB, generata prima dell’invio |
| Originale | Rimane nella libreria dell’utente; la proposta non ne conserva una copia nel servizio |
| Metadati | Ricodificare senza ricopiare EXIF/GPS; verificare l’assenza dei metadati nel file esportato |

Una foto da 250 kB con miniatura da 25 kB richiede circa 275 kB. Mille foto occuperebbero circa **275 MB**; circa **2900 foto** occuperebbero 800 MB, lasciando margine nella quota da 1 GB. Sono stime in unità decimali, non capacità garantite: file più pesanti e altri oggetti riducono il totale. La banda dipende dalle visualizzazioni; caricare le miniature nella griglia e l’immagine grande solo all’apertura.

L’elaborazione nel browser riduce anche il traffico mobile in upload; ridimensionare solo alla visualizzazione lascia l’originale pesante nello storage. Trattare una foto per volta, limitare byte e pixel in ingresso, rilasciare canvas e URL temporanei, prevedere annullamento ed errore di memoria comprensibile.

Per il primo prototipo usare le API native **Canvas + `toBlob`** senza nuove dipendenze. Se i test evidenziano la necessità di compressione iterativa o worker già confezionati, valutare **browser-image-compression**, caricata soltanto quando si apre il modulo. La libreria comprime, ma non fornisce l’interfaccia di ritaglio. Un worker usa `OffscreenCanvas` dove supportato; mantenere un percorso alternativo sul thread principale. Nessun caricamento di script da CDN necessario: eventuali risorse della libreria vanno ospitate nell’app e verificate rispetto alla CSP.

**HEIC/HEIF è un criterio di rilascio:** Safari introduce il supporto HEIC dalla versione 17, ma versione iOS, selettore foto e decodifica effettiva vanno verificati sul dispositivo. Provare prima la decodifica nativa. Nei browser che non la supportano, valutare un convertitore caricato su richiesta; in alternativa dichiarare il limite e offrire la selezione di un JPEG. Non inviare silenziosamente l’HEIC originale saltando l’ottimizzazione. La compatibilità completa resta aperta fino alle prove.

Fonti: [Canvas `toBlob`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob), [browser-image-compression, worker e CSP](https://github.com/Donaldcwl/browser-image-compression), [HEIC in Safari 17](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/).

## Navigazione proposta

La barra attuale è **Oggi · Record · Premi · Combo · Note**. Portarla a sei voci ridurrebbe ulteriormente lo spazio sul telefono. Proposta: quattro destinazioni stabili, riunendo i contenuti da conservare in Raccolte.

```text
Oggi          Record          Premi          Raccolte
                                                │
                                  ┌─────────────┼─────────────┐
                               Cognomi         Note        Zerbini
```

Raccolte apre una pagina con tre schede grandi, nome, breve descrizione e conteggio; Zerbini può mostrare l’ultima miniatura disponibile. Un tocco apre la raccolta e «Torna alle raccolte» riporta alla pagina indice. La barra mantiene Raccolte selezionata anche nelle pagine interne. Conservare l’ultima posizione quando si passa alle altre destinazioni ed evitare di perdere un modulo aperto.

**Cognomi** è un nome più esplicito della voce attuale Combo e coincide con quello già usato dall’admin. «Combo» rimane il termine per il bonus di punteggio nelle impostazioni. I dati esistenti delle raccolte restano gli stessi: cambia il punto di accesso.

È preferibile a «Altro», che non spiega cosa contiene, e a una barra scorrevole che nasconde destinazioni. I quattro spazi restano sufficienti anche su schermi stretti, con etichette leggibili e safe area. L’azione «Segna un evento» rimane evidente in Oggi.

Nell’admin riunire Cognomi, Note e Zerbini in un unico accesso Raccolte, riutilizzando le stesse viste. Eventi, Premi e regole Combo mantengono la propria funzione amministrativa. Proposta di permessi per le foto: consultazione, inserimento e rimozione con conferma per entrambi i ruoli, come le raccolte attuali; nessun punto assegnato automaticamente. Questi permessi e l’assenza di effetti sui punti sono baseline proposte.

## Integrazione da prevedere nel codice esistente

- `src/App.tsx` definisce le cinque destinazioni e la barra; `src/components/Admin.tsx` ha sei selettori separati. Introdurre una vista Raccolte condivisa mantenendo distinti i permessi amministrativi.
- Nuova entità foto con UUID stabile, autore, data, didascalia, percorso immagine/miniatura, MIME, dimensioni, byte e rimozione tracciata. Nel database conservare i riferimenti, non base64 o URL firmati destinati a scadere. Estendere snapshot, validazione ed export mantenendo leggibili i diari precedenti.
- Bucket privato e policy collegate ai profili del diario: un generico accesso `authenticated` non basta. Lettura dai due ruoli autorizzati tramite download autenticato o URL firmati brevi, rigenerati quando necessario. Limiti di tipo e peso sul bucket; i controlli client non sostituiscono quelli lato servizio.
- `src/remote/types.ts` e `account-store.ts` gestiscono oggi solo operazioni strutturate del diario, non allegati. Aggiungere persistenza dei `Blob` separata per progetto/account e aggiornamento transazionale della coda; evitare di duplicare foto dentro snapshot ed export JSON. La demo mantiene storage separato.
- Upload e registrazione nel database non sono un’unica transazione. Prevedere stati di caricamento e finalizzazione, percorsi deterministici per UUID e variante, riconciliazione dopo timeout e verifica del contenuto già presente prima di riutilizzarlo. Un ritentativo non deve creare un nuovo oggetto né sovrascrivere contenuti incompatibili. Pubblicare la scheda sincronizzata solo dopo aver confermato entrambe le varianti e i metadati.
- Cancellazione: registrare la rimozione e riprovare la pulizia dei due file tramite API Storage; gestire anche gli upload abbandonati. Rimuovere una riga dal database non libera automaticamente lo storage. Evitare un processo pianificato aggiuntivo se la riconciliazione all’apertura basta al volume previsto.
- La coda immagini non deve fermare le registrazioni degli eventi quando un file è bloccato. Proteggere foto pendenti durante logout, cambio account e aggiornamento PWA; il recupero avviene con l’app attiva, senza dipendere dal Background Sync di Safari.
- `public/_headers` oggi consente immagini solo da `self` e `data:`: aggiungere `blob:` per le anteprime e il dominio esatto Storage per le immagini remote. `connect-src` consente già Supabase. Eventuali worker richiedono una verifica specifica; i provider esterni richiederebbero ulteriori domini autorizzati.
- `vite.config.ts` conserva solo risorse statiche. Le foto personali non entrano nel precache né in una cache pubblica. Per disponibilità offline delle foto già viste usare eventualmente una cache di Blob per account con limite esplicito; non promettere tutta la galleria offline. L’export JSON con metadati non è un backup dei file: documentare anche il recupero delle immagini.

## Sequenza di sviluppo e verifiche

1. Prototipo locale dell’elaborazione: JPEG/PNG/HEIC, foto verticali con orientamento EXIF, scritte piccole, immagini grandi, errore/annullamento e peso effettivo. Verifica su Safari e Home dell’iPhone reale prima di fissare i parametri.
2. Raccolte e Zerbini nella demo: navigazione a quattro voci, riuso di Cognomi/Note, anteprima, ritaglio, salvataggio e riapertura dei Blob, rimozione.
3. Storage privato, metadati, upload/finalizzazione e rimozione idempotenti; verifica anonimo/giocatrice/admin, account estranei esclusi, URL scaduti, sessione scaduta e quote esaurite.
4. Prove di rete interrotta tra le due varianti e la finalizzazione, ritentativi concorrenti, chiusura/riapertura, spazio locale insufficiente, logout e cambio account; episodi/premi continuano a funzionare.
5. Controlli responsive a 320/393/430 CSS px, temi chiaro/scuro, testo ingrandito, tastiera e safe area; test/build/PWA, attivazione e verifica dei due account.

Questa ricerca non include un benchmark di compressione, prove di upload o collaudi su iPhone. Parametri, capacità stimata e prestazioni devono essere validati durante l’implementazione.
