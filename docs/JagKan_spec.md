# JagKan! – Produkt- och byggspecifikation

> **Version:** 1.0 (utkast) · **Datum:** 2026-10-10 · **Ägare:** George Bandak
> **Syfte:** Det här dokumentet beskriver hela appen JagKan! så att Claude Code kan bygga den från grunden. Läs hela dokumentet innan du börjar koda. Avsnitt 15 beskriver byggordningen.

---

## 1. Sammanfattning

**JagKan!** är en gamifierad app för familjer. Den hjälper barn att bli självständiga, steg för steg, från ungefär 4 års ålder upp till 13 år. Föräldern sätter upp utmaningar, till exempel "Dra upp blixtlåset själv", "Bre din egen smörgås" eller "Åk buss själv till skolan". Barnet får **gnistor** när det försöker och **stjärnor** när det klarar utmaningen. Stjärnorna kläcker och utvecklar **samlarvarelser** i en spelvärld som byts ut när barnet blir äldre. Föräldern kan också skapa egna belöningar, till exempel "5 stjärnor = välja middag".

**Kärnvärden**

- **Försöket räknas.** Barnet belönas för att våga försöka, inte bara när det lyckas.
- **Milstolpar, inte sysslor.** Appen handlar om självständighet, inte om veckopeng för disk.
- **Växer med barnet.** Världen, utmaningarna och utseendet följer barnets ålder, och samlingen finns kvar hela barndomen.
- **Lite jobb för föräldern.** Föräldern godkänner med ett tryck, AI föreslår nya utmaningar och påminnelser sker automatiskt.
- **Integritet.** Foton och videor av barnen lämnar aldrig enheten.

**Bakgrund:** Appen bygger på "Vuxen spelet". Det är ett stjärnspel på en A3-affisch som grundaren använder med sina barn (6 och 5 år). Barnen är engagerade och gillar att tävla. Problemen har varit att komma på nya prövningar, att komma ihåg spelet och att kunna dokumentera framgångar på ett roligt sätt. Appen ska lösa just de problemen.

---

## 2. Målgrupp och användare

| Roll | Beskrivning | Enhet |
|---|---|---|
| **Förälder (admin)** | Skapar familjen, lägger till barn, väljer utmaningar, godkänner, sätter belöningar och betalar Plus. | Egen mobil |
| **Medförälder** | Har samma rättigheter som admin, men kan inte hantera prenumerationen. Bjuds in via länk eller kod. | Egen mobil |
| **Barn** | Ser sina utmaningar, trycker "Jag klarade det!" eller "Jag försökte!", tittar på sin samling och sina belöningar. | Surfplatta eller mobil (egen eller delad) |

- **Åldersspann:** 4–13 år, i tre åldersband (se avsnitt 5).
- **Marknad:** Sverige först. All text ska vara på svenska, men koden ska vara förberedd för fler språk (i18n) från start.
- **Plattformar:** iOS (iPhone och iPad) och Android (mobil och surfplatta).

---

## 3. Spelmekanik

### 3.1 Grundloop

```
Förälder väljer/godkänner utmaning
        ↓
Barnet ser utmaningen som ett ÄGG (eller motsvarande per värld) i sin vy
        ↓
Barnet försöker → trycker "Jag försökte!" → +1 gnista (ägget värms/spricker lite)
        ↓
Barnet klarar det → trycker "Jag klarade det!" → förfrågan till föräldern
        ↓
Föräldern godkänner (1 tryck, valfritt foto + kommentar)
        ↓
+1 stjärna, ägget kläcks → varelse till samlingen + samlarkort i albumet
```

### 3.2 Valutor och regler

