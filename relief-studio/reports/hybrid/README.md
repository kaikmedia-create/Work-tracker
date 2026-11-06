# Klassische Kanten und gebäudeweise Messhöhen

Abnahme: 6. November 2026. Geprüfter Anwendungscode: 62fc025b25a7e9b90d669b12d6bdf09cbe9cc3a8. Ausgangsstand: 9827e37d8e9b8a193a7e94b9f1a101df4fe682f5.

## Bedienung und Standard
Unter Relief → Stadtoberfläche ist „Klassisches Kartenrelief · Standard“ voreingestellt. Dieser Modus ruft keine Messoberflächen ab. Frühere automatische Rastereinstellungen ohne surfaceSchema:2 werden auf Klassisch migriert. Eine danach ausdrücklich gewählte Messoberfläche bleibt auswählbar.

„Klassische Kanten + Messhöhen“ nutzt dieselbe klassische Gebäudegeometrie, ergänzt aber geeignete Gebäudehöhen aus vorhandenen Messdaten. Keine Mittelung zweier fertiger Meshes, keine Rastertreppen an den Gebäudeumrissen. Originale Grundrisse, Innenhöfe und Gelände bleiben unverändert. Der unveränderte Desktopaufbau und die vorhandene mobile Navigation bleiben erhalten; ergänzt wurden die Modusauswahl und ihre Erklärung.

## Methode und Grenzen
Die ortsunabhängige Funktion akzeptiert normalisierte Höhenraster bzw. Sampler. Die Quelle muss Meter, Auflösung und Höhenbezug deklarieren. Absolute Höhen benötigen Bodenhöhen im identischen vertikalen Bezugssystem. Kein Ortsname oder Wahrzeichenname steuert die Entscheidung.

Je Gebäude werden höchstens 24 × 24 Positionen im Inneren des kartierten Grundrisses geprüft. Ränder, Innenhöfe und bekannte separate Gebäudeteile werden ausgeschlossen. Mindestens zwölf verschiedene gültige Messpositionen und 65 Prozent Abdeckung sind erforderlich. Median/MAD, Höhenstreuung und lokale Rauigkeit filtern Ausreißer und unplausible Oberflächen. Bekannte Vegetationsklassen werden nicht als Gebäude verwendet. Diese Filter sind Plausibilitätsprüfungen, keine Garantie einer korrekten Gebäudeklassifizierung bei unklassifizierten Daten.

Die robuste P70-Höhe ersetzt einen unsicheren Gebäudeschätzwert; bei kartierten geneigten Dächern wird P95 als Näherung an den oberen Dachbereich verwendet. Ein 82-m-Testgebäude bleibt somit 82 m hoch, statt mit dem bisherigen 9-m-Standard auf einen künstlichen Mittelwert gesenkt zu werden. Die kartierte Dachform wird nicht neu erfunden. Manuelle Höhen, explizite kartierte Gesamthöhen und vorhandene detaillierte Dachmodelle haben Vorrang. Getrennt kartierte Türme und Anbauten werden separat geprüft.

Messlücken oder unzureichende Auflösung lassen das betroffene Gebäude unverändert. Bei Problemen mit der resultierenden Gebäudegeometrie wird die klassische Geometrie erneut berechnet und die nicht übernommene Höhenkorrektur protokolliert. Der bereits bestehende, ausdrücklich bezeichnete Höhenhüllen-Fallback für Fehler des globalen Basismodells bleibt unverändert; die Kombination schaltet nicht automatisch auf die rohe Messoberfläche um.

Die Messadapter sind nicht auf eine Stadt beschränkt. Die derzeit tatsächlich angebundenen nDSM-Kacheln decken allerdings nur die bereits vorbereiteten regionalen Messgebiete ab. Diese Freigabe erschließt keine neue weltweite Laserscan-Abdeckung. Andere Orte verwenden weiterhin das globale klassische Modell und verfügbare kartierte bzw. zugeordnete Dachdaten. Rasterabstand im Protokoll ist nicht mit Vermessungsgenauigkeit gleichzusetzen; die nDOM1-Quelle besitzt 1-m-Quelldaten.

