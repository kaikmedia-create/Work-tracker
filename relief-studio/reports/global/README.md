# Globale Quellenprüfung und Basismodell – 5. November 2026

## Anwendung
Im 3D-Modus einen Ort suchen oder Koordinaten eingeben, Ausschnitt wählen und erstellen. Ist „Weltweite Gebäudedaten beim Laden abgleichen“ aktiv (Standard), ermittelt Relief Studio die Kacheln aus den Koordinaten. Es verwendet den geprüften Overture-Stand 2026-10-21.0 mit Gebäuden und Teilen, Verkehr und Gewässern/Grün. OSM ergänzt, soweit verfügbar; Gelände wird getrennt geladen. Keine Liste unterstützter Städte im weltweiten Basispfad. Unterstützter Breitenbereich: 80° Süd bis 80° Nord. Ohne nutzbare Basisobjekte oder erforderliche Geländedaten wird kein fiktives Modell freigegeben.

Die Quelleninformation unterscheidet bestätigtes Flachdach, erfasste Dachform, zugeordnete Teile/Dachflächen und fehlende Dachangabe. Ein Quellenwert für die Höhe ist noch kein Beleg für eine Vermessung. Overture-Veröffentlichung und individuelles Aufnahmejahr sind nicht dasselbe. In den Niederlanden kann die 3DBAG-Schnittstelle Dächer räumlich zuordnen; nur eindeutige Zuordnungen mit plausibler Grundfläche werden ergänzt. Es gibt keinen neuen manuellen Import.

## Was nachgewiesen ist
353 automatische Tests. Die vorregistrierte Matrix wurde mit einem neuen Browserkontext je Ausschnitt über die echte PIN-Oberfläche geprüft. 24 von 24 Downloads aus sechs bewohnten Kontinenten gelangen, ohne Test-Stadtpakete: 0,5, 2 und 5 km Seitenlänge, darunter Tromsø, Baarle sowie ein Ausschnitt über den 180. Längengrad auf Taveuni. 22 Fälle simulierten einen Ausfall von Overpass; dabei blieben die globalen Archive und das Gelände echte Netzwerkabrufe. Drei erneute Archivabrufe gelangen ohne Netzwerkbytes. Die STL-Prüfung validierte Dreieckszahl, endliche Koordinaten, positive Fläche und Volumen, genau zwei entgegengesetzte Flächen pro Kante und einen zusammenhängenden Körper. Kein physischer Probedruck.

Der ausführliche [Messlauf](matrix.json) mit Prüfcode e0bbac0 dokumentiert unter anderem 38 zugeordnete 3DBAG-Dächer in Delft, 41 in Groningen und 36 in Baarle. Von 24.557 Hauptgebäuden hatten 24.192 keine übernommene Dachangabe oder detailliertere Zuordnung in der Statistik. Diese Stichprobe misst weder die weltweite Abdeckung noch die Richtigkeit jeder Silhouette. Die beiden unveränderten privaten Regressionen erzeugten byteidentische STL-Dateien; die Projekte wurden nicht veröffentlicht. Der ergänzende Test für Sfax in Tunesien lief nach Korrektur des Worker-Starts in mobilen WebKit- und Chromium-Emulationen bis zum STL-Download. Keine physischen Gerätetests.

## Bekannte Grenzen und Betrieb
Die weltweit nutzbare Basis ist nicht mit weltweiter Vermessung gleichzusetzen. Ein getrennt aktivierter Laserscan-Adapter für LINZ, ein globales Kronenhöhenraster, eigene Produktions-Kachelspiegel, umfassende Kostenmessungen sowie der unabhängige Abgleich von Dachtyp, Höhe und Silhouette sind nicht Teil dieser Freigabe. Die globalen PMTiles und öffentlichen Zusatzdienste werden direkt gelesen und haben hier keine Verfügbarkeitszusage. Im lokalen Checkout `cd relief-studio/source && npm test` bzw. `npm start`: Die üblichen npm-Vorskripte rekonstruieren den verifizierten Anwendungsstand. Die veröffentlichte PIN-Seite rekonstruiert denselben Stand aus SHA-256-geprüften Deltas.

- [Weltweite Browserprüfung und zusammengefasste Messwerte](https://github.com/kaikmedia-create/Work-tracker/actions/runs/42045336412)
- [Wiederholung mit dem portablen Worker](https://github.com/kaikmedia-create/Work-tracker/actions/runs/42048129339)
- [Beide mobilen Browser-Engines](https://github.com/kaikmedia-create/Work-tracker/actions/runs/42048128782)
- [Overture-Quellen und Lizenznachweise](https://docs.overturemaps.org/attribution/) · [3DBAG API](https://api.3dbag.nl/api.html)