| Element | Hur man får det | Regler |
|---|---|---|
| **Gnista 🔥** | Barnet trycker "Jag försökte!" på en aktiv utmaning. Föräldern kan också ge gnistor direkt. | Max 1 gnista per utmaning och dag. Gnistorna syns som laddning på ägget. **3 gnistor ger 1 bonusstjärna** (kan stängas av i inställningarna). |
| **Stjärna ⭐** | En godkänd utmaning ger 1 stjärna. | Varje utmaning ger 1 stjärna, oavsett svårighet. Rättvisan kommer av att utmaningarna anpassas efter ålder. |
| **Varelse** | Kläcks när en utmaning är klarad. Varje utmaning hör till en gren, och grenen avgör vilken varelsefamilj den kläckta varelsen tillhör. | Se avsnitt 5. |
| **Utveckling** | Varelsen utvecklas när barnet samlar stjärnor i en gren: **3 stjärnor ger steg 2 och 10 stjärnor ger steg 3**. | Utvecklingen visas med en animation. |

**Stjärnsaldo.** Stjärnorna fungerar både som räknare och som valuta:

- *Totalt antal stjärnor* används för milstolpar, tävlingar och familjemål och minskar aldrig.
- *Stjärnor att spendera* används i föräldrarnas belöningsbutik och minskar när barnet löser in en belöning.

### 3.3 Grenar (kategorier)

| Gren | Ikon | Exempel |
|---|---|---|
| Kropp & hygien | 🪥 | Borsta tänderna själv, klä på sig, duscha själv |
| Mat & kök | 🍳 | Bre smörgås, hälla upp mjölk, laga enkel frukost |
| Hem & ordning | 🏠 | Bädda sängen, packa väskan, sortera tvätt |
| Ute & trafik | 🚲 | Cykla utan stödhjul, gå till kompis själv, åka buss |
| Pengar | 🪙 | Betala själv i kassan, spara till något, förstå pris |
| Känslor & socialt | 💛 | Säga förlåt, presentera sig, ringa farmor själv |
| Mod & nytt | 🦁 | Smaka ny mat, simma 5 m, sova borta |

### 3.4 Milstolpar och avatarer

- Barnets **profilavatar** väljs bland upplåsta varelser.
- **Fasta milstolpar** för totalt antal stjärnor låser upp specialvarelser, bakgrunder och titlar. Förslag på nivåer: 5, 10, 25, 50, 100, 200 och 365 stjärnor. Exempel på titlar: "Lilla hjälten", "Självis", "Mästare".
- **Grenmästare:** när alla varelser i en gren har nått steg 3 får barnet ett guldmärke för grenen.

---

## 4. Tävlingslägen

Föräldern väljer vilka lägen som är aktiva. Flera kan vara aktiva samtidigt.

| Läge | Hur det fungerar | Visning |
|---|---|---|
| **Familjemål** | Alla barns stjärnor räknas ihop mot ett gemensamt mål som föräldern sätter, till exempel "40 stjärnor = bio". | Gemensam mätare på barnens hemskärm och i föräldravyn. Firas med animation när målet nås. |
| **Syskonduell** | Barnen tävlar under en vecka (mån–sön) om flest stjärnor. Barnen har olika svåra utmaningar, så alla tävlar på sin egen nivå. Föräldern kan ge ett **handikapp**, till exempel att ett barns stjärnor räknas ×1,5. | Topplista, där vinnaren får en veckopokal i samlingen. Alla får en "Bra kämpat"-gnista. |
| **Mot mig själv** | Barnet jämför veckan med sitt eget rekord och med förra veckan. | "Nytt rekord!"-firande och en tillväxtkurva över tid. |

**Regel:** Ett barn ska aldrig se en text som säger att det har förlorat. Formuleringarna ska alltid vara positiva, till exempel "Evelyn vann veckan! Rafael: 2 stjärnor kvar till ditt rekord".

---

## 5. Världar efter ålder

Spelmekaniken är densamma i alla världar. Det som skiljer dem åt är utseendet, berättelsen och tonen.

| Band | Ålder (standard) | Värld | "Ägg"-objekt | Försök (gnista) | Klarat | Ton |
|---|---|---|---|---|---|---|
| **1** | 4–6 | **Äggdalen**: gulliga, runda varelser | Ägg | Ägget värms och glöder | Ägget kläcks och en varelse kommer ut | Mjuk, lekfull, mycket ljud och animation |
| **2** | 7–9 | **Dinodalen**: dinosaurier och drakar | Fossil eller ägg i sten | Barnet gräver fram fossilet | Dinon vaknar | Äventyr, lite tuffare |
| **3** | 10–13 | **Utforskarbasen**: utforskare och teknik | Låst utrustningslåda | Lådan laddas | Barnet får utrustning, märke och rang | Cool, statistik, streaks, mindre gulligt |

