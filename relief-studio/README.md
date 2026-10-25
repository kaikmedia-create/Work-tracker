# Relief Studio 5

Zwei getrennte, geführte Abläufe für Kartenposter und druckbare Stadtreliefs. Bestehende Relief-Studio-2-Projektdateien bleiben lesbar. Keine externen JavaScript-Abhängigkeiten.

## Starten

**Am einfachsten:** `Relief-Studio.html` in einem aktuellen Browser öffnen. Diese lokale Datei hat keine Passwortsperre. Internet wird nur für neue Orte, Kartengrundlagen und Höhendaten gebraucht. Gespeicherte Projekte können offline bearbeitet werden.

**Serverversion:** Node.js 22 oder neuer installieren. Im entpackten Ordner `node server.mjs` ausführen; dann `http://127.0.0.1:8080` öffnen. Im persönlichen ZIP ist das bekannte Testpasswort vorbereitet. `node setup.mjs` setzt ein eigenes Passwort. `auth.local.json` niemals veröffentlichen. Öffentliche Bereitstellung benötigt HTTPS, ein längeres Passwort und den bewusst konfigurierten HOST.

**GitHub Pages:** `site/` enthält die verschlüsselte statische Vorschau. Die kurze PIN ersetzt keine serverseitige Authentifizierung. Kein Schutz vertraulicher Kundendaten. Der Pages-Build besteht aus einem unveränderten verschlüsselten Grundpaket und verifizierten Update-Patches bis Version 5. `gate-v5.js` prüft vor dem Start jede Dateiprüfsumme.

## Neu in Version 5

- Kartenausschnitte für **Poster** bis 24 × 24 km Seitenlänge (maximal 240 km²), 3D wegen Druckdetail / Rechenlast weiterhin maximal 12 km und 80 km². Große öffentliche Overpass-Abfragen können an Serverlimits scheitern; ein kommerzieller oder selbst betriebener Datendienst ist für Kundeneinsatz sinnvoll.
- Interaktive OSM-Karte: sichtbare Kacheln mit **höchstens fünf gleichzeitigen Ladevorgängen**, keine Vorab-Downloads, platzsparender In-Memory-Cache, Browser-HTTP-Cache, zusammengefasste `requestAnimationFrame`-Zeichenläufe. Trackpad-Zoom zeitlich geglättet.
- 3D: WebGL-Puffergröße nur bei Größenänderungen neu gesetzt, Rendering pro Frame zusammengefasst, Software-Fallback mit begrenzter Detailstufe. Hohe Modellauflösung bleibt im Export erhalten.
- Postervorschau: Subpixel-/Massendaten bedarfsorientiert reduziert und ausdrücklich markiert; **Export nutzt alle Quelldaten**, niemals reduzierte Vorschau. Vektor-PDF-Erzeugung gibt den UI-Thread regelmäßig frei.
- Eingangsgrößen begrenzt: OSM-JSON bis 22 MB, Schutz vor fehlerhaften / nie beendeten Datenstreams, Cache-Version gegen veraltete Küstendaten, Cache-Einträge mit Ablaufzeit. Fehlgeschlagene Fremddienste liefern verständliche Meldungen.
- **Eigener Node-Server**: Content-Security-Policy, Anti-Framing, restriktive Berechtigungen, Anfragelimits pro IP, Größenlimit für Login-Payload. Bind an eine öffentliche IP nur bei `HTTPS_ONLY=1` **und** neuem `APP_PASSWORD` (mindestens 12 Zeichen). Lokale Test-PIN bleibt möglich. **GitHub Pages bietet weiterhin keinen echten serverseitigen PIN-Schutz.**
- Alle Belastungstests verwenden absichtlich synthetische Daten; **keine** Lasttests gegen öffentliche OSM-/Overpass-Server. Datenlizenzen und Attribution bleiben bestehen.


- Poster- und 3D-Abläufe bleiben konsequent getrennt. Im Kartenstil erscheint die Karte groß und ohne Titelblock; Text und Druckrahmen erst im nächsten Schritt.
- Ostsee und andere offene Meeresflächen können jetzt über OSM-`natural=coastline`-Wege rekonstruiert werden; gesplittete Wege werden richtungstreu verbunden. Unvollständig kartierte oder weit entfernte reine See-Ausschnitte bleiben eine Datenquellen-Grenze.
- Kartengeometrie ist auch im Vektor-PDF auf den Kartenrahmen begrenzt. Selbst bei flächenfüllendem Beschnitt werden Straßen, Polygone und Marker nicht in Titel oder weißen Außenrand gezeichnet.
- Beim Ziehen eines Auswahl-Eckpunkts und beim Neuzeichnen bleibt das ursprüngliche Seitenverhältnis exakt erhalten, berechnet im Mercator-Projektionsraum. Trackpad-Radbewegungen werden in begrenzte Zoomstufen zusammengefasst.
- Die Beschriftung der Ortsmarker ist einzeln auswählbar, mit eigener Schriftfamilie, Schriftfarbe und Punktfarbe. Die Postervorlage 60 × 80 cm ist ergänzt.
- Der vom Nutzer gewünschte vollständige Verzicht auf OSM-Namensnennung ist nicht möglich: Der gedruckte Plan behält eine kleine lesbare Copyrightzeile im Außenrand; die interaktive OpenStreetMap-Karte ebenfalls. Weitere Quelle / Lizenz ist in Projektdatei und Hilfe dokumentiert.

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

## Lasttests

`npm test`, `python tests/workflow_browser.py`, `python tests/stress_browser.py`, `python tests/stress_server.py` und `python tests/server_check.py`. Die Tests für die drei gleichzeitig geöffneten Browser erzeugen jeweils 22.000 synthetische Gebäude und 7.334 Straßen; keine echten OSM-Server werden dabei automatisiert belastet. `TEST-REPORT.md` nennt gemessene Laufzeiten und Beschränkungen.