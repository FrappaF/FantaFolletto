# Identità FantaFolletto

Revisione del 14 novembre 2026, realizzata in risposta alla richiesta di migliorare il logo mantenendo il design Diario.

La F avorio diventa un cappello da folletto; il campanellino e la scintilla dorati aggiungono il riferimento al gioco e alle piccole conquiste. Il fondo verde bosco mantiene il legame con il diario. Il lettering serif, con «folletto» in corsivo, richiama una firma editoriale personale.

## File e applicazioni

- `icon-master.png`: originale raster generato, 1254 × 1254, da conservare come fonte delle esportazioni. Non è un file vettoriale.
- `logo-preview.png`: tavola di presentazione del simbolo e del lettering.
- `src/components/Brand.tsx`: componente condiviso da intestazione e accesso. L'immagine è decorativa perché il nome è già presente come testo; il collegamento alla giornata conserva il proprio nome accessibile.
- `public/icons/icon-192.png`: simbolo usato dal componente e dal manifest; circa 3 KB.
- `public/icons/icon-512.png` e `icon-maskable-512.png`: icone PWA a fondo pieno. Il segno rientra nel cerchio centrale sicuro; gli angoli vengono ritagliati dal sistema operativo.
- `public/icons/apple-touch-icon.png`: icona iPhone 180 × 180, senza trasparenza o angoli già ritagliati.
- `public/favicon.png`: favicon 48 × 48.

Il lettering usa **Fraunces**, scelto dall'utente dopo il confronto con Lora e DM Serif Display. Il simbolo mantiene i propri colori nei due temi; lettering e icone seguono i colori del tema.

## Tipografia e icone

- `typography-comparison.png`: confronto di tre schermate reali della demo a 393 CSS pixel, con Lora, Fraunces e DM Serif Display. I file delle alternative e le rispettive licenze sono in `font-trials/` e non entrano nella build dell'app.
- `icon-comparison.png`: confronto tra Lucide e i nove nuovi simboli, anche a 24 pixel nel tema scuro.
- `diary-light.png` e `diary-dark.png`: schermata della proposta con Fraunces e le icone integrate.
- `src/components/DiaryIcons.tsx`: diario con scintilla, coccarda per il record personale, regalo con fiocco, scintilla, tazza, impronta, sorriso, nuvola con pioggia e tesserino del nome. SVG senza richieste di rete, tratto arrotondato e dettagli oro. Gli eventi non riconosciuti usano la scintilla generica; nessun cambiamento al catalogo o al modello dati.

Fraunces normale e corsivo sono i sottoinsiemi latini originali del pacchetto `@fontsource-variable/fraunces` 5.3.0, asse del peso 100–900. Fonte: Fontsource/npm, progetto originale [Fraunces](https://github.com/undercasetype/Fraunces). I file non sono stati modificati. Sono in `public/fonts/`, con licenza SIL Open Font License 1.1 e attribuzioni in `Fraunces-LICENSE.txt`. Il peso complessivo è circa 81 KiB. Il solo normale viene precaricato; entrambi usano `font-display: swap` e sono inclusi nella cache PWA. Nessun abbonamento, dipendenza JavaScript o richiesta a un servizio di font aggiunto.

Nome, titoli di pagina/sezione, premi, punteggi principali e citazione usano Fraunces; comandi, testi piccoli, etichette e campi mantengono il carattere di sistema. Il ripiego serif è Iowan Old Style/Georgia. Il font può quindi cambiare brevemente durante il primo caricamento online, senza nascondere i testi.

Le frecce e i comandi di chiusura, aggiunta, annullamento, impostazioni e sincronizzazione mantengono Lucide. I nuovi simboli sono decorativi quando accompagnano un'etichetta; l'icona del primo posto conserva il proprio nome accessibile. Il sorriso sostituisce il cuore associato alla risata e la pioggia sostituisce il precedente sole.

## Esportazione

Le risorse sono riduzioni dello stesso originale, senza ridisegnare il simbolo. Per rigenerarle dalla radice del repository con ImageMagick:

```sh
magick docs/brand/icon-master.png -resize 512x512 -strip -colors 96 PNG8:public/icons/icon-512.png
cp public/icons/icon-512.png public/icons/icon-maskable-512.png
magick docs/brand/icon-master.png -resize 192x192 -strip -colors 96 PNG8:public/icons/icon-192.png
magick docs/brand/icon-master.png -resize 180x180 -strip -colors 96 PNG8:public/icons/apple-touch-icon.png
magick docs/brand/icon-master.png -resize 48x48 -strip -colors 64 PNG8:public/favicon.png
```

## Verifica

Build demo, verifica manifest/icone/caratteri/cache offline e 43 test esistenti superati. Controllo in Chromium della demo a 320, 375, 393, 430 e 768 CSS pixel, nei due temi: immagine caricata, nome separato dalle azioni, nessuno scorrimento orizzontale in Oggi/Record/Premi, selettore eventi e riepilogo admin; verificato anche lo spazio per la seconda azione della vista admin remota e il ritorno a Oggi dal logo. La seconda azione è stata simulata nel controllo di impaginazione, senza usare account reali.

Riapertura della demo in Chromium senza rete superata: Fraunces normale e corsivo presenti nella cache e caricati dopo la riapertura; font, logo e icone senza richieste a risorse esterne o errori JavaScript. Lo script `verify:build` controlla il formato WOFF2 e l'inclusione di ciascun font nella cache del service worker, per prevenire regressioni dell'aspetto offline.

Non verificati Safari o un iPhone reale. Revisione inviata su `main` con commit `2a1142e`, dopo integrazione delle correzioni di safe area e spaziature e ripetizione dei controlli; al controllo dopo il push il deploy Cloudflare è ancora quello precedente, quindi questa revisione non risulta pubblicata. Le installazioni esistenti possono conservare l'icona Home precedente anche dopo un successivo aggiornamento del sito.
