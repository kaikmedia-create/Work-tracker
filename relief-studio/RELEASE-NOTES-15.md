# Relief Studio 15 – Kantenkorrektur und Diagnose-Download

Die XY-Punktsuche deckt jetzt den gesamten bereits zugelassenen Zusammenführungsradius ab. Zwei Rundungsfelder Abstand wurden bisher trotz gültiger Nähe nicht geprüft. Die Toleranz selbst wurde nicht vergrößert. Damit wird der bereitgestellte reale Weinheim-Diagnosefall erfolgreich berechnet, ohne Gebäude zu entfernen oder den Ausschnitt zu verkleinern.

Ein unabhängiger kleiner **↓ Diagnose**-Knopf erscheint bei jeder angezeigten Fehlermeldung, zusätzlich zu „Erneut versuchen“. Der JSON-Download enthält Version, Zeitpunkt, Fehlercode, Stacktrace, begrenzten Ladeverlauf, Browserinformationen sowie Einstellungen und vorhandene Kartendaten des Fehlerzeitpunkts. Er bleibt lokal; keine automatische Übertragung und kein Zugriff auf PINs, Cookies oder Browser-Speicher. Fehler beim Öffnen des Studios erhalten einen separaten Startdiagnose-Download.

Worker-Fehlerdetails bleiben erhalten. Ein fehlgeschlagener Modellaufbau nach einem Import wird nicht mehr durch eine Erfolgsmeldung überdeckt. Das begrenzte Worker-Zeitlimit beträgt 120 Sekunden; abgelaufene Worker werden vor dem nächsten Versuch neu angelegt.

Die historischen Gates bleiben unverändert. Das neue Gate und der lokale Quellcode verwenden dieselben SHA-256-geprüften Änderungen. `npm test` rekonstruiert den Quellcode bei Bedarf ohne unbekannte Änderungen zu überschreiben.

## Prüfungen
Der reale, vom Benutzer bereitgestellte Ausschnitt wurde mit 3.294 Gebäuden bei 100, 200 und 300 mm Kartenbreite geprüft. Bei 200 mm entstanden 612.546 Dreiecke. Alle drei Modelle: geschlossene Oberfläche, entgegengesetzte Kantenorientierung, ein zusammenhängender Körper, positives Volumen, keine flächenlosen Dreiecke und kein ausgelassenes Gebäude. STL/3MF wurden sowohl programmgesteuert als auch über echte Chromium-Exportklicks erstellt und anschließend unabhängig in Python/trimesh eingelesen.

Die vollständige Benutzerdiagnose wird **nicht** in das Repository übernommen. `RELIEF_DIAG_FIXTURE=/pfad/diagnose.json npm run test:weinheim` wiederholt den Realfall lokal.

**Status dieses Pakets:** lokal getestet, kein GitHub-Push und keine Bestätigung eines Live-Deployments. Kein physischer Probedruck; keine Aussage, dass jeder beliebige andere Stadtausschnitt bereits geprüft ist.
