# Idépanelen: helhetsanalys av JagKan!

> **Datum:** 2026-10-12 · **Underlag:** `docs/JagKan_spec.md`, `docs/backend.md`, `README.md`, `src/`, `supabase/`, `seed/` och `tests/` (commit `7cef429`).
> **Metod:**
> 1. En sammanfattning av projektet (avsnitt 1).
> 2. Kritikern och investeraren analyserade sammanfattningen parallellt, med en gräns på 600 ord var (avsnitt 2 och 3).
> 3. Kritikerns påståenden om koden kontrollerades mot koden (avsnitt 4).
> 4. Domaren vägde allt (avsnitt 5).
>
> Rollerna kommer från `.claude/agents/kritiker.md`, `investerare.md` och `domare.md`. Ingen kod ändrades.

---

## 1. Sammanfattning av projektet

**Vad appen gör.** JagKan! hjälper barn som är 4–13 år att bli självständiga genom vardagsutmaningar, till exempel "Dra upp blixtlåset själv" eller "Åk buss själv". Ett försök ger en gnista 🔥. En klarad utmaning som en vuxen godkänner ger en stjärna ⭐. Stjärnorna kläcker och utvecklar samlarvarelser och kan bytas mot belöningar som föräldern bestämmer. Appen bygger på grundarens A3-affisch "Vuxen spelet". Den har bara testats hemma av grundaren.

**Färdigt i koden:**
- **Spelmotor:** gnistor (3 gnistor ger en bonusstjärna), stjärnor, kläckning, utveckling i tre steg, milstolpar, återkommande utmaningar, totala stjärnor och stjärnor att spendera.
- **Innehåll:** 182 utmaningar (42 gratis) i 7 grenar och 3 åldersband. 3 världar med 63 arter i 3 steg, plus 30 specialvarelser.
- **Föräldravy:** onboarding, godkännanden, statistik, bibliotek, egna utmaningar, AI-förslag, belöningsbutik och tävlingar (familjemål, syskonduell med handikapp och "mot mig själv"). Dessutom lokalt album, parkoppling med QR-kod, PIN-spärr och export och radering av data.
- **Barnvy:** ägg, uppläsning på svenska, ljud, firanden, samling, butik och "examen" vid byte av värld.
- **Lokalt läge:** en delad enhet. Det går att prova på webben via GitHub Pages.
- **Kvalitet:** cirka 94 % testtäckning i motorn, databastester och CI.

**Inte byggt eller inte i drift:**
- Inget Supabase-projekt. Synk, push, AI och köp har aldrig körts på riktigt.
- Riktig grafik saknas. Varelserna är emoji- och vektorplatshållare, och Lottie används inte.
- Inloggning med Google saknas.
- E2E- och UI-tester saknas.
- Ingen förstapartsstatistik, så retention går inte att mäta.
- En medförälder kan inte tas bort och har admins rättigheter.
- Utvecklarkonton, butikslistningar, integritetspolicy, pris och varumärkeskontroll återstår.

**Arkitektur.** Expo SDK 57, React Native och TypeScript. En ren TypeScript-motor körs både i appen (optimistiskt, med en offlinekö) och i Supabase Edge Functions (en transaktion per kommando). Klienterna får bara läsa data via RLS. Barnets enhet loggar in anonymt via parkoppling. AI körs med Claude Haiku på servern, med gränser för antal anrop och biblioteket som reserv. Foton lämnar aldrig enheten, och appen har ingen reklam och ingen tredjepartsanalys.

**Affärsmodell.** Freemium med Plus via RevenueCat. Arbetsförslaget är 49 kr/mån eller 399 kr/år, med 14 dagars provperiod.

- **Gratis:** 1 barn, cirka 40 utmaningar, 3 belöningar, världen som passar åldern och tävlingsläget "mot mig själv".
- **Plus:** obegränsat antal barn, hela biblioteket, alla världar och tävlingslägen, AI-förslag, AI-skrivna samlarkort och album-export.
- **Marknad:** Sverige först.

---

## 2. Kritikern

