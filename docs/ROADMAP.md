# Roadmap di FantaFolletto

Aggiornata il **14 novembre 2026**. Il riferimento per i requisiti rimane [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

Gli sprint sono incrementi verificabili, senza scadenze inventate. Lo sprint 1 serve a provare l'esperienza; la versione da regalare richiede anche gli sprint 2–4.

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

**Stato: da iniziare.**

1. Configurare un progetto Supabase europeo; verificare quote Free e recupero account. Predisporre due utenti e disabilitare la registrazione pubblica.
2. Versionare schema e migrazioni: ruoli protetti, catalogo versionato, episodi, annullamenti, premi assegnati e audit admin.
3. Implementare RLS e funzioni transazionali: assegnazione punti lato server, deduplicazione per proprietario e identificativo client, annullamenti idempotenti.
4. Login/logout, sessioni e recupero; letture e operazioni autorizzate tramite repository remoto e TanStack Query. Nessun selettore di ruolo simulato nella modalità reale.
5. Admin con dati della giocatrice e aggiornamento all'apertura, al ritorno in primo piano e su richiesta.
6. Assegnazioni premi storiche, distinta eventuale consegna, regole di modifica e rettifica.

**Decisioni necessarie in questo sprint:** catalogo reale e premi; regole per ripetizioni, malus, date precedenti, premi dopo annullamento, comparabilità dei record; metodo recupero account. La demo non viene importata automaticamente nei dati reali.

**Criterio di uscita:** giocatrice e admin da browser diversi vedono lo stesso diario; test anonimo/giocatrice/admin verificano accessi consentiti e negati; nessun punto viene deciso dal client; ritentativi e modifiche preservano lo storico.

**Prerequisito operativo:** disponibilità del progetto Supabase e configurazione pubblica del frontend. Credenziali privilegiate mai nel browser o nel repository.

## Sprint 3 — Affidabile anche in giro

**Stato: da iniziare; dipende dallo sprint 2.**

- Repository locale per proprietario e coda persistente di operazioni, separati dalla demo.
- Prima persistenza, poi risposta provvisoria; riconciliazione con dati confermati dal server.
- Ritentativi a rete effettivamente raggiungibile, all'apertura e al ritorno in primo piano. Nessuna dipendenza dal Background Sync di Safari.
- Gestione sessione scaduta, cambio account, errori recuperabili e annullamenti ancora pendenti.
- Politica esplicita per gli eventi creati offline con regole vecchie o archiviate.
- Manifest PWA, icone iPhone, risorse offline e aggiornamento con conferma che protegga coda e moduli aperti.
- Migrazioni dello storage locale e visibilità di inserimenti in attesa / confermati / da correggere.

**Criterio di uscita:** dopo il primo accesso online, un evento resiste a chiusura e riapertura offline e viene conteggiato una sola volta al ritorno online. Nessuna coda si perde o passa a un altro account.

## Sprint 4 — Pronto per il regalo

**Stato: da iniziare; dipende dagli sprint precedenti.**

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
