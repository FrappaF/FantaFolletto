-- Catalogo approvato dall’utente. La sostituzione degli eventi di prova è esplicitamente autorizzata.
-- Gli eventi di prova sono ritirati con archiviazione reversibile, preservando eventuali episodi.
begin;
do $$
declare e public.events; item jsonb; new_id uuid; at_time timestamptz := clock_timestamp();
begin
 perform 1 from public.profiles where role='player' for update;
 for e in select * from public.events loop
  update public.events set archived=true where id=e.id;
  update public.event_versions set valid_until=coalesce(valid_until,at_time) where event_id=e.id;
 end loop;
 for item in select * from jsonb_array_elements($catalog$[
  {
    "key": "bar-folletto",
    "name": "Bar Folletto",
    "description": "Un cliente ti offre un caffè.",
    "points": 5,
    "categoryId": "encounters",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "caramelle",
    "name": "Bottino di caramelle",
    "description": "Ti offrono dolcetti o biscotti.",
    "points": 5,
    "categoryId": "encounters",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "tavola",
    "name": "Aggiungi un posto a tavola",
    "description": "Ti invitano a pranzo o cena.",
    "points": 20,
    "categoryId": "encounters",
    "rarity": "rare",
    "repeat": "unlimited"
  },
  {
    "key": "regalo",
    "name": "Scambio di campionario",
    "description": "Ricevi un regalino inatteso.",
    "points": 15,
    "categoryId": "encounters",
    "rarity": "rare",
    "repeat": "unlimited"
  },
  {
    "key": "cane",
    "name": "Il vero padrone di casa",
    "description": "Il cane viene a salutarti durante la visita.",
    "points": 5,
    "categoryId": "animals",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "gatto",
    "name": "Controllo qualità felino",
    "description": "Un gatto ispeziona il campionario o si sistema sulla borsa.",
    "points": 10,
    "categoryId": "animals",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "reperto",
    "name": "Reperto archeologico",
    "description": "Ti mostrano un Folletto di almeno vent’anni.",
    "points": 10,
    "categoryId": "encounters",
    "rarity": "rare",
    "repeat": "unlimited"
  },
  {
    "key": "adozione",
    "name": "Adozione sul pianerottolo",
    "description": "Un cliente ti dice: «Potresti essere mia figlia o mia nipote».",
    "points": 10,
    "categoryId": "encounters",
    "rarity": "rare",
    "repeat": "unlimited"
  },
  {
    "key": "mestiere",
    "name": "Cambio di mestiere",
    "description": "Un cliente ti aiuta con un piccolo imprevisto personale.",
    "points": 15,
    "categoryId": "mishaps",
    "rarity": "rare",
    "repeat": "unlimited"
  },
  {
    "key": "demo",
    "name": "Si apre il sipario",
    "description": "Fai una dimostrazione completa.",
    "points": 10,
    "categoryId": "wins",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "wow",
    "name": "Effetto wow",
    "description": "Il cliente esprime spontaneamente sorpresa per il risultato.",
    "points": 5,
    "categoryId": "wins",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "appuntamento",
    "name": "Ci rivediamo!",
    "description": "Fissi un appuntamento concordato.",
    "points": 5,
    "categoryId": "wins",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "passaparola",
    "name": "Passaparola del cuore",
    "description": "Un cliente ti presenta qualcuno interessato.",
    "points": 15,
    "categoryId": "wins",
    "rarity": "rare",
    "repeat": "unlimited"
  },
  {
    "key": "vendita",
    "name": "Folletto adottato",
    "description": "Concludi una vendita.",
    "points": 25,
    "categoryId": "wins",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "ricontatto",
    "name": "Colpo di scena",
    "description": "Ti ricontatta spontaneamente qualcuno che era indeciso.",
    "points": 15,
    "categoryId": "wins",
    "rarity": "rare",
    "repeat": "unlimited"
  },
  {
    "key": "scale",
    "name": "Palestra inclusa",
    "description": "Raggiungi un cliente al quarto piano o oltre senza ascensore.",
    "points": 10,
    "categoryId": "mishaps",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "fantasma",
    "name": "Appuntamento con un fantasma",
    "description": "Arrivi a un appuntamento confermato, ma non trovi nessuno.",
    "points": 5,
    "categoryId": "mishaps",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "pubblico",
    "name": "Pubblico a sorpresa",
    "description": "Durante la demo si aggiungono almeno altre due persone.",
    "points": 10,
    "categoryId": "mishaps",
    "rarity": "rare",
    "repeat": "unlimited"
  },
  {
    "key": "gaffe",
    "name": "Professionalità recuperata",
    "description": "Fai una piccola gaffe e riuscite a riderci insieme.",
    "points": 10,
    "categoryId": "mishaps",
    "rarity": "normal",
    "repeat": "unlimited"
  },
  {
    "key": "matrimonio",
    "name": "Agenzia matrimoniale",
    "description": "Un cliente prova a presentarti un possibile fidanzato.",
    "points": 50,
    "categoryId": "incredible",
    "rarity": "legendary",
    "repeat": "unlimited"
  },
  {
    "key": "delivery",
    "name": "Nonna delivery",
    "description": "Esci dalla visita con del cibo preparato da portare a casa.",
    "points": 40,
    "categoryId": "encounters",
    "rarity": "rare",
    "repeat": "unlimited"
  },
  {
    "key": "pappagallo",
    "name": "Il cliente ripete tutto",
    "description": "Durante la visita incontri un pappagallo che parla.",
    "points": 50,
    "categoryId": "animals",
    "rarity": "legendary",
    "repeat": "unlimited"
  },
  {
    "key": "animale",
    "name": "Cliente fuori catalogo",
    "description": "Un animale insolito, come una capretta o un maialino, assiste alla dimostrazione.",
    "points": 75,
    "categoryId": "animals",
    "rarity": "legendary",
    "repeat": "unlimited"
  },
  {
    "key": "sarta",
    "name": "Il diavolo veste Folletto",
    "description": "Un cliente ti ripara un vestito o un accessorio durante la visita.",
    "points": 100,
    "categoryId": "incredible",
    "rarity": "legendary",
    "repeat": "unlimited"
  },
  {
    "key": "lavoro",
    "name": "Colloquio a sorpresa",
    "description": "Sei lì per vendere il Folletto e il cliente ti propone un lavoro.",
    "points": 75,
    "categoryId": "incredible",
    "rarity": "legendary",
    "repeat": "unlimited"
  },
  {
    "key": "compleanno",
    "name": "Imbucata ufficiale",
    "description": "Capiti durante un compleanno e ti invitano a mangiare la torta.",
    "points": 75,
    "categoryId": "incredible",
    "rarity": "legendary",
    "repeat": "unlimited"
  },
  {
    "key": "famoso",
    "name": "Ma sei proprio tu?!",
    "description": "Alla porta trovi un personaggio pubblico che riconosci.",
    "points": 100,
    "categoryId": "incredible",
    "rarity": "legendary",
    "repeat": "unlimited"
  },
  {
    "key": "insegnante",
    "name": "Interrogazione a domicilio",
    "description": "Ti apre un tuo ex insegnante, senza che sapessi abitasse lì.",
    "points": 100,
    "categoryId": "incredible",
    "rarity": "legendary",
    "repeat": "unlimited"
  },
  {
    "key": "omonimo",
    "name": "Errore nella matrice",
    "description": "Il cliente ha esattamente il tuo stesso nome e cognome.",
    "points": 150,
    "categoryId": "incredible",
    "rarity": "legendary",
    "repeat": "unlimited"
  },
  {
    "key": "acquisto",
    "name": "Il cliente vende a te",
    "description": "Durante la visita finisci per comprare qualcosa che il cliente produce o vende.",
    "points": 50,
    "categoryId": "challenges",
    "rarity": "rare",
    "repeat": "daily"
  },
  {
    "key": "international",
    "name": "Folletto International",
    "description": "Completi una dimostrazione conversando in una lingua diversa dall’italiano.",
    "points": 75,
    "categoryId": "challenges",
    "rarity": "rare",
    "repeat": "daily"
  },
  {
    "key": "generazioni",
    "name": "Tre generazioni, una demo",
    "description": "Nonni, genitori e figli assistono insieme alla stessa dimostrazione.",
    "points": 75,
    "categoryId": "challenges",
    "rarity": "rare",
    "repeat": "daily"
  },
  {
    "key": "assemblea",
    "name": "Assemblea di condominio",
    "description": "Almeno cinque adulti di tre appartamenti diversi assistono insieme alla demo.",
    "points": 100,
    "categoryId": "challenges",
    "rarity": "legendary",
    "repeat": "daily"
  },
  {
    "key": "slam",
    "name": "Il grande slam dell’ospitalità",
    "description": "In un giorno ti offrono caffè, qualcosa da mangiare e un regalino, in tre visite diverse.",
    "points": 100,
    "categoryId": "challenges",
    "rarity": "legendary",
    "repeat": "daily"
  },
  {
    "key": "doppietta",
    "name": "Doppietta sul pianerottolo",
    "description": "Due clienti di appartamenti diversi nello stesso palazzo acquistano nella stessa giornata.",
    "points": 100,
    "categoryId": "challenges",
    "rarity": "legendary",
    "repeat": "daily"
  },
  {
    "key": "tripletta",
    "name": "Tripletta leggendaria",
    "description": "Concludi tre vendite nella stessa giornata.",
    "points": 150,
    "categoryId": "challenges",
    "rarity": "legendary",
    "repeat": "daily"
  },
  {
    "key": "regina",
    "name": "La demo si vende da sola",
    "description": "Un cliente invita spontaneamente un vicino alla demo e acquistano entrambi.",
    "points": 200,
    "categoryId": "challenges",
    "rarity": "legendary",
    "repeat": "daily"
  }
]
$catalog$::jsonb) loop
  new_id := gen_random_uuid();
  insert into public.events(id,version) values(new_id,1);
  insert into public.event_versions(event_id,version,name,description,points,valid_from,category_id,rarity,repeat_rule)
   values(new_id,1,item->>'name',item->>'description',(item->>'points')::integer,at_time,item->>'categoryId',item->>'rarity',item->>'repeat');
 end loop;
end $$;
commit;
