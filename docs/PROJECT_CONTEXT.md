# FantaFolletto — contesto del progetto

Ultimo aggiornamento: **14 novembre 2026**.

Questo documento consente di riprendere il progetto in una nuova chat senza ricostruire le decisioni precedenti. Va letto prima di ogni feature o cambiamento e mantenuto insieme al codice, come indicato in [AGENTS.md](../AGENTS.md).

## 1. Sintesi da portare sempre nel contesto

- Il progetto è un regalo per la ragazza dell'utente, che lavora nelle vendite porta a porta Folletto.
- Lo scopo è rendere le giornate più divertenti attraverso episodi, punti, record e piccoli premi personali.
- È una **sfida con se stessa**, con una sola giocatrice. Non è prevista una competizione con colleghi o altri utenti.
- Esistono due account: **giocatrice** e **admin**, il partner che prepara il regalo.
- L'admin deve vedere i punteggi e **gestire eventi e premi**. La precedente proposta di admin in sola lettura è superata.
- L'utente ha scelto una webapp con account e dati condivisi e ha approvato **React + Vite**.
- La direzione di design confermata è **Diario**. La proposta alternativa Missione non è la direzione da sviluppare.
- Le priorità espresse sono **ottimizzazione per iPhone, velocità e stabilità**, con budget di hosting molto contenuto.
- Prima dello sviluppo è stata richiesta ricerca su architettura e design. Il 14 novembre 2026 l'utente ha autorizzato sviluppo e pubblicazione: sono implementati la demo locale e il codice degli sprint 2–3, con Supabase predisposto e verificato a livello database. Il frontend è pubblicato su Cloudflare Pages; il collaudo finale dal browser/iPhone resta da eseguire.

## 2. Stato e grado delle decisioni

### Requisiti confermati dall'utente

| Tema | Decisione |
| --- | --- |
| Destinazione | Regalo personale, utilizzabile da iPhone |
| Modalità di gioco | Una giocatrice, sfida personale |
| Accessi | Account separati per giocatrice e admin |
| Admin | Consultazione dei punteggi e gestione di eventi e premi |
| Interfaccia | React + Vite |
| Design | Diario |
| Priorità | Esperienza iPhone veloce e stabile; hosting economico |
| Cognomi divertenti | Sezione Combo: primo cognome obbligatorio, secondo cognome e nota facoltativi |
| Note giornaliere | Sezione per annotare le cose successe durante la giornata |

### Baseline proposta dalla ricerca

Le scelte seguenti costituiscono il punto di partenza tecnico consigliato dalla ricerca. Le parti effettivamente adottate sono elencate nello stato reale; le altre non sono ancora configurate né tutte approvate singolarmente:

- TypeScript per il codice applicativo.
- Cloudflare Pages per ospitare il frontend statico.
- Supabase Auth e PostgreSQL per account, autorizzazione e dati condivisi, preferibilmente in regione europea.
- TanStack Query per richieste, cache e aggiornamento dei dati.
- IndexedDB per cache locale e coda persistente degli inserimenti.
- `vite-plugin-pwa` per manifest, risorse offline e gestione degli aggiornamenti.
- CSS leggero, carattere di sistema e icone essenziali per il design.

### Stato reale dopo la pubblicazione

