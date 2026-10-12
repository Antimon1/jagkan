# Illustratörsbrief: Äggdalen

> **Uppdrag:** 9 varelser i 3 utvecklingssteg, alltså 27 bilder, till barnappen JagKan!.
> **Kontakt och frågor:** grundaren av JagKan!.

## Om appen

JagKan! hjälper barn som är 4–13 år att bli självständiga genom vardagsutmaningar, till exempel "Dra upp blixtlåset själv" eller "Åka buss själv". När en vuxen har godkänt en utmaning kläcks ett ägg, och en varelse flyttar in i barnets samling. Varelsen växer sedan när barnet klarar fler utmaningar i samma gren.

Varelserna är själva belöningen. Barnet ska vilja ta hand om dem, visa upp dem och se dem växa.

Under betan finns bara en värld, **Äggdalen**, och den har en varelse per gren. Alla barn spelar där, även de äldre syskonen.

## Stil

- **Pastell och 3D-lera.** Varelserna ska vara runda och mjuka och se ut som om de vore modellerade i lera, med mjukt ljus och en lätt glans.
- **Gulligt, men inte bebisaktigt.** Fyraåringar ska älska dem, och en elvaåring ska inte skämmas för att visa dem. Tänk lekfulla figurer med personlighet hellre än bebisdjur.
- **En enhetlig stil.** De nio varelserna ska se ut att höra hemma i samma dal. Det ska gå att se vilken gren en varelse tillhör på färgen och på en detalj (se tabellen).
- **Tryggt för barn.** Inga skrämmande drag, inga vapen, och inget som liknar kända figurer eller varumärken.
- **Ingen text** i bilderna. Appen sätter alla namn själv.

## Utvecklingsstegen

| Steg | När | Hur varelsen ser ut |
|---|---|---|
| 1 | Nykläckt | Liten och rund, gärna med en bit äggskal kvar. Enkel form. |
| 2 | Efter 3 stjärnor i grenen | Större och mer självständig, med en tydlig detalj som visar grenen. |
| 3 | Efter 10 stjärnor i grenen | Fullvuxen och stolt, med en accessoar eller krona. Samma varelse, men tydligt "klar". |

Barnet ska direkt känna igen sin varelse i nästa steg. Behåll färg, ögon och grundform.

## De nio varelserna

Namnen och personligheterna kommer från appens innehållsfil (`seed/creatures.json`). Emojin visar bara stämningen och är inget krav. Färgen är varelsens huvudfärg i appen.

| Gren | Steg 1 → 2 → 3 | Färg | Personlighet |
|---|---|---|---|
| Kropp & hygien | Bubbis 🫧 → Bubbelina 🫧 → Skumdrottningen Bubbelina 👑 | `#F7A8C4` | Älskar skum och bubblor och sjunger när den tvättar sig. |
| Mat & kök | Bullis 🥐 → Bullan 🍞 → Bagarmästare Bullan 🧁 | `#FFE59E` | Bakar små bullar i sin äggskalsugn. |
| Hem & ordning | Städis 🧹 → Damma 🪶 → Ordningsfén Damma ✨ | `#D7C8F5` | Sorterar allt efter färg och sjunger städvisor. |
| Tid & planering | Ticki ⏰ → Tickelina 🕰️ → Klockfén Tickelina ✨ | `#C9D3FF` | Tickar mjukt och vet alltid när det är dags för frukost. |
| Ute & trafik | Tittis 👀 → Kikaren 🔭 → Vägvisaren Kikaren 🧭 | `#A8D8F0` | Tittar alltid åt båda hållen, två gånger. |
| Pengar | Myntis 🪙 → Grisis 🐷 → Skattkammargrisen 💰 | `#F8E3A3` | Samlar blanka mynt i sin lilla grisbuk. |
| Känslor & socialt | Kramis 🤗 → Kramelina 💗 → Hjärtdrottningen 💖 | `#FFC6D9` | Ger de mjukaste kramarna i Äggdalen. |
| Omtanke | Hjälpis 🤝 → Hjälpelina 💞 → Omtankefén Hjälpelina 🌸 | `#BFEFE8` | Märker direkt när någon behöver en hjälpande tass. |
| Mod & nytt | Modis 🦁 → Lejonungen 🦁 → Modiga Manen 🦁 | `#FFB3A7` | Vågar smaka allt, till och med blåbärssoppa med strössel. |

## Var bilderna syns

Bilderna måste fungera från stort till mycket litet:

| Plats i appen | Storlek på skärmen |
|---|---|
| Kläckning och firande | cirka 200 px |
| Samlarkort i albumet | 96–120 px |
| Barnets samling | cirka 92 px |
| Barnets profilbild (rund ram) | 52–56 px |

- Varelsen ska gå att känna igen även på 52 px. Undvik tunna linjer och små detaljer som bär hela figuren.
- **Låsta varelser** visas som en enfärgad siluett av samma bild. Formen ska därför vara tydlig även utan färg och ansikte.
- Bakgrunden i Äggdalen är ljus och varm, ungefär `#FFF4E8`.

## Tekniska krav

- **Format:** PNG med transparent bakgrund, 1024 × 1024 px.
- **Placering:** varelsen centrerad, cirka 10 % luft runt om, med fötterna eller botten på samma höjd i alla bilder. Ingen skugga på marken.
- **Filnamn:** `<gren>_1_s<steg>.png`, till exempel `kropp_1_s1.png`, `kropp_1_s2.png` och `kropp_1_s3.png`. Grenarna heter `kropp`, `mat`, `hem`, `tid`, `ute`, `pengar`, `kanslor`, `omtanke` och `mod`.
- **Mapp:** bilderna läggs i `assets/creatures/valley/` och kopplas in i `src/features/creatures/artwork.ts`. Appen visar platshållare för de bilder som saknas, så de kan levereras en i taget.
- **Källfiler:** lever även källfilerna (till exempel Blender, Procreate eller PSD), så att varelserna kan få nya poser senare.

## Arbetsgång

1. **Skisser:** grova skisser av alla nio varelser i steg 1, sida vid sida, så att helheten syns.
2. **En varelse hela vägen:** Bubbis i steg 1–3, färdig. Vi testar den i appen på riktiga skärmar innan resten görs.
3. **Resten:** de övriga åtta varelserna i alla tre stegen.
4. **Justeringar:** en avslutande runda efter test med barn i betan.

## Rättigheter

JagKan! behöver rätt att använda bilderna i appen, i appbutikerna och i marknadsföring, utan tidsgräns. Ange gärna i offerten om du vill bli nämnd i appen.

## Senare

Dinodalen och Utforskarbasen (för äldre barn), två varelser till per gren och 30 specialvarelser finns redan beskrivna i `seed/creatures.json` men är frysta tills betan är utvärderad. Om samarbetet fungerar bra blir det ett större uppdrag.
