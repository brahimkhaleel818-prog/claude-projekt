# NiteLab Quiz – Google-Tabelle einrichten (einmalig, ca. 3 Minuten)

Danach fuellt sich die Tabelle fuer immer vollautomatisch:
Jeder Klick von jedem Besucher = eine neue Zeile mit Datum, Uhrzeit,
Besucher-ID, Frage, Antwort, Kampagne usw.

## Schritt 1: Tabelle anlegen
1. Oeffne https://sheets.google.com und klicke auf "+ Leer" (neue Tabelle)
2. Gib ihr oben links den Namen: NiteLab Quiz Daten

## Schritt 2: Skript einfuegen
1. Klicke im Menue auf "Erweiterungen" -> "Apps Script"
2. Es oeffnet sich ein neues Fenster mit etwas Code darin
3. Loesche ALLES in dem Code-Fenster
4. Fuege den kompletten Inhalt der Datei "google-tabelle-skript.txt" ein
5. Druecke Strg+S (bzw. Cmd+S) zum Speichern

## Schritt 3: Veroeffentlichen
1. Klicke oben rechts auf den blauen Knopf "Bereitstellen" -> "Neue Bereitstellung"
2. Klicke auf das Zahnrad-Symbol links -> waehle "Web-App"
3. Bei "Ausfuehren als": Ich (deine E-Mail)
4. Bei "Zugriff": JEDER  (wichtig! sonst kommen keine Daten an)
5. Klicke "Bereitstellen"
6. Google fragt nach Berechtigung: "Zugriff autorisieren" -> dein Konto waehlen
   -> ggf. "Erweitert" -> "Weiter zu ... (unsicher)" -> "Zulassen"
   (Das ist DEIN eigenes Skript, die Warnung ist normal.)
7. Am Ende bekommst du eine "Web-App-URL", die mit /exec endet

## Schritt 4: URL an Claude schicken
Kopiere die komplette URL (https://script.google.com/macros/s/..../exec)
und schicke sie im Chat an Claude. Claude baut sie dann ins Quiz ein.
