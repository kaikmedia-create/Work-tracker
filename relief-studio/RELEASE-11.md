# Relief Studio 11 – Lade-Stabilität

Der Pages-Einstieg verwendet jetzt gate-v11.js. Dieser entschlüsselt das bestehende v10-Grundpaket mit der bisherigen PIN und wendet upgrade11.json plus upgrade11-*.b64 an. SHA-256-Prüfungen sichern die unveränderte Basis, das komprimierte Update und jede geänderte Datei ab. Keine Kundendaten oder Zugangsdaten sind im Update enthalten. Die statische PIN ist weiterhin kein serverseitiger Schutz.

## Änderungen

Kleinere, getrennte OSM-Geometrie- und Multipolygon-Anfragen. Größere Ausschnitte werden in Teilpakete zerlegt; nach einem tatsächlichen Ausführungszeitlimit kann Geometrie begrenzt weiter geteilt werden. Vollständige Polygone bleiben erhalten. Erfolgreiche Pakete werden sofort für Wiederholungen gespeichert, auch wenn spätere Pakete scheitern. Zwei parallele OSM-Anfragen maximal, begrenzter Alternativversuch bei Netzwerk-/Serverfehlern, Retry-After bei 429. Zusätzliche historische Orte dürfen höchstens zwölf Sekunden blockieren; danach wird die vollständige Basiskarte mit Warnung nutzbar. Fehlende Pflichtdaten werden nicht als fertige Karte ausgegeben. Gesamtzeit- und Speicherlimits bleiben bestehen.

## Quellcode im Checkout

Die Dateien unter source/ sind die vorhandene Basis plus dieses versionierte Update. Alle Änderungen und neuen Tests sind im Delta enthalten. Für direkt editierbare Version-11-Dateien vom Repository-Stamm aus ausführen:

```sh
python relief-studio/source/tools/apply_release11.py
```

Das Skript prüft vor dem Schreiben alle Basis- und Zielprüfsummen und ist wiederholt ausführbar. Lokale Änderungen müssen vorher gesichert/abgeglichen werden. Das Download-ZIP enthält bereits die angewendeten Dateien sowie den kompletten historischen Testsatz; der historische source/-Ordner im Repository enthielt nicht alle alten Testdateien.

## Prüfungen und Grenzen

85 Node-Tests, 15 gezielte Loader-Browserprüfungen, 46 Workflowprüfungen und 10 lokale Serverprüfungen bestanden. Drei Lasttest-Instanzen mit jeweils 25.000 synthetischen Gebäuden und acht Wiederholungen: keine zusätzlichen Netzabrufe bei den Wiederholungen. Simulierte Antworten prüfen den echten Ladecode, nicht die Verfügbarkeit öffentlicher Dienste. Ein externer Foz-Diagnoseabruf erhielt HTTP 406. Kein erfolgreicher vollständiger Live-Stadtabruf und keine garantierte reale Ladezeit behauptet. Siehe TEST-REPORT-11.md.
