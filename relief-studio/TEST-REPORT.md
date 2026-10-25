# Prüfprotokoll · Relief Studio 5 · 24.10.2026

## Tatsächlich erfolgreich ausgeführt

- **27 Node-Tests:** Geometrie, geschlossene Kanten, Datenvalidierung, Version-2-Migration, Version-3-Einstellungen, Textkästen entfernt, Schriftkontur, Layouts, Farben, Koordinaten, PDF-Schriften.
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

## Version 4 Nachtests (25.10.2026)

- 27 von 27 Node-Tests erfolgreich: zusätzlich zusammenhängende OSM-Küstenwege, korrekte Meerseite, Rahmenschnitt, 60 × 80 cm und selektive Ortsmarker.
- 46 von 46 automatisierten Chromium-Checks erfolgreich, inklusive beider Abläufe, OSM-HTTP-503-Simulation, fehlendem Gelände, 8-MB-Limit, mobilem UI und STL/3MF.
- Zusätzlicher interaktiver Browsertest: die große Kartenvorschau zeigt die Straße, der Reglerwert 5 wird aktualisiert, Markerfarbe und individuelle Markerwahl funktionieren.
- 60 × 80 cm Vektor-PDF aus synthetischer Testkarte erstellt und per PyMuPDF geprüft: 60,000 × 80,000 cm, Copyright in der Ausgabedatei lesbar.
- **Nicht nachgewiesen**: vollständiger realer Rostock-Liveabruf (öffentliche OSM-Abfrage war aus dieser lokalen Umgebung nicht erreichbar). Ein echter Printshop-Test und 3D-Probedruck stehen aus.

## Version 5 – Performance- und Sicherheitstests (25.10.2026)

- **31 von 31 Node-Tests** bestanden, inkl. großer Poster-Ausschnitte, defensiver JSON-Grenzen und Vorschau-Detailreduzierung.
- **46 von 46 Chromium-Workflow-Checks** erneut bestanden: Poster, 3D, Abbruch/Fehler, Migration, STL/3MF, PNG/JPEG/PDF und mobile Ansichten.
- **3 parallele Chromium-Instanzen mit jeweils 22.000 synthetischen Gebäuden + 7.334 Straßen**, pro Instanz 80 schnelle Regleränderungen und ein 60×80-cm-Vektor-PDF. Keine JavaScript-Ausnahmen, alle drei PDFs unter 8 MB.
- **Kacheltest (vollständig lokal gemockt):** 28 sichtbare Testkachel-Anforderungen, maximal 5 gleichzeitig (konfiguriertes Maximum 5). Test erzeugt keine OSM-Netzwerklast.
- **HTTP-Lasttest (localhost):** 320 authentifizierte kleine Statusanfragen, Parallelität 32, Messdauer 0.079 s, p95 13.6 ms (Messwerte ausschließlich auf Testhost/localhost, keine Aussage über Internetlast).
- **Server-Sicherheit:** CSP- und Anti-Framing-Header, HttpOnly/SameSite-Cookie, übergroße Logins HTTP 413, API-Rate-Limit 429, Traversalschutz und Verweigerung öffentlicher Bind ohne HTTPS plus starkes Passwort geprüft.
- **3D-Raster-Benchmark:** 641 Rasterpunkte horizontal, 503 synthetische Gebäude: 387.722 Vertices und 775.440 Dreiecke in etwa 177 ms (ein lokaler Node-Prozess, Hardware abhängig).

### Messwerte der parallelen Browserläufe

- Browser 1: 80 Regleränderungen 1790 ms; PDF 1126 ms; 621,494 Byte; Fehler: 0.
- Browser 2: 80 Regleränderungen 1787 ms; PDF 1159 ms; 621,494 Byte; Fehler: 0.
- Browser 3: 80 Regleränderungen 1866 ms; PDF 1074 ms; 621,494 Byte; Fehler: 0.

**Grenzen:** Live-Verfügbarkeit und lizenzgerechte kommerzielle Belastbarkeit von Overpass / OSM kann durch lokale Tests nicht bestätigt werden. Die öffentliche Vorschau mit PIN `2808` ist trotz Verschlüsselung offline angreifbar und ersetzt keine serverseitige Anmeldung. Der Start des eigenen Node-Servers unter einer echten CSP wurde über HTTP-Header und Komponenten geprüft; Chromium blockierte die Verbindung zu `localhost` in der Testumgebung, sodass ein CSP-Browser-Test am echten Server nicht abgeschlossen wurde. Keine Garantie für reale Printshops oder physischen 3D-Druck.