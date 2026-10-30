# Relief Studio 8 — Küstenkorrektur & Bedienleiste

**Neuerungen Version 8:** Das Meer wird aus gemeinsam verbundenen, gerichteten OSM-Küstenlinien (`natural=coastline`) polygonisiert. Die Landseite wird nicht länger durch unabhängig geschlossene Küstenabschnitte überschwemmt. Wenn das errechnete Meer viele OSM-Gebäude überdeckt, wird das unsichere Wasserpolygon nicht gezeichnet und ein Warnhinweis angezeigt. Unvollständige Küstenlinien werden ebenfalls nicht als Meer geraten.

**Wichtig für Foz/Rostock:** Nach dem Update die Originalkarte **neu laden**. Version 8 nutzt einen separaten Datencache; frühere `.relief.json`-Projekte mit alten Meerespolygonen müssen neu geladen werden. Im importierten Altprojekt wird der Export der veralteten Küstenfläche blockiert und die Begründung angezeigt.

**Bedienleiste:** Auf Desktop ist die Höhe ein echtes Flex-Verhältnis der sichtbaren Fensterhöhe; die Einstellungen scrollen im Mittelteil, die Aktionen „Zurück“ / „Weiter“ bleiben vollständig im Fenster. Mobil darf die Seite vertikal scrollen.

**Prüfungen:** `npm test`, `python tests/v8_layout.py`, `python tests/preview_alignment.py`, `python tests/workflow_browser.py`. Die Tests verwenden explizit synthetische Küsten-/Gebäudegeometrie, nicht vermessene Foz-Daten. Für einen kommerziellen Start muss eine reale Foz-Karte und ein physischer Probedruck geprüft werden. Weitere Angaben und genaue Ergebnisse in `TEST-REPORT.md`.

> **Relief Studio 7:** Poster-Vorschau auf allen Papierformaten korrigiert. Papierhintergrund und Canvas sind nun millimetergenau im selben Seitenverhältnis (auch 60 × 80 cm); kein weißer Überstand. Regressionsprüfung: `python tests/preview_alignment.py`. Weitere Details siehe TEST-REPORT.md.

# Relief Studio 6

Zwei getrennte, geführte Abläufe für Kartenposter und druckbare Stadtreliefs. Bestehende Relief-Studio-2-Projektdateien bleiben lesbar. Keine externen JavaScript-Abhängigkeiten.

## Starten

**Am einfachsten:** `Relief-Studio.html` in einem aktuellen Browser öffnen. Diese lokale Datei hat keine Passwortsperre. Internet wird nur für neue Orte, Kartengrundlagen und Höhendaten gebraucht. Gespeicherte Projekte können offline bearbeitet werden.

**Serverversion:** Node.js 22 oder neuer installieren. Im entpackten Ordner `node server.mjs` ausführen; dann `http://127.0.0.1:8080` öffnen. Im persönlichen ZIP ist das bekannte Testpasswort vorbereitet. `node setup.mjs` setzt ein eigenes Passwort. `auth.local.json` niemals veröffentlichen. Öffentliche Bereitstellung benötigt HTTPS, ein längeres Passwort und den bewusst konfigurierten HOST.

**GitHub Pages:** `site/` enthält jetzt eine eigenständige, einmalig AES-GCM-verschlüsselte Version 6. Die v6-Einstiegsdatei lädt nur `bundle6.json`, `bundle6-*.b64` und `gate-v6.js` statt aller historischen Upgrade-Patches. Die Kurz-PIN `2808` ist **keine sichere serverseitige Authentifizierung** und kann mit lokalem Ausprobieren erraten werden. Keine vertraulichen Daten auf der GitHub-Pages-Testseite ablegen. Historische Bundle-Dateien bleiben zur Kompatibilität in GitHub erhalten, werden aber von v6 nicht mehr benötigt.

## Neu in Version 6

- **Desktop-Layout ohne Scrollen der gesamten Seite:** für 1366×768 bis 3200×1800 getestet. Sidebar-Einstellungen scrollen bei Bedarf getrennt; mobile Browser behalten vertikales Scrolling. Große Poster nutzen die verfügbare Höhe, ohne Fußleiste und Druckbereich abzuschneiden.
- **Format im Schritt „Text & Layout“:** Papierformat, Hoch-/Querformat, exakte Breite/Höhe bereits während der Gestaltung. Separater Regler für die **Kartenfläche (55–100 %)** und den **Außenrand (0–100 mm)**. Der Export-Schritt enthält nun nur DPI, PDF/JPEG/PNG und die abschließende Dateiprüfung.
- **Quellenzeile steuerbar:** standardmäßig sichtbar. Ausblenden ausschließlich für eigene, nicht öffentlich genutzte Entwürfe. Sobald ein Poster weitergegeben oder veröffentlicht wird, muss eine angemessene OpenStreetMap-Namensnennung mit URL wieder enthalten sein; nicht kommerziell ist keine generelle Ausnahme. Interaktive OSM-Kartengrundlage behält ihren Quellenverweis.
- **60×80 cm bei 300 dpi:** PNG und JPEG können auf passenden Desktopgeräten mit 7087×9449 Pixeln erzeugt werden; JFIF/pHYs-DPI-Daten werden geprüft. Der tatsächliche Test mit synthetischen Stadtdaten ergab ca. 1,2–1,5 MB. Bei komplexeren Daten und der 8-MB-Schranke kann die App die DPI reduzieren und informiert vor dem Download. **Vektor-PDF** bleibt die bevorzugte maximale Druckqualität ohne Pixelbegrenzung. Moderne Browser können durch Arbeitsspeicher die Rastergröße begrenzen.
- **Schnellerer GitHub-Start:** ein neuer, konsistenter verschlüsselter v6-Codeblock anstatt historischer Patch-Ketten. Die 4-stellige PIN bietet trotz Verschlüsselung keinen Schutz für Kundendaten.

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
5. **Export:** Papierformate bereits im vorherigen Schritt einstellen; hier 150–600 dpi und PDF, PNG, JPEG wählen. Bei „Fläche füllen“ kann der geografische Rand abgeschnitten werden, bei „Ganzer Ausschnitt“ nicht.