- React + Vite + TypeScript, design Diario Oggi/Record/Premi/Combo/Note, safe area e modalità scura; viste admin e servizio remoto caricati separatamente.
- **Note giornaliere implementate nel codice, da attivare online:** testo libero obbligatorio fino a 2000 caratteri, data preimpostata sulla giornata corrente in `Europe/Rome` e modificabile, più note per giorno e storico raggruppato per data, dalla più recente. Accessibili dal diario e dall’area admin; condivise tra i due account, che possono inserire e rimuovere dopo conferma. Nessun effetto sui punti o sui premi. Le note vengono salvate in IndexedDB prima della conferma, poi inviate con identificativo stabile; rimozioni pendenti, errori e invii ambigui restano protetti dalla coda esistente. La migrazione locale `20261114173600_daily_notes.sql` aggiunge tabella con RLS, RPC autorizzate, rimozioni tracciate e campo `notes` nello snapshot/export. Legge i diari precedenti senza `notes`; conserva data, testo e autore nel database. Verificata localmente con test su calendario, UI, persistenza, account, riconciliazione e PostgreSQL PGlite; migrazione non applicata al servizio ospitato e frontend non pubblicato. Nessuna verifica su iPhone reale eseguita per questa modifica.
- **Combo implementata nel codice, da attivare online:** raccolta di cognomi divertenti, con primo cognome obbligatorio (massimo 60 caratteri), secondo cognome facoltativo (60) e nota facoltativa (180). Accessibile dalla navigazione del diario e dall’area admin; entrambi i ruoli possono inserire e rimuovere dopo conferma. Nessun effetto su punti, episodi o premi. Demo persistente in IndexedDB; modalità condivisa con la stessa coda per account, deduplicazione e riconciliazione degli episodi. La migrazione `20261114165140_surname_combos.sql`, generata con la CLI, aggiunge tabella protetta da RLS, RPC con controllo del ruolo e rimozioni tracciate, e il campo `combos` allo snapshot e quindi all’export. Migrazione verificata localmente in PGlite, non ancora applicata al progetto ospitato; frontend aggiornato non ancora pubblicato. I diari precedenti senza `combos` restano leggibili. Test su dominio, UI, IndexedDB, invii con timeout e permessi; nessun collaudo iPhone reale dichiarato.
- Due modalità distinte: demo locale esplicita, oppure `remote` con login email/password e ruolo letto dal database. La produzione senza configurazione non apre una demo né un falso admin. `.env.example` descrive le sole variabili pubbliche; `.env.demo` abilita una build demo separata.
- Schema Supabase applicato al progetto reale, con migrazioni `20261114130522_diary.sql` e `20261114131302_tighten_diary_permissions.sql`: profili e ruoli protetti, eventi/versioni, episodi, premi, assegnazioni storiche, consegne e audit admin. RLS e grant negano le scritture dirette dal browser; le RPC controllano ruolo, versione e deduplicazione.
- Login/logout e recupero assistito dall'operatore implementati nel codice; nessuna registrazione pubblica o email di recupero promessa senza configurazione. `scripts/reset-password.mjs` usa una chiave segreta solo fuori dal frontend e una password da stdin nascosto.
- Admin: consulta lo snapshot della giocatrice, gestisce online eventi e premi con controllo della versione e identificativo stabile per i ritentativi, conferma consegne ed esporta JSON consultabile. Non registra né annulla episodi al posto della giocatrice.
- Giocatrice: registra e annulla con coda IndexedDB per progetto/account; conferma locale dopo transazione, punti provvisori distinguibili, riconciliazione idempotente e invii rifiutati visibili/riprovabili/rimuovibili dopo conferma. Le operazioni ambigue restano in coda fino alla lettura di conferma dal server.
- Refresh tramite TanStack Query all'apertura, al ritorno in primo piano/connessione, su richiesta e ogni 30 secondi mentre la vista è attiva. Web Locks quando disponibili e RPC idempotenti proteggono gli invii da più schede. Ogni RPC usa il token del proprietario verificato anche se la sessione cambia durante la richiesta.
- Cache e code reali sono separate dalla demo. Un logout conserva la coda per lo stesso account senza mostrarla all'altro. Dati/versioni locali incompatibili vengono conservati e segnalati, non azzerati.
- Manifest PWA, icone PNG/iPhone, service worker per le sole risorse statiche, indicazioni per la Home e aggiornamento su richiesta. Il pulsante di aggiornamento attende moduli chiusi e assenza di operazioni pendenti. Non si dipende dal Background Sync di Safari; Auth e risposte del database non entrano in Cache Storage.
- Regole iniziali approvate dall'utente: eventi ripetibili al momento, premi settimanali o totali, revoca dei premi non consegnati dopo annullamento e conservazione con segnalazione di quelli consegnati. I dettagli operativi sono sotto.
- Catalogo reale vuoto: gli esempi sono confinati alla demo; nessun import automatico nel diario reale. Nome/punti/versione degli episodi e condizioni dei premi assegnati conservano lo storico.
- Test locali su dominio/calendario, IndexedDB simulato, riconciliazione e UI in jsdom; migrazione/RPC/RLS eseguite in PostgreSQL PGlite con identità Supabase simulate. Workflow GitHub per test e build. I controlli locali non certificano Auth/PostgREST o Safari; la successiva verifica database ospitata è distinta e descritta sotto.
- **Supabase predisposto:** progetto FantaFolletto `eynngtnxtomcwblmughq` creato dall’utente, attivo in `eu-west-1`; schema e correzioni advisor applicati tramite MCP. Due utenti Auth confermati dall’utente e ruoli admin/player assegnati. `.env.local` configurato, ignorato da Git; nessun dato personale o segreto nel repository.
- Verifica transazionale sul database ospitato superata: ruoli, RPC, divieti di scrittura diretta, punti, ritentativi, premi, annullamenti e storico; rollback finale, catalogo e dati di gioco ancora vuoti. Nuova migrazione con indici, policy che valutano i claim una volta per statement e revoca dell’accesso client al trigger automatico RLS.
- Non è stato eseguito un login reale dal frontend: le prove database impostano i claim del ruolo SQL, non producono sessioni Auth. Il tentativo HTTP dall’ambiente ha fallito la risoluzione DNS (`EAI_AGAIN`). L’utente ha confermato il 14 novembre 2026 che “Allow new users to sign up” è disattivato nella dashboard; registrare questa conferma senza presentarla come verifica automatica del connettore, che non espone tale impostazione.
- **Pubblicato su [fantafolletto.pages.dev](https://fantafolletto.pages.dev)**: progetto Cloudflare Pages `fantafolletto`, repository GitHub esistente, produzione automatica da `main`, build `npm run build`, output `dist`, Node 24. Variabili pubbliche Supabase configurate in produzione con modalità `remote`; anteprime automatiche disabilitate e ambiente preview predisposto solo come demo. Nessun servizio a pagamento attivato.
- Primo deploy confermato riuscito dall’API e dai log Cloudflare il 14 novembre 2026; build locale e controllo PWA superati. Il browser dell’agente non ha completato l’avvio per errore di requisiti/trasporto; il controllo HTTP dall’ambiente è stato respinto dal proxy. Nessuna verifica visuale, login reale o prova iPhone dichiarata come superata. Backup/ripristino ospitato e misure LCP/INP da fare. Dettagli, limiti e link degli advisor in [ACTIVATION.md](ACTIVATION.md).
- Attivazione passo passo in [SETUP.md](SETUP.md), manutenzione in [OPERATIONS.md](OPERATIONS.md), criteri degli sprint in [ROADMAP.md](ROADMAP.md), avvio in [README.md](../README.md).

Aggiornare questa sezione quando lo stato cambia. Non confondere il comportamento desiderato con quello effettivamente disponibile.

Le sezioni architetturali seguenti descrivono il comportamento del prodotto; lo stato qui sopra distingue il codice presente dal servizio effettivamente configurato e collaudato. La demo locale non è un'autorizzazione a usare un selettore di ruolo nella versione con account.

## 3. Idea di gioco e perimetro

L'ispirazione è FantaSanremo: eventi riconoscibili danno punti secondo un regolamento. Qui il meccanismo viene adattato a una persona che registra episodi della propria giornata lavorativa.

Il ciclo principale è: **succede un episodio → lo registra → ottiene punti → vede progressi e record → raggiunge un premio**.

La classifica personale confronta giornate e settimane della stessa giocatrice. Non servono squadre, mercato, capitani o leghe per riprodurre integralmente FantaSanremo.

La direzione proposta privilegia episodi buffi e piccoli traguardi. Evitare di trasformare la prima versione in un gestionale delle vendite: per il gioco bastano tipo di evento, data e punti. Non sono necessari nomi, indirizzi o contatti dei clienti.

Esempi emersi nella ricerca: un caffè offerto, un animale che interrompe la dimostrazione, essere chiamata con il nome sbagliato. **Nomi, punteggi, obiettivi e premi mostrati nel concept sono esempi**, da definire nel catalogo reale. Anche il traguardo di 300 punti non è un requisito confermato.

## 4. Ruoli e comportamenti

### Giocatrice

- Accede al proprio account, pensato per rimanere utilizzabile nelle aperture successive sul suo telefono.
- Registra un evento dal catalogo con pochi tocchi.
- Vede punti della giornata, progresso del periodo, storico, record e premi.
- Può correggere un inserimento accidentale con un'azione di annullamento chiara.
- Riconosce se un evento è ancora sul telefono oppure è stato confermato dal server.

### Admin

- Accede con un account distinto, anche da computer.
- Consulta punteggi, storico, record, premi e data dell'ultimo dato ricevuto.
- **Crea, modifica e archivia eventi del catalogo**, inclusi descrizione e punteggio.
- **Crea, modifica e archivia premi**, inclusi descrizione, obiettivo e periodo di validità previsto.
- Può seguire lo stato dei premi raggiunti e registrare la consegna, se adottata questa distinzione nel flusso finale.
- Ha a disposizione l'esportazione dei dati come baseline proposta per conservazione e backup.

Interpretazione operativa della gestione degli eventi: riguarda anzitutto il catalogo e le regole che producono punti. Una modifica del catalogo non autorizza la riscrittura silenziosa dei punteggi passati. Se si aggiungono rettifiche admin alle registrazioni, devono essere esplicite e tracciate.

L'inserimento degli eventi da parte della giocatrice non richiede approvazione manuale dell'admin.

## 5. Design scelto: Diario

### Carattere dell'esperienza

Un diario di piccole avventure: personale, leggero e leggibile. Il punteggio dà un senso di progresso, mentre gli episodi registrati mantengono il legame con la giornata reale.

Indicazioni tratte dal concept selezionato:

- Superfici chiare e morbide, con adattamento alla modalità scura.
- Verde come accento principale; riferimento iniziale del concept: `#27744e`.
- Fondo chiaro iniziale `#fafbf8` e testo scuro verdastro `#20382a`, da verificare per contrasto nei componenti reali.
- Carattere di sistema, numeri grandi per il punteggio, gerarchia semplice.
- Angoli arrotondati e decorazioni contenute.
- Testi brevi, in italiano, con tono affettuoso e giocoso.
- Le scelte cromatiche sono una baseline modificabile; la preferenza confermata riguarda la direzione Diario, non ogni singolo valore grafico.

### Navigazione della giocatrice

| Sezione | Contenuto e azione principale |
| --- | --- |
| Oggi | Punti del giorno, progresso settimanale, pulsante «Segna un evento», ultimi episodi |
| Record | Migliori giornate, migliori settimane, storico personale |
| Premi | Traguardo attuale, premio associato e premi già raggiunti |
| Combo | Raccolta dei cognomi divertenti; inserimento di un solo cognome o di una coppia, nota facoltativa e rimozione con conferma |
| Note | Appunti della giornata, più note per data, testo libero e storico raggruppato per giorno |

La navigazione principale rimane in basso. L'azione di inserimento è evidente e comoda da raggiungere con il pollice. Il catalogo presenta nome dell'evento e punti prima della selezione.

Il risultato di un tocco è immediato, con un messaggio breve e una possibilità di annullamento. Lo stato di sincronizzazione deve essere comprensibile senza esporre termini tecnici nel prodotto.

### Interfaccia admin

Usare lo stesso linguaggio visivo, con viste per riepilogo, catalogo eventi e premi. Su computer può essere più ampia, mantenendo l'accessibilità da telefono. La gestione del catalogo deve mostrare chiaramente l'effetto delle modifiche future e preservare lo storico.

### Compatibilità iPhone

Il modello dichiarato è iPhone 14 Pro; l'utente ha anche riferito la presenza di un notch. La versione iOS e il modello esatto non sono verificati. Le specifiche Apple riportano Dynamic Island sul 14 Pro: non trasformare questa incertezza in un blocco né costruire un layout dipendente da un ritaglio preciso.

Usare le safe area fornite dal browser, prevedere notch o Dynamic Island e proteggere la navigazione dall'indicatore Home. Supportare sia Safari sia l'apertura dalla schermata Home. Per l'onboarding preferire installazione e primo accesso direttamente nella webapp aggiunta alla Home; verificare il comportamento delle sessioni tra i due contesti, senza supporne la condivisione.

Criteri pratici:

- Controlli principali con aree di tocco di circa 48 CSS pixel, prendendo come riferimento la raccomandazione Apple di almeno 44 × 44 punti per le interfacce native.
- Testo leggibile all'aperto e con le impostazioni di accessibilità; dimensioni adeguate nei campi per evitare zoom indesiderati.
- Nessuna azione essenziale disponibile solo tramite hover o gesto nascosto.
- Nessuno scorrimento orizzontale nell'uso principale.
- Animazioni brevi, rispettando la preferenza di riduzione del movimento.

## 6. Architettura e affidabilità proposte

### Struttura generale

```text
iPhone della giocatrice / browser dell'admin
                 |
       React + Vite, su Cloudflare Pages
                 |
         Supabase Auth + API database
                 |
        PostgreSQL, policy e funzioni

Sul telefono: risorse dell'app in cache + IndexedDB
              per letture recenti e inserimenti da inviare
```

Il frontend statico non richiede un server applicativo sempre acceso. Le operazioni che assegnano punti o sbloccano premi devono comunque essere controllate dal database. Supabase non offre automaticamente il comportamento offline descritto qui: la coda e la riconciliazione devono essere implementate e verificate.

### Salvataggio degli eventi

1. Dopo un primo accesso online e il caricamento del catalogo, il telefono può conservare le informazioni necessarie all'uso offline.
2. Prima di confermare un inserimento locale, persisterlo in IndexedDB. Se il salvataggio locale fallisce, mostrarlo e non dichiarare l'evento acquisito.
3. Assegnare un identificativo client unico all'operazione.
4. Mostrare il progresso provvisorio, distinguendolo dai punti confermati.
5. Inviare l'operazione quando l'app è attiva e il servizio è raggiungibile.
6. Il server verifica utente e versione dell'evento, assegna i punti in una transazione e restituisce il risultato.
7. Solo dopo la conferma aggiornare lo stato locale come sincronizzato.

Il database deve impedire doppioni dello stesso identificativo per la stessa giocatrice, anche dopo timeout, riaperture o invii concorrenti. Un ritentativo con lo stesso identificativo restituisce l'esito già acquisito; un payload incompatibile non deve sovrascriverlo.

Un errore di validazione rimane visibile e recuperabile. Se un evento viene modificato o archiviato mentre il telefono è offline, applicare una regola esplicita per la vecchia versione: non cancellare l'inserimento né applicare nuovi punti senza comunicarlo. Nella versione implementata il server accetta entro sette giorni una versione che era valida all’istante dichiarato; una regola non valida resta da correggere. La UI inserisce al momento, con tolleranza server di cinque minuti nel futuro per l’orologio del dispositivo. È un diario personale basato sulla fiducia: il server non può provare quando un episodio sia davvero accaduto.

Non fare affidamento sul Background Sync di Safari per inviare eventi mentre l'app è chiusa. Riprovare all'apertura, al ritorno in primo piano e al recupero effettivo della connessione mentre l'app è attiva. Il solo segnale `navigator.onLine` non prova che Supabase sia raggiungibile.

Il primo accesso e il recupero di una sessione non valida richiedono rete. Se serve una nuova autenticazione, conservare la coda associata al suo proprietario e riprenderla dopo il login corretto.

### Storico, regole e premi

- Conservare la versione della regola e i punti attribuiti al momento dell'assegnazione.
- Separare modifica del catalogo e rettifica di una registrazione storica.
- Archiviare gli eventi già usati invece di eliminare le informazioni necessarie allo storico.
- Calcolare premi e risultati definitivi sui dati confermati dal server, evitando doppi sblocchi.
- Conservare le condizioni del premio assegnato: cambiarne la definizione non riscrive automaticamente quanto già conquistato.
- Modellare annullamenti e rettifiche in modo tracciabile e idempotente, anche se l'evento originale è ancora in attesa di sincronizzazione.
- Ricalcolare in modo coerente i risultati derivati quando viene annullato un evento. La regola approvata revoca i premi non consegnati quando il totale scende sotto la soglia storica; conserva quelli consegnati con una segnalazione. Raggiungere di nuovo la soglia riattiva la stessa assegnazione, senza duplicarla.
- Salvare istante dell'evento e istante di ricezione. Usare `Europe/Rome` per giorni e settimane, gestendo ora legale e invii successivi alla mezzanotte.

### Regole operative della prima versione

- Eventi ripetibili senza limite giornaliero configurato, malus ammessi; registrazione al momento, nessun selettore per retrodatare.
- Settimana italiana da lunedì. Un premio totale si conquista una volta per definizione, uno settimanale una volta per settimana: la chiave è proprietario + premio + periodo, non la versione del testo.
- Modificare il premio può usare punti già confermati del periodo corrente, conservando le condizioni di quanto già assegnato. Un premio settimanale nuovo/modificato non crea nuove assegnazioni per settimane prima della modifica; può sbloccare dalla settimana corrente in poi.
- Le assegnazioni esistenti mantengono le condizioni originali anche dopo modifica/archiviazione del catalogo. La consegna è confermata dall'admin, con traccia nell'audit; i punti successivamente insufficienti non cancellano un premio consegnato.
- I record confrontano i punti effettivamente attribuiti secondo le regole del momento: non si normalizzano per i cambi del catalogo.
- I punti dei dati in attesa sono provvisori; quelli rifiutati non aumentano i totali. Un annullamento rifiutato non toglie i punti già confermati. I premi definitivi si leggono dalle assegnazioni del server.

### Modello dati indicativo

| Entità concettuale | Responsabilità |
| --- | --- |
| Profili e ruoli | Identità della giocatrice e dell'admin |
| Definizioni/versioni eventi | Catalogo, punti, attivazione e archiviazione |
| Registrazioni eventi | Proprietario, identificativo client, data, versione, punti ed eventuale annullamento |
| Definizioni premi | Descrizione, condizioni, periodo e stato di disponibilità |
| Premi assegnati | Condizioni storiche, raggiungimento ed eventuale consegna |
| Traccia amministrativa | Modifiche a catalogo, premi e rettifiche pertinenti |
| Combo di cognomi | Raccolta condivisa tra i due ruoli, indipendente dai punteggi; autore, data e rimozioni conservati |
| Note giornaliere | Appunti condivisi associati a una data di calendario, con autore, istante di creazione e rimozioni tracciate |

La tabella descrive le responsabilità concettuali; i nomi e i vincoli implementati si trovano nella migrazione SQL versionata. Per una sola giocatrice bastano query semplici; introdurre aggiornamenti in tempo reale solo se portano un beneficio concreto. Il pannello admin può aggiornarsi all'apertura, al ritorno in primo piano e su richiesta.

## 7. Account e autorizzazione

Baseline di accesso: due account predisposti, email/password, registrazione pubblica disabilitata. L'accesso deve funzionare bene con il gestore password dell'iPhone.

Supabase Row Level Security e i permessi delle funzioni devono applicare i due ruoli lato database. Nascondere una schermata o un pulsante non è una misura di autorizzazione.

- La giocatrice accede ai propri dati e alle definizioni disponibili per il gioco.
- L'admin consulta i risultati e gestisce catalogo e premi tramite operazioni autorizzate.
- Entrambi i ruoli possono consultare, aggiungere e rimuovere combo dalla raccolta condivisa. Questa facoltà non estende i permessi dell’admin sugli episodi della giocatrice.
- Le note giornaliere seguono la stessa condivisione delle combo: entrambi i ruoli possono scrivere, leggere e rimuovere note. Non sono appunti privati dell’account né eventi che assegnano punti; l’interfaccia esplicita la condivisione.
- Il ruolo non proviene da un campo che l'utente può modificare liberamente.
- Il browser usa la chiave pubblica di Supabase; chiavi segrete e privilegi amministrativi non vanno nel bundle o in variabili `VITE_*`.
- Verificare anche le viste e le funzioni che espongono aggregati, per evitare di aggirare le policy.
- Separare cache e operazioni pendenti per account. Un logout non deve perdere silenziosamente inserimenti non inviati né renderli accessibili a un altro utente.

L'SMTP predefinito di Supabase ha limitazioni sulle email verso utenti esterni al team del progetto. Prima di promettere inviti o recupero password via email, configurare un servizio adatto oppure documentare il recupero gestito dall'admin. Non usare le credenziali del progetto Supabase come login dell'admin del gioco.

## 8. Prestazioni, aggiornamenti e costi

### Prestazioni

- Caratteri di sistema e poche risorse iniziali.
- Caricamento separato delle viste admin quando utile.
- Riscontro immediato del tocco e stato locale coerente con la coda persistente.
- Cache per il riutilizzo dell'app, con dati datati riconoscibili.
- Evitare librerie pesanti per schermate, icone o grafici semplici.
- Come obiettivi iniziali misurabili, puntare a LCP entro 2,5 secondi e INP entro 200 ms nelle condizioni di prova dichiarate. Sono obiettivi, non risultati già misurati.

### Aggiornamenti PWA

Proporre una nuova versione in un momento sicuro, dopo aver protetto la coda e le modifiche in corso. Versionare lo storage locale e preservare la compatibilità dei dati pendenti. La cache delle risorse statiche non sostituisce la persistenza dei dati di gioco.

### Budget e continuità

Obiettivo iniziale: **0 euro al mese entro le quote gratuite**, con indirizzo incluso nel servizio. Un dominio personalizzato è opzionale.

La ricerca del 14 novembre 2026 indica richieste statiche gratuite su Cloudflare Pages e un piano Supabase Free sufficiente per il volume previsto. Supabase Free può sospendere progetti dopo un periodo di scarsa attività di circa una settimana; può quindi servire una riattivazione manuale dopo una pausa. Non promettere disponibilità continua garantita su questa base.

Prevedere esportazione dei dati e una procedura documentata di backup e ripristino. Il salvataggio locale ha limiti di persistenza e non è un backup definitivo: iOS o l'utente possono rimuoverlo. Un'esportazione dalla UI e un backup ripristinabile del database hanno scopi diversi.

Verificare prezzi, quote e limitazioni al momento di configurare i servizi o aggiungere funzioni che ne dipendono. Non introdurre abbonamenti, domini o automazioni pianificate come se fossero già richiesti.

## 9. Criteri di verifica durante lo sviluppo

Scegliere controlli proporzionati alla feature, preservando questi comportamenti:

- Un evento viene contato una sola volta dopo timeout e nuovi tentativi.
- Gli inserimenti pendenti sopravvivono alla chiusura e riapertura dell'app, entro i limiti dello storage del dispositivo.
- Il ritorno online riconcilia punti provvisori e confermati; un errore non fa sparire dati in silenzio.
- Sessione scaduta, logout e cambio account non perdono o mescolano code.
- Le modifiche admin a eventi e premi rispettano i ruoli e conservano lo storico.
- Una nuova versione dell'app o del catalogo gestisce correttamente operazioni create con la versione precedente.
- Annullamenti, premi e statistiche restano coerenti.
- Mezzanotte, cambio settimana e ora legale sono interpretati in `Europe/Rome`.
- La UI rispetta le safe area e rimane usabile con tastiera aperta e testo ingrandito.
- I controlli di autorizzazione vengono verificati come anonimo, giocatrice e admin.

I test automatici su WebKit sono utili, ma non sostituiscono una verifica su iPhone reale, sia da Safari sia dalla Home. Dichiarare quali ambienti sono stati effettivamente verificati.

## 10. Decisioni ancora da definire o collaudare

Risolverle quando servono alla feature, proseguendo con il lavoro indipendente possibile. Non riproporre domande già risolte dal contesto o dal codice.

- Catalogo e premi reali: nomi, punti, soglie e descrizioni da preparare con l'admin. Gli esempi non diventano automaticamente regole del regalo.
- Eventuali estensioni a limiti di ripetizione, retrodatazione, periodi personalizzati e normalizzazione dei record: fuori dalla prima versione.
- Collegamento dal browser ai due account Supabase già predisposti e condizioni Free; recupero assistito già predisposto, eventuale SMTP solo se richiesto.
- Verifica del modello/iOS reale, Safari e Home, accessibilità, affidabilità offline e prestazioni sul telefono.
- Collaudo del frontend già pubblicato su Cloudflare Pages, prova di backup/ripristino e catalogo definitivo prima della consegna.

## 11. Registro delle decisioni

| Data | Decisione | Effetto |
| --- | --- | --- |
| 2026-11-14 | Webapp con account e dati condivisi; React + Vite | Base applicativa scelta dall'utente |
| 2026-11-14 | Una sola giocatrice in sfida con se stessa | Classifica intesa come record personali |
| 2026-11-14 | Ricerca su architettura e design prima dello sviluppo | Baseline tecnica documentata, ancora da implementare |
| 2026-11-14 | Scelta del concept Diario | Guida per interfaccia e tono del prodotto |
| 2026-11-14 | Admin abilitato a gestire eventi e premi | Superata la proposta di admin in sola lettura |
| 2026-11-14 | Contesto persistente nel repository, richiamato da AGENTS.md | Rilettura e manutenzione richieste per le modifiche future |
| 2026-11-14 | Avvio dello sviluppo e roadmap richiesta dall'utente | Quattro sprint: Diario locale, dati condivisi/account, affidabilità offline/PWA, verifica e consegna |
| 2026-11-14 | Sprint 1 implementato con TypeScript e persistenza IndexedDB demo | Esperienza provabile senza servizi esterni; nessun account, sincronizzazione o premio definitivo simulato come reale |
| 2026-11-14 | Utente: continuare con gli sprint, progetto Supabase non ancora esistente | Preparare configurazione, migrazione e codice senza creare servizi esterni |
| 2026-11-14 | Approvate le regole iniziali per eventi ripetibili, periodi premi e annullamenti | Prima versione implementata con condizioni storiche e consegna separata |
| 2026-11-14 | Codice account/condivisione, coda offline e PWA implementato e testato localmente | Attivazione e collaudo ospitato/iPhone ancora necessari; produzione senza configurazione chiusa |
| 2026-11-14 | Progetto Supabase creato e integrazione autorizzata dall’utente; account indicati per admin e giocatrice | Migrazioni applicate, profili assegnati e configurazione locale reale; nessuna email/UUID personale versionata |
| 2026-11-14 | Verifica sul database ospitato con rollback e revisione advisor | Core dati verificato senza lasciare dati demo; Auth/PostgREST dal browser e consegna iPhone restano da collaudare |
| 2026-11-14 | Utente conferma “Allow new users to sign up” già disattivato | Signup pubblico chiuso secondo conferma della dashboard; non richiedere nuovamente questa conferma |
| 2026-11-14 | Utente autorizza l’agente a pubblicare tramite Cloudflare | Pages collegato a GitHub `main`, produzione remota su `fantafolletto.pages.dev`, anteprime automatiche disabilitate; deploy confermato da Cloudflare, verifica browser/iPhone ancora da completare |
| 2026-11-14 | Richiesta di una sezione per le migliori combo di cognomi divertenti; l’utente precisa che il secondo cognome deve essere opzionale | Sezione Combo con un solo cognome o una coppia e nota facoltativa; raccolta condivisa senza punti, con coda offline e rimozione tracciata. Implementata e verificata localmente; attivazione della migrazione e pubblicazione successive |
| 2026-11-14 | Richiesta di una sezione Note giornaliere per annotare le cose successe durante la giornata | Aggiunti testo libero, giornata selezionabile e storico per data. Salvataggio offline, condivisione tra i due ruoli e rimozione con conferma; nessun effetto sul gioco. Implementazione e migrazione verificate localmente, attivazione ospitata e pubblicazione ancora da eseguire |

## 12. Fonti della ricerca

Le fonti aiutano a verificare le scelte tecniche; non sostituiscono i requisiti dell'utente. Consultate durante la ricerca iniziale del 14 novembre 2026:

- [FantaSanremo, regolamento 2026](https://fantasanremo.com/data/rulebook/1767882222056/rulebook-it.pdf).
- [Apple: usare un sito come app su iPhone](https://support.apple.com/it-it/guide/iphone/iphea86e5236/ios).
- [Apple: linee guida sui pulsanti](https://developer.apple.com/design/human-interface-guidelines/buttons).
- [Apple: specifiche iPhone 14 Pro](https://support.apple.com/it-it/111849).
- [Cloudflare Pages: prezzi e richieste statiche](https://developers.cloudflare.com/pages/functions/pricing/).
- [Supabase: prezzi](https://supabase.com/pricing).
- [Supabase: sospensione dei progetti Free](https://supabase.com/docs/guides/platform/free-project-pausing).
- [Supabase: backup](https://supabase.com/docs/guides/platform/backups).
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase: funzioni database](https://supabase.com/docs/guides/database/functions).
- [Supabase: invio email e SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- [TanStack Query: operazioni offline e persistenza](https://tanstack.com/query/latest/docs/framework/react/guides/mutations).
- [Vite PWA: aggiornamento con conferma](https://vite-pwa-org.netlify.app/guide/prompt-for-update).
- [MDN: Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).
- [WebKit: persistenza e rimozione dello storage](https://webkit.org/blog/14403/updates-to-storage-policy/).
- [Web.dev: Core Web Vitals](https://web.dev/articles/vitals).
- [Supabase: backup/ripristino tramite CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
- [Supabase: recupero amministrativo updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).
