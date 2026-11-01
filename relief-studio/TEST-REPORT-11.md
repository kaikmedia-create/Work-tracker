# Relief Studio 11 – Lade-Stabilität

Stand: 1. November 2026.

## Tatsächlich ausgeführt

- 85 Node-Tests bestanden: 61 bisherige Prüfungen (an die Paketaufteilung und den v11-Zugang angepasst) plus 24 neue Netz-/Cache-Tests.
- 15 Browserprüfungen mit dem tatsächlichen v11-Ladecode bestanden: Byte-Streams, begrenzte Parallelität, Cache-Reuse, fehlgeschlagene Pflichtdaten, Wiederaufnahme, Abbrechen, sichtbare Buttons bei 1366 × 768 bis 2560 × 1440. Keine unbehandelten JavaScript-Ausnahmen.
- 46 bestehende Browser-Workflowprüfungen bestanden, einschließlich PDF/PNG/JPEG und STL/3MF, Projektimport/-export, Fehlermeldungen und mobiler Breiten.
- 10 lokale Serverprüfungen bestanden: Anmeldung, Zugriffskontrolle, ungültige Ausschnitte, Traversal, Logout und Login-Ratenlimit.
- Lasttest: drei getrennte Loader-Instanzen, jeweils 25.000 synthetische Gebäude, ein Erstabruf und acht Wiederholungen. Die Wiederholungen brauchten keine neuen Netzwerkanfragen. Zahlen in `reports/v11/stress.json`.

## Geprüfte Fehlerfälle

Timeout bei optionalen Orten; HTTP 400/429/503; Retry-After; ungültige und abgebrochene JSON-Streams; Größenlimit ohne Content-Length; gzip-Längenangaben; Abbruch nach Antwort-Headern; blockierter IndexedDB-Start; gleichzeitige identische Abrufe; Abbruch eines geteilten Abrufs; automatische Teilung nach OSM-Ausführungszeitlimit; Gesamtzeitlimit. Fehlende Pflichtdaten werden nicht als fertige Karte exportiert.

## Grenzen der Aussage

Die Last-/Fehlertests verwenden synthetische Antworten, aber führen den echten Netzwerk-, Stream- und Cache-Code aus. Sie messen nicht die Verfügbarkeit öffentlicher Overpass-Server. Der direkte Internetzugang der Testumgebung ist gesperrt; ein einzelner externer Live-Diagnoseabruf für Foz wurde mit HTTP 406 abgewiesen. Daher kein nachgewiesener Live-Geschwindigkeitsfaktor für Foz, Rostock oder andere Städte. Öffentliche Anbieter können auch nach diesem Fix ausfallen. Keine öffentliche Infrastruktur wurde einem Stresstest ausgesetzt.

## Geänderte Architektur

Geometriepakete und Multipolygon-Relationen getrennt; über 16 km² zunächst Teilpakete; bei tatsächlich zu schwerer Geometrie weitere Teilung (begrenzt). Vollständige Polygongeometrie bleibt erhalten, um keine neuen Küstenfehler einzuführen. Höchstens zwei OSM-Anfragen je Loader, ein begrenzter Alternativversuch bei Verbindungs-/Serverfehlern, keine Serverrotation bei HTTP 429. Pflichtpakete werden vor Abschluss des Gesamtprojekts gespeichert. Optionale Marker: maximal 12 s zusätzlich, danach eine nutzbare Karte mit sichtbarer Warnung.
