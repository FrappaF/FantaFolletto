# Istruzioni per chi lavora a FantaFolletto

## Contesto obbligatorio

Prima di analizzare o implementare una feature, una correzione o un cambiamento di design:

1. Leggere integralmente [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md).
2. Ispezionare lo stato attuale del repository e le istruzioni eventualmente presenti nelle directory coinvolte.
3. Usare il documento come contesto di prodotto; verificare nel codice cosa è effettivamente implementato.

Le istruzioni esplicite più recenti dell'utente prevalgono sulle decisioni precedenti. Se cambiano un requisito, aggiornare il documento nella stessa modifica, indicando la nuova decisione e le sue conseguenze. Non chiedere di riconfermare scelte già espresse.

## Manutenzione del contesto

- Mantenere `docs/PROJECT_CONTEXT.md` autosufficiente: non dipendere dalla memoria di una chat o da file esterni al repository.
- Distinguere requisiti confermati, baseline tecniche proposte, decisioni aperte e funzionalità implementate.
- Aggiornare lo stato reale e il registro decisioni quando una feature o una modifica cambia il progetto.
- Non presentare mockup, dati dimostrativi o proposte come funzionalità già operative.
- Conservare il documento principale come fonte di riferimento, evitando copie divergenti delle stesse regole.

## Criteri di lavoro

- Scrivere documentazione e testi del prodotto in italiano.
- Privilegiare semplicità, velocità su iPhone, affidabilità dei salvataggi e costi contenuti.
- Preservare la direzione di design **Diario** e i due ruoli: giocatrice e admin.
- Trattare autorizzazione, deduplicazione, storico e sincronizzazione come requisiti del prodotto.
- Verificare i comportamenti interessati dalla modifica con controlli proporzionati; documentare ciò che non è stato verificato su un iPhone reale.
- Non introdurre dipendenze o servizi quando quelli esistenti sono sufficienti. Verificare i piani gratuiti prima di basarvi nuove funzionalità.
- Non inserire credenziali, segreti, dati reali dei clienti o dati personali di gioco nei file versionati.
