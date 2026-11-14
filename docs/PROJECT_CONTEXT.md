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
- Prima dello sviluppo è stata richiesta ricerca su architettura e design. Il 14 novembre 2026 l'utente ha autorizzato l'avvio dello sviluppo e una roadmap per sprint: ora esiste la demo locale dello sprint 1, descritta sotto.

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

### Baseline proposta dalla ricerca

Le scelte seguenti costituiscono il punto di partenza tecnico consigliato dalla ricerca. Le parti effettivamente adottate sono elencate nello stato reale; le altre non sono ancora configurate né tutte approvate singolarmente:

- TypeScript per il codice applicativo.
- Cloudflare Pages per ospitare il frontend statico.
- Supabase Auth e PostgreSQL per account, autorizzazione e dati condivisi, preferibilmente in regione europea.
- TanStack Query per richieste, cache e aggiornamento dei dati.
- IndexedDB per cache locale e coda persistente degli inserimenti.
- `vite-plugin-pwa` per manifest, risorse offline e gestione degli aggiornamenti.
- CSS leggero, carattere di sistema e icone essenziali per il design.

### Stato reale dopo lo sprint 1

- React + Vite + TypeScript implementati; build statica, CSS con safe area, navigazione e modalità scura, admin caricato separatamente.
- Schermate Diario Oggi, Record e Premi; selezione/ricerca eventi, registrazione, annullamento tracciato, cronologia e classifica personale per giorni/settimane.
- Anteprima admin: riepilogo, creazione/modifica/archiviazione eventi e premi, esportazione JSON. Non è protetta da login e viene indicata come demo.
- IndexedDB locale dedicato alla demo, transazioni atomiche, deduplicazione degli identificativi, snapshot di punti/nome/versione, aggiornamento tra schede. La UI conferma dopo la persistenza; dati incompatibili non vengono azzerati.
- Eventi e premi iniziali sono esempi modificabili. I progressi premi sono derivati dai dati attuali: non esistono ancora assegnazioni storiche, consegne o condizioni definitive.
- Nessun backend Supabase, schema SQL, account reale, condivisione tra dispositivi o hosting configurato. Nessun service worker, installazione PWA o coda verso il server: il salvataggio locale non è la sincronizzazione offline definitiva.
- Test automatici su dominio/calendario, IndexedDB simulato e percorso UI in jsdom; workflow GitHub per test e build. Anteprima visuale non verificata per indisponibilità del relay dell'ambiente; nessun test sul telefono reale.
- La roadmap e i criteri di completamento sono in [ROADMAP.md](ROADMAP.md); l'avvio e i limiti sono in [README.md](../README.md).

Aggiornare questa sezione quando lo stato cambia. Non confondere il comportamento desiderato con quello effettivamente disponibile.

Le sezioni architetturali seguenti descrivono il comportamento finale da raggiungere: lo stato qui sopra specifica quali parti esistono davvero. La demo locale non è un'autorizzazione a usare un selettore di ruolo nella versione con account.

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

Un errore di validazione rimane visibile e recuperabile. Se un evento viene modificato o archiviato mentre il telefono è offline, applicare una regola esplicita per la vecchia versione: non cancellare l'inserimento né applicare nuovi punti senza comunicarlo. La regola precisa va fissata prima di implementare questa parte.

Non fare affidamento sul Background Sync di Safari per inviare eventi mentre l'app è chiusa. Riprovare all'apertura, al ritorno in primo piano e al recupero effettivo della connessione mentre l'app è attiva. Il solo segnale `navigator.onLine` non prova che Supabase sia raggiungibile.

Il primo accesso e il recupero di una sessione non valida richiedono rete. Se serve una nuova autenticazione, conservare la coda associata al suo proprietario e riprenderla dopo il login corretto.

### Storico, regole e premi

- Conservare la versione della regola e i punti attribuiti al momento dell'assegnazione.
- Separare modifica del catalogo e rettifica di una registrazione storica.
- Archiviare gli eventi già usati invece di eliminare le informazioni necessarie allo storico.
- Calcolare premi e risultati definitivi sui dati confermati dal server, evitando doppi sblocchi.
- Conservare le condizioni del premio assegnato: cambiarne la definizione non riscrive automaticamente quanto già conquistato.
- Modellare annullamenti e rettifiche in modo tracciabile e idempotente, anche se l'evento originale è ancora in attesa di sincronizzazione.
- Ricalcolare in modo coerente i risultati derivati quando viene annullato un evento. La revoca di un premio già raggiunto richiede una regola di prodotto esplicita.
- Salvare istante dell'evento e istante di ricezione. Usare `Europe/Rome` per giorni e settimane, gestendo ora legale e invii successivi alla mezzanotte.

### Modello dati indicativo

| Entità concettuale | Responsabilità |
| --- | --- |
| Profili e ruoli | Identità della giocatrice e dell'admin |
| Definizioni/versioni eventi | Catalogo, punti, attivazione e archiviazione |
| Registrazioni eventi | Proprietario, identificativo client, data, versione, punti ed eventuale annullamento |
| Definizioni premi | Descrizione, condizioni, periodo e stato di disponibilità |
| Premi assegnati | Condizioni storiche, raggiungimento ed eventuale consegna |
| Traccia amministrativa | Modifiche a catalogo, premi e rettifiche pertinenti |

Sono responsabilità da coprire, non nomi di tabelle già stabiliti. Per una sola giocatrice bastano query semplici; introdurre aggiornamenti in tempo reale solo se portano un beneficio concreto. Il pannello admin può aggiornarsi all'apertura, al ritorno in primo piano e su richiesta.

## 7. Account e autorizzazione

Baseline di accesso: due account predisposti, email/password, registrazione pubblica disabilitata. L'accesso deve funzionare bene con il gestore password dell'iPhone.

Supabase Row Level Security e i permessi delle funzioni devono applicare i due ruoli lato database. Nascondere una schermata o un pulsante non è una misura di autorizzazione.

- La giocatrice accede ai propri dati e alle definizioni disponibili per il gioco.
- L'admin consulta i risultati e gestisce catalogo e premi tramite operazioni autorizzate.
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

## 10. Decisioni ancora da definire

Risolverle quando servono alla feature, proseguendo con il lavoro indipendente possibile. Non riproporre domande già risolte dal contesto o dal codice.

- Catalogo reale: nomi, punti, eventuali malus, limiti di ripetizione e possibilità di inserire eventi del giorno precedente.
- Premi reali: soglie, periodi, ripetibilità, significato della consegna e comportamento dopo un annullamento.
- Comparabilità dei record quando cambiano i punteggi degli eventi.
- Accettazione delle vecchie versioni del catalogo per gli inserimenti offline.
- Metodo operativo di recupero account e scelta dell'eventuale provider email.
- Versione iOS minima supportata e verifica del telefono effettivo.

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