**Regler för världarna**

- Världen väljs automatiskt efter barnets ålder, men **föräldern eller barnet kan byta** till en annan värld.
- **Uppflyttning:** När barnet fyller år och hamnar i ett nytt åldersband föreslår appen en "examen", med en animation och texten "Du är redo för nästa värld!". Barnet bestämmer själv när det byter.
- **Samlingen följer med.** Varelser från tidigare världar finns kvar som en trofésamling (en flik per värld).
- **Antal varelser per värld:** 7 grenar × 3 varelser × 3 utvecklingssteg = 63 bilder, plus cirka 10 specialvarelser för milstolparna.

### 5.1 Grafik

- **Färdig samling, inte unik per barn.** All grafik ritas en gång, till exempel med AI-bildverktyg, och kurateras manuellt. Bilderna läggs i appen eller på ett CDN.
- **Stil:** Varje värld har sin egen enhetliga stil. Exempel: Äggdalen i pastell och 3D-lera, Dinodalen i kraftigare färger, Utforskarbasen i flat/isometrisk stil.
- **Under utveckling** används placeholders, till exempel emoji eller enkla SVG-figurer i grenens färg. Koden ska läsa bilderna från en manifestfil (`creatures.json`) så att de kan bytas ut utan kodändringar.
- Specifikationen för grafiken (namn, gren, steg, personlighet) finns i `creatures.json`. Claude Code skapar en första version med placeholders.

---

## 6. Utmaningar

### 6.1 Källor till utmaningar

1. **Biblioteket:** En inbyggd, kurerad lista (seed-data i JSON, se 6.4). Varje post har gren, åldersspann, svårighet (1–3), barnvänlig titel, ikon, förälderbeskrivning och tips.
2. **Egna utmaningar:** Föräldern skriver en egen titel och väljer gren och ikon.
3. **AI-förslag (Plus):** Varje vecka föreslår AI 3 nya utmaningar per barn, se avsnitt 8.

### 6.2 Utmaningens livscykel

```
suggested → active → (attempts…) → requested → completed
                 ↘ paused / archived
```

- `suggested`: AI eller biblioteket har föreslagit utmaningen. Föräldern ser den och kan aktivera den.
- `active`: utmaningen syns hos barnet som ett ägg. Rekommendation: **max 5 aktiva utmaningar per barn**, så att det inte blir rörigt.
- `requested`: barnet har tryckt "Jag klarade det!" och väntar på att föräldern ska godkänna.
- `completed`: föräldern har godkänt, barnet har fått en stjärna och varelsen har kläckts.
- Föräldern kan registrera en klarad utmaning direkt, utan att barnet har begärt det.
- **Återkommande utmaningar** (valfritt): Vissa utmaningar kan klaras flera gånger, till exempel "Borsta tänderna utan påminnelse 7 dagar i rad". Då ger de flera stjärnor, men varelsen kläcks bara första gången.

### 6.3 Godkännandeflöde (förälder)

1. Föräldern får en push-notis: "Evelyn säger: Jag drog upp blixtlåset själv! 🎉"
2. Föräldern öppnar notisen och ser kortet. Föräldern kan:
   - **Godkänn** (ett tryck)
   - **Godkänn med foto eller video.** Kameran öppnas och bilden sparas **lokalt** på föräldrarnas enhet.
   - **Ge en gnista i stället** ("Bra försök, nästan där!")
   - Lägga till en kort kommentar (valfritt)
3. Appen skapar ett **samlarkort** med titel, datum, varelse, gren och en stolt text i tredje person, till exempel *"Evelyn har lärt sig dra upp blixtlåset helt själv. Hon kämpade i flera dagar och gav inte upp!"* I Plus skriver AI texten. I gratisversionen används en mall.
4. Barnets enhet får en realtidsuppdatering och visar kläckningsanimationen nästa gång barnet öppnar appen. Om appen redan är öppen visas den direkt.

