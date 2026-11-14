# Manutenzione, backup e collaudo

Queste procedure riguardano l'operatore del progetto Supabase, distinto dall'account admin del gioco. Il progetto Supabase è ora predisposto; lo stato e i controlli ospitati eseguiti sono in [ACTIVATION.md](ACTIVATION.md). Backup e prova di ripristino non sono ancora stati eseguiti. Per l'attivazione seguire [SETUP.md](SETUP.md).

## Backup

L'export JSON dalla UI contiene lo snapshot del diario, non password, identità Auth, tutte le versioni del catalogo o l'audit completo. Non basta per ricostruire il servizio. La persistenza iPhone può essere rimossa da iOS o dall'utente.

Sul piano Free prevedere copie manuali prima di migrazioni e periodicamente durante l'uso. Seguire la [procedura Supabase di backup/ripristino tramite CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), verificata durante lo sviluppo, nella versione aggiornata al momento dell'intervento. Servono credenziali del database conservate in modo sicuro e gli strumenti indicati dalla guida.

Il backup deve comprendere:

- Schema, funzioni, policy, grant e versioni delle migrazioni applicate.
- Dati delle tabelle applicative: `profiles`, `events`, `event_versions`, `entries`, `rewards`, `awards`, `admin_audit`.
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

- Prima di cambiare schema fare un backup e verificare la migrazione su un progetto di prova.
- Le code attuali sono `schemaVersion: 1`, con namespace progetto + account. Una futura versione deve leggerle o migrare esplicitamente i dati; in caso di incompatibilità l'app conserva e segnala, senza azzerare.
- Il service worker conserva soltanto risorse statiche. La nuova versione si attiva su richiesta quando non ci sono moduli, scritture o operazioni pendenti. Non introdurre aggiornamenti forzati che saltino questa protezione.
- I browser aperti durante un aggiornamento possono avere regole vecchie. Il server conserva le versioni e la validità temporale, e i ritentativi usano lo stesso identificativo.
- Non cancellare lo storage locale per risolvere un errore prima di aver verificato gli inserimenti ancora in coda. Il logout li conserva per lo stesso account.

## Disponibilità e limiti

Il progetto Free può sospendersi dopo una settimana di inattività. Riattivarlo dalla dashboard prima di riprendere il gioco, attendere la disponibilità effettiva e aprire il diario online. Non è presente un servizio di keep-alive né viene creato un abbonamento.

Il client riprova quando attivo, al ritorno in primo piano, alla riconnessione e ogni 30 secondi mentre la vista è attiva. Safari chiuso non garantisce alcun invio in background. Il segnale del browser “online” da solo non viene considerato una conferma di salvataggio.

La prima versione scarica uno snapshot completo, adeguato al volume di una giocatrice. Quando lo storico diventerà grande, misurare tempi e dimensione e introdurre paginazione con totali lato server prima di raggiungere limiti di risposta. La RPC aggrega JSON nel database e non dipende dal limite REST standard di righe, ma non è pensata per uno storico illimitato.

## Registro verifiche iniziali

| Ambito | Stato |
| --- | --- |
| Regole di gioco, calendario e persistenza locale | Test automatici |
| Migrazione, RPC, RLS, ruoli e premi | PGlite e prova transazionale sul database ospitato con ruoli reali e claim impostati dall’operatore |
| Riconciliazione con timeout, doppioni e annullamenti pendenti | IndexedDB simulato e trasporto controllato |
| Login e separazione visiva giocatrice/admin | jsdom e Auth simulata |
| Manifest, icone, service worker e build | Verifica della build statica |
| Supabase Auth/PostgREST ospitati e due browser reali | Da eseguire dopo attivazione |
| Safari/Home, offline dopo riapertura e aggiornamento PWA | Da eseguire su iPhone |
| LCP/INP su iPhone | Non misurati |
| Backup e ripristino del servizio reale | Da eseguire |

Non presentare i controlli simulati come collaudo del servizio ospitato o del telefono.
