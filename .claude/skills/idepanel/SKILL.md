---
name: idepanel
description: Låter tre agenter – kritiker, investerare och domare – utvärdera en idé eller ny funktion för JagKan!. Använd när användaren vill testa/validera en idé.
---
Utvärdera idén: $ARGUMENTS

Om ingen idé angavs: fråga användaren vilken idé som ska utvärderas.

1. Starta subagenterna "kritiker" och "investerare" parallellt (i samma steg) och ge båda idén.
2. När båda är klara: skicka idén + kritikerns svar + investerarens svar till subagenten "domare".
3. Visa för användaren på svenska:
   - Kritikern: 3–5 punkter
   - Investeraren: 3–5 punkter
   - Domarens fullständiga utlåtande
Ändra ingen kod – detta är endast en utvärdering.