### 6.4 Startbibliotek (seed)

Claude Code skapar `seed/challenges.json` med **minst 150 utmaningar** fördelade över grenar och åldersband. Exemplen nedan är en startpunkt.

**Band 1 (4–6 år)**

| Gren | Utmaningar |
|---|---|
| Kropp & hygien | Dra upp blixtlåset själv · Klä på mig själv på morgonen · Borsta tänderna själv (förälder kollar) · Tvätta händerna utan påminnelse · Ta på mig skorna (kardborre) · Snyta mig själv · Ta tabletter/medicin själv med vatten |
| Mat & kök | Bre min egen smörgås · Hälla upp mjölk utan att spilla · Duka fram min tallrik · Skala en banan/mandarin · Äta med kniv och gaffel · Ställa in disken |
| Hem & ordning | Plocka undan mina leksaker · Hänga upp jackan · Lägga smutstvätt i korgen · Bädda sängen (enkelt) |
| Ute & trafik | Cykla utan stödhjul · Titta åt båda hållen vid övergångsstället · Gå själv till grannen (med förälder som tittar) |
| Pengar | Lägga pengar i spargrisen · Betala själv i kassan (med hjälp) |
| Känslor & socialt | Säga "hej" och mitt namn till en ny vuxen · Säga förlåt själv · Berätta hur jag känner mig · Hjälpa ett syskon |
| Mod & nytt | Smaka en ny mat · Doppa huvudet under vattnet · Sova i egen säng hela natten · Klappa ett snällt djur |

**Band 2 (7–9 år)**

| Gren | Utmaningar |
|---|---|
| Kropp & hygien | Knyta skorna · Duscha och tvätta håret själv · Klippa naglarna (med hjälp) |
| Mat & kök | Göra frukost själv · Koka ägg (med vuxen nära) · Följa ett enkelt recept |
| Hem & ordning | Packa skolväskan kvällen före · Städa mitt rum · Vika och lägga in kläder |
| Ute & trafik | Gå till skolan själv · Cykla till kompis själv · Kunna adress och telefonnummer utantill |
| Pengar | Handla en sak själv i affären · Spara till något i 4 veckor |
| Känslor & socialt | Ringa en släkting själv · Beställa själv på café/restaurang · Lösa en konflikt utan vuxen |
| Mod & nytt | Simma 25 m · Sova borta hos kompis · Läsa en hel bok själv |

**Band 3 (10–13 år)**

| Gren | Utmaningar |
|---|---|
| Kropp & hygien | Ta hand om egen hygienrutin hela veckan · Packa egen träningsväska |
| Mat & kök | Laga middag till familjen · Planera och handla till en måltid |
| Hem & ordning | Tvätta egen tvätt · Ha hand om ett husdjur en vecka |
| Ute & trafik | Åka kollektivtrafik själv · Läsa en tidtabell och planera en resa |
| Pengar | Hantera egen veckopeng en månad · Jämföra priser och välja bästa köp |
| Känslor & socialt | Boka en egen tid (t.ex. frisör) · Hålla ett löfte en hel vecka |
| Mod & nytt | Prova en ny aktivitet/sport · Hålla en kort presentation för familjen |

**Fält per utmaning i JSON:**

```json
{
  "id": "kropp_blixtlas_01",
  "branch": "kropp",
  "ageMin": 4, "ageMax": 6,
  "difficulty": 1,
  "titleChild": "Dra upp blixtlåset själv",
  "titleParent": "Dra upp blixtlåset på jackan själv",
  "icon": "🧥",
  "parentTip": "Visa hur man hakar i nederdelen först. Beröm försöken!",
  "repeatable": false,
  "tags": ["påklädning", "finmotorik"]
}
```

---

## 7. Belöningar (förälderns butik)

- Föräldern skapar egna belöningar med namn, ikon, stjärnpris och valfritt barn (eller alla barn).
  - Exempel: "Välja middag" (5 ⭐), "Extra godnattsaga" (3 ⭐), "Biokväll" (20 ⭐), "30 min extra skärmtid" (8 ⭐).
