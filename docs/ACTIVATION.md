# Attivazione Supabase e Cloudflare — 14 novembre 2026

Progetto **FantaFolletto**, riferimento `eynngtnxtomcwblmughq`, regione `eu-west-1`, PostgreSQL 17. Stato rilevato: `ACTIVE_HEALTHY`. Il progetto è stato creato dall'utente e collegato tramite l'integrazione Supabase autorizzata in questa chat.

## Completato

- Registrazione pubblica disabilitata: conferma esplicita dell’utente dalla dashboard il 14 novembre 2026. Il connettore non espone questa impostazione, quindi non si tratta di una verifica automatica.

- Database inizialmente privo di tabelle applicative e migrazioni; schema applicato tramite MCP con cronologia remota.
- Migrazioni applicate e allineate ai file locali: `20261114130522_diary.sql` e `20261114131302_tighten_diary_permissions.sql`.
- Due utenti Auth creati e confermati dall'utente nella dashboard; profili assegnati dall'agente ai ruoli **admin** e **player** secondo gli indirizzi indicati dall'utente. Email, UUID e password personali non sono salvati nella documentazione versionata.
- `.env.local` configurato con modalità `remote`, URL del progetto e chiave publishable. File ignorato da Git; nessuna chiave segreta o password letta o inserita nel frontend.
- RLS attivo sulle sette tabelle applicative; accesso anonimo alle tabelle e alle RPC del diario negato. Per `authenticated` le tabelle sono in lettura secondo policy, senza INSERT/UPDATE/DELETE diretti.
- Funzioni interne private non eseguibili dai client, salvo il solo lookup del proprio ruolo. Le quattro RPC pubbliche richiedono un profilo autorizzato e verificano il ruolo nel corpo della funzione, con `search_path` fissato.
- Corretto l'accesso client alla funzione di sistema `public.rls_auto_enable()` creata dalla dashboard: revocato EXECUTE ad anonimi e autenticati, lasciando attivo il trigger automatico `ensure_rls`.
- Aggiunti gli indici sulle chiavi esterne segnalate, l'unicità degli identificativi delle operazioni admin e la valutazione per statement di identità/ruolo nelle policy.

## Verifica sul database ospitato

Transazione di prova eseguita come ruolo PostgreSQL `authenticated`, impostando i claim per i due utenti reali. Si tratta di verifica delle RPC e delle policy sul server, **non di un login con password o JWT dal browser**.

Esito positivo per:

- Riconoscimento del ruolo admin e della giocatrice; la giocatrice non gestisce il catalogo e l'admin non registra episodi.
- Creazione admin di evento/premio temporanei e ritentativo della stessa operazione senza duplicati.
- Registrazione con punti stabiliti dalla regola server e ritentativo dello stesso identificativo, acquisito una sola volta.
- Assegnazione del premio alla soglia, annullamento idempotente e revoca del premio non consegnato.
- Rifiuto di aggiornamenti diretti ai punti dal client e prova separata con ruolo `anon`: RPC diario e lettura episodi negate.
- Modifica della regola senza riscrivere il punteggio dell'episodio storico.

La transazione è stata annullata con `ROLLBACK`. Controllo finale: due profili e **zero** eventi, versioni eventi, episodi, premi, assegnazioni e righe di audit. Nessun catalogo demo è stato importato.

Verifica finale del repository: **43 test automatici superati**, build di produzione con configurazione reale e controllo manifest/icone/risorse PWA superati. I test della demo forzano la modalità isolata anche quando `.env.local` collega un progetto reale.

## Advisor dopo le correzioni

Sono state eliminate le segnalazioni relative a chiavi esterne senza indice, rivalutazione di `auth.uid()` per riga e chiamabilità anonima della funzione automatica RLS. Restano:

- **Quattro RPC SECURITY DEFINER chiamabili da utenti autenticati**: esposizione intenzionale per applicare punti/regole lato server senza concedere scritture dirette. Esecuzione anonima revocata, profilo/ruolo verificati e comportamenti vietati provati sul database reale. Non cambiare automaticamente in SECURITY INVOKER per nascondere l'avviso. [Dettagli dell'advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- **Protezione contro password compromesse disabilitata**: rilevata dall'advisor Auth; la funzione è disponibile dal piano Pro. Nessun upgrade o costo attivato. Gli utenti scelgono password distinte e robuste nella dashboard; l'agente non le conosce. [Requisiti e rimedio](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- **Indici non ancora utilizzati**: informazione normale su un diario vuoto; non rimuovere gli indici necessari sulla base di questo primo controllo. [Significato dell'avviso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Pubblicazione Cloudflare Pages

- URL di produzione: **[https://fantafolletto.pages.dev](https://fantafolletto.pages.dev)**, progetto Pages `fantafolletto`, collegato al repository GitHub esistente `FrappaF/FantaFolletto`.
- Pubblicazione automatica configurata come abilitata per `main`; il push di aggiornamento della documentazione non ha prodotto una nuova build durante il controllo, quindi il trigger automatico non è ancora verificato. Il collegamento Git risulta presente anche all’endpoint dedicato; nessuna disconnessione effettuata. Gli aggiornamenti possono essere avviati manualmente tramite l’integrazione. Anteprime automatiche e commenti sulle PR disabilitati. Nessun dominio, servizio o abbonamento a pagamento attivato.
- Build `npm run build`, output `dist`, radice repository, `NODE_VERSION=24`. Produzione con `VITE_APP_MODE=remote`, URL del progetto Supabase e chiave publishable pubblica. Le variabili preview sono separate: modalità demo e nessuna configurazione Supabase reale. Nessuna chiave segreta nel bundle o nei file versionati.
- Primo deploy: `57733178-25e9-4d66-a887-e554232149bc`, sorgente `61485989a45bc6c760bc0a7ea196bde55e7b8d00`, completato alle **13:50:43 UTC**. API Cloudflare: fase `deploy`, stato `success`; log di clonazione e build riusciti, sei regole header riconosciute, 14 file pubblicati.
- Build locale di produzione e `npm run verify:build` superati prima della pubblicazione. Nessun codice applicativo cambiato durante l’attivazione dell’hosting.
- **Limite del controllo esterno:** il browser dell’agente non ha completato l’avvio (`Browser Use could not read requirements`, poi trasporto disconnesso). La richiesta HTTP dal terminale è stata respinta dal proxy dell’ambiente (`Tunnel connection failed: 403 Forbidden`). Questi errori non sono una verifica della risposta del sito: il deploy è confermato dal servizio Cloudflare, ma pagina, login e header ricevuti da un browser reale restano da collaudare.

## Ancora da verificare

- Login reale con password e chiamate PostgREST dal browser. Il tentativo HTTP dall'ambiente di sviluppo non ha potuto risolvere il dominio del progetto (`EAI_AGAIN`); la connessione MCP al database funziona. Non dichiarare quel controllo HTTP superato.
- Apertura del frontend pubblicato e collaudo su iPhone/Safari/Home, incluso aggiornamento PWA e riapertura offline.
- Catalogo e premi reali da preparare con l'admin; backup/ripristino del servizio ancora da provare.

Le istruzioni di attivazione generale sono in [SETUP.md](SETUP.md), quelle operative in [OPERATIONS.md](OPERATIONS.md).
