# Attivazione del diario condiviso

Procedura per chi gestisce il progetto. **Non è ancora stata eseguita su un servizio reale.** L'utente ha chiesto di preparare la configurazione, senza un progetto Supabase esistente. Il riferimento di prodotto è [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## 1. Creare il progetto Supabase

1. Nel proprio account Supabase creare un progetto Free in una regione europea, conservando la password del database nel gestore password.
2. In Authentication disabilitare la registrazione di nuovi utenti. Per questa versione si usano solo email e password; non servono accesso anonimo, social login o link via email.
3. In Authentication → Users predisporre manualmente i due utenti con password distinte: giocatrice e admin. Confermare gli utenti al momento della creazione, senza dipendere da email di invito. Conservare le password fuori da chat e repository.
4. Copiare gli UUID dei due utenti per l'assegnazione dei ruoli. Non usare mai la password dell'account Supabase come password dell'admin del gioco.

Le condizioni verificate il 14 novembre 2026 prevedono progetto Free a $0, 500 MB di database e sospensione dopo una settimana di inattività. Per due account il volume previsto è ridotto; verificare le condizioni al momento dell'attivazione. Non è una garanzia di disponibilità continua. Fonti: [prezzi Supabase](https://supabase.com/pricing), [SMTP e limiti](https://supabase.com/docs/guides/auth/auth-smtp).

## 2. Applicare lo schema e assegnare i ruoli

Sul **progetto nuovo e vuoto**, aprire il SQL editor come proprietario ed eseguire una volta il contenuto di [202611140001_diary.sql](../supabase/migrations/202611140001_diary.sql). La migrazione è transazionale: se fallisce non proseguire con una configurazione parziale. Non rieseguirla su un database già inizializzato.

Poi copiare [provision.sql.example](../supabase/provision.sql.example), sostituire i due segnaposto UUID ed eseguirla nello stesso SQL editor. Il database ammette un solo profilo per ciascun ruolo. I ruoli non provengono dai metadati modificabili dell'utente e non si assegnano dal frontend.

Il catalogo reale parte **vuoto**. Accedere come admin per creare eventi e premi. Nessun dato della demo viene trasferito automaticamente.

Per cambiamenti successivi aggiungere nuove migrazioni versionate; non modificare una migrazione già applicata né usare SQL improvvisato sui dati reali. Questo file iniziale può essere verificato senza servizi esterni con `npm test`: PGlite esegue PostgreSQL con un sostituto locale delle identità Supabase. Non sostituisce il collaudo di Auth e PostgREST reali.

## 3. Collegare il frontend

Copiare `.env.example` in `.env.local`, che è ignorato da Git. Impostare:

```dotenv
VITE_APP_MODE=remote
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_WITH_PUBLIC_KEY
```

URL e chiave **publishable** si trovano nelle impostazioni/API del progetto. Il frontend rifiuta chiavi `sb_secret_*` e URL non HTTPS. La versione iniziale supporta il dominio standard `*.supabase.co`; un dominio Supabase personalizzato richiederebbe anche l'aggiornamento della Content Security Policy in `public/_headers`.

Non inserire mai `service_role`, chiave segreta o password del database in una variabile `VITE_*`: Vite include queste variabili nel codice pubblico. Il file `.env.local` rimane locale.

```sh
npm ci
npm run dev
```

Per tornare alle prove locali usare `VITE_APP_MODE=demo` in un ambiente di sviluppo separato. Senza configurazione, lo sviluppo locale usa la demo; una build di produzione usa `remote` e mostra una schermata di configurazione mancante, senza offrire un falso accesso admin.

## 4. Regole della versione iniziale

- Eventi ripetibili, inseriti al momento; malus ammessi. Nessuna UI per retrodatare o caricare nomi/dati dei clienti.
- Il server accetta l'istante dell'episodio entro sette giorni dall'invio e al massimo cinque minuti nel futuro (tolleranza per l'orologio). Non può provare quando un evento è davvero accaduto: è un diario personale basato sulla fiducia.
- Una vecchia versione dell'evento viene accettata solo se l'istante dichiarato era nel suo intervallo di validità. Archiviare o modificare non cambia i punti passati. Un errore resta in coda, visibile e rimuovibile dopo conferma; non viene silenziosamente convertito ai nuovi punti.
- Un premio totale si conquista una volta per definizione; uno settimanale una volta per settimana italiana (da lunedì). Un premio settimanale nuovo o modificato può iniziare a sbloccare premi dalla settimana della modifica, senza generare nuove assegnazioni per settimane precedenti.
- Le nuove condizioni possono usare i punti già confermati del periodo corrente. I premi già assegnati conservano nome, soglia e periodo originali; modificare il catalogo non riscrive le loro condizioni.
- Un annullamento ricalcola i risultati. Revoca un premio non consegnato se il punteggio scende sotto la sua soglia storica; se la soglia torna raggiunta, riattiva la stessa assegnazione, senza duplicarla. Un premio consegnato resta nello storico con una segnalazione finché i punti sono sotto soglia.
- L'admin conferma le consegne, senza poter registrare o annullare episodi al posto della giocatrice.
- I record confrontano i punti effettivamente assegnati, con le regole del momento; non sono normalizzati se i punteggi cambiano.