Maximal **8.000.000 Byte** pro Poster. Vektor-PDF besitzt echte Papiermaße. Rasterdateien enthalten DPI-Metadaten. Eine notwendige Reduktion wegen Speicher- oder Dateigrenzen wird vor dem Download angezeigt. Das PDF ist RGB, kein zertifiziertes PDF/X oder CMYK-Profil. Zeichen außerhalb WinAnsi werden im PDF transliteriert; für uneingeschränkte Browser-Schriftzeichen Rasterexport nutzen.

## 3D

**Ort → Relief → Details → Export.** Echte Geländehöhen und OSM-Gebäude; getrennte Überhöhung, Wahrzeichenanpassung, Rahmen, Boden, Gewässertiefe und Straßenrelief. STL und 3MF sind Millimeterdateien eines zusammenhängenden Körpers. Die 8-MB-Grenze gilt nicht für 3D. Farben sind Vorschaufarben, keine Materialzuordnung. Ein Wechsel vom reinen 2D-Poster zu 3D erfordert das Laden echter Höhen.

## Hinweise statt stummer Knöpfe

Noch nicht verfügbare Aktionen bleiben per Tastatur auffindbar. Anklicken erklärt **warum** und **was als Nächstes nötig ist**. Gründe sind beispielsweise fehlende Kartendaten, veränderter Ausschnitt, fehlendes Gelände, laufende Modellberechnung oder Export. Meldungen bleiben bis zum Schließen oder zur nächsten Meldung sichtbar. Fehlgeschlagene Datenabrufe zeigen einen Wiederholen-Knopf. Ein alter Ausschnitt wird nach Größenänderung nicht unbemerkt exportiert.

## Projektdateien und Datenschutz

Speichern erzeugt `.relief.json` mit Modus, Einstellungen und Kartendaten, ohne Zugangsdaten. Version 2 und 3 werden eingelesen; gespeichert wird Version 3. Ungültige Importe überschreiben das bestehende Projekt nicht. Moduswechsel behält die Daten. „Neu“ fragt vor Verwerfen eines geladenen Projekts nach.

Externe Daten: OpenStreetMap/Overpass, Photon-Ortssuche, OSM-Grundkarte, Mapzen/AWS Terrain Tiles. Suchanfragen und Ausschnitte werden an diese Dienste übertragen. Kein Tracking. Die OpenStreetMap-Nennung kann für rein private Entwürfe ausgeblendet werden. Für Weitergabe muss sie aktiviert bleiben; Quellenangaben sind zusätzlich über „Quellen“ abrufbar. Keine Garantie für Verfügbarkeit öffentlicher Datendienste oder vollständige Gebäude-/Burghöhen.

## Entwicklung und Tests

- `npm test`: Geometrie-, Projekt-, Layout-, Gate- und Exporttests (einschließlich v6).
- `python tests/v6_browser.py`: Desktoplayout, Weißraum und PDF/JPEG/PNG 60×80 cm bei 300 dpi (synthetische Daten).
- `python tools/standalone.py`: Einzeldatei aus `public/` neu erzeugen.
- `python tests/server_check.py`: tatsächliche lokale Serveranmeldung und Zugriffskontrolle.
- `python tests/workflow_browser.py`: Browserregression mit ausdrücklich synthetischen Daten, simulierten Fehlern und echten Download-Dateien; benötigt Python Playwright und Chromium. `CHROMIUM` und `RELIEF_TEST_OUT` können als Umgebungsvariablen gesetzt werden.
- `node tests/gate.test.mjs`: statischen PIN-Zugang prüfen.

Siehe `TEST-REPORT.md` für die tatsächlich ausgeführten Prüfungen und verbleibenden Grenzen. Einen physischen Probedruck ersetzt das nicht.

## Lasttests

`npm test`, `python tests/workflow_browser.py`, `python tests/stress_browser.py`, `python tests/stress_server.py` und `python tests/server_check.py`. Die Tests für die drei gleichzeitig geöffneten Browser erzeugen jeweils 22.000 synthetische Gebäude und 7.334 Straßen; keine echten OSM-Server werden dabei automatisiert belastet. `TEST-REPORT.md` nennt gemessene Laufzeiten und Beschränkungen.

**GitHub-Quellcode:** Der textbasierte Anwendungscode ist im `relief-studio/source/`-Ordner des Repositories abgelegt. Die vom Browser geladene PIN-Version liegt separat unter `relief-studio/bundle6-*.b64`. Beide enthalten denselben Version-6-Stand.