# Prüfprotokoll · Relief Studio 3 · 24.10.2026

## Tatsächlich erfolgreich ausgeführt

- **22 Node-Tests:** Geometrie, geschlossene Kanten, Datenvalidierung, Version-2-Migration, Version-3-Einstellungen, Textkästen entfernt, Schriftkontur, Layouts, Farben, Koordinaten, PDF-Schriften.
- **46 Browserprüfungen in Chromium:** Startauswahl, beide vierstufigen Abläufe, Tastatur-Erklärungen, simulierte HTTP-503-Fehler und Abbruch, optionale Höhendaten, Farben/Typografie, Projekt speichern/öffnen, beschädigter Import ohne Datenverlust, alter Ausschnitt blockiert, Moduswechsel, STL/3MF, mobile Breiten 320/390/700 px. Keine unbehandelten JavaScript-Fehler.
- **10 Serverprüfungen:** anonymer Zugriff, Quellenzugriff, falsches/richtiges Passwort, Ausschnittvalidierung, verborgener Servercode, Pfad-Traversal, fremder Logout-Ursprung, Abmelden und Anmelde-Ratenlimit.
- **Unabhängige Geometrieprüfung mit trimesh:** Test-STL geschlossen, konsistente Orientierung, positives Volumen, ein zusammenhängender Körper. 3MF-Archiv ohne CRC-Fehler und gültige Komponentenstruktur.
- **PDF-Prüfung:** Papiermaße 100 × 150, 210 × 297 und 841 × 1189 mm; Text extrahierbar. Vorschau mit PyMuPDF gerendert und geprüft. PNG-DPI-Metadaten mit Pillow geprüft.

## Browser-Exporte (synthetische Testkarte)

| Papierformat | Datei | Bytes | Ausgabe |
|---|---|---:|---|
| 10 × 15 cm | PDF | 10,126 | 0.01 MB · Vektorgrafik · 10 × 15 cm |
| 10 × 15 cm | PNG | 123,768 | 0.12 MB · 1182 × 1772 px · 300 dpi |
| 10 × 15 cm | JPEG | 206,302 | 0.21 MB · 1182 × 1772 px · 300 dpi |
| A4 | PDF | 10,170 | 0.01 MB · Vektorgrafik · 21 × 29.7 cm |
| A4 | PNG | 297,632 | 0.30 MB · 2481 × 3508 px · 300 dpi |
| A4 | JPEG | 544,971 | 0.54 MB · 2481 × 3508 px · 300 dpi |
| A0 | PDF | 10,430 | 0.01 MB · Vektorgrafik · 84.1 × 118.9 cm |
| A0 | PNG | 919,717 | 0.92 MB · 5319 × 7519 px · 161 dpi |
| A0 | JPEG | 1,447,374 | 1.45 MB · 5319 × 7519 px · 161 dpi |

Alle neun Dateien liegen unter 8.000.000 Byte. A0-Rasterdateien wurden wegen des Bildspeicher-Limits auf effektiv etwa 161 dpi reduziert; die Benutzeroberfläche zeigte dies an. PDF blieb vektorbasiert.

## Einordnung / nicht behauptet

Die Testkarte enthält 503 ausdrücklich synthetische Gebäude; sie ist kein vermessenes Weinheim-Modell. Die deterministischen Browsertests simulieren Datenabruf, Ausfall und Abbruch. Sie bestätigen keine Verfügbarkeit externer Kartendienste. Der Live-Datenabruf wird separat dokumentiert, soweit ausgeführt. Keine pauschale Aussage „alles auf jedem Gerät funktioniert“. Kein physischer Testdruck, keine Sicherheitszertifizierung, keine PDF/X-/CMYK-Zertifizierung. Gebäudehöhen und Burgdetails bleiben von Quelldaten abhängig.

Statische GitHub-Pages-PIN: verschlüsseltes Programmpaket, aber keine serverseitige Zugangskontrolle. Kurze PINs sind offline erratbar. Die Serverversion wurde separat geprüft.
