# Relief Studio 2

Eigenständiger Karteneditor für geografische Stadtreliefs und hochwertige Poster. Diese Ergänzung liegt vollständig in `relief-studio/`; die vorhandenen Work-tracker-Dateien bleiben unverändert.

## Öffnen

https://kaikmedia-create.github.io/Work-tracker/relief-studio/

Die PIN wurde dem Eigentümer separat mitgeteilt. Diese statische Vorschau ist AES-GCM-verschlüsselt, aber KEIN serverseitiger Zugangsschutz. Kurze PINs sind durch Offline-Raten angreifbar. Keine vertraulichen Kundendaten hier speichern. GitHub Pages kann den mitgelieferten Node-Server nicht ausführen.

## Vollständiger Quellcode

Nach dem Öffnen: **Hilfe & Quellen → Vollständigen Quellcode herunterladen**. Das verschlüsselte Programmpaket enthält die unminifizierten HTML/CSS/JavaScript-Dateien, Node-Server, Passwort-Setup, README und Tests. `bundle-0.bin` bis `bundle-6.bin` gehören zusammen; `bundle.json` enthält die Kryptoparameter. Es werden keine Kundendaten, API-Schlüssel oder Server-Passwörter im Repository hinterlegt.

## Funktionen

- Echte OpenStreetMap-Geometrie und Terrarium-Höhendaten; Photon-Ortssuche.
- Bearbeitbarer geografischer Ausschnitt; separate physische Modellgröße und Postermaße.
- Gelände-, Gebäude- und Wahrzeichenüberhöhung; manuell korrigierbare Gebäudehöhen.
- Unterschiedliche Hauptstraßen, Nebenstraßen und Wege.
- Drehbare 3D-Ansicht mit Software-Fallback, STL und 3MF.
- PNG/JPEG mit DPI-Metadaten und geometrisch berechnetes Vektor-PDF.
- A5 bis A0, Foto- und Rahmenformate, eigene Größen; höchstens 8.000.000 Byte pro Posterdatei.
- Speichern und Öffnen von Version-2-Projekten mit Daten.

## Grenzen und Prüfung

Diese Version wurde neu implementiert; sie ist kein verifiziertes Update des nicht verfügbaren früheren Quellcodes. Alte Projektdateien haben kein zugesichertes Importformat.

Weinheim, Heidelberg, Mannheim und New York sind Standort-Voreinstellungen, keine vorab heruntergeladenen Stadtdatensätze. Gebäudehöhen werden bei fehlenden Angaben geschätzt und als solche ausgewiesen. Wahrzeichen sind nur so detailliert wie die verfügbaren Grundrisse und Höhen; keine Rekonstruktion historischer Fassaden. Die Druckgeometrie ist ein geschlossenes Raster-Höhenfeld. Dünne Details können bei kleiner Ausgabe entfallen; die Oberfläche weist darauf hin.

Lokal geprüft: neun Core-Tests, geschlossene STL-Geometrie, neun Browser-Posterexporte jeweils unter 8 MB, PDF-Papiermaße, PNG/JPEG-DPI, mobiler Umbruch, Server-Anmeldung und Zugriffssperren, falsche/richtige PIN des statischen Pakets. Dafür wurden ausdrücklich synthetische Testdaten genutzt. Live-Datenabrufe, WebGL-Grafik auf realen Endgeräten, physischer Testdruck und Lastbetrieb sind nicht durch diese Tests abgedeckt.

Rasterexporte haben zusätzlich ein Speicherlimit; bei A0 kann die tatsächliche DPI daher geringer als der Wunschwert sein. Das wird vor dem Download angezeigt. Vektor-PDF bleibt für großformatige Karten die bevorzugte Ausgabe. RGB, kein PDF/X-CMYK-Preflight.

## Eigener Server

Quellcode herunterladen, Node.js ab Version 22 bereitstellen, `node setup.mjs`, dann `node server.mjs`. Lokal: http://127.0.0.1:8080. Für öffentliche Nutzung HTTPS-Reverse-Proxy und längeres Passwort konfigurieren. Keine npm-Laufzeitabhängigkeiten.

## Daten und Rechte

OpenStreetMap © OpenStreetMap contributors (ODbL), https://www.openstreetmap.org/copyright . Terrain Tiles: https://github.com/tilezen/joerd/blob/master/docs/attribution.md . Photon: https://github.com/komoot/photon . Quellenhinweise in Exporten beibehalten. Für einen Kundenbetrieb müssen Datenanbieterbedingungen, Kapazität und notwendige Rechte gesondert geprüft werden.
