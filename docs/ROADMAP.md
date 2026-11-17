# Roadmap di FantaFolletto

Aggiornata il **17 novembre 2026**. Il riferimento per i requisiti rimane [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

Gli sprint sono incrementi verificabili, senza scadenze inventate. Lo sprint 1 serve a provare l'esperienza; la versione da regalare richiede anche gli sprint 2–4.

## Revisione — Upload semplificato

Su richiesta dell’utente del 17 novembre: selettore unico, foto con griglia trascinabile e quattro maniglie al posto degli slider, didascalia e Carica foto. Il comando Cambia foto riusa il selettore e conserva la didascalia. Standard e oggi automatici, nessun campo di data/dimensione. Nessuna dipendenza o migrazione aggiunta. Superati 122 test e controlli Chromium con CSP di produzione, mouse/touch, sostituzione e annullamento, temi chiaro/scuro e larghezze 320/393/430/768 px. Pubblicata con commit `2e11429`, deploy `6badfc38-a321-49b3-bb73-4ba014ecd231` riuscito alle 12:26:06 italiane del 17 novembre.

## Prossimo incremento — Foto degli zerbini e Raccolte

**Stato: implementato, verificato localmente e pubblicato. Migrazione applicata; prove RPC/RLS ospitate superate con rollback.** Deploy automatico Pages `9112e657-0b1f-4cac-aba7-d1e094235c6a`, commit `bf54120`, successo il 17 novembre alle 11:03:22 UTC. L’utente sceglie Supabase e autorizza l’implementazione il 17 novembre. Confronto e dettagli in [ZERBINI_RESEARCH.md](ZERBINI_RESEARCH.md).

- Supabase Storage privato con migrazione locale, editor Canvas e miniatura prima dell’upload; condivisione tra giocatrice e admin senza punti.
- Navigazione Oggi/Record/Premi/Raccolte; Raccolte raggruppa Cognomi, Note e Zerbini e conserva la raccolta aperta passando alle altre destinazioni.
- Blob e richieste persistenti per account, coda indipendente dagli episodi, upload immutabili con verifica dei digest, finalizzazione dopo i due file e rimozioni con pulizia ritentabile.
- Verifiche: 115 test, build demo/produzione e PWA; Chromium a 320/393/430/768 px nei due temi, foto fittizia da 5,6 MB → 151 kB prima del ritaglio, rotazione/ritaglio, riapertura e rimozione.
- Migrazione applicata e RPC/RLS ospitate verificate con rollback, senza oggetti Storage fittizi. Da completare: upload Auth/Storage effettivo; collaudo iPhone/HEIC e backup dei file. PGlite simula lo schema Storage e non trasferisce file al servizio ospitato.
- Criterio di uscita: foto leggibile e alleggerita, visibile ai ruoli autorizzati, invio riprendibile senza duplicati; nessuna perdita o commistione tra account e nessuna regressione di eventi/premi. Verificare Safari e Home sul telefono reale.

## Sprint 1 — Il Diario prende forma

**Stato: implementato, verifiche descritte nella consegna.**

- React + Vite + TypeScript e build statica.
- Stile Diario, safe area, navigazione Oggi / Record / Premi, adattamento scuro e movimento ridotto.
- Componenti per punteggio, selezione e ricerca eventi, cronologia, annullamento, record e progresso premi.
- Anteprima admin con riepilogo, creazione/modifica/archiviazione di eventi e premi, esportazione JSON.
- Demo locale persistente in IndexedDB, conferma dopo transazione, identificativi unici e protezione dalle scritture concorrenti.
- Snapshot di nome, punti e versione dell'evento; annullamento tracciato; giorni e settimane in Europe/Rome.
- Test automatici sulle regole, sulla persistenza e sul percorso UI in jsdom; workflow GitHub di test/build. Verifica visuale del browser non eseguita per indisponibilità del relay; test su iPhone reale da fare.

**Criterio di uscita:** si può provare il ciclo evento → punti → record → premio e gestire il catalogo, conservando i dati dopo una ricarica. La UI dichiara che è una demo locale senza account né condivisione.

## Sprint 2 — Due account, un diario condiviso

**Stato: database Supabase predisposto e verifica transazionale ospitata superata; login/PostgREST dal browser da collaudare.**

Implementati migrazione, RLS/grant/RPC, catalogo versionato, premi storici e consegne, login/logout, recupero assistito, admin protetto dal ruolo reale e aggiornamento dati. L’utente ha creato il progetto e i due utenti; migrazioni, ruoli e configurazione locale applicati. Prove sul server concluse senza lasciare dati demo. Login con password e frontend pubblicato ancora da verificare. Esito in [ACTIVATION.md](ACTIVATION.md), procedura in [SETUP.md](SETUP.md).

1. Configurare un progetto Supabase europeo; verificare quote Free e recupero account. Predisporre due utenti e disabilitare la registrazione pubblica.
2. Versionare schema e migrazioni: ruoli protetti, catalogo versionato, episodi, annullamenti, premi assegnati e audit admin.
3. Implementare RLS e funzioni transazionali: assegnazione punti lato server, deduplicazione per proprietario e identificativo client, annullamenti idempotenti.
4. Login/logout, sessioni e recupero; letture e operazioni autorizzate tramite repository remoto e TanStack Query. Nessun selettore di ruolo simulato nella modalità reale.
5. Admin con dati della giocatrice e aggiornamento all'apertura, al ritorno in primo piano e su richiesta.
6. Assegnazioni premi storiche, distinta eventuale consegna, regole di modifica e rettifica.

**Regole iniziali definite:** eventi ripetibili al momento e malus ammessi; premi totali o settimanali; revoca dei non consegnati dopo annullamento, conservazione con segnalazione dei consegnati. Record sui punti effettivi, senza normalizzazione. Recupero assistito dall’operatore, senza dipendere da SMTP. Catalogo e premi reali restano da preparare; la demo non viene importata automaticamente.

**Criterio di uscita:** giocatrice e admin da browser diversi vedono lo stesso diario; test anonimo/giocatrice/admin verificano accessi consentiti e negati; nessun punto viene deciso dal client; ritentativi e modifiche preservano lo storico.

**Prerequisito operativo:** disponibilità del progetto Supabase e configurazione pubblica del frontend. Credenziali privilegiate mai nel browser o nel repository.

## Sprint 3 — Affidabile anche in giro

**Stato: implementazione presente e testata localmente; prove su Supabase collegato e Safari/Home da eseguire.**

Coda per progetto/account, riconciliazione, errori recuperabili, Web Locks quando disponibili, annullamenti pendenti, manifest/icone/service worker e aggiornamenti protetti sono nel codice. Il server accetta una vecchia versione valida all’istante dichiarato, entro sette giorni. Non sono dichiarate come superate le prove di riapertura offline su iPhone.

- Repository locale per proprietario e coda persistente di operazioni, separati dalla demo.
- Prima persistenza, poi risposta provvisoria; riconciliazione con dati confermati dal server.
- Ritentativi a rete effettivamente raggiungibile, all'apertura e al ritorno in primo piano. Nessuna dipendenza dal Background Sync di Safari.
- Gestione sessione scaduta, cambio account, errori recuperabili e annullamenti ancora pendenti.
- Politica esplicita per gli eventi creati offline con regole vecchie o archiviate.
- Manifest PWA, icone iPhone, risorse offline e aggiornamento con conferma che protegga coda e moduli aperti.
- Storage con versione e controlli di compatibilità, senza azzerare dati sconosciuti; visibilità di inserimenti in attesa / confermati / da correggere. Migrazioni future da aggiungere quando cambia lo schema.

**Criterio di uscita:** dopo il primo accesso online, un evento resiste a chiusura e riapertura offline e viene conteggiato una sola volta al ritorno online. Nessuna coda si perde o passa a un altro account.

## Sprint 4 — Pronto per il regalo

**Stato: preparazione parziale; consegna finale non ancora completata.**

Frontend pubblicato su [Cloudflare Pages](https://fantafolletto.pages.dev), con GitHub `main` e variabili Supabase di produzione; deploy confermato riuscito da Cloudflare. Pronti header CSP/cache, guida Home, export e procedure di manutenzione. Supabase e account sono predisposti; rimangono catalogo definitivo, login e verifica visuale dal browser, prove sul telefono, misure prestazioni e backup/ripristino effettivo. Il browser dell’agente ha avuto un errore di avvio/trasporto. Vedere [ACTIVATION.md](ACTIVATION.md) e [OPERATIONS.md](OPERATIONS.md).

- Verifica su iPhone reale: Safari e Home, tastiera, safe area, testo ingrandito, connessione instabile e accessibilità.
- Misure prestazioni, dimensione bundle e verifica aggiornamenti di versione con operazioni pendenti.
- Test completi sulle autorizzazioni e sui casi di confine: mezzanotte, settimana, ora legale, annullamenti, premi.
- Cloudflare Pages, configurazione pubblica, HTTPS; nessun servizio a pagamento implicito.
- Backup e prova di ripristino del database; esportazione dall'admin, istruzioni di manutenzione e riattivazione Supabase Free.
- Catalogo e premi definitivi; demo isolata o disabilitata nella versione consegnata; onboarding breve per aggiunta alla Home.

**Criterio di uscita:** il flusso reale è verificato sui due account e sul telefono, gli inserimenti restano affidabili, i dati sono recuperabili e sono note le condizioni di continuità del piano gratuito.

## Come proseguire dopo ogni sprint

Aggiornare contesto e roadmap con ciò che esiste davvero, i controlli eseguiti e gli eventuali limiti. Non confondere progresso premi dimostrativo con premi assegnati, né salvataggio locale con sincronizzazione tra dispositivi.

## Verifiche dello sprint 1

- `npm test`: **15 test superati** in tre file, con regole/calendario, persistenza transazionale simulata e percorso UI in jsdom (anche in React StrictMode).
- `npm run build`: controllo TypeScript e produzione Vite superati; JavaScript iniziale circa **79,4 kB gzip**, più circa **3 kB gzip** per l'admin caricato su richiesta; CSS circa **4,5 kB gzip**. Queste dimensioni non sono misure di LCP o INP.
- Test di dati incompatibili: lettura e scrittura rifiutate, contenuto precedente conservato.
- Anteprima gestita: avvio fallito per timeout del relay (`could not open browser port 4173`); nessuna verifica visuale, Safari o iPhone dichiarata come eseguita. I dialoghi nativi e il focus richiedono una prova reale.

## Verifiche degli sprint 2–3

- Suite ampliata a **42 test**: calendario/dominio, IndexedDB, coda, timeout dopo acquisizione, lettura di conferma fallita, account/progetti separati, annullamenti pendenti, dati incompatibili, autenticazione simulata, aggiornamento PWA e risposta senza configurazione reale.
- La migrazione viene eseguita in PostgreSQL PGlite: test su ruoli, RLS, grant, idempotenza, storico, vecchie versioni, premi unici/revocati/consegnati e assenza di sblocchi settimanali retroattivi.
- Build TypeScript/Vite e generazione manifest/service worker riuscite. Icone PNG 180/192/512 e maskable presenti. Verificata anche la build demo separata nella consegna finale.
- Nessun Supabase Auth/PostgREST ospitato o iPhone testato. La preparazione tecnica non equivale ai criteri finali di uscita degli sprint: le verifiche esterne restano esplicite.

## Collegamento Supabase reale

- Applicate due migrazioni, allineando i file locali alle versioni della cronologia remota; la migrazione iniziale è rinominata senza modificarne il contenuto.
- Assegnati i profili ai due utenti confermati. Configurazione locale privata, senza chiavi segrete.
- Prova con rollback: autorizzazione, deduplicazione, punti server, premi, annullamenti e storico superati; nessun dato di gioco rimasto.
- Correzioni advisor per indici, policy e trigger RLS automatico. Rimangono avvisi documentati per le RPC autorizzate, la protezione password Pro non attivata e gli indici ancora poco usati.
- Signup pubblico disabilitato confermato dall’utente. Hosting Cloudflare Pages attivato successivamente; login/PostgREST dal browser e iPhone restano da verificare: vedi [ACTIVATION.md](ACTIVATION.md).

- Verifica dopo il collegamento: **43 test automatici**, build con configurazione reale e controllo PWA superati; la demo nei test rimane isolata anche in un checkout configurato.

## Incremento — Catalogo, categorie e combo

**Stato: implementato, verificato, applicato a Supabase e pubblicato su Pages. Deployment del commit `bfaf811` confermato riuscito dall’API il 14 novembre 2026; dettagli in [ACTIVATION.md](ACTIVATION.md).**

- Catalogo approvato di 37 eventi, sei categorie separate, rarità e sfide una volta al giorno; eventi precedenti di prova archiviati.
- Filtri nella selezione e nell’admin; modifica categoria/rarità/ripetizione; prossimo punteggio e bonus nel diario.
- Scheda admin Combo con incremento e tetto modificabili, anteprima e decorrenza da domani in Europe/Rome.
- Calcolo autorevole lato server, regole versionate, ordine cronologico degli episodi, annullamenti, premi e stime offline coerenti.
- Verifica locale ampliata a 58 test e prova ospitata con rollback; controllo visuale Chromium a 390 CSS px, senza equivalenza con iPhone reale.


## Incremento — Riscatto manuale e due saldi (15 novembre 2026)

**Stato: implementato e verificato localmente; migrazione Supabase applicata e RPC ospitate verificate con rollback. Frontend pubblicato su Pages: commit `b8acc81`, deploy `9e674afe-e856-4dd2-ac82-f3e1259e57a7`, successo il 15 novembre 2026 alle 09:32:32 UTC.**

- Scelta del premio e conferma esplicita del costo/saldo residuo; nessuna nuova assegnazione al raggiungimento della soglia.
- Punti attuali spendibili e massimale storico persistenti in demo, database, cache ed export; punteggi di episodi e record indipendenti dai riscatti.
- Riscatto riservato alla giocatrice, transazione con lock condiviso, controllo di saldo/versione/periodo e unicità. Richieste persistenti nella coda per account, conferma server prima dell'addebito visibile, ritentativi senza doppia spesa.
- Premi totali una volta e settimanali una volta per settimana italiana. Vecchie assegnazioni conservate senza addebiti retroattivi; consegna admin solo dopo riscatto. Annullamenti preservano riscatti e massimo, con debito visibile e recuperabile.
- Verifiche locali: dominio, UI in jsdom, persistenza IndexedDB, coda/timeout, ruoli/RLS/RPC e migrazione di dati precedenti in PostgreSQL PGlite. **97 test automatici superati**, build demo e produzione e verifica PWA (manifest, icone, header e risorse offline) superate. Prove RPC sul database Supabase ospitato superate con rollback e conteggi dei dati di gioco conservati; nessuna verifica Safari o iPhone reale.