### 2.1 Produkt
- **För brett för något som bara en familj har testat.** Appen har 3 världar, 93 varelser, 3 tävlingslägen, AI och album, men själva belöningen, varelserna, är fortfarande emoji.
  - *Lösning:* lansera bara Äggdalen (4–8 år) med riktig grafik och kör en stängd beta med 20–30 familjer.
- **Gratisnivån tar slut fort.** Det finns bara 14 gratisutmaningar per åldersband (`seed/challenges.json`), och de räcker ungefär en månad. Grundarens eget fall, två syskon som tävlar, kräver Plus.
  - *Lösning:* gör familjemålet, där syskonen samarbetar, gratis.
- **Lokalt läge kan inte flyttas till molnet.** Det finns ingen migrering, så löftet om att samlingen finns kvar hela barndomen håller inte.
  - *Lösning:* ladda upp det lokala tillståndet när föräldern skapar ett konto.

### 2.2 Pedagogik
- **Gnistorna går att farma.** Var tredje gnista ger en bonusstjärna utan att en vuxen godkänner den (`sparks % 3`), och den räknas som en vanlig stjärna (`stars.ts`). Ett barn som trycker på fem ägg varje dag får cirka 11 stjärnor i veckan utan att klara något. "Försöket räknas" blir "trycket räknas".
  - *Lösning:* högst en bonusstjärna per ägg, och bonusstjärnor räknas inte i duellen.
- **Sysslor och känslor byts mot stjärnor.** 26 utmaningar i grenen Hem, till exempel "Städa badrummet", krockar med principen "Milstolpar, inte sysslor". Samma sak gäller "Diska för hand" i grenen Mat. "Säga förlåt själv" och "Lugna mig när jag är arg" lär barnet att spela känslor för att få stjärnor.
  - *Lösning:* ge ett berömkort i stället för stjärnor och ta bort de rena sysslorna.
- **Inget trappar ner belöningarna när nyhetens behag har lagt sig.**
  - *Lösning:* en "Jag kan"-bok med färdigheterna blir det bestående, och barnet får färre stjärnor ju äldre det blir.

### 2.3 Säkerhet och integritet
- **AI-text når barnet utan granskning.** `withAiCardText` (`_shared/game.ts`) sparar texten direkt vid godkännandet, vilket bryter mot spec 8.
  - *Lösning:* låt föräldern se texten först.
- **Mer än förnamnet går till Anthropic i USA.** Förälderns kommentar och fritext, till exempel "hon är rädd för att gå på toa…", kan innehålla hälsodata. Därför stämmer inte appens text "Vi sparar bara förnamn…".
  - *Lösning:* ersätt namnet med en platshållare, varna vid fritextfältet, teckna ett personuppgiftsbiträdesavtal och beskriv överföringen i integritetspolicyn.
- **Exemplet "Familjen Bandak" uppmanar föräldern att skriva sitt efternamn.**
  - *Lösning:* byt exempel.
- **Apple Kids (5.1.4) och Google Families förbjuder att personuppgifter skickas till tredje part och kräver godkända SDK:er.** Det berör RevenueCat och push.
  - *Lösning:* granska varje SDK, eller lista appen som en föräldraapp med barnläge.
- **Medföräldern kan köra `removeChild` och exportera allt**, eftersom motorn saknar rollkontroller. Medföräldern kan inte heller tas bort, vilket är en verklig risk vid separation.
  - *Lösning:* gör destruktiva kommandon admin-only och gör det möjligt att ta bort en medförälder och återkalla dess sessioner.
- **Vem som helst kan stänga av all parkoppling.** 300 misslyckade försök på 10 minuter pausar parkopplingen för alla, och anonyma konton är gratis.
  - *Lösning:* captcha eller attestering, en gräns per IP-adress och en lång token i QR-koden.

### 2.4 Användarupplevelse
- **Barnet firas innan föräldern har godkänt.** "Jag klarade det!" ger konfetti. Om föräldern sedan ger en gnista i stället backar ägget, och det känns som ett misslyckande.
  - *Lösning:* fira först efter godkännandet.
