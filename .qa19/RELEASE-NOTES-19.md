# Relief Studio 19 – reproduzierbare Stadtmodelle und verständliche Diagnosen

Kartenausschnitte lassen sich auf 0,001 km genau einstellen. Früher konnte zum Beispiel 0,36 km abgewiesen werden, während der vorherige Ausschnitt aktiv blieb. Ein zu kleiner Ausschnitt nennt jetzt die Mindestgröße. Kleinste unterstützte Seite: 100 m.

Eine in Heidelberg beobachtete Naht besteht aus einer langen Kante und einer genau gegenläufigen Kette kürzerer Kanten. Die Reparatur fügt nur bestehende Punkte dieser vollständigen Kette ein. Kuppeldächer verwenden disjunkte Segmentflächen. Geschlossenheit und Orientierung bleiben Pflicht. Der 3D-Worker meldet Modellierungsschritte und unterscheidet 120 s Stillstand von 360 s Gesamtzeit. Abbrechen bleibt möglich.

Die Fehleranzeige und der lokale Diagnose-Download nennen Phase, Code, nächsten Schritt und verfügbare Fakten: etwa betroffene Kachel, Dienst, HTTP-Status, Paketstand, Modellbreite oder Objekt-ID. Defekte Höhenkacheln werden nicht als gültig gespeichert. Unlesbare ältere Cache-Einträge werden erneut angefragt. Importfehler unterscheiden unter anderem ungültiges JSON, ein Protokoll ohne Kartendaten und ein ungültiges Höhenraster. Es gibt keine automatische Übertragung der Diagnose.

Die automatischen Regressionen laufen mit `cd relief-studio/source && npm test`. `tests/diagnostic19_ui.py` vergleicht den sichtbaren Text und die über den Downloadknopf gespeicherte JSON. `tests/cities19_live.py OUT` führt echte, begrenzte Browserabrufe für Berlin, Heidelberg und zwei Weinheim-Ausschnitte aus (nach `npm test` das Verzeichnis `source` lokal auf 127.0.0.1:8765 ausliefern, Chrome-Pfad per `CHROMIUM`). Fehlende externe Daten werden nicht durch Testgebäude oder flaches Gelände ersetzt.
