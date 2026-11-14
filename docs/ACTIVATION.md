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


## Revisione logo, caratteri e icone

Il 14 novembre 2026, su richiesta esplicita dell'utente, il commit `2a1142e1b5bc8abb92e85a6675e0bb9c9e4644da` è stato inviato su GitHub `main`. Include il logo rivisto, Fraunces normale/corsivo locale, nove icone SVG coordinate, font nella cache PWA e confronti visuali con licenze. Sono conservate le correzioni già presenti su `main` per safe area, schede Premi, testi lunghi e spaziature.

Dopo l'integrazione sono stati ripetuti con esito positivo i 43 test, le build demo e produzione, il controllo PWA e le verifiche Chromium delle viste e della riapertura offline. Nessuna verifica su iPhone reale implicita.

Al controllo successivo al push l'API Cloudflare indica ancora come deploy di produzione `b88b5509-cee2-4b54-b2e6-755df152448d`, commit `bc6cfbba57f71f9baf1249027d29b6b9c9838974`; non risultano deploy del nuovo commit. Il trigger automatico resta abilitato nella configurazione, ma questa pubblicazione non è confermata. Il tentativo di avvio manuale è stato rifiutato dal controllo automatico delle autorizzazioni, che richiede consenso esplicito alla pubblicazione su Cloudflare oltre al push; nessun deploy manuale è stato eseguito. Per il controllo HTTP pubblico il proxy dell'ambiente continua a rispondere 403 al tunnel, senza fornire la risposta del sito.

## Ancora da verificare

- Login reale con password e chiamate PostgREST dal browser. Il tentativo HTTP dall'ambiente di sviluppo non ha potuto risolvere il dominio del progetto (`EAI_AGAIN`); la connessione MCP al database funziona. Non dichiarare quel controllo HTTP superato.
- Apertura del frontend pubblicato e collaudo su iPhone/Safari/Home, incluso aggiornamento PWA e riapertura offline.
- Catalogo iniziale di 37 eventi ora attivato; ulteriori aggiustamenti e premi si gestiscono dall’admin. Backup/ripristino del servizio ancora da provare.

Le istruzioni di attivazione generale sono in [SETUP.md](SETUP.md), quelle operative in [OPERATIONS.md](OPERATIONS.md).

## Aggiornamento catalogo e combo

Applicate `20261114161017_categories_combo.sql` e `20261114163107_approved_catalog.sql`, con 37 eventi attivi, sei categorie, rarità e otto sfide giornaliere. Quattro eventi di prova precedenti archiviati, premi ed episodi conservati. La prima richiesta di cancellazione definitiva non è stata completata dal meccanismo di conferma del connettore; la migrazione finale usa esclusivamente archiviazione reversibile. Nessuna cancellazione di dati di gioco eseguita.

Impostazioni iniziali +20%, tetto ×3, entrambe modificabili dall’admin dal giorno seguente. RPC sul database ospitato verificate in una transazione con claim/ruoli SQL e rollback: crescita 10/12/14, ricalcolo dopo annullamento, limite giornaliero, autorizzazione e programmazione del tetto ×4,5. Nessun login Auth dichiarato come verificato da questo test.

Advisor aggiornati: confermate le quattro RPC SECURITY DEFINER autorizzate e la protezione password Pro non attiva; solo avvisi informativi per indici ancora poco usati. Verifica visuale locale a 390 CSS px completata con dati fittizi; Safari/Home e affidabilità sul dispositivo restano da verificare.

Rilascio combinato confermato: commit `bfaf81175833ca17938ab0312aae977aaf3345d3`, deployment Pages `8e0fc155-d948-4b64-ad05-4ba88d4c95eb`, completato con successo il 14 novembre 2026 alle **17:41:46 Europe/Rome**. Include categorie, combo e la revisione di logo/Fraunces/icone precedentemente rimasta in attesa. Avvio manuale tramite integrazione riuscito; trigger automatico ancora non verificato. Verifica finale dopo integrazione: **58 test**, build TypeScript/Vite e PWA superati, 14 risorse offline incluse le font locali.

## Cognomi e Note giornaliere — 14 novembre 2026

Le due sezioni sono state integrate con il `main` remoto, preservando le categorie e le combo di punti già online. Migrazioni applicate: `20261114224718_surname_combos.sql` e `20261114224726_daily_notes.sql`. Copie dello snapshot precedente conservate nel namespace privato senza EXECUTE client.

Prove RPC ospitate per entrambi i ruoli superate con `ROLLBACK`: creazione, ritentativi, dati incompatibili respinti, lettura condivisa e rimozioni. Verificati i divieti di scrittura diretta, chiamata anonima e chiamata dei wrapper privati. Conteggi applicativi conservati; raccolte nuove vuote dopo le prove. Non è un collaudo Auth/PostgREST dal browser.

82 test locali, build di produzione e controlli PWA superati; frontend pubblicato e confermato dall’API Cloudflare. L’admin distingue «Combo» (regole dei bonus) da «Cognomi» (raccolta divertente).

Il backup completo non è stato esportato: l’approvazione automatica ha rifiutato la lettura estesa di dati applicativi e identità Auth, non compresa nell’autorizzazione alla pubblicazione. Sono state effettuate soltanto aggiunte e conservate le definizioni precedenti. Non dichiarare eseguito un backup completo o una prova di ripristino del servizio.

Gli advisor segnalano otto RPC `SECURITY DEFINER` intenzionali, con controlli di ruolo nel database e permessi anonimi revocati, e il consueto avviso Auth. Nessuna nuova concessione di scritture dirette o accessi ai wrapper privati. [RPC privilegiate](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable); [protezione password](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Push su `main`: `803004729bdefdbd945c0b8e5a886e557f1ed394`. Deploy di produzione `940b7983-8a62-4f17-a206-4aa47a419b58`, build e fase deploy `success`, concluso il 14 novembre 2026 alle **22:50:05 UTC**. URL stabile [fantafolletto.pages.dev](https://fantafolletto.pages.dev). Avviato manualmente sul branch `main`: al controllo dopo il push non risultava un deploy automatico nuovo. La configurazione automatica non è stata modificata.

Richiesta HTTP pubblica dall’ambiente: `403 Forbidden` con risposta del proxy Envoy. Questa prova non certifica rendering o login del sito; la pubblicazione è confermata dal servizio Cloudflare. Nessuna cancellazione di dati o cache richiesta. Nell’app già aperta usare «Aggiorna app» quando disponibile, completando prima eventuali invii.