- **Syskonduellen visar varje dag vem som leder.** "{namn} leder just nu!" (`widgets.tsx`) visas för alla syskon, så samma barn ser dagligen att det ligger efter. Ett handikapp på upp till ×3 syns som orättvisa.
  - *Lösning:* visa bara barnets egen veckosiffra, ge en sammanfattning på söndagen och stäng av duellen som standard för barn under 7 år.
- **Föräldern måste godkänna allt.** Tre barn med fem ägg var blir för mycket jobb.
  - *Lösning:* godkänn allt samlat i ett kvällspass, och godkänn återkommande utmaningar automatiskt.

### 2.5 Teknik
- **Molnläget har aldrig körts.** Det gäller två kopior av motorn, offlinekön, RLS, realtidssynken, push och RevenueCat.
  - *Lösning:* sätt upp en Supabase-miljö för test och kör hela loopen på två riktiga telefoner innan något nytt byggs. Kör samma kommandosekvenser genom båda motorerna.
- **Inga UI-tester.** Acceptanskriterierna (att barnet kan använda appen utan att läsa, högst två tryck från notisen och att inga foton lämnar enheten) är inte verifierade.
  - *Lösning:* Maestro för de tre kritiska flödena och nätverksloggning.
- **Ingen mätning.**
  - *Lösning:* anonyma förstapartshändelser på föräldrasidan, till exempel antal veckoaktiva familjer och godkännanden per vecka.

### 2.6 Vad saknas?
- En extern beta med mätdata
- Riktig grafik för en värld
- Migrering från lokalt läge till molnet
- Förälderns granskning av AI-text, ett personuppgiftsbiträdesavtal och en integritetspolicy
- Roller för medföräldern och möjlighet att ta bort den
- En plan för att trappa ner belöningarna

### 2.7 Vad bör tas bort eller skjutas upp?
- Dinodalen, Utforskarbasen och specialvarelserna
- Syskonduellen med handikapp
- AI-skrivna samlarkort, som ger lite värde men innebär hög risk
- Obegränsade bonusstjärnor från gnistor
- Stjärnor för känslor och sysslor

---

## 3. Investeraren

### 3.1 Marknad och målgrupp
Sverige har ungefär 1,15 miljoner barn i åldern 4–13 år. Det motsvarar cirka 700 000 hushåll (antagande: 1,6 barn i det åldersspannet per hushåll). Norden som helhet är ungefär 2,5 gånger så stort.

Min uppskattning är att 2–5 % av målfamiljerna laddar ner appen inom tre år, alltså **15 000–35 000 familjer i Sverige**. Det är en nisch. Vägen ut går via Norge och Danmark, som har samma syn på att låta barn ta eget ansvar, och appen är redan förberedd för fler språk. Går ni till engelskspråkiga marknader möter ni Joon direkt.

### 3.2 Betalningsvilja
Det är föräldern som betalar. Föräldern betalar för att barnet blir motiverat och för att slippa hitta på nya utmaningar själv, inte för AI. 399 kr/år är rimligt för en svensk barnapp, och 49 kr/mån fungerar som ett ankarpris.

Gränsen "1 barn gratis" är er starkaste spärr. De flesta målfamiljer har syskon (antagande: cirka 60 %), och det är just syskonduellen som fungerar hemma hos grundaren. Behåll den.

Problemet är tajmingen. 42 gratis utmaningar räcker i 2–3 månader, så Plus säljs först när motivationen redan sjunker. Erbjud därför provperioden direkt när barn nummer två läggs till i onboardingen.

### 3.3 Intäktsmodell (uppskattningar)
- **Netto per familj:** årsplanen på 399 kr minus moms (25 %) och butiksavgift (15 % i Small Business Program) ger cirka 271 kr. AI-kostnaden med Haiku blir cirka 1–2 kr per familj och månad. Supabase Pro kostar cirka 300 kr/mån i fast avgift. **Netto blir det cirka 250 kr per betalande familj och år.**
- **Konvertering** från nedladdning till betalande: 3–6 %.
- **Churn:** barnen växer inte ifrån appen förrän efter flera år, men de tröttnar efter 3–9 månader, precis som med affischen. Om 35–45 % förnyar blir **LTV cirka 400 kr**.
- **CAC** med betald reklam: 25–40 kr per installation och cirka 5 % som blir betalande ger **500–800 kr per kund, alltså mer än LTV.** Tillväxten måste därför vara organisk.

