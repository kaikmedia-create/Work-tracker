# Relief Studio 3

Zwei getrennte, geführte Abläufe für Kartenposter und druckbare Stadtreliefs. Bestehende Relief-Studio-2-Projektdateien bleiben lesbar. Keine externen JavaScript-Abhängigkeiten.

## Starten

**Am einfachsten:** `Relief-Studio.html` in einem aktuellen Browser öffnen. Diese lokale Datei hat keine Passwortsperre. Internet wird nur für neue Orte, Kartengrundlagen und Höhendaten gebraucht. Gespeicherte Projekte können offline bearbeitet werden.

**Serverversion:** Node.js 22 oder neuer installieren. Im entpackten Ordner `node server.mjs` ausführen; dann `http://127.0.0.1:8080` öffnen. Im persönlichen ZIP ist das bekannte Testpasswort vorbereitet. `node setup.mjs` setzt ein eigenes Passwort. `auth.local.json` niemals veröffentlichen. Öffentliche Bereitstellung benötigt HTTPS, ein längeres Passwort und den bewusst konfigurierten HOST.

**GitHub Pages:** `site/` enthält die verschlüsselte statische Vorschau. Die kurze PIN ersetzt keine serverseitige Authentifizierung. Kein Schutz vertraulicher Kundendaten. Der aktuelle Pages-Build besteht aus dem unveränderten v2-Grundpaket plus einem authentifiziert verschlüsselten v3-Update. `gate-v3.js` prüft die Ausgangsdateien vor Anwendung des Updates.

## Poster

1. Startauswahl **Poster gestalten**.
2. **Ort:** Stadt suchen, geografische Breite und Höhe in km einstellen und Karte laden. Für normale 2D-Poster wird kein 3D-Modell und kein Höhenraster benötigt.
3. **Kartenstil:** Farbwelten, individuelle Farben, Straßenhierarchie, Gebäude und Wahrzeichen einstellen. Beschriftung ohne rechteckige Hintergründe; optional feine Schriftkontur. Höhenlinien und Höhenfärbung verlangen echte Geländedaten; fehlen diese, wird das Nachladen erklärt.
4. **Text & Layout:** Klassisch, Modern, Editorial oder Nur Karte; Schriftfamilie, Gewicht, Großschreibung, Größe, Buchstabenabstand, Ausrichtung, Unterzeile, persönliche Zeile, Koordinaten, Text ober-/unterhalb der Karte, Trennlinie und Kartenrand. Bei „Nur Karte“ bleiben Texte gespeichert, werden aber nicht gedruckt.
5. **Export:** Foto-/Rahmenformate, A5–A0 oder eigene Maße; Hoch-/Querformat; PDF, PNG, JPEG. Bei „Fläche füllen“ kann der geografische Rand abgeschnitten werden, bei „Ganzer Ausschnitt“ nicht.

Maximal **8.000.000 Byte** pro Poster. Vektor-PDF besitzt echte Papiermaße. Rasterdateien enthalten DPI-Metadaten. Eine notwendige Reduktion wegen Speicher- oder Dateigrenzen wird vor dem Download angezeigt. Das PDF ist RGB, kein zertifiziertes PDF/X oder CMYK-Profil. Zeichen außerhalb WinAnsi werden im PDF transliteriert; für uneingeschränkte Browser-Schriftzeichen Rasterexport nutzen.

## 3D

**Ort → Relief → Details → Export.** Echte Geländehöhen und OSM-Gebäude; getrennte Überhöhung, Wahrzeichenanpassung, Rahmen, Boden, Gewässertiefe und Straßenrelief. STL und 3MF sind Millimeterdateien eines zusammenhängenden Körpers. Die 8-MB-Grenze gilt nicht für 3D. Farben sind Vorschaufarben, keine Materialzuordnung. Ein Wechsel vom reinen 2D-Poster zu 3D erfordert das Laden echter Höhen.

## Hinweise statt stummer Knöpfe

Noch nicht verfügbare Aktionen bleiben per Tastatur auffindbar. Anklicken erklärt **warum** und **was als Nächstes nötig ist**. Gründe sind beispielsweise fehlende Kartendaten, veränderter Ausschnitt, fehlendes Gelände, laufende Modellberechnung oder Export. Meldungen bleiben bis zum Schließen oder zur nächsten Meldung sichtbar. Fehlgeschlagene Datenabrufe zeigen einen Wiederholen-Knopf. Ein alter Ausschnitt wird nach Größenänderung nicht unbemerkt exportiert.

## Projektdateien und Datenschutz

Speichern erzeugt `.relief.json` mit Modus, Einstellungen und Kartendaten, ohne Zugangsdaten. Version 2 und 3 werden eingelesen; gespeichert wird Version 3. Ungültige Importe überschreiben das bestehende Projekt nicht. Moduswechsel behält die Daten. „Neu“ fragt vor Verwerfen eines geladenen Projekts nach.

Externe Daten: OpenStreetMap/Overpass, Photon-Ortssuche, OSM-Grundkarte, Mapzen/AWS Terrain Tiles. Suchanfragen und Ausschnitte werden an diese Dienste übertragen. Kein Tracking. Quellenhinweise bleiben im Poster und in der Projektdatei. Keine Garantie für Verfügbarkeit öffentlicher Datendienste oder vollständige Gebäude-/Burghöhen.

## Entwicklung und Tests

- `npm test`: Geometrie-, Projekt-, Layout- und Exporttests.
- `python tools/standalone.py`: Einzeldatei aus `public/` neu erzeugen.
- `python tests/server_check.py`: tatsächliche lokale Serveranmeldung und Zugriffskontrolle.
- `python tests/workflow_browser.py`: Browserregression mit ausdrücklich synthetischen Daten, simulierten Fehlern und echten Download-Dateien; benötigt Python Playwright und Chromium. `CHROMIUM` und `RELIEF_TEST_OUT` können als Umgebungsvariablen gesetzt werden.
- `node tests/gate.test.mjs`: statischen PIN-Zugang prüfen.

Siehe `TEST-REPORT.md` für die tatsächlich ausgeführten Prüfungen und verbleibenden Grenzen. Einen physischen Probedruck ersetzt das nicht.
