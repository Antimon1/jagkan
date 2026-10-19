# JagKan!

En app där barn 4–13 år blir mer självständiga genom vardagsutmaningar. Barnet
värmer ett ägg med försök (gnistor 🔥), klarar utmaningen och får en stjärna ⭐
när en vuxen godkänner. Stjärnorna kläcker och utvecklar varelser, och kan bytas
mot belöningar som föräldern bestämmer. Hela specifikationen finns i
[docs/JagKan_spec.md](docs/JagKan_spec.md).

Appen använder ingen AI. Foton lämnar aldrig enheten, och inga uppgifter om
barnen lämnar EU.

## Prova

- **Webbförhandsvisning:** <https://antimon1.github.io/jagkan/> – välj
  "Utforska med en exempelfamilj". Allt sparas bara i webbläsaren.
- **Lokalt:**

  ```bash
  npm install
  npx expo start        # tryck w för webben, eller skanna QR-koden
  ```

  Kamera, notiser och köp kräver en development build (`npx expo run:ios|android`
  eller `npx eas-cli build --profile development`).

## Läget

| Del | Status |
|---|---|
| Spelmotor (gnistor, stjärnor, kläckning, milstolpar, belöningar, tävlingar, världar) | Klar, ~94 % testtäckning |
| Föräldravy, barnvy, onboarding, parkoppling, album, inställningar | Klar |
| Uppläsning (sv-SE), ljud, animationer, föräldraspärr (PIN) | Klar |
| Backend: Supabase-schema, RLS, edge functions, RevenueCat-webhook | Klar i koden, behöver ett Supabase-projekt ([docs/backend.md](docs/backend.md)) |
| Grafik | Platshållare (vektor) tills riktig grafik tas fram |
| App Store / Google Play | Kräver utvecklarkonton, EAS och listningar |

Utan Supabase körs appen i **lokalt läge**: allt på en enhet, där barn och
föräldrar delar enheten och föräldraläget skyddas med PIN.

## Kommandon

| Kommando | Vad |
|---|---|
| `npx expo start` | Startar utvecklingsservern |
| `npm test` | Enhetstester (Jest) |
| `npm run test:db` | Databastester mot riktig Postgres (PGlite) |
| `npm run typecheck` / `npm run lint` | Typkontroll och lint |
| `npm run verify` | Allt ovan, plus kontroll av genererade filer |
| `npm run sync:shared` | Kopierar motorn till edge functions (efter ändringar i `src/domain` eller `src/backend`) |
| `npm run seed:sql -- --new` | Ny katalogmigration efter ändringar i `seed/*.json` |
| `npm run build:web` | Webbexport till `dist/` |

## Struktur

```
src/app/          skärmar (Expo Router): welcome, onboarding, parent, child, pair
src/domain/       spelmotorn – ren TypeScript, körs både i appen och på servern
src/backend/      serverlogik utan Deno-beroenden (commit, notiser, RevenueCat)
src/features/     funktioner per område (barn, varelser, album, onboarding …)
src/state/        lokal och molnbaserad backend, offline-kö
src/lib/          i18n (svenska), lagring, tal, ljud, media, Supabase-klient
seed/             utmaningsbibliotek, varelser, milstolpar, belöningsförslag
supabase/         migrationer, edge functions och databastester
docs/             specifikation och backend-guide
```

## Utveckla från mobilen

Repot är kopplat till Claude Code. Öppna <https://claude.ai/code>, välj repot
`jagkan` och beskriv ändringen. Claude arbetar i en egen gren och öppnar en pull
request; CI kör alla tester, och när du slår ihop till `main` byggs
webbförhandsvisningen om automatiskt.

## Integritet

Foton och videor av barnen sparas bara på enheten där de togs och laddas aldrig
upp. Barn har inga konton: bara förnamn och födelsemånad. Ingen reklam och ingen
tredjepartsanalys.
