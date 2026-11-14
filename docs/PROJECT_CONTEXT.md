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
| Catalogo | 37 eventi approvati, sei categorie e rarità separata; escluso «Il civico fantasma» |
| Combo giornaliera | Stesso evento ripetuto nello stesso giorno italiano: incremento percentuale lineare e tetto entrambi modificabili dall’admin; modifiche dal giorno seguente |

### Baseline proposta dalla ricerca

Le scelte seguenti costituiscono il punto di partenza tecnico consigliato dalla ricerca. Le parti effettivamente adottate sono elencate nello stato reale; le altre non sono ancora configurate né tutte approvate singolarmente:

- TypeScript per il codice applicativo.
- Cloudflare Pages per ospitare il frontend statico.
- Supabase Auth e PostgreSQL per account, autorizzazione e dati condivisi, preferibilmente in regione europea.
- TanStack Query per richieste, cache e aggiornamento dei dati.
- IndexedDB per cache locale e coda persistente degli inserimenti.
- `vite-plugin-pwa` per manifest, risorse offline e gestione degli aggiornamenti.
- CSS leggero, carattere di sistema per i testi operativi e Fraunces locale per l'identità e i titoli; icone SVG essenziali per il design.

### Stato reale dopo la pubblicazione

- React + Vite + TypeScript, design Diario Oggi/Record/Premi/Combo/Note, safe area e modalità scura; viste admin e servizio remoto caricati separatamente.
- Il comando per annullare un episodio nelle viste Oggi e Record usa un cestino Lucide (`Trash2`), al posto della freccia circolare risultata ambigua. Conserva etichetta accessibile, area di tocco e comportamento di annullamento con storico. Superati 82 test automatici, build TypeScript/Vite e verifica PWA; modifica non verificata su iPhone reale.
- **Note giornaliere, migrazione applicata al servizio:** testo libero obbligatorio fino a 2000 caratteri, data preimpostata sulla giornata corrente in `Europe/Rome` e modificabile, più note per giorno e storico raggruppato per data, dalla più recente. Accessibili dal diario e dall’area admin; condivise tra i due account, che possono inserire e rimuovere dopo conferma. Nessun effetto sui punti o sui premi. Le note vengono salvate in IndexedDB prima della conferma, poi inviate con identificativo stabile; rimozioni pendenti, errori e invii ambigui restano protetti dalla coda esistente. La migrazione locale `20261114224726_daily_notes.sql` aggiunge tabella con RLS, RPC autorizzate, rimozioni tracciate e campo `notes` nello snapshot/export. Legge i diari precedenti senza `notes`; conserva data, testo e autore nel database. Verificata localmente con test su calendario, UI, persistenza, account, riconciliazione e PostgreSQL PGlite; migrazione applicata e verificata sul servizio ospitato con rollback delle prove; frontend pubblicato su Cloudflare Pages nel rilascio `8030047`. Nessuna verifica su iPhone reale eseguita per questa modifica.
- **Combo di cognomi, migrazione applicata al servizio:** raccolta di cognomi divertenti, con primo cognome obbligatorio (massimo 60 caratteri), secondo cognome facoltativo (60) e nota facoltativa (180). Accessibile dalla voce «Combo» del diario e da «Cognomi» nell’area admin; entrambi i ruoli possono inserire e rimuovere dopo conferma. Nessun effetto su punti, episodi o premi. Demo persistente in IndexedDB; modalità condivisa con la stessa coda per account, deduplicazione e riconciliazione degli episodi. La migrazione `20261114224718_surname_combos.sql`, generata con la CLI, aggiunge tabella protetta da RLS, RPC con controllo del ruolo e rimozioni tracciate, e il campo `combos` allo snapshot e quindi all’export. Migrazione verificata localmente in PGlite e applicata al progetto ospitato; frontend pubblicato su Cloudflare Pages nel rilascio `8030047`. I diari precedenti senza `combos` restano leggibili. Test su dominio, UI, IndexedDB, invii con timeout e permessi; nessun collaudo iPhone reale dichiarato.
- Spaziatura superiore: 24 px aggiuntivi oltre la safe area su tutte le pagine, 48 px per il login, anche nella versione aggiunta alla Home. La regola per schermi larghi conserva questo spazio. Modifica richiesta dopo il riscontro dell’utente sul login troppo in alto e sulle pagine vicine alla Dynamic Island; verifica finale sul dispositivo ancora necessaria.
- Revisione spaziature: la vista Premi usa un contenitore a griglia con 24 px tra catalogo e premi conquistati, anche senza premi disponibili. Rimosso il margine superiore annullato dalla regola generica dei pannelli; niente paragrafi vuoti per descrizioni assenti e niente margine finale aggiuntivo nel messaggio dei premi ancora vuoti. Marchio, azioni, classifiche e titoli gestiscono meglio spazi stretti e testi lunghi.
- Revisione Note e Combo dopo gli screenshot dell’utente: griglia con 24 px tra titolo, azioni, informazioni e raccolte, 12 px tra pulsante e conferma di salvataggio e 16 px tra le giornate. Eliminati i margini aggiuntivi dei pannelli e il doppio spazio fra titolo e prima voce delle schede. Moduli con 20 px tra i campi; data e testo della nota hanno la stessa larghezza, con vincoli espliciti sul controllo data nativo, e i pulsanti «Salva nota»/«Salva combo» sono a destra. Cinque test esistenti di UI/navigazione, build demo/produzione e verifica PWA superati; controllo Chromium locale a 320/375/393/430/768 px nei due temi, raccolte vuote e popolate, più giornate e testo lungo: larghezze e allineamenti corretti, nessuno scorrimento orizzontale o errore JavaScript. Non ancora verificata su Safari/iPhone reale né pubblicata questa revisione.
- Identità visiva rivista su richiesta dell'utente: F avorio con cappello da folletto, campanellino e scintilla dorati su verde bosco; lettering serif con seconda parte corsiva. Un unico componente `Brand` per intestazione e accesso; favicon e icone PWA/iPhone derivate dallo stesso originale. Revisione inviata su `main` con commit `2a1142e` e poi integrata nel rilascio `bfaf811` di categorie e combo, pubblicato su Cloudflare Pages. Originale e note in `docs/brand/`; verifiche Chromium della demo a 320/375/393/430/768 px, temi chiaro/scuro e spazio per due azioni dell'intestazione superate. Nessuna prova su iPhone reale implicita.
- Dopo il confronto visuale Lora/Fraunces/DM Serif Display, l'utente ha scelto **Fraunces**: normale e corsivo variabili latini ospitati nell'app (circa 81 KiB complessivi, OFL 1.1), usati per nome, titoli, punteggi principali e citazione. Testi operativi e moduli mantengono il carattere di sistema. Font inclusi nella cache PWA e verificati dallo script di build. Nove icone SVG originali in `DiaryIcons.tsx` coordinano navigazione, premi, stati vuoti ed eventi demo; i comandi mantengono Lucide. Corrette le associazioni risata/cuore e pioggia/sole. Nella revisione iniziale gli eventi con identificativi non riconosciuti usavano la scintilla generica. Con le categorie ora usano il simbolo coordinato della categoria, mantenendo le associazioni specifiche degli eventi demo; gli incontri incredibili conservano la scintilla. Verificati in Chromium demo Oggi/Record/Premi, selettore eventi e riepilogo admin nei due temi a 320/375/393/430/768 px; riapertura senza rete con entrambi i font e le icone disponibile, senza risorse esterne o errori JavaScript. I 43 test esistenti e la build PWA sono superati. Confronti visuali in `docs/brand/`; revisione inviata su `main` con commit `2a1142e`, poi pubblicata insieme a categorie e combo nel rilascio `bfaf811`; non collaudata su Safari/iPhone reale.
- Due modalità distinte: demo locale esplicita, oppure `remote` con login email/password e ruolo letto dal database. La produzione senza configurazione non apre una demo né un falso admin. `.env.example` descrive le sole variabili pubbliche; `.env.demo` abilita una build demo separata.
- Schema Supabase applicato al progetto reale, con migrazioni iniziali `20261114130522_diary.sql` e `20261114131302_tighten_diary_permissions.sql`, seguite da `20261114161017_categories_combo.sql` e `20261114163107_approved_catalog.sql`: profili e ruoli protetti, eventi/versioni, episodi, premi, assegnazioni storiche, consegne e audit admin. RLS e grant negano le scritture dirette dal browser; le RPC controllano ruolo, versione e deduplicazione.
- Login/logout e recupero assistito dall'operatore implementati nel codice; nessuna registrazione pubblica o email di recupero promessa senza configurazione. `scripts/reset-password.mjs` usa una chiave segreta solo fuori dal frontend e una password da stdin nascosto.
- Categorie e combo: filtri condivisi tra selezione giocatrice e catalogo admin, distintivi raro/leggendario, prossimo punteggio stimato e progressivo di oggi; categoria, rarità e ripetizione modificabili nel modulo evento. Nuova scheda admin «Combo», anteprima su 10 punti, incremento 0–1000% intero, tetto ×1–×20 con un decimale. Baseline attiva +20% e ×3; entrambi configurabili. Regole versionate e applicate dal giorno italiano successivo al salvataggio; 0% o ×1 disattivano il bonus.
- Calcolo server della combo serializzato sul profilo: ordine per istante dell’episodio e UUID, stesso evento anche attraverso versioni diverse; reset al cambio giorno Europe/Rome. Invii fuori ordine e annullamenti ricalcolano il bonus del solo evento/giorno e riconciliano i premi, usando la versione delle impostazioni salvata in ciascun episodio. Le modifiche admin non riscrivono le regole storiche; gli episodi precedenti alla funzione conservano il punteggio. Le sfide sono una al giorno, annullabili e registrabili nuovamente dopo correzione; i malus non sono moltiplicati.
- Admin: consulta lo snapshot della giocatrice, gestisce online eventi e premi con controllo della versione e identificativo stabile per i ritentativi, conferma consegne ed esporta JSON consultabile. Non registra né annulla episodi al posto della giocatrice.
- Giocatrice: registra e annulla con coda IndexedDB per progetto/account; conferma locale dopo transazione, punti provvisori distinguibili, riconciliazione idempotente e invii rifiutati visibili/riprovabili/rimuovibili dopo conferma. Le operazioni ambigue restano in coda fino alla lettura di conferma dal server.
- Refresh tramite TanStack Query all'apertura, al ritorno in primo piano/connessione, su richiesta e ogni 30 secondi mentre la vista è attiva. Web Locks quando disponibili e RPC idempotenti proteggono gli invii da più schede. Ogni RPC usa il token del proprietario verificato anche se la sessione cambia durante la richiesta.
- Cache e code reali sono separate dalla demo. Un logout conserva la coda per lo stesso account senza mostrarla all'altro. Dati/versioni locali incompatibili vengono conservati e segnalati, non azzerati.
- Manifest PWA, icone PNG/iPhone, service worker per le sole risorse statiche, indicazioni per la Home e aggiornamento su richiesta. Il pulsante di aggiornamento attende moduli chiusi e assenza di operazioni pendenti. Non si dipende dal Background Sync di Safari; Auth e risposte del database non entrano in Cache Storage.
- Dopo la segnalazione della grafica precedente in Safari, il controllo delle nuove versioni viene richiesto alla registrazione del service worker, al ritorno in primo piano, alla riconnessione e ogni cinque minuti mentre la pagina è visibile e online. Controlli simultanei deduplicati; errori temporanei non invalidano le risorse offline. La scoperta della versione nuova non ne forza l'attivazione: restano la conferma «Aggiorna app» e i blocchi per moduli/code. Prova locale Chromium con passaggio dalla versione con foglia a quella con F/Fraunces: nuovo stile caricato dopo ricarica e conferma, episodio demo e 10 punti preservati. Non è una verifica del telefono dell'utente; l'apertura del sito pubblico dal browser remoto è rimasta impedita dall'ambiente.
- Regole iniziali approvate dall'utente: eventi ripetibili al momento, premi settimanali o totali, revoca dei premi non consegnati dopo annullamento e conservazione con segnalazione di quelli consegnati. I dettagli operativi sono sotto.
- La demo resta separata. Su richiesta esplicita dell’utente sono stati attivati 37 eventi scelti nella ricerca, con sei categorie, rarità e otto sfide giornaliere. I quattro eventi di prova precedenti sono archiviati, esclusi dalla selezione della giocatrice e consultabili dall’admin attivando gli archiviati; il connettore non ha completato la conferma per la cancellazione definitiva, quindi è stata adottata la sostituzione reversibile. Premi ed episodi esistenti conservati. Il catalogo iniziale è in `src/domain/catalog.json` e nella migrazione corrispondente: modificarne i file non aggiorna automaticamente i dati già attivi. Dopo l’attivazione l’utente ha mostrato la vista Premi con un premio configurato. Non assumere più che il catalogo reale sia vuoto; nessun contenuto personale dello screenshot è copiato nel repository. Nome/punti/versione degli episodi e condizioni dei premi assegnati conservano lo storico.
- Test locali su dominio/calendario, IndexedDB simulato, riconciliazione e UI in jsdom; migrazione/RPC/RLS eseguite in PostgreSQL PGlite con identità Supabase simulate. Workflow GitHub per test e build. I controlli locali non certificano Auth/PostgREST o Safari; la successiva verifica database ospitata è distinta e descritta sotto.
- **Supabase predisposto:** progetto FantaFolletto `eynngtnxtomcwblmughq` creato dall’utente, attivo in `eu-west-1`; schema e correzioni advisor applicati tramite MCP. Due utenti Auth confermati dall’utente e ruoli admin/player assegnati. `.env.local` configurato, ignorato da Git; nessun dato personale o segreto nel repository.
- Verifica transazionale sul database ospitato superata: ruoli, RPC, divieti di scrittura diretta, punti, ritentativi, premi, annullamenti e storico; rollback finale, catalogo e dati di gioco ancora vuoti. Nuova migrazione con indici, policy che valutano i claim una volta per statement e revoca dell’accesso client al trigger automatico RLS.
- Non è stato eseguito un login reale dal frontend: le prove database impostano i claim del ruolo SQL, non producono sessioni Auth. Il tentativo HTTP dall’ambiente ha fallito la risoluzione DNS (`EAI_AGAIN`). L’utente ha confermato il 14 novembre 2026 che “Allow new users to sign up” è disattivato nella dashboard; registrare questa conferma senza presentarla come verifica automatica del connettore, che non espone tale impostazione.
- **Pubblicato su [fantafolletto.pages.dev](https://fantafolletto.pages.dev)**: progetto Cloudflare Pages `fantafolletto`, repository GitHub esistente, produzione da `main` con trigger automatico abilitato nella configurazione ma non ancora verificato dopo un push, build `npm run build`, output `dist`, Node 24. Variabili pubbliche Supabase configurate in produzione con modalità `remote`; anteprime automatiche disabilitate e ambiente preview predisposto solo come demo. Nessun servizio a pagamento attivato.
- Primo deploy confermato riuscito dall’API e dai log Cloudflare il 14 novembre 2026; build locale e controllo PWA superati. Il browser dell’agente non ha completato l’avvio per errore di requisiti/trasporto; il controllo HTTP dall’ambiente è stato respinto dal proxy. Nessuna verifica visuale, login reale o prova iPhone dichiarata come superata. Backup/ripristino ospitato e misure LCP/INP da fare. Dettagli, limiti e link degli advisor in [ACTIVATION.md](ACTIVATION.md).
- Verifica visuale successiva riuscita in Chromium locale: Oggi, Record (vuoti e con classifica giornaliera/settimanale), Premi (con catalogo e messaggio dei conquistati vuoto), catalogo admin e modulo evento. Usati dati fittizi temporanei e zoom 100/200/300% per controllare anche una larghezza CSS di circa 390 px; verificato visivamente il distacco tra le schede segnalate. Nessun accesso a Supabase o modifica dei dati reali durante questa revisione. Non equivale a emulazione iPhone, verifica della tastiera iOS o collaudo di Safari/Home.
- Attivazione passo passo in [SETUP.md](SETUP.md), manutenzione in [OPERATIONS.md](OPERATIONS.md), criteri degli sprint in [ROADMAP.md](ROADMAP.md), avvio in [README.md](../README.md).

Aggiornare questa sezione quando lo stato cambia. Non confondere il comportamento desiderato con quello effettivamente disponibile.

Le sezioni architetturali seguenti descrivono il comportamento del prodotto; lo stato qui sopra distingue il codice presente dal servizio effettivamente configurato e collaudato. La demo locale non è un'autorizzazione a usare un selettore di ruolo nella versione con account.

## 3. Idea di gioco e perimetro

L'ispirazione è FantaSanremo: eventi riconoscibili danno punti secondo un regolamento. Qui il meccanismo viene adattato a una persona che registra episodi della propria giornata lavorativa.

Il ciclo principale è: **succede un episodio → lo registra → ottiene punti → vede progressi e record → raggiunge un premio**.

La classifica personale confronta giornate e settimane della stessa giocatrice. Non servono squadre, mercato, capitani o leghe per riprodurre integralmente FantaSanremo.

La direzione proposta privilegia episodi buffi e piccoli traguardi. Evitare di trasformare la prima versione in un gestionale delle vendite: per il gioco bastano tipo di evento, data e punti. Non sono necessari nomi, indirizzi o contatti dei clienti.

Catalogo approvato: 37 eventi, inclusi incontri buffi, piccoli traguardi, eventi leggendari e otto sfide giornaliere; escluso «Il civico fantasma». Categorie: Incontri e gentilezze, Animali di casa, Piccole vittorie, Imprevisti e scene buffe, Incontri incredibili, Sfide. La rarità (normale/raro/leggendario) è indipendente dalla categoria. Nomi, descrizioni e punti di partenza sono documentati in [EVENT_CATALOG.md](EVENT_CATALOG.md). Le sfide vengono registrate manualmente sulla fiducia: non si sbloccano automaticamente leggendo altri eventi. Premi e soglie restano gestiti dall’admin; i premi del concept e il traguardo di 300 punti erano esempi.

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
- Carattere di sistema per testi e comandi; Fraunces locale per nome, titoli e punteggi principali, numeri grandi e gerarchia semplice.
- Angoli arrotondati e decorazioni contenute.
- Testi brevi, in italiano, con tono affettuoso e giocoso.
- Le scelte cromatiche sono una baseline modificabile; la preferenza confermata riguarda la direzione Diario, non ogni singolo valore grafico.

### Identità visiva implementata

Il 14 novembre 2026 l'utente ha richiesto un logo più curato. La proposta implementata usa una F il cui tratto superiore diventa un cappello da folletto, accompagnato da campanellino e scintilla dorati. Il simbolo avorio su verde bosco richiama il nome e le piccole conquiste personali. Nel confronto successivo tra Lora, Fraunces e DM Serif Display, l'utente ha scelto esplicitamente Fraunces, che ora sostituisce il precedente lettering serif di sistema. «Folletto» rimane in corsivo. Il carattere è servito localmente e incluso nella cache offline; non si dipende da richieste a Google Fonts.

`src/components/Brand.tsx` mantiene coerenti intestazione del diario e accesso. Favicon, icona Home iPhone e icone PWA usano lo stesso simbolo; il file maskable ha fondo pieno e margini per il ritaglio. Il sorgente raster e le indicazioni di esportazione sono in [brand/README.md](brand/README.md). La direzione Diario e i colori dell'interfaccia restano quelli definiti sopra.

`src/components/DiaryIcons.tsx` contiene nove simboli SVG con tratto arrotondato, dettagli oro e la scintilla a quattro punte del logo: diario, coccarda record, regalo, scintilla, caffè, impronta, sorriso, pioggia e tesserino del nome. Le icone decorative sono escluse dall'albero accessibile; un'icona con etichetta esplicita espone il ruolo immagine. Frecce, chiusura, aggiunta, annullamento, impostazioni e sincronizzazione mantengono i simboli Lucide già utilizzati. La personalizzazione non aggiunge un selettore di icone al catalogo né nuovi campi nel database.

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

Lasciare spazio anche sotto la safe area superiore: il margine di pagina si somma a `env(safe-area-inset-top)`, anziché usare il maggiore fra i due valori. Baseline attuale: 24 px per le pagine e 48 px per il login. Conservare lo scorrimento naturale per l’uso con tastiera aperta e su schermi bassi.

Per gruppi di schede usare un contenitore con `gap`, evitando di combinare margini delle singole schede che possono essere azzerati dalla cascata CSS. La vista Premi mantiene 24 px tra le sezioni e 18 px tra i premi disponibili. Le descrizioni facoltative assenti non devono creare spazio vuoto.

Le sezioni Note e Combo condividono una griglia con 24 px tra i blocchi e 12 px tra azione e conferma. Le schede delle giornate mantengono 16 px di distanza. Nei moduli di inserimento i campi occupano la stessa larghezza disponibile, compreso il selettore data nativo; l’azione di salvataggio è allineata a destra e separata dal contatore dei caratteri.

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

- Eventi ripetibili oppure una volta al giorno, configurabili dall’admin; malus ammessi; registrazione al momento, nessun selettore per retrodatare. Le otto sfide iniziali sono una volta al giorno. Gli eventi diversi si sommano, incluse le sfide rispetto alle normali vendite.
- Combo dello stesso evento nello stesso giorno: `arrotonda(punti_base × min(tetto, 1 + (occorrenza − 1) × incremento / 100))`, arrotondamento al più vicino con mezzo punto verso l’alto. Esempio 10 punti, +20%, tetto ×3 → 10/12/14/16/18…30. Solo punti base positivi ed eventi ripetibili. Il calcolo client usa centesimi interi per corrispondere a `numeric` PostgreSQL.
- Impostazioni globali con versioni e data italiana di decorrenza: salvataggio admin dal giorno successivo, ultima versione salvata per quel giorno prevalente. La prima attivazione usa +20%, ×3; per giorni precedenti vale la regola senza bonus. Il tetto è modificabile, non fissato nel codice a ×3.
- Annullamento o invio tardivo possono cambiare i progressivi/bonus degli altri episodi dello stesso evento/giorno e i premi derivati. Restano fissi punti base e versione delle impostazioni di ciascun episodio. Gli annullati conservano i valori al momento dell’annullamento. Il catalogo admin non modifica retroattivamente quei dati.
- Settimana italiana da lunedì. Un premio totale si conquista una volta per definizione, uno settimanale una volta per settimana: la chiave è proprietario + premio + periodo, non la versione del testo.
- Modificare il premio può usare punti già confermati del periodo corrente, conservando le condizioni di quanto già assegnato. Un premio settimanale nuovo/modificato non crea nuove assegnazioni per settimane prima della modifica; può sbloccare dalla settimana corrente in poi.
- Le assegnazioni esistenti mantengono le condizioni originali anche dopo modifica/archiviazione del catalogo. La consegna è confermata dall'admin, con traccia nell'audit; i punti successivamente insufficienti non cancellano un premio consegnato.
- I record confrontano i punti effettivamente attribuiti secondo le regole del momento: non si normalizzano per i cambi del catalogo.
- I punti dei dati in attesa sono provvisori; quelli rifiutati non aumentano i totali. Un annullamento rifiutato non toglie i punti già confermati. I premi definitivi si leggono dalle assegnazioni del server.

### Modello dati indicativo

| Entità concettuale | Responsabilità |
| --- | --- |
| Profili e ruoli | Identità della giocatrice e dell'admin |
| Categorie eventi | Nome, icona e ordine delle sei categorie iniziali; tabella separata con RLS |
| Definizioni/versioni eventi | Catalogo, categoria, rarità, ripetizione, punti, attivazione e archiviazione |
| Regole combo versionate | Percentuale, tetto globale e giorno italiano di decorrenza; modifica solo admin |
| Registrazioni eventi | Proprietario, identificativo client, data, versione evento, punti base/finali, progressivo e bonus combo, versione regole ed eventuale annullamento |
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

- Caratteri di sistema per i testi operativi e due file Fraunces latini locali per la tipografia espressiva; precaricamento del solo normale, `font-display: swap` e cache offline per entrambi.
- Caricamento separato delle viste admin quando utile.
- Riscontro immediato del tocco e stato locale coerente con la coda persistente.
- Cache per il riutilizzo dell'app, con dati datati riconoscibili.
- Evitare librerie pesanti per schermate, icone o grafici semplici.
- Come obiettivi iniziali misurabili, puntare a LCP entro 2,5 secondi e INP entro 200 ms nelle condizioni di prova dichiarate. Sono obiettivi, non risultati già misurati.

### Aggiornamenti PWA

Proporre una nuova versione in un momento sicuro, dopo aver protetto la coda e le modifiche in corso. Versionare lo storage locale e preservare la compatibilità dei dati pendenti. La cache delle risorse statiche non sostituisce la persistenza dei dati di gioco.

Controllare la disponibilità del service worker alla registrazione, su focus/ritorno visibile e connessione, e ogni cinque minuti con pagina visibile e online. Non confondere il controllo con l'attivazione, che rimane esplicita. Una scheda ancora eseguita da una versione precedente può richiedere una ricarica per scoprire la nuova build, seguita da «Aggiorna app». Non risolvere la grafica precedente cancellando dati del sito o IndexedDB.

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

- Catalogo iniziale approvato e attivato; ulteriori aggiustamenti di punti e premi si fanno dall’admin. I dati della demo restano separati.
- Eventuali estensioni a limiti diversi da una volta al giorno, retrodatazione, periodi personalizzati e normalizzazione dei record: fuori dalla versione attuale.
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
| 2026-11-14 | Utente segnala l’icona ambigua per eliminare un evento e richiede il push su main | Sostituita la freccia circolare con un cestino negli episodi di Oggi e Record; annullamento e conservazione dello storico invariati |
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
| 2026-11-14 | Richiesta di una sezione per le migliori combo di cognomi divertenti; l’utente precisa che il secondo cognome deve essere opzionale | Sezione Combo con un solo cognome o una coppia e nota facoltativa; raccolta condivisa senza punti, con coda offline e rimozione tracciata. Implementata e verificata localmente; successiva attivazione ospitata registrata sotto |
| 2026-11-14 | Richiesta di una sezione Note giornaliere per annotare le cose successe durante la giornata | Aggiunti testo libero, giornata selezionabile e storico per data. Salvataggio offline, condivisione tra i due ruoli e rimozione con conferma; nessun effetto sul gioco. Implementazione e migrazione verificate localmente; successiva attivazione ospitata registrata sotto |
| 2026-11-14 | Utente segnala login Home troppo in alto e pagine vicine alla Dynamic Island | Spazio superiore aggiuntivo rispetto alla safe area: 48 px sul login e 24 px nelle altre pagine, preservato anche sugli schermi larghi |
| 2026-11-14 | Utente segnala spaziature irregolari mostrando le schede Premi attaccate | Griglia con distanza esplicita fra sezioni, descrizioni vuote omesse e allineamenti protetti per contenuti lunghi; revisione visuale locale in Chromium con dati fittizi |
| 2026-11-14 | Utente richiede spaziature più curate nelle pagine Note e Combo, campi della nuova nota larghi uguali e pulsante di creazione a destra | Distanze esplicite fra blocchi e conferme, schede senza margini doppi, moduli con campi uniformi e salvataggio a destra; controlli responsive locali superati, verifica Safari/iPhone e pubblicazione ancora da eseguire |
| 2026-11-14 | Utente richiede una revisione più curata del logo | Realizzata identità F/cappello/scintilla, lettering serif e risorse coordinate per app/PWA/iPhone; verifica locale superata, pubblicazione di questa modifica non eseguita |
| 2026-11-14 | Utente richiede prove di font e coerenza delle icone; sceglie Fraunces tra tre anteprime | Fraunces normale/corsivo locale per identità e titoli; carattere di sistema nei comandi; nove SVG coordinati e associazioni degli eventi corrette; font inclusi nella cache PWA, revisione non pubblicata |
| 2026-11-14 | Utente richiede il push delle modifiche | Logo, Fraunces e icone inviati su `main` con commit `2a1142e`, integrando le correzioni remote di safe area e spaziature; 43 test, build e verifica offline ripetuti con esito positivo. Al controllo successivo al push Cloudflare serve ancora `bc6cfbb`; avvio manuale del deploy non eseguito per rifiuto del controllo automatico delle autorizzazioni |

### Catalogo e combo — verifica successiva

- Frontend pubblicato su Cloudflare Pages con sorgente `bfaf81175833ca17938ab0312aae977aaf3345d3`, deployment `8e0fc155-d948-4b64-ad05-4ba88d4c95eb`, fase deploy riuscita il 14 novembre 2026 alle 17:41:46 italiane. Include anche le modifiche remote a logo, font e icone; pubblicazione confermata dall’API, senza login Auth reale dell’agente.
- Migrazioni allineate alle versioni della cronologia Supabase e applicate al progetto ospitato. Due nuove tabelle con RLS, grant di sola lettura e controlli di ruolo nelle RPC; funzioni precedenti riutilizzate solo nel namespace privato senza EXECUTE client.
- Verifica transazionale ospitata delle nuove RPC superata: 10/12/14, annullamento → 10/12, sfida duplicata respinta, giocatrice esclusa dalle impostazioni, tetto decimale admin programmato per domani. `ROLLBACK` finale: nessun episodio, evento o impostazione di verifica rimasti.
- Suite ampliata a 58 test: dominio, vecchi dati, arrotondamento, giorni italiani/DST, ordine degli invii, coda offline, RPC/PGlite, sfide, premi, permessi e UI admin/filtri. Build TypeScript/Vite, manifest, icone, header e 14 risorse offline verificati dopo l’integrazione delle modifiche remote a logo, Fraunces e icone. JavaScript iniziale circa 81,5 kB gzip, admin circa 4,7 kB gzip, CSS circa 5,4 kB gzip; non sono misure di LCP/INP.
- Verifica visuale in Chromium con iframe di larghezza effettiva 390 CSS px e dati fittizi temporanei: catalogo completo, filtri Animali, distintivi leggendari, prossimo bonus e pannello Combo. Provati +100% e tetto ×4,5 nella sola anteprima locale, con decorrenza dal giorno successivo e regole di oggi conservate. Nessuna sessione Auth o modifica remota tramite browser; iPhone/Safari restano da verificare.
- Advisor: nessuna nuova anomalia di RLS/grant/indici mancanti. Restano le quattro RPC privilegiate intenzionali, l’avviso password Pro e alcuni indici non ancora usati, con rimedi in [ACTIVATION.md](ACTIVATION.md).
- Decisione del 14 novembre 2026: utente approva categorie, rarità e combo +20% con tetto iniziale ×3; richiede esplicitamente che anche il tetto sia modificabile dall’admin e autorizza il ritiro dei propri eventi di prova. Implementazione effettiva: archiviazione reversibile dei quattro precedenti eventi e inserimento del catalogo approvato.

### Rilascio Cognomi e Note — attivazione del 14 novembre 2026

- Richiesta esplicita dell’utente: push su `main` e pubblicazione di entrambe le sezioni.
- Integrato il `main` remoto fino a `d064abf`, mantenendo marchio/Fraunces, icone, safe area, categorie, catalogo approvato, bonus versionati e controllo degli aggiornamenti PWA. L’admin mantiene «Combo» per i bonus e trova la raccolta dei cognomi in «Cognomi»; nel diario le nuove voci sono «Combo» e «Note».
- Applicate sul servizio le migrazioni `20261114224718_surname_combos.sql` e `20261114224726_daily_notes.sql`, con nomi locali allineati alla cronologia remota. Gli snapshot precedenti sono preservati in funzioni private non eseguibili dai client; le nuove funzioni aggiungono i campi richiesti senza sostituire categorie o regole esistenti.
- Verifica RPC ospitata per entrambi i ruoli superata: cognome singolo, note, ritentativi, payload incompatibile respinto, lettura incrociata e rimozioni idempotenti. Tutte le prove sono in una transazione annullata; nessun dato dimostrativo lasciato. Conservati 41 eventi/versioni, un episodio e un premio esistenti; raccolte nuove vuote. Grant diretti di scrittura, accesso anonimo e invocazione delle copie private negati.
- Dopo l’integrazione: 82 test automatici, build e verifica PWA superati. Push su `main` riuscito (`8030047`), deploy Cloudflare `940b7983-8a62-4f17-a206-4aa47a419b58` in stato `success` alle 22:50:05 UTC. Registro in `ACTIVATION.md`.
- Esportazione completa di backup non eseguita: il controllo automatico ha rifiutato la lettura estesa di dati applicativi e identità Auth. Proseguite soltanto le aggiunte autorizzate e la conservazione delle funzioni precedenti, senza esportazione di dati privati. Questo ripristino limitato delle definizioni non è un backup completo; la procedura di backup/ripristino del servizio resta da completare.
- Advisor: otto RPC privilegiate intenzionalmente invocabili dagli account autenticati (quattro nuove per le raccolte), ruolo verificato internamente e accesso anonimo escluso. Resta l’avviso Auth preesistente; nessun upgrade attivato. Rimedi e motivazioni in `ACTIVATION.md`. Nessun nuovo collaudo iPhone/Safari o login con password dell’agente dichiarato.

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