### 3.4 Konkurrenter

| Konkurrent | Fokus |
|---|---|
| Greenlight, BusyKid, Gimi (svensk) | Pengar och veckopeng |
| OurHome, S'moresUp | Sysslor och poäng |
| Habitica | Äldre användare |
| Brili | Rutiner för barn med ADHD |
| **Joon** | Barnet sköter ett virtuellt husdjur och driver det framåt genom att göra verkliga uppgifter |

**Joon** ligger närmast. Priset är cirka 10–15 USD/mån (ur minnet, osäkert). Joon visar att modellen fungerar och är det stora hotet utanför Norden. Den största konkurrenten är ändå gratis: belöningsdiagram på papper, inklusive er egen affisch.

**Det här är unikt på riktigt:** milstolpar för självständighet i stället för sysslor, ett utvalt bibliotek som följer barnets ålder (eget innehåll att äga), principen "försöket räknas", uppläsning på svenska för barn som inte kan läsa och integritet utan reklam.

**Det här är bara snyggt utfört:** kläckning, världar, tävlingslägen, AI-förslag och parkoppling med QR-kod. Allt det går att kopiera. Dessutom saknas riktig grafik, så ingen vet ännu om varelserna, som ska vara barnets främsta motivation, faktiskt fungerar.

### 3.5 Väg till lönsamhet
- **Som sidoprojekt** räcker cirka 25 betalande familjer för att täcka drift och utvecklarkonton. Det krävs cirka 150 om grafik för cirka 100 000 kr ska betalas på tre år (antagande).
- **Som heltidsjobb** (cirka 70 000 kr/mån inklusive avgifter) krävs **cirka 3 500 betalande familjer**, alltså 60 000–120 000 nedladdningar. Det motsvarar cirka 0,5 % av alla svenska målfamiljer, vilket vore ett toppresultat för en svensk föräldraapp.
- **Kanaler:** A3-affischen som gratis utskrift med QR-kod (billigast), föräldrainfluencers och poddar samt att bli lyft av App Store. Förskolor är försiktiga med att tipsa om kommersiella produkter, och BVC rekommenderar knappast appar (antagande).
- **Validera först**, med 30–50 familjer under 8 veckor:
  1. Hur stor andel av familjerna är aktiva vecka 8? Målet är mer än 30 %. Det kräver egen statistik i appen, så bygg den först.
  2. Godkänner föräldrarna fortfarande barnens utmaningar efter vecka 4?
  3. Är de villiga att betala? Testa med förköp.
  4. Ger affischen installationer för under 30 kr styck?

### 3.6 Skulle jag lägga tid eller pengar på detta?
**Pengar: Nej, inte i dag. Tid: Ja, några timmar.**

Produkten är ovanligt välbyggd för att vara så tidig, och vinkeln (självständighet, inte sysslor) är skarp. Men marknaden är liten, och med betald reklam kostar en ny kund mer än den drar in. Den viktigaste frågan är dessutom obesvarad: är barn och föräldrar kvar efter två månader?

Bygg inga fler funktioner nu. Ta fram riktig grafik och egen statistik, kör testet och kom tillbaka med siffrorna.

---

## 4. Faktakontroll av kritikerns påståenden

Påståendena kontrollerades mot koden innan domaren fick dem.

