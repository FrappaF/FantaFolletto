# Manutenzione, backup e collaudo

Queste procedure riguardano l'operatore del progetto Supabase, distinto dall'account admin del gioco. Il progetto Supabase è ora predisposto; lo stato e i controlli ospitati eseguiti sono in [ACTIVATION.md](ACTIVATION.md). Backup e prova di ripristino non sono ancora stati eseguiti. Per l'attivazione seguire [SETUP.md](SETUP.md).

## Backup

L'export JSON dalla UI contiene lo snapshot del diario, non password, identità Auth, tutte le versioni del catalogo o l'audit completo. Non basta per ricostruire il servizio. La persistenza iPhone può essere rimossa da iOS o dall'utente.

Sul piano Free prevedere copie manuali prima di migrazioni e periodicamente durante l'uso. Seguire la [procedura Supabase di backup/ripristino tramite CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), verificata durante lo sviluppo, nella versione aggiornata al momento dell'intervento. Servono credenziali del database conservate in modo sicuro e gli strumenti indicati dalla guida.

Il backup deve comprendere:

- Schema, funzioni, policy, grant e versioni delle migrazioni applicate.
- Dati delle tabelle applicative: `profiles`, `event_categories`, `events`, `event_versions`, `scoring_rules`, `entries`, `rewards`, `awards`, `admin_audit`, `surname_combos`, `daily_notes`.
- Utenti e identità Auth, mantenendo gli UUID: `profiles.id` referenzia `auth.users.id`. Verificare quali dati Auth vengono inclusi dai comandi ufficiali della versione CLI in uso; non supporlo da un dump generico di `public`.
- Configurazione del progetto e Auth, regioni, signup disabilitato e variabili pubbliche del frontend. Le chiavi segrete e le password restano nel gestore password, separate dalle copie consultabili.

Conservare le copie cifrate fuori dal repository e dal dispositivo della giocatrice. La guida ufficiale distingue dati, ruoli e schema e contiene le opzioni necessarie per un ripristino Supabase; non copiare comandi distruttivi su un progetto con dati reali.

## Prova di ripristino da completare

Usare un progetto Supabase di prova nuovo, senza utenti o dati reali. Il ripristino non deve mai sovrascrivere il progetto in uso durante una verifica.

1. Seguire il percorso ufficiale per il ripristino su un progetto nuovo, nell'ordine previsto per schema, identità Auth, ruoli e dati. Considerare che lo schema Auth è gestito da Supabase: non ricrearlo manualmente usando lo stub dei test PGlite.
2. Verificare conteggi delle tabelle, UUID dei profili, riferimenti delle versioni, totali degli episodi attivi, annullamenti, condizioni storiche dei premi e consegne.
3. Controllare i valori delle sequenze per l'audit e che nuove scritture non collidano con gli identificativi ripristinati.
4. Collegare una build di prova al progetto ripristinato e accedere con i due account. Provare lettura e scritture autorizzate; controllare i divieti come anonimo e giocatrice.
5. Documentare data della prova, strumento/versione, numero di righe e risultato. Solo allora considerare quella procedura verificata per il servizio reale.

## Aggiornamenti

