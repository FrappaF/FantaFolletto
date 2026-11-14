# FantaFolletto

Una webapp da regalare: gli episodi del lavoro porta a porta diventano punti, record personali e piccoli premi. Una giocatrice sfida se stessa; il partner accede come admin per preparare eventi e premi. Design **Diario**, pensato per iPhone.

## Stato

Sono implementati il Diario, il codice per **account Supabase e dati condivisi**, la **coda offline** e la **PWA**. Sono presenti migrazione SQL, policy, test e istruzioni di attivazione. Il progetto Supabase è ora predisposto: migrazioni applicate, due account confermati con ruoli e configurazione locale reale. Verifica delle RPC sul database ospitato superata con rollback dei dati di prova. **Frontend non ancora pubblicato** e login dal browser/iPhone da collaudare: dettagli in [ACTIVATION.md](docs/ACTIVATION.md).

Stack: React, Vite, TypeScript, Supabase JS, TanStack Query, IndexedDB e vite-plugin-pwa. Nessun servizio a pagamento viene creato dagli script di sviluppo.

## Avvio e prove locali

Serve Node.js 24 LTS (almeno 24.15) e npm.

```sh
npm ci
npm run dev
```

Senza `.env.local`, lo sviluppo usa la demo. Include Oggi, Record, Premi, registrazione/annullamento e anteprima admin senza autenticazione; dati persistenti solo in quel browser, con catalogo e premi fittizi modificabili. Il pulsante in alto a destra apre l'anteprima admin.

```sh
npm test
npm run build:demo
npm run preview
```

`build:demo` produce una PWA demo esplicita. Usare un indirizzo distinto da quello del regalo reale. Il service worker è attivo nelle build, non in `npm run dev`; `vite preview` serve alle prove e non è l'hosting definitivo.

## Modalità condivisa

Seguire [SETUP.md](docs/SETUP.md): creare il progetto Supabase Free europeo, applicare la migrazione e predisporre due account con signup pubblico disabilitato. Il catalogo reale parte vuoto; l'admin lo prepara dall'app.

Copiare `.env.example` in `.env.local` e impostare URL HTTPS e chiave **publishable** pubblica:

```dotenv
VITE_APP_MODE=remote
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_WITH_PUBLIC_KEY
```

```sh
npm run dev
npm run build
```

Le build di produzione sono `remote` per impostazione predefinita: senza configurazione valida mostrano una schermata di preparazione, senza falso accesso admin. Chiavi segrete, `service_role` e password non vanno mai in variabili `VITE_*`. Il file `.env.local` è ignorato da Git; il frontend usa il dominio standard `*.supabase.co` previsto dalla CSP.

## Comportamenti

- Il database controlla ruoli e punti. La giocatrice può registrare/annullare; l'admin può consultare, gestire eventi/premi e confermare consegne.
- Ogni episodio conserva versione, nome e punti originali. Le modifiche del catalogo non riscrivono lo storico.
- Prima si salva l'operazione sul telefono, poi si invia. La UI distingue punti provvisori, conferme ed errori; un invio ambiguo resta in coda e usa lo stesso identificativo nei ritentativi.
- Cache e code sono separate per progetto/account; il logout conserva gli inserimenti per il ritorno dello stesso utente. La demo usa un database distinto e non viene importata nel diario reale.
- Giorni e settimane seguono `Europe/Rome`, da lunedì. Gli episodi offline arrivano entro sette giorni, con la versione valida al loro istante dichiarato.
- Premi totali una volta per definizione o settimanali una volta per settimana. Le condizioni già assegnate restano nello storico; annullamenti revocano i premi non consegnati e segnalano eventuali incongruenze di quelli già consegnati.
- Il service worker conserva le risorse statiche, mai risposte Auth/database. Gli aggiornamenti attendono moduli chiusi e coda risolta.
- Su iPhone: Safari → Condividi → Aggiungi alla schermata Home. Aprire dalla Home e accedere online prima dell'uso offline; attendere la conferma delle risorse disponibili. Il primo login e il recupero di una sessione non valida richiedono rete.

Lo storage iPhone può essere rimosso: non è un backup. L'export JSON admin è consultabile, ma non è un ripristino del database. Nessun dato personale dei clienti è necessario.

## Documentazione e codice

- [Contesto obbligatorio](docs/PROJECT_CONTEXT.md) e [AGENTS.md](AGENTS.md): requisiti e manutenzione del contesto per ogni modifica.
- [Roadmap](docs/ROADMAP.md): cosa è implementato e cosa resta da collaudare.
- [Attivazione](docs/SETUP.md): progetto, schema, account, variabili, hosting e recupero assistito.
- [Manutenzione](docs/OPERATIONS.md): backup/ripristino, aggiornamenti, limiti e verifiche reali ancora da fare.

```text
src/components/    Diario, admin, premi, stato sincronizzazione e PWA
src/domain/        Regole, validazione, snapshot e calendario italiano
src/data/          Persistenza della demo isolata
src/remote/        Auth, RPC, cache per account e sincronizzazione
src/server/        Test PostgreSQL della migrazione e delle policy
supabase/          Migrazione e modello di provisioning dei ruoli
scripts/           Utilità per l'operatore, mai importate nel frontend
```

I test usano PostgreSQL PGlite, IndexedDB simulato, trasporto controllato e jsdom con Auth simulata. Non certificano Supabase ospitato, rendering Safari, riapertura offline reale, LCP/INP o backup/ripristino del servizio. Il collaudo sul telefono e sui due account reali rimane necessario prima del regalo.