- Appen ger **färdiga förslag** på belöningar efter ålder, så att föräldern inte behöver börja från noll.
- Barnet ser butiken i sin vy och kan trycka **"Jag vill ha den här!"** när barnet har råd. Föräldern får en förfrågan och trycker **Bekräfta**. Då dras stjärnorna och belöningen loggas.
- Familjemålets belöning sätts separat (se 4).

---

## 8. AI-funktioner (Plus)

Alla AI-anrop går via backend (edge function). **API-nyckeln får aldrig ligga i appen.** Modell: Claude via Anthropic API. Välj en snabb och billig modell för textgenerering.

| Funktion | Input | Output | Frekvens |
|---|---|---|---|
| **Veckoförslag** | Barnets ålder, värld, klarade utmaningar (bara titlar och grenar), aktiva utmaningar, grenar som saknas | 3 nya utmaningar i JSON-format enligt schemat i 6.4 | 1 gång per barn och vecka, samt "Ge mig fler" (max 3 gånger per dag) |
| **Samlarkortstext** | Barnets förnamn, utmaningens titel, förälderns kommentar, antal försök | 2–3 meningar i tredje person, varm och stolt ton | Varje gång en utmaning godkänns |
| **Egna utmaningar** | Förälderns fritext, till exempel "hon är rädd för att gå på toa själv i skolan" | Förslag på titel, gren, ikon och tips | Vid behov |

**Säkerhetsregler för AI**

- Skicka **inga foton och inga efternamn** till AI. Skicka bara förnamn och ålder.
- AI-förslag går **alltid via föräldern** innan barnet ser dem. Barnet ser aldrig opåverkad AI-text.
- Systemprompten ska kräva utmaningar som är säkra, passar åldern och kan göras hemma. Den ska inte föreslå något farligt, till exempel spis eller kniv för de yngsta utan att en vuxen är med.
- Validera utdata mot JSON-schemat. Om valideringen misslyckas används utmaningar ur biblioteket i stället.
- Begränsa antalet anrop (rate limit) per familj för att kontrollera kostnaden.

---

## 9. Barnvyn – design och UX

- **Ska fungera utan att barnet kan läsa:** stora ikoner, stora knappar (minst 64 pt), och varje text kan läsas upp. Använd systemets talsyntes (sv-SE) via `expo-speech`, aktiverad genom en högtalarikon.
- **Hemskärm:** barnets avatar högst upp, de aktiva äggen i ett rutnät med gnistor som laddning, och familjemålets mätare.
- **Tryck på ett ägg:** utmaningen visas med stor ikon och uppläsning, och två knappar: **"Jag försökte! 🔥"** och **"Jag klarade det! ⭐"**.
- **Samling:** varelserna visas i en dal, park eller bas, sorterade efter gren. Låsta varelser visas som siluetter.
- **Butik:** belöningar barnet har råd med är markerade.
- **Album:** samlarkorten i tidsordning. På barnets enhet visas den ritade varelsen i stället för foto om fotot finns på en annan enhet.
- **Animationer och ljud:** kläckning, utveckling, uppflyttning och firande av familjemålet. Använd `react-native-reanimated` och Lottie. Ljud kan stängas av.
- **Föräldraspärr:** för att lämna barnläget, ändra inställningar eller öppna externa länkar och köp krävs förälderns PIN-kod eller en vuxenfråga. Det är ett krav för App Store i kategorin Kids.

## 10. Föräldravyn – skärmar