- Il frontend è su [fantafolletto.pages.dev](https://fantafolletto.pages.dev), progetto Cloudflare Pages `fantafolletto`. Il deploy automatico da GitHub `main` è verificato: dopo che l’utente ha autorizzato Cloudflare al repository, il push `59676d6` ha attivato il deploy `4a282a8c-41a0-4250-a55b-96a816708058` con trigger `github:push`, concluso con successo il 16 novembre 2026 alle 23:19:47 italiane. Ogni push su `main` avvia la build e, se riesce, la pubblicazione. I commit con `[skip ci]` non avviano il deploy. Controllare comunque l’esito in Workers & Pages → fantafolletto → Deployments prima di considerare pubblicata una modifica. Se il trigger smette di partire, verificare l’accesso di Cloudflare Pages al repository nelle GitHub Apps. Le anteprime automatiche sono disabilitate e il loro ambiente è separato in modalità demo. Modificare variabili `VITE_*` richiede una nuova build.
- Prima di cambiare schema fare un backup e verificare la migrazione su un progetto di prova.
- Le code attuali sono `schemaVersion: 1`, con namespace progetto + account. Una futura versione deve leggerle o migrare esplicitamente i dati; in caso di incompatibilità l'app conserva e segnala, senza azzerare.
- Il service worker conserva soltanto risorse statiche. La nuova versione si attiva su richiesta quando non ci sono moduli, scritture o operazioni pendenti. Non introdurre aggiornamenti forzati che saltino questa protezione.
- La disponibilità di nuove versioni viene controllata alla registrazione, al ritorno in primo piano, alla riconnessione e ogni cinque minuti mentre la pagina è visibile e online. Un errore temporaneo non invalida le risorse già disponibili offline. Il controllo non applica la versione senza conferma.
- I browser aperti durante un aggiornamento possono avere regole vecchie. Il server conserva le versioni e la validità temporale, e i ritentativi usano lo stesso identificativo.
- Non cancellare lo storage locale per risolvere un errore prima di aver verificato gli inserimenti ancora in coda. Il logout li conserva per lo stesso account.

Se Safari mostra ancora font, logo o icone precedenti, ricaricare la pagina, attendere il download della nuova versione e premere «Aggiorna app» quando compare. Se il pulsante è disabilitato, chiudere i moduli e attendere il completamento degli invii. Nella prova locale Chromium una scheda con la vecchia foglia è passata a F/Fraunces/nuove icone senza perdere l'episodio demo già salvato. Questo controllo non certifica il comportamento del Safari reale. Non suggerire la cancellazione di dati del sito o la rimozione della PWA per aggiornare la grafica.

## Disponibilità e limiti

Il progetto Free può sospendersi dopo una settimana di inattività. Riattivarlo dalla dashboard prima di riprendere il gioco, attendere la disponibilità effettiva e aprire il diario online. Non è presente un servizio di keep-alive né viene creato un abbonamento.

Il client riprova quando attivo, al ritorno in primo piano, alla riconnessione e ogni 30 secondi mentre la vista è attiva. Safari chiuso non garantisce alcun invio in background. Il segnale del browser “online” da solo non viene considerato una conferma di salvataggio.

La prima versione scarica uno snapshot completo, adeguato al volume di una giocatrice. Quando lo storico diventerà grande, misurare tempi e dimensione e introdurre paginazione con totali lato server prima di raggiungere limiti di risposta. La RPC aggrega JSON nel database e non dipende dal limite REST standard di righe, ma non è pensata per uno storico illimitato.

## Pegni — attivazione del 19 novembre 2026

Dopo la revisione dello staging l’utente ha autorizzato «ok pubblica tutto». La migrazione `supabase/migrations/20261119170205_pledges.sql` è applicata al servizio ospitato, con nome allineato alla cronologia remota; il frontend viene pubblicato solo dopo i controlli RPC. Nessun pegno dimostrativo è trasferito in produzione. La migrazione aggiunge `pledge_versions` e `pledge_claims`, entrambe con RLS e sola lettura diretta autorizzata; le scritture passano da `manage_diary`, con controllo admin e lock sul profilo della giocatrice. Le funzioni precedenti sono conservate nello schema privato e non eseguibili dai client. Il vecchio frontend resta compatibile con lo snapshot esteso. Includere le due nuove tabelle nei backup; export e cache comprendono tutte le versioni e le riscossioni ricevute.

Le condizioni valgono dal successivo periodo completo italiano: lunedì per i settimanali, primo del mese per i mensili. Le modifiche e l’archiviazione non cambiano periodi già iniziati; la periodicità di un pegno esistente è fissa. Non serve una pianificazione: anche dopo settimane senza aprire l’app, i periodi e le scadenze si ricostruiscono dalle versioni. L’avviso è nella home dell’app, senza notifiche push o messaggi esterni.

«Riscuoti pegno» conferma che l’admin ha ricevuto quanto dovuto. Il server controlla periodo concluso, quota non raggiunta e unicità per pegno/periodo; non addebita punti. Non considera le spese per i premi. Le riscossioni conservano nome, quota, versione e punti al momento della conferma. Se episodi inviati tardi o annullamenti fanno raggiungere la quota, lo storico indica «Riscosso · da verificare»; nessuna riscossione viene eliminata automaticamente. Gli eventi pendenti non anticipano il conteggio: la UI usa lo snapshot confermato e la gestione admin dei pegni aspetta la coda locale. Eventuali episodi ancora offline sull’altro dispositivo potranno essere riconciliati solo quando arrivano al servizio.

Verifiche locali: **151 test superati in 30 file**, comprendenti dominio, componenti, sincronizzazione e PostgreSQL PGlite, più build demo/produzione e controllo PWA. I sette test SQL dedicati coprono ruoli/anonimo, RLS, scritture dirette negate, versioni, ritentativi, chiusure settimanali/mensili e cambi d’ora, quota indipendente dalla spesa e correzioni dopo riscossione. Chromium headless: avviso home → Pegni, assenza dei comandi admin per la giocatrice, riscossione con conferma, creazione mensile e layout a 320/393/768 px nei due temi senza overflow o errori JavaScript. Safari/iPhone reale e RPC del servizio ospitato non verificati per questo incremento.

Documentazione RLS e sicurezza Supabase consultata via MCP. Il changelog HTTP non era raggiungibile dal proxy dell’ambiente. La CLI recuperata non ha potuto creare la migrazione per il percorso di configurazione non scrivibile; il nome SQL usa l’orologio UTC effettivo. Lo schema è stato applicato e verificato solo nei database PGlite dei test, senza usare sul servizio gli stub Auth/Storage.

### Anteprima prima della pubblicazione

**Online il 19 novembre 2026 alle 17:57:46 Europe/Rome:** [staging Pegni](https://staging-pegni.fantafolletto.pages.dev/?anteprima=pegni), URL immutabile [66b945a9](https://66b945a9.fantafolletto.pages.dev/?anteprima=pegni). Deployment preview `66b945a9-faa4-4d17-a3b2-e35923e2516c`, commit `e6adb163e6178dbd4ab94bb0ae08fbca30b4b9e5`. API e log confermano build/deploy riusciti; origine remota `main` invariata e deployment canonico di produzione sempre `d5bd8e04`/`57d1747`. Controllo Chromium locale della preview parametrica e dello storage isolato superato; controllo browser ospitato bloccato dal proxy (`ERR_TUNNEL_CONNECTION_FAILED`).

Su richiesta successiva dell’utente, il branch `staging-pegni` è predisposto per una preview manuale Pages. L’ambiente preview esistente usa `VITE_APP_MODE=demo` e non contiene configurazione Supabase. Aprire l’URL della preview con `?anteprima=pegni`: crea esclusivamente dati fittizi relativi alla data corrente, con pegni in corso, da onorare, riscossi e futuri. Lo storage `fantafolletto-demo-pegni` è distinto dalla demo ordinaria; le modifiche rimangono nel browser e non si azzerano alla riapertura. I due ruoli sono esplorabili con «Prova area admin», senza login. Il parametro non attiva esempi in modalità condivisa. Verificati 14 test pertinenti, build demo e PWA. La revisione è stata completata e l’utente ha successivamente autorizzato migrazione e pubblicazione in produzione; esito nel registro di attivazione.

## Foto degli zerbini — rilascio del 17 novembre 2026

La feature è implementata, verificata localmente e pubblicata su Pages (`bf54120`, deploy automatico riuscito alle 11:03:22 UTC). La migrazione `supabase/migrations/20261117105839_doormat_photos.sql` è applicata al progetto esistente e gli advisor non segnalano nuovi avvisi di sicurezza. RPC, ruoli e RLS ospitate sono verificate con prove annullate da rollback. Esito della pubblicazione in ACTIVATION.md; restano da collaudare upload Auth/Storage effettivo, lettura incrociata e rimozione dai due account. Non eseguire sul servizio gli stub `auth`/`storage` dei test PGlite. Il codice precedente continua a funzionare con lo schema aggiuntivo.

Il bucket `doormats` deve restare **privato**, limitato a JPEG/WebP e a 1.000.000 byte per oggetto. La miniatura ha un limite applicativo di 100.000 byte; la finalizzazione controlla dimensioni dichiarate e MIME dei due oggetti. Il browser usa la chiave pubblica già esistente e il JWT dell’account, senza chiavi amministrative o trasformazioni Pro.

I file hanno percorsi `autore/UUID/photo-digest` e `autore/UUID/thumb-digest`. I metadati sono in `public.doormats`: non eliminare righe manualmente per liberare spazio, perché i file resterebbero nel servizio. Dalla raccolta, rimuovere con conferma: l’app salva la rimozione e riprova la pulizia tramite API Storage. Gli oggetti rimangono immutabili, senza policy UPDATE. Una prenotazione incompleta è visibile solo all’autore; se il telefono ha perso i Blob, accedere con quell’account, rimuovere la scheda incompleta e scegliere nuovamente l’originale. Le rimozioni conservano metadati e autore, senza ricreare le foto su ritentativi tardivi.

L’archivio locale `fantafolletto-photos`, versione 1, separa demo/progetto/account e salva Blob e richiesta nella stessa transazione. La coda è distinta da quella degli episodi. Logout e aggiornamenti conservano gli invii; non cancellare dati del sito per risolvere un problema. Dopo la conferma i Blob locali vengono liberati; le immagini confermate sono scaricate su richiesta e non entrano nel precache PWA. L’intera galleria non è garantita offline.

L’export JSON admin include `doormats` con metadati e digest, **non i file immagine**. Per un backup ripristinabile conservare sia i dati della tabella sia i due oggetti Storage per foto, mantenendo i percorsi e le policy. Il backup del database non equivale al backup degli oggetti: scaricarli separatamente con dashboard/API Storage e custodirli fuori dal repository. Controllare lo spazio dalla dashboard Supabase, includendo miniature e upload incompleti. A quota esaurita liberare spazio o rivedere il piano senza upgrade automatici.

Verifiche locali: 115 test, build demo/produzione e PWA; Chromium con foto fittizia da 5,6 MB a 151 kB prima del ritaglio, rotazione/ritaglio, riapertura e rimozione, temi chiaro/scuro a 320/393/430/768 px. Il test SQL usa uno schema Storage simulato; trasferimento al servizio, limiti del bucket ospitato, Safari/Home, HEIC e rimozione EXIF su iPhone reale restano da verificare.

### Collaudo sul telefono dopo la pubblicazione

1. Completare eventuali invii, chiudere i moduli e usare «Aggiorna app» quando compare; non cancellare lo spazio del sito o IndexedDB.
2. Da Safari e poi dalla Home verificare le quattro voci Oggi/Record/Premi/Raccolte. In Raccolte aprire Zerbini, scegliere una foto di prova e verificare foto intera e scritta leggibile, griglia trascinabile e didascalia. Standard e giornata corrente italiana non richiedono selettori.
3. Provare sia una foto della libreria iPhone (HEIC se disponibile) sia uno scatto. Provare i quattro angoli e il centro della griglia, poi «Cambia foto»: la didascalia deve rimanere, la griglia deve azzerarsi per il nuovo file e annullare la scelta deve conservare la foto precedente. Un formato non leggibile deve mostrare il messaggio di recupero, senza caricare l’originale.
4. Salvare e attendere «Sincronizzata»; riaprire l’app e verificare la foto dal secondo account. Questa prova collauda Auth/PostgREST/Storage e non è sostituita dai test SQL con claim simulati.
5. Con una foto di prova distinta, disattivare la rete, salvare e riaprire l’app: la scheda deve restare sul telefono. Riattivando la rete con l’app aperta deve arrivare una sola copia.
6. Rimuovere solo la foto di prova con conferma, verificare la scomparsa dal secondo account e la pulizia dei due oggetti Storage. Controllare che episodi, punti, premi e vecchie raccolte rimangano utilizzabili.

## Registro verifiche iniziali

| Ambito | Stato |
| --- | --- |
| Regole di gioco, calendario e persistenza locale | Test automatici |
| Migrazione, RPC, RLS, ruoli e premi | PGlite e prova transazionale sul database ospitato con ruoli reali e claim impostati dall’operatore |
| Riconciliazione con timeout, doppioni e annullamenti pendenti | IndexedDB simulato e trasporto controllato |
| Login e separazione visiva giocatrice/admin | jsdom e Auth simulata |
| Manifest, icone, service worker e build | Verifica della build statica |
| Cloudflare Pages e configurazione di produzione | Primo deploy riuscito confermato da API e log Cloudflare; verifica browser impedita da errore di avvio/trasporto dell’ambiente |
| Supabase Auth/PostgREST ospitati e due browser reali | Da eseguire dopo attivazione |
| Safari/Home, offline dopo riapertura e aggiornamento PWA | Da eseguire su iPhone |
| LCP/INP su iPhone | Non misurati |
| Backup e ripristino del servizio reale | Da eseguire |

Non presentare i controlli simulati come collaudo del servizio ospitato o del telefono.

## Catalogo e combo giornaliera

In admin → Eventi assegna categoria, rarità e ripetizione. Le sei categorie sono predefinite nel database; la gestione dei loro nomi/icone non è esposta nella UI. Gli eventi precedenti di prova sono consultabili con «Mostra gli archiviati» e non sono disponibili alla giocatrice. Le sfide si registrano manualmente una volta al giorno e non hanno moltiplicatore.

In admin → Combo puoi cambiare percentuale (0–1000% intero) e tetto (×1–×20 con un decimale). L’anteprima parte da 10 punti. Le modifiche valgono dal giorno seguente in Europe/Rome; se salvi più volte, prevale l’ultima versione per quel giorno. 0% o ×1 disattivano il bonus. La baseline iniziale è +20%, tetto ×3.

Le ripetizioni si contano per evento, anche dopo una modifica del nome o dei punti. Il server ordina gli episodi per data e identificativo. Annullamenti e invii offline in ritardo ricalcolano i bonus del relativo evento/giorno, usando le impostazioni storiche degli episodi, e riconciliano i premi. I punti in attesa e le anticipazioni nel catalogo sono stime. Le vecchie code restano leggibili e non si eliminano.

## Raccolte Cognomi e Note

Le voci «Cognomi» e «Note» nell’admin consentono a entrambi gli account di curare le raccolte, separate dai punteggi. Nel diario la raccolta cognomi si chiama «Combo»; la scheda admin «Combo» resta dedicata alle regole dei bonus. Le rimozioni sono tracciate, le operazioni offline restano nella coda dell’account e l’export comprende anche le raccolte.

Le migrazioni di novembre aggiungono tabelle e conservano gli snapshot precedenti nel namespace privato, senza accesso client. Le copie delle funzioni permettono un ripristino limitato delle definizioni, non un ripristino dei dati o del servizio. Durante questo rilascio l’esportazione completa dei dati e delle identità Auth è stata rifiutata dall’approvazione automatica: backup completo e prova di ripristino rimangono non eseguiti.
