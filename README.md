# FantaFolletto

Una piccola webapp da regalare: trasforma gli episodi del lavoro porta a porta in punti, record personali e premi.

La giocatrice sfida se stessa; l'admin consulta i risultati e gestisce eventi e premi. L'esperienza scelta è **Diario**, pensata prima di tutto per iPhone.

## Documentazione

- [Contesto del progetto](docs/PROJECT_CONTEXT.md): requisiti, design, architettura proposta, criteri di qualità e decisioni da mantenere nel tempo.
- [Roadmap per sprint](docs/ROADMAP.md): incrementi, criteri di completamento e prerequisiti per arrivare al regalo.
- [Istruzioni per gli agenti](AGENTS.md): richiedono di leggere e aggiornare il contesto a ogni feature o cambiamento pertinente.

## Stato

**Sprint 1 implementato:** Diario con Oggi, Record e Premi, inserimento e annullamento episodi, ricerca nel catalogo, anteprima admin con gestione eventi/premi ed esportazione JSON.

È una **demo locale**, senza account: i dati rimangono in IndexedDB nel browser usato. Non c'è sincronizzazione tra dispositivi. Gli eventi e i premi iniziali sono esempi modificabili, non un regolamento definitivo. Il pulsante in alto a destra apre l'anteprima admin senza autenticazione.

Stack attuale: **React + Vite + TypeScript**, CSS e icone Lucide. Supabase, sincronizzazione offline, installazione PWA e hosting rientrano negli sprint successivi.

## Avvio locale

Serve Node.js 24 LTS e npm.

```sh
npm ci
npm run dev
```

Aprire l'indirizzo mostrato da Vite. Per una prova da iPhone sulla stessa rete usare l'indirizzo di rete mostrato dal server; il browser richiede un contesto sicuro per alcune API, quindi per la verifica completa usare HTTPS. Le sessioni Safari/Home e le safe area vanno verificate sul telefono reale.

```sh
npm test
npm run build
npm run preview
```

La build statica è in `dist/`. Non servono variabili d'ambiente per la demo. Il server di sviluppo e `vite preview` servono alle prove, non sono l'hosting definitivo.

## Dati e limiti della demo

- La conferma di inserimento arriva dopo la transazione IndexedDB. Le operazioni concorrenti non sovrascrivono il diario; un identificativo ripetuto non crea doppioni.
- Ogni episodio conserva nome, punti e versione originali; annullarlo lascia una traccia e aggiorna record e progressi.
- Giorni e settimane seguono `Europe/Rome`, con settimana da lunedì.
- I premi mostrano il progresso attuale, non assegnazioni definitive: modifiche e annullamenti possono cambiare il risultato.
- L'esportazione admin produce un JSON demo; importazione e ripristino non sono implementati.
- Rimuovere i dati del sito elimina il diario locale. Non inserire dati personali o dei clienti nella demo; non verrà importata automaticamente nel database reale.
- Non c'è ancora un service worker: una pagina già aperta può salvare senza rete, ma l'avvio o la riapertura offline non sono garantiti.

## Struttura

```text
src/components/   Componenti Diario, record, premi, modali e admin
src/domain/       Regole, snapshot eventi e statistiche del calendario italiano
src/data/         Repository IndexedDB transazionale, isolato per la demo
src/hooks/        Stato dell'app e aggiornamento tra schede dello stesso browser
```

I test coprono regole e calendario, persistenza/concorrenza e un percorso dell'interfaccia con registrazione, annullamento, riapertura e gestione admin. I test UI usano jsdom e non verificano rendering, focus nativo o comportamento Safari: non sostituiscono la prova su iPhone.