1. **Onboarding:** konto (e-post eller Sign in with Apple/Google), familjens namn, lägga till barn (förnamn, födelseår och månad, valfri profilbild som är en varelse och inte ett foto), val av tävlingslägen.
2. **Översikt:** väntande godkännanden överst, sedan ett kort per barn med stjärnor denna vecka, aktiva utmaningar och nästa milstolpe.
3. **Barnets sida:** aktiva, föreslagna och klarade utmaningar, statistik per gren, album och inställningar för världen.
4. **Utmaningsbiblioteket:** sök och filtrera på gren, ålder och svårighet. Föräldern lägger till med ett tryck.
5. **AI-förslag (Plus):** en veckolista per barn där föräldern sveper för att aktivera eller avvisa.
6. **Skapa egen utmaning.**
7. **Belöningar:** skapa, redigera och se förfrågningar och historik.
8. **Tävlingar:** familjemål, syskonduell (med handikapp) och mot mig själv.
9. **Album:** foton och videor (lokala), samlarkort, delning (via systemets delningsfunktion, startad av föräldern) och export.
10. **Enheter:** parkoppla barnets enhet och se eller ta bort kopplade enheter.
11. **Inställningar:** notiser, gnista-till-stjärna-regeln, max antal aktiva utmaningar, PIN, prenumeration, export och radering av data, bjuda in medförälder.

## 11. Enheter, konton och parkoppling

- **Föräldrar** har riktiga konton.
- **Barn har inga konton och ingen e-post.** Barnet kopplas till en enhet.
- **Parkoppling:**
  1. Föräldern väljer "Lägg till barnets enhet", väljer barn och får en QR-kod och en sexsiffrig kod som gäller i 10 minuter.
  2. Barnets enhet installerar appen, väljer "Jag är ett barn" och skannar koden eller skriver in den.
  3. Barnets enhet får en **device-token** som bara har behörighet till det barnets data, plus familjens gemensamma data (familjemål och belöningar).
- **Delad enhet:** En surfplatta kan kopplas till flera barn. Då visas en profilväljare med avatarer på startskärmen.
- **Föräldraläge på samma enhet:** Om föräldern bara har en surfplatta ska det gå att växla till föräldraläget med PIN-kod.

## 12. Integritet och data (GDPR)

| Data | Var den lagras | Kommentar |
|---|---|---|
| Foton och videor av barn | **Endast lokalt** på enheten där de togs (appens dokumentkatalog) | Laddas aldrig upp till servern. Exportknappen sparar till enhetens bildbibliotek eller till förälderns val av moln via systemets delningsfunktion. |
| Spel-data (stjärnor, utmaningar, varelser, belöningar) | Backend i **EU-region** | Behövs för synk mellan förälderns och barnets enhet. |
| Barnets uppgifter | Förnamn, födelseår och månad | Inget efternamn, ingen exakt födelsedag, ingen plats. |
| Analys | Bara anonym, egen statistik på första parts-nivå | **Ingen reklam och ingen tredjepartsanalys i barnvyn** (krav för Apple Kids Category och Google Play Families). |

- Funktionerna **Exportera all data** (JSON) och **Radera familjen** finns i inställningarna.
- Integritetspolicy och användarvillkor på svenska krävs före lansering. Det är en extern uppgift och ingår inte i kodbygget.
- Lokala foton kopplas till samlarkortet via `localMediaId`. Om filen saknas, till exempel efter byte av telefon, visas den ritade varelsen i stället.

---

## 13. Affärsmodell: Gratis och Plus

| Funktion | Gratis | Plus |
|---|---|---|
| Antal barn | 1 | Obegränsat |
| Utmaningsbibliotek | Grundurval (cirka 40) | Hela biblioteket |
| Egna utmaningar | ✅ | ✅ |
| Gnistor, stjärnor, kläckning | ✅ | ✅ |
| Världar | Den värld som passar barnets ålder | Alla världar och specialvarelser |
| Belöningar | Max 3 | Obegränsat |
| Tävlingslägen | Mot mig själv | Alla tre |
| AI-veckoförslag | – | ✅ |
| AI-samlarkortstext | Mall | ✅ AI-skriven |
| Album-export | – | ✅ |

- **Pris:** Ska bestämmas. Arbetsförslag är 49 kr/mån eller 399 kr/år med 14 dagars gratis provperiod. Priserna sätts i App Store och Play Console, inte i koden.
- **Teknik:** köp i appen via **RevenueCat**, som hanterar både iOS och Android. Använd en entitlement `plus` och styr funktionerna med en feature flag.
- Köpflödet ska ligga bakom föräldraspärren.