| Påstående | Resultat | Var i koden |
|---|---|---|
| Var tredje gnista ger en bonusstjärna utan tak, och den räknas i totalen | Stämmer | `src/domain/handlers/challenges.ts:159`, `src/domain/stars.ts:6` |
| AI-kortstexten sparas utan att föräldern har sett den | Stämmer, men ett automatiskt filter stoppar negativa ord och kräver att barnets namn finns med | `supabase/functions/_shared/game.ts:51`, `src/backend/aiPrompts.ts:140` |
| Förälderns kommentar skickas till AI | Stämmer. Specen (avsnitt 8) anger det som indata, men det är ändå en fråga om personuppgifter | `src/backend/aiPrompts.ts:79` |
| Platshållaren "Familjen Bandak" | Stämmer | `src/lib/i18n/sv.ts:84` |
| Motorn har inga rollkontroller | Stämmer. Bara radering av familjen och inbjudningar kräver admin | `supabase/functions/delete-family/index.ts:10`, migration `…000200`, rad 368 |
| Global spärr för parkoppling vid 300 misslyckade försök på 10 minuter | Stämmer. Det är ett avsiktligt designval, kommenterat i koden | migration `…000200`, rad 453 och 472 |
| Konfetti redan vid "Jag klarade det!" | Stämmer | `src/app/child/challenge/[id].tsx:70–79` |
| "{namn} leder just nu!" i barnvyn | Stämmer | `src/features/child/widgets.tsx:85` |
| Ingen migrering från lokalt läge till molnet | Stämmer | (saknas) |
| 26 utmaningar i grenen Hem, bland annat "Städa badrummet" | Stämmer | `seed/challenges.json` |
| "Diska för hand" ligger i grenen Hem | Fel. Den ligger i grenen Mat | `seed/challenges.json` |

---

## 5. Domaren

### Helhetsbetyg
**6/10.** För två dagars arbete är appen ovanligt välbyggd, och vinkeln är skarp: självständighet, inte sysslor. Men inget är bevisat. Molnläget har aldrig körts, belöningen är fortfarande emoji och bara en familj har testat. Dessutom motsäger flera pedagogiska val appens egen idé.

### Rekommendation: JUSTERA
Kritikern och investeraren kommer fram till samma sak från olika håll: sluta bygga bredd och börja mäta. Idén ska inte släppas. Vinkeln är unik och driften är så billig att cirka 25 betalande familjer räcker för att täcka den. Men den ska inte heller lanseras som den är. Ett släpp nu skulle mäta emoji-grafik och gnistfarmning i stället för själva idén.

### De starkaste argumenten för och emot
**För**
- Unik vinkel: milstolpar för självständighet, ett bibliotek som följer barnets ålder, "försöket räknas" och uppläsning på svenska. Ingen av de nämnda konkurrenterna gör detta.
- Tekniken håller: en delad motor, 94 % testtäckning, RLS, ingen reklam och foton som aldrig lämnar enheten.
- Låg fast kostnad (cirka 300 kr/mån), så det är billigt att testa på riktigt.
- En gratis kanal finns redan: A3-affischen.

**Emot**
- Ingen extern validering, och retention går inte ens att mäta.
- En ny kund kostar 500–800 kr men drar bara in cirka 400 kr, och marknaden är en nisch. Bara organisk tillväxt fungerar.
- Pedagogiken krockar med löftet: bonusstjärnor utan tak, stjärnor för sysslor och känslor, firande innan föräldern godkänt och en daglig ledartavla mellan syskon.
- Integritetsluckor kan stoppa godkännandet i appbutikerna: AI-data skickas till USA, medföräldern saknar roller och Apples och Googles regler för barnappar är inte uppfyllda.

### Hur produkten bör ändras
- **Smalna av:** lansera en värld (Äggdalen, 4–8 år) med riktig grafik. Frys de andra världarna, specialvarelserna och de AI-skrivna samlarkorten.
- **Laga pedagogiken:**
  - högst en bonusstjärna per ägg
  - en lugn bekräftelse när barnet trycker, konfetti först efter godkännandet
  - syskonduellen avstängd som standard, och barnet ser bara sin egen siffra
  - ta bort de rena sysslorna och ge ett berömkort utan stjärnor för känsloutmaningarna