## 5. Pubblicazione su Cloudflare Pages

Collegare il repository GitHub esistente a un progetto Pages statico. Impostazioni:

| Campo | Valore |
| --- | --- |
| Branch produzione | `main` |
| Comando build | `npm run build` |
| Directory output | `dist` |
| Node | `24` (almeno 24.15) |
| `VITE_APP_MODE` | `remote` |
| `VITE_SUPABASE_URL` | URL HTTPS del progetto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chiave publishable pubblica |

Impostare le variabili per produzione e separatamente per le eventuali anteprime. Non collegare anteprime aperte a dati reali per impostazione predefinita: usare una demo su indirizzo separato o un progetto di prova. Le variabili Vite sono fissate durante la build: dopo una modifica serve una nuova build.

Non sono necessarie Pages Functions, domini a pagamento o Workers applicativi. HTTPS è necessario per il service worker. `public/_headers` definisce CSP e cache; gli asset con hash si possono conservare a lungo, mentre HTML, manifest e service worker richiedono rivalidazione. La build include tutte le risorse dell'app nell'elenco offline, anche le viste caricate su richiesta. Le risposte di Auth e del database non vengono messe nella cache del service worker.

Fonte: [Cloudflare Pages, prezzi](https://developers.cloudflare.com/pages/functions/pricing/). Nessuna pubblicazione viene eseguita da questa documentazione.

## 6. Recupero password senza SMTP

Per due utenti si può iniziare con un recupero assistito dall'operatore del progetto. Nell'interfaccia non viene promesso un invio email non configurato.

La procedura usa [scripts/reset-password.mjs](../scripts/reset-password.mjs) **solo dal terminale di chi possiede il progetto**. Servono URL, UUID dell'utente e una chiave `sb_secret_*`, che non deve entrare nel frontend, nel repository o in una chat. Su Bash, leggere le informazioni senza inserire segreti nella cronologia:

```sh
read -r -p 'URL progetto: ' FF_SUPABASE_URL
read -r -s -p 'Chiave segreta progetto: ' FF_SUPABASE_SECRET_KEY
export FF_SUPABASE_URL FF_SUPABASE_SECRET_KEY
read -r -p 'UUID utente: ' ff_user_id
read -r -s -p 'Nuova password (12–128 caratteri): ' ff_new_password
printf '%s' "$ff_new_password" | node scripts/reset-password.mjs "$ff_user_id"
unset FF_SUPABASE_URL FF_SUPABASE_SECRET_KEY ff_new_password ff_user_id
```

Condividere la nuova password direttamente con la proprietaria dell'account in modo adeguato. La gestione del regalo nella webapp non concede accesso alle chiavi del progetto: questo è un intervento dell'operatore Supabase. Fonte: [Supabase Admin updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).

## 7. Collaudo prima del regalo

Usare un progetto di prova, applicare schema e profili e creare un catalogo minimo dall'admin. Verificare almeno:

- Login dei due account in browser diversi e assenza della registrazione pubblica.
- Giocatrice: inserimento, annullamento, record e premi; admin: lettura aggiornata, catalogo e conferma consegna.
- Tentativi diretti come anonimo/giocatrice/admin: le policy e le RPC devono negare operazioni non autorizzate, anche fuori dalla UI.
- Modalità aereo dopo primo accesso online: salvare un episodio, chiudere, riaprire dalla Home, riconnettere e vedere una sola registrazione.
- Annullamento prima dell'invio, catalogo cambiato durante l'assenza di rete, errore recuperabile e sessione da riaprire.
- Logout con coda pendente e ritorno con lo stesso account; accesso con l'altro account senza mostrare i dati locali precedenti.
- Aggiornamento dell'app: con un modulo aperto o operazioni pendenti il pulsante di aggiornamento rimane disabilitato; dopo aver completato o rimosso consapevolmente gli invii si può aggiornare.
- iPhone reale: Safari e Home, notifica di nuova versione, safe area, tastiera e testo ingrandito. Primo accesso preferibilmente dentro l'app aggiunta alla Home.

I test automatici locali non certificano i servizi ospitati, il comportamento del service worker in Safari o le prestazioni LCP/INP sul telefono.

## 8. Continuità e backup

Un progetto Free inattivo può richiedere riattivazione dalla dashboard Supabase; non impostare ping artificiali o abbonamenti impliciti. Se il progetto non risponde, gli episodi pendenti restano sul telefono, ma devono arrivare entro sette giorni per essere accettati: non usare quella coda come archivio definitivo durante una pausa lunga.

Per i backup e la prova di ripristino seguire [OPERATIONS.md](OPERATIONS.md). L'esportazione JSON dell'admin è utile per leggere e conservare i risultati, ma non ricrea utenti Auth, schema, audit e vincoli del database.
