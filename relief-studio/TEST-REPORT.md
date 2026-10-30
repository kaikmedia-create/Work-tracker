# Relief Studio 9 — Prüfergebnisse (30.10.2026)

**Tatsächlich lokal ausgeführt:**

- 54/54 Node-Tests: unveränderte Geometry-, Coastline-, Schema- und Print-Tests plus 6 v9-Tests (Regionen, neue OSM-Historic-Tags, POI-Klassen, mehr Marker, Prioritäten, Foz/Photon).
- 18/18 gezielte Chromium-Browsertests mit ausdrücklich synthetischen historischen POIs: Foz-Preset, Regionalbeschriftung, Suche, Kategorie, Max-Marker, Priorität, Gruppenwahl, manuelle Marker, Umschalten der Automatik, 60×80-cm-Vektor-PDF mit echten Millimetern und unter 8 MB.
- 46/46 ältere Browser-Regressionstests: Poster, 3D, Import/Export, Fehler, mobile Größen.
- 16/16 Desktop-Navigationstests (acht Auflösungen, jeweils beide Modi), keine abgeschnittenen Buttons.

**Nicht behauptet:** Die POI-Testdaten sind synthetisch. Die Menge und Qualität historischer Orte aus Foz/Google Maps wurde nicht live als vollständig verifiziert. Keine automatischen Google-Places-Daten; keine neuen echten OSM-Marker erfunden. Reale OSM-/Photon-Verfügbarkeit ist abhängig von externen Diensten. Keine physische Testdruckabnahme. Die statische 4-stellige PIN ist kein sicherer Schutz für vertrauliche Kundendaten.

# Relief Studio 8 — Fehleranalyse, Referenz & Tests · 30.10.2026

## Vom Nutzer bereitgestellte Foz-Ausgaben

Die gelieferten PDF-Dateien zeigen bei enger Auswahl Stadtgrundrisse unter fast vollständig wasserblauem Hintergrund. Die größere Ausgabe zeigt eine plausible Trennung von Foz und der Ría. Bei einer RGB-Auswertung des Kartenbereichs (grobe farbbasierte Näherung, kein vermessener Wasserflächenanteil) waren ca. 92,6 % beim kleineren Ausschnitt und 29,5 % beim größeren hellblau.

## Technischer Fehler

Die bisherige Hilfsfunktion hat jede offene `natural=coastline`-Linie eigenständig mit dem Kartenrand zu einem Polygon geschlossen. Bei mehreren Linien konnte das zu großflächigen Überlappungen und zur Füllung von Land als Meer führen. Die neue Funktion verbindet die OSM-Teilstücke und konstruiert aus Küsten- und Rahmenkanten **disjunkte Flächen**, die gemäß OSM-Richtungsregel klassifiziert werden: Land links, Meer rechts. Bei unvollständiger Topologie wird der ungeklärte Bereich nicht künstlich gefüllt. Meerespolygone, die mehr als 12 % einer Gebäude-Stichprobe überdecken (bei mindestens zwölf Gebäuden), werden unterdrückt und es erscheint eine Warnmeldung.

## Reproduzierbare Tests

- Node: 48 Tests, 0 Fehler. Darunter 8 neue Küstenprüfungen (kleiner/größerer Foz-Ausschnitt mit demselben synthetischen Küsten-Datensatz; OSM-Richtung; segmentübergreifender Küstenverlauf; Insel-Landflächen; unvollständige Linie; Gebäudeschutz; PDF-Pfad).
- Browser: 46 Workflows/Export-/Moduswechselprüfungen bestanden.
- Sichtbarkeit der Navigationsbuttons: 16 Desktopprüfungen in 8 Auflösungen, Poster- und 3D-Modus. Beide Buttons vollständig im Fenster, mindestens 44 Pixel hoch, anklickbar, keine überlappenden Bedienfelder oder Dokument-Scrollbars.
- Posterformat / Seitenverhältnis: 54 Prüfungen über 8 Papierformate und 6 Viewports einschließlich Mobilansicht und Querformat. Kartenbild und Posterhintergrund bleiben deckungsgleich.
- PIN: Node-Test verifiziert richtige/falsche PIN und die vollständig entschlüsselte Version 8; Live-GitHub-Pages-Test nach Veröffentlichung getrennt dokumentieren.

## Nicht als bestätigt ausgeben

Es konnte kein vollständiger Live-Overpass-Datensatz für Foz aus der Containerumgebung abgerufen werden. Die neuen Tests nutzen **synthetische OSM-Wege und 160 Gebäude** an Foz-Koordinaten; die georeferenzierte Realität von Foz muss auf der live veröffentlichten Seite noch einmal beurteilt werden. Ein physischer Probedruck oder Belastungstest öffentlicher Overpass-Dienste wurde nicht ausgeführt. Der GitHub-Pages-PIN ist kein sicherer serverseitiger Login.

## Relief Studio 7 · Regressionsprüfung der Poster-Vorschau (25.10.2026)

**Fehler reproduziert:** Vor dem Fix verwendete der Poster-Papiercontainer weiterhin das A4-Seitenverhältnis 210:297. Bei 60 × 80 cm war er z. B. im 1536×960-Viewport 421,77×596,48 px groß, das Canvas aber 428,25×571 px. Daraus entstanden rechts und unten überstehende weiße Flächen.