---

## 14. Teknisk arkitektur (rekommendation)

| Del | Val | Varför |
|---|---|---|
| App | **Expo (React Native) + TypeScript**, Expo Router | En kodbas för iOS och Android, samt EAS Build och Submit |
| State/data | TanStack Query + Zustand, MMKV för lokal cache | Fungerar offline och är enkel |
| Backend | **Supabase** (Postgres, Auth, Realtime, Edge Functions, Storage endast för grafik) i EU-region | Snabbt att bygga, Row Level Security, realtidssynk |
| AI | Anthropic API via Supabase Edge Function | Nyckeln skyddas, och kostnad och anrop kan begränsas |
| Prenumeration | RevenueCat | Ett gemensamt API för båda appbutikerna |
| Push | Expo Notifications | Notiser om godkännanden, veckoförslag och påminnelser |
| Media | expo-camera, expo-image-picker, expo-file-system, expo-media-library (för export) | Lokal lagring |
| Animation | react-native-reanimated, lottie-react-native | Kläckning och firande |
| Tal | expo-speech (sv-SE) | Uppläsning för barn som inte kan läsa |
| i18n | i18next, med svenska som standard | Förberett för fler språk |
| Test | Jest + React Native Testing Library, samt Maestro för E2E | |

### 14.1 Datamodell (Postgres)

```
families            (id, name, created_at, plus_active, settings jsonb)
parents             (id → auth.users, family_id, role: admin|coparent, display_name)
children            (id, family_id, first_name, birth_year, birth_month, world_override, avatar_creature_id, created_at)
child_devices       (id, family_id, device_token_hash, child_ids uuid[], created_at, last_seen)
pairing_codes       (code, family_id, child_ids, expires_at)

challenge_templates (id, branch, age_min, age_max, difficulty, title_child, title_parent, icon, parent_tip, repeatable, tags, is_plus)
child_challenges    (id, child_id, template_id null, custom_title, custom_icon, branch, status, source: library|custom|ai,
                     sparks int, repeat_count, created_at, activated_at, requested_at, completed_at)
attempts            (id, child_challenge_id, created_at, source: child|parent)
completions         (id, child_challenge_id, approved_by, approved_at, parent_note, card_text, creature_id, local_media_id null)

creatures           (id, world, branch, family_slot 1-3, stage 1-3, name, asset_key, is_special, unlock_rule jsonb)
child_creatures     (child_id, creature_id, stage, unlocked_at)
milestones          (id, threshold_stars, reward_creature_id, title)
child_milestones    (child_id, milestone_id, reached_at)

star_ledger         (id, child_id, delta, reason: completion|spark_bonus|reward_redeem|adjust, ref_id, created_at)
rewards             (id, family_id, title, icon, cost_stars, child_id null, active)
reward_requests     (id, reward_id, child_id, status: requested|confirmed|declined, created_at, resolved_at)

family_goals        (id, family_id, title, target_stars, reward_text, start_at, end_at, reached_at)
competitions        (family_id, sibling_duel_enabled, handicaps jsonb, self_mode_enabled)
weekly_results      (id, family_id, week_start, results jsonb)

ai_suggestions      (id, child_id, payload jsonb, status: new|accepted|dismissed, created_at)
ai_usage            (family_id, day, calls)
```

- Stjärnsaldot räknas fram från `star_ledger` (summa av delta). Totalt antal stjärnor räknas bara på positiva poster, utom `adjust`.
- **RLS:** Föräldrar får läsa och skriva allt inom sin `family_id`. Barnets device-token får läsa sina egna barns data och familjens gemensamma data, och får bara skriva `attempts`, ändra status till `requested` och skapa `reward_requests`.
- Realtidsuppdateringar via Supabase Realtime på tabellerna `child_challenges`, `completions`, `reward_requests` och `family_goals`.
- **Lokalt på enheten:** tabellen `local_media` (id, completion_id, uri, type) lagras i MMKV eller SQLite och synkas aldrig.

### 14.2 Edge Functions