## Nachweise
[Kompletter CI-Lauf](https://github.com/kaikmedia-create/Work-tracker/actions/runs/42195810922): 382 automatische Tests bestanden, davon 29 neue Tests zur Fusion und zum Standardmodus. Dazu gehören Hochhäuser, Einzelspitzen, Innenhöfe, Gebäude-/Turmtrennung, manuelle Höhen, Messlücken, Vegetationsklassen, Höhensysteme und Abbruch. Dieselbe Regel wurde mit kontrollierten Daten an acht Koordinatenlagen auf sechs Kontinenten, am Datumsmeridian und in hoher Breite geprüft.

Alle 24 vorregistrierten internationalen Browserfälle liefen erneut mit frischen Browserkontexten durch die echte PIN-Seite bis zum STL-Download. Daten kamen aus den öffentlichen globalen Archiven und Geländekacheln, ohne Stadt-Testpakete. 22 Fälle simulierten den Ausfall des optionalen Overpass-Dienstes. Die tatsächlichen STL-Bytes wurden unabhängig auf endliche Koordinaten, positive Fläche/Volumen, zwei entgegengesetzte Flächen pro Kante und genau einen verbundenen Körper geprüft. Diese Fälle belegen den unveränderten globalen Basisbetrieb, nicht weltweite Messabdeckung.

Sieben zusätzliche Browserfälle prüften Klassisch → Kombination → Klassisch: Heidelberg, Karlsruhe und Sfax im Desktop-Chromium; Heidelberg und Sfax jeweils in mobiler Chromium- und WebKit-Emulation. In Heidelberg wurden 418 von 587 Gebäudeobjekten ergänzt, 127 Angaben geschützt und 42 mangels ausreichender Messgrundlage beibehalten. In Karlsruhe waren es 141 von 210, 24 geschützt und 45 beibehalten. In Sfax gab es keine Messkacheln: Die Hybrid-STL blieb byteidentisch zur klassischen STL. Auch der Rückwechsel zu Klassisch erzeugte in allen sieben Fällen wieder die ursprünglichen STL-Bytes. Keine unbehandelten JavaScript-Fehler. Der reguläre Diagnose-Download enthält die Entscheidungen je Gebäude. Kein Test auf physischen Smartphones und kein physischer Probedruck.

Zwei unveränderte gespeicherte private Projekte wurden zusätzlich lokal gegen vorhandene Messkacheln berechnet, nicht frisch aus OSM abgerufen: 4.226 Objekte / 3.551 ergänzte Höhen / 1.792.452 Dreiecke und 6.346 Objekte / 5.260 ergänzte Höhen / 2.313.020 Dreiecke. Beide binären STL-Dateien wurden unabhängig erneut eingelesen: ein geschlossener Körper, keine flächenlosen Dreiecke. Private Projekte, Einzelgebäudeprotokolle und STLs wurden nicht veröffentlicht.

## Protokoll und Wiederholung
Der lokale Diagnose-Download und Quellennachweis enthalten Quelle, algorithmische Entscheidung, ursprüngliche und übernommene Höhe, Stichprobenzahl, Abdeckung und Ablehnungsgrund je Gebäude. Die Anwendung verändert dafür nicht die Originalgebäudedaten. Beim Wechsel auf Klassisch wird die vorherige Messhöhenzuordnung aus der aktuellen Diagnose entfernt.

`cd relief-studio/source && npm test` rekonstruiert und prüft den SHA-256-gesicherten Anwendungsstand. `tests/hybrid-browser.py <Website-URL> <Ausgabeordner> chromium desktop` bzw. `webkit mobile` wiederholt die zusätzlichen Browserfälle (Playwright 1.57.0, NumPy und SciPy). `tools/install_hybrid.py` dokumentiert ausschließlich die einmalige Erstellung aus dem oben bezeichneten Ausgangsstand und ist kein normaler Startschritt.