**Behebung:** Dynamische Papiergröße/-ratio und Canvas deckungsgleich aus dem tatsächlich gewählten Exportformat berechnet; keine separate A4-CSS-Abmessung mehr. `overflow:hidden` sorgt zusätzlich für sauberen Randabschluss.

**Nachgewiesen:** 54 unabhängige Browserprüfungen aus 8 Formaten × 6 Viewports plus Querformat (inkl. 1536×960, 2048×1294, 3200×1800, 1366×768, 1920×1080 und 390×844). Jede geprüft auf identische linke/obere/rechte/untere Koordinaten, gleiches Formatverhältnis und vollständigen Einschluss im Vorschaubereich. 38 Node-Logiktests bestanden. Zusätzlich 21 Export-/Desktop-Prüfungen: 60×80 cm PDF 600×800 mm, PNG/JPEG 7087×9449 Pixel bei 300 dpi und jeweils unter 8 MB.

**Grenzen:** Mit synthetischem Stadtdatensatz getestet; reale externe Overpass-Erreichbarkeit, physischer Druck und Farbverbindlichkeit nicht abgenommen. Der PIN auf GitHub Pages ist keine serverseitige Authentifizierung.

---

# Relief Studio 6 — Testbericht — 25.10.2026

## Resultate

- **38 Node-Tests bestanden:** Geometrie/Coastline, gespeicherte Einstellungen, Kartenskalierung, Attributionswahl, Ausgabevorgaben sowie v6-PIN-Entschlüsselung mit Authenticated Encryption und Negativtest für falsche PIN.
- **46 Browser-Regressionsprüfungen bestanden:** Moduswahl Poster/3D, Text-Stil, Projekte speichern/laden, ungültige Importe, 503-Fremddienst, Abbruch, PDF/PNG/JPEG 10x15/A4/A0, STL/3MF, mobile 320/390/700 Pixel, keinerlei unbehandelte JavaScript-Fehler. Kartendaten künstlich/synthetisch.
- **21 gezielte v6-Browserprüfungen bestanden:** 60x80-cm-Format im Text/Layout-Schritt, Rand 32 mm, Kartenbreite 72%, OSM-Quellenzeile privat aus/an, Exportvorschau, PDF/JPEG/PNG. Originaldateien unabhängig mittels PyMuPDF und Pillow geprüft.
- **Desktoplayout** 1366x768, 1440x900, 1920x1080, 2048x1294, 3200x1800: Kein Browser-Dokument-Overflow; die Einstellungsseite scrollt separat. Mobile 390 Pixel behält das erwartete vertikale Scrollen.
- **Server-HTTP-Sicherheitscheck:** anonyme API 401, falsches Passwort 401, korrektes Login 200, ungültige Bounds 400, Quellcode 404, Traversal 404, Cross-Origin Logout 403, Rate-Limit 429.
- **Website-Startprüfung:** Die neue statische AES-GCM-Version-6-Veröffentlichung wird mit PIN 2808 erfolgreich entschlüsselt; falsche PIN wird abgewiesen. Dieser Test wurde in isolierter Node-Umgebung ausgeführt (die lokale HTTP-Navigation war im Test-Chromium gesperrt).

## Druckgröße und Dateibelege

| Test | Maße | Dateigröße | Ergebnis |
|---|---|---:|---|
| PDF | 600 x 800 mm (1700,787 x 2267,717 pt) | ca. 0,01 MB | echte Vektorgrafik; keine feste dpi-Grenze |
| PNG | 7087 x 9449 px; 300 dpi | ca. 1,24 MB | Pixelzahl und pHYs-DPI-Metadaten verifiziert |
| JPEG | 7087 x 9449 px; 300 dpi | ca. 1,50 MB | Pixelzahl und JFIF-DPI-Metadaten verifiziert |

**Wichtige Einschränkung:** Diese Dateien wurden aus einer **synthetischen Teststadt mit 503 Gebäuden** erzeugt, nicht aus Rostock. Bei echten Karten mit Tausenden komplexer Polygone können PNG/JPEG über 8 MB liegen; dann gibt es eine ausdrücklich angezeigte DPI-/JPEG-Qualitätsanpassung (bei aktivierter adaptiver Auflösung) oder einen Fehler. Ein 300-dpi-Rasterexport ist deshalb nicht für jede beliebige Stadt und jedes Endgerät garantiert. Für großformatigen Druck eignet sich die Vektor-PDF-Ausgabe. Keine PDF/X/CMYK-Zertifizierung.

## Offen / Grenzen

- Kein vollständiger E2E-Live-Test von aktuellen Overpass-Stadtdaten in diesem Durchlauf, damit öffentliche Dienste nicht belastet werden.
- Kein physischer Probedruck und keine Zertifizierung durch einen Fotodienst.
- GitHub Pages ist trotz verschlüsseltem Bundle und 4-stelliger PIN **keine serverseitige Zugangssperre**. Für Kundendaten ist ein echter Server/Cloud-Zugangsschutz erforderlich.
- OSM-Quellenzeile kann für rein persönliche Entwürfe ausgeblendet werden. Vor öffentlicher Verbreitung oder Teilen muss der Nutzer sie wieder einschalten. Private/nicht kommerzielle Nutzung allein befreit nicht generell von der Namensnennung.