- `pair-device`: validerar koden och utfärdar device-token
- `ai-weekly-suggestions`: körs schemalagt (cron) varje söndag kväll för Plus-familjer, och kan också anropas manuellt
- `ai-card-text`: anropas när föräldern godkänner
- `ai-custom-challenge`
- `approve-completion`: transaktion som sätter status till completed, skapar posten i star_ledger, kläcker varelsen, kontrollerar milstolpar och utveckling och skickar push
- `weekly-rollup`: körs på söndag kväll, räknar fram veckoresultat och pokaler och skickar en veckosammanfattning till föräldrarna
- `revenuecat-webhook`: uppdaterar `families.plus_active`

### 14.3 Projektstruktur

```
jagkan/
  app/                  # Expo Router
    (parent)/...
    (child)/...
    onboarding/...
  src/
    components/
    features/
      challenges/  rewards/  creatures/  competitions/  album/  pairing/  subscription/
    lib/ (supabase, ai, i18n, speech, media)
    theme/ (world themes: valley, dino, explorer)
  assets/ creatures/ sounds/ lottie/
  seed/ challenges.json  creatures.json  milestones.json  reward_suggestions.json
  supabase/ migrations/  functions/
  docs/ JagKan_spec.md (detta dokument)
```

---

## 15. Byggordning (faser)

Hela lanseringsversionen byggs, men i en ordning som gör att appen kan testas hemma redan efter fas 2.

| Fas | Innehåll | Klart när |
|---|---|---|
| **0. Grund** | Expo-projekt, TypeScript, lint, Supabase-projekt (EU), migrationer, seed-filer, i18n, tema per värld | Appen startar och seed-datan laddas |
| **1. Kärnloop** | Föräldrakonto, familj, barn, bibliotek, aktivera utmaning, barnvy med ägg, gnistor, begäran, godkännande, stjärna, kläckning (placeholder-grafik), parkoppling, realtidssynk | En förälder och ett barn på två enheter klarar en hel loop |
| **2. Samling och belöningar** | Samling, utveckling, milstolpar, belöningsbutik, inlösen, samlarkort med mall-text, lokala foton, album, push-notiser, uppläsning | Familjen kan använda appen hemma i vardagen |
| **3. Tävlingar** | Familjemål, syskonduell med handikapp, mot mig själv, veckosammanfattning | Alla tre lägena fungerar |
| **4. Världar** | Dinodalen och Utforskarbasen (teman, grafik, animationer), uppflyttning och examen, trofésamling | Ett barn kan gå från värld 1 till värld 2 |
| **5. AI och Plus** | Edge functions för AI, veckoförslag, AI-kortstext, egna utmaningar med AI, RevenueCat, styrning av Plus-funktioner, föräldraspärr | Plus-köp i sandbox fungerar och AI-förslag visas |
| **6. Lanseringsklar** | Riktig grafik, ljud, export och radering av data, polering av onboarding, tillgänglighet, E2E-tester, App Store- och Play-listningar, EAS Submit | Godkänd i TestFlight och intern testning på Play |

**Acceptanskriterier för hela appen**

- Ett barn på 5 år klarar att använda barnvyn utan att kunna läsa, med uppläsning.
- Föräldern godkänner en begäran med högst 2 tryck från notisen.
- Inga foton lämnar enheten. Verifiera med nätverksloggning i test.
- Appen fungerar offline för barnet (gnistor och begäran köas och synkas sedan).
- Ingen text till barnet uttrycker förlust eller misslyckande.

---

## 16. Öppna frågor (beslutas senare)

1. Slutligt pris för Plus.
2. Vem som tar fram grafiken (AI-genererad och kurerad av grundaren, eller en illustratör), och vilken stil som gäller per värld.
3. Bolagsform och vem som står som utgivare i App Store och Google Play (konto för utvecklare krävs).
4. Varumärkeskontroll av "JagKan!" hos PRV/EUIPO samt domäner (jagkan.se och .com). **Ej verifierat ännu.**
5. Om appen ska få en webbversion för föräldrar senare.
6. Om en utskrivbar A3-affisch ska kunna genereras från appen, som en koppling till "Vuxen spelet".