- **Stäng av AI i betan.** Här har båda rätt: föräldrar betalar inte för AI, och AI står för den största integritetsrisken. Biblioteket räcker.
- **Gratisnivån:** här går analyserna isär. Jag stödjer investeraren: behåll "1 barn gratis", men erbjud provperioden när barn nummer två läggs till. Kritikerns förslag om ett gratis familjemål avgörs med betadata, inte med gissningar. Under betan är allt gratis.
- **Skilj på vad som stoppar betan och vad som stoppar lanseringen.**
  - Före betan: roller för medföräldern och AI avstängd.
  - Före publik lansering: personuppgiftsbiträdesavtal, granskning av SDK:er enligt reglerna för barnappar, captcha vid parkoppling och migrering från lokalt läge till molnet.

### Topp 5 förbättringar (värde i förhållande till insats)
| # | Förbättring | Värde | Insats | Varför här |
|---|---|---|---|---|
| 1 | Pedagogiska snabbfixar (tak för bonusstjärnor, fira efter godkännande, duellen av, byt ut "Familjen Bandak") | Högt | Liten | Några få ändringar tar bort de största krockarna med appens egen idé. |
| 2 | AI bakom en flagga, avstängd i betan | Högt | Liten | Ett enda steg löser både den ogranskade texten och överföringen av personuppgifter. |
| 3 | Anonym förstapartsstatistik på föräldrasidan | Högt | Liten–medel | Utan mätning ger betan bara anekdoter. |
| 4 | Supabase-testmiljö där hela loopen körs på två telefoner, plus destruktiva kommandon bara för admin | Högt | Medel | Molnläget är helt oprövat och måste fungera innan någon utomstående får appen. |
| 5 | Riktig grafik för Äggdalen, i en mindre uppsättning (cirka 10 arter × 3 steg) | Högt | Stor | Varelserna är själva belöningen, men här är både insatsen och väntetiden störst. |

### Fokus de närmaste 4 veckorna
**Vecka 1 – Få molnet att fungera.**
- Grundaren skapar Supabase-projektet och utvecklarkonton hos Apple och Google och beställer grafiken.
- Claude Code driftsätter databasen och Edge Functions och gör förbättring 1 och 2.
- *Klart när* hela kedjan (parkoppla → försök → godkänn → stjärna → kläckning) fungerar tio gånger i rad på två telefoner, även efter att de har varit offline.

**Vecka 2 – Säkert och mätbart.**
- Roller för medföräldern: det ska gå att ta bort en medförälder och återkalla dess sessioner.
- Parkopplingsspärren gäller per familj i stället för alla.
- Statistiken byggs, integritetstexten uppdateras och en enkel integritetspolicy skrivs.
- Sysslor och känsloutmaningar rensas ur betabiblioteket.
- Grundaren rekryterar familjer.
- *Klart när* rolltesterna går igenom och händelserna syns i en enkel vy.
- Om molnet inte är stabilt efter den här veckan: kör betan i lokalt läge hellre än att skjuta upp den.

**Vecka 3 – Bygg betaversionen.**
- Grafiken kopplas in, Maestro testar de tre kritiska flödena och appen läggs ut via TestFlight och Googles interna testspår.
- En pilot körs med 3 familjer utanför den egna kretsen.
- *Klart när* piloten har gått en vecka utan blockerande fel och 20–30 familjer har tackat ja.

**Vecka 4 – Starta betan och frys funktionerna.**
- Alla familjer bjuds in, och affischen med QR-kod testas som kanal.
- *Klart när* minst 20 familjer har parkopplat och gjort minst ett godkännande, och statistiken uppdateras varje dag.
- Därefter byggs inget nytt förrän vecka 8. Då ska investerarens mål vara mätta: mer än 30 % aktiva, föräldrar som fortfarande godkänner och vilja att betala.

### Tre konkreta nästa steg
1. **Skapa Supabase-projektet och utvecklarkontona hos Apple och Google.** Det kan bara grundaren göra, och allt annat väntar på det.
2. **Låt Claude Code göra snabbfixarna och lägga AI bakom en avstängd flagga** i en och samma session, med tester för taket på bonusstjärnor och för när firandet visas.
3. **Börja rekrytera 30 testfamiljer och beställ grafiken för Äggdalen.** Gör ett inlägg i föräldragrupper och på förskolor, och skicka en brief till en illustratör.
