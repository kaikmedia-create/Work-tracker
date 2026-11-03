# Relief Studio 17 – Wiederholte Szenario- und Exportprüfung

Stand: 3. November 2026. Basis-Commit: `9418bdeb4128ee1d6073cdf4f6e3b70eef57834f`.

## Behobene Fehler

- Vollständig gespeicherte Kartenpakete haben Vorrang vor veralteten Teilungsplänen. Ein fertiges übergeordnetes Paket löst keine erneuten, möglicherweise scheiternden Teilabfragen aus.
- Bereits wartende Netzwerkanfragen prüfen HTTP-429-Sperren unmittelbar vor dem Senden. Das Anfragebudget zählt tatsächliche Anbieterabfragen, nicht Cache-Lesezugriffe.
- Alle öffentlichen Anbieter bekommen dasselbe Antwortzeitfenster von 45 Sekunden. Das bisherige 19-Sekunden-Limit für Ersatzanbieter konnte eine zulässige 25-Sekunden-Serverberechnung vorzeitig abbrechen. Das globale Abruflimit und die begrenzte Wiederaufnahme bleiben bestehen.
- Der europäische Spezialanbieter wird nur für konservativ abgegrenzte, abgedeckte Regionen gewählt, nicht mehr für nordafrikanische Ausschnitte. Andere Regionen verwenden die globalen Anbieter.
- Fehlerhafte gespeicherte Datenpakete werden nicht als erfolgreich geladen akzeptiert. Ein endgültiger Fehler der benötigten Höhenkacheln beendet auch die noch laufenden Kartenabfragen zeitnah.
- Abbrechen beendet jetzt auch den aktiven 3D-Worker. Neue Einstellungen, Projektwechsel und Import stoppen veraltete Berechnungen; vollständig geladene Kartendaten bleiben erhalten.
- Ein STL-/3MF-Klick lädt genau die Modelldatei. Die Quellenangaben sind weiterhin verfügbar, jetzt ausdrücklich als separater Download statt als konkurrierender zweiter automatischer Download.
- Das Öffnen der verschlüsselten Vorschau hat begrenzte Wartezeiten für Antwortkopf und Inhalt, einen begrenzten Wiederholungsversuch und einen Diagnoseknopf bei Fehlern.

## Durchgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| Vollständige Node-Testsuite auf Arbeitsstand | 182 bestanden, 0 fehlgeschlagen |
| Vollständige Node-Testsuite nach Installation auf frischer v16-Kopie | 182 bestanden, 0 fehlgeschlagen |
| Vollständiger Chromium-Szenariolauf | 29 bestanden, 0 fehlgeschlagen |
| Wiederholung des Chromium-Laufs auf frischer Projektkopie | 29 bestanden, 0 fehlgeschlagen |
| Originaler hochgeladener Weinheim-Ausschnitt bei 100, 200 und 300 mm | 3 von 3 bestanden; alle 3.294 Gebäude-/Mauerobjekte erhalten |
| Unabhängiges Einlesen von zwei STL- und zwei 3MF-Dateien | 4 von 4 geschlossen, konsistent orientiert, ein zusammenhängender Körper, keine flächenlosen Dreiecke |

Die Browserläufe prüfen Modusauswahl, kompletten Kartenlader bis 3D-Vorschau, Cache-Wiederholung, ausfallenden ersten Anbieter, fehlende Pflichtdaten, Wiederholung nur fehlender Pakete, HTTP 429 einschließlich sofortiger Wiederholung, fehlerhafte Höhenkachel, Abbruch und nächsten Ladeversuch, Import des echten Weinheim-Projekts, tatsächliche STL-/3MF-Exportklicks, separaten Quellen-Download, Abbruch während des echten 3D-Aufbaus, schnelle Parameterwechsel, Poster aus vorhandenen Weinheim-Daten, PDF-/PNG-/JPEG-Export sowie fehlerhaften Import und Diagnose-JSON.

Das reale Weinheim-Projekt umfasst etwa 2,027 × 1,901 km. Bei 200 mm Kartenbreite entstanden 612.546 Dreiecke, 306.275 Knoten und ein zusammenhängender Körper. Kein Gebäude wurde entfernt. Die vorhandenen numerischen Kontaktkorrekturen und Exportprüfungen bleiben aktiv.

## Aussagegrenzen

Die Browserprüfung verwendet den tatsächlich vom PIN-Gate entschlüsselten, prüfsummengeprüften Anwendungscode und den echten 3D-Worker. Die vollständigen Weinheim-Daten stammen aus der zuvor vom Nutzer hochgeladenen Projektdatei; sie wurden nicht neu vom öffentlichen Kartendienst geladen. Netzwerkausfälle, HTTP 429/400/404 und ausbleibende Antworten wurden kontrolliert simuliert, um sie zuverlässig wiederholen zu können. Ein frischer Live-Overpass-Abruf war in der verfügbaren Browserumgebung nicht ausführbar und wird nicht als bestanden dargestellt.

Diese Ergebnisse beweisen weder Verfügbarkeit öffentlicher Kartendienste noch die Gültigkeit jedes beliebigen größeren Stadtmodells. Der frühere 4 × 4-km-Ausschnitt mit 9.231 Objekten ist nicht Teil dieser Abnahme. Kein physischer Testdruck oder manueller Slicer-Test wurde durchgeführt. Die Mesh-Prüfung repariert die Dateien nicht nachträglich; sie ist keine vollständige Selbstüberschneidungsprüfung.

## Veröffentlichung und Reproduzierbarkeit

Die statische Website lädt `gate-v17.js` und das SHA-256-geprüfte `upgrade17.json`. Für die native Anwendung rekonstruiert `source/tools/prepare_release17.mjs` die enthaltenen Änderungen vor `npm start` und `npm test`. Der unveränderte v16-Quellstand dient als Basis; unbekannte Bearbeitungen werden nicht überschrieben. Vor einer direkten Bearbeitung der Rohdateien einmal `npm run prepare:source` ausführen.

Aus `relief-studio/source` mit Node 22 oder neuer:

```sh
npm test
RELIEF_DIAG_FIXTURE=/privater/pfad/Weinheim.json npm run test:scenarios
RELIEF_DIAG_FIXTURE=/privater/pfad/Weinheim.json npm run test:weinheim
```

Die Browserprüfung benötigt Python Playwright und Chromium. Sie läuft lokal ohne externe Navigation und ersetzt ausschließlich Netzwerkantworten in den expliziten Fehlerszenarien. Ohne private Weinheim-Datei lässt sie die datenabhängigen Abnahmen ausdrücklich aus. Private Projektdateien, Diagnoseinhalte und Modellexporte werden nicht ins Repository übernommen.
