---
name: grafikteam
description: Kör JagKan!s grafikteam (speldesigner, art director, bildproducent, granskare) för att designa och producera barnets växande värld med lokal ComfyUI. Använd för allt som rör grafik, världen och bildproduktion.
---
Uppdrag: $ARGUMENTS
(Om inget uppdrag angavs: fortsätt där teamet slutade enligt docs/grafik/status.md.)

Teamet arbetar i faser. Stanna efter varje fas och låt användaren godkänna
innan nästa fas startar. Håll docs/grafik/status.md uppdaterad (fas, beslut, nästa steg).

FAS 1 – Världsdesign: subagenten "speldesigner" skriver docs/grafik/varldsdesign.md.
  Visa en kort sammanfattning och fråga användaren om justeringar.
FAS 2 – Stil: subagenten "art-director" skriver docs/grafik/stilguide.md med
  2–3 stilriktningar. Låt "bildproducent" göra 2–3 testbilder per riktning
  (samma motiv) så att användaren kan välja med egna ögon.
FAS 3 – Stiltest: när en stil valts, producera 5 nyckel-assets (t.ex. startmark,
  en byggnad, en varelse, en dekor, en upplåsningseffekt). "granskare" granskar,
  "art-director" justerar promptbibeln. Upprepa tills användaren är nöjd.
FAS 4 – Produktion: bildproducent → granskare i omgångar om ~10 assets,
  MVP-prioritet först. Visa varje omgång för användaren.
FAS 5 – In i appen: bygg världsvyn i barnvyn enligt varldsdesign.md
  (en egen värld per barn, aldrig bakåt), med tester. Kör `npm run verify`.

Ingen AI-generering sker i appen – bilderna tas fram här under utvecklingen och
levereras som vanliga filer.